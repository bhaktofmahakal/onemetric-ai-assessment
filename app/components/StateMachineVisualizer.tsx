'use client';

import React from 'react';
import type { FSMState } from '@/src/types';
import { GitBranch, Clock, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface StateMachineVisualizerProps {
  currentState: FSMState;
  previousState: FSMState | null;
  stateEnteredAt: string;
  reasoning?: string;
}

interface StateNodeConfig {
  key: FSMState;
  label: string;
  badge: string;
  description: string;
}

const STATES: StateNodeConfig[] = [
  {
    key: 'ACTIVE_CURRENT',
    label: 'ACTIVE_CURRENT',
    badge: 'Standard Cadence',
    description: 'Prospect actively enrolled in existing BU campaign sequence.',
  },
  {
    key: 'MONITORING',
    label: 'MONITORING',
    badge: '15 ≤ Δ < 25',
    description: 'Competing intent detected; heightened logging without cadence disruption.',
  },
  {
    key: 'EVALUATION_COOLDOWN',
    label: 'EVAL_COOLDOWN',
    badge: '48h Hysteresis',
    description: 'Dual-gate passed; campaign held for 48h to verify signal persistence.',
  },
  {
    key: 'SWITCHING',
    label: 'SWITCHING',
    badge: 'Cross-BU Handover',
    description: 'Atomic campaign transfer with graceful disenrollment and multi-touch credit.',
  },
  {
    key: 'ESCALATED',
    label: 'ESCALATED',
    badge: 'Sales Review',
    description: 'Multi-product intent conflict or open enterprise deal routed to sales.',
  },
  {
    key: 'PAUSED',
    label: 'PAUSED',
    badge: 'Frequency Capped',
    description: 'Outreach held to protect prospect from inbox fatigue (max 2 touches/7d).',
  },
];

export const StateMachineVisualizer: React.FC<StateMachineVisualizerProps> = ({
  currentState,
  previousState,
  stateEnteredAt,
  reasoning,
}) => {
  return (
    <div className="panel" style={{ height: '100%' }}>
      <div className="panel-header">
        <div className="panel-title">
          <GitBranch size={14} color="var(--text-secondary)" />
          Deterministic Finite State Machine
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <Clock size={12} />
          <span>Active State: <strong style={{ color: '#fff' }}>{currentState}</strong></span>
        </div>
      </div>

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 3x2 State Node Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}
        >
          {STATES.map((st) => {
            const isActive = st.key === currentState;
            const wasPrevious = st.key === previousState;

            return (
              <div
                key={st.key}
                className={`fsm-node ${isActive ? 'active-state' : ''}`}
                style={{
                  border: isActive
                    ? '1px solid rgba(255, 255, 255, 0.4)'
                    : wasPrevious
                    ? '1px dashed var(--border-subtle)'
                    : '1px solid var(--border-hairline)',
                  background: isActive ? 'rgba(255, 255, 255, 0.05)' : 'var(--bg-inset)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '0.725rem',
                      fontWeight: 600,
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {st.label}
                  </span>
                  {isActive && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#34d399',
                      }}
                    />
                  )}
                  {wasPrevious && !isActive && (
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Prior</span>
                  )}
                </div>

                <div style={{ fontSize: '0.675rem', color: isActive ? 'var(--accent-lime)' : 'var(--text-muted)', fontWeight: 500 }}>
                  {st.badge}
                </div>

                <div
                  style={{
                    fontSize: '0.675rem',
                    color: 'var(--text-secondary)',
                    marginTop: 3,
                    lineHeight: 1.35,
                  }}
                >
                  {st.description}
                </div>
              </div>
            );
          })}
        </div>

        {/* Transition Summary Bar */}
        <div
          style={{
            background: 'var(--bg-inset)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            border: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Recent Transition:
            </span>
            <span className="pill pill-neutral font-mono">{previousState ?? 'NONE'}</span>
            <ArrowRight size={13} color="var(--text-muted)" />
            <span className="pill pill-active font-mono" style={{ color: '#fff' }}>
              {currentState}
            </span>
          </div>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ShieldCheck size={13} color="var(--state-active)" />
            <span>Guards Enforced</span>
          </div>
        </div>

        {/* State Rationale Box */}
        {reasoning && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-hairline)',
              fontSize: '0.725rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: '#fff', marginRight: 6 }}>Transition Rationale:</strong>
            {reasoning}
          </div>
        )}
      </div>
    </div>
  );
};
