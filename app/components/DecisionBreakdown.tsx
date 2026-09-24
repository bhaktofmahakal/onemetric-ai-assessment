'use client';

import React from 'react';
import type { DecisionOutcome, ProspectState } from '@/src/types';
import { Calculator, CheckCircle2, XCircle, ShieldCheck, Brain, AlertCircle } from 'lucide-react';

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

  const { decision, delta, scores, guards, reasoning, confidence } = outcome;
  
  // Resolve enrolled product and competing product correctly
  const enrolledCampaign = currentCampaign ?? prospect?.contact.currentCampaign ?? 'product_b';
  const currentProduct = enrolledCampaign;
  const otherProducts = Object.keys(scores).filter((p) => p !== currentProduct);
  const competingProduct = otherProducts.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))[0] ?? (currentProduct === 'product_b' ? 'product_a' : 'product_b');

  const currentScore = scores[currentProduct] ?? 0;
  const competingScore = scores[competingProduct] ?? 0;

  const isRelativeGatePassed = delta >= 25;
  const isAbsoluteGatePassed = competingScore >= 50;
  const isDualGatePassed = isRelativeGatePassed && isAbsoluteGatePassed;

  return (
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
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <Brain size={14} color="var(--text-secondary)" />
                  Probabilistic Action Distribution
                </div>
                <span className="font-mono" style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
                  {jevDetails.latencyMs.toFixed(2)}ms • {jevDetails.engineUsed === 'jev_live' ? 'TypeSafe Jev Live (System One)' : 'TypeSafe Jev (System One Calibrated)'}
                </span>
              </div>

              {/* Probability Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {Object.entries(jevDetails.probabilities).map(([action, prob]) => {
                  const isWinner = action === decision;
                  const pct = Math.round(prob * 100);

                  return (
                    <div
                      key={action}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '145px 1fr 38px',
                        alignItems: 'center',
                        gap: 12,
                        fontSize: '0.72rem',
                      }}
                    >
                      <span
                        style={{
                          color: isWinner ? '#fff' : 'var(--text-secondary)',
                          fontWeight: isWinner ? 600 : 400,
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          letterSpacing: '0.02em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {action}
                      </span>

                      <div
                        style={{
                          height: 6,
                          background: 'rgba(255, 255, 255, 0.06)',
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: isWinner ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
                            transition: 'width 0.25s ease',
                          }}
                        />
                      </div>

                      <span
                        className="font-mono"
                        style={{
                          textAlign: 'right',
                          color: isWinner ? '#fff' : 'var(--text-muted)',
                          fontWeight: 500,
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Risk Factors */}
            <div
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: '1px solid var(--border-hairline)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                fontSize: '0.7rem',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Intent Confidence</div>
                <div style={{ fontWeight: 600, color: '#fff', marginTop: 2 }}>
                  {(jevDetails.intentConfidence * 100).toFixed(0)}%
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>Flapping Risk</div>
                <div style={{ fontWeight: 600, color: jevDetails.flappingRisk > 0.4 ? '#f87171' : '#34d399', marginTop: 2 }}>
                  {(jevDetails.flappingRisk * 100).toFixed(0)}%
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>Persona Risk</div>
                <div style={{ fontWeight: 600, color: jevDetails.personaMismatchRisk > 0.4 ? '#f87171' : '#34d399', marginTop: 2 }}>
                  {(jevDetails.personaMismatchRisk * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
