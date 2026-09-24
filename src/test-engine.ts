// ============================================================================
// OneMetric Campaign Segmentation Engine — CLI Test Runner
// ============================================================================
// Executes all 4 scenarios through the full pipeline:
//   Scoring → FSM → Jev Agent → HubSpot Sync
// Prints formatted terminal output verifying mathematical gates & transitions.
// ============================================================================

import { ALL_SCENARIOS, PRODUCT_PERSONA_MAP } from './data/mock-scenarios.js';
import { calculateCompositeScore, calculateDelta, isDualGateSatisfied, getDefaultConfig } from './engine/scoring.js';
import { checkCrossBU, checkPersonaRelevance, checkSmartCooldown, evaluateFSM } from './engine/fsm.js';
import { evaluateWithJev } from './engine/jev-agent.js';
import { batchSyncContacts, buildHubSpotSyncPayload, generateIdempotencyKey } from './engine/hubspot-sync.js';
import { resolvePriorityAction } from './engine/multi-contact-evaluator.js';
import assert from 'node:assert/strict';
import type { DecisionOutcome, FSMState } from './types/index.js';

// ---------------------------------------------------------------------------
// Terminal Formatting Utilities
// ---------------------------------------------------------------------------

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const BG_GREEN = '\x1b[42m';
const BG_RED = '\x1b[41m';

function colorState(state: FSMState): string {
  const colors: Record<FSMState, string> = {
    'ACTIVE_CURRENT': GREEN,
    'MONITORING': YELLOW,
    'EVALUATION_COOLDOWN': `${YELLOW}${BOLD}`,
    'SWITCHING': BLUE,
    'ESCALATED': RED,
    'PAUSED': DIM,
    'EXITED': `${RED}${BOLD}`,
  };
  return `${colors[state] ?? WHITE}${state}${RESET}`;
}

function colorDecision(decision: string): string {
  const colors: Record<string, string> = {
    'continue': GREEN,
    'pause_cooldown': YELLOW,
    'switch': BLUE,
    'escalate': RED,
    'exit': `${RED}${BOLD}`,
  };
  return `${colors[decision] ?? WHITE}${decision.toUpperCase()}${RESET}`;
}

function passFail(passed: boolean): string {
  return passed ? `${GREEN}✓ PASS${RESET}` : `${RED}✗ FAIL${RESET}`;
}

function hr(char = '─', len = 78): string {
  return DIM + char.repeat(len) + RESET;
}

// ---------------------------------------------------------------------------
// Main Test Runner
// ---------------------------------------------------------------------------

async function runAllScenarios() {
  assert.equal(resolvePriorityAction('escalate', true, 2, 2), 'ESCALATE_REVIEW');
  assert.equal(resolvePriorityAction('exit', true, 2, 2), 'EXIT_SUPPRESSED');
  assert.equal(resolvePriorityAction('switch', true, 2, 2), 'PAUSE_FATIGUE');
  assert.equal(resolvePriorityAction('switch', false, 1, 2), null);
  assert.equal(checkPersonaRelevance(ALL_SCENARIOS[0].initialState.contact, 'unknown_product', PRODUCT_PERSONA_MAP).passed, false);
  assert.equal(checkCrossBU('product_b', 'unknown_product', PRODUCT_PERSONA_MAP).passed, false);
  const fixedNow = new Date('2026-09-24T12:00:00.000Z');
  const cadenceState = { ...ALL_SCENARIOS[0].initialState, nextScheduledTouch: '2026-09-25T00:00:00.000Z' };
  assert.match(checkSmartCooldown(cadenceState, getDefaultConfig(), fixedNow).reason, /12h/);
  const noChange = await batchSyncContacts([
    { contactId: 'test_contact', actionTaken: 'CONTINUE_JOURNEY', targetProduct: 'product_a' },
  ]);
  assert.equal(noChange.success, true);
  assert.equal(noChange.statusCode, 0);
  const deferredCampaignAction = await batchSyncContacts([
    { contactId: 'test_contact', actionTaken: 'SWITCH_ENROLL', targetProduct: 'product_a' },
  ]);
  assert.equal(deferredCampaignAction.success, false);
  assert.equal(deferredCampaignAction.requiresHumanReview, true);
  assert.equal(deferredCampaignAction.updatedCount, 0);
  console.log('PASS priority invariants: exit/escalate handoffs outrank fatigue; fatigue blocks campaign switch');

  const config = getDefaultConfig();
  const now = new Date();

  console.log('\n');
  console.log(`${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║   OneMetric — Dynamic Campaign Segmentation Engine — Test Suite            ║${RESET}`);
  console.log(`${BOLD}${CYAN}║   Pipeline: Scoring → FSM → Jev System One → HubSpot Sync                 ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${RESET}`);
  console.log();

  let passCount = 0;
  let failCount = 0;

  for (const scenario of ALL_SCENARIOS) {
    console.log(hr('═'));
    console.log(`${BOLD}${MAGENTA}  SCENARIO: ${scenario.name}${RESET}`);
    console.log(`${DIM}  ${scenario.description}${RESET}`);
    console.log(hr());

    // --- Step 1: Scoring ---
    console.log(`\n  ${BOLD}${CYAN}[1] SCORING ENGINE${RESET}`);

    const allEvents = [...scenario.initialState.events, ...scenario.incomingEvents];
    const allProductIds = [...new Set(allEvents.map(e => e.productId))];
    const currentProduct = scenario.initialState.contact.currentCampaign ?? '';
    if (!allProductIds.includes(currentProduct)) allProductIds.push(currentProduct);

    const scores: Record<string, number> = {};
    for (const pid of allProductIds) {
      scores[pid] = calculateCompositeScore(allEvents, pid, now, config);
      console.log(`      ${pid}: ${BOLD}${scores[pid]}${RESET}`);
    }

    const competingProducts = [...new Set(scenario.incomingEvents.map(e => e.productId))]
      .filter(p => p !== currentProduct);
    const competingProduct = competingProducts[0] ?? '';
    const currentScore = scores[currentProduct] ?? 0;
    const competingScore = scores[competingProduct] ?? 0;
    const delta = calculateDelta(competingScore, currentScore);

    console.log(`      ${DIM}Current: ${currentProduct} = ${currentScore}${RESET}`);
    console.log(`      ${DIM}Competing: ${competingProduct} = ${competingScore}${RESET}`);
    console.log(`      ${BOLD}Delta: ${delta}${RESET}`);

    // --- Step 1b: Dual Gate ---
    const dualGate = isDualGateSatisfied(competingScore, currentScore, config);
    console.log(`\n  ${BOLD}${CYAN}[2] DUAL-GATE CHECK (Fix 1)${RESET}`);
    console.log(`      Delta >= ${config.switchThreshold}? ${delta >= config.switchThreshold ? `${GREEN}YES${RESET}` : `${RED}NO${RESET}`} (${delta})`);
    console.log(`      Score >= ${config.absoluteMinIntent}? ${competingScore >= config.absoluteMinIntent ? `${GREEN}YES${RESET}` : `${RED}NO${RESET}`} (${competingScore})`);
    console.log(`      ${dualGate.satisfied ? `${GREEN}${BOLD}DUAL GATE: PASSED${RESET}` : `${YELLOW}${BOLD}DUAL GATE: BLOCKED${RESET}`}`);
    console.log(`      ${DIM}${dualGate.reason}${RESET}`);

    // --- Step 2: FSM ---
    console.log(`\n  ${BOLD}${CYAN}[3] FSM TRANSITION${RESET}`);
    const fsmResult = evaluateFSM(
      scenario.initialState,
      scenario.incomingEvents,
      scenario.productPersonaMap,
      config,
      now
    );

    console.log(`      ${colorState(fsmResult.previousState)} → ${colorState(fsmResult.newState)}`);
    console.log(`      Decision: ${colorDecision(fsmResult.decision)}`);
    console.log(`      Confidence: ${BOLD}${(fsmResult.confidence * 100).toFixed(0)}%${RESET}`);
    if (fsmResult.personaMismatch) {
      console.log(`      ${YELLOW}⚠ PERSONA MISMATCH DETECTED (Fix 2)${RESET}`);
    }
    if (fsmResult.crossBURequired) {
      console.log(`      ${YELLOW}⚠ CROSS-BU TRANSITION REQUIRED (Fix 3)${RESET}`);
    }
    if (fsmResult.holdNextTouch) {
      console.log(`      ${YELLOW}⚠ HOLD NEXT TOUCH (Fix 4)${RESET}`);
    }

    // Print guards
    console.log(`\n      ${DIM}Guards:${RESET}`);
    for (const guard of fsmResult.guards) {
      const icon = guard.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
      console.log(`        ${icon} ${guard.guardName}: ${DIM}${guard.reason.slice(0, 90)}${guard.reason.length > 90 ? '...' : ''}${RESET}`);
    }

    // --- Step 3: Jev Agent ---
    console.log(`\n  ${BOLD}${CYAN}[4] JEV SYSTEM ONE DECISION${RESET}`);
    const jevResult = await evaluateWithJev(
      scenario.initialState,
      scenario.incomingEvents,
      scenario.productPersonaMap,
      config,
      now
    );

    console.log(`      Engine: ${BOLD}${jevResult.engineUsed}${RESET}`);
    console.log(`      Latency: ${BOLD}${jevResult.latencyMs.toFixed(2)}ms${RESET}`);
    console.log(`      Decision: ${colorDecision(jevResult.decision)}`);

    const actionProbs = jevResult.response.choices.action.probabilities;
    console.log(`      Probabilities:`);
    for (const [action, prob] of Object.entries(actionProbs)) {
      const bar = '█'.repeat(Math.round(prob * 30));
      const barColor = action === jevResult.decision ? GREEN : DIM;
      console.log(`        ${action.padEnd(16)} ${barColor}${bar}${RESET} ${(prob * 100).toFixed(0)}%`);
    }

    const ic = jevResult.response.scores.intent_confidence;
    console.log(`      Intent Confidence: ${BOLD}${(ic.score * 100).toFixed(0)}%${RESET} (${ic.level})`);

    const fr = jevResult.response.nouls.flapping_risk;
    console.log(`      Flapping Risk: ${fr.noul > 0.5 ? RED : GREEN}${(fr.noul * 100).toFixed(0)}%${RESET}`);

    const pm = jevResult.response.nouls.persona_mismatch;
    console.log(`      Persona Mismatch: ${pm.noul > 0.5 ? RED : GREEN}${(pm.noul * 100).toFixed(0)}%${RESET}`);

    // --- Step 4: HubSpot Sync ---
    console.log(`\n  ${BOLD}${CYAN}[5] HUBSPOT SYNC PAYLOAD${RESET}`);

    const outcome: DecisionOutcome = {
      decisionId: `dec_${scenario.id}`,
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

    const syncPayload = buildHubSpotSyncPayload(scenario.initialState, outcome);

    console.log(`      Idempotency Key: ${DIM}${syncPayload.idempotencyKey.slice(0, 16)}...${RESET}`);
    console.log(`      Contact PATCH: ${Object.keys(syncPayload.contactPatch.properties).length} properties`);
    console.log(`      Intent Event: ${syncPayload.intentEvent.objectType}`);
    if (syncPayload.task) {
      console.log(`      ${RED}${BOLD}Escalation Task: "${syncPayload.task.properties.hs_task_subject}"${RESET}`);
    }

    // --- Verification ---
    console.log(`\n  ${BOLD}${CYAN}[6] VERIFICATION${RESET}`);
    const decisionMatch = fsmResult.decision === scenario.expectedDecision;
    const stateMatch = fsmResult.newState === scenario.expectedState;
    const overallPass = decisionMatch && stateMatch;

    console.log(`      Expected Decision: ${scenario.expectedDecision} — ${passFail(decisionMatch)}`);
    console.log(`      Expected State: ${scenario.expectedState} — ${passFail(stateMatch)}`);

    if (overallPass) {
      passCount++;
      console.log(`\n  ${BG_GREEN}${WHITE}${BOLD}  ✓ SCENARIO PASSED  ${RESET}`);
    } else {
      failCount++;
      console.log(`\n  ${BG_RED}${WHITE}${BOLD}  ✗ SCENARIO FAILED  ${RESET}`);
      if (!decisionMatch) {
        console.log(`    ${RED}Got decision: ${fsmResult.decision}, expected: ${scenario.expectedDecision}${RESET}`);
      }
      if (!stateMatch) {
        console.log(`    ${RED}Got state: ${fsmResult.newState}, expected: ${scenario.expectedState}${RESET}`);
      }
    }

    console.log(`\n  ${DIM}Reasoning: ${fsmResult.reasoning}${RESET}`);
    console.log();
  }

  // --- Summary ---
  console.log(hr('═'));
  console.log(`\n${BOLD}  TEST SUMMARY${RESET}`);
  console.log(hr());
  console.log(`  Total:   ${ALL_SCENARIOS.length}`);
  console.log(`  Passed:  ${GREEN}${BOLD}${passCount}${RESET}`);
  console.log(`  Failed:  ${failCount > 0 ? `${RED}${BOLD}${failCount}${RESET}` : `${GREEN}${BOLD}${failCount}${RESET}`}`);
  console.log();

  if (failCount === 0) {
    console.log(`${BG_GREEN}${WHITE}${BOLD}  ✓ ALL ${passCount} SCENARIOS PASSED — Engine verified  ${RESET}`);
  } else {
    console.log(`${BG_RED}${WHITE}${BOLD}  ✗ ${failCount} SCENARIO(S) FAILED — Review required  ${RESET}`);
  }

  console.log();
  console.log(`${DIM}  Fixes Verified:${RESET}`);
  console.log(`${DIM}    Fix 1: Zero-Baseline Dual-Gate Trap — Scenario 1${RESET}`);
  console.log(`${DIM}    Fix 2: Persona Relevance Filtering — Scenario 3${RESET}`);
  console.log(`${DIM}    Fix 3: Cross-BU Ownership Protocol — Guard checks in FSM${RESET}`);
  console.log(`${DIM}    Fix 4: Smart Cooldown Cadence — Hold-next-touch in FSM${RESET}`);
  console.log();

  process.exit(failCount > 0 ? 1 : 0);
}

// Run
runAllScenarios().catch(err => {
  console.error(`${RED}Fatal error: ${err}${RESET}`);
  process.exit(1);
});
