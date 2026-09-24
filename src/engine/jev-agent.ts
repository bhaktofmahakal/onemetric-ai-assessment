// ============================================================================
// OneMetric Campaign Segmentation Engine — Jev System One Decision Agent
// ============================================================================
// Dual-speed architecture:
//   System One (Jev): sub-50ms typed decisions for every event
//   System Two (LLM): expensive text generation for escalations only
//
// If TYPESAFE_API_KEY is present → live Jev API call
// If absent → deterministic RLCD-calibrated fallback (same interface contract)
// ============================================================================

import type {
  Decision,
  JevRequest,
  JevResponse,
  JevDecision,
  ProspectState,
  IntentEvent,
  ProductPersonaMap,
  ScoringConfig,
} from '../types/index.js';

import {
  calculateCompositeScore,
  isDualGateSatisfied,
  detectConflict,
  classifySignalQuality,
  getDefaultConfig,
} from './scoring.js';

// ---------------------------------------------------------------------------
// Jev API Client (Live)
// ---------------------------------------------------------------------------

async function callJevLive(request: JevRequest, apiKey: string): Promise<JevResponse> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(5000),
    });

    if ((response.status === 429 || response.status === 529) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 200 * (2 ** attempt)));
      continue;
    }

    if (!response.ok) {
      throw new Error(`TypeSafe System One API error: ${response.status} ${response.statusText}`);
    }

    const payload: unknown = await response.json();
    return decodeTypeSafeResponse(payload);
  }

  throw new Error('TypeSafe System One API retries exhausted');
}

function decodeTypeSafeResponse(payload: unknown): JevResponse {
  if (!payload || typeof payload !== 'object' || !('answers' in payload)) {
    throw new Error('TypeSafe response is missing answers');
  }
  const answers = (payload as { answers?: Record<string, unknown> }).answers;
  if (!answers) throw new Error('TypeSafe response answers are malformed');

  const action = answers.action as { choice?: unknown; probabilities?: unknown; confidence?: unknown } | undefined;
  const intent = answers.intent_confidence as { score?: unknown; legend?: unknown; confidence?: unknown } | undefined;
  const flappingRisk = answers.flapping_risk as { noul?: unknown } | undefined;
  const personaMismatch = answers.persona_mismatch as { noul?: unknown } | undefined;

  if (
    !action || typeof action.choice !== 'string' || !action.probabilities ||
    typeof action.probabilities !== 'object' || typeof action.confidence !== 'number' ||
    !intent || typeof intent.score !== 'number' || typeof intent.confidence !== 'number' ||
    !flappingRisk || typeof flappingRisk.noul !== 'number' ||
    !personaMismatch || typeof personaMismatch.noul !== 'number'
  ) {
    throw new Error('TypeSafe response does not match the requested Choice, Score, and Noul answers');
  }

  const allowedActions = new Set(['continue', 'pause_cooldown', 'switch', 'escalate']);
  const probabilities = Object.values(action.probabilities as Record<string, unknown>);
  const probabilityTotal = probabilities.reduce<number>((sum, value) =>
    sum + (typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN), 0);
  if (!allowedActions.has(action.choice) || action.confidence < 0 || action.confidence > 1 ||
      !Number.isFinite(probabilityTotal) || probabilities.some((value) =>
        typeof value !== 'number' || value < 0 || value > 1) || Math.abs(probabilityTotal - 1) > 0.02 ||
      !Number.isFinite(intent.score) || intent.confidence < 0 || intent.confidence > 1 ||
      !Number.isFinite(flappingRisk.noul) || flappingRisk.noul < 0 || flappingRisk.noul > 1 ||
      !Number.isFinite(personaMismatch.noul) || personaMismatch.noul < 0 || personaMismatch.noul > 1) {
    throw new Error('TypeSafe response contains out-of-range confidence or invalid Choice probabilities');
  }

  const legend = (intent.legend && typeof intent.legend === 'object')
    ? intent.legend as Record<string, string>
    : {};
  const levelIndex = String(Math.round(intent.score));

  return {
    choices: {
      action: {
        selection: action.choice,
        probabilities: action.probabilities as Record<string, number>,
        confidence: action.confidence,
      },
    },
    scores: {
      intent_confidence: {
        score: intent.score,
        level: legend[levelIndex] ?? levelIndex,
        confidence: intent.confidence,
      },
    },
    nouls: {
      flapping_risk: { noul: flappingRisk.noul },
      persona_mismatch: { noul: personaMismatch.noul },
    },
  };
}

// ---------------------------------------------------------------------------
// Build Jev Request from Prospect State
// ---------------------------------------------------------------------------

function buildJevRequest(
  state: ProspectState,
  incomingEvents: IntentEvent[],
  competingProduct: string,
  scores: Record<string, number>,
  delta: number
): JevRequest {
  const stateObj = {
    account: {
      name: state.account.name,
      industry: state.account.industry,
      tier: state.account.tier,
      activeDeals: state.account.activeDeals.length,
    },
    contact: {
      name: `${state.contact.firstName} ${state.contact.lastName}`,
      persona: state.contact.persona,
      jobTitle: state.contact.jobTitle,
      currentCampaign: state.contact.currentCampaign,
      touchCount7d: state.contact.touchCount7d,
    },
    scores,
    delta,
    currentState: state.fsmState,
    incomingSignals: incomingEvents.map(e => ({
      source: e.source,
      sourceType: e.sourceType,
      product: e.productId,
      rawScore: e.rawScore,
    })),
  };

  return {
    model: 'jev-latest',
    state: stateObj,
    questions: {
      action: {
        type: 'choice',
        criteria: {
          continue: 'Keep the current campaign when the deterministic policy permits it.',
          pause_cooldown: 'Hold the journey while a meaningful competing signal is rechecked.',
          switch: 'Move to a competing product journey only after the deterministic gates and cooldown pass.',
          escalate: 'Hand the case to a human when risk, conflict, or uncertainty makes automation unsafe.',
        },
        instructions: `Determine optimal campaign action. Apply dual-gate: delta must be >= 25 AND competing product score must be >= 50. Check persona relevance. Current delta: ${delta}. Competing product (${competingProduct}) score: ${scores[competingProduct] ?? 0}.`,
      },
      intent_confidence: {
        type: 'score',
        criteria: [
          'Low: evidence is stale, isolated, weak, or contradicts the target product.',
          'Moderate: recent relevant evidence exists but corroboration or persistence is limited.',
          'High: recent, relevant evidence is corroborated across independent sources.',
        ],
        instructions: 'Rate the sustainability and multi-touch depth of the intent signal. Consider source diversity, recency, and raw score magnitude.',
      },
      flapping_risk: {
        type: 'noul',
        criteria: {
          true: 'The apparent shift is likely temporary or based on insufficient independent evidence.',
          false: 'The apparent shift is sustained enough that it is unlikely to be a temporary spike.',
        },
        instructions: 'Is this a temporary spike with no secondary corroboration? High probability means likely noise.',
      },
      persona_mismatch: {
        type: 'noul',
        criteria: {
          true: 'The contact role is not a plausible buyer or influencer for this product.',
          false: 'The contact role is relevant to this product.',
        },
        instructions: `Does the contact persona "${state.contact.persona}" (${state.contact.jobTitle}) conflict with the intent product ${competingProduct}?`,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Deterministic Calibrated Fallback (No API Key)
// ---------------------------------------------------------------------------
// Mirrors the Jev interface contract exactly, using mathematical scores
// and FSM guards to produce calibrated probabilities.
// ---------------------------------------------------------------------------

function runCalibratedFallback(
  state: ProspectState,
  incomingEvents: IntentEvent[],
  competingProduct: string,
  scores: Record<string, number>,
  delta: number,
  productMap: ProductPersonaMap[],
  config: ScoringConfig
): JevResponse {
  const currentProduct = state.contact.currentCampaign ?? '';
  const competingScore = scores[competingProduct] ?? 0;
  const currentScore = scores[currentProduct] ?? 0;

  // --- Flapping Risk ---
  // High if: single 3rd-party source, no corroboration, low raw score
  const sourceTypes = [...new Set(incomingEvents.map(e => e.sourceType))];
  const hasCorroboration = sourceTypes.length > 1 || incomingEvents.some(e =>
    e.sourceType === '1st_party_direct' || e.sourceType === '1st_party_passive'
  );
  const avgRawScore = incomingEvents.reduce((sum, e) => sum + e.rawScore, 0) / (incomingEvents.length || 1);

  let flappingRisk: number;
  if (!hasCorroboration && avgRawScore < 50) {
    flappingRisk = 0.82; // High risk — single weak source
  } else if (!hasCorroboration && avgRawScore >= 50) {
    flappingRisk = 0.55; // Moderate — strong score but single source
  } else if (hasCorroboration && avgRawScore < 50) {
    flappingRisk = 0.35; // Moderate-low — multiple sources but weak
  } else {
    flappingRisk = 0.12; // Low — multiple strong sources
  }

  // --- Persona Mismatch ---
  const product = productMap.find(p => p.productId === competingProduct);
  let personaMismatchProb: number;
  if (!product) {
    personaMismatchProb = 0.15; // No mapping → assume likely relevant
  } else if (product.relevantPersonas.includes(state.contact.persona.toLowerCase())) {
    personaMismatchProb = 0.05; // Match
  } else {
    personaMismatchProb = 0.92; // Clear mismatch
  }

  // --- Intent Confidence ---
  let intentScore: number;
  let intentLevel: string;
  if (competingScore >= 70 && hasCorroboration) {
    intentScore = 0.88;
    intentLevel = 'high';
  } else if (competingScore >= 50 || (competingScore >= 35 && hasCorroboration)) {
    intentScore = 0.55;
    intentLevel = 'moderate';
  } else {
    intentScore = 0.22;
    intentLevel = 'low';
  }

  // --- Action Choice ---
  const dualGate = isDualGateSatisfied(competingScore, currentScore, config);
  const conflict = detectConflict(scores, config);
  const hasActiveDeal = state.account.activeDeals.length > 0;
  const isEnterprise = state.account.tier === 1;

  let action: Decision;
  let probabilities: Record<string, number>;
  let confidence: number;

  if (conflict.conflict || (isEnterprise && hasActiveDeal && dualGate.satisfied)) {
    action = 'escalate';
    probabilities = { continue: 0.05, pause_cooldown: 0.05, switch: 0.10, escalate: 0.80 };
    confidence = 0.90;
  } else if (personaMismatchProb > 0.7) {
    // Persona mismatch → continue (don't switch this contact)
    action = 'continue';
    probabilities = { continue: 0.78, pause_cooldown: 0.10, switch: 0.02, escalate: 0.10 };
    confidence = 0.85;
  } else if (dualGate.satisfied && flappingRisk < 0.5) {
    if (state.fsmState === 'EVALUATION_COOLDOWN') {
      action = 'switch';
      probabilities = { continue: 0.05, pause_cooldown: 0.05, switch: 0.82, escalate: 0.08 };
      confidence = 0.88;
    } else {
      action = 'pause_cooldown';
      probabilities = { continue: 0.08, pause_cooldown: 0.75, switch: 0.10, escalate: 0.07 };
      confidence = 0.82;
    }
  } else if (delta >= 15 && delta < config.switchThreshold) {
    action = 'continue';
    probabilities = { continue: 0.65, pause_cooldown: 0.20, switch: 0.05, escalate: 0.10 };
    confidence = 0.75;
  } else {
    action = 'continue';
    probabilities = { continue: 0.88, pause_cooldown: 0.07, switch: 0.02, escalate: 0.03 };
    confidence = 0.92;
  }

  return {
    choices: {
      action: { selection: action, probabilities, confidence },
    },
    scores: {
      intent_confidence: { score: intentScore, level: intentLevel, confidence: 0.85 },
    },
    nouls: {
      flapping_risk: { noul: flappingRisk },
      persona_mismatch: { noul: personaMismatchProb },
    },
  };
}

// ---------------------------------------------------------------------------
// Main Entry Point — Evaluate with Jev
// ---------------------------------------------------------------------------

export async function evaluateWithJev(
  state: ProspectState,
  incomingEvents: IntentEvent[],
  productMap: ProductPersonaMap[],
  config: ScoringConfig = getDefaultConfig(),
  nowOverride?: Date
): Promise<JevDecision> {
  const now = nowOverride ?? new Date();
  const startTime = performance.now();

  // Calculate scores
  const allEvents = [...state.events, ...incomingEvents];
  const allProductIds = [...new Set(allEvents.map(e => e.productId))];
  const currentProduct = state.contact.currentCampaign ?? '';
  if (!allProductIds.includes(currentProduct) && currentProduct) {
    allProductIds.push(currentProduct);
  }

  const scores: Record<string, number> = {};
  for (const pid of allProductIds) {
    scores[pid] = calculateCompositeScore(allEvents, pid, now, config);
  }

  // Determine competing product
  const competingProducts = [...new Set(incomingEvents.map(e => e.productId))]
    .filter(p => p !== currentProduct);
  const competingProduct = competingProducts[0] ?? '';

  if (!competingProduct) {
    const elapsed = performance.now() - startTime;
    return {
      decision: 'continue',
      response: {
        choices: {
          action: { selection: 'continue', probabilities: { continue: 0.95, pause_cooldown: 0.03, switch: 0.01, escalate: 0.01 }, confidence: 0.95 },
        },
        scores: {
          intent_confidence: { score: 0.3, level: 'low', confidence: 0.90 },
        },
        nouls: {
          flapping_risk: { noul: 0.1 },
          persona_mismatch: { noul: 0.05 },
        },
      },
      latencyMs: Math.round(elapsed * 100) / 100,
      engineUsed: 'jev_calibrated_fallback',
    };
  }

  const currentScore = scores[currentProduct] ?? 0;
  const competingScore = scores[competingProduct] ?? 0;
  const delta = Math.round((competingScore - currentScore) * 100) / 100;

  // Build request
  const request = buildJevRequest(state, incomingEvents, competingProduct, scores, delta);

  // Try live Jev API first
  const apiKey = typeof process !== 'undefined' ? process.env?.TYPESAFE_API_KEY : undefined;
  const hasValidKey = apiKey && apiKey.trim().length > 10 && !apiKey.includes('your_typesafe_api_key');

  let response: JevResponse;
  let engineUsed: 'jev_live' | 'jev_calibrated_fallback';

  if (hasValidKey) {
    try {
      response = await callJevLive(request, apiKey);
      engineUsed = 'jev_live';
    } catch (error) {
      // Fallback on API failure
      console.warn(`Jev API call failed, using calibrated fallback: ${error}`);
      response = runCalibratedFallback(state, incomingEvents, competingProduct, scores, delta, productMap, config);
      engineUsed = 'jev_calibrated_fallback';
    }
  } else {
    response = runCalibratedFallback(state, incomingEvents, competingProduct, scores, delta, productMap, config);
    engineUsed = 'jev_calibrated_fallback';
  }

  const elapsed = performance.now() - startTime;
  const decision = response.choices.action.selection as Decision;

  return {
    decision,
    response,
    latencyMs: Math.round(elapsed * 100) / 100,
    engineUsed,
  };
}
