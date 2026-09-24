'use client';

import React from 'react';
import { Layers, RotateCcw } from 'lucide-react';

interface EnginePreloaderProps {
  error?: string | null;
  onRetry?: () => void;
}

export const EnginePreloader: React.FC<EnginePreloaderProps> = ({ error, onRetry }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        padding: 24,
        position: 'relative',
      }}
    >
      {/* Sleek Minimalist Brand Box */}
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          textAlign: 'center',
        }}
      >
        {/* Brand Icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          }}
        >
          <Layers size={22} color="#f8f9fa" />
        </div>

        {/* Brand Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
              OneMetric
            </span>
            <span style={{ color: 'var(--border-hairline)' }}>/</span>
            <span className="pill pill-neutral" style={{ fontSize: '0.65rem' }}>
              ENTERPRISE v2.4
            </span>
          </div>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
            Dynamic Campaign Segmentation Engine
          </span>
        </div>

        {/* Linear-style Indeterminate Loading Bar */}
        {!error ? (
          <div style={{ width: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <div
              style={{
                width: '100%',
                height: 2,
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 9999,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, transparent, #3b82f6, #10b981, transparent)',
                  borderRadius: 9999,
                  animation: 'indeterminateSlide 1.5s ease-in-out infinite',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.725rem', color: 'var(--text-muted)' }}>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'var(--state-active)',
                  display: 'inline-block',
                }}
              />
              <span className="font-mono">Initializing RevOps decision kernel...</span>
            </div>
          </div>
        ) : (
          /* Error State */
          <div
            style={{
              width: '100%',
              padding: '14px 18px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              marginTop: 10,
            }}
          >
            <span style={{ fontSize: '0.775rem', color: '#fca5a5' }}>{error}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.75rem', gap: 6 }}
              >
                <RotateCcw size={12} />
                Retry Initialization
              </button>
            )}
          </div>
        )}

        {/* Telemetry Footnote */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.675rem',
            color: 'var(--text-muted)',
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--border-hairline)',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <span className="font-mono">FSM Governance</span>
          <span>•</span>
          <span className="font-mono">TypeSafe Jev</span>
          <span>•</span>
          <span className="font-mono">HubSpot v3</span>
        </div>
      </div>
    </div>
  );
};
