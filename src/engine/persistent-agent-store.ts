import { createHash, randomUUID } from 'node:crypto';
import type { IntentEvent, FSMState, FeedbackEvent, SourceType } from '../types/index.js';
import type { BuyingCommitteeResolution } from './multi-contact-evaluator.js';
import { getDefaultConfig } from './scoring.js';

export interface PersistedContactState {
  fsmState: FSMState;
  cooldownStartedAt: string | null;
  currentCampaign: string | null;
}

export interface PersistentAgentMemory {
  schemaVersion: 1;
  domain: string;
  events: IntentEvent[];
  contacts: Record<string, PersistedContactState>;
  latestSessionId: string | null;
  sourceWeights: Record<SourceType, number>;
  feedbackEventIds: string[];
  outcomeFeedback: FeedbackEvent[];
  updatedAt: string;
}

export interface AgentStep {
  turn: number;
  phase: 'observe' | 'plan' | 'execute' | 'reflect';
  tool?: string;
  planner: 'typesafe' | 'gemini' | 'deterministic_fallback';
  confidence?: number;
  result?: Record<string, unknown>;
  at: string;
}

export interface PersistedAgentSession {
  id: string;
  domain: string;
  event: IntentEvent;
  resolution: BuyingCommitteeResolution;
  status: 'running' | 'complete' | 'human_review' | 'retry_wait' | 'failed';
  steps: AgentStep[];
  completedTools: string[];
  attempts: Record<string, number>;
  pendingTool: string | null;
  scheduledWork?: 'retry' | 'cooldown';
  updatedAt: string;
}

interface RedisReply<T> {
  result?: T;
  error?: string;
}

function redisConfig(): { url: string; token: string } {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error('Durable agent memory is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  }
  return { url: url.replace(/\/$/, ''), token };
}

async function command<T>(parts: Array<string | number>): Promise<T> {
  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(parts),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Durable memory request failed with HTTP ${response.status}`);
  const payload = await response.json() as RedisReply<T>;
  if (payload.error) throw new Error(`Durable memory error: ${payload.error}`);
  return payload.result as T;
}

function domainKey(domain: string): string {
  return createHash('sha256').update(domain.toLowerCase().trim()).digest('hex');
}

function eventKey(eventId: string): string {
  return createHash('sha256').update(eventId).digest('hex');
}

export class PersistentAgentStore {
  static isConfigured(): boolean {
    return Boolean(
      (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
    );
  }

  async ping(): Promise<boolean> {
    try {
      return await command<string>(['PING']) === 'PONG';
    } catch {
      return false;
    }
  }

  async claimEvent(id: string): Promise<boolean> {
    const result = await command<string | null>([
      'SET', `onemetric:agent:event:${eventKey(id)}`, 'processing', 'NX', 'EX', 10 * 60,
    ]);
    return result === 'OK';
  }

  async getEventSessionId(id: string): Promise<string | null> {
    return command<string | null>(['GET', `onemetric:agent:event:${eventKey(id)}`]);
  }

  async completeEvent(id: string, sessionId: string): Promise<void> {
    await command(['SET', `onemetric:agent:event:${eventKey(id)}`, sessionId, 'EX', 60 * 60 * 24 * 90]);
  }

  async releaseEventClaim(id: string): Promise<void> {
    await command(['DEL', `onemetric:agent:event:${eventKey(id)}`]);
  }

  async claimFeedback(id: string): Promise<boolean> {
    const result = await command<string | null>([
      'SET', `onemetric:agent:feedback:${eventKey(id)}`, 'claimed', 'NX', 'EX', 60 * 60 * 24 * 90,
    ]);
    return result === 'OK';
  }

  async releaseFeedbackClaim(id: string): Promise<void> {
    await command(['DEL', `onemetric:agent:feedback:${eventKey(id)}`]);
  }

  async consumeRateLimit(scope: string, identity: string, limit: number, windowSeconds: number): Promise<boolean> {
    const key = `onemetric:rate:${eventKey(`${scope}:${identity}`)}`;
    const count = await command<number>([
      'EVAL',
      "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n",
      1,
      key,
      windowSeconds,
    ]);
    return count <= limit;
  }

  async getMemory(domain: string): Promise<PersistentAgentMemory> {
    const key = `onemetric:agent:memory:${domainKey(domain)}`;
    const stored = await command<string | null>(['GET', key]);
    if (stored) {
      const memory = JSON.parse(stored) as Partial<PersistentAgentMemory> & Pick<PersistentAgentMemory, 'domain'>;
      return {
        schemaVersion: 1,
        domain: memory.domain,
        events: memory.events ?? [],
        contacts: memory.contacts ?? {},
        latestSessionId: memory.latestSessionId ?? null,
        sourceWeights: memory.sourceWeights ?? getDefaultConfig().sourceWeights,
        feedbackEventIds: memory.feedbackEventIds ?? [],
        outcomeFeedback: memory.outcomeFeedback ?? [],
        updatedAt: memory.updatedAt ?? new Date().toISOString(),
      };
    }
    return {
      schemaVersion: 1,
      domain: domain.toLowerCase().trim(),
      events: [],
      contacts: {},
      latestSessionId: null,
      sourceWeights: getDefaultConfig().sourceWeights,
      feedbackEventIds: [],
      outcomeFeedback: [],
      updatedAt: new Date().toISOString(),
    };
  }

  async saveMemory(memory: PersistentAgentMemory): Promise<void> {
    await command(['SET', `onemetric:agent:memory:${domainKey(memory.domain)}`, JSON.stringify(memory)]);
  }

  async saveSession(session: PersistedAgentSession): Promise<void> {
    await command(['SET', `onemetric:agent:session:${session.id}`, JSON.stringify(session)]);
  }

  async getSession(id: string): Promise<PersistedAgentSession | null> {
    const stored = await command<string | null>(['GET', `onemetric:agent:session:${id}`]);
    return stored ? JSON.parse(stored) as PersistedAgentSession : null;
  }

  async schedule(sessionId: string, dueAt: number, kind: 'retry' | 'cooldown'): Promise<void> {
    await command(['ZADD', `onemetric:agent:${kind}s`, dueAt, sessionId]);
  }

  async dueSessions(kind: 'retry' | 'cooldown', now = Date.now(), limit = 25): Promise<string[]> {
    return command<string[]>(['ZRANGEBYSCORE', `onemetric:agent:${kind}s`, '-inf', now, 'LIMIT', 0, limit]);
  }

  async removeSchedule(sessionId: string, kind: 'retry' | 'cooldown'): Promise<void> {
    await command(['ZREM', `onemetric:agent:${kind}s`, sessionId]);
  }

  async acquireDomainLock(domain: string, ttlSeconds = 180): Promise<string | null> {
    const token = randomUUID();
    const result = await command<string | null>([
      'SET', `onemetric:agent:lock:${domainKey(domain)}`, token, 'NX', 'EX', ttlSeconds,
    ]);
    return result === 'OK' ? token : null;
  }

  async releaseDomainLock(domain: string, token: string): Promise<void> {
    const key = `onemetric:agent:lock:${domainKey(domain)}`;
    await command<number>([
      'EVAL',
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
      1,
      key,
      token,
    ]);
  }
}

export const persistentAgentStore = new PersistentAgentStore();
