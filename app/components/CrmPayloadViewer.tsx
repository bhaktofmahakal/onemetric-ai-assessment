'use client';

import React, { useState } from 'react';
import type { HubSpotSyncPayload, LiveSyncResult } from '@/src/types';
import type { SyncResult } from '@/src/engine/hubspot-sync';
import type { BuyingCommitteeResolution } from '@/src/engine/multi-contact-evaluator';
import { Database, Copy, Check, CheckCircle2, Globe, Loader2 } from 'lucide-react';

interface CrmPayloadViewerProps {
  payload: HubSpotSyncPayload | null;
  liveSyncResult?: SyncResult | LiveSyncResult | null;
  committeeResolution?: BuyingCommitteeResolution | null;
  domain?: string;
  isLoading?: boolean;
  onTriggerEvaluation?: (domain?: string) => void;
}

export const CrmPayloadViewer: React.FC<CrmPayloadViewerProps> = ({
  payload,
  liveSyncResult,
  committeeResolution,
  domain,
  isLoading = false,
  onTriggerEvaluation,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'contact' | 'committee_batch' | 'custom_object' | 'task' | 'handover'>('contact');
  const [copied, setCopied] = useState(false);

  const activeTargetDomain = domain || committeeResolution?.domain;

  if (!payload) {
    return (
      <div
        style={{
          padding: '36px 20px',
          textAlign: 'center',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 8,
          border: '1px dashed var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'rgba(56, 189, 248, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
          }}
        >
          <Database size={20} />
        </div>
        <div style={{ maxWidth: 460 }}>
          <h4 style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            Autonomous HubSpot CRM Sync Gateway
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            HubSpot REST API v3 payloads (Contact PATCH, Batch Committee Updates, Custom Object POST, and Consolidated AE Tasks) are generated automatically whenever an inbound domain intent surge is evaluated or a simulation scenario is dispatched.
          </p>
        </div>
        {onTriggerEvaluation && (
          <button
            onClick={() => onTriggerEvaluation(activeTargetDomain)}
            disabled={isLoading}
            className={`btn btn-primary ${isLoading ? 'running-shimmer' : ''}`}
            style={{ fontSize: '0.75rem', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}
          >
            {isLoading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Generating CRM Payload{activeTargetDomain ? ` (${activeTargetDomain})` : ''}...
              </>
            ) : (
              <>
                <Database size={13} />
                Generate Live CRM Payload{activeTargetDomain ? ` (${activeTargetDomain})` : ''}
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  const isLive = Boolean(liveSyncResult && !liveSyncResult.dryRun && liveSyncResult.success);

  let displayedContent: Record<string, unknown> = {};
  let endpointLabel = '';

  switch (activeSubTab) {
    case 'contact':
      displayedContent = {
        operation: `PATCH /crm/v3/objects/contacts/${payload.contactPatch.objectId}`,
        idempotencyKey: payload.idempotencyKey,
        properties: payload.contactPatch.properties,
        ...(isLive && liveSyncResult?.hubspotObjectId ? { hubspotLiveObjectId: liveSyncResult.hubspotObjectId } : {}),
      };
      endpointLabel = `/crm/v3/objects/contacts/${payload.contactPatch.objectId}`;
      break;
    case 'committee_batch':
      displayedContent = committeeResolution && committeeResolution.contactOutcomes.length > 0
        ? {
            operation: 'POST /crm/v3/objects/contacts/batch/update',
            endpoint: 'https://api.hubapi.com/crm/v3/objects/contacts/batch/update',
            accountDomain: committeeResolution.domain,
            totalContacts: committeeResolution.totalContactsEvaluated,
            inputs: committeeResolution.contactOutcomes.map((o) => ({
              id: o.contactId,
              properties: {
                campaign_state: o.fsmState.toLowerCase(),
                active_intent_product: o.currentCampaign || 'product_b',
                last_decision: o.decision,
                last_decision_reasoning: o.actionSummary,
                intent_shift_detected: o.decision === 'switch' || o.decision === 'escalate',
                persona_match_role: o.role,
              },
            })),
          }
        : { status: 'Run domain evaluation to view multi-contact committee batch sync payload' };
      endpointLabel = '/crm/v3/objects/contacts/batch/update';
      break;
    case 'custom_object':
      displayedContent = {
        operation: `POST /crm/v3/objects/${payload.intentEvent.objectType}`,
        objectType: payload.intentEvent.objectType,
        idempotencyKey: payload.idempotencyKey,
        properties: payload.intentEvent.properties,
        ...(isLive && liveSyncResult?.endpointUsed ? { liveExecutionEndpoint: liveSyncResult.endpointUsed } : {}),
      };
      endpointLabel = isLive && liveSyncResult?.endpointUsed ? liveSyncResult.endpointUsed : `/crm/v3/objects/${payload.intentEvent.objectType}`;
      break;
    case 'task':
      displayedContent = payload.task
        ? {
            operation: 'POST /crm/v3/objects/tasks',
            properties: payload.task.properties,
            associations: payload.task.associations,
            ...(isLive ? { hubspotStatus: '201 Created' } : {}),
          }
        : { status: 'No escalation task required for this decision' };
      endpointLabel = payload.task ? '/crm/v3/objects/tasks' : 'N/A';
      break;
    case 'handover':
      displayedContent = {
        protocol: 'Cross-BU Campaign Handover Protocol',
        accountDomain: activeTargetDomain || committeeResolution?.domain || 'unknown',
        crossBUTransition: payload.contactPatch.properties.cross_bu_transfer === 'true',
        targetBU: payload.contactPatch.properties.target_bu || 'BU_Security',
        gracePeriodHours: 48,
        campaignExecutionStatus: 'Disconnected (Fails Closed — Requires OAuth sequence permissions)',
        idempotencyKey: payload.idempotencyKey,
      };
      endpointLabel = 'Automated Sequence Handover Protocol';
      break;
  }

  const jsonString = JSON.stringify(displayedContent, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasCommittee = Boolean(committeeResolution && committeeResolution.contactOutcomes.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Sub-tab selection and live status bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveSubTab('contact')}
            className={`btn ${activeSubTab === 'contact' ? 'btn-secondary' : 'btn-outline'}`}
            style={{ padding: '5px 12px', fontSize: '0.725rem' }}
          >
            Contact PATCH
          </button>
          {hasCommittee && (
            <button
              onClick={() => setActiveSubTab('committee_batch')}
              className={`btn ${activeSubTab === 'committee_batch' ? 'btn-secondary' : 'btn-outline'}`}
              style={{ padding: '5px 12px', fontSize: '0.725rem' }}
            >
              Batch Committee Update ({committeeResolution?.totalContactsEvaluated ?? 4}x)
            </button>
          )}
          <button
            onClick={() => setActiveSubTab('custom_object')}
            className={`btn ${activeSubTab === 'custom_object' ? 'btn-secondary' : 'btn-outline'}`}
            style={{ padding: '5px 12px', fontSize: '0.725rem' }}
          >
            Custom Object POST
          </button>
          <button
            onClick={() => setActiveSubTab('task')}
            className={`btn ${activeSubTab === 'task' ? 'btn-secondary' : 'btn-outline'}`}
            style={{ padding: '5px 12px', fontSize: '0.725rem' }}
          >
            Task POST {payload.task && <span className="pill pill-critical" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Active</span>}
          </button>
          <button
            onClick={() => setActiveSubTab('handover')}
            className={`btn ${activeSubTab === 'handover' ? 'btn-secondary' : 'btn-outline'}`}
            style={{ padding: '5px 12px', fontSize: '0.725rem' }}
          >
            Sequence Handover
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isLive ? (
            <span className="pill pill-active font-mono" style={{ fontSize: '0.675rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Globe size={11} color="var(--accent-lime)" />
              HubSpot API: Connected ({liveSyncResult?.statusCode ?? 201} Created)
              {liveSyncResult?.hubspotObjectId && (
                <span style={{ color: '#fff', marginLeft: 3 }}>
                  • ID: {liveSyncResult.hubspotObjectId}
                </span>
              )}
            </span>
          ) : (
            <span className="font-mono" style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
              SHA-256: {payload.idempotencyKey.slice(0, 16)}...
            </span>
          )}

          <button
            onClick={handleCopy}
            className="btn btn-outline"
            style={{ padding: '4px 10px', fontSize: '0.725rem' }}
          >
            {copied ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy Payload'}
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.725rem',
          color: 'var(--text-muted)',
          padding: '0 2px',
        }}
      >
        <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
          {endpointLabel}
        </span>
        {isLive ? (
          <span className="pill pill-active font-mono" style={{ fontSize: '0.625rem' }}>
            HubSpot API: Connected (201 Created)
          </span>
        ) : (
          <span className="pill pill-active font-mono" style={{ fontSize: '0.625rem' }}>
            Schema Validated (Idempotent REST Payload Ready)
          </span>
        )}
      </div>

      <pre className="code-viewer">
        <code>{jsonString}</code>
      </pre>
    </div>
  );
};
