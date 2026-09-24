import { createHmac, timingSafeEqual } from 'node:crypto';

export type SignedJsonResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: 400 | 401 | 413 | 503; error: string };

export function verifyRawBodySignature(rawBody: string, provided: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export async function readSignedJsonWebhook(request: Request, secretName: string): Promise<SignedJsonResult> {
  const secret = process.env[secretName];
  if (!secret && (process.env.VERCEL || process.env.NODE_ENV === 'production')) {
    return { ok: false, status: 503, error: `${secretName} is required in production.` };
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 64 * 1024) {
    return { ok: false, status: 413, error: 'Request body exceeds the 64 KB limit.' };
  }
  if (secret && !verifyRawBodySignature(rawBody, request.headers.get('x-onemetric-signature') || '', secret)) {
    return { ok: false, status: 401, error: 'Invalid webhook signature.' };
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: 'Request body must be valid JSON.' };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: 'Request body must be a JSON object.' };
  }
  return { ok: true, body: body as Record<string, unknown> };
}
