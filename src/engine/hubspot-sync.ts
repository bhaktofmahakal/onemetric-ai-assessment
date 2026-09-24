// ============================================================================
// OneMetric Campaign Segmentation Engine — HubSpot CRM Sync Layer
// ============================================================================
// Generates schema-valid HubSpot REST API v3 payloads:
//   - Contact PATCH (property updates)
//   - Custom Object POST (p_intent_events)
//   - Task POST (escalation tasks)
//   - SHA-256 idempotency keys
//
// Zero external dependencies — uses native Node.js crypto.
// ============================================================================

import { createHash } from 'node:crypto';
import type {
  ProspectState,
  DecisionOutcome,
  HubSpotSyncPayload,
  HubSpotContactPatch,
  HubSpotCustomObject,
  HubSpotTaskCreate,
  FSMState,
} from '../types/index.js';

const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// ---------------------------------------------------------------------------
// Idempotency Key Generation (SHA-256)
// ---------------------------------------------------------------------------
// Hash: accountId + eventType + timestamp_hour
// Prevents duplicate webhook write-backs to HubSpot
// ---------------------------------------------------------------------------

export function generateIdempotencyKey(
  accountId: string,
  eventType: string,
  timestamp: string
): string {
  const date = new Date(timestamp);
  // Round to the hour for deduplication window
  const hourKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCHours()}`;
  const input = `${accountId}:${eventType}:${hourKey}`;
  return createHash('sha256').update(input).digest('hex');
}

// ---------------------------------------------------------------------------
// Contact Property PATCH Payload
// ---------------------------------------------------------------------------

function buildContactPatch(
  state: ProspectState,
  outcome: DecisionOutcome
): HubSpotContactPatch {
  const properties: Record<string, string | number | boolean> = {
    // Core intent properties
    active_intent_product: determineActiveProduct(state, outcome),
    current_campaign: outcome.newState === 'PAUSED' ? `paused_${determineActiveProduct(state, outcome)}` : determineActiveProduct(state, outcome),
    touch_count_7d: state.contact.touchCount7d ?? 0,
    campaign_state: outcome.newState.toLowerCase(),
    intent_shift_detected: outcome.newState === 'MONITORING' || outcome.newState === 'EVALUATION_COOLDOWN',

    // Per-product scores
    ...Object.entries(outcome.scores).reduce((acc, [productId, score]) => {
      acc[`intent_score_${productId.replace(/[^a-z0-9]/g, '_')}`] = score;
      return acc;
    }, {} as Record<string, number>),

    // Decision metadata
    last_decision: outcome.decision,
    last_decision_reasoning: truncate(outcome.reasoning, 500),
    last_decision_timestamp: outcome.timestamp,
    last_intent_score: Math.max(...Object.values(outcome.scores)),

    // Fix 2: Persona mismatch flag
    ...(outcome.personaMismatch ? {
      persona_mismatch_detected: true,
      account_expansion_recommended: true,
    } : {}),

    // Fix 3: Cross-BU status
    ...(outcome.crossBUNotification ? {
      cross_bu_transition_pending: true,
      cross_bu_status: 'objection_window',
    } : {}),
  };

  return {
    objectId: state.contact.contactId,
    properties,
  };
}

function determineActiveProduct(
  state: ProspectState,
  outcome: DecisionOutcome
): string {
  if (outcome.decision === 'switch' && outcome.newState === 'SWITCHING') {
    // Find the product we're switching to (highest competing score)
    const currentProduct = state.contact.currentCampaign ?? '';
    const competing = Object.entries(outcome.scores)
      .filter(([pid]) => pid !== currentProduct)
      .sort(([, a], [, b]) => b - a);
    return competing[0]?.[0] ?? currentProduct;
  }
  return state.contact.currentCampaign ?? '';
}

// ---------------------------------------------------------------------------
// Custom Object: p_intent_events
// ---------------------------------------------------------------------------

function buildIntentEvent(
  state: ProspectState,
  outcome: DecisionOutcome
): HubSpotCustomObject {
  return {
    objectType: 'p_intent_events',
    properties: {
      event_id: outcome.decisionId,
      event_type: mapDecisionToEventType(outcome),
      source: 'campaign_segmentation_engine',
      product_id: determineActiveProduct(state, outcome),
      decision: outcome.decision,
      previous_state: outcome.previousState,
      new_state: outcome.newState,
      confidence: outcome.confidence,
      reasoning: truncate(outcome.reasoning, 1000),
      delta: outcome.delta,
      scores_json: JSON.stringify(outcome.scores),
      guards_json: JSON.stringify(outcome.guards.map(g => ({
        name: g.guardName,
        passed: g.passed,
        reason: g.reason,
      }))),
      engine_used: outcome.engineUsed,
      latency_ms: outcome.latencyMs,
      timestamp: outcome.timestamp,
    },
    associations: [
      {
        to: { id: state.contact.contactId },
        types: [{ associationCategory: 'USER_DEFINED', associationTypeId: 1 }],
      },
      {
        to: { id: state.account.accountId },
        types: [{ associationCategory: 'USER_DEFINED', associationTypeId: 2 }],
      },
    ],
  };
}

function mapDecisionToEventType(outcome: DecisionOutcome): string {
  if (outcome.previousState !== outcome.newState) return 'state_change';
  if (outcome.decision === 'escalate') return 'escalation';
  return 'evaluation';
}

// ---------------------------------------------------------------------------
// Task Creation (Escalation Only)
// ---------------------------------------------------------------------------

function buildEscalationTask(
  state: ProspectState,
  outcome: DecisionOutcome
): HubSpotTaskCreate {
  const escalationReasons: string[] = [];
  for (const guard of outcome.guards) {
    if (!guard.passed) {
      escalationReasons.push(guard.reason);
    }
  }

  const scoresSummary = Object.entries(outcome.scores)
    .map(([pid, score]) => `${pid}: ${score}`)
    .join(', ');

  return {
    properties: {
      hs_task_subject: `Intent Conflict Review — ${state.account.name}`,
      hs_task_body: [
        `ACCOUNT: ${state.account.name} (${state.account.industry}, Tier ${state.account.tier})`,
        `CONTACT: ${state.contact.firstName} ${state.contact.lastName} (${state.contact.jobTitle})`,
        `CURRENT CAMPAIGN: ${state.contact.currentCampaign}`,
        ``,
        `INTENT SCORES: ${scoresSummary}`,
        `DELTA: ${outcome.delta}`,
        ``,
        `ESCALATION REASON:`,
        ...escalationReasons.map(r => `  • ${r}`),
        ``,
        `ENGINE RECOMMENDATION: ${outcome.reasoning}`,
        ``,
        `ACTIONS:`,
        `  → Approve campaign switch`,
        `  → Reject (keep current campaign)`,
        `  → Custom routing decision`,
      ].join('\n'),
      hs_task_priority: 'HIGH',
      hs_task_status: 'NOT_STARTED',
      hs_timestamp: outcome.timestamp,
    },
    associations: [
      {
        to: { id: state.contact.contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }],
      },
      {
        to: { id: state.account.accountId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 192 }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Main: Build Complete Sync Payload
// ---------------------------------------------------------------------------

export function buildHubSpotSyncPayload(
  state: ProspectState,
  outcome: DecisionOutcome
): HubSpotSyncPayload {
  const idempotencyKey = generateIdempotencyKey(
    state.account.accountId,
    outcome.decision,
    outcome.timestamp
  );

  const payload: HubSpotSyncPayload = {
    contactPatch: buildContactPatch(state, outcome),
    intentEvent: buildIntentEvent(state, outcome),
    idempotencyKey,
  };

  // Only create task for escalations
  if (outcome.decision === 'escalate' || outcome.newState === 'ESCALATED') {
    payload.task = buildEscalationTask(state, outcome);
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// ---------------------------------------------------------------------------
// Disabled Legacy Sync Adapter
// ---------------------------------------------------------------------------

export interface SyncResult {
  success: boolean;
  dryRun: boolean;
  statusCode: number;
  hubspotObjectId?: string;
  endpointUsed?: string;
  message?: string;
  payload: HubSpotSyncPayload;
  apiResponses?: Record<string, unknown>;
  error?: string;
  operationStatus?: {
    contactPatch: 'succeeded' | 'failed';
    intentEvent: 'succeeded' | 'failed' | 'replaced_by_note';
    escalationTask: 'succeeded' | 'failed' | 'not_required';
  };
}

export async function syncToHubSpot(
  payload: HubSpotSyncPayload,
  _accessTokenOverride?: string
): Promise<SyncResult> {
  return {
    success: false,
    dryRun: true,
    statusCode: 501,
    message: 'Legacy single-contact sync is disabled; no HubSpot request was made.',
    error: 'Use the durable agent path; this legacy function cannot verify campaign execution.',
    operationStatus: { contactPatch: 'failed', intentEvent: 'failed', escalationTask: payload.task ? 'failed' : 'not_required' },
    payload,
  };
}

// ============================================================================
// Campaign Disposition Gate
// ============================================================================

export interface BatchSyncResult {
  success: boolean;
  statusCode: number;
  updatedCount: number;
  endpointUsed: string;
  contactIds: string[];
  error?: string;
  message?: string;
  requiresHumanReview?: boolean;
}

export interface ConsolidatedTaskResult {
  success: boolean;
  statusCode: number;
  taskId?: string;
  associatedContacts: string[];
  endpointUsed: string;
  error?: string;
}

/**
 * Prevents campaign state from being faked through a CRM property update.
 */
/**
 * Refuses to simulate campaign operations as CRM property updates.
 * A real sequence/workflow adapter is required before changing campaign state.
 */
export async function batchSyncContacts(
  outcomes: Array<{ contactId: string; actionTaken: string; targetProduct: string }>,
  _tokenOverride?: string
): Promise<BatchSyncResult> {
  const endpointUsed = 'no contact update performed';
  if (outcomes.length === 0) {
    return {
      success: false, statusCode: 422, updatedCount: 0, endpointUsed, contactIds: [],
      error: 'No HubSpot contacts were found for this account event.', requiresHumanReview: true,
    };
  }
  if (outcomes.some((outcome) => outcome.actionTaken !== 'CONTINUE_JOURNEY')) {
    return {
      success: false, statusCode: 501, updatedCount: 0, endpointUsed, contactIds: [],
      error: 'Campaign enrollment, pause, unenrollment, and suppression are not connected. No campaign marker was written to HubSpot.',
      requiresHumanReview: true,
    };
  }
  return {
    success: true, statusCode: 0, updatedCount: 0, endpointUsed, contactIds: [],
    message: 'No contact disposition changed; no HubSpot write was required or attempted.',
  };
}

/**
 * Creates a single consolidated AE Briefing Task associated with the Company and contacts
 * Endpoint: POST /crm/v3/objects/tasks
 */
export async function createConsolidatedAETask(
  params: {
    domain: string;
    accountId?: string;
    accountName: string;
    dealAmount?: number;
    outcomes: Array<{ name: string; role: string; actionTaken: string; actionSummary: string; contactId: string }>;
    briefing?: { commercialRisk: string; crossSolutionStrategy: string; actionChecklist: string[] } | null;
  },
  tokenOverride?: string
): Promise<ConsolidatedTaskResult> {
  const token = tokenOverride || (typeof process !== 'undefined' ? process.env?.HUBSPOT_ACCESS_TOKEN : undefined);
  const baseUrl = HUBSPOT_BASE_URL;
  const endpointUsed = '/crm/v3/objects/tasks';
  const dealFormatted = typeof params.dealAmount === 'number' && params.dealAmount > 0
    ? `$${(params.dealAmount / 1000).toFixed(0)}K`
    : 'No active deal';

  const committeeSummary = params.outcomes
    .map((o) => `• ${o.name} (${o.role}): [${o.actionTaken}] — ${o.actionSummary}`)
    .join('\n');

  const strategySummary = params.briefing
    ? `\n\nCOMMERCIAL RISK:\n${params.briefing.commercialRisk}\n\nCROSS-SOLUTION STRATEGY:\n${params.briefing.crossSolutionStrategy}\n\nAE ACTION CHECKLIST:\n${params.briefing.actionChecklist.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : '';

  const taskBody = `[ONEMETRIC REVOPS AUTONOMOUS AGENT]\nAccount: ${params.accountName} (${params.domain})\nPipeline Deal: ${dealFormatted}\n\nBUYING COMMITTEE RESOLUTION:\n${committeeSummary}${strategySummary}`;

  if (!token || token.includes('your_hubspot_access_token')) {
    console.warn('[HubSpotBatch] Consolidated task not attempted: HUBSPOT_ACCESS_TOKEN is missing or invalid.');
    return {
      success: false,
      statusCode: 503,
      associatedContacts: [],
      endpointUsed,
      error: 'CRM credentials are not configured.',
    };
  }

  try {
    console.log(`[HubSpotBatch] Creating single consolidated AE task for ${params.accountName}...`);
    const res = await fetch(`${baseUrl}${endpointUsed}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          hs_task_subject: `[RevOps Alert] Buying Committee Intent Escalation — ${params.accountName} (${dealFormatted})`,
          hs_task_body: taskBody,
          hs_task_priority: 'HIGH',
          hs_task_status: 'NOT_STARTED',
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          ...params.outcomes.map((outcome) => ({
            to: { id: outcome.contactId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED' as const, associationTypeId: 204 }],
          })),
          ...(params.accountId ? [{
            to: { id: params.accountId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED' as const, associationTypeId: 192 }],
          }] : []),
        ],
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (!data?.id) {
        return {
          success: false,
          statusCode: 502,
          associatedContacts: [],
          endpointUsed,
          error: 'HubSpot returned a successful HTTP status without a task ID.',
        };
      }
      console.log(`[HubSpotBatch] Consolidated AE task created: ${data.id}`);
      return {
        success: true,
        statusCode: res.status,
        ...(data?.id ? { taskId: `task_${data.id}` } : {}),
        associatedContacts: params.outcomes.map((o) => o.contactId),
        endpointUsed,
      };
    } else {
      console.warn(`[HubSpotBatch] Consolidated task returned HTTP ${res.status}.`);
      return {
        success: false,
        statusCode: res.status,
        associatedContacts: [],
        endpointUsed,
        error: `HubSpot task creation failed with HTTP ${res.status}`,
      };
    }
  } catch (err: any) {
    console.warn(`[HubSpotBatch] Consolidated task creation failed: ${err.message}`);
    return {
      success: false,
      statusCode: 502,
      associatedContacts: [],
      endpointUsed,
      error: `HubSpot task creation failed: ${err.message}`,
    };
  }
}
