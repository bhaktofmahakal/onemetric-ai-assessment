'use client';

import React from 'react';
import { ShieldAlert, Zap, Building2, CheckCircle2, Sparkles, HelpCircle, FileText, CheckSquare, Loader2 } from 'lucide-react';
import type { ProspectState, ExecutiveBriefing } from '@/src/types';

interface AiBriefingPanelProps {
  prospect: ProspectState;
  isEscalated: boolean;
  briefing?: ExecutiveBriefing | null;
  isLoading?: boolean;
  onTriggerEscalation?: () => void;
}

export const AiBriefingPanel: React.FC<AiBriefingPanelProps> = ({
  prospect,
  isEscalated,
  briefing,
  isLoading = false,
  onTriggerEscalation,
}) => {
  const { account, contact, scores } = prospect;
  const deal = account.activeDeals[0];

  if (!isEscalated) {
    return (
      <div
        style={{
          padding: '36px 20px',
          textAlign: 'center',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 8,
          border: '1px dashed var(--border-hairline)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f87171',
          }}
        >
          <ShieldAlert size={20} />
        </div>
        <div style={{ maxWidth: 480 }}>
          <h4 style={{ fontSize: '0.925rem', fontWeight: 600, color: '#fff', marginBottom: 6 }}>
            Account Executive Escalation Memo (Tier-1 Deal Conflict Guard)
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            Standard nurture campaigns execute autonomously while single-product intent is clear. When dual-gate intent detects multi-product interest (&gt;70 across BUs) or an active pipeline deal ($120K open opportunity), automated marketing pauses and dispatches a consolidated escalation task to the assigned Account Executive to prevent competing cross-BU outreach.
          </p>
        </div>
        {onTriggerEscalation && (
          <button
            onClick={onTriggerEscalation}
            disabled={isLoading}
            className={`btn btn-secondary ${isLoading ? 'running-shimmer' : ''}`}
            style={{ fontSize: '0.75rem', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: '#fca5a5' }}
          >
            {isLoading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Simulating Active Deal Conflict...
              </>
            ) : (
              <>
                <ShieldAlert size={13} />
                Simulate Active Deal &amp; Multi-BU Conflict (Scenario 4)
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  // Fallback defaults if briefing is loading or pending
  const commercialRisk = briefing?.commercialRisk ||
    `High-value Tier ${account.tier} account (${account.name}) with an active $${deal ? (deal.amount / 1000).toFixed(0) : '120'}K pipeline opportunity in "${deal ? deal.dealStage : 'Demo Scheduled'}". Simultaneous intent surge across CloudSecure and DataFlow creates immediate revenue risk of competing BU sales outreach confusing executive stakeholders and stalling pipeline momentum.`;

  const crossSolutionStrategy = briefing?.crossSolutionStrategy ||
    `Suspend automated marketing cadence immediately. Direct assigned AE (${deal ? deal.owner : 'Strategic AE'}) to conduct a joint "Platform Security & Analytics" architecture walkthrough. Position CloudSecure as the zero-trust data perimeter safeguarding DataFlow telemetry, transforming a siloed friction point into a consolidated enterprise deal.`;

  const actionChecklist = briefing?.actionChecklist && briefing.actionChecklist.length >= 3
    ? briefing.actionChecklist
    : [
        `Discovery: Ask ${contact.firstName} (${contact.jobTitle}): "How is your engineering team currently reconciling zero-trust audit compliance with your real-time analytics data pipelines?"`,
        `Handover Alignment: Coordinate with ${deal ? deal.owner : 'Strategic AE'} to merge security compliance proof-of-concept requirements into the upcoming stage review.`,
        `Objection Handling: If client questions multiple product touches, emphasize: "Our solutions architect was notified of your dual evaluation to ensure you receive a unified licensing model rather than separate contracts."`,
      ];

  const latencyMs = briefing?.latencyMs ?? 0.12;
  const isLive = briefing?.isLive ?? false;
  const engineLabel = briefing?.engine || (isLive ? 'Gemini Structured Output' : 'RevOps Policy Synthesizer');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Escalation Context Banner & System Two Telemetry */}
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <ShieldAlert size={16} color="#f87171" style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Sales Escalation Triggered — Account Executive Alignment Required
            </div>
            <div style={{ fontSize: '0.72rem', color: '#fca5a5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Tier {account.tier} account ({account.name}) with open pipeline deal. Automated nurture suspended.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span className="pill pill-critical">Active Escalation</span>
          <span className={`pill ${isLive ? 'pill-active' : 'pill-warning'} font-mono`} style={{ fontSize: '0.675rem' }}>
            <Sparkles size={11} color={isLive ? 'var(--accent-lime)' : '#fbbf24'} />
            {engineLabel} • {latencyMs.toFixed(1)}ms
          </span>
        </div>
      </div>

      {/* 2-Column Layout: Opportunity Context + Strategic Sales Memo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: 14 }}>
        {/* Deal & Account Context */}
        <div
          style={{
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 10 }}>
              Opportunity Context
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Account:</span>
                <span style={{ color: '#fff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{account.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Opportunity Value:</span>
                <span style={{ color: '#fff', fontWeight: 600 }} className="font-mono">
                  ${deal ? deal.amount.toLocaleString() : '120,000'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Deal Stage:</span>
                <span style={{ color: 'var(--text-secondary)' }}>{deal ? deal.dealStage : 'Demo Scheduled'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Assigned AE:</span>
                <span style={{ color: '#fff' }}>{deal ? deal.owner : 'John Smith'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Key Contact:</span>
                <span style={{ color: '#fff' }}>{contact.firstName} {contact.lastName}</span>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: 10,
              borderTop: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.7rem',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>HubSpot Task:</span>
            <span className="pill pill-active font-mono">Dispatched to CRM</span>
          </div>
        </div>

        {/* OneMetric 3-Part Strategic Memo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 1. Commercial Risk Assessment */}
          <div
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={13} color="#f87171" />
              1. Commercial Risk Assessment
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {commercialRisk}
            </div>
          </div>

          {/* 2. Unified Cross-Solution Strategy */}
          <div
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-lime)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={13} color="var(--accent-lime)" />
              2. Unified Cross-Solution Strategy
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {crossSolutionStrategy}
            </div>
          </div>

          {/* 3. AE Action Checklist */}
          <div
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckSquare size={13} color="#60a5fa" />
              3. AE Action Checklist (Discovery &amp; Objection Handling)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {actionChecklist.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: '0.725rem' }}>
                  <span className="font-mono" style={{ color: '#60a5fa', fontWeight: 600, flexShrink: 0 }}>
                    {idx + 1}.
                  </span>
                  <span style={{ color: 'var(--text-secondary)', lineHeight: 1.35 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
