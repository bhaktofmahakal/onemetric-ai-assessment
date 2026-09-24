// ============================================================================
// OneMetric Campaign Segmentation Engine — TinyFish Live Hiring & Web Collector
// ============================================================================
// Fetches live public hiring data and market signals via TinyFish Search API
// to verify 3rd-party intent surges and calculate verification factors.
// ============================================================================

import {
  corroborateDomainIntent,
  type WebCorroborationResult,
  type WebCorroborationEvidence,
} from './tinyfish-search.js';

export {
  corroborateDomainIntent,
  type WebCorroborationResult,
  type WebCorroborationEvidence,
};

export interface VerificationFactorResult {
  domain: string;
  topic: string;
  verificationFactor: number; // e.g. 1.20 (20% boost) or 0.85 (penalty)
  isVerified: boolean;
  status: 'VERIFIED' | 'UNVERIFIED' | 'NOISE_SUSPECTED';
  hiringPositionsFound: number;
  signals: string[];
  evidenceSnippets: string[];
  latencyMs: number;
}

/**
 * High-level helper to calculate an intent verification factor using TinyFish
 */
export async function calculateVerificationFactor(
  domain: string,
  topic: string = 'Cloud Security',
  apiKey?: string
): Promise<VerificationFactorResult> {
  const result = await corroborateDomainIntent(domain, topic, apiKey);

  const verificationFactor = result.isCorroborated
    ? 1 + result.confidenceBoost // e.g. 1 + 0.15 = 1.15x
    : Math.max(0.7, 1 + result.confidenceBoost); // e.g. 1 - 0.10 = 0.90x

  return {
    domain,
    topic,
    verificationFactor: Math.round(verificationFactor * 100) / 100,
    isVerified: result.isCorroborated,
    status:
      result.status === 'CORROBORATED'
        ? 'VERIFIED'
        : result.status === 'UNCORROBORATED'
        ? 'UNVERIFIED'
        : 'NOISE_SUSPECTED',
    hiringPositionsFound: result.evidence.length,
    signals: result.matchedKeywords,
    evidenceSnippets: result.evidence.map((e) => `${e.title}: ${e.snippet}`),
    latencyMs: result.latencyMs,
  };
}

/**
 * Fetch hiring signals for a domain
 */
export async function fetchTinyFishHiringSignals(
  domain: string,
  role: string = 'Security Engineer'
): Promise<WebCorroborationEvidence[]> {
  const result = await corroborateDomainIntent(domain, role);
  return result.evidence;
}
