'use client';

import React from 'react';
import type { DecisionOutcome, ProspectState } from '@/src/types';
import { Calculator, CheckCircle2, XCircle, ShieldCheck, Brain, AlertCircle, Activity, Zap } from 'lucide-react';

interface DecisionBreakdownProps {
  outcome: DecisionOutcome | null;
  currentCampaign?: string | null;
  prospect?: ProspectState | null;
  jevDetails: {
    probabilities: Record<string, number>;
    intentConfidence: number;
    flappingRisk: number;
    personaMismatchRisk: number;
    latencyMs: number;
    engineUsed: string;
  } | null;
}

export const DecisionBreakdown: React.FC<DecisionBreakdownProps> = ({
  outcome,
  currentCampaign,
  prospect,
  jevDetails,
}) => {
  if (!outcome) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '30px 20px', textAlign: 'center' }}>
        No evaluation data available. Dispatch a scenario to review engine decision analysis.
      </div>
    );
  }

  const { decision, delta, scores, guards, reasoning, confidence, latencyMs } = outcome;
  
  // Resolve enrolled product and competing product dynamically from score distribution
  const scoreKeys = Object.keys(scores);
  const defaultCurrent = scoreKeys[0] || 'product_b';
  const enrolledCampaign = currentCampaign ?? prospect?.contact.currentCampaign ?? defaultCurrent;
  const currentProduct = enrolledCampaign;
  const otherProducts = scoreKeys.filter((p) => p !== currentProduct);
  const competingProduct =
    otherProducts.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))[0] ??
    (otherProducts[0] || currentProduct);

  const currentScore = scores[currentProduct] ?? 0;
  const competingScore = scores[competingProduct] ?? 0;

  const isRelativeGatePassed = delta >= 25;
  const isAbsoluteGatePassed = competingScore >= 50;
  const isDualGatePassed = isRelativeGatePassed && isAbsoluteGatePassed;

  const decisionPillClass =
    decision === 'escalate'
      ? 'pill-critical'
      : decision === 'switch'
      ? 'pill-active'
      : decision === 'pause_cooldown'
      ? 'pill-warning'
      : 'pill-neutral';

  const decisionGlowColor =
    decision === 'escalate'
      ? '#ef4444'
      : decision === 'switch'
      ? '#3b82f6'
      : decision === 'pause_cooldown'
      ? '#f59e0b'
      : '#10b981';

  const effectiveLatency = jevDetails?.latencyMs ?? latencyMs ?? 0;

  // Dynamically normalize confidence & risk factors to 0-100 range
  const rawIntentConf = jevDetails?.intentConfidence ?? confidence ?? 0.85;
  const normalizedIntentConf = rawIntentConf > 1 ? Math.min(100, Math.round(rawIntentConf)) : Math.round(rawIntentConf * 100);
  const intentLevelLabel = normalizedIntentConf >= 75 ? '(High)' : normalizedIntentConf >= 50 ? '(Moderate)' : '(Low)';

  const rawFlapping = jevDetails?.flappingRisk ?? 0.12;
  const normalizedFlapping = rawFlapping > 1 ? Math.min(100, Math.round(rawFlapping)) : Math.round(rawFlapping * 100);

  const rawPersonaRisk = jevDetails?.personaMismatchRisk ?? (outcome.personaMismatch ? 0.92 : 0.05);
  const normalizedPersonaRisk = rawPersonaRisk > 1 ? Math.min(100, Math.round(rawPersonaRisk)) : Math.round(rawPersonaRisk * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Banner: Evaluated Autonomous Decision & Engine Telemetry */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--bg-inset)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-md)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: decisionGlowColor,
              boxShadow: `0 0 10px ${decisionGlowColor}`,
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{
                fontSize: '0.675rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              Evaluated Autonomous RevOps Action
            </div>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 3,
                flexWrap: 'wrap',
              }}
            >
              <span
                className={`pill ${decisionPillClass}`}
                style={{
                  fontSize: '0.78rem',
                  padding: '3px 10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: 700,
                }}
              >
                DECISION: {decision.replace('_', ' ')}
              </span>
              <span className="font-mono" style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
                {(confidence * 100).toFixed(0)}% Certainty
              </span>
              {outcome.personaMismatch && (
                <span className="pill pill-warning" style={{ fontSize: '0.65rem' }}>
                  ⚠ Persona Mismatch
                </span>
              )}
              {outcome.crossBUNotification && (
                <span className="pill pill-critical" style={{ fontSize: '0.65rem' }}>
                  ⚠ Cross-BU Conflict
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.72rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Decision Engine
            </span>
            <span className="font-mono" style={{ color: '#fff', fontWeight: 600, marginTop: 1 }}>
              {jevDetails?.engineUsed === 'jev_live'
                ? 'TypeSafe Jev (System One Live)'
                : 'TypeSafe Jev (System One Calibrated)'}
            </span>
          </div>
          <div style={{ width: 1, height: 26, background: 'var(--border-hairline)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Inference Latency
            </span>
            <span className="font-mono" style={{ color: '#10b981', fontWeight: 700, marginTop: 1 }}>
              ⚡ {effectiveLatency.toFixed(2)}ms
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Column 1: Dual-Gate & FSM Guards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Dual-Gate Card */}
          <div
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Dual-Gate Threshold Verification
              </span>
              <span className={`pill ${isDualGatePassed ? 'pill-active' : 'pill-warning'}`}>
                {isDualGatePassed ? 'Dual-Gate: Passed' : 'Dual-Gate: Blocked'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.725rem' }}>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {isRelativeGatePassed ? (
                  <CheckCircle2 size={14} color="#34d399" />
                ) : (
                  <XCircle size={14} color="#f87171" />
                )}
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Relative Gap (Δ)</div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>
                    {delta.toFixed(1)} <span style={{ color: 'var(--text-muted)' }}>/ 25.0 pts</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {isAbsoluteGatePassed ? (
                  <CheckCircle2 size={14} color="#34d399" />
                ) : (
                  <XCircle size={14} color="#f87171" />
                )}
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Absolute Intent Floor</div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>
                    {competingScore.toFixed(1)} <span style={{ color: 'var(--text-muted)' }}>/ 50.0 pts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FSM Guards Checklist */}
          <div
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ShieldCheck size={13} color="var(--text-secondary)" />
              Rules-Governed Safety Guards ({guards.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {guards.map((g, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    fontSize: '0.7rem',
                  }}
                >
                  {g.passed ? (
                    <CheckCircle2 size={13} color="#34d399" style={{ flexShrink: 0, marginTop: 1 }} />
                  ) : (
                    <AlertCircle size={13} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                  )}
                  <div>
                    <strong style={{ color: '#fff', marginRight: 4 }}>{g.guardName}:</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{g.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 2: Jev Probabilistic Distribution & Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {jevDetails && (
            <div
              style={{
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <Brain size={14} color="var(--text-secondary)" />
                    Jev Probabilistic Action Distribution
                  </div>
                  <span className="font-mono" style={{ fontSize: '0.675rem', color: '#10b981' }}>
                    Telemetry Stream
                  </span>
                </div>

                {/* Monospace ASCII Block Probability Bars (Identical to CLI test-engine) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(jevDetails.probabilities).map(([action, prob]) => {
                    const isWinner = action === decision;
                    const pct = Math.round(prob * 100);
                    const totalBlocks = 22;
                    const numBlocks = Math.max(isWinner && pct > 0 ? 1 : 0, Math.round(prob * totalBlocks));
                    const blockBar = '█'.repeat(numBlocks);
                    const emptyBar = '░'.repeat(Math.max(0, totalBlocks - numBlocks));

                    return (
                      <div
                        key={action}
                        className="font-mono"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '135px 1fr 40px',
                          alignItems: 'center',
                          gap: 10,
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: isWinner ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.015)',
                          border: `1px solid ${isWinner ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-hairline)'}`,
                          fontSize: '0.71rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          {isWinner ? (
                            <CheckCircle2 size={12} color="#10b981" style={{ flexShrink: 0 }} />
                          ) : (
                            <div
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                border: '1px solid rgba(255,255,255,0.2)',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <span
                            style={{
                              color: isWinner ? '#10b981' : 'var(--text-secondary)',
                              fontWeight: isWinner ? 700 : 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.02em',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {action}
                          </span>
                        </div>

                        {/* ASCII Block Visualizer */}
                        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                          <span
                            style={{
                              color: isWinner ? '#10b981' : 'rgba(255, 255, 255, 0.25)',
                              letterSpacing: '1px',
                              fontSize: '0.75rem',
                              lineHeight: 1,
                            }}
                          >
                            {blockBar}
                          </span>
                          <span
                            style={{
                              color: 'rgba(255, 255, 255, 0.05)',
                              letterSpacing: '1px',
                              fontSize: '0.75rem',
                              lineHeight: 1,
                            }}
                          >
                            {emptyBar}
                          </span>
                        </div>

                        <span
                          style={{
                            textAlign: 'right',
                            color: isWinner ? '#10b981' : 'var(--text-muted)',
                            fontWeight: isWinner ? 700 : 500,
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Autonomous Decision Rationale Card */}
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 3,
                    }}
                  >
                    Autonomous Decision Rationale
                  </div>
                  <div style={{ fontSize: '0.71rem', color: '#e2e8f0', lineHeight: 1.45 }}>
                    {reasoning ||
                      'Evaluated against deterministic FSM rules and calibrated TypeSafe Jev System One action distribution.'}
                  </div>
                </div>
              </div>

              {/* Risk Factors */}
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 8,
                  borderTop: '1px solid var(--border-hairline)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  fontSize: '0.7rem',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    padding: '5px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>Intent Confidence</div>
                  <div className="font-mono" style={{ fontWeight: 700, color: '#fff', marginTop: 1 }}>
                    {normalizedIntentConf}%{' '}
                    <span style={{ color: '#10b981', fontSize: '0.625rem' }}>{intentLevelLabel}</span>
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    padding: '5px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>Flapping Risk</div>
                  <div
                    className="font-mono"
                    style={{
                      fontWeight: 700,
                      color: normalizedFlapping > 40 ? '#f87171' : '#10b981',
                      marginTop: 1,
                    }}
                  >
                    {normalizedFlapping}%{' '}
                    <span style={{ fontSize: '0.625rem' }}>
                      {normalizedFlapping > 40 ? '(High)' : '(Stable)'}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    padding: '5px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>Persona Risk</div>
                  <div
                    className="font-mono"
                    style={{
                      fontWeight: 700,
                      color: normalizedPersonaRisk > 40 ? '#f87171' : '#10b981',
                      marginTop: 1,
                    }}
                  >
                    {normalizedPersonaRisk}%{' '}
                    <span style={{ fontSize: '0.625rem' }}>
                      {normalizedPersonaRisk > 40 ? '(Mismatch)' : '(Aligned)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

