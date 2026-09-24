'use client';

import React from 'react';
import type { ProspectState, FSMState } from '@/src/types';
import { User, Building2, Flame, ArrowRightLeft, ShieldAlert, Clock, CheckCircle2 } from 'lucide-react';

interface ProspectOverviewProps {
  prospect: ProspectState;
  scores: Record<string, number>;
  delta: number;
}

export const ProspectOverview: React.FC<ProspectOverviewProps> = ({
  prospect,
  scores,
  delta,
}) => {
  const { account, contact, fsmState } = prospect;

  const scoreA = Math.round(scores['product_a'] ?? 0);
  const scoreB = Math.round(scores['product_b'] ?? 0);
  const scoreC = Math.round(scores['product_c'] ?? 0);

  const getStatePill = (state: FSMState) => {
    switch (state) {
      case 'ACTIVE_CURRENT':
        return <span className="pill pill-active">Active Campaign</span>;
      case 'MONITORING':
        return <span className="pill pill-warning">Monitoring (Δ &gt; 15)</span>;
      case 'EVALUATION_COOLDOWN':
        return <span className="pill pill-cooldown"><Clock size={11} /> 48h Cooldown Hold</span>;
      case 'SWITCHING':
        return <span className="pill pill-action"><ArrowRightLeft size={11} /> Switching BU</span>;
      case 'ESCALATED':
        return <span className="pill pill-critical"><ShieldAlert size={11} /> Escalated to Sales</span>;
      case 'PAUSED':
        return <span className="pill pill-neutral">Cadence Paused</span>;
      default:
        return <span className="pill pill-neutral">{state}</span>;
    }
  };

  const currentProductName =
    contact.currentCampaign === 'product_a'
      ? 'CloudSecure (Security Platform)'
      : contact.currentCampaign === 'product_b'
      ? 'DataFlow (Analytics Suite)'
      : contact.currentCampaign === 'product_c'
      ? 'FinanceOS (Finance ERP)'
      : 'Unenrolled';

  const enrollmentDays = contact.enrollmentDate
    ? Math.max(1, Math.round((Date.now() - new Date(contact.enrollmentDate).getTime()) / 86400000))
    : null;
  const lastTouchDays = contact.lastTouchDate
    ? Math.max(0, Math.round((Date.now() - new Date(contact.lastTouchDate).getTime()) / 86400000))
    : null;

  return (
    <div className="panel" style={{ height: '100%' }}>
      <div className="panel-header">
        <div className="panel-title">
          <User size={14} color="var(--text-secondary)" />
          Prospect &amp; Account Profile
        </div>
        <div>{getStatePill(fsmState)}</div>
      </div>

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Contact Info */}
        <div
          style={{
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {contact.firstName} {contact.lastName}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {contact.jobTitle}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} className="font-mono">
                {contact.email}
              </div>
            </div>

            <span className="pill pill-neutral" style={{ fontSize: '0.675rem', flexShrink: 0 }}>
              Persona: {contact.persona}
            </span>
          </div>

          {/* Account Profile Bar (Hierarchical & Collision-Free) */}
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Building2 size={14} color="var(--text-secondary)" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.825rem',
                    lineHeight: 1.25,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {account.name}
                </div>
                <div
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.7rem',
                    lineHeight: 1.2,
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  className="font-mono"
                >
                  {account.domain}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
              <span className="pill pill-neutral font-mono" style={{ fontSize: '0.675rem' }}>
                Tier {account.tier}
              </span>
              <span className="pill pill-neutral font-mono" style={{ fontSize: '0.675rem' }}>
                {account.ownerBU}
              </span>
            </div>
          </div>

          {account.activeDeals.length > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: '7px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: '0.725rem',
                color: '#fca5a5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>
                Active Deal: <strong>${(account.activeDeals[0].amount / 1000).toFixed(0)}K</strong>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{account.activeDeals[0].dealStage}</span>
            </div>
          )}
        </div>

        {/* Current Active Sequence */}
        <div
          style={{
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Active Nurture Sequence
            </span>
            <span className="pill pill-active" style={{ fontSize: '0.65rem' }}>Enrolled</span>
          </div>

          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginTop: 4 }}>
            {currentProductName}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid var(--border-hairline)',
              fontSize: '0.72rem',
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Duration</div>
              <div style={{ fontWeight: 500, color: '#fff', marginTop: 1 }}>
                {enrollmentDays !== null ? `${enrollmentDays} Days` : 'Standby'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Last Touch</div>
              <div style={{ fontWeight: 500, color: '#fff', marginTop: 1 }}>
                {lastTouchDays !== null ? (lastTouchDays === 0 ? 'Today' : `${lastTouchDays}d Ago`) : 'None'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Cadence</div>
              <div style={{ fontWeight: 500, color: '#34d399', marginTop: 1 }}>
                {contact.touchCount7d} / 2 touches
              </div>
            </div>
          </div>
        </div>

        {/* Intent Score Gauges */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Composite Intent Scores
            </span>
            <span style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>t½ = 14d</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Product A */}
            <div
              style={{
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginBottom: 4, gap: 8 }}>
                <span style={{ color: '#fff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  CloudSecure (Security)
                </span>
                <span className="font-mono" style={{ fontWeight: 600, flexShrink: 0, color: scoreA >= 50 ? '#fff' : 'var(--text-secondary)' }}>
                  {scoreA} / 100
                </span>
              </div>
              <div style={{ height: 4, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, scoreA)}%`,
                    height: '100%',
                    background: scoreA >= 50 ? '#3b82f6' : '#64748b',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {/* Product B */}
            <div
              style={{
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginBottom: 4, gap: 8 }}>
                <span style={{ color: '#fff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  DataFlow (Analytics)
                </span>
                <span className="font-mono" style={{ fontWeight: 600, flexShrink: 0, color: scoreB >= 50 ? '#fff' : 'var(--text-secondary)' }}>
                  {scoreB} / 100
                </span>
              </div>
              <div style={{ height: 4, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, scoreB)}%`,
                    height: '100%',
                    background: scoreB >= 50 ? '#6366f1' : '#64748b',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {scoreC > 0 && (
              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginBottom: 4, gap: 8 }}>
                  <span style={{ color: '#fff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    FinanceOS (Finance)
                  </span>
                  <span className="font-mono" style={{ fontWeight: 600, flexShrink: 0, color: '#fbbf24' }}>
                    {scoreC} / 100
                  </span>
                </div>
                <div style={{ height: 4, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, scoreC)}%`,
                      height: '100%',
                      background: '#f59e0b',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hysteresis Delta */}
        <div
          style={{
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Relative Gap (Hysteresis Δ)
            </div>
            <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginTop: 2 }}>
              {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} pts
            </div>
          </div>

          <div style={{ flexShrink: 0 }}>
            {delta >= 25 ? (
              <span className="pill pill-active">Threshold Met (≥ 25)</span>
            ) : (
              <span className="pill pill-neutral">Below Threshold (&lt; 25)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
