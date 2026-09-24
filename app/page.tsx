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
import { Calculator, ShieldAlert, Database, History, CheckCircle2, ShieldCheck, Activity, Building2, Users, Globe, Play, Copy, Check, TrendingUp, Sliders, Layers, Loader2 } from 'lucide-react';

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
        // If state changed to escalated, switch tab to briefing
        if (json.data.prospect.fsmState === 'ESCALATED') {
          setActiveTab('briefing');
        }
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
  const hasEvaluated = !!(committeeData || data.lastBuyingCommitteeResolution);
  const displayAccount = committeeData?.account || (hasEvaluated ? prospect.account : null);
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

      <main className="app-container">
        {/* Live Background Ingestion Banner */}
        {liveWebhookToast && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '8px',
              padding: '10px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'pulse 2s infinite',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>
                ⚡ Dashboard State Updated from {liveWebhookToast.source.toUpperCase()}:
              </span>
              <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 700 }}>
                {liveWebhookToast.domain} ({liveWebhookToast.score} pts)
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                at {liveWebhookToast.timestamp}
              </span>
            </div>
            <span className="pill pill-active font-mono" style={{ fontSize: '0.625rem' }}>
              Demo evaluation recorded; check CRM status below
            </span>
          </div>
        )}
        {/* Buying committee evaluation card */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            marginBottom: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Globe size={16} color="#38bdf8" />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Buying Committee Evaluation
                  <span className="pill pill-active font-mono" style={{ fontSize: '0.625rem' }}>
                    Demo UI
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Review account-level intent scoring, committee routing, and any confirmed live integration outcomes.
                </div>
              </div>
            </div>

            {/* Live Webhook URL Snippet */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: '0.7rem',
              }}
            >
              <span style={{ color: 'var(--accent-lime)', fontWeight: 600 }}>POST</span>
              <code style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>/api/engine/webhook</code>
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
                style={{ padding: '2px 8px', fontSize: '0.65rem', height: 22 }}
                title="Copy webhook URL for Bombora / 6sense"
              >
                {copiedWebhook ? 'Copied!' : 'Copy Webhook'}
              </button>
            </div>
          </div>

          {/* Integration Status Sub-Bar */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: '0.675rem', paddingTop: 4, borderTop: '1px solid var(--border-hairline)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Integration capabilities:</span>
            <span className="pill pill-active font-mono" style={{ fontSize: '0.625rem' }}>
              ✓ Signal corroboration (status shown per result)
            </span>
            <span className="pill pill-active font-mono" style={{ fontSize: '0.625rem' }}>
              ✓ HubSpot REST read/write (requires credentials)
            </span>
            <span className="pill pill-active font-mono" style={{ fontSize: '0.625rem' }}>
              ✓ Bounded webhook agent loop (separate signed endpoint)
            </span>
            <span className="pill pill-active font-mono" style={{ fontSize: '0.625rem' }}>
              ✓ Deterministic FSM + optional TypeSafe decisions
            </span>
          </div>

          {/* Input & Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
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
                placeholder="Enter domain (e.g. stripe.com, snowflake.com)"
                style={{
                  flex: 1,
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '7px 12px',
                  color: '#fff',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => handleEvaluateCommittee(domainInput)}
                disabled={isLoading}
                className="btn btn-primary"
                style={{ padding: '7px 16px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
              >
                {isEvaluatingDomain ? (
                  <>
                    <Activity size={12} className="animate-spin" />
                    Evaluating {evaluatingDomainName || domainInput || 'domain'}...
                  </>
                ) : (
                  <>
                    <Play size={12} className={isLoading ? 'animate-spin' : ''} />
                    Evaluate Committee
                  </>
                )}
              </button>
            </div>

            {/* Quick 1-Click Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setDomainInput('techcorp.com');
                  handleEvaluateCommittee('techcorp.com');
                }}
                disabled={isLoading}
                className={`btn btn-secondary ${isEvaluatingDomain && evaluatingDomainName === 'techcorp.com' ? 'running-shimmer' : ''}`}
                style={{ padding: '6px 10px', fontSize: '0.7rem' }}
                title="Simulate CloudSecure 88 pts surge on techcorp.com with live digital footprint corroboration"
              >
                {isEvaluatingDomain && evaluatingDomainName === 'techcorp.com' ? (
                  <>
                    <Loader2 size={11} className="animate-spin" style={{ marginRight: 5 }} />
                    Evaluating techcorp.com...
                  </>
                ) : (
                  'Evaluate techcorp.com'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDomainInput('snowflake.com');
                  handleEvaluateCommittee('snowflake.com');
                }}
                disabled={isLoading}
                className={`btn btn-secondary ${isEvaluatingDomain && evaluatingDomainName === 'snowflake.com' ? 'running-shimmer' : ''}`}
                style={{ padding: '6px 10px', fontSize: '0.7rem' }}
                title="Evaluate Snowflake Inc. cross-BU conflict"
              >
                {isEvaluatingDomain && evaluatingDomainName === 'snowflake.com' ? (
                  <>
                    <Loader2 size={11} className="animate-spin" style={{ marginRight: 5 }} />
                    Evaluating snowflake.com...
                  </>
                ) : (
                  'Evaluate snowflake.com'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDomainInput('stripe.com');
                  handleEvaluateCommittee('stripe.com');
                }}
                disabled={isLoading}
                className={`btn btn-secondary ${isEvaluatingDomain && evaluatingDomainName === 'stripe.com' ? 'running-shimmer' : ''}`}
                style={{ padding: '6px 10px', fontSize: '0.7rem' }}
                title="Evaluate Stripe Inc. fintech buying committee"
              >
                {isEvaluatingDomain && evaluatingDomainName === 'stripe.com' ? (
                  <>
                    <Loader2 size={11} className="animate-spin" style={{ marginRight: 5 }} />
                    Evaluating stripe.com...
                  </>
                ) : (
                  'Evaluate stripe.com'
                )}
              </button>
              <button
                type="button"
                onClick={handleAdvanceTimer}
                disabled={isLoading}
                className={`btn btn-secondary ${isAdvancingTimer ? 'running-shimmer' : ''}`}
                style={{ padding: '6px 10px', fontSize: '0.7rem' }}
                title="Fast forward 48 hours for cooldown expiry cron evaluation"
              >
                {isAdvancingTimer ? (
                  <>
                    <Loader2 size={11} className="animate-spin" style={{ marginRight: 5 }} />
                    Advancing 48h (Cron)...
                  </>
                ) : (
                  'Advance 48h Cooldown (Cron)'
                )}
              </button>
            </div>
          </div>

          {/* Live Loading Progress State */}
          {isEvaluatingDomain && (
            <div
              style={{
                marginTop: 2,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                fontSize: '0.74rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Activity size={13} className="animate-spin" />
              <span>
                <strong>⚡ Running Account Evaluation:</strong> Reading available account signals → Applying decision guards → Recording CRM action results...
              </span>
            </div>
          )}

          {/* Execution Success Banner */}
          {successBanner && (
            <div
              style={{
                marginTop: 2,
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34d399',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={15} color="#34d399" />
                <span>
                  <strong>Agent {successBanner.agentStatus} for {successBanner.domain} ({successBanner.executionMode}, {successBanner.latencyMs}ms):</strong> Web check {successBanner.corroborationStatus} ({successBanner.corroborationScore}%, {successBanner.corroborationSource}) | {successBanner.crmWriteStatus} | {successBanner.taskStatus}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessBanner(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#34d399',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: '0 4px',
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Downstream Learning Feedback Loop — Observability & Auto-Tuning */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            marginBottom: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="var(--accent-lime)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                Source Weight Snapshot &amp; Outcome Ingestion
              </span>
              <span className="pill pill-active font-mono" style={{ fontSize: '0.625rem' }}>
                Signed Provider Events
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              This dashboard shows baseline/demo weights. Production outcomes update durable weights only through the signed server-to-server feedback endpoint.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            {/* Live Weight Indicators */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: '0.72rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>1st-Party Direct:</span>
                <span className="font-mono" style={{ color: '#fff', fontWeight: 600 }}>1.00</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>1st-Party Passive:</span>
                <span className="font-mono" style={{ color: '#fff', fontWeight: 600 }}>0.70</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>2nd-Party Reviews:</span>
                <span className="font-mono" style={{ color: '#fff', fontWeight: 600 }}>0.80</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(52, 211, 153, 0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                <span style={{ color: 'var(--accent-lime)', fontWeight: 600 }}>3rd-Party Intent (Bombora):</span>
                <span className="font-mono" style={{ color: 'var(--accent-lime)', fontWeight: 700, fontSize: '0.8rem' }}>
                  {(data.sourceWeights?.['3rd_party'] ?? 0.5).toFixed(2)}
                </span>
                <span className="pill pill-active font-mono" style={{ fontSize: '0.55rem', padding: '1px 4px' }}>
                  Dashboard Snapshot
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Firmographic:</span>
                <span className="font-mono" style={{ color: '#fff', fontWeight: 600 }}>0.40</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Simulate Downstream Conversion Outcomes (Learning Loop):
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  External Webhook: <code>POST /api/engine/feedback</code> (HMAC Signed)
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  type="button"
                  className={`btn btn-secondary ${runningFeedbackType === 'meeting_booked' ? 'running-shimmer' : ''}`}
                  disabled={isLoading}
                  onClick={() => handleTriggerFeedback('meeting_booked', '+0.08')}
                  style={{ fontSize: '0.72rem', padding: '4px 10px', color: 'var(--accent-lime)', borderColor: 'rgba(52, 211, 153, 0.4)' }}
                >
                  {runningFeedbackType === 'meeting_booked' ? (
                    <>
                      <Loader2 size={11} className="animate-spin" style={{ marginRight: 5 }} />
                      Recalibrating (+0.08)...
                    </>
                  ) : (
                    '+ Meeting Booked (+0.08)'
                  )}
                </button>
                <button
                  type="button"
                  className={`btn btn-secondary ${runningFeedbackType === 'email_reply' ? 'running-shimmer' : ''}`}
                  disabled={isLoading}
                  onClick={() => handleTriggerFeedback('email_reply', '+0.05')}
                  style={{ fontSize: '0.72rem', padding: '4px 10px', color: 'var(--accent-cyan)', borderColor: 'rgba(34, 211, 238, 0.4)' }}
                >
                  {runningFeedbackType === 'email_reply' ? (
                    <>
                      <Loader2 size={11} className="animate-spin" style={{ marginRight: 5 }} />
                      Recalibrating (+0.05)...
                    </>
                  ) : (
                    '+ Email Reply (+0.05)'
                  )}
                </button>
                <button
                  type="button"
                  className={`btn btn-secondary ${runningFeedbackType === 'deal_lost' ? 'running-shimmer' : ''}`}
                  disabled={isLoading}
                  onClick={() => handleTriggerFeedback('deal_lost', '-0.05')}
                  style={{ fontSize: '0.72rem', padding: '4px 10px', color: 'var(--accent-amber)', borderColor: 'rgba(251, 191, 36, 0.4)' }}
                >
                  {runningFeedbackType === 'deal_lost' ? (
                    <>
                      <Loader2 size={11} className="animate-spin" style={{ marginRight: 5 }} />
                      Recalibrating (-0.05)...
                    </>
                  ) : (
                    '- Deal Lost (-0.05)'
                  )}
                </button>
                <button
                  type="button"
                  className={`btn btn-secondary ${runningFeedbackType === 'unsubscribed' ? 'running-shimmer' : ''}`}
                  disabled={isLoading}
                  onClick={() => handleTriggerFeedback('unsubscribed', '-0.08')}
                  style={{ fontSize: '0.72rem', padding: '4px 10px', color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.4)' }}
                >
                  {runningFeedbackType === 'unsubscribed' ? (
                    <>
                      <Loader2 size={11} className="animate-spin" style={{ marginRight: 5 }} />
                      Recalibrating (-0.08)...
                    </>
                  ) : (
                    '- Unsubscribed (-0.08)'
                  )}
                </button>
              </div>
              {runningFeedbackType && (
                <div style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.74rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Loader2 size={12} className="animate-spin" />
                  <span>
                    <strong>⚡ Recalibrating Weights:</strong> Applying downstream Bayesian &amp; heuristic weight adjustments for <code>{runningFeedbackType}</code>...
                  </span>
                </div>
              )}
              {feedbackNotice && (
                <div style={{
                  background: 'rgba(52, 211, 153, 0.1)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  color: 'var(--accent-lime)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <span style={{ fontSize: '0.9rem' }}>✓</span> {feedbackNotice}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Minimalist KPI Ribbon */}
        <div className="kpi-ribbon" style={{ marginBottom: 18 }}>
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Active Prospect
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {committeeData?.account?.name || displayAccount?.name || '— Awaiting First Domain Evaluation —'}
              </div>
            </div>
            <span className="pill pill-neutral font-mono" style={{ flexShrink: 0 }}>{committeeData?.account?.tier ? `Tier ${committeeData.account.tier}` : displayAccount?.tier ? `Tier ${displayAccount.tier}` : 'Idle'}</span>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Current Journey
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {!hasEvaluated
                  ? '— Idle —'
                  : displayContact.currentCampaign === 'product_a'
                  ? 'CloudSecure'
                  : displayContact.currentCampaign === 'product_c'
                  ? 'FinanceOS'
                  : 'DataFlow'}
              </div>
            </div>
            <span className="pill pill-neutral font-mono" style={{ flexShrink: 0 }}>{displayAccount?.ownerBU || (hasEvaluated ? 'BU_Analytics' : 'Standby')}</span>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Hysteresis Gap
              </div>
              <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: delta >= 25 ? '#34d399' : '#fff', marginTop: 2, whiteSpace: 'nowrap' }}>
                Δ = {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} pts
              </div>
            </div>
            <span className={`pill ${delta >= 25 ? 'pill-active' : 'pill-neutral'}`} style={{ flexShrink: 0 }}>
              {delta >= 25 ? 'Threshold Met' : 'Normal'}
            </span>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Safety Boundaries
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Dual-Gate &amp; Fatigue
              </div>
            </div>
            <span className="pill pill-active font-mono" style={{ flexShrink: 0 }}>Enforced</span>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#fca5a5',
              fontSize: '0.78rem',
              marginBottom: 18,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Upper 3-Column Grid */}
        <div className="top-grid">
          <div>
            <ProspectOverview prospect={synchronizedProspect} scores={scores} delta={delta} />
          </div>

          <div>
            <StateMachineVisualizer
              currentState={prospect.fsmState}
              previousState={prospect.previousState}
              stateEnteredAt={prospect.stateEnteredAt}
              reasoning={lastDecisionOutcome?.reasoning}
            />
          </div>

          <div className="top-grid-right">
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
        </div>

        {/* Lower Tabbed Inspector Section */}
        <div style={{ marginTop: 20 }}>
          <div className="panel">
            {/* Header with Navigation Tabs */}
            <div className="panel-header" style={{ padding: '8px 14px' }}>
              <div className="tab-nav">
                <button
                  className={`tab-nav-btn ${activeTab === 'decision' ? 'active' : ''}`}
                  onClick={() => setActiveTab('decision')}
                >
                  <Calculator size={13} />
                  Decision &amp; Guard Analysis
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
                  Buying Committee Resolution
                  <span className="pill pill-neutral font-mono" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
                    {committeeData?.totalContactsEvaluated ?? data.lastBuyingCommitteeResolution?.totalContactsEvaluated ?? '—'}
                  </span>
                </button>
                <button
                  className={`tab-nav-btn ${activeTab === 'briefing' ? 'active' : ''}`}
                  onClick={() => setActiveTab('briefing')}
                >
                  <ShieldAlert size={13} color={isEscalated ? '#f87171' : 'currentColor'} />
                  Sales Executive Briefing
                  {isEscalated && <span className="pill pill-critical" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Escalated</span>}
                </button>
                <button
                  className={`tab-nav-btn ${activeTab === 'crm' ? 'active' : ''}`}
                  onClick={() => setActiveTab('crm')}
                >
                  <Database size={13} />
                  HubSpot CRM Sync Payloads
                </button>
                <button
                  className={`tab-nav-btn ${activeTab === 'audit' ? 'active' : ''}`}
                  onClick={() => setActiveTab('audit')}
                >
                  <History size={13} />
                  System Audit Ledger
                  <span className="pill pill-neutral font-mono" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
                    {auditLedger.length}
                  </span>
                </button>
              </div>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {activeTab === 'decision' && 'Deterministic FSM & Calibrated Jev Engine'}
                {activeTab === 'committee' && `Parallel Multi-Contact Resolution${committeeData?.domain ? ` (${committeeData.domain})` : ''}`}
                {activeTab === 'briefing' && 'Cross-Sell Context & Account Memo'}
                {activeTab === 'crm' && 'Idempotent REST API v3 Payloads'}
                {activeTab === 'audit' && 'Immutable Chronological Event Log'}
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
      </main>

      {/* Custom Signal Injection Modal */}
      <CustomEventModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        isLoading={isLoading}
        onSubmit={handleDispatchCustom}
      />

      {/* Platform Architecture & Zero-Code User Guide Modal */}
      <PlatformGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
