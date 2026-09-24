'use client';

import React from 'react';
import { Play, Clock, Sliders, Users, Loader2 } from 'lucide-react';

interface ScenarioDispatcherProps {
  onDispatchScenario: (scenarioId: string) => void;
  onAdvanceTimer: () => void;
  onOpenCustomModal: () => void;
  onEvaluateCommittee?: () => void;
  isLoading: boolean;
  activeScenarioId: string | null;
  isInCooldown: boolean;
  runningScenarioId?: string | null;
  isAdvancingTimer?: boolean;
  isEvaluatingCommittee?: boolean;
}

interface ScenarioBtn {
  id: string;
  name: string;
  badge: string;
  badgeClass: string;
  description: string;
  policy: string;
}

const SCENARIOS: ScenarioBtn[] = [
  {
    id: 'scenario_1_zero_baseline',
    name: 'Uncorroborated Surge',
    badge: 'Dual-Gate Protection',
    badgeClass: 'pill-warning',
    description: 'Isolated 3rd-party surge on fresh enrollment. Relative gap high but absolute intent below floor.',
    policy: 'Held by Absolute Floor (Score < 50)',
  },
  {
    id: 'scenario_2_valid_switch',
    name: 'Corroborated Buying Intent',
    badge: 'Multi-Touch Passed',
    badgeClass: 'pill-active',
    description: 'Corroborated intent across G2 pricing and direct case study download. Enters verification hold.',
    policy: 'Initiates 48h Hysteresis Hold',
  },
  {
    id: 'scenario_3_persona_mismatch',
    name: 'Cross-Department Inquiry',
    badge: 'Persona Verification',
    badgeClass: 'pill-neutral',
    description: 'Domain-level surge for Finance ERP software, but contact is VP of Engineering.',
    policy: 'Held by Buyer Persona Guard',
  },
  {
    id: 'scenario_4_enterprise_escalation',
    name: 'Enterprise Account Conflict',
    badge: 'Sales Escalation',
    badgeClass: 'pill-critical',
    description: 'Tier-1 enterprise account with open opportunity ($120K) showing high intent across multiple BUs.',
    policy: 'Escalated to Assigned AE',
  },
];

export const ScenarioDispatcher: React.FC<ScenarioDispatcherProps> = ({
  onDispatchScenario,
  onAdvanceTimer,
  onOpenCustomModal,
  onEvaluateCommittee,
  isLoading,
  activeScenarioId,
  isInCooldown,
  runningScenarioId,
  isAdvancingTimer = false,
  isEvaluatingCommittee = false,
}) => {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <Play size={14} color="var(--text-secondary)" />
          Intent Simulation Scenarios
        </div>
        <div>
          <button
            onClick={onOpenCustomModal}
            disabled={isLoading}
            className="btn btn-outline"
            style={{ padding: '4px 10px', fontSize: '0.725rem' }}
          >
            <Sliders size={12} />
            Custom Signal
          </button>
        </div>
      </div>

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Scenario Action Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SCENARIOS.map((sc) => {
            const isSelected = activeScenarioId === sc.id;
            const isRunning = runningScenarioId === sc.id;

            return (
              <div
                key={sc.id}
                onClick={() => !isLoading && onDispatchScenario(sc.id)}
                className={isRunning ? 'running-shimmer' : ''}
                style={{
                  background: isRunning
                    ? 'rgba(56, 189, 248, 0.08)'
                    : isSelected
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'var(--bg-inset)',
                  border: isRunning
                    ? '1px solid rgba(56, 189, 248, 0.5)'
                    : isSelected
                    ? '1px solid var(--border-strong)'
                    : '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sc.name}
                  </span>
                  {isRunning ? (
                    <span className="action-running-indicator" style={{ fontSize: '0.625rem', flexShrink: 0 }}>
                      <Loader2 size={11} className="animate-spin" />
                      Running Simulation...
                    </span>
                  ) : (
                    <span className={`pill ${sc.badgeClass}`} style={{ fontSize: '0.625rem', flexShrink: 0 }}>
                      {sc.badge}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                  {sc.description}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    paddingTop: 4,
                    borderTop: '1px solid var(--border-hairline)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.675rem',
                    color: 'var(--text-muted)',
                    gap: 8,
                  }}
                >
                  <span style={{ flexShrink: 0 }}>Policy Enforced:</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sc.policy}</span>
                </div>

                {isRunning && (
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.675rem', color: '#38bdf8', fontWeight: 500 }}>
                    <Loader2 size={11} className="animate-spin" />
                    Running deterministic FSM guards &amp; agent decision cycle...
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 48h Cooldown Timer Advance Action */}
        <div
          style={{
            background: isInCooldown ? 'rgba(249, 115, 22, 0.08)' : 'var(--bg-inset)',
            border: isInCooldown ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Clock size={15} color={isInCooldown ? '#fb923c' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>
                Hysteresis Verification Window
              </div>
              <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isInCooldown
                  ? 'Currently in 48h hold. Advance clock to test persistence.'
                  : 'Fast-forward clock 48h to evaluate time-decay factor.'}
              </div>
            </div>
          </div>

          <button
            onClick={onAdvanceTimer}
            disabled={isLoading}
            className={`btn ${isInCooldown ? 'btn-primary' : 'btn-secondary'} ${isAdvancingTimer ? 'running-shimmer' : ''}`}
            style={{ padding: '5px 10px', fontSize: '0.725rem', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {isAdvancingTimer ? (
              <>
                <Loader2 size={12} className="animate-spin" style={{ marginRight: 5 }} />
                Advancing 48h...
              </>
            ) : (
              'Advance 48h'
            )}
          </button>
        </div>

        {/* Multi-Contact Buying Committee Action */}
        {onEvaluateCommittee && (
          <div
            onClick={onEvaluateCommittee}
            className={isEvaluatingCommittee ? 'running-shimmer' : ''}
            style={{
              background: isEvaluatingCommittee ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.05)',
              border: isEvaluatingCommittee ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              gap: 10,
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Users size={15} color="#38bdf8" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>
                  Account Buying Committee
                </div>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isEvaluatingCommittee
                    ? 'Evaluating 4 TechCorp stakeholders across CRM schema & cadence...'
                    : 'Simulate domain surge across all 4 TechCorp stakeholders'}
                </div>
              </div>
            </div>
            {isEvaluatingCommittee ? (
              <span className="action-running-indicator" style={{ fontSize: '0.625rem', flexShrink: 0 }}>
                <Loader2 size={11} className="animate-spin" />
                Evaluating...
              </span>
            ) : (
              <span className="pill pill-active font-mono" style={{ fontSize: '0.625rem', flexShrink: 0 }}>
                4 Contacts
              </span>
            )}
          </div>
        )}

        <div
          style={{
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            fontSize: '0.7rem',
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}
        >
          Production outcomes are accepted through the signed <code>/api/engine/feedback</code> provider endpoint. This simulation panel does not create or submit outcome events.
        </div>
      </div>
    </div>
  );
};
