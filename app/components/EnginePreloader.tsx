'use client';

import React, { useState, useEffect } from 'react';
import { Layers, ShieldCheck, Activity, Database, CheckCircle2, RefreshCw } from 'lucide-react';

interface EnginePreloaderProps {
  error?: string | null;
  onRetry?: () => void;
}

const BOOT_STAGES = [
  { label: 'Connecting to OneMetric Autonomous Kernel...', subsystem: 'SYSTEM_ONE_CORE', pct: 28 },
  { label: 'Calibrating Deterministic Finite State Machine (7 States, 5 Guards)...', subsystem: 'FSM_MATRIX', pct: 54 },
  { label: 'Verifying HubSpot REST API v3 Bi-Directional Gateway...', subsystem: 'CRM_GATEWAY', pct: 78 },
  { label: 'Synchronizing Multi-Contact Buying Committee Ingestion Layer...', subsystem: 'COMMITTEE_SYNC', pct: 96 },
];

export const EnginePreloader: React.FC<EnginePreloaderProps> = ({ error, onRetry }) => {
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(18);

  useEffect(() => {
    const timer = setInterval(() => {
      setStageIndex((prev) => {
        const next = (prev + 1) % BOOT_STAGES.length;
        setProgress(BOOT_STAGES[next].pct);
        return next;
      });
    }, 900);

    return () => clearInterval(timer);
  }, []);

  const currentStage = BOOT_STAGES[stageIndex];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 45%, rgba(56, 189, 248, 0.08) 0%, rgba(16, 185, 129, 0.04) 35%, #090a0f 75%)',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Decorative Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, #000 70%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, #000 70%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Elevated Holographic Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'rgba(17, 19, 25, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 1px rgba(255, 255, 255, 0.2)',
          zIndex: 1,
        }}
      >
        {/* Animated Concentric Emblem */}
        <div style={{ position: 'relative', width: 88, height: 88 }}>
          {/* Outer Orbital Ring (Clockwise) */}
          <div
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              border: '1.5px dashed rgba(56, 189, 248, 0.45)',
              animation: 'orbitalSpin 10s linear infinite',
            }}
          />

          {/* Inner Counter-Orbital Ring (Counter-Clockwise) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderTopColor: '#34d399',
              borderBottomColor: '#38bdf8',
              animation: 'reverseOrbitalSpin 4s linear infinite',
            }}
          />

          {/* Core Breathing Shield */}
          <div
            style={{
              position: 'absolute',
              inset: 8,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #161822 0%, #0f172a 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulseGlow 2.5s ease-in-out infinite',
            }}
          >
            <Layers size={34} color="#38bdf8" style={{ filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.6))' }} />
          </div>
        </div>

        {/* Title and Branding */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
              OneMetric
            </span>
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 700,
                color: '#34d399',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '2px 7px',
                borderRadius: 9999,
                letterSpacing: '0.04em',
              }}
            >
              v2.4 ENTERPRISE
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Dynamic Campaign Segmentation Engine
          </div>
        </div>

        {/* Telemetry Progress Bar */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
            <span className="font-mono" style={{ color: 'var(--accent-lime)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-lime)', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
              {currentStage.subsystem}
            </span>
            <span className="font-mono" style={{ color: '#fff', fontWeight: 600 }}>
              {progress}%
            </span>
          </div>

          <div
            style={{
              width: '100%',
              height: 4,
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38bdf8 0%, #10b981 100%)',
                borderRadius: 2,
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.6)',
              }}
            />
          </div>
        </div>

        {/* Dynamic Stage Message */}
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            minHeight: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Activity size={12} color="#38bdf8" className="animate-spin" />
          <span>{currentStage.label}</span>
        </div>

        {/* Micro Telemetry Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--border-hairline)',
            width: '100%',
            fontSize: '0.675rem',
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={11} color="#34d399" />
            HubSpot REST v3
          </span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShieldCheck size={11} color="#38bdf8" />
            Deterministic FSM
          </span>
          <span>•</span>
          <span className="font-mono">HMAC Webhook Guard</span>
        </div>

        {/* Error Fallback & Retry */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              width: '100%',
            }}
          >
            <span>{error}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="btn btn-secondary"
                style={{ padding: '4px 12px', fontSize: '0.7rem' }}
              >
                <RefreshCw size={11} />
                Retry Initialization
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
