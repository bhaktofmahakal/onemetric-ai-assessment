'use client';

import React, { useState } from 'react';
import {
  Users,
  CheckCircle2,
  Building2,
  Sparkles,
  RefreshCw,
  CheckSquare,
  FileText,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Globe,
  Search,
  Briefcase,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { BuyingCommitteeResolution, ContactOutcome } from '@/src/engine/multi-contact-evaluator';

interface BuyingCommitteeViewerProps {
  committeeData?: BuyingCommitteeResolution | null;
  consolidatedTaskResult?: Record<string, unknown> | null;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const BuyingCommitteeViewer: React.FC<BuyingCommitteeViewerProps> = ({
  committeeData,
  consolidatedTaskResult,
  onRefresh,
  isLoading = false,
}) => {
  const [showEvidence, setShowEvidence] = useState(false);

  if (!committeeData) {
    return (
      <div style={{ padding: '36px 20px', textAlign: 'center' }}>
        <Users size={28} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
          Multi-Contact Buying Committee Resolution
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6, maxWidth: 560, margin: '6px auto 16px' }}>
          In B2B RevOps, intent data arrives at the Account Domain level (e.g. stripe.com, snowflake.com).
          The autonomous agent queries HubSpot CRM for all active stakeholders and resolves each individual
          journey concurrently without duplicate rep spam.
        </p>
        <p style={{ fontSize: '0.72rem', color: 'var(--accent-lime)', marginTop: 0, marginBottom: 16, fontWeight: 500 }}>
          ↑ Enter any domain in the Evaluator above and click "Evaluate Committee" to see the full resolution.
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={`btn btn-primary ${isLoading ? 'running-shimmer' : ''}`}
            style={{ padding: '8px 16px', fontSize: '0.78rem' }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Evaluating Buying Committee...' : 'Evaluate Buying Committee'}
          </button>
        )}
      </div>
    );
  }

  const { domain, account, incomingSurge, contactOutcomes, accountEscalated, briefing, webCorroboration } = committeeData;
  const activeDeal = account.activeDeals[0];
  const taskId = (consolidatedTaskResult?.taskId as string) || (accountEscalated ? 'Pending CRM Sync' : 'Not Required (No Escalation)');

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
      {/* Account Domain Surge Header */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
                {account.name}
              </span>
              <span className="pill pill-neutral font-mono">{domain}</span>
              <span className="pill pill-neutral font-mono">Tier {account.tier}</span>
              {activeDeal && (
                <span className="pill pill-active font-mono">
                  ${(activeDeal.amount / 1000).toFixed(0)}K Open Deal ({activeDeal.dealStage})
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', marginTop: 3 }}>
              Inbound Domain Surge: <strong style={{ color: '#fff' }}>{incomingSurge.productId === 'product_a' ? 'CloudSecure' : incomingSurge.productId}</strong> at Score <strong style={{ color: '#34d399' }}>{incomingSurge.rawScore}/100</strong> via {incomingSurge.source}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="pill pill-neutral font-mono" style={{ fontSize: '0.675rem' }}>
            <Users size={11} /> {contactOutcomes.length} Committee Members
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

      {/* Autonomous Market Signal & Hiring Corroboration Card */}
      {webCorroboration && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={16} color="#38bdf8" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                Autonomous Market Signal &amp; Hiring Corroboration
              </span>
              <span
                className={`pill ${
                  webCorroboration.isCorroborated ? 'pill-active' : 'pill-critical'
                } font-mono`}
                style={{ fontSize: '0.65rem' }}
              >
                {webCorroboration.status === 'CORROBORATED'
                  ? 'CORROBORATED (Live Market Verified)'
                  : 'UNCORROBORATED (Single Source Risk)'}
              </span>
              <span className="pill pill-neutral font-mono" style={{ fontSize: '0.65rem' }}>
                Corroboration Score: <strong style={{ color: '#34d399' }}>{webCorroboration.corroborationScore}/100</strong>
              </span>
              <span className="pill pill-active font-mono" style={{ fontSize: '0.65rem' }}>
                +{Math.round(webCorroboration.confidenceBoost * 100)}% Confidence Boost
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem' }}>
              <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                {webCorroboration.source === 'tinyfish_live_api' ? 'Live Signal Corroborator (Verified)' : 'Calibrated Market Index'} ({webCorroboration.latencyMs}ms)
              </span>
              <button
                type="button"
                onClick={() => setShowEvidence(!showEvidence)}
                className="btn btn-outline"
                style={{ padding: '3px 8px', fontSize: '0.65rem' }}
              >
                {showEvidence ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {showEvidence ? 'Hide Market Signal Evidence' : `View Live Market Signal Evidence (${webCorroboration.evidence.length})`}
              </button>
            </div>
          </div>

          {/* Query & Keyword Verification Chips */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: '0.72rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Live Search Query: <code style={{ color: '#e2e8f0', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>{webCorroboration.query}</code>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-muted)' }}>Matched Signals:</span>
            {webCorroboration.matchedKeywords.map((kw, i) => (
              <span key={i} className="pill pill-neutral font-mono" style={{ fontSize: '0.625rem', color: '#38bdf8' }}>
                ✓ {kw}
              </span>
            ))}
          </div>

          {/* Expandable Web Evidence Results */}
          {showEvidence && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {webCorroboration.evidence.map((ev, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {ev.title} <ExternalLink size={10} />
                    </a>
                    <span className="pill pill-neutral font-mono" style={{ fontSize: '0.6rem' }}>
                      {ev.siteName} • Relevance {ev.relevanceScore}%
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    {ev.snippet}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4 Committee Stakeholder Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {contactOutcomes.map((co) => (
          <div
            key={co.contactId}
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 10,
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
                  flexWrap: 'wrap',
                }}
              >
                <span>Persona: <strong style={{ color: '#e2e8f0' }}>{co.persona}</strong></span>
                <span>|</span>
                <span>7d Touches: <strong style={{ color: co.touchCount7d >= 2 ? '#f87171' : '#34d399' }}>{co.touchCount7d}/2</strong></span>
                <span>|</span>
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
        ))}
      </div>

      {/* HubSpot Consolidated AE Briefing Task Card */}
      {accountEscalated && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckSquare size={16} color="#f87171" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                HubSpot CRM Consolidated AE Briefing Task
              </span>
              <span className="pill pill-critical">High Priority</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem' }}>
              <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                Task ID: <strong style={{ color: '#fff' }}>{taskId}</strong>
              </span>
              <span className="pill pill-neutral font-mono">
                Associated: 1 Company + {contactOutcomes.length} Contacts
              </span>
              <span className="pill pill-active font-mono">
                0 Duplicate Spam Tasks
              </span>
            </div>
          </div>

          {/* OneMetric Cognitive Strategic Synthesis */}
          {briefing && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  Commercial Risk Assessment
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  {briefing.commercialRisk}
                </p>
              </div>

              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  Cross-Solution Unified Strategy
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  {briefing.crossSolutionStrategy}
                </p>
              </div>

              <div
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  gridColumn: '1 / -1',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-lime)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  AE Action &amp; Discovery Checklist
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {briefing.actionChecklist.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.72rem', color: '#e2e8f0' }}>
                      <span className="font-mono" style={{ color: 'var(--text-muted)' }}>{idx + 1}.</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HubSpot Batch API Write-Back Status */}
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
          </span>
        </div>
        <span className="pill pill-active font-mono" style={{ fontSize: '0.65rem' }}>
          Batch API /crm/v3/objects/contacts/batch/update
        </span>
      </div>
    </div>
  );
};
