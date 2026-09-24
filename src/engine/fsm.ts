// ============================================================================
// OneMetric Campaign Segmentation Engine — Finite State Machine
// ============================================================================
// Deterministic FSM with 6 states, guard conditions, and all 4 production
// fixes integrated: Dual-Gate, Persona Relevance, Cross-BU Protocol,
// Smart Cooldown Cadence.
// ============================================================================

import type {
  FSMState,
  Decision,
  ProspectState,
  IntentEvent,
  ScoringConfig,
  GuardResult,
  DecisionOutcome,
  ProductPersonaMap,
  CrossBUTransition,
} from '../types/index.js';

import {
  calculateCompositeScore,
  isDualGateSatisfied,
  detectConflict,
  getDefaultConfig,
  type DualGateResult,
} from './scoring.js';

// ---------------------------------------------------------------------------
// Guard Evaluations
// ---------------------------------------------------------------------------

/** Guard 1: Fatigue Cap — max N touches in rolling window */
export function checkFatigue(
  contact: ProspectState['contact'],
  config: ScoringConfig,
  now = new Date()
): GuardResult {
  const lastTouch = contact.lastTouchDate ? Date.parse(contact.lastTouchDate) : Number.NaN;
  const hoursSinceTouch = Number.isFinite(lastTouch)
    ? (now.getTime() - lastTouch) / (1000 * 60 * 60)
    : Number.POSITIVE_INFINITY;
  const spacingBlocked = Boolean(contact.lastTouchDate) &&
    (!Number.isFinite(lastTouch) || lastTouch > now.getTime() || hoursSinceTouch < config.minimumTouchSpacingHours);
  const exceeded = contact.touchCount7d >= config.fatigueMaxTouches || spacingBlocked;
  return {
    guardName: 'FATIGUE_CHECK',
    passed: !exceeded,
    reason: exceeded
      ? spacingBlocked
        ? `Minimum touch spacing not met: ${Math.max(0, Math.floor(hoursSinceTouch))}h since last touch; ${config.minimumTouchSpacingHours}h required`
        : `Fatigue cap reached: ${contact.touchCount7d}/${config.fatigueMaxTouches} touches in ${config.fatigueWindowDays}d window`
      : `Fatigue OK: ${contact.touchCount7d}/${config.fatigueMaxTouches} touches in ${config.fatigueWindowDays}d window`,
  };
}

/** Guard 2: Persona Relevance — does the contact match the competing product? (Fix 2) */
export function checkPersonaRelevance(
  contact: ProspectState['contact'],
  competingProductId: string,
  productMap: ProductPersonaMap[]
): GuardResult {
  const product = productMap.find(p => p.productId === competingProductId);
  if (!product) {
    return {
      guardName: 'PERSONA_RELEVANCE',
      passed: false,
      reason: `No persona map found for product ${competingProductId} — automated campaign changes are blocked`,
    };
  }

  const matches = product.relevantPersonas.includes(contact.persona.toLowerCase());
  return {
    guardName: 'PERSONA_RELEVANCE',
    passed: matches,
    reason: matches
      ? `Persona "${contact.persona}" matches product ${product.productName} (relevant: ${product.relevantPersonas.join(', ')})`
      : `PERSONA MISMATCH: Contact persona "${contact.persona}" does not match product ${product.productName} (relevant: ${product.relevantPersonas.join(', ')}). Domain-level intent does not apply to this contact.`,
  };
}

/** Guard 3: Cross-BU Ownership — is there a BU conflict? (Fix 3) */
export function checkCrossBU(
  currentProductId: string,
  competingProductId: string,
  productMap: ProductPersonaMap[]
): GuardResult {
  const currentProduct = productMap.find(p => p.productId === currentProductId);
  const competingProduct = productMap.find(p => p.productId === competingProductId);

  if (!currentProduct || !competingProduct) {
    return {
      guardName: 'CROSS_BU_OWNERSHIP',
      passed: false,
      reason: 'Product BU mapping not available — automated campaign changes are blocked',
    };
  }

  const sameBU = currentProduct.ownerBU === competingProduct.ownerBU;
  return {
    guardName: 'CROSS_BU_OWNERSHIP',
    passed: sameBU,
    reason: sameBU
      ? `Same BU: both products owned by ${currentProduct.ownerBU}`
      : `CROSS-BU TRANSITION: Moving from ${currentProduct.ownerBU} (${currentProduct.productName}) to ${competingProduct.ownerBU} (${competingProduct.productName}). 24h objection window required.`,
  };
}

/** Guard 4: Active Deal — is there an open deal? */
export function checkActiveDeal(account: ProspectState['account']): GuardResult {
  const hasActiveDeal = account.activeDeals.length > 0;
  return {
    guardName: 'ACTIVE_DEAL_CHECK',
    passed: !hasActiveDeal,
    reason: hasActiveDeal
      ? `Active deal(s) detected: ${account.activeDeals.map(d => `${d.dealId} (${d.dealStage}, $${d.amount})`).join('; ')}. Requires sales review.`
      : 'No active deals — automation can proceed',
  };
}

/** Guard 5: Smart Cooldown Cadence — hold next touch vs hard pause (Fix 4) */
export function checkSmartCooldown(
  state: ProspectState,
  config: ScoringConfig,
  now = new Date()
): GuardResult {
  if (!state.nextScheduledTouch) {
    return {
      guardName: 'SMART_COOLDOWN',
      passed: true,
      reason: 'No scheduled touch — no cadence disruption',
    };
  }

  const nextTouch = new Date(state.nextScheduledTouch);
  const hoursUntilNextTouch = (nextTouch.getTime() - now.getTime()) / (1000 * 60 * 60);

  const touchWithinBuffer = hoursUntilNextTouch <= config.holdNextTouchHours && hoursUntilNextTouch > 0;

  return {
    guardName: 'SMART_COOLDOWN',
    passed: true, // Always passes — it's informational
    reason: touchWithinBuffer
      ? `HOLD NEXT TOUCH: Scheduled email in ${Math.round(hoursUntilNextTouch)}h (within ${config.holdNextTouchHours}h buffer). Hold this touch only — do NOT hard-pause the full sequence.`
      : `No imminent touch — ${hoursUntilNextTouch > 0 ? `next touch in ${Math.round(hoursUntilNextTouch)}h (outside buffer)` : 'no future touches scheduled'}`,
  };
}

/** Guard 6: Cooldown Active — is the prospect currently in evaluation cooldown? */
export function checkCooldownActive(state: ProspectState, config: ScoringConfig, now = new Date()): GuardResult {
  if (state.fsmState !== 'EVALUATION_COOLDOWN' || !state.cooldownStartedAt) {
    return {
      guardName: 'COOLDOWN_ACTIVE',
      passed: true,
      reason: 'Not in cooldown',
    };
  }

  const cooldownStart = new Date(state.cooldownStartedAt);
  const hoursInCooldown = (now.getTime() - cooldownStart.getTime()) / (1000 * 60 * 60);
  const expired = hoursInCooldown >= config.cooldownHours;

  return {
    guardName: 'COOLDOWN_ACTIVE',
    passed: expired,
    reason: expired
      ? `Cooldown expired: ${Math.round(hoursInCooldown)}h >= ${config.cooldownHours}h — ready to evaluate transition`
      : `In cooldown: ${Math.round(hoursInCooldown)}h / ${config.cooldownHours}h — accumulating signal, not transitioning yet`,
  };
}

/** Guard 7: Exit Guard — did the prospect unsubscribe or get disqualified? */
export function checkExitGuard(
  contact: ProspectState['contact'],
  incomingEvents: IntentEvent[]
): GuardResult {
  const isUnsubscribed = incomingEvents.some(
    e => e.metadata?.unsubscribed === true || e.metadata?.opt_out === true
  );
  const isDisqualified = incomingEvents.some(
    e => e.metadata?.disqualified === true || e.metadata?.icp_mismatch === true
  );

  if (isUnsubscribed || isDisqualified) {
    return {
      guardName: 'EXIT_GUARD',
      passed: true,
      reason: isUnsubscribed
        ? `Prospect ${contact.email} opted out / unsubscribed. Exiting campaign journey permanently.`
        : `Prospect ${contact.email} disqualified from ICP. Exiting campaign journey permanently.`,
    };
  }

  return {
    guardName: 'EXIT_GUARD',
    passed: false,
    reason: 'No exit or disqualification signals detected',
  };
}

// ---------------------------------------------------------------------------
// FSM Transition Evaluator
// ---------------------------------------------------------------------------

export interface FSMResult {
  previousState: FSMState;
  newState: FSMState;
  decision: Decision;
  confidence: number;
  reasoning: string;
  guards: GuardResult[];
  dualGate: DualGateResult | null;
  personaMismatch: boolean;
  crossBURequired: boolean;
  holdNextTouch: boolean;
}

export function evaluateFSM(
  state: ProspectState,
  incomingEvents: IntentEvent[],
  productMap: ProductPersonaMap[],
  config: ScoringConfig = getDefaultConfig(),
  nowOverride?: Date
): FSMResult {
  const now = nowOverride ?? new Date();
  const guards: GuardResult[] = [];

  // 0. Check Terminal State: If already EXITED, remain in EXITED
  if (state.fsmState === 'EXITED') {
    return {
      previousState: 'EXITED',
      newState: 'EXITED',
      decision: 'exit',
      confidence: 1.0,
      reasoning: 'Prospect is in terminal EXITED state. No further campaign communications permitted.',
      guards: [],
      dualGate: null,
      personaMismatch: false,
      crossBURequired: false,
      holdNextTouch: false,
    };
  }

  // 0b. Check Exit Signals (Unsubscribe / ICP Disqualification)
  const exitCheck = checkExitGuard(state.contact, incomingEvents);
  if (exitCheck.passed) {
    return {
      previousState: state.fsmState,
      newState: 'EXITED',
      decision: 'exit',
      confidence: 1.0,
      reasoning: exitCheck.reason,
      guards: [exitCheck],
      dualGate: null,
      personaMismatch: false,
      crossBURequired: false,
      holdNextTouch: false,
    };
  }

  // Merge incoming events into state events for scoring
  const allEvents = [...state.events, ...incomingEvents];

  // Determine current and competing products
  const currentProduct = state.contact.currentCampaign;
  if (!currentProduct) {
    return {
      previousState: state.fsmState,
      newState: state.fsmState,
      decision: 'continue',
      confidence: 1.0,
      reasoning: 'No current campaign enrollment — nothing to evaluate',
      guards: [],
      dualGate: null,
      personaMismatch: false,
      crossBURequired: false,
      holdNextTouch: false,
    };
  }

  // Find the competing product (the one with incoming events, or highest intent among non-current)
  const competingProducts = [...new Set(incomingEvents.map(e => e.productId))].filter(p => p !== currentProduct);
  const competingProduct = competingProducts.length > 0 ? competingProducts[0] : null;

  // Calculate scores for all products
  const scores: Record<string, number> = {};
  const allProductIds = [...new Set(allEvents.map(e => e.productId))];
  if (!allProductIds.includes(currentProduct)) allProductIds.push(currentProduct);

  for (const pid of allProductIds) {
    scores[pid] = calculateCompositeScore(allEvents, pid, now, config);
  }

  // If no competing product identified, just update scores and continue
  if (!competingProduct) {
    return {
      previousState: state.fsmState,
      newState: state.fsmState,
      decision: 'continue',
      confidence: 0.95,
      reasoning: `Incoming signals are for the current product (${currentProduct}). Scores updated, campaign continues.`,
      guards: [],
      dualGate: null,
      personaMismatch: false,
      crossBURequired: false,
      holdNextTouch: false,
    };
  }

  const currentScore = scores[currentProduct] ?? 0;
  const competingScore = scores[competingProduct] ?? 0;

  // --- Run Guards ---

  // Evaluate safety guards before deciding whether to continue a campaign.
  const fatigueGuard = checkFatigue(state.contact, config, now);
  guards.push(fatigueGuard);

  // High-risk account conditions outrank contact-level cadence blocks: an AE task
  // is a handoff, not a campaign touch, and must not be suppressed by fatigue.
  const conflict = detectConflict(scores, config);
  if (conflict.conflict) {
    // Check for active deal (makes escalation even more critical)
    const dealGuard = checkActiveDeal(state.account);
    guards.push(dealGuard);

    return {
      previousState: state.fsmState,
      newState: 'ESCALATED',
      decision: 'escalate',
      confidence: 0.95,
      reasoning: `${conflict.reason}. ${!dealGuard.passed ? dealGuard.reason : 'No active deal, but multi-product conflict requires human review.'}`,
      guards,
      dualGate: null,
      personaMismatch: false,
      crossBURequired: false,
      holdNextTouch: false,
    };
  }

  // A meaningful shift on tier 1 or tier 2 with open pipeline requires review.
  const dualGate = isDualGateSatisfied(competingScore, currentScore, config);
  if (state.account.tier <= 2) {
    const dealGuard = checkActiveDeal(state.account);
    guards.push(dealGuard);

    if (!dealGuard.passed && dualGate.satisfied) {
      return {
        previousState: state.fsmState,
        newState: 'ESCALATED',
        decision: 'escalate',
        confidence: 0.90,
        reasoning: `Enterprise Tier-${state.account.tier} account has an active deal and significant intent shift. ${dealGuard.reason}. ${dualGate.reason}. Requires AE review.`,
        guards,
        dualGate,
        personaMismatch: false,
        crossBURequired: false,
        holdNextTouch: false,
      };
    }
  }

  if (!fatigueGuard.passed) {
    return {
      previousState: state.fsmState,
      newState: 'PAUSED',
      decision: 'pause_cooldown',
      confidence: 1.0,
      reasoning: `Fatigue cap exceeded. ${fatigueGuard.reason}. Pausing all campaign activity.`,
      guards,
      dualGate,
      personaMismatch: false,
      crossBURequired: false,
      holdNextTouch: false,
    };
  }

  // Guard 4: Dual Gate (Fix 1)
  guards.push({
    guardName: 'DUAL_GATE',
    passed: dualGate.satisfied,
    reason: dualGate.reason,
  });

  // Guard 5: Persona Relevance (Fix 2)
  const personaGuard = checkPersonaRelevance(state.contact, competingProduct, productMap);
  guards.push(personaGuard);

  // Guard 6: Cross-BU (Fix 3)
  const crossBUGuard = checkCrossBU(currentProduct, competingProduct, productMap);
  guards.push(crossBUGuard);

  // Guard 7: Smart Cooldown (Fix 4)
  const cooldownCadence = checkSmartCooldown(state, config, now);
  guards.push(cooldownCadence);

  // --- State Transition Logic ---

  const delta = dualGate.delta;

  // Handle current EVALUATION_COOLDOWN state
  if (state.fsmState === 'EVALUATION_COOLDOWN') {
    const cooldownCheck = checkCooldownActive(state, config, now);
    guards.push(cooldownCheck);

    if (!cooldownCheck.passed) {
      // Still in cooldown — accumulate signal, don't transition
      return {
        previousState: state.fsmState,
        newState: 'EVALUATION_COOLDOWN',
        decision: 'pause_cooldown',
        confidence: 0.85,
        reasoning: `${cooldownCheck.reason}. Signal accumulated, scores updated: ${competingProduct}=${competingScore}, ${currentProduct}=${currentScore}, Δ=${delta}.`,
        guards,
        dualGate,
        personaMismatch: !personaGuard.passed,
        crossBURequired: !crossBUGuard.passed,
        holdNextTouch: cooldownCadence.reason.includes('HOLD NEXT TOUCH'),
      };
    }

    // Cooldown expired — re-evaluate dual gate
    if (dualGate.satisfied && personaGuard.passed) {
      const newState: FSMState = crossBUGuard.passed ? 'SWITCHING' : 'ESCALATED';
      const decision: Decision = crossBUGuard.passed ? 'switch' : 'escalate';

      return {
        previousState: state.fsmState,
        newState,
        decision,
        confidence: 0.90,
        reasoning: crossBUGuard.passed
          ? `Cooldown expired, intent sustained. ${dualGate.reason}. Executing graceful campaign switch from ${currentProduct} to ${competingProduct}.`
          : `Cooldown expired, intent sustained, but ${crossBUGuard.reason}. Cross-BU notification sent, 24h objection window started.`,
        guards,
        dualGate,
        personaMismatch: false,
        crossBURequired: !crossBUGuard.passed,
        holdNextTouch: false,
      };
    }

    // Cooldown expired but signal decayed back
    return {
      previousState: state.fsmState,
      newState: 'ACTIVE_CURRENT',
      decision: 'continue',
      confidence: 0.85,
      reasoning: `Cooldown expired but intent shift did not sustain. ${dualGate.reason}. Returning to active campaign ${currentProduct}. Anti-flapping worked correctly.`,
      guards,
      dualGate,
      personaMismatch: !personaGuard.passed,
      crossBURequired: false,
      holdNextTouch: false,
    };
  }

  // --- From ACTIVE_CURRENT or MONITORING ---

  // Persona mismatch — do not switch this contact (Fix 2)
  if (!personaGuard.passed && dualGate.satisfied) {
    return {
      previousState: state.fsmState,
      newState: state.fsmState, // Stay in current state
      decision: 'continue',
      confidence: 0.85,
      reasoning: `${personaGuard.reason}. Account-level intent for ${competingProduct} is real (score: ${competingScore}), but this contact should NOT be switched. Recommend sourcing correct buyer persona for ${competingProduct}.`,
      guards,
      dualGate,
      personaMismatch: true,
      crossBURequired: false,
      holdNextTouch: false,
    };
  }

  // Dual gate NOT satisfied — classify by delta level
  if (!dualGate.satisfied) {
    if (delta < 15) {
      // Weak signal → continue (or return from MONITORING)
      const newState: FSMState = state.fsmState === 'MONITORING' ? 'ACTIVE_CURRENT' : state.fsmState;
      return {
        previousState: state.fsmState,
        newState,
        decision: 'continue',
        confidence: 0.90,
        reasoning: newState !== state.fsmState
          ? `Delta ${delta} dropped below monitoring threshold. Intent shift resolved. Returning to ACTIVE_CURRENT.`
          : `Weak signal: Delta ${delta} < 15. ${dualGate.reason}. Campaign ${currentProduct} continues.`,
        guards,
        dualGate,
        personaMismatch: false,
        crossBURequired: false,
        holdNextTouch: false,
      };
    }

    // Moderate signal (15 ≤ delta < threshold OR absolute gate failed) → MONITORING
    return {
      previousState: state.fsmState,
      newState: 'MONITORING',
      decision: 'continue',
      confidence: 0.80,
      reasoning: `Moderate signal detected. ${dualGate.reason}. Moving to MONITORING state. Campaign ${currentProduct} continues but shift is being tracked.`,
      guards,
      dualGate,
      personaMismatch: false,
      crossBURequired: false,
      holdNextTouch: false,
    };
  }

  // Dual gate satisfied — enter EVALUATION_COOLDOWN (hysteresis)
  return {
    previousState: state.fsmState,
    newState: 'EVALUATION_COOLDOWN',
    decision: 'pause_cooldown',
    confidence: 0.85,
    reasoning: `Significant intent shift detected. ${dualGate.reason}. Entering ${config.cooldownHours}h evaluation cooldown to confirm signal persistence. ${cooldownCadence.reason}`,
    guards,
    dualGate,
    personaMismatch: false,
    crossBURequired: !crossBUGuard.passed,
    holdNextTouch: cooldownCadence.reason.includes('HOLD NEXT TOUCH'),
  };
}
