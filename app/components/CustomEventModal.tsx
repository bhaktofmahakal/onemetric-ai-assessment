'use client';

import React, { useState } from 'react';
import { X, Send, Sliders, Loader2 } from 'lucide-react';
import type { SourceType } from '@/src/types';

interface CustomEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  onSubmit: (event: {
    productId: string;
    source: string;
    sourceType: SourceType;
    rawScore: number;
    metadata?: Record<string, unknown>;
  }) => void;
}

export const CustomEventModal: React.FC<CustomEventModalProps> = ({
  isOpen,
  onClose,
  isLoading = false,
  onSubmit,
}) => {
  const [productId, setProductId] = useState('product_a');
  const [source, setSource] = useState('g2');
  const [sourceType, setSourceType] = useState<SourceType>('2nd_party');
  const [rawScore, setRawScore] = useState(85);
  const [activity, setActivity] = useState('pricing_page_view');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      productId,
      source,
      sourceType,
      rawScore: Number(rawScore),
      metadata: { activity },
    });
    onClose();
  };

  const getWeightLabel = (st: SourceType) => {
    switch (st) {
      case '1st_party_direct':
        return 'Weight 1.0 — High Confidence (Direct demo or pricing form)';
      case '1st_party_passive':
        return 'Weight 0.8 — High Reliability (Technical docs, case study download)';
      case '2nd_party':
        return 'Weight 0.7 — Moderate (G2, TrustRadius review comparison)';
      case '3rd_party':
        return 'Weight 0.5 — Aggregated / Noisy (Bombora topic surge)';
      default:
        return 'Weight 0.5';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header" style={{ padding: '12px 16px' }}>
          <div className="panel-title">
            <Sliders size={14} color="var(--text-secondary)" />
            Inject Custom Intent Signal
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Target Product */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Target Product &amp; BU:
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                marginTop: 4,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-hairline)',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            >
              <option value="product_a">CloudSecure (Security Platform — BU_Security)</option>
              <option value="product_b">DataFlow (Analytics Suite — BU_Analytics)</option>
              <option value="product_c">FinanceOS (Finance ERP — BU_Finance)</option>
            </select>
          </div>

          {/* Source Type & Provider */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Signal Provider:
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  marginTop: 4,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              >
                <option value="g2">G2 Crowd (Review/Pricing)</option>
                <option value="bombora">Bombora (Topic Surge)</option>
                <option value="website">Direct Website Visit</option>
                <option value="clearbit">Clearbit Reveal</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Reliability Tier:
              </label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  marginTop: 4,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-hairline)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              >
                <option value="1st_party_direct">1st Party Direct (1.0)</option>
                <option value="1st_party_passive">1st Party Passive (0.8)</option>
                <option value="2nd_party">2nd Party Intent (0.7)</option>
                <option value="3rd_party">3rd Party Surge (0.5)</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {getWeightLabel(sourceType)}
          </div>

          {/* Raw Score Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 500 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Raw Provider Intent Score (0–100):</span>
              <span className="font-mono" style={{ color: '#fff', fontWeight: 600 }}>
                {rawScore}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={rawScore}
              onChange={(e) => setRawScore(Number(e.target.value))}
              style={{ width: '100%', marginTop: 8, accentColor: '#3b82f6' }}
            />
          </div>

          {/* Activity Description */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Activity Context:
            </label>
            <input
              type="text"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="e.g. pricing_page_view"
              style={{
                width: '100%',
                padding: '8px 12px',
                marginTop: 4,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-hairline)',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={isLoading} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`btn btn-primary ${isLoading ? 'running-shimmer' : ''}`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Injecting Signal...
                </>
              ) : (
                <>
                  <Send size={13} />
                  Inject Signal
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
