// ============================================================================
// OneMetric Campaign Segmentation Engine — In-Memory Demo Store
// ============================================================================
// Manages real-time state for the interactive dashboard and API routes.
// Supports scenario dispatching, custom intent events, timer advancement,
// and complete audit trail tracking.
// ============================================================================

import type {
  ProspectState,
  IntentEvent,
  DecisionOutcome,
  HubSpotSyncPayload,
  FSMState,
  Decision,
  TestScenario,
  ExecutiveBriefing,
  FeedbackEvent,
  FeedbackRecalibrationResult,
  SourceType,
} from '../types';
import {
  ALL_SCENARIOS,
  PRODUCT_PERSONA_MAP,
  SCENARIO_1_ZERO_BASELINE,
  SCENARIO_2_VALID_SWITCH,
  SCENARIO_3_PERSONA_MISMATCH,
  SCENARIO_4_ENTERPRISE_ESCALATION,
} from '../data/mock-scenarios';
import {
  calculateCompositeScore,
  calculateDelta,
  isDualGateSatisfied,
  getDefaultConfig,
} from './scoring';
import { evaluateFSM } from './fsm';
import { evaluateWithJev } from './jev-agent';
import {
  buildHubSpotSyncPayload,
  batchSyncContacts,
  createConsolidatedAETask,
  type SyncResult,
} from './hubspot-sync';
import { generateExecutiveBriefing } from './gemini-agent';
import {
  evaluateAccountBuyingCommittee,
  type BuyingCommitteeResolution,
} from './multi-contact-evaluator';

export interface AuditEntry {
  id: string;
  timestamp: string;
  eventType: string;
  source: string;
  productId: string;
  rawScore: number;
  previousState: FSMState;
  newState: FSMState;
  decision: Decision;
  confidence: number;
  reasoning: string;
  scores: Record<string, number>;
  delta: number;
  engineUsed: string;
  latencyMs: number;
  guardsSummary: { name: string; passed: boolean }[];
}

export interface DemoStoreState {
  prospect: ProspectState;
  scores: Record<string, number>;
  delta: number;
  lastDecisionOutcome: DecisionOutcome | null;
  lastSyncPayload: HubSpotSyncPayload | null;
  lastLiveSyncResult: SyncResult | null;
  lastBriefing: ExecutiveBriefing | null;
  lastBuyingCommitteeResolution?: BuyingCommitteeResolution | null;
  lastConsolidatedTaskResult?: Record<string, unknown> | null;
  sourceWeights?: Record<SourceType, number>;
  lastJevDetails: {
    probabilities: Record<string, number>;
    intentConfidence: number;
    flappingRisk: number;
    personaMismatchRisk: number;
    latencyMs: number;
    engineUsed: string;
  } | null;
  auditLedger: AuditEntry[];
  activeScenarioId: string | null;
}

class DemoStore {
  private state!: DemoStoreState;
  private config = getDefaultConfig();
  private simulatedTime: Date = new Date();

  constructor() {
    this.reset();
  }

  public reset(scenarioId?: string): DemoStoreState {
    this.simulatedTime = new Date();

    let baseScenario: TestScenario = SCENARIO_2_VALID_SWITCH;
    if (scenarioId === 'scenario_1_zero_baseline') baseScenario = SCENARIO_1_ZERO_BASELINE;
    if (scenarioId === 'scenario_2_valid_switch') baseScenario = SCENARIO_2_VALID_SWITCH;
    if (scenarioId === 'scenario_3_persona_mismatch') baseScenario = SCENARIO_3_PERSONA_MISMATCH;
    if (scenarioId === 'scenario_4_enterprise_escalation') baseScenario = SCENARIO_4_ENTERPRISE_ESCALATION;

    // Deep clone initial state
    const initialProspect: ProspectState = JSON.parse(
      JSON.stringify(baseScenario.initialState)
    );

    // Initial scoring
    const scores: Record<string, number> = {};
    for (const p of PRODUCT_PERSONA_MAP) {
      scores[p.productId] = calculateCompositeScore(
        initialProspect.events,
        p.productId,
        this.simulatedTime,
        this.config
      );
    }

    const currentProduct = initialProspect.contact.currentCampaign ?? 'product_b';
    const competingProduct = currentProduct === 'product_b' ? 'product_a' : 'product_b';
    const delta = calculateDelta(scores[competingProduct] ?? 0, scores[currentProduct] ?? 0);

    const baselineOutcome: DecisionOutcome = {
      decisionId: `dec_init_${Date.now()}`,
      timestamp: this.simulatedTime.toISOString(),
      previousState: 'ACTIVE_CURRENT',
      newState: initialProspect.fsmState,
      decision: 'continue',
      confidence: 1.0,
      reasoning: `Baseline initial enrollment for ${initialProspect.contact.firstName} ${initialProspect.contact.lastName}`,
      scores,
      delta,
      guards: [
        { guardName: 'FATIGUE_CHECK', passed: true, reason: 'Within cadence limits (1 touch / 7d)' },
        { guardName: 'DUAL_GATE', passed: false, reason: 'No competing surge detected' },
      ],
      engineUsed: 'jev_calibrated_fallback',
      latencyMs: 0.1,
    };
    const baselineSyncPayload = buildHubSpotSyncPayload(initialProspect, baselineOutcome);

    this.state = {
      prospect: initialProspect,
      scores,
      delta,
      lastDecisionOutcome: baselineOutcome,
      lastSyncPayload: baselineSyncPayload,
      lastLiveSyncResult: {
        success: false,
        dryRun: true,
        statusCode: 503,
        endpointUsed: `/crm/v3/objects/contacts/${initialProspect.contact.contactId}`,
        message: 'Demo payload generated; no live HubSpot write was attempted.',
        error: 'Demo state is not proof of a CRM write.',
        payload: baselineSyncPayload,
      },
      lastBriefing: null,
      lastBuyingCommitteeResolution: null,
      lastConsolidatedTaskResult: null,
      lastJevDetails: null,
      auditLedger: [
        {
          id: `audit_init_${Date.now()}`,
          timestamp: this.simulatedTime.toISOString(),
          eventType: 'INITIAL_ENROLLMENT',
          source: 'hubspot_crm',
          productId: currentProduct,
          rawScore: 0,
          previousState: 'ACTIVE_CURRENT',
          newState: initialProspect.fsmState,
          decision: 'continue',
          confidence: 1.0,
          reasoning: `Initialized prospect ${initialProspect.contact.firstName} ${initialProspect.contact.lastName} in ${currentProduct}`,
          scores: { ...scores },
          delta,
          engineUsed: 'system_init',
          latencyMs: 0.1,
          guardsSummary: [
            { name: 'FATIGUE_CHECK', passed: true },
            { name: 'DUAL_GATE', passed: false },
          ],
        },
      ],
      activeScenarioId: scenarioId ?? null,
    };

    return this.getState();
  }

  public recordCommitteeResolution(
    resolution: BuyingCommitteeResolution,
    batchResult?: Record<string, unknown> | null,
    taskResult?: Record<string, unknown> | null
  ): DemoStoreState {
    this.state.lastBuyingCommitteeResolution = resolution;
    this.state.lastConsolidatedTaskResult = taskResult ?? null;

    if (resolution.briefing) {
      this.state.lastBriefing = resolution.briefing;
    }

    // Synchronize account & primary contact into prospect state so the KPI ribbon and profile reflect evaluated domain
    if (resolution.account) {
      this.state.prospect.account = resolution.account;
    }

    const primaryOutcome = resolution.contactOutcomes[0];
    if (primaryOutcome) {
      const nameParts = (primaryOutcome.name || 'Team Member').split(' ');
      this.state.prospect.contact = {
        contactId: primaryOutcome.contactId,
        email: primaryOutcome.email,
        firstName: nameParts[0] || 'Team',
        lastName: nameParts.slice(1).join(' ') || 'Member',
        jobTitle: primaryOutcome.role,
        persona: primaryOutcome.persona,
        accountId: resolution.account.accountId,
        currentCampaign: primaryOutcome.currentCampaign || 'product_b',
        enrollmentDate: new Date(Date.now() - 14 * 86400000).toISOString(),
        lastTouchDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        touchCount7d: primaryOutcome.touchCount7d,
      };
      this.state.prospect.fsmState = primaryOutcome.fsmState;
      const decisionOutcome: DecisionOutcome = {
        decisionId: `dec_comm_${Date.now()}`,
        decision: primaryOutcome.decision,
        newState: primaryOutcome.fsmState,
        previousState: this.state.prospect.previousState ?? 'ACTIVE_CURRENT',
        confidence: primaryOutcome.confidence,
        reasoning: primaryOutcome.reasoning,
        scores: { ...this.state.scores },
        delta: this.state.delta,
        guards: primaryOutcome.guards,
        engineUsed: primaryOutcome.jevEngine,
        latencyMs: primaryOutcome.jevLatencyMs,
        timestamp: new Date().toISOString(),
      };
      this.state.lastDecisionOutcome = decisionOutcome;

      // Generate the complete HubSpot sync payload for this evaluated account and contact
      const syncPayload = buildHubSpotSyncPayload(this.state.prospect, decisionOutcome);
      if (resolution.accountEscalated) {
        syncPayload.task = {
          properties: {
            hs_task_subject: `Intent Conflict Review — ${resolution.account.name}`,
            hs_task_body: `Consolidated AE Briefing Task for ${resolution.account.name} (${resolution.domain})\nCommittee size: ${resolution.totalContactsEvaluated}\nPipeline deal: $${((resolution.account.activeDeals?.[0]?.amount || 120000) / 1000).toFixed(0)}K\n\nExecutive Briefing:\n${resolution.briefing?.commercialRisk || 'Autonomous Multi-Contact Intent Surge Evaluated'}`,
            hs_task_priority: 'HIGH',
            hs_task_status: 'NOT_STARTED',
            hs_timestamp: new Date().toISOString(),
          },
          associations: [
            {
              to: { id: primaryOutcome.contactId },
              types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }],
            },
            {
              to: { id: resolution.account.accountId },
              types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 192 }],
            },
          ],
        };
      }
      this.state.lastSyncPayload = syncPayload;

      const batchResultData = batchResult as {
        success?: unknown;
        statusCode?: unknown;
        contactIds?: unknown;
        endpointUsed?: unknown;
        message?: unknown;
        error?: unknown;
      } | null | undefined;
      const returnedContactIds = Array.isArray(batchResultData?.contactIds)
        ? batchResultData.contactIds.filter((value): value is string => typeof value === 'string')
        : [];
      this.state.lastLiveSyncResult = {
        success: batchResultData?.success === true,
        dryRun: batchResultData?.statusCode === 0,
        statusCode: typeof batchResultData?.statusCode === 'number' ? batchResultData.statusCode : 503,
        ...(returnedContactIds[0] ? { hubspotObjectId: returnedContactIds[0] } : {}),
        endpointUsed: typeof batchResultData?.endpointUsed === 'string' ? batchResultData.endpointUsed : 'no contact update performed',
        message: typeof batchResultData?.message === 'string' ? batchResultData.message : batchResultData?.success === true
          ? 'HubSpot response confirmed the batch update.'
          : 'HubSpot batch update failed or was not attempted.',
        ...(typeof batchResultData?.error === 'string' ? { error: batchResultData.error } : {}),
        payload: syncPayload,
      };
    }

    const auditEntry: AuditEntry = {
      id: `audit_committee_${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'BUYING_COMMITTEE_SURGE',
      source: resolution.incomingSurge.source,
      productId: resolution.incomingSurge.productId,
      rawScore: resolution.incomingSurge.rawScore,
      previousState: this.state.prospect.fsmState,
      newState: resolution.accountEscalated ? 'ESCALATED' : 'ACTIVE_CURRENT',
      decision: resolution.accountEscalated ? 'escalate' : 'continue',
      confidence: 0.95,
      reasoning: `Domain surge on ${resolution.domain} evaluated across ${resolution.totalContactsEvaluated} committee contacts. ${
        resolution.accountEscalated ? 'Escalated to AE with consolidated task.' : 'Contacts routed autonomously.'
      }`,
      scores: { ...this.state.scores },
      delta: this.state.delta,
      engineUsed: 'multi_contact_evaluator',
      latencyMs: 0.45,
      guardsSummary: [
        { name: 'BUYING_COMMITTEE_DISCOVERY', passed: true },
        { name: 'PARALLEL_FATIGUE_CHECK', passed: true },
        { name: 'CONSOLIDATED_CRM_BATCH', passed: true },
      ],
    };
    this.state.auditLedger.unshift(auditEntry);

    return this.getState();
  }

  public async evaluateDomain(domain: string, surgeEvent?: IntentEvent): Promise<DemoStoreState> {
    const cleanDomain = domain.toLowerCase().trim();
    const incoming: IntentEvent = surgeEvent || {
      eventId: `evt_domain_${Date.now()}`,
      accountId: `acc_${cleanDomain.replace(/[^a-z0-9]/g, '_')}`,
      contactId: 'con_001',
      productId: 'product_a',
      source: 'bombora',
      sourceType: '3rd_party',
      rawScore: 88,
      timestamp: new Date().toISOString(),
    };

    const resolution = await evaluateAccountBuyingCommittee(cleanDomain, incoming);
    const batchResult = await batchSyncContacts(resolution.contactOutcomes);

    let taskResult = null;
    if (resolution.accountEscalated) {
      taskResult = await createConsolidatedAETask({
        domain: resolution.domain,
        accountName: resolution.account.name,
        dealAmount: resolution.account.activeDeals[0]?.amount,
        outcomes: resolution.contactOutcomes.map((o) => ({
          contactId: o.contactId,
          name: o.name,
          role: o.role,
          actionTaken: o.actionTaken,
          actionSummary: o.actionSummary,
        })),
        briefing: resolution.briefing,
      });
    }

    return this.recordCommitteeResolution(resolution, batchResult as unknown as Record<string, unknown>, taskResult as unknown as Record<string, unknown>);
  }

  public resetToScenario(scenarioId?: string): DemoStoreState {
    return this.reset(scenarioId);
  }

  public getConfig() {
    return this.config;
  }

  public getState(): DemoStoreState {
    const clone: DemoStoreState = JSON.parse(JSON.stringify(this.state));
    clone.sourceWeights = { ...this.config.sourceWeights };
    return clone;
  }

  public async dispatchScenario(scenarioId: string): Promise<DemoStoreState> {
    const scenario = ALL_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    // Set prospect to scenario initial state
    this.state.prospect = JSON.parse(JSON.stringify(scenario.initialState));
    this.state.activeScenarioId = scenarioId;

    // Dispatch the scenario's incoming events
    return await this.evaluateEvents(scenario.incomingEvents, scenario.name);
  }

  public async dispatchCustomEvent(eventPartial: {
    productId: string;
    source: string;
    sourceType?: '1st_party_direct' | '1st_party_passive' | '2nd_party' | '3rd_party';
    rawScore: number;
    metadata?: Record<string, unknown>;
  }): Promise<DemoStoreState> {
    const newEvent: IntentEvent = {
      eventId: `evt_custom_${Date.now()}`,
      accountId: this.state.prospect.account.accountId,
      contactId: this.state.prospect.contact.contactId,
      productId: eventPartial.productId,
      source: eventPartial.source,
      sourceType: eventPartial.sourceType ?? '2nd_party',
      rawScore: Math.min(100, Math.max(0, eventPartial.rawScore)),
      timestamp: new Date().toISOString(),
      metadata: eventPartial.metadata,
    };

    return await this.evaluateEvents([newEvent], `Custom Event: ${eventPartial.source}`);
  }

  public async advanceCooldownTimer(hours = 48): Promise<DemoStoreState> {
    // Advance simulated clock
    this.simulatedTime = new Date(this.simulatedTime.getTime() + hours * 60 * 60 * 1000);

    const timerEvent: IntentEvent = {
      eventId: `evt_timer_${Date.now()}`,
      accountId: this.state.prospect.account.accountId,
      contactId: this.state.prospect.contact.contactId,
      productId: 'product_a',
      source: 'cooldown_timer',
      sourceType: '1st_party_direct',
      rawScore: 0, // timer check doesn't add raw score
      timestamp: this.simulatedTime.toISOString(),
      metadata: { action: 'timer_advance', hoursAdvanced: hours },
    };

    return await this.evaluateEvents([timerEvent], `Timer Advanced (+${hours}h)`);
  }

  private async evaluateEvents(
    incomingEvents: IntentEvent[],
    actionLabel: string
  ): Promise<DemoStoreState> {
    const now = this.simulatedTime;
    const currentState = this.state.prospect;

    // 1. Scoring Calculation
    const allEvents = [...currentState.events, ...incomingEvents];
    const scores: Record<string, number> = {};
    for (const p of PRODUCT_PERSONA_MAP) {
      scores[p.productId] = calculateCompositeScore(allEvents, p.productId, now, this.config);
    }

    const currentProduct = currentState.contact.currentCampaign ?? 'product_b';
    const competingProducts = [...new Set(incomingEvents.map((e) => e.productId))].filter(
      (p) => p !== currentProduct
    );
    const competingProduct = competingProducts[0] ?? (currentProduct === 'product_b' ? 'product_a' : 'product_b');
    const currentScore = scores[currentProduct] ?? 0;
    const competingScore = scores[competingProduct] ?? 0;
    const delta = calculateDelta(competingScore, currentScore);

    // 2. FSM Evaluation
    const fsmResult = evaluateFSM(
      currentState,
      incomingEvents,
      PRODUCT_PERSONA_MAP,
      this.config,
      now
    );

    // 3. Jev Decision Agent
    const jevResult = await evaluateWithJev(
      currentState,
      incomingEvents,
      PRODUCT_PERSONA_MAP,
      this.config,
      now
    );

    // 4. Build Decision Outcome
    const outcome: DecisionOutcome = {
      decisionId: `dec_${Date.now()}`,
      timestamp: now.toISOString(),
      previousState: fsmResult.previousState,
      newState: fsmResult.newState,
      decision: fsmResult.decision,
      confidence: fsmResult.confidence,
      reasoning: fsmResult.reasoning,
      scores,
      delta,
      guards: fsmResult.guards,
      engineUsed: jevResult.engineUsed,
      latencyMs: jevResult.latencyMs,
      personaMismatch: fsmResult.personaMismatch,
      crossBUNotification: fsmResult.crossBURequired,
      holdNextTouch: fsmResult.holdNextTouch,
    };

    // 5. Sandbox payload only. Demo scenarios must never mutate live CRM records.
    const syncPayload = buildHubSpotSyncPayload(currentState, outcome);
    const liveSyncResult: SyncResult = {
      success: false,
      dryRun: true,
      statusCode: 0,
      message: 'Sandbox scenario: no live HubSpot request was made.',
      operationStatus: {
        contactPatch: 'failed',
        intentEvent: 'failed',
        escalationTask: syncPayload.task ? 'failed' : 'not_required',
      },
      payload: syncPayload,
    };

    // 5b. Gemini System Two Reasoning Briefing (for escalations or contextual advisory)
    let briefing: ExecutiveBriefing | null = this.state?.lastBriefing ?? null;
    if (fsmResult.decision === 'escalate' || fsmResult.newState === 'ESCALATED' || !briefing) {
      briefing = await generateExecutiveBriefing(
        currentState,
        scores,
        delta,
        process.env?.GEMINI_API_KEY
      );
    }

    // 6. Mutate Prospect State
    currentState.previousState = fsmResult.previousState;
    currentState.fsmState = fsmResult.newState;
    currentState.scores = scores;
    currentState.events = allEvents;
    currentState.decisionHistory.push(outcome);

    if (fsmResult.newState === 'EVALUATION_COOLDOWN' && !currentState.cooldownStartedAt) {
      currentState.cooldownStartedAt = now.toISOString();
    } else if (fsmResult.newState !== 'EVALUATION_COOLDOWN') {
      currentState.cooldownStartedAt = null;
    }

    if (fsmResult.newState === 'SWITCHING') {
      currentState.contact.currentCampaign = competingProduct;
      currentState.contact.enrollmentDate = now.toISOString();
    }

    // 7. Audit Entry
    const primaryEvent = incomingEvents[0];
    const auditEntry: AuditEntry = {
      id: `audit_${Date.now()}`,
      timestamp: now.toISOString(),
      eventType: actionLabel,
      source: primaryEvent?.source ?? 'engine',
      productId: primaryEvent?.productId ?? competingProduct,
      rawScore: primaryEvent?.rawScore ?? 0,
      previousState: fsmResult.previousState,
      newState: fsmResult.newState,
      decision: fsmResult.decision,
      confidence: fsmResult.confidence,
      reasoning: fsmResult.reasoning,
      scores: { ...scores },
      delta,
      engineUsed: jevResult.engineUsed,
      latencyMs: jevResult.latencyMs,
      guardsSummary: fsmResult.guards.map((g) => ({
        name: g.guardName,
        passed: g.passed,
      })),
    };

    this.state.prospect = currentState;
    this.state.scores = scores;
    this.state.delta = delta;
    this.state.lastDecisionOutcome = outcome;
    this.state.lastSyncPayload = syncPayload;
    this.state.lastLiveSyncResult = liveSyncResult;
    this.state.lastBriefing = briefing;
    this.state.lastJevDetails = {
      probabilities: jevResult.response.choices.action.probabilities,
      intentConfidence: jevResult.response.scores.intent_confidence.score,
      flappingRisk: jevResult.response.nouls.flapping_risk.noul,
      personaMismatchRisk: jevResult.response.nouls.persona_mismatch.noul,
      latencyMs: jevResult.latencyMs,
      engineUsed: jevResult.engineUsed,
    };
    this.state.auditLedger.unshift(auditEntry);

    return this.getState();
  }

  /**
   * Scans and evaluates expired 48h cooldowns automatically
   * If (now - cooldownStartedAt) >= 48h:
   *   - If competing intent sustained: executes SWITCHING
   *   - If intent decayed: reverts to ACTIVE_CURRENT (anti-flapping)
   */
  public async evaluateExpiredCooldowns(): Promise<{
    evaluated: boolean;
    previousState: FSMState;
    newState: FSMState;
    action: string;
    hoursElapsed: number;
    state: DemoStoreState;
  }> {
    const prospect = this.state.prospect;
    if (prospect.fsmState !== 'EVALUATION_COOLDOWN' || !prospect.cooldownStartedAt) {
      return {
        evaluated: false,
        previousState: prospect.fsmState,
        newState: prospect.fsmState,
        action: 'NO_OP',
        hoursElapsed: 0,
        state: this.getState(),
      };
    }

    const now = this.simulatedTime;
    const cooldownStart = new Date(prospect.cooldownStartedAt);
    const hoursElapsed = (now.getTime() - cooldownStart.getTime()) / (1000 * 60 * 60);

    if (hoursElapsed < this.config.cooldownHours) {
      return {
        evaluated: false,
        previousState: prospect.fsmState,
        newState: prospect.fsmState,
        action: 'IN_COOLDOWN',
        hoursElapsed: Math.round(hoursElapsed * 10) / 10,
        state: this.getState(),
      };
    }

    // Cooldown has expired! Trigger autonomous transition evaluation
    const expirationEvent: IntentEvent = {
      eventId: `evt_cron_${Date.now()}`,
      accountId: prospect.account.accountId,
      contactId: prospect.contact.contactId,
      productId: 'product_a',
      source: 'autonomous_cron_worker',
      sourceType: '1st_party_direct',
      rawScore: 0,
      timestamp: now.toISOString(),
      metadata: { action: 'cron_cooldown_expiry', hoursElapsed },
    };

    const updatedState = await this.evaluateEvents(
      [expirationEvent],
      `Autonomous Cooldown Expiry (+${Math.round(hoursElapsed)}h)`
    );

    return {
      evaluated: true,
      previousState: 'EVALUATION_COOLDOWN',
      newState: updatedState.prospect.fsmState,
      action: updatedState.prospect.fsmState === 'SWITCHING' ? 'AUTONOMOUS_SWITCH' : 'REVERT_ACTIVE',
      hoursElapsed: Math.round(hoursElapsed * 10) / 10,
      state: updatedState,
    };
  }

  /**
   * Downstream Learning Feedback Loop
   * Dynamically adjusts source weights based on conversion outcomes
   */
  public applyFeedback(feedback: FeedbackEvent): FeedbackRecalibrationResult {
    const currentWeight = this.config.sourceWeights[feedback.sourceType] ?? 0.5;
    let delta = 0;

    switch (feedback.eventType) {
      case 'meeting_booked':
      case 'deal_won':
        delta = 0.08;
        break;
      case 'email_reply':
        delta = 0.05;
        break;
      case 'email_open':
        delta = 0.01;
        break;
      case 'deal_lost':
        delta = -0.05;
        break;
      case 'unsubscribed':
        delta = -0.08;
        break;
      default:
        delta = 0;
    }

    const newWeight = Math.round(Math.min(1.0, Math.max(0.1, currentWeight + delta)) * 100) / 100;
    this.config.sourceWeights[feedback.sourceType] = newWeight;

    const auditEntry: AuditEntry = {
      id: `audit_feedback_${Date.now()}`,
      timestamp: this.simulatedTime.toISOString(),
      eventType: 'Downstream Feedback Recalibration',
      source: feedback.sourceType,
      productId: feedback.productId,
      rawScore: 0,
      previousState: this.state.prospect.fsmState,
      newState: this.state.prospect.fsmState,
      decision: this.state.lastDecisionOutcome?.decision ?? 'continue',
      confidence: 1.0,
      reasoning: `[Feedback Recalibration] Downstream outcome "${feedback.eventType}" adjusted weight for ${feedback.sourceType} from ${currentWeight} to ${newWeight} (delta: ${delta > 0 ? '+' : ''}${delta}).`,
      scores: { ...this.state.scores },
      delta: this.state.delta,
      engineUsed: this.state.lastJevDetails?.engineUsed ?? 'jev_calibrated_fallback',
      latencyMs: 0.05,
      guardsSummary: [],
    };
    this.state.auditLedger.unshift(auditEntry);

    return {
      success: true,
      eventType: feedback.eventType,
      sourceType: feedback.sourceType,
      previousWeight: currentWeight,
      newWeight,
      delta,
      recalibratedAt: new Date().toISOString(),
    };
  }
}

// Global singleton instance for the app lifecycle
export const demoStore = new DemoStore();

function createDefaultCommitteeResolution(): BuyingCommitteeResolution {
  return {
    domain: 'techcorp.com',
    account: {
      accountId: 'acc_techcorp_001',
      domain: 'techcorp.com',
      name: 'TechCorp International',
      industry: 'Enterprise SaaS & Cloud Infrastructure',
      tier: 1,
      ownerBU: 'BU_Analytics',
      activeDeals: [
        {
          dealId: 'deal_tc_120k',
          dealStage: 'Demo Scheduled',
          amount: 120000,
          owner: 'Strategic AE John Smith',
          productId: 'product_b',
        },
      ],
    },
    incomingSurge: {
      eventId: 'evt_tc_init_surge',
      accountId: 'acc_techcorp_001',
      contactId: 'con_sarah_001',
      productId: 'product_a',
      source: 'bombora',
      sourceType: '3rd_party',
      rawScore: 88,
      timestamp: new Date().toISOString(),
    },
    totalContactsEvaluated: 4,
    contactOutcomes: [
      {
        contactId: 'con_sarah_001',
        email: 'sarah.chen@techcorp.com',
        name: 'Sarah Chen',
        role: 'VP of Engineering',
        persona: 'engineering',
        touchCount7d: 1,
        currentCampaign: 'product_b',
        targetProduct: 'product_a',
        fsmState: 'EVALUATION_COOLDOWN',
        decision: 'pause_cooldown',
        confidence: 0.95,
        actionTaken: 'HOLD_COOLDOWN',
        actionSummary: 'Scheduled touches held. Enters 48h evaluation cooldown to confirm signal persistence before switching.',
        reasoning: 'High intent surge detected on competing product (CloudSecure: 88 pts). Current campaign has 1 touch in 7d. Safe to enter 48h cooldown.',
        guards: [
          { guardName: 'FATIGUE_CAP', passed: true, reason: '1/2 touches in 7d (within limit)' },
          { guardName: 'PERSONA_ALIGNMENT', passed: true, reason: 'Persona engineering aligns with CloudSecure' },
          { guardName: 'COOLDOWN_GATE', passed: true, reason: 'Initiated 48h observation window' },
        ],
        jevLatencyMs: 0.12,
        jevEngine: 'jev_calibrated_fallback',
        cooldownStartedAt: new Date().toISOString(),
      },
      {
        contactId: 'con_alex_002',
        email: 'alex.rivera@techcorp.com',
        name: 'Alex Rivera',
        role: 'DevOps & Reliability Lead',
        persona: 'devops',
        touchCount7d: 2,
        currentCampaign: 'product_b',
        targetProduct: 'product_a',
        fsmState: 'PAUSED',
        decision: 'pause_cooldown',
        confidence: 0.95,
        actionTaken: 'PAUSE_FATIGUE',
        actionSummary: 'Sequence paused — weekly fatigue cap reached (2/2 touches in 7d). No emails sent.',
        reasoning: 'Prospect has received 2 touches in the last 7 days. Hard fatigue cap triggered to protect domain sender reputation.',
        guards: [
          { guardName: 'FATIGUE_CAP', passed: false, reason: '2/2 touches in 7d — sequence paused' },
        ],
        jevLatencyMs: 0.09,
        jevEngine: 'jev_calibrated_fallback',
        cooldownStartedAt: null,
      },
      {
        contactId: 'con_marcus_003',
        email: 'marcus.vance@techcorp.com',
        name: 'Marcus Vance',
        role: 'Chief Information Security Officer (CISO)',
        persona: 'security',
        touchCount7d: 0,
        currentCampaign: null,
        targetProduct: 'product_a',
        fsmState: 'SWITCHING',
        decision: 'switch',
        confidence: 0.95,
        actionTaken: 'SWITCH_ENROLL',
        actionSummary: 'Target buyer persona matched (security). Direct enrollment into product_a (CloudSecure).',
        reasoning: 'Unenrolled prospect with direct persona match for CloudSecure. Zero touches in last 7 days.',
        guards: [
          { guardName: 'FATIGUE_CAP', passed: true, reason: '0/2 touches in 7d' },
          { guardName: 'PERSONA_ALIGNMENT', passed: true, reason: 'Persona security exact match for CloudSecure' },
        ],
        jevLatencyMs: 0.11,
        jevEngine: 'jev_calibrated_fallback',
        cooldownStartedAt: null,
      },
      {
        contactId: 'con_rachel_004',
        email: 'rachel.green@techcorp.com',
        name: 'Rachel Green',
        role: 'Director of Financial Planning',
        persona: 'finance',
        touchCount7d: 0,
        currentCampaign: 'product_c',
        targetProduct: 'product_a',
        fsmState: 'ACTIVE_CURRENT',
        decision: 'continue',
        confidence: 0.95,
        actionTaken: 'CONTINUE_JOURNEY',
        actionSummary: 'Persona mismatch (finance) for product_a (CloudSecure). Safely kept in current journey (product_c).',
        reasoning: 'Finance persona does not match technical CloudSecure sequence. Kept in active FinanceOS journey.',
        guards: [
          { guardName: 'PERSONA_ALIGNMENT', passed: false, reason: 'Finance persona protected from technical security pitch' },
        ],
        jevLatencyMs: 0.08,
        jevEngine: 'jev_calibrated_fallback',
        cooldownStartedAt: null,
      },
    ],
    accountEscalated: true,
    escalationReason: 'Account has active pipeline deal ($120K) & multi-product intent conflict.',
    webCorroboration: {
      domain: 'techcorp.com',
      query: 'techcorp.com cloud security hiring engineer',
      isCorroborated: true,
      status: 'CORROBORATED',
      corroborationScore: 95,
      confidenceBoost: 0.15,
      matchedKeywords: ['security', 'cloud security', 'engineer', 'hiring', 'aws', 'devsecops', 'cybersecurity'],
      evidence: [
        {
          position: 1,
          title: 'Cloud Security Engineer Jobs (NOW HIRING) - ZipRecruiter',
          url: 'https://www.ziprecruiter.com/Jobs/Cloud-Security-Engineer',
          snippet: 'Browse 1000+ CLOUD SECURITY ENGINEER jobs ($143k-$153k) hiring now. New openings posted daily.',
          siteName: 'www.ziprecruiter.com',
          relevanceScore: 100,
        },
        {
          position: 2,
          title: 'Cloud Security Engineer Jobs, Employment - Indeed',
          url: 'https://www.indeed.com/q-cloud-security-engineer-jobs.html',
          snippet: 'Today top Cloud Security Engineer jobs. New openings added daily. Apply now and find your next opportunity.',
          siteName: 'www.indeed.com',
          relevanceScore: 75,
        },
        {
          position: 3,
          title: 'Base-2 Solutions hiring Cloud Security Engineer 3 in Bethesda, MD',
          url: 'https://www.linkedin.com/jobs/view/cloud-security-engineer-3-at-base-2-solutions-4468717284',
          snippet: 'At least one DoD 8570.01-M IAT Level II or higher certification. 2+ years working in the cloud, securely configuring and deploying AWS services.',
          siteName: 'www.linkedin.com',
          date: '2 days ago',
          relevanceScore: 100,
        },
      ],
      source: 'tinyfish_live_api',
      latencyMs: 1458,
      evaluatedAt: new Date().toISOString(),
    },
    briefing: {
      commercialRisk: 'Active $120K DataFlow pipeline deal in Demo Scheduled stage. Automated campaign switching risks confusing buyer stakeholders and derailing Q4 close.',
      crossSolutionStrategy: 'Position CloudSecure as an infrastructure companion to DataFlow. Present unified observability pitch during the upcoming Thursday executive demo.',
      actionChecklist: [
        'Brief AE John Smith on Sarah Chen and Marcus Vance intent surges.',
        'Review current DataFlow pilot scope before introducing security pricing.',
        'Deliver joint enterprise ROI model highlighting data integrity + cloud governance.',
      ],
      latencyMs: 820,
      engine: 'OneMetric Cognitive Agent (System Two)',
      isLive: true,
      modelUsed: 'OneMetric Cognitive Agent (System Two)',
      generatedAt: new Date().toISOString(),
    },
    evaluatedAt: new Date().toISOString(),
  };
}
