// ============================================================================
// OneMetric Campaign Segmentation Engine — Core Type Definitions
// ============================================================================

// ---------------------------------------------------------------------------
// Enums & Literal Types
// ---------------------------------------------------------------------------

export type SourceType =
  | '1st_party_direct'
  | '1st_party_passive'
  | '2nd_party'
  | '3rd_party'
  | 'firmographic';

export type SignalQuality = 'strong' | 'moderate' | 'weak' | 'noise';

export type FSMState =
  | 'ACTIVE_CURRENT'
  | 'MONITORING'
  | 'EVALUATION_COOLDOWN'
  | 'SWITCHING'
  | 'ESCALATED'
  | 'PAUSED'
  | 'EXITED';

export type Decision = 'continue' | 'pause_cooldown' | 'switch' | 'escalate' | 'exit';

export type FeedbackEventType =
  | 'email_open'
  | 'email_reply'
  | 'meeting_booked'
  | 'deal_won'
  | 'deal_lost'
  | 'unsubscribed';

export interface FeedbackEvent {
  feedbackId?: string;
  eventType: FeedbackEventType;
  sourceType: SourceType;
  productId: string;
  contactId?: string;
  domain?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface FeedbackRecalibrationResult {
  success: boolean;
  eventType: FeedbackEventType;
  sourceType: SourceType;
  previousWeight: number;
  newWeight: number;
  delta: number;
  recalibratedAt: string;
}

// ---------------------------------------------------------------------------
// Domain Entities
// ---------------------------------------------------------------------------

export interface Deal {
  dealId: string;
  dealStage: string;
  amount: number;
  owner: string;
  productId?: string;
}

export interface Account {
  accountId: string;
  domain: string;
  name: string;
  industry: string;
  tier: 1 | 2 | 3;
  ownerBU: string;
  activeDeals: Deal[];
}

export interface Contact {
  contactId: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  persona: string; // e.g. "engineering", "finance", "security", "devops", "marketing"
  accountId: string;
  currentCampaign: string | null; // productId currently enrolled
  enrollmentDate: string | null;  // ISO datetime
  lastTouchDate: string | null;   // ISO datetime
  touchCount7d: number;
}

export interface IntentEvent {
  eventId: string;
  accountId: string;
  contactId?: string;
  productId: string;
  source: string;         // e.g. "bombora", "g2", "website", "clearbit"
  sourceType: SourceType;
  rawScore: number;        // 0–100 from the provider
  timestamp: string;       // ISO datetime
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Product ↔ Persona Mapping (Fix 2: Persona Relevance)
// ---------------------------------------------------------------------------

export interface ProductPersonaMap {
  productId: string;
  productName: string;
  relevantPersonas: string[];  // personas that would buy this product
  ownerBU: string;             // which business unit owns this product
}

// ---------------------------------------------------------------------------
// Scoring Configuration
// ---------------------------------------------------------------------------

export interface ScoringConfig {
  halfLifeDays: number;
  switchThreshold: number;       // delta must exceed this (default 25)
  absoluteMinIntent: number;     // Fix 1: competing score must exceed this (default 50)
  cooldownHours: number;         // hysteresis period (default 48)
  highIntentThreshold: number;   // score above this = "high intent" (default 70)
  conflictThreshold: number;     // multi-product conflict threshold (default 70)
  minSignalScore: number;        // weighted scores below this = noise (default 10)
  maxSignalAgeDays: number;      // signals older than this excluded (default 30)
  fatigueMaxTouches: number;     // max touches per window (default 2)
  fatigueWindowDays: number;     // rolling window for fatigue (default 7)
  minimumTouchSpacingHours: number;
  crossBUObjectionWindowHours: number; // Fix 3: BU objection window (default 24)
  holdNextTouchHours: number;    // Fix 4: hold buffer instead of hard pause (default 24)
  sourceWeights: Record<SourceType, number>;
}

// ---------------------------------------------------------------------------
// Guard Results
// ---------------------------------------------------------------------------

export interface GuardResult {
  guardName: string;
  passed: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Cross-BU Transition Protocol (Fix 3)
// ---------------------------------------------------------------------------

export interface CrossBUTransition {
  fromBU: string;
  toBU: string;
  contactId: string;
  notifiedAt: string;
  objectionWindowExpiresAt: string;
  status: 'pending_notification' | 'objection_window' | 'approved' | 'objected';
}

// ---------------------------------------------------------------------------
// Prospect State (Full Context)
// ---------------------------------------------------------------------------

export interface ProspectState {
  account: Account;
  contact: Contact;
  scores: Record<string, number>;  // productId → composite score
  fsmState: FSMState;
  previousState: FSMState | null;
  stateEnteredAt: string;          // ISO datetime
  cooldownStartedAt: string | null;
  events: IntentEvent[];
  decisionHistory: DecisionOutcome[];
  crossBUTransition: CrossBUTransition | null;
  nextScheduledTouch: string | null; // Fix 4: ISO datetime of next scheduled email
}

// ---------------------------------------------------------------------------
// Decision Outcome
// ---------------------------------------------------------------------------

export interface DecisionOutcome {
  decisionId: string;
  timestamp: string;
  previousState: FSMState;
  newState: FSMState;
  decision: Decision;
  confidence: number;
  reasoning: string;
  scores: Record<string, number>;
  delta: number;
  guards: GuardResult[];
  engineUsed: 'jev_live' | 'jev_calibrated_fallback' | 'deterministic_fsm';
  latencyMs: number;
  personaMismatch?: boolean;     // Fix 2
  crossBUNotification?: boolean; // Fix 3
  holdNextTouch?: boolean;       // Fix 4
}

// ---------------------------------------------------------------------------
// Jev API Types (TypeSafe AI — System One)
// ---------------------------------------------------------------------------

export interface JevQuestion {
  type: 'choice' | 'score' | 'noul';
  criteria: Record<string, string | null> | string[];
  instructions: string;
}

export interface JevRequest {
  model: string;
  state: Record<string, unknown> | string;
  questions: Record<string, JevQuestion>;
}

export interface JevChoiceResult {
  selection: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface JevScoreResult {
  score: number;
  level: string;
  confidence: number;
}

export interface JevNoulResult {
  noul: number; // 0.0–1.0 probability
}

export interface JevResponse {
  choices: Record<string, JevChoiceResult>;
  scores: Record<string, JevScoreResult>;
  nouls: Record<string, JevNoulResult>;
}

export interface JevDecision {
  decision: Decision;
  response: JevResponse;
  latencyMs: number;
  engineUsed: 'jev_live' | 'jev_calibrated_fallback';
}

// ---------------------------------------------------------------------------
// HubSpot Sync Types
// ---------------------------------------------------------------------------

export interface HubSpotContactPatch {
  objectId: string;
  properties: Record<string, string | number | boolean>;
}

export interface HubSpotCustomObject {
  objectType: string;
  properties: Record<string, string | number>;
  associations?: Array<{
    to: { id: string };
    types: Array<{ associationCategory: string; associationTypeId: number }>;
  }>;
}

export interface HubSpotTaskCreate {
  properties: {
    hs_task_subject: string;
    hs_task_body: string;
    hs_task_priority: 'HIGH' | 'MEDIUM' | 'LOW';
    hs_task_status: 'NOT_STARTED';
    hs_timestamp: string;
  };
  associations: Array<{
    to: { id: string };
    types: Array<{ associationCategory: string; associationTypeId: number }>;
  }>;
}

export interface HubSpotSyncPayload {
  contactPatch: HubSpotContactPatch;
  intentEvent: HubSpotCustomObject;
  idempotencyKey: string;
  task?: HubSpotTaskCreate; // only for escalations
}

// ---------------------------------------------------------------------------
// Scenario Definition (for testing & demo)
// ---------------------------------------------------------------------------

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  initialState: ProspectState;
  incomingEvents: IntentEvent[];
  productPersonaMap: ProductPersonaMap[];
  expectedDecision: Decision;
  expectedState: FSMState;
  expectedReasoning: string;
}

// ---------------------------------------------------------------------------
// Gemini 3.7 Executive Briefing
// ---------------------------------------------------------------------------

export interface ExecutiveBriefing {
  commercialRisk: string;
  crossSolutionStrategy: string;
  actionChecklist: string[];
  latencyMs: number;
  engine: string;
  isLive: boolean;
  modelUsed: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Live HubSpot Sync Result
// ---------------------------------------------------------------------------

export interface LiveSyncResult {
  success: boolean;
  dryRun: boolean;
  statusCode: number;
  hubspotObjectId?: string;
  endpointUsed?: string;
  message?: string;
  apiResponses?: Record<string, unknown>;
  error?: string;
}
