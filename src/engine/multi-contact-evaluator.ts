// ============================================================================
// OneMetric Campaign Segmentation Engine — Multi-Contact Committee Evaluator
// ============================================================================
// Evaluates an incoming Account/Domain intent surge across all contacts in
// the enterprise Buying Committee simultaneously:
//   1. Pulls contacts via HubSpot reader (Live REST search + fallback)
//   2. Evaluates deterministic FSM guards per stakeholder
//   3. Resolves individual actions:
//        - Sarah Chen (VP Eng): HOLD_COOLDOWN (48h evaluation hold)
//        - Alex Rivera (DevOps): PAUSE_FATIGUE (fatigue cap reached)
//        - Marcus Vance (CISO): SWITCH_ENROLL (direct buyer match)
//        - Rachel Green (Finance): CONTINUE_JOURNEY (persona safeguard)
//   4. Triggers Gemini System Two ONCE for the account to formulate a unified
//      cross-solution discovery strategy (no duplicate rep spam)
// ============================================================================

import type {
  Contact,
  Account,
  Deal,
  IntentEvent,
  ProspectState,
  FSMState,
  Decision,
  GuardResult,
  ExecutiveBriefing,
  ScoringConfig,
} from '../types/index.js';

import { searchContactsByDomain, getAccountDeals } from './hubspot-reader.js';
import { evaluateFSM } from './fsm.js';
import { calculateCompositeScore, getDefaultConfig } from './scoring.js';
import { generateExecutiveBriefing } from './gemini-agent.js';
import { corroborateDomainIntent, type WebCorroborationResult } from './tinyfish-search.js';
import { PRODUCT_PERSONA_MAP } from './product-catalog.js';

// ---------------------------------------------------------------------------
// Response Types
// ---------------------------------------------------------------------------

export interface ContactOutcome {
  contactId: string;
  email: string;
  name: string;
  role: string;
  persona: string;
  touchCount7d: number;
  currentCampaign: string | null;
  targetProduct: string;
  fsmState: FSMState;
  decision: Decision;
  confidence: number;
  actionTaken: 'HOLD_COOLDOWN' | 'PAUSE_FATIGUE' | 'SWITCH_ENROLL' | 'CONTINUE_JOURNEY' | 'ESCALATE_REVIEW' | 'EXIT_SUPPRESSED';
  actionSummary: string;
  reasoning: string;
  guards: GuardResult[];
  jevLatencyMs: number;
  jevEngine: 'jev_live' | 'jev_calibrated_fallback' | 'deterministic_fsm';
  cooldownStartedAt: string | null;
}

export interface BuyingCommitteeResolution {
  domain: string;
  account: Account;
  incomingSurge: IntentEvent;
  totalContactsEvaluated: number;
  contactOutcomes: ContactOutcome[];
  accountEscalated: boolean;
  escalationReason: string | null;
  briefing: ExecutiveBriefing | null;
  webCorroboration?: WebCorroborationResult | null;
  evaluatedAt: string;
}

/** Non-touch handoffs are resolved before fatigue; fatigue gates campaign actions only. */
export function resolvePriorityAction(
  decision: Decision,
  fatigueBlocked: boolean,
  touchCount7d: number,
  fatigueMaxTouches: number
): ContactOutcome['actionTaken'] | null {
  if (decision === 'exit') return 'EXIT_SUPPRESSED';
  if (decision === 'escalate') return 'ESCALATE_REVIEW';
  if (fatigueBlocked || touchCount7d >= fatigueMaxTouches) return 'PAUSE_FATIGUE';
  return null;
}

// ---------------------------------------------------------------------------
// Main Evaluator Entry Point
// ---------------------------------------------------------------------------

export async function evaluateAccountBuyingCommittee(
  domain: string,
  incomingSurge: IntentEvent,
  options?: {
    hubspotToken?: string;
    geminiKey?: string;
    tinyfishKey?: string;
    historyEvents?: IntentEvent[];
    priorContacts?: Record<string, Pick<ContactOutcome, 'fsmState' | 'cooldownStartedAt' | 'currentCampaign'>>;
    scoringConfig?: ScoringConfig;
  }
): Promise<BuyingCommitteeResolution> {
  const normalizedDomain = domain.toLowerCase().trim();
  console.log(`[CommitteeEvaluator] Starting evaluation for domain: ${normalizedDomain}`);

  // 1. Discover all stakeholders for domain AND run live web corroboration in parallel
  const [contacts, accountData, webCorroboration] = await Promise.all([
    searchContactsByDomain(normalizedDomain, options?.hubspotToken, options?.tinyfishKey),
    getAccountDeals(normalizedDomain, options?.hubspotToken),
    corroborateDomainIntent(normalizedDomain, incomingSurge.productId, options?.tinyfishKey),
  ]);

  const { account, activeDeals } = accountData;
  console.log(
    `[CommitteeEvaluator] Found ${contacts.length} committee members at ${account.name}. Corroboration Status: ${webCorroboration.status} (score: ${webCorroboration.corroborationScore}/100)`
  );

  // 2. Evaluate each contact in parallel with per-stakeholder guards
  const contactOutcomes: ContactOutcome[] = [];
  let accountEscalated = false;
  let escalationReason: string | null = null;

  // Track primary prospect for Gemini briefing context
  let primaryProspectState: ProspectState | null = null;
  const compositeScores: Record<string, number> = Object.fromEntries(
    PRODUCT_PERSONA_MAP.map((product) => [product.productId, 0])
  );

  for (const contact of contacts) {
    // Build isolated ProspectState for this stakeholder
    const prior = options?.priorContacts?.[contact.contactId];
    const contactEvents = [
      ...(options?.historyEvents ?? []).filter((event) =>
        event.eventId !== incomingSurge.eventId && (!event.contactId || event.contactId === contact.contactId)
      ),
    ].filter((event, index, events) => events.findIndex((candidate) => candidate.eventId === event.eventId) === index);

    const scoringEvents = [...contactEvents, incomingSurge];
    const config = options?.scoringConfig ?? getDefaultConfig();
    const contactScores = Object.fromEntries(PRODUCT_PERSONA_MAP.map((product) => [
      product.productId,
      calculateCompositeScore(scoringEvents, product.productId, new Date(), config),
    ]));
    for (const [productId, score] of Object.entries(contactScores)) {
      compositeScores[productId] = Math.max(compositeScores[productId] ?? 0, score);
    }

    if (prior?.currentCampaign) contact.currentCampaign = prior.currentCampaign;

    const prospectState: ProspectState = {
      account,
      contact,
      scores: contactScores,
      fsmState: prior?.fsmState ?? (contact.touchCount7d >= 2 ? 'PAUSED' : 'ACTIVE_CURRENT'),
      previousState: null,
      stateEnteredAt: new Date().toISOString(),
      cooldownStartedAt: prior?.cooldownStartedAt ?? null,
      events: contactEvents,
      decisionHistory: [],
      crossBUTransition: null,
      nextScheduledTouch: null,
    };

    if (!primaryProspectState) {
      primaryProspectState = prospectState;
    }

    // A. Evaluate deterministic FSM
    const fsmResult = evaluateFSM(
      prospectState,
      [incomingSurge],
      PRODUCT_PERSONA_MAP,
      config
    );

    // B. Resolve this contact using deterministic policy. TypeSafe tool planning
    // happens once at the account agent layer, not once per contact.
    let actionTaken: ContactOutcome['actionTaken'] = 'CONTINUE_JOURNEY';
    let actionSummary = '';

    if (fsmResult.decision === 'escalate') {
      accountEscalated = true;
      escalationReason = fsmResult.reasoning;
    }

    const targetProductMap = PRODUCT_PERSONA_MAP.find((p) => p.productId === incomingSurge.productId);
    const isPersonaRelevant = Boolean(targetProductMap &&
      targetProductMap.relevantPersonas.includes(contact.persona.toLowerCase()));

    const fatigueBlocked = fsmResult.guards.some((guard) => guard.guardName === 'FATIGUE_CHECK' && !guard.passed);
    // Handoffs do not send a campaign touch, so a contact-level fatigue gate
    // must not hide an FSM-mandated sales review. Keep fatigue ahead of every
    // automated campaign action below.
    const priorityAction = resolvePriorityAction(
      fsmResult.decision,
      fatigueBlocked,
      contact.touchCount7d,
      config.fatigueMaxTouches
    );
    if (priorityAction === 'EXIT_SUPPRESSED') {
      actionTaken = 'EXIT_SUPPRESSED';
      actionSummary = `Campaign automation suppressed. ${fsmResult.reasoning}`;
    } else if (priorityAction === 'ESCALATE_REVIEW') {
      actionTaken = 'ESCALATE_REVIEW';
      actionSummary = `Routed to assigned Account Executive. ${fsmResult.reasoning}`;
    } else if (priorityAction === 'PAUSE_FATIGUE') {
      actionTaken = 'PAUSE_FATIGUE';
      actionSummary = `Sequence paused — weekly fatigue cap reached (${contact.touchCount7d}/${config.fatigueMaxTouches} touches in ${config.fatigueWindowDays}d). No emails sent.`;
    } else if (!isPersonaRelevant) {
      actionTaken = 'CONTINUE_JOURNEY';
      actionSummary = `Persona mismatch (${contact.persona}) for ${incomingSurge.productId} (${targetProductMap?.productName || 'Security'}). Safely kept in current journey (${contact.currentCampaign || 'none'}).`;
    } else if (fsmResult.decision === 'switch') {
      actionTaken = 'SWITCH_ENROLL';
      actionSummary = `Intent persisted and safety gates passed. Move from ${contact.currentCampaign} to ${incomingSurge.productId}.`;
    } else if (fsmResult.decision === 'pause_cooldown') {
      actionTaken = 'HOLD_COOLDOWN';
      actionSummary = `Enter evaluation cooldown. ${fsmResult.reasoning}`;
    } else if (!contact.currentCampaign && isPersonaRelevant) {
      actionTaken = 'SWITCH_ENROLL';
      actionSummary = `Target buyer persona matched (${contact.persona}). Direct enrollment into ${incomingSurge.productId}.`;
    } else {
      actionTaken = 'CONTINUE_JOURNEY';
      actionSummary = `Maintaining current campaign cadence (${contact.currentCampaign}).`;
    }

    // Calibrate confidence with TinyFish web corroboration signal
    const calibratedConfidence = Math.round(
      Math.min(1.0, Math.max(0.1, fsmResult.confidence + (webCorroboration.confidenceBoost || 0))) * 100
    ) / 100;

    contactOutcomes.push({
      contactId: contact.contactId,
      email: contact.email,
      name: `${contact.firstName} ${contact.lastName}`,
      role: contact.jobTitle,
      persona: contact.persona,
      touchCount7d: contact.touchCount7d,
      currentCampaign: contact.currentCampaign,
      targetProduct: incomingSurge.productId,
      fsmState: fsmResult.newState,
      decision: fsmResult.decision,
      confidence: calibratedConfidence,
      actionTaken,
      actionSummary,
      reasoning: fsmResult.reasoning,
      guards: fsmResult.guards,
      jevLatencyMs: 0,
      jevEngine: 'deterministic_fsm',
      cooldownStartedAt: fsmResult.newState === 'EVALUATION_COOLDOWN'
        ? (prospectState.cooldownStartedAt ?? new Date().toISOString())
        : null,
    });
  }

  // 3. Generate Gemini System Two Briefing ONCE for the whole buying committee
  let briefing: ExecutiveBriefing | null = null;
  if (accountEscalated && primaryProspectState) {
    primaryProspectState.events = [...primaryProspectState.events, incomingSurge];
    console.log(`[CommitteeEvaluator] Generating Gemini System Two briefing for account: ${account.name}...`);
    briefing = await generateExecutiveBriefing(
      primaryProspectState,
      compositeScores,
      incomingSurge.rawScore - 75,
      options?.geminiKey
    );
  }

  return {
    domain: normalizedDomain,
    account,
    incomingSurge,
    totalContactsEvaluated: contactOutcomes.length,
    contactOutcomes,
    accountEscalated,
    escalationReason,
    briefing,
    webCorroboration,
    evaluatedAt: new Date().toISOString(),
  };
}
