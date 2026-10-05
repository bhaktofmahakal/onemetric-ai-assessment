'use client';

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ProspectOverview } from './components/ProspectOverview';
import { StateMachineVisualizer } from './components/StateMachineVisualizer';
import { ScenarioDispatcher } from './components/ScenarioDispatcher';
import { DecisionBreakdown } from './components/DecisionBreakdown';
import { AiBriefingPanel } from './components/AiBriefingPanel';
import { CrmPayloadViewer } from './components/CrmPayloadViewer';
import { AuditLog } from './components/AuditLog';
import { CustomEventModal } from './components/CustomEventModal';
import { BuyingCommitteeViewer } from './components/BuyingCommitteeViewer';
import { PlatformGuideModal } from './components/PlatformGuideModal';
import { EnginePreloader } from './components/EnginePreloader';
import type { DemoStoreState } from '@/src/engine/demo-store';
import type { SourceType, ProspectState } from '@/src/types';
import type { BuyingCommitteeResolution } from '@/src/engine/multi-contact-evaluator';
import { Calculator, ShieldAlert, Database, History, CheckCircle2, ShieldCheck, Activity, Building2, Users, Globe, Play, Copy, Check, TrendingUp, Sliders, Layers, Loader2, ChevronDown, ChevronRight, Zap, ArrowRight, AlertTriangle, Clock, BarChart3 } from 'lucide-react';

export default function Home() {
  const [data, setData] = useState<DemoStoreState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluatingDomain, setIsEvaluatingDomain] = useState(false);
  const [evaluatingDomainName, setEvaluatingDomainName] = useState<string>('');
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);
  const [isAdvancingTimer, setIsAdvancingTimer] = useState(false);
  const [runningFeedbackType, setRunningFeedbackType] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<{
    domain: string;
    latencyMs: number;
    corroborationScore: number;
    corroborationStatus: string;
    corroborationSource: string;
    crmWriteStatus: string;
    taskStatus: string;
    agentStatus: string;
    executionMode: string;
  } | null>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [committeeData, setCommitteeData] = useState<BuyingCommitteeResolution | null>(null);
  const [activeTab, setActiveTab] = useState<'decision' | 'committee' | 'briefing' | 'crm' | 'audit'>('decision');
  const [domainInput, setDomainInput] = useState('');
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(true);
  const [liveWebhookToast, setLiveWebhookToast] = useState<{
    domain: string;
    score: number;
    source: string;
    timestamp: string;
  } | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const lastProcessedEventId = React.useRef<string | null>(null);

  // Fetch initial engine state on mount
  const fetchState = async (silent: boolean = false) => {
    try {
      if (!silent) setIsLoading(true);
      const res = await fetch('/api/engine/state');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        if (json.data.lastBuyingCommitteeResolution) {
          setCommitteeData(json.data.lastBuyingCommitteeResolution);
          if (!lastProcessedEventId.current) {
            lastProcessedEventId.current =
              json.data.lastBuyingCommitteeResolution.incomingSurge?.eventId ||
              json.data.auditLedger?.[0]?.id ||
              null;
          }
        }
      } else if (!silent) {
        setError(json.error ?? 'Failed to load initial state');
      }
    } catch (err: unknown) {
      if (!silent) setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Active 3.5s background polling for true zero-click webhook observability
  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/engine/state');
        const json = await res.json();
        if (json.success && json.data) {
          const latestEvent = json.data.lastBuyingCommitteeResolution?.incomingSurge;
          const currentEventId = latestEvent?.eventId || json.data.auditLedger?.[0]?.id;

          if (currentEventId && currentEventId !== lastProcessedEventId.current) {
            const isInitial = lastProcessedEventId.current === null;
            lastProcessedEventId.current = currentEventId;
            setData(json.data);
            if (json.data.lastBuyingCommitteeResolution) {
              setCommitteeData(json.data.lastBuyingCommitteeResolution);
            }

            // Trigger temporary 6-second live banner on background updates
            if (!isInitial) {
              setLiveWebhookToast({
                domain:
                  json.data.lastBuyingCommitteeResolution?.domain ||
                  json.data.lastBuyingCommitteeResolution?.account?.domain ||
                  json.data.prospect?.account?.domain ||
                  'unknown',
                score: latestEvent?.rawScore ?? json.data.auditLedger?.[0]?.rawScore ?? 88,
                source: latestEvent?.source || json.data.auditLedger?.[0]?.source || 'bombora',
                timestamp: new Date().toLocaleTimeString(),
              });
              setTimeout(() => setLiveWebhookToast(null), 6000);
            }
          }
        }
      } catch (e) {
        // Silent catch on poll
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [isListening]);

  // Scenario Dispatcher
  const handleDispatchScenario = async (scenarioId: string) => {
    try {
      setIsLoading(true);
      setRunningScenarioId(scenarioId);
      const res = await fetch('/api/engine/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setActiveTab('decision');
      } else {
        setError(json.error ?? 'Scenario evaluation failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Evaluation error');
    } finally {
      setIsLoading(false);
      setRunningScenarioId(null);
    }
  };

  // Cooldown Timer Advance (+48h)
  const handleAdvanceTimer = async () => {
    try {
      setIsLoading(true);
      setIsAdvancingTimer(true);
      const res = await fetch('/api/engine/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance_timer', hours: 48 }),
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error ?? 'Timer advancement failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Timer advancement error');
    } finally {
      setIsLoading(false);
      setIsAdvancingTimer(false);
    }
  };

  // Custom Event Injection
  const handleDispatchCustom = async (event: {
    productId: string;
    source: string;
    sourceType: SourceType;
    rawScore: number;
    metadata?: Record<string, unknown>;
  }) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/engine/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customEvent: event }),
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error ?? 'Custom event failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Custom signal error');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Engine State
  const handleReset = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/engine/reset', {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setActiveTab('decision');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset error');
    } finally {
      setIsLoading(false);
    }
  };
 
  // Downstream Conversion Feedback Trigger
  const handleTriggerFeedback = async (
    eventType: 'meeting_booked' | 'email_reply' | 'deal_lost' | 'unsubscribed',
    deltaLabel: string
  ) => {
    try {
      setIsLoading(true);
      setRunningFeedbackType(eventType);
      setFeedbackNotice(null);
      const res = await fetch('/api/engine/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          eventType,
          sourceType: '3rd_party',
          productId: 'product_a',
          domain: data?.prospect?.account?.domain || domainInput || 'techcorp.com',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        const resObj = json.feedbackResult;
        setFeedbackNotice(
          `Outcome "${eventType}" recorded (${deltaLabel}). 3rd-Party Bombora weight recalibrated: ${resObj?.previousWeight?.toFixed(2)} → ${resObj?.newWeight?.toFixed(2)}`
        );
        setTimeout(() => setFeedbackNotice(null), 8000);
      } else {
        setError(json.error ?? 'Feedback submission failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Feedback error');
    } finally {
      setIsLoading(false);
      setRunningFeedbackType(null);
    }
  };

  // Evaluate Account Buying Committee (e.g. techcorp.com, snowflake.com, stripe.com)
  const handleEvaluateCommittee = async (domainToEvaluate?: string) => {
    const targetDomain = (domainToEvaluate || domainInput || '').trim().toLowerCase();
    if (!targetDomain) {
      setError('Please enter a domain (e.g. stripe.com, snowflake.com) to evaluate.');
      return;
    }
    const startTime = performance.now();
    try {
      setIsLoading(true);
      setIsEvaluatingDomain(true);
      setEvaluatingDomainName(targetDomain);
      setDomainInput(targetDomain);
      setSuccessBanner(null);

      const res = await fetch('/api/engine/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate_domain',
          domain: targetDomain,
        }),
      });
      const json = await res.json();
      const latencyMs = Math.round(performance.now() - startTime);

      if (json.success) {
        setData(json.data);
        const resData = json.data.lastBuyingCommitteeResolution;
        if (resData) {
          setCommitteeData(resData);
          const web = resData.webCorroboration;
          const crm = json.data.lastLiveSyncResult;
          const task = json.data.lastConsolidatedTaskResult;
          setSuccessBanner({
            domain: targetDomain,
            latencyMs,
            corroborationScore: web?.corroborationScore ?? 0,
            corroborationStatus: web?.status ?? 'NOT_CHECKED',
            corroborationSource: web?.source ?? 'unavailable',
            crmWriteStatus: crm?.success ? 'HubSpot batch write confirmed' : `HubSpot write not confirmed${crm?.error ? `: ${crm.error}` : ''}`,
            taskStatus: resData.accountEscalated
              ? task?.success ? `AE task created (${task.taskId})` : `AE task not confirmed${task?.error ? `: ${task.error}` : ''}`
              : 'No AE task required',
            agentStatus: json.agentSession?.status ?? 'unavailable',
            executionMode: json.executionMode ?? 'unknown',
          });
          setTimeout(() => setSuccessBanner(null), 8000);
        }
        setActiveTab('committee');
      } else {
        setError(json.error ?? 'Domain evaluation failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Domain evaluation error');
    } finally {
      setIsLoading(false);
      setIsEvaluatingDomain(false);
      setEvaluatingDomainName('');
    }
  };

  if (!data) {
    return <EnginePreloader error={error} onRetry={() => fetchState(false)} />;
  }

  const { prospect, scores, delta, lastDecisionOutcome, lastSyncPayload, lastJevDetails, auditLedger, activeScenarioId } = data;
  
  // Synchronize Active Account & Primary Committee Contact across entire page
  const displayAccount = committeeData?.account || prospect.account;
  const primaryOutcome = committeeData?.contactOutcomes?.[0];
  const displayContact = primaryOutcome
    ? {
        name: primaryOutcome.name,
        role: primaryOutcome.role,
        currentCampaign: primaryOutcome.currentCampaign || prospect.contact.currentCampaign,
        touchCount7d: primaryOutcome.touchCount7d,
      }
    : {
        name: `${prospect.contact.firstName} ${prospect.contact.lastName}`,
        role: prospect.contact.jobTitle,
        currentCampaign: prospect.contact.currentCampaign,
        touchCount7d: prospect.contact.touchCount7d,
      };

  const synchronizedProspect: ProspectState = {
    ...prospect,
    account: displayAccount || prospect.account,
    contact: {
      ...prospect.contact,
      firstName: displayContact.name.split(' ')[0] || prospect.contact.firstName,
      lastName: displayContact.name.split(' ').slice(1).join(' ') || prospect.contact.lastName,
      jobTitle: displayContact.role || prospect.contact.jobTitle,
      currentCampaign: displayContact.currentCampaign || prospect.contact.currentCampaign,
      touchCount7d: displayContact.touchCount7d,
    },
  };

  const isInCooldown = prospect.fsmState === 'EVALUATION_COOLDOWN';
  const isEscalated = prospect.fsmState === 'ESCALATED';

  // --- Human-friendly decision labels ---
  const getDecisionLabel = (decision?: string) => {
    switch (decision) {
      case 'continue': return 'Continue Current Journey';
      case 'switch': return 'Switch Campaign';
      case 'pause': return 'Pause Outreach';
      case 'escalate': return 'Escalate to Sales';
      case 'exit': return 'Exit — Deal Conflict';
      case 'monitor': return 'Monitor (Signal Rising)';
      default: return 'Awaiting Evaluation';
    }
  };

  const getDecisionColor = (decision?: string) => {
    switch (decision) {
      case 'continue': return '#10b981';
      case 'switch': return '#3b82f6';
      case 'pause': return '#f59e0b';
      case 'escalate': return '#ef4444';
      case 'exit': return '#ef4444';
      case 'monitor': return '#f97316';
      default: return '#64748b';
    }
  };

  const getDecisionIcon = (decision?: string) => {
    switch (decision) {
      case 'continue': return <CheckCircle2 size={22} />;
      case 'switch': return <ArrowRight size={22} />;
      case 'pause': return <Clock size={22} />;
      case 'escalate': return <AlertTriangle size={22} />;
      case 'exit': return <ShieldAlert size={22} />;
      case 'monitor': return <Activity size={22} />;
      default: return <BarChart3 size={22} />;
    }
  };

  const currentDecision = lastDecisionOutcome?.decision;
  const decisionColor = getDecisionColor(currentDecision);

  const getProductName = (id?: string | null) => {
    if (id === 'product_a') return 'CloudSecure';
    if (id === 'product_b') return 'DataFlow';
    if (id === 'product_c') return 'FinanceOS';
    return 'None';
  };

  const getStateName = (state: string) => {
    switch (state) {
      case 'ACTIVE_CURRENT': return 'Active';
      case 'MONITORING': return 'Monitoring';
      case 'EVALUATION_COOLDOWN': return '48h Cooldown';
      case 'SWITCHING': return 'Switching';
      case 'ESCALATED': return 'Escalated';
      case 'PAUSED': return 'Paused';
      default: return state;
    }
  };

  // Derive the deal value for display
  const totalDealAmount = displayAccount?.activeDeals?.reduce((sum, d) => sum + (d.amount || 0), 0) ?? 0;
  const dealValue = totalDealAmount > 0
    ? `$${(totalDealAmount / 1000).toFixed(0)}k`
    : committeeData?.contactOutcomes?.some(c => c.decision === 'exit' || c.actionTaken === 'EXIT_SUPPRESSED')
    ? '$120k'
    : null;

  return (
    <div>
      <Header
        onReset={handleReset}
        onOpenGuide={() => setIsGuideOpen(true)}
        isLoading={isLoading}
        activeScenarioName={activeScenarioId ?? undefined}
        latencyMs={lastJevDetails?.latencyMs ?? 0.08}
        isListening={isListening}
        onToggleListening={() => setIsListening(!isListening)}
      />

      <main className="app-container" style={{ maxWidth: 1100 }}>
        {/* ========== LIVE WEBHOOK TOAST ========== */}
        {liveWebhookToast && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            animation: 'pulse 2s infinite',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 500 }}>
              New signal from <strong>{liveWebhookToast.source.toUpperCase()}</strong>: {liveWebhookToast.domain} ({liveWebhookToast.score} pts)
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {liveWebhookToast.timestamp}
            </span>
          </div>
        )}

        {/* ========== ERROR BANNER ========== */}
        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#fca5a5',
            fontSize: '0.8rem',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}
            >✕</button>
          </div>
        )}

        {/* ========== HERO: THE DECISION ========== */}
        <div style={{
          background: `linear-gradient(135deg, ${decisionColor}08 0%, var(--bg-surface) 100%)`,
          border: `1px solid ${decisionColor}30`,
          borderRadius: 12,
          padding: '28px 32px',
          marginBottom: 20,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Subtle accent line */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, ${decisionColor}, ${decisionColor}60, transparent)`,
          }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            {/* Left: Decision + Reasoning */}
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>
                Engine Decision
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ color: decisionColor }}>
                  {getDecisionIcon(currentDecision)}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                  {getDecisionLabel(currentDecision)}
                </div>
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 540 }}>
                {lastDecisionOutcome?.reasoning || 'Run an evaluation below to see the engine\'s recommendation and reasoning.'}
              </div>
            </div>

            {/* Right: Key Metrics (4 cards) */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 8, padding: '10px 14px', minWidth: 115, textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Account</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayAccount?.name || 'TechCorp Inc'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: 2, fontFamily: 'monospace' }}>
                  {displayAccount?.domain || 'techcorp.com'}
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 8, padding: '10px 14px', minWidth: 125, textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Lead Contact</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayContact.name || 'Sarah Chen'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayContact.role || 'VP of Engineering'}
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 8, padding: '10px 14px', minWidth: 105, textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Journey State</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: decisionColor }}>
                  {getStateName(prospect.fsmState)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {getProductName(displayContact.currentCampaign)}
                </div>
              </div>

              {dealValue && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 8, padding: '10px 14px', minWidth: 110, textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Deal Protected</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f87171' }}>
                    {dealValue}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: 2 }}>
                    Active Deal
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== EVALUATION BAR ========== */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 10,
          padding: '16px 20px',
          marginBottom: 20,
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={15} color="#38bdf8" />
              <span>Evaluate Account Buying Committee</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Active Target: <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{displayAccount?.domain || 'techcorp.com'}</span> ({displayAccount?.name || 'TechCorp Inc'})
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              id="domain-input"
              name="domain"
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleEvaluateCommittee(domainInput);
                }
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder="Enter a company domain (e.g. stripe.com)"
              style={{
                flex: 1,
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 6,
                padding: '9px 14px',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
                minWidth: 200,
              }}
            />
            <button
              type="button"
              onClick={() => handleEvaluateCommittee(domainInput)}
              disabled={isLoading}
              className="btn btn-primary"
              style={{ padding: '9px 20px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
              {isEvaluatingDomain ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <Play size={14} />
                  Evaluate
                </>
              )}
            </button>
          </div>
          {/* Quick-pick domains */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {['techcorp.com', 'snowflake.com', 'stripe.com'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setDomainInput(d); handleEvaluateCommittee(d); }}
                disabled={isLoading}
                className={`btn btn-secondary ${isEvaluatingDomain && evaluatingDomainName === d ? 'running-shimmer' : ''}`}
                style={{ padding: '5px 12px', fontSize: '0.75rem' }}
              >
                {isEvaluatingDomain && evaluatingDomainName === d ? (
                  <><Loader2 size={11} className="animate-spin" /> Evaluating...</>
                ) : d}
              </button>
            ))}
            <button
              type="button"
              onClick={handleAdvanceTimer}
              disabled={isLoading}
              className={`btn btn-secondary ${isAdvancingTimer ? 'running-shimmer' : ''}`}
              style={{ padding: '5px 12px', fontSize: '0.75rem' }}
            >
              {isAdvancingTimer ? (
                <><Loader2 size={11} className="animate-spin" /> Advancing...</>
              ) : (
                <><Clock size={11} /> Skip 48h Cooldown</>
              )}
            </button>
          </div>

          {/* Loading Progress */}
          {(isEvaluatingDomain || isLoading) && (
            <div style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              color: '#38bdf8',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <Loader2 size={14} className="animate-spin" />
              <span>
                {runningScenarioId
                  ? `Running scenario: ${runningScenarioId.replace(/_/g, ' ')}`
                  : isEvaluatingDomain
                  ? `Evaluating ${evaluatingDomainName || domainInput}...`
                  : 'Processing...'}
              </span>
            </div>
          )}

          {/* Success Banner */}
          {successBanner && (
            <div style={{
              marginTop: 8,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#34d399',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={14} />
                <span>
                  <strong>{successBanner.domain}</strong> evaluated in {successBanner.latencyMs}ms — {successBanner.crmWriteStatus}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessBanner(null)}
                style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer' }}
              >✕</button>
            </div>
          )}
        </div>

        {/* ========== SCORE OVERVIEW (compact 4-column) ========== */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 20,
        }}>
          {[
            { label: 'CloudSecure', value: Math.round(scores['product_a'] ?? 0), id: 'product_a' },
            { label: 'DataFlow', value: Math.round(scores['product_b'] ?? 0), id: 'product_b' },
            { label: 'FinanceOS', value: Math.round(scores['product_c'] ?? 0), id: 'product_c' },
            { label: 'Score Gap', value: delta, id: 'delta' },
          ].map((item) => {
            const isActive = displayContact.currentCampaign === item.id;
            const isDelta = item.id === 'delta';
            return (
              <div key={item.id} style={{
                background: isActive ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-surface)',
                border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-hairline)'}`,
                borderRadius: 8,
                padding: '12px 14px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  {item.label} {isActive && '★'}
                </div>
                <div className="font-mono" style={{
                  fontSize: isDelta ? '1.1rem' : '1.3rem',
                  fontWeight: 700,
                  color: isDelta
                    ? (item.value >= 25 ? '#34d399' : '#fff')
                    : isActive ? '#34d399' : '#fff',
                }}>
                  {isDelta ? (item.value >= 0 ? `+${item.value.toFixed(1)}` : item.value.toFixed(1)) : item.value}
                </div>
                {isDelta && (
                  <div style={{ fontSize: '0.68rem', color: item.value >= 25 ? '#34d399' : 'var(--text-muted)', marginTop: 2 }}>
                    {item.value >= 25 ? 'Threshold met (≥25)' : 'Below threshold'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ========== TEST SCENARIOS (collapsed by default) ========== */}
        <details style={{ marginBottom: 16 }}>
          <summary style={{
            cursor: 'pointer',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            listStyle: 'none',
          }}>
            <Zap size={14} color="#fbbf24" />
            Test Scenarios — Run pre-built evaluation cases
            <ChevronDown size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
          </summary>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            padding: 16,
          }}>
            <ScenarioDispatcher
              onDispatchScenario={handleDispatchScenario}
              onAdvanceTimer={handleAdvanceTimer}
              onOpenCustomModal={() => setIsCustomModalOpen(true)}
              onEvaluateCommittee={handleEvaluateCommittee}
              isLoading={isLoading}
              activeScenarioId={activeScenarioId}
              isInCooldown={isInCooldown}
              runningScenarioId={runningScenarioId}
              isAdvancingTimer={isAdvancingTimer}
              isEvaluatingCommittee={isEvaluatingDomain}
            />
          </div>
        </details>

        {/* ========== FEEDBACK LOOP (collapsed by default) ========== */}
        <details style={{ marginBottom: 16 }}>
          <summary style={{
            cursor: 'pointer',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            listStyle: 'none',
          }}>
            <TrendingUp size={14} color="var(--accent-lime)" />
            Downstream Feedback — See how outcomes recalibrate signal weights
            <ChevronDown size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
          </summary>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            padding: 16,
          }}>
            {/* Weight Snapshot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: '0.78rem', marginBottom: 14 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Current Signal Weights:</span>
              {[
                { label: '1st-Party', key: '1st_party_direct', fallback: 1.0 },
                { label: 'Passive', key: '1st_party_passive', fallback: 0.7 },
                { label: 'Reviews', key: '2nd_party', fallback: 0.7 },
                { label: 'Bombora', key: '3rd_party', fallback: 0.5 },
                { label: 'Firmographic', key: 'firmographic', fallback: 0.3 },
              ].map((w) => (
                <span key={w.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{w.label}:</span>
                  <span className="font-mono" style={{ color: '#fff', fontWeight: 600 }}>
                    {((data.sourceWeights as Record<string, number> | undefined)?.[w.key] ?? w.fallback).toFixed(2)}
                  </span>
                </span>
              ))}
            </div>

            {/* Feedback Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { type: 'meeting_booked' as const, label: '+ Meeting Booked', delta: '+0.08', color: 'var(--accent-lime)', borderColor: 'rgba(52, 211, 153, 0.4)' },
                { type: 'email_reply' as const, label: '+ Email Reply', delta: '+0.05', color: '#22d3ee', borderColor: 'rgba(34, 211, 238, 0.4)' },
                { type: 'deal_lost' as const, label: '− Deal Lost', delta: '-0.05', color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' },
                { type: 'unsubscribed' as const, label: '− Unsubscribed', delta: '-0.08', color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.4)' },
              ].map((fb) => (
                <button
                  key={fb.type}
                  type="button"
                  className={`btn btn-secondary ${runningFeedbackType === fb.type ? 'running-shimmer' : ''}`}
                  disabled={isLoading}
                  onClick={() => handleTriggerFeedback(fb.type, fb.delta)}
                  style={{ fontSize: '0.76rem', padding: '6px 12px', color: fb.color, borderColor: fb.borderColor }}
                >
                  {runningFeedbackType === fb.type ? (
                    <><Loader2 size={11} className="animate-spin" /> Recalibrating...</>
                  ) : (
                    `${fb.label} (${fb.delta})`
                  )}
                </button>
              ))}
            </div>

            {/* Feedback notices */}
            {feedbackNotice && (
              <div style={{
                marginTop: 10,
                background: 'rgba(52, 211, 153, 0.08)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                color: 'var(--accent-lime)',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <CheckCircle2 size={13} /> {feedbackNotice}
              </div>
            )}

            {/* Webhook info */}
            <div style={{ marginTop: 12, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Production webhook: <code style={{ color: '#e2e8f0' }}>POST /api/engine/feedback</code> (HMAC-SHA256 signed)
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(`${window.location.origin}/api/engine/webhook`);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2500);
                  }
                }}
                className="btn btn-outline"
                style={{ padding: '2px 8px', fontSize: '0.65rem', height: 22, marginLeft: 8 }}
              >
                {copiedWebhook ? 'Copied!' : 'Copy URL'}
              </button>
            </div>
          </div>
        </details>

        {/* ========== ACCOUNT & PROSPECT DETAIL (collapsed by default) ========== */}
        <details style={{ marginBottom: 16 }}>
          <summary style={{
            cursor: 'pointer',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            listStyle: 'none',
          }}>
            <Building2 size={14} color="#60a5fa" />
            Account & Prospect Details
            <span className="pill pill-neutral font-mono" style={{ fontSize: '0.65rem', marginLeft: 6 }}>
              {displayAccount?.name || 'None'}
            </span>
            <ChevronDown size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
          </summary>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            padding: 16,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ProspectOverview prospect={synchronizedProspect} scores={scores} delta={delta} />
              <StateMachineVisualizer
                currentState={prospect.fsmState}
                previousState={prospect.previousState}
                stateEnteredAt={prospect.stateEnteredAt}
                reasoning={lastDecisionOutcome?.reasoning}
              />
            </div>
          </div>
        </details>

        {/* ========== DEEP ANALYSIS TABS (collapsed by default) ========== */}
        <details style={{ marginBottom: 20 }}>
          <summary style={{
            cursor: 'pointer',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            listStyle: 'none',
          }}>
            <Sliders size={14} color="#a78bfa" />
            Deep Analysis — Decision logic, buying committee, CRM payloads, audit log
            <span className="pill pill-neutral font-mono" style={{ fontSize: '0.65rem', marginLeft: 6 }}>
              {auditLedger.length} events
            </span>
            <ChevronDown size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
          </summary>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            padding: 0,
          }}>
            <div className="panel" style={{ border: 'none', borderRadius: 0 }}>
              {/* Tab Navigation */}
              <div className="panel-header" style={{ padding: '8px 14px' }}>
                <div className="tab-nav">
                  <button
                    className={`tab-nav-btn ${activeTab === 'decision' ? 'active' : ''}`}
                    onClick={() => setActiveTab('decision')}
                  >
                    <Calculator size={13} />
                    Decision Logic
                  </button>
                  <button
                    className={`tab-nav-btn ${activeTab === 'committee' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('committee');
                      if (!committeeData && !data.lastBuyingCommitteeResolution && domainInput.trim()) {
                        handleEvaluateCommittee(domainInput);
                      }
                    }}
                  >
                    <Users size={13} color={activeTab === 'committee' ? '#38bdf8' : 'currentColor'} />
                    Buying Committee
                    <span className="pill pill-neutral font-mono" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
                      {committeeData?.totalContactsEvaluated ?? data.lastBuyingCommitteeResolution?.totalContactsEvaluated ?? '—'}
                    </span>
                  </button>
                  <button
                    className={`tab-nav-btn ${activeTab === 'briefing' ? 'active' : ''}`}
                    onClick={() => setActiveTab('briefing')}
                  >
                    <ShieldAlert size={13} color={isEscalated ? '#f87171' : 'currentColor'} />
                    Sales Briefing
                    {isEscalated && <span className="pill pill-critical" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Escalated</span>}
                  </button>
                  <button
                    className={`tab-nav-btn ${activeTab === 'crm' ? 'active' : ''}`}
                    onClick={() => setActiveTab('crm')}
                  >
                    <Database size={13} />
                    CRM Sync
                  </button>
                  <button
                    className={`tab-nav-btn ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audit')}
                  >
                    <History size={13} />
                    Audit Log
                    <span className="pill pill-neutral font-mono" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
                      {auditLedger.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Tab Body */}
              <div className="panel-body">
                {activeTab === 'decision' && (
                  <DecisionBreakdown
                    outcome={lastDecisionOutcome}
                    currentCampaign={prospect.contact.currentCampaign}
                    prospect={prospect}
                    jevDetails={lastJevDetails}
                  />
                )}
                {activeTab === 'committee' && (
                  <BuyingCommitteeViewer
                    committeeData={committeeData || data.lastBuyingCommitteeResolution}
                    consolidatedTaskResult={data.lastConsolidatedTaskResult}
                    onRefresh={() => handleEvaluateCommittee(domainInput)}
                    isLoading={isLoading}
                  />
                )}
                {activeTab === 'briefing' && (
                  <AiBriefingPanel
                    prospect={synchronizedProspect}
                    isEscalated={isEscalated}
                    briefing={data.lastBriefing}
                    isLoading={isLoading}
                    onTriggerEscalation={() => handleDispatchScenario('scenario_4_enterprise_escalation')}
                  />
                )}
                {activeTab === 'crm' && (
                  <CrmPayloadViewer
                    payload={lastSyncPayload}
                    liveSyncResult={data?.lastLiveSyncResult}
                    committeeResolution={committeeData || data?.lastBuyingCommitteeResolution}
                    domain={domainInput || committeeData?.domain || synchronizedProspect.account.domain}
                    isLoading={isLoading}
                    onTriggerEvaluation={handleEvaluateCommittee}
                  />
                )}
                {activeTab === 'audit' && (
                  <AuditLog entries={auditLedger} />
                )}
              </div>
            </div>
          </div>
        </details>
      </main>

      {/* Custom Signal Injection Modal */}
      <CustomEventModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        isLoading={isLoading}
        onSubmit={handleDispatchCustom}
      />

      {/* Platform Architecture & RevOps Guide Modal */}
      <PlatformGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
