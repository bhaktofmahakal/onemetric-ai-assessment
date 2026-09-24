'use client';

import React, { useState } from 'react';
import type { AuditEntry } from '@/src/engine/demo-store';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AuditLogProps {
  entries: AuditEntry[];
}

export const AuditLog: React.FC<AuditLogProps> = ({ entries }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getDecisionPill = (decision: string) => {
    switch (decision) {
      case 'continue':
        return <span className="pill pill-active">CONTINUE</span>;
      case 'pause_cooldown':
        return <span className="pill pill-cooldown">COOLDOWN</span>;
      case 'switch':
        return <span className="pill pill-action">SWITCH</span>;
      case 'escalate':
        return <span className="pill pill-critical">ESCALATE</span>;
      default:
        return <span className="pill pill-neutral">{decision}</span>;
    }
  };

  if (entries.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', padding: 20, textAlign: 'center' }}>
        No audit ledger entries recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
      {entries.map((entry) => {
        const isExpanded = expandedId === entry.id;

        return (
          <div
            key={entry.id}
            style={{
              background: isExpanded ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-inset)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              transition: 'background 0.15s ease',
            }}
          >
            {/* Row Summary */}
            <div
              onClick={() => toggleRow(entry.id)}
              style={{
                padding: '9px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontSize: '0.735rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span style={{ color: '#fff', fontWeight: 500 }}>{entry.eventType}</span>
                <span className="pill pill-neutral" style={{ fontSize: '0.625rem' }}>
                  {entry.source}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Target: <span className="font-mono" style={{ color: '#fff' }}>{entry.productId}</span>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {getDecisionPill(entry.decision)}
                <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  → {entry.newState}
                </span>
                <span className="font-mono" style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
                  {entry.latencyMs.toFixed(2)}ms
                </span>
                {isExpanded ? <ChevronUp size={13} color="var(--text-muted)" /> : <ChevronDown size={13} color="var(--text-muted)" />}
              </div>
            </div>

            {/* Expanded Row Detail */}
            {isExpanded && (
              <div
                style={{
                  padding: '10px 14px 12px 14px',
                  borderTop: '1px solid var(--border-hairline)',
                  background: 'rgba(0, 0, 0, 0.2)',
                  fontSize: '0.715rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div>
                  <strong style={{ color: 'var(--text-muted)' }}>Reasoning: </strong>
                  <span style={{ color: 'var(--text-secondary)' }}>{entry.reasoning}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div>
                    <strong style={{ color: 'var(--text-muted)' }}>Transition: </strong>
                    <span className="font-mono" style={{ color: '#fff' }}>
                      {entry.previousState} → {entry.newState}
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-muted)' }}>Hysteresis Δ: </strong>
                    <span className="font-mono" style={{ color: '#fff' }}>
                      {entry.delta.toFixed(1)} pts
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-muted)' }}>Engine: </strong>
                    <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {entry.engineUsed}
                    </span>
                  </div>
                </div>

                <div>
                  <strong style={{ color: 'var(--text-muted)' }}>Guards Evaluated: </strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                    {entry.guardsSummary.map((g, idx) => (
                      <span
                        key={idx}
                        className={`pill ${g.passed ? 'pill-active' : 'pill-warning'}`}
                        style={{ fontSize: '0.625rem' }}
                      >
                        {g.passed ? '✓' : '✗'} {g.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
