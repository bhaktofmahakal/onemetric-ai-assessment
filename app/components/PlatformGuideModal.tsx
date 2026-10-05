'use client';

import React from 'react';
import {
  X,
  Radio,
  ShieldCheck,
  Sparkles,
  Database,
  Users,
  Play,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Briefcase,
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
          borderRadius: 14,
          width: '100%',
          maxWidth: 780,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-inset)',
          }}
        >
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
              How OneMetric Works
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Automating campaign switches without spamming prospects or ruining live sales deals.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 6,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div
          style={{
            padding: '16px 22px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Top 3-Step Visual Flow */}
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10 }}>
              The 3-Step Decision Flow
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {/* Step 1 */}
              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 10,
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Radio size={14} />
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>1. Detect Signals</span>
                </div>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Collects buyer intent from website visits, G2 reviews, and Bombora surges. Single isolated spikes are capped so they never trigger false switches.
                </p>
              </div>

              {/* Step 2 */}
              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 10,
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={14} />
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>2. Apply Safety Rules</span>
                </div>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Before changing anything, the engine checks contact fatigue, active deals, buyer job role, and waits 48h to confirm interest is sustained.
                </p>
              </div>

              {/* Step 3 */}
              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 10,
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Database size={14} />
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>3. Sync to CRM</span>
                </div>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Updates HubSpot sequences automatically. If an open deal exists ($120k+), it alerts the Sales AE with an AI-generated briefing instead of emailing.
                </p>
              </div>
            </div>
          </div>

          {/* Key Safety Guards Explained in Plain English */}
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10 }}>
              The 4 Safety Guards (Why RevOps Teams Trust It)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  icon: <Clock size={15} color="#38bdf8" />,
                  title: 'Anti-Spam Fatigue Cap (Max 2 Touches / 7 Days)',
                  desc: 'If a prospect received 2 emails in the last 7 days or was contacted within 72 hours, the engine pauses outreach so they are never overloaded.',
                },
                {
                  icon: <Briefcase size={15} color="#f87171" />,
                  title: 'Active Deal Protection (Hands off Open Pipeline)',
                  desc: 'When an Account Executive is already working a deal (e.g. $120k opportunity), marketing nurture stops immediately to prevent sending contradictory messages.',
                },
                {
                  icon: <Users size={15} color="#fbbf24" />,
                  title: 'Buyer Persona Matching (Right Message to Right Person)',
                  desc: 'If an account surges on Finance software but the contact is an Engineering lead, the campaign stays put rather than sending irrelevant content.',
                },
                {
                  icon: <TrendingUp size={15} color="#34d399" />,
                  title: '48-Hour Cooldown (Anti-Flapping)',
                  desc: 'A 1-hour browsing spike does not trigger a campaign switch. The engine holds for 48 hours to confirm the buyer interest is genuine and sustained.',
                },
              ].map((g, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div style={{ marginTop: 2 }}>{g.icon}</div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>{g.title}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.45 }}>{g.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick 30-Second Guide on What to Click */}
          <div
            style={{
              background: 'rgba(56, 189, 248, 0.04)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sparkles size={14} />
              How to Test this Live Dashboard
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.45 }}>
              <li>
                <strong style={{ color: '#fff' }}>Click "Test Scenarios" accordion:</strong> Try <span style={{ color: '#fbbf24' }}>Uncorroborated Surge</span> (stops false switch) or <span style={{ color: '#f87171' }}>Enterprise Account Conflict</span> (shows $120k deal protection).
              </li>
              <li>
                <strong style={{ color: '#fff' }}>Evaluate any domain:</strong> Click <code style={{ color: '#38bdf8' }}>snowflake.com</code> or <code style={{ color: '#38bdf8' }}>stripe.com</code> to see real-time buying committee analysis and public web corroboration.
              </li>
              <li>
                <strong style={{ color: '#fff' }}>Downstream Feedback:</strong> Click <span style={{ color: 'var(--accent-lime)' }}>+ Meeting Booked</span> to see how real sales outcomes automatically recalibrate signal weights.
              </li>
              <li>
                <strong style={{ color: '#fff' }}>Deep Analysis:</strong> Open the bottom accordion to inspect exact mathematical decision formulas, AI briefing memo, and HubSpot CRM payloads.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-inset)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={14} color="#34d399" />
            Deterministic Business Guardrails First, AI Reasoning Second
          </div>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ padding: '7px 18px', fontSize: '0.78rem' }}
          >
            Got it, Let's Explore
          </button>
        </div>
      </div>
    </div>
  );
};
