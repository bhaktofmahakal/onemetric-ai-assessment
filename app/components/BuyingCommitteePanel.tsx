'use client';

import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Sparkles,
  RefreshCw,
  Building2,
  Zap,
} from 'lucide-react';
import type { BuyingCommitteeResolution, ContactOutcome } from '@/src/engine/multi-contact-evaluator';

interface BuyingCommitteePanelProps {
  committeeData?: BuyingCommitteeResolution | null;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const BuyingCommitteePanel: React.FC<BuyingCommitteePanelProps> = ({
  committeeData,
  onRefresh,
  isLoading = false,
}) => {
  const [activeContactId, setActiveContactId] = useState<string | null>(null);

  if (!committeeData) {
    return (
      <div style={{ padding: '36px 20px', textAlign: 'center' }}>
        <Users size={28} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
          Multi-Contact Buying Committee Resolution
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6, maxWidth: 540, margin: '6px auto 16px' }}>
          In B2B enterprise RevOps, intent surges hit an entire account domain (e.g. <code>techcorp.com</code>).
          The engine pulls all contacts across the account and evaluates each stakeholder individually
          based on their persona, 7-day touch fatigue, and active journey.
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.78rem' }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Evaluate Buying Committee (TechCorp)
          </button>
        )}
      </div>
    );
  }

  const { domain, account, incomingSurge, contactOutcomes, accountEscalated, escalationReason, briefing } = committeeData;

  const getActionBadge = (action: ContactOutcome['actionTaken']) => {
    switch (action) {
      case 'HOLD_COOLDOWN':
        return <span className="pill pill-warning">Hold (48h Cooldown)</span>;
      case 'PAUSE_FATIGUE':
        return <span className="pill pill-critical">Paused (Fatigue Cap)</span>;
      case 'SWITCH_ENROLL':
        return <span className="pill pill-active">Switch &amp; Enroll</span>;
      case 'CONTINUE_JOURNEY':
        return <span className="pill pill-neutral">Continue Journey</span>;
      case 'ESCALATE_REVIEW':
        return <span className="pill pill-critical">Escalate to Sales</span>;
      case 'EXIT_SUPPRESSED':
        return <span className="pill pill-critical">Suppressed</span>;
      default:
        return <span className="pill pill-neutral">{action}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Banner: Domain Surge & Account Context */}
      <div
        style={{
          background: 'var(--bg-inset)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building2 size={16} color="#38bdf8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
                {account.name}
              </span>
              <span className="pill pill-neutral font-mono">{domain}</span>
              <span className="pill pill-neutral font-mono">Tier {account.tier}</span>
              {account.activeDeals.length > 0 && (
                <span className="pill pill-active font-mono">
                  ${(account.activeDeals[0].amount / 1000).toFixed(0)}K Active Deal ({account.activeDeals[0].dealStage})
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Domain Surge: <strong style={{ color: '#fff' }}>{incomingSurge.productId === 'product_a' ? 'CloudSecure' : incomingSurge.productId}</strong> at Score <strong style={{ color: '#34d399' }}>{incomingSurge.rawScore}/100</strong> via {incomingSurge.source}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="pill pill-neutral font-mono" style={{ fontSize: '0.675rem' }}>
            <Users size={11} /> {contactOutcomes.length} Committee Stakeholders
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="btn btn-outline"
              style={{ padding: '5px 10px', fontSize: '0.725rem' }}
            >
              <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
              Re-Evaluate
            </button>
          )}
        </div>
      </div>

      {/* Stakeholders Resolution Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {contactOutcomes.map((co) => {
          const isSelected = activeContactId === co.contactId;

          return (
            <div
              key={co.contactId}
              onClick={() => setActiveContactId(isSelected ? null : co.contactId)}
              style={{
                background: isSelected ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-inset)',
                border: isSelected ? '1px solid var(--border-strong)' : '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 10,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                      {co.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {co.role}
                    </div>
                  </div>
                  {getActionBadge(co.actionTaken)}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 8,
                    fontSize: '0.675rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Persona: <strong style={{ color: '#e2e8f0' }}>{co.persona}</strong></span>
                  <span>•</span>
                  <span>7d Touches: <strong style={{ color: co.touchCount7d >= 2 ? '#f87171' : '#34d399' }}>{co.touchCount7d}/2</strong></span>
                  <span>•</span>
                  <span>Current: <strong style={{ color: '#e2e8f0' }}>{co.currentCampaign ?? 'None'}</strong></span>
                </div>

                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    marginTop: 8,
                    lineHeight: 1.4,
                    borderLeft: `2px solid ${
                      co.actionTaken === 'HOLD_COOLDOWN'
                        ? '#fbbf24'
                        : co.actionTaken === 'PAUSE_FATIGUE'
                        ? '#f87171'
                        : co.actionTaken === 'SWITCH_ENROLL'
                        ? '#34d399'
                        : '#94a3b8'
                    }`,
                  }}
                >
                  {co.actionSummary}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-hairline)',
                  paddingTop: 6,
                  fontSize: '0.675rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span>FSM: <strong style={{ color: '#fff' }}>{co.fsmState}</strong> ({co.decision})</span>
                <span className="font-mono">Engine: <strong style={{ color: '#fff' }}>{co.jevEngine}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* HubSpot Consolidated CRM Write-Back Banner */}
      <div
        style={{
          background: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={15} color="#34d399" />
          <span style={{ color: '#e2e8f0' }}>
            HubSpot CRM Sync: <strong>Batch Updated {contactOutcomes.length} Contacts</strong> in 1 HTTP Request.
            Single AE Task generated to prevent rep inbox spam.
          </span>
        </div>
        <span className="pill pill-active font-mono" style={{ fontSize: '0.65rem' }}>
          Batch API /crm/v3/objects/contacts/batch/update
        </span>
      </div>
    </div>
  );
};
