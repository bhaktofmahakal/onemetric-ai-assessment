// ============================================================================
// OneMetric Campaign Segmentation Engine — Mock Scenarios
// ============================================================================
// 4 test scenarios covering all 4 production fixes:
//   Scenario 1: Zero-Baseline Dual-Gate Trap (Fix 1)
//   Scenario 2: Valid Multi-Touch Switch (happy path)
//   Scenario 3: Persona Mismatch (Fix 2)
//   Scenario 4: Enterprise Dual Intent + Active Deal (escalation)
// ============================================================================

import type {
  ProspectState,
  IntentEvent,
  ProductPersonaMap,
  TestScenario,
  FSMState,
  Decision,
} from '../types/index.js';
import { PRODUCT_PERSONA_MAP } from '../engine/product-catalog.js';

export { PRODUCT_PERSONA_MAP } from '../engine/product-catalog.js';

// ---------------------------------------------------------------------------
// Base Prospect State Factory
// ---------------------------------------------------------------------------

function createBaseState(overrides?: Partial<ProspectState>): ProspectState {
  const now = new Date().toISOString();
  return {
    account: {
      accountId: 'acc_techcorp_001',
      domain: 'techcorp.com',
      name: 'TechCorp Inc',
      industry: 'SaaS / Technology',
      tier: 2,
      ownerBU: 'BU_Analytics',
      activeDeals: [],
    },
    contact: {
      contactId: '557293910732',
      email: 'sarah.chen@techcorp.com',
      firstName: 'Sarah',
      lastName: 'Chen',
      jobTitle: 'VP of Engineering',
      persona: 'engineering',
      accountId: 'acc_techcorp_001',
      currentCampaign: 'product_b',
      enrollmentDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      lastTouchDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      touchCount7d: 1,
    },
    scores: { product_b: 0, product_a: 0 },
    fsmState: 'ACTIVE_CURRENT',
    previousState: null,
    stateEnteredAt: now,
    cooldownStartedAt: null,
    events: [],
    decisionHistory: [],
    crossBUTransition: null,
    nextScheduledTouch: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scenario 1: Zero-Baseline Dual-Gate Trap (Fix 1)
// ---------------------------------------------------------------------------
// Product B score = 0 (no engagement yet, just enrolled).
// Bombora reports Product A surge with score 52 → weighted = 52 * 0.5 = 26.
// Delta = 26 - 0 = 26 → Exceeds threshold of 25!
// BUT: Composite Product A = 26 < absolute minimum of 50.
// RESULT: CONTINUE (Dual-gate prevents premature switch on weak intent!)
// ---------------------------------------------------------------------------

export const SCENARIO_1_ZERO_BASELINE: TestScenario = {
  id: 'scenario_1_zero_baseline',
  name: 'Uncorroborated Intent Surge',
  description: 'Isolated 3rd-party surge on fresh enrollment. Relative delta exceeds 25, but absolute intent is below 50. Dual-gate prevents premature campaign ejection.',
  initialState: createBaseState({
    scores: { product_b: 0, product_a: 0 },
    events: [], // No prior events — fresh enrollment
  }),
  incomingEvents: [
    {
      eventId: 'evt_001',
      accountId: 'acc_techcorp_001',
      productId: 'product_a',
      source: 'bombora',
      sourceType: '3rd_party',
      rawScore: 52,
      timestamp: new Date().toISOString(),
      metadata: { topic: 'cloud security', surgeScore: 52 },
    },
  ],
  productPersonaMap: PRODUCT_PERSONA_MAP,
  expectedDecision: 'continue',
  expectedState: 'MONITORING',
  expectedReasoning: 'Zero-Baseline Trap prevented — delta high but absolute intent too weak',
};

// ---------------------------------------------------------------------------
// Scenario 2: Valid Multi-Touch Switch (Happy Path)
// ---------------------------------------------------------------------------
// Product B has moderate engagement (score ~45).
// Product A gets strong multi-touch signals:
//   - G2 pricing page view (2nd-party, score 85)
//   - Website case study download (1st-party passive, score 70)
// Composite Product A ≈ 85*0.7 + 70*0.8 = 59.5 + 56 = 115.5 → capped at 100
// Delta = 100 - 45 = 55 → Exceeds 25 ✓
// Absolute: 100 >= 50 ✓
// Persona: "engineering" matches Product A (CloudSecure) ✓
// RESULT: EVALUATION_COOLDOWN (awaiting 48h confirmation)
// ---------------------------------------------------------------------------

export const SCENARIO_2_VALID_SWITCH: TestScenario = {
  id: 'scenario_2_valid_switch',
  name: 'Corroborated Buying Intent',
  description: 'Strong corroborated signals from 2nd-party review and direct content download. Dual-gate passes. Enters 48h evaluation cooldown.',
  initialState: createBaseState({
    scores: { product_b: 45 },
    events: [
      {
        eventId: 'evt_prior_1',
        accountId: 'acc_techcorp_001',
        productId: 'product_b',
        source: 'website',
        sourceType: '1st_party_passive',
        rawScore: 65,
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  }),
  incomingEvents: [
    {
      eventId: 'evt_002a',
      accountId: 'acc_techcorp_001',
      productId: 'product_a',
      source: 'g2',
      sourceType: '2nd_party',
      rawScore: 85,
      timestamp: new Date().toISOString(),
      metadata: { activity: 'pricing_page_view', category: 'cloud_security' },
    },
    {
      eventId: 'evt_002b',
      accountId: 'acc_techcorp_001',
      productId: 'product_a',
      source: 'website',
      sourceType: '1st_party_passive',
      rawScore: 70,
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1h ago
      metadata: { page: 'case_study_cloud_security', action: 'download' },
    },
  ],
  productPersonaMap: PRODUCT_PERSONA_MAP,
  expectedDecision: 'pause_cooldown',
  expectedState: 'EVALUATION_COOLDOWN',
  expectedReasoning: 'Dual gate passed with multi-touch corroboration',
};

// ---------------------------------------------------------------------------
// Scenario 3: Persona Mismatch
// ---------------------------------------------------------------------------
// Domain-level intent surge for Product C (FinanceOS — Finance ERP).
// BUT Sarah is VP of Engineering (persona: "engineering").
// Product C's relevant personas: ["finance", "cfo", "accounting", "operations"].
// Sarah's persona does NOT match.
// RESULT: CONTINUE Sarah in Product B. Flag account-level expansion.
//         Recommend sourcing a Finance persona at TechCorp.
// ---------------------------------------------------------------------------

export const SCENARIO_3_PERSONA_MISMATCH: TestScenario = {
  id: 'scenario_3_persona_mismatch',
  name: 'Cross-Department Intent Alignment',
  description: 'Domain surges on FinanceOS (Product C) but contact persona is Engineering. Persona relevance filter holds campaign.',
  initialState: createBaseState({
    scores: { product_b: 52 },
    events: [
      {
        eventId: 'evt_prior_2',
        accountId: 'acc_techcorp_001',
        productId: 'product_b',
        source: 'email',
        sourceType: '1st_party_passive',
        rawScore: 70,
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  }),
  incomingEvents: [
    {
      eventId: 'evt_003a',
      accountId: 'acc_techcorp_001',
      productId: 'product_c',
      source: 'bombora',
      sourceType: '3rd_party',
      rawScore: 80,
      timestamp: new Date().toISOString(),
      metadata: { topic: 'financial_erp_software' },
    },
    {
      eventId: 'evt_003b',
      accountId: 'acc_techcorp_001',
      productId: 'product_c',
      source: 'g2',
      sourceType: '2nd_party',
      rawScore: 75,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      metadata: { activity: 'comparison_view', category: 'finance_erp' },
    },
  ],
  productPersonaMap: PRODUCT_PERSONA_MAP,
  expectedDecision: 'continue',
  expectedState: 'ACTIVE_CURRENT',
  expectedReasoning: 'Persona mismatch — engineering persona does not match FinanceOS product',
};

// ---------------------------------------------------------------------------
// Scenario 4: Enterprise Dual Intent + Active Deal (Escalation)
// ---------------------------------------------------------------------------
// Enterprise Tier-1 account with active $120K deal.
// High intent for both Product A (score 90) and Product B (score 85).
// Multi-product conflict detected (both > 70).
// Active deal exists.
// RESULT: ESCALATED to Account Executive with AI briefing.
// ---------------------------------------------------------------------------

export const SCENARIO_4_ENTERPRISE_ESCALATION: TestScenario = {
  id: 'scenario_4_enterprise_escalation',
  name: 'Enterprise Multi-Product Deal',
  description: 'Tier-1 account with $120K open deal exhibiting high dual-product intent. Multi-product conflict routes to assigned Account Executive.',
  initialState: createBaseState({
    account: {
      accountId: 'acc_enterprise_001',
      domain: 'megacorp.com',
      name: 'MegaCorp Enterprise',
      industry: 'Financial Services',
      tier: 1,
      ownerBU: 'BU_Analytics',
      activeDeals: [
        {
          dealId: 'deal_001',
          dealStage: 'Demo Scheduled',
          amount: 120000,
          owner: 'ae_john_smith',
          productId: 'product_b',
        },
      ],
    },
    contact: {
      contactId: '557357306602',
      email: 'james.wilson@megacorp.com',
      firstName: 'James',
      lastName: 'Wilson',
      jobTitle: 'CISO',
      persona: 'security',
      accountId: 'acc_enterprise_001',
      currentCampaign: 'product_b',
      enrollmentDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      lastTouchDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      touchCount7d: 1,
    },
    scores: { product_b: 85, product_a: 60 },
    events: [
      {
        eventId: 'evt_prior_3a',
        accountId: 'acc_enterprise_001',
        productId: 'product_b',
        source: 'website',
        sourceType: '1st_party_direct',
        rawScore: 95,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        eventId: 'evt_prior_3b',
        accountId: 'acc_enterprise_001',
        productId: 'product_a',
        source: 'g2',
        sourceType: '2nd_party',
        rawScore: 80,
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  }),
  incomingEvents: [
    {
      eventId: 'evt_004a',
      accountId: 'acc_enterprise_001',
      productId: 'product_a',
      source: 'website',
      sourceType: '1st_party_direct',
      rawScore: 95,
      timestamp: new Date().toISOString(),
      metadata: { page: 'demo_request_form', action: 'form_started' },
    },
    {
      eventId: 'evt_004b',
      accountId: 'acc_enterprise_001',
      productId: 'product_a',
      source: 'bombora',
      sourceType: '3rd_party',
      rawScore: 70,
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      metadata: { topic: 'enterprise_security_platform', surgeScore: 70 },
    },
  ],
  productPersonaMap: PRODUCT_PERSONA_MAP,
  expectedDecision: 'escalate',
  expectedState: 'ESCALATED',
  expectedReasoning: 'Multi-product conflict with active deal — requires AE review',
};

// ---------------------------------------------------------------------------
// All Scenarios
// ---------------------------------------------------------------------------

export const ALL_SCENARIOS: TestScenario[] = [
  SCENARIO_1_ZERO_BASELINE,
  SCENARIO_2_VALID_SWITCH,
  SCENARIO_3_PERSONA_MISMATCH,
  SCENARIO_4_ENTERPRISE_ESCALATION,
];
