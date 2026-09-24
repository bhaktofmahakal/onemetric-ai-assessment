// ============================================================================
// OneMetric Campaign Segmentation Engine — Gemini System Two Reasoning Agent
// ============================================================================
// Dual-Speed Architecture:
//   System One (Jev): sub-50ms deterministic typed decisions for incoming signals
//   System Two (Gemini 3.7 Flash): Deep contextual reasoning for sales escalations
//
// Generates structured 3-part executive memos:
//   1. Commercial Risk Assessment ($120K deal, competing BUs, revenue risk)
//   2. Unified Cross-Solution Strategy (Joint demo over siloed pitches)
//   3. AE Action Checklist (3 high-impact discovery questions & objection handling)
//
// Model Fallback Chain: gemini-3.7-flash → gemini-3.6-flash → deterministic
// ============================================================================

import type { ProspectState, ExecutiveBriefing } from '../types/index.js';

export async function generateExecutiveBriefing(
  prospect: ProspectState,
  scores: Record<string, number>,
  delta: number,
  apiKeyOverride?: string
): Promise<ExecutiveBriefing> {
  const startTime = performance.now();
  const apiKey = apiKeyOverride || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined);
  const primaryModel = (typeof process !== 'undefined' ? process.env?.GEMINI_MODEL : undefined) || 'gemini-3.8-flash';
  const fallbackModel = (typeof process !== 'undefined' ? process.env?.GEMINI_FALLBACK_MODEL : undefined) || 'gemini-3.6-flash';

  // Check if a real API key is configured (ignore empty or placeholder strings)
  const hasValidKey = apiKey && apiKey.trim().length > 10 && !apiKey.includes('your_gemini_api_key');

  if (hasValidKey) {
    const activeDeal = prospect.account.activeDeals[0];
    const promptContext = {
      account: {
        name: prospect.account.name,
        tier: prospect.account.tier,
        industry: prospect.account.industry,
        activeDeal: activeDeal ? {
          amount: activeDeal.amount,
          dealStage: activeDeal.dealStage,
          owner: activeDeal.owner,
        } : null,
      },
      contact: {
        name: `${prospect.contact.firstName} ${prospect.contact.lastName}`,
        title: prospect.contact.jobTitle,
        persona: prospect.contact.persona,
        currentCampaign: prospect.contact.currentCampaign,
      },
      intentScores: scores,
      delta,
      recentSignals: prospect.events.slice(-5).map(e => ({
        source: e.source,
        product: e.productId,
        rawScore: e.rawScore,
      })),
    };

    const systemPrompt = `You are an elite B2B Enterprise RevOps AI Advisor for OneMetric.
Analyze this high-value account conflict and generate a structured 3-part executive sales briefing.
You must respond strictly in JSON matching this exact schema:
{
  "commercialRisk": "A 2-3 sentence analysis of deal size impact, competing BU product lines, and pipeline risk.",
  "crossSolutionStrategy": "A 2-3 sentence strategic recommendation for a unified cross-solution demonstration rather than competing silo pitches.",
  "actionChecklist": [
    "Specific discovery question or objection-handling tactic 1 for the assigned AE",
    "Specific discovery question or objection-handling tactic 2 for the assigned AE",
    "Specific discovery question or objection-handling tactic 3 for the assigned AE"
  ]
}`;

    const userContent = `Account & Signal Context:
${JSON.stringify(promptContext, null, 2)}

Provide the structured JSON memo:`;

    const requestBody = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userContent}` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    // Model fallback chain: try primary model first (3.5), then flash-lite, then 3.5-lite
    const modelsToTry = [
      primaryModel,
      fallbackModel,
      'gemini-3.5-flash',
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    for (const modelName of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        console.log(`[GeminiAgent] Attempting model: ${modelName}`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
          signal: AbortSignal.timeout(3500),
        });

        // If model is overloaded (503) or rate-limited (429), try next model
        if (response.status === 503 || response.status === 429) {
          console.warn(`[GeminiAgent] Model ${modelName} returned ${response.status}, trying fallback...`);
          continue;
        }

        if (response.ok) {
          const json = await response.json();
          if (json.error) {
            console.warn(`[GeminiAgent] Model ${modelName} returned error in body:`, json.error.message);
            continue;
          }
          const textResponse = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textResponse) {
            const cleanedText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanedText);
            const elapsed = performance.now() - startTime;

            return {
              commercialRisk: parsed.commercialRisk || getDefaultCommercialRisk(prospect, scores),
              crossSolutionStrategy: parsed.crossSolutionStrategy || getDefaultStrategy(scores),
              actionChecklist: Array.isArray(parsed.actionChecklist) && parsed.actionChecklist.length >= 3
                ? parsed.actionChecklist.slice(0, 3)
                : getDefaultChecklist(prospect),
              latencyMs: Math.round(elapsed * 10) / 10,
              engine: 'OneMetric Cognitive Agent (System Two)',
              isLive: true,
              modelUsed: 'OneMetric Cognitive Agent (System Two)',
              generatedAt: new Date().toISOString(),
            };
          }
        } else {
          console.warn(`[GeminiAgent] Model ${modelName} returned HTTP ${response.status}`);
        }
      } catch (err) {
        console.warn(`[GeminiAgent] Model ${modelName} call failed:`, err);
      }
    }

    console.warn('[GeminiAgent] All models exhausted, falling back to deterministic synthesis');
  }

  // Graceful deterministic fallback (instant, contextual, guaranteed)
  const elapsed = performance.now() - startTime;
  return {
    commercialRisk: getDefaultCommercialRisk(prospect, scores),
    crossSolutionStrategy: getDefaultStrategy(scores),
    actionChecklist: getDefaultChecklist(prospect),
    latencyMs: Math.round(Math.max(0.08, elapsed) * 10) / 10,
    engine: 'OneMetric Strategic Synthesizer (Calibrated)',
    isLive: false,
    modelUsed: 'OneMetric Strategic Synthesizer (Calibrated)',
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Contextual Fallback Generators
// ---------------------------------------------------------------------------

function getDefaultCommercialRisk(prospect: ProspectState, scores: Record<string, number>): string {
  const deal = prospect.account.activeDeals[0];
  const dealAmount = deal ? `$${(deal.amount / 1000).toFixed(0)}K` : '$120K';
  const dealStage = deal ? deal.dealStage : 'Demo Scheduled';
  const scoreA = Math.round(scores['product_a'] ?? 90);
  const scoreB = Math.round(scores['product_b'] ?? 85);

  return `High-value Tier ${prospect.account.tier} account (${prospect.account.name}) with an active ${dealAmount} pipeline opportunity in "${dealStage}". Simultaneous intent surge across CloudSecure (${scoreA}/100) and DataFlow (${scoreB}/100) creates immediate risk of competing BU sales outreach confusing executive stakeholders and stalling pipeline momentum.`;
}

function getDefaultStrategy(scores: Record<string, number>): string {
  const scoreA = Math.round(scores['product_a'] ?? 90);
  const scoreB = Math.round(scores['product_b'] ?? 85);

  return `Suspend automated marketing cadence immediately. Direct the assigned Strategic AE to conduct a joint "Platform Security & Analytics" architecture walkthrough. Position CloudSecure (${scoreA} intent) as the zero-trust data perimeter safeguarding DataFlow (${scoreB} intent) telemetry, transforming a siloed friction point into a consolidated enterprise deal.`;
}

function getDefaultChecklist(prospect: ProspectState): string[] {
  const deal = prospect.account.activeDeals[0];
  const aeName = deal ? deal.owner : 'Strategic AE';
  const contactTitle = prospect.contact.jobTitle;

  return [
    `Discovery: Ask ${prospect.contact.firstName} (${contactTitle}): "How is your engineering team currently reconciling zero-trust audit compliance with your real-time analytics data pipelines?"`,
    `Handover Alignment: Coordinate with ${aeName} to merge security compliance proof-of-concept requirements into the upcoming stage review.`,
    `Objection Handling: If client questions multiple product touches, emphasize: "Our solutions architect was notified of your dual evaluation to ensure you receive a unified licensing model rather than separate contracts."`,
  ];
}
