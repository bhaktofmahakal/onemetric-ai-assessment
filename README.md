# OneMetric: Dynamic Campaign Segmentation Engine & Autonomous RevOps Agent

A production-grade RevOps decision platform and autonomous AI agent designed for **Dynamic Campaign Segmentation across Multi-Business-Unit Enterprises**.

This system resolves the core go-to-market challenge: **distinguishing meaningful, high-intent buyer shifts from volatile, noisy signals**, preventing conflicting multi-BU messaging, eliminating prospect fatigue, and orchestrating multi-stakeholder buying committees without sales rep spam.

Live Production URL: **[https://onemetric-ai-assessment.vercel.app](https://onemetric-ai-assessment.vercel.app)**

---

## Table of Contents

1. [The RevOps Challenge & Solution Overview](#the-revops-challenge--solution-overview)
2. [End-to-End System Architecture (HLD)](#end-to-end-system-architecture-hld)
3. [Decision Engine & Guard Specifications (LLD)](#decision-engine--guard-specifications-lld)
   - [Time-Decayed Signal Scoring & Multi-Touch Weighting](#1-time-decayed-signal-scoring--multi-touch-weighting)
   - [Hysteresis Dual-Gate Threshold Verification](#2-hysteresis-dual-gate-threshold-verification)
   - [Deterministic Finite State Machine (FSM) Order of Precedence](#3-deterministic-finite-state-machine-fsm-order-of-precedence)
   - [Buying Committee Multi-Stakeholder Resolution](#4-buying-committee-multi-stakeholder-resolution)
4. [Autonomous Dual-Speed AI Agent Runtime](#autonomous-dual-speed-ai-agent-runtime)
   - [TypeSafe System One Next-Tool Selection](#typesafe-system-one-next-tool-selection)
   - [Gemini Structured Fallback Planner](#gemini-structured-fallback-planner)
   - [Closed Tool Contract & CRM Idempotency](#closed-tool-contract--crm-idempotency)
5. [Downstream Learning & Continuous Feedback Loop](#downstream-learning--continuous-feedback-loop)
6. [Interactive User Guide: How to Use the Platform](#interactive-user-guide-how-to-use-the-platform)
   - [1. Running Intent Simulation Scenarios](#step-1-running-intent-simulation-scenarios)
   - [2. Live Domain Buying Committee Evaluation](#step-2-live-domain-buying-committee-evaluation)
   - [3. Fast-Forwarding the 48h Hysteresis Cooldown](#step-3-fast-forwarding-the-48h-hysteresis-cooldown)
   - [4. Simulating Downstream Conversion Feedback](#step-4-simulating-downstream-conversion-feedback)
   - [5. Deep Analytical & Payload Inspection Tabs](#step-5-deep-analytical--payload-inspection-tabs)
7. [Integration Boundaries, Safeguards & Limitations](#integration-boundaries-safeguards--limitations)
8. [Local Development & Verification Commands](#local-development--verification-commands)

---

## The RevOps Challenge & Solution Overview

In modern B2B organizations, enterprise prospects are targeted by multiple business units (BUs) simultaneously:
- **Product A (CloudSecure)**: Enterprise Cloud Security Platform (`BU_Security`)
- **Product B (DataFlow)**: Streaming Analytics Suite (`BU_Analytics`)
- **Product C (FinanceOS)**: Core Financial ERP (`BU_Finance`)

When a prospect actively engaged in Product B suddenly registers third-party intent surges (e.g. from Bombora or G2) for Product A, traditional marketing automation faces a dilemma:
- **Continuing the current journey** delivers irrelevant messaging and wastes high-value pipeline intent.
- **Switching immediately** creates conflicting communication, flaps across journeys on temporary noise, and disrupts active sales negotiations.

**OneMetric resolves this with a three-layer architecture:**
1. **Mathematical Scoring Layer (`scoring.ts`)**: Time-decayed half-life weighting with dampening for passive visits and a multi-source corroboration requirement.
2. **Deterministic Governance Layer (`fsm.ts` & `multi-contact-evaluator.ts`)**: Finite state machine with strict precedence guards (fatigue limits, active deal escalation, persona relevance, cross-BU ownership, and a 48-hour hysteresis window).
3. **Autonomous Bounded Agent Runtime (`agent-runtime.ts`)**: Dual-speed planner leveraging **TypeSafe System One** for fast typed tool choices, with an automatic fallback to **Google Gemini** structured schema planning, executing idempotent CRM writes.

---

## End-to-End System Architecture (HLD)

![High-Level Design Architecture](diagrams/hld-architecture.svg)

```mermaid
flowchart TD
    subgraph SignalSources["1. INBOUND INTENT & CONVERSION SIGNALS"]
        Bombora["Bombora Surge (3rd-Party)"]
        G2["G2 Pricing & Review (2nd-Party)"]
        Direct["Direct Web & Demo (1st-Party)"]
        Downstream["Downstream Outcomes (Meeting / Win / Loss)"]
    end

    subgraph IngestionGate["2. INGESTION & SECURITY GATEWAY"]
        Webhook["POST /api/engine/webhook"]
        HMAC["Raw-Body HMAC-SHA256 Verification"]
        RedisDedupe["Redis Deduplication (90-Day Key Claims)"]
        RedisLock["Distributed Account Lock (SET NX EX)"]
    end

    subgraph StateAndMemory["3. DURABLE STATE & CRM RECONCILIATION"]
        HubSpotRead["HubSpot CRM REST API v3<br/>(Contacts, Company, Active Deals)"]
        RedisStore["Upstash Redis HTTPS Store<br/>(Recent 200 Events, Contact FSM States, Weights)"]
    end

    subgraph DecisionEngine["4. DETERMINISTIC REVOPS EVALUATION"]
        Decay["Time-Decayed Scoring (Half-Life: 14 Days)"]
        DualGate["Hysteresis Dual-Gate (Δ >= 25 & Floor >= 50)"]
        FSM["Deterministic FSM Guard Evaluation"]
        Committee["Multi-Contact Buying Committee Matcher"]
    end

    subgraph AgentRuntime["5. AUTONOMOUS DUAL-SPEED AI PLANNER"]
        TypeSafe["TypeSafe System One (jev-latest)<br/>Choice: next_tool"]
        GeminiFallback["Gemini Structured Fallback<br/>(Strict JSON Schema + Confidence Floor)"]
        ToolExecutor["Agent Runtime Execution Loop"]
    end

    subgraph DownstreamExecution["6. CRM WRITES & SALES ORCHESTRATION"]
        HubSpotBatch["HubSpot Batch Contact PATCH<br/>(/crm/v3/objects/contacts/batch/update)"]
        AETask["Consolidated AE Briefing Task<br/>(/crm/v3/objects/tasks)"]
        Briefing["Strategic Sales Memo Synthesis"]
        Learner["Bayesian & Heuristic Source Weight Recalibration"]
    end

    Bombora --> Webhook
    G2 --> Webhook
    Direct --> Webhook
    Downstream --> Webhook

    Webhook --> HMAC --> RedisDedupe --> RedisLock
    RedisLock --> HubSpotRead
    RedisLock --> RedisStore

    HubSpotRead --> Decay
    RedisStore --> Decay
    Decay --> DualGate --> FSM --> Committee

    Committee --> TypeSafe
    TypeSafe -.->|API Failure or Unconfigured| GeminiFallback
    TypeSafe --> ToolExecutor
    GeminiFallback --> ToolExecutor

    ToolExecutor --> HubSpotBatch
    ToolExecutor --> AETask
    ToolExecutor --> Briefing
    Downstream --> Learner --> RedisStore
```

---

## Decision Engine & Guard Specifications (LLD)

![Low-Level Component Architecture](diagrams/lld-components.svg)

### 1. Time-Decayed Signal Scoring & Multi-Touch Weighting

Signals do not retain value forever. `src/engine/scoring.ts` applies a continuous exponential decay function with a 14-day half-life:

$$\text{Contribution}_i = \text{rawScore}_i \times \text{weight}_i \times \exp\left(-\frac{\ln(2) \times \text{ageDays}_i}{14}\right)$$

#### Baseline Source Weights
| Signal Category | Default Weight | Reliability Justification |
|---|---|---|
| **1st-Party Direct** | `1.00` | Inbound demo requests, contact forms, pricing calculator submissions. |
| **1st-Party Passive** | `0.80` | Whitepaper downloads, technical documentation, API reference views. |
| **2nd-Party Reviews** | `0.70` | G2 product comparisons, TrustRadius pricing grid views. |
| **3rd-Party Intent** | `0.50` | Bombora topic surges, 6sense cluster activity (recalibrated by feedback loop). |
| **Firmographic Fit** | `0.30` | Industry alignment, employee growth, tech stack signals. |

#### Signal Dampening & Quality Constraints
- **Same-Day Passive Dampening**: Repeated visits to the same page by the same domain on the same UTC day are dampened:
  $$\text{Dampened Score} = \sum(\text{scores}) \times \frac{\ln(1 + n)}{n}$$
- **Multi-Source Corroboration Ceiling**: If intent for a product comes from fewer than 2 distinct source types, the total accumulated score is capped at **35 points**.
- **Signal Quality Cutoffs**: Signals older than 30 days, future-dated timestamps, or signals decaying below 10 points are discarded.

---

### 2. Hysteresis Dual-Gate Threshold Verification

To prevent the **Zero-Baseline Trap** (where a fresh prospect with 0 baseline points is flipped by an unverified 3rd-party spike of 30 points), the engine enforces two simultaneous mathematical gates:

```text
1. Relative Hysteresis Gap:  CompetingScore - CurrentScore >= 25.0 pts
2. Absolute Confidence Floor: CompetingScore >= 50.0 pts
```

Both gates must evaluate to `TRUE` for a prospect to leave `ACTIVE_CURRENT`. If relative gap passes but absolute floor fails, the engine enters `MONITORING` mode without disrupting communications.

---

### 3. Deterministic Finite State Machine (FSM) Order of Precedence

The FSM (`src/engine/fsm.ts`) is authoritative. Machine learning models and LLM planners **cannot bypass FSM transitions or safety guards**. Guards are evaluated in strict priority order:

![FSM State Transitions & Guard Hierarchy](diagrams/fsm-transitions.svg)

```mermaid
flowchart TD
    Start([Inbound Signal Evaluated]) --> GuardExit{1. Terminal EXITED or Unsubscribe?}
    GuardExit -- Yes --> StateExited[State: EXITED<br/>Action: Suppress All Outbound]
    GuardExit -- No --> GuardConflict{2. Multi-Product Conflict?<br/>Scores >= 70 on 2+ BUs}
    
    GuardConflict -- Yes --> StateEscalateConflict[State: ESCALATED<br/>Action: Stop Cadence + Create AE Task]
    GuardConflict -- No --> GuardDeal{3. Active Deal in Pipeline?<br/>Tier 1/2 Account + Deal Open}
    
    GuardDeal -- Yes --> DealGateCheck{Dual-Gate Passed?}
    DealGateCheck -- Yes --> StateEscalateDeal[State: ESCALATED<br/>Action: Strategic AE Handover]
    DealGateCheck -- No --> StateStay[Maintain Current State]
    
    GuardDeal -- No --> GuardFatigue{4. Contact Inbox Fatigue?<br/>Touches >= 2 in 7d OR Gap < 72h}
    GuardFatigue -- Yes --> StatePaused[State: PAUSED<br/>Action: Frequency Hold]
    GuardFatigue -- No --> GuardPersona{5. Buyer Persona Match?<br/>Contact Role matches Product}
    
    GuardPersona -- No --> StatePersonaBlock[State: ACTIVE_CURRENT<br/>Action: Block Switch + Log Mismatch]
    GuardPersona -- Yes --> GuardDualGate{6. Dual-Gate Passed?<br/>Δ >= 25 & Score >= 50}
    
    GuardDualGate -- No --> GuardMonitoring{Δ >= 15?}
    GuardMonitoring -- Yes --> StateMonitoring[State: MONITORING<br/>Action: Heightened Logging]
    GuardMonitoring -- No --> StateActive[State: ACTIVE_CURRENT<br/>Action: Continue Standard Cadence]
    
    GuardDualGate -- Yes --> GuardCooldown{7. In 48h Cooldown Window?}
    GuardCooldown -- Fresh Shift --> StateCooldown[State: EVALUATION_COOLDOWN<br/>Action: 48h Hysteresis Hold]
    GuardCooldown -- 48h Elapsed --> GuardCrossBU{Cross-BU Boundary?}
    
    GuardCrossBU -- Cross-BU --> StateEscalateBU[State: ESCALATED<br/>Action: AE Multi-BU Review]
    GuardCrossBU -- Same BU --> StateSwitch[State: SWITCHING<br/>Action: Batch CRM Property Update]
```

---

### 4. Buying Committee Multi-Stakeholder Resolution

Intent signals arrive at the **Account Domain level** (e.g. `techcorp.com`, `snowflake.com`, `stripe.com`), but campaign touches target **individual human stakeholders**.

`src/engine/multi-contact-evaluator.ts` reads the complete buying committee and resolves concurrent journeys concurrently:
1. **VP of Engineering / Security**: Routes to **CloudSecure** (`product_a`).
2. **Head of Data / Data Platform Lead**: Routes to **DataFlow** (`product_b`).
3. **CFO / VP of Finance**: Routes to **FinanceOS** (`product_c`).
4. **Account Executive Escalation**: If multiple committee members show cross-product surges or an active deal exists, the agent generates **one single consolidated AE task** associated with all contacts, preventing sales rep collision.

---

## Autonomous Dual-Speed AI Agent Runtime

![Sequential Read-Decide-Write Integration](diagrams/sequence-integration.svg)

The agent runtime (`src/engine/agent-runtime.ts`) follows a bounded, deterministic-first cycle:
1. Observes account state and historical intent events from Upstash Redis.
2. Executes pure FSM transition and computes valid available tools.
3. Requests next-tool execution from the planner.
4. Executes the chosen tool against CRM REST endpoints.
5. Loops until the terminal `complete` tool is selected or human escalation occurs.

### TypeSafe System One Next-Tool Selection
- Calls `POST https://api.typesafe.ai/v1/systemone` using model `jev-latest`.
- Supplies available tools as an enumerated `Choice` question with strict transition criteria.
- Validates returned confidence; if confidence falls below `0.65`, human review is triggered automatically.

### Gemini Structured Fallback Planner
If TypeSafe is unconfigured, times out, or encounters rate limits (HTTP 429/503), the engine seamlessly hands off execution to **Google Gemini** (`src/engine/gemini-agent.ts`):
- Uses strict JSON schema enforcement:
  ```json
  {
    "type": "OBJECT",
    "properties": {
      "tool": { "type": "STRING", "enum": ["sync_contacts", "create_ae_task", "request_human_review", "complete"] },
      "confidence": { "type": "NUMBER" },
      "reasoning": { "type": "STRING" }
    },
    "required": ["tool", "confidence", "reasoning"]
  }
  ```
- Tries configured model (`gemini-3.5-flash`), configured fallback (`gemini-flash-lite-latest`), and stable production endpoints without infinite loops.

### Closed Tool Contract & CRM Idempotency
| Tool Name | Preconditions | Side Effect |
|---|---|---|
| `sync_contacts` | Contact properties need updating | Executes `/crm/v3/objects/contacts/batch/update` with idempotency key. |
| `create_ae_task` | Account escalated or multi-BU conflict | Executes `/crm/v3/objects/tasks` with consolidated markdown briefing. |
| `request_human_review` | Low model confidence (< 0.65) or FSM conflict | Creates review task in HubSpot and marks account for human intervention. |
| `complete` | Required CRM writes succeeded | Terminal tool; closes session and writes final audit journal. |

---

## Downstream Learning & Continuous Feedback Loop

![Downstream Learning & Continuous Feedback Loop](diagrams/feedback-loop.svg)

The platform includes a real-time closed-loop learning mechanism (`POST /api/engine/feedback`):
- Accepts server-to-server HMAC-SHA256 signed outcome events.
- Calibrates 3rd-party source weights dynamically based on business outcomes:

| Outcome Event | Weight Adjustment ($\Delta$) | Business Rationale |
|---|---|---|
| **Meeting Booked** | `+0.08` | Strong positive signal corroboration; intent converted to pipeline. |
| **Email Reply** | `+0.05` | Positive engagement; recipient found messaging relevant. |
| **Deal Closed-Won** | `+0.08` | Definitive revenue proof of campaign attribution. |
| **Deal Lost (Timing)** | `-0.05` | Indicates potential false-positive intent surge. |
| **Unsubscribed** | `-0.08` | Severe negative feedback; signal misread prospect context. |

All weights are bounded within `[0.10, 1.00]` and immediately affect future scoring calculations for that domain.

---

## Interactive User Guide: How to Use the Platform

The interactive dashboard at **[https://onemetric-ai-assessment.vercel.app](https://onemetric-ai-assessment.vercel.app)** allows full observability and testing of all decision engine mechanics.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ONEMETRIC REVOPS ENGINE                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ [Header] Reset Engine | Guide | Engine Status (TypeSafe + Gemini Fallback) | Latency   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ [Top Evaluator Bar]                                                                     │
│  Domain Input: [ techcorp.com ]  [ Evaluate Committee ]                                │
│  Quick 1-Click: [Evaluate techcorp.com] [Evaluate snowflake.com] [Advance 48h (Cron)]  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ [Learning Loop Bar]                                                                     │
│  Live Bombora Weight: 0.58  | Downstream Feedback: [+ Meeting] [+ Reply] [- Lost]      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ [3-Column Simulation Grid]                                                              │
│  1. Prospect & Account Profile   2. Finite State Visualizer   3. Intent Scenarios       │
│     (Tier, BU, Active Score)        (Live 6-Node Graph)          (Scenarios 1, 2, 3, 4) │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ [Deep Tabbed Inspector]                                                                 │
│  [Decision & Guards] [Buying Committee] [Sales Briefing] [CRM Payloads] [Audit Log]   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Running Intent Simulation Scenarios
Located in the right column of the upper grid:
1. **Scenario 1 (Uncorroborated Surge)**:
   - Click to test the Zero-Baseline Trap.
   - *Result*: Competing score rises to 35, relative gap is 35, but absolute floor (< 50) holds campaign in `ACTIVE_CURRENT`.
2. **Scenario 2 (Corroborated Buying Intent)**:
   - Click to test multi-touch corroborated intent.
   - *Result*: Signal passes dual-gate; FSM enters `EVALUATION_COOLDOWN` (48-hour hold).
3. **Scenario 3 (Cross-Department Inquiry / Persona Mismatch)**:
   - Click to test a Finance ERP surge on an Engineering leader.
   - *Result*: Blocked by **Buyer Persona Guard**; prevents embarrassing irrelevant outreach.
4. **Scenario 4 (Enterprise Multi-Product Deal Conflict)**:
   - Click to test enterprise conflict on a $120K open pipeline deal.
   - *Result*: Automated switching halted; status transitions to `ESCALATED`; activates Sales Executive Briefing tab.

### Step 2: Live Domain Buying Committee Evaluation
In the top bar, enter any domain (or click one of the quick buttons: `Evaluate techcorp.com`, `Evaluate snowflake.com`, `Evaluate stripe.com`):
- The button activates an immediate **running shimmer and spinner**.
- Evaluates all committee stakeholders concurrently against HubSpot schema.
- Switches the deep inspector to the **Buying Committee Resolution** tab, rendering individual contact cards and consolidated AE task outputs.

### Step 3: Fast-Forwarding the 48h Hysteresis Cooldown
When an account enters `EVALUATION_COOLDOWN`:
- Click **Advance 48h Cooldown (Cron)** in the top bar or inside the Scenario panel.
- The button shows `Advancing 48h...` with spinning activity.
- The engine re-evaluates decayed signals: persistent signals graduate to `SWITCHING` or `ESCALATED`, while transient noise reverts to `ACTIVE_CURRENT`.

### Step 4: Simulating Downstream Conversion Feedback
In the **Source Weight Snapshot & Outcome Ingestion** section:
- Click **+ Meeting Booked (+0.08)** or **+ Email Reply (+0.05)**.
- Button displays an animated spinner with `Recalibrating (+0.08)...` and a glowing shimmer.
- The 3rd-Party Intent (Bombora) weight indicator updates dynamically (e.g. from `0.50` to `0.58`).
- A confirmation banner details the exact Bayesian weight adjustment.

### Step 5: Deep Analytical & Payload Inspection Tabs
- **Decision & Guard Analysis**: Full mathematical breakdown of relative delta, absolute floor, fatigue counters, and raw FSM guard checks.
- **Buying Committee Resolution**: Live view of all evaluated stakeholders, assigned actions, and digital footprint corroboration.
- **Sales Executive Briefing**: AI-generated strategic memo containing commercial risk assessments, cross-BU positioning strategies, and AE discovery checklists.
- **HubSpot CRM Sync Payloads**: Complete, syntax-highlighted, copyable REST API v3 payloads for Contact PATCH, Batch Updates, and Task Creation.
- **System Audit Ledger**: Immutable chronological ledger tracking event IDs, decisions, state transitions, and sub-millisecond execution latencies.

---

## Integration Boundaries, Safeguards & Limitations

| Integration Point | Implementation Status | Safety Safeguards Enforced |
|---|---|---|
| **HubSpot Contacts API** | Live REST v3 batch updates | Custom property validation (`current_campaign`, `touch_count_7d`). Fails closed on missing counters. |
| **HubSpot Tasks API** | Live REST v3 creation | Creates exactly one consolidated AE briefing task per account escalation; eliminates duplicate rep spam. |
| **HubSpot Sequences API** | Evaluated (UI-only scope) | Sequences API requires user-level OAuth seats. The engine marks campaigns in CRM but delegates automated sending to verified workflows. |
| **Upstash Redis Storage** | Live HTTPS REST | 90-day deduplication claims, distributed lock serialization (`SET NX EX`), and persistent event history. |
| **TypeSafe System One** | Live REST API | Evaluated against `jev-latest`. Automated fallback to Gemini on timeout, rate limit, or failure. |
| **Google Gemini API** | Live REST API | Structured JSON schema output fallback with 0.65 confidence safety threshold. |

---

## Local Development & Verification Commands

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Execute strict TypeScript typecheck
npm run typecheck

# 4. Run deterministic RevOps engine scenario CLI tests
npm run test:engine

# 5. Build production Next.js bundle
npm run build
```

---

## Authors & Architectural Record

Built by the OneMetric RevOps Engineering Team. For architectural invariants, FSM transition tables, and strict change boundaries, consult [`AGENTS.md`](AGENTS.md).
