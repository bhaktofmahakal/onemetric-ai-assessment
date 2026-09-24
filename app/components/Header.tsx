'use client';

import React from 'react';
import { RotateCcw, Activity, Layers, CheckCircle2, HelpCircle, Loader2 } from 'lucide-react';

interface HeaderProps {
  onReset: () => void;
  onOpenGuide?: () => void;
  isLoading: boolean;
  activeScenarioName?: string;
  latencyMs?: number;
  isListening?: boolean;
  onToggleListening?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  onOpenGuide,
  isLoading,
  activeScenarioName,
  latencyMs = 0.08,
  isListening = true,
  onToggleListening,
}) => {
  return (
    <header className="app-header">
      <div className="app-header-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1680, margin: '0 auto' }}>
        {/* Brand & Context */}
        <div className="app-header-brand" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: '#1a1d28',
              border: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={17} color="#f8f9fa" />
          </div>

          <div className="app-header-context" style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
              OneMetric
            </span>
            <span style={{ color: 'var(--border-hairline)' }}>/</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Dynamic Campaign Segmentation Engine
            </span>
            <span className="pill pill-neutral" style={{ fontSize: '0.65rem' }}>
              ENTERPRISE v2.4
            </span>
          </div>
        </div>

        {/* Engine Telemetry & Actions */}
        <div className="app-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {activeScenarioName && (
            <div className="pill pill-neutral" style={{ maxWidth: 260, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              Scenario: <strong style={{ color: '#fff', marginLeft: 4 }}>{activeScenarioName}</strong>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: '0.725rem',
              color: 'var(--text-secondary)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 12px',
            }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8' }}>
                <Loader2 size={11} className="animate-spin" />
                <strong style={{ color: '#38bdf8' }}>Processing...</strong>
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--state-active)' }} />
                Active
              </span>
            )}
            <span style={{ color: 'var(--border-hairline)' }}>|</span>
            <span className="font-mono">
              Latency: <strong style={{ color: '#fff' }}>{latencyMs.toFixed(2)}ms</strong>
            </span>
            <span style={{ color: 'var(--border-hairline)' }}>|</span>
          </div>

          {/* Real-time background webhook & telemetry stream listener */}
          {onToggleListening && (
            <button
              type="button"
              onClick={onToggleListening}
              className="btn btn-outline"
              title="Toggle real-time zero-click webhook & telemetry stream polling (3.5s interval)"
              style={{
                padding: '5px 12px',
                fontSize: '0.72rem',
                gap: 8,
                background: isListening ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                borderColor: isListening ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-hairline)',
                color: isListening ? '#34d399' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 8,
                  height: 8,
                }}
              >
                {isListening && (
                  <span
                    className="animate-ping"
                    style={{
                      position: 'absolute',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#10b981',
                      opacity: 0.75,
                    }}
                  />
                )}
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: isListening ? '#10b981' : '#6b7280',
                  }}
                />
              </span>
              <span className="font-mono" style={{ fontWeight: 600 }}>
                {isListening ? 'Live Webhook Stream: Active' : 'Live Webhook Stream: Paused'}
              </span>
            </button>
          )}

          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="btn btn-outline"
              title="Platform Architecture &amp; RevOps Guide"
              style={{ padding: '6px 12px', fontSize: '0.75rem', gap: 6 }}
            >
              <HelpCircle size={13} color="var(--accent-lime)" />
              How It Works
            </button>
          )}

          <button
            onClick={onReset}
            disabled={isLoading}
            className="btn btn-secondary"
            title="Reset engine state to baseline"
            style={{ padding: '6px 12px', fontSize: '0.75rem', gap: 6 }}
          >
            <RotateCcw size={13} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Resetting...' : 'Reset State'}
          </button>
        </div>
      </div>
    </header>
  );
};
