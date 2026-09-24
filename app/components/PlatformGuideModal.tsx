'use client';

import React from 'react';
import {
  HelpCircle,
  X,
  Users,
  Cpu,
  Layers,
  Sparkles,
  Database,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Workflow,
  Radio,
  Clock,
} from 'lucide-react';

interface PlatformGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlatformGuideModal: React.FC<PlatformGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 820,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-inset)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Workflow size={15} color="#38bdf8" />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                OneMetric RevOps Platform — How It Works &amp; User Guide
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Zero-code enterprise architecture for Marketing Ops, Sales AEs, and Leadership
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {/* Section 1: Who Uses It & How (No Coding Required) */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Users size={16} color="var(--accent-lime)" />
              1. How Everyday Teams Use This Platform (Zero Terminal / Zero Code)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                  Marketing Operations
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Marketers continue building email sequences in <strong>HubSpot Sequences or Marketo</strong>.
                  OneMetric automatically pauses, unenrolls, or switches prospects in the background when intent surges,
                  without manual list exports.
                </p>
              </div>

              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                  Sales AEs &amp; SDRs
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Reps work 100% inside <strong>HubSpot CRM</strong>. When an escalation occurs ($120K open deal),
                  OneMetric writes a single high-priority Task with autonomous strategic sales briefing, discovery questions, and objection handling.
                </p>
              </div>

              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                  RevOps &amp; Leadership
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Admins use <strong>this Console</strong> as Mission Control. They inspect real-time intent decay,
                  simulate buying committees, review the audit trail, and verify CRM sync payloads.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: End-to-End Autonomous Pipeline */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Cpu size={16} color="#38bdf8" />
              2. The 3 Autonomous Agent Tiers (Assignment Solution)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <span className="pill pill-active font-mono" style={{ flexShrink: 0 }}>System One</span>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.78rem' }}>
                    Sub-millisecond Policy Engine (Jev / Deterministic FSM)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Handles 98% of high-volume webhooks in &lt;1ms. Evaluates 5 safety guards: Fatigue Cap (2 touches/7d),
                    Dual-Gate Hysteresis (Δ ≥ 25 &amp; Score ≥ 50), Persona Relevance, Cross-BU Ownership, and Active Deals.
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <span className="pill pill-warning font-mono" style={{ flexShrink: 0 }}>System Two</span>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.78rem' }}>
                    OneMetric Cognitive Strategic Agent (System Two)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Invoked only on high-stakes escalations ($120K open deals or multi-BU clashes). Formulates a unified cross-solution
                    commercial strategy, eliminating competing BU sales friction and synthesizing personalized discovery checklists for the rep.
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <span className="pill pill-neutral font-mono" style={{ flexShrink: 0 }}>Cron &amp; Loop</span>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.78rem' }}>
                    Bounded 48h Cooldown &amp; Feedback Worker
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Daily background cron (<code>/api/engine/cron/evaluate-cooldowns</code>) processes due cooldowns and retries; timing can be up to 24 hours late.
                    Signed downstream feedback (<code>/api/engine/feedback</code>) applies fixed heuristic source-weight updates (+0.08 on meeting booked, -0.05 on deal lost).
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Interactive Guide on How to Test the Console */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Layers size={16} color="#fbbf24" />
              3. How to Test Every Feature Interactively in this Console
            </div>
            <ul style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.74rem' }}>
              <li>
                <strong>Click any of the 4 Scenarios:</strong> Runs one of four synthetic scenarios: zero-baseline trap, corroborated switch, persona mismatch, or enterprise deal escalation.
              </li>
              <li>
                <strong>Switch to "Buying Committee" Tab:</strong> Click "Evaluate Buying Committee" to evaluate four seeded demo stakeholders (VP Eng, DevOps, CISO, Finance) against a synthetic domain surge.
              </li>
              <li>
                <strong>Click "+48h Advance":</strong> Advances the demo clock to exercise cooldown transitions; it does not invoke the production Redis worker.
              </li>
              <li>
                <strong>Inspect "HubSpot CRM Sync Payloads":</strong> Review the demo payload. Live CRM writes run only through configured server routes and require HubSpot credentials.
              </li>
              <li>
                <strong>Inject Custom Signals:</strong> Click "Custom Signal" to simulate arbitrary G2 reviews, pricing visits, or Bombora spikes on any product.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-inset)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <ShieldCheck size={14} color="#34d399" />
            100% Alignment with OneMetric AI Assessment Specification
          </div>
          <button onClick={onClose} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
            Got it, Let's Explore
          </button>
        </div>
      </div>
    </div>
  );
};
