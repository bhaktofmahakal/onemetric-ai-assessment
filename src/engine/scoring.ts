// ============================================================================
// OneMetric Campaign Segmentation Engine — Mathematical Scoring
// ============================================================================
// Pure functions. Zero side effects. Zero external dependencies.
// Implements: source weighting, exponential time decay, composite scoring,
//             delta calculation, and dual-gate verification (Fix 1).
// ============================================================================

import type { IntentEvent, SourceType, ScoringConfig, SignalQuality } from '../types/index.js';

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

export function getDefaultConfig(): ScoringConfig {
  return {
    halfLifeDays: 14,
    switchThreshold: 25,
    absoluteMinIntent: 50,      // Fix 1: Absolute floor
    cooldownHours: 48,
    highIntentThreshold: 70,
    conflictThreshold: 70,
    minSignalScore: 10,
    maxSignalAgeDays: 30,
    fatigueMaxTouches: 2,
    fatigueWindowDays: 7,
    minimumTouchSpacingHours: 72,
    crossBUObjectionWindowHours: 24, // Fix 3
    holdNextTouchHours: 24,          // Fix 4
    sourceWeights: {
      '1st_party_direct': 1.0,
      '1st_party_passive': 0.8,
      '2nd_party': 0.7,
      '3rd_party': 0.5,
      'firmographic': 0.3,
    },
  };
}

// ---------------------------------------------------------------------------
// Source Weight Lookup
// ---------------------------------------------------------------------------

export function getSourceWeight(sourceType: SourceType, config: ScoringConfig): number {
  return config.sourceWeights[sourceType] ?? 0.5;
}

// ---------------------------------------------------------------------------
// Calibrated Bayesian Weight Learner (Empirical Bayes Source Calibration)
// ---------------------------------------------------------------------------
// Replaces static deltas with a conjugate Beta-Binomial Bayesian update:
// Prior: Beta(α₀, β₀) where α₀ = 10 × w_prior, β₀ = 10 × (1 - w_prior)
// Likelihood:
//   Positive conversions (open, reply, meeting, won) -> positive evidence
//   Negative signals (lost, unsubscribed) -> negative evidence
// Posterior Expectation: E[w] = (α₀ + Σpositive) / (α₀ + β₀ + Σpositive + Σnegative)
// Clamped to [0.10, 1.00] with variance σ² = αβ / ((α+β)²(α+β+1))
// ---------------------------------------------------------------------------
export interface BayesianWeightUpdate {
  sourceType: SourceType;
  priorWeight: number;
  posteriorWeight: number;
  sampleEvidence: number;
  posteriorVariance: number;
  confidenceInterval: [number, number];
}

export function calculateBayesianCalibratedWeight(
  sourceType: SourceType,
  priorWeight: number,
  feedbackHistory: Array<{ eventType: string; sourceType: SourceType }>
): BayesianWeightUpdate {
  const pseudoCount = 10;
  let alpha = pseudoCount * Math.max(0.1, Math.min(1.0, priorWeight));
  let beta = pseudoCount * (1.0 - Math.max(0.1, Math.min(1.0, priorWeight)));

  const relevant = feedbackHistory.filter(f => f.sourceType === sourceType);
  for (const f of relevant) {
    if (f.eventType === 'email_open') alpha += 0.2;
    else if (f.eventType === 'email_reply') alpha += 1.0;
    else if (f.eventType === 'meeting_booked') alpha += 1.8;
    else if (f.eventType === 'deal_won') alpha += 2.0;
    else if (f.eventType === 'deal_lost') beta += 1.0;
    else if (f.eventType === 'unsubscribed') beta += 1.8;
  }

  const posteriorMean = alpha / (alpha + beta);
  const posteriorVariance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
  const stdDev = Math.sqrt(posteriorVariance);
  const clampedPosterior = Math.round(Math.max(0.1, Math.min(1.0, posteriorMean)) * 100) / 100;

  return {
    sourceType,
    priorWeight,
    posteriorWeight: clampedPosterior,
    sampleEvidence: relevant.length,
    posteriorVariance: Math.round(posteriorVariance * 10000) / 10000,
    confidenceInterval: [
      Math.round(Math.max(0.1, clampedPosterior - 1.96 * stdDev) * 100) / 100,
      Math.round(Math.min(1.0, clampedPosterior + 1.96 * stdDev) * 100) / 100,
    ],
  };
}

// ---------------------------------------------------------------------------
// Exponential Time Decay
// ---------------------------------------------------------------------------
// S(t) = S₀ × e^(-λt)
// where λ = ln(2) / half_life_days
// At t = half_life, decay factor = 0.5 (score halved)
// ---------------------------------------------------------------------------

export function calculateDecayFactor(daysAgo: number, config: ScoringConfig): number {
  if (daysAgo <= 0) return 1.0;
  const lambda = Math.LN2 / config.halfLifeDays;
  return Math.exp(-lambda * daysAgo);
}

// ---------------------------------------------------------------------------
// Single Signal → Decayed Weighted Score
// ---------------------------------------------------------------------------

export function calculateDecayedScore(
  rawScore: number,
  sourceType: SourceType,
  daysAgo: number,
  config: ScoringConfig
): number {
  const weight = getSourceWeight(sourceType, config);
  const weighted = rawScore * weight;
  const decay = calculateDecayFactor(daysAgo, config);
  const result = weighted * decay;
  // Round to 2 decimal places for deterministic output
  return Math.round(result * 100) / 100;
}

// ---------------------------------------------------------------------------
// Composite Score (Per Account, Per Product)
// ---------------------------------------------------------------------------
// Sum of all decayed weighted signals for a given product, capped at 100.
// Signals older than maxSignalAgeDays are excluded.
// Signals with decayed score below minSignalScore are excluded.
// ---------------------------------------------------------------------------

export function calculateCompositeScore(
  events: IntentEvent[],
  productId: string,
  now: Date,
  config: ScoringConfig
): number {
  const productEvents = events.filter((event) => event.productId === productId);
  const contributions: Array<{ event: IntentEvent; score: number; timestamp: number }> = [];
  const pageVisitGroups = new Map<string, number[]>();

  for (const event of productEvents) {
    const timestamp = Date.parse(event.timestamp);
    if (!Number.isFinite(timestamp) || timestamp > now.getTime()) continue;
    if (!Number.isFinite(event.rawScore) || event.rawScore < 0 || event.rawScore > 100) continue;
    const daysAgo = (now.getTime() - timestamp) / (1000 * 60 * 60 * 24);
    if (daysAgo > config.maxSignalAgeDays) continue;

    const decayed = calculateDecayedScore(event.rawScore, event.sourceType, daysAgo, config);
    if (decayed < config.minSignalScore) continue;
    contributions.push({ event, score: decayed, timestamp });

    const page = event.metadata?.pageUrl ?? event.metadata?.url ?? event.metadata?.path;
    if (event.sourceType === '1st_party_passive' && typeof page === 'string' && page.length > 0) {
      const dayWindow = Math.floor(timestamp / 86400000);
      const key = `${event.source}|${page}|${dayWindow}`;
      const group = pageVisitGroups.get(key) ?? [];
      group.push(contributions.length - 1);
      pageVisitGroups.set(key, group);
    }
  }

  const dampenedEvents = new Set<number>();
  const normalizedPageTotals: number[] = [];
  for (const group of pageVisitGroups.values()) {
    if (group.length < 2) continue;
    const aggregate = group.reduce((sum, index) => sum + contributions[index].score, 0);
    normalizedPageTotals.push(aggregate * Math.log(1 + group.length) / group.length);
    for (const index of group) dampenedEvents.add(index);
  }

  let composite = contributions.reduce((sum, contribution, index) =>
    sum + (dampenedEvents.has(index) ? 0 : contribution.score), 0
  ) + normalizedPageTotals.reduce((sum, score) => sum + score, 0);

  const sourceTiers = new Set(contributions.map(({ event }) => event.sourceType));
  if (sourceTiers.size < 2) composite = Math.min(composite, 35);
  return Math.min(100, Math.round(composite * 100) / 100);
}

// ---------------------------------------------------------------------------
// Delta Calculation (Intent Shift Magnitude)
// ---------------------------------------------------------------------------

export function calculateDelta(competingScore: number, currentScore: number): number {
  return Math.round((competingScore - currentScore) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Dual-Gate Verification (Fix 1: Zero-Baseline Trap Prevention)
// ---------------------------------------------------------------------------
// A campaign switch requires BOTH:
//   (a) Delta >= switchThreshold  (relative gap is significant)
//   (b) Competing score >= absoluteMinIntent  (absolute intent is real)
//
// This prevents: Product B score = 0, Product A score = 26
//                Delta = 26 >= 25 ✓ BUT Product A = 26 < 50 ✗
//                → Switch BLOCKED. Weak intent on empty baseline.
// ---------------------------------------------------------------------------

export interface DualGateResult {
  satisfied: boolean;
  delta: number;
  competingScore: number;
  currentScore: number;
  deltaGatePassed: boolean;
  absoluteGatePassed: boolean;
  reason: string;
}

export function isDualGateSatisfied(
  competingScore: number,
  currentScore: number,
  config: ScoringConfig
): DualGateResult {
  const delta = calculateDelta(competingScore, currentScore);
  const deltaGatePassed = delta >= config.switchThreshold;
  const absoluteGatePassed = competingScore >= config.absoluteMinIntent;

  if (!deltaGatePassed && !absoluteGatePassed) {
    return {
      satisfied: false,
      delta,
      competingScore,
      currentScore,
      deltaGatePassed,
      absoluteGatePassed,
      reason: `Both gates failed: Delta ${delta} < ${config.switchThreshold} AND competing score ${competingScore} < ${config.absoluteMinIntent}`,
    };
  }

  if (!deltaGatePassed) {
    return {
      satisfied: false,
      delta,
      competingScore,
      currentScore,
      deltaGatePassed,
      absoluteGatePassed,
      reason: `Relative gate failed: Delta ${delta} < threshold ${config.switchThreshold}`,
    };
  }

  if (!absoluteGatePassed) {
    return {
      satisfied: false,
      delta,
      competingScore,
      currentScore,
      deltaGatePassed,
      absoluteGatePassed,
      reason: `ZERO-BASELINE TRAP PREVENTED: Delta ${delta} >= ${config.switchThreshold} but competing score ${competingScore} < absolute minimum ${config.absoluteMinIntent}. Intent is weak despite empty baseline.`,
    };
  }

  return {
    satisfied: true,
    delta,
    competingScore,
    currentScore,
    deltaGatePassed,
    absoluteGatePassed,
    reason: `Dual gate PASSED: Delta ${delta} >= ${config.switchThreshold} AND competing score ${competingScore} >= ${config.absoluteMinIntent}`,
  };
}

// ---------------------------------------------------------------------------
// Multi-Product Conflict Detection
// ---------------------------------------------------------------------------

export function detectConflict(
  scores: Record<string, number>,
  config: ScoringConfig
): { conflict: boolean; highIntentProducts: string[]; reason: string } {
  const highIntentProducts = Object.entries(scores)
    .filter(([, score]) => score >= config.conflictThreshold)
    .map(([productId]) => productId);

  if (highIntentProducts.length >= 2) {
    return {
      conflict: true,
      highIntentProducts,
      reason: `Multi-product conflict: ${highIntentProducts.length} products above ${config.conflictThreshold} threshold — ${highIntentProducts.map(p => `${p}: ${scores[p]}`).join(', ')}`,
    };
  }

  return {
    conflict: false,
    highIntentProducts,
    reason: highIntentProducts.length === 0
      ? 'No products at high intent level'
      : `Only ${highIntentProducts[0]} at high intent — no conflict`,
  };
}

// ---------------------------------------------------------------------------
// Signal Quality Classification
// ---------------------------------------------------------------------------

export function classifySignalQuality(
  event: IntentEvent,
  allRecentEvents: IntentEvent[],
  config: ScoringConfig
): SignalQuality {
  const now = new Date();
  const eventDate = new Date(event.timestamp);
  const daysAgo = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);

  // Noise: below minimum after weighting
  const weighted = event.rawScore * getSourceWeight(event.sourceType, config);
  if (weighted < config.minSignalScore) return 'noise';

  // Noise: older than 2 half-lives
  if (daysAgo > config.halfLifeDays * 2) return 'weak';

  // Strong: 1st-party direct action
  if (event.sourceType === '1st_party_direct') return 'strong';

  // Strong: multiple corroborating signals from different sources within 72h
  const recentCorroborating = allRecentEvents.filter(e => {
    const eDaysAgo = (now.getTime() - new Date(e.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return e.productId === event.productId
      && e.sourceType !== event.sourceType
      && eDaysAgo <= 3;
  });
  if (recentCorroborating.length >= 1) return 'strong';

  // Moderate: single 2nd-party or 1st-party passive
  if (event.sourceType === '2nd_party' || event.sourceType === '1st_party_passive') {
    return 'moderate';
  }

  // Weak: single 3rd-party or firmographic
  return 'weak';
}
