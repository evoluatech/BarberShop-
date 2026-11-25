export type AppSystemId = 'client' | 'barber';
export type SessionAuthState = 'guest' | 'authenticated';

export interface SessionClaims {
  sid: string;
  uid?: string;
  authState: SessionAuthState;
  system: AppSystemId;
  role: 'client' | 'barber';
  iat: number;
  exp: number;
}

export interface CsrfClaims {
  sid: string;
  uid?: string;
  system: AppSystemId;
  nonce: string;
  iat: number;
  exp: number;
}

export const SESSION_COOKIE_NAME = 'bs_session';
export const CSRF_COOKIE_NAME = 'bs_csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const APP_SYSTEM_HEADER_NAME = 'x-app-system';
export const CLIENT_UID_HEADER_NAME = 'x-client-uid';
export const CLIENT_SYSTEM_HEADER_VALUE = 'barber-client';

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const CSRF_TTL_SECONDS = 60 * 60 * 12; // 12 hours
const PLACEHOLDER_SECRET = 'CHANGE_ME_TO_A_STRONG_RANDOM_SECRET';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let cachedKeyPromise: Promise<CryptoKey> | null = null;
let cachedSecretValue = '';
let runtimeEphemeralSecret = '';

let warnedMissingProdSecret = false;

function getSigningSecret(): string {
  const envSecret = process.env.SESSION_SIGNING_SECRET?.trim();
  if (envSecret && envSecret !== PLACEHOLDER_SECRET && envSecret.length >= 16) {
    return envSecret;
  }

  const deploymentSeed = [
    process.env.VERCEL_DEPLOYMENT_ID,
    process.env.VERCEL_PROJECT_ID,
    process.env.VERCEL_ORG_ID,
    process.env.VERCEL_GIT_COMMIT_SHA,
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(':');

  if (deploymentSeed.length >= 16) {
    if (process.env.VERCEL_ENV === 'production' && !warnedMissingProdSecret) {
      warnedMissingProdSecret = true;
      console.warn(
        '[security] SESSION_SIGNING_SECRET não configurado na Vercel; usando segredo derivado por deploy.'
      );
    }
    return deploymentSeed;
  }

  if (!runtimeEphemeralSecret) {
    runtimeEphemeralSecret = generateRandomId(32);
  }
  return runtimeEphemeralSecret;
}

function getHmacKey(): Promise<CryptoKey> {
  const secret = getSigningSecret();
  if (!cachedKeyPromise || cachedSecretValue !== secret) {
    cachedSecretValue = secret;
    cachedKeyPromise = globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      {name: 'HMAC', hash: 'SHA-256'},
      false,
      ['sign', 'verify']
    );
  }
  return cachedKeyPromise;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array | null {
  if (!input || !/^[A-Za-z0-9_-]+$/.test(input)) return null;
  try {
    const padded = input
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(input.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function generateRandomId(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function signPayload(payload: object): Promise<string> {
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await getHmacKey();
  const sigBuffer = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(encodedPayload)
  );
  const encodedSig = bytesToBase64Url(new Uint8Array(sigBuffer));
  return `${encodedPayload}.${encodedSig}`;
}

async function verifySignedPayload<T extends {exp?: number}>(
  token: string | undefined | null
): Promise<T | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) return null;

  const sigBytes = base64UrlToBytes(encodedSig);
  const payloadBytes = base64UrlToBytes(encodedPayload);
  if (!sigBytes || !payloadBytes) return null;

  try {
    const key = await getHmacKey();
    const expectedSigBuffer = await globalThis.crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(encodedPayload)
    );
    const expectedSig = bytesToBase64Url(new Uint8Array(expectedSigBuffer));
    if (!timingSafeEqualStrings(encodedSig, expectedSig)) {
      return null;
    }

    const parsed = JSON.parse(decoder.decode(payloadBytes)) as T;
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof parsed.exp !== 'number' || parsed.exp <= nowSec) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function createSignedSessionToken(
  sid: string,
  system: AppSystemId = 'client',
  role: 'client' | 'barber' = 'client',
  uid?: string
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const cleanUid = typeof uid === 'string' && uid.trim().length >= 2 ? uid.trim() : undefined;
  const claims: SessionClaims = {
    sid,
    ...(cleanUid ? {uid: cleanUid} : {}),
    authState: cleanUid ? 'authenticated' : 'guest',
    system,
    role,
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS,
  };
  return signPayload(claims);
}

export async function verifySignedSessionToken(
  token: string | undefined | null,
  expectedSystem: AppSystemId = 'client'
): Promise<SessionClaims | null> {
  const claims = await verifySignedPayload<SessionClaims>(token);
  if (!claims) return null;
  if (
    typeof claims.sid !== 'string' ||
    claims.sid.length < 8 ||
    claims.system !== expectedSystem ||
    claims.role !== expectedSystem ||
    (claims.authState !== 'guest' && claims.authState !== 'authenticated')
  ) {
    return null;
  }
  if (
    claims.authState === 'authenticated' &&
    (typeof claims.uid !== 'string' || claims.uid.length < 2)
  ) {
    return null;
  }
  return claims;
}

export async function createSignedCsrfToken(
  sid: string,
  system: AppSystemId = 'client',
  uid?: string
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const cleanUid = typeof uid === 'string' && uid.trim().length >= 2 ? uid.trim() : undefined;
  const claims: CsrfClaims = {
    sid,
    ...(cleanUid ? {uid: cleanUid} : {}),
    system,
    nonce: generateRandomId(12),
    iat: nowSec,
    exp: nowSec + CSRF_TTL_SECONDS,
  };
  return signPayload(claims);
}

export async function verifySignedCsrfToken(
  token: string | undefined | null,
  expectedSystem: AppSystemId = 'client'
): Promise<CsrfClaims | null> {
  const claims = await verifySignedPayload<CsrfClaims>(token);
  if (!claims) return null;
  if (
    typeof claims.sid !== 'string' ||
    claims.sid.length < 8 ||
    typeof claims.nonce !== 'string' ||
    claims.nonce.length < 8 ||
    claims.system !== expectedSystem
  ) {
    return null;
  }
  return claims;
}

function getAllowedHosts(headers: Headers): Set<string> {
  const allowed = new Set<string>();
  const host = headers.get('x-forwarded-host') || headers.get('host');
  if (host) {
    allowed.add(host.split(',')[0].trim().toLowerCase());
  }

  const extraOrigins = [
    process.env.APP_URL,
    ...(process.env.ALLOWED_SYSTEM_ORIGINS?.split(',') ?? []),
  ];
  for (const raw of extraOrigins) {
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      const url = trimmed.includes('://')
        ? new URL(trimmed)
        : new URL(`https://${trimmed}`);
      allowed.add(url.host.toLowerCase());
    } catch {
      // Ignore malformed env entries
    }
  }
  return allowed;
}

export function validateSameOriginAndSystem(headers: Headers): {
  ok: boolean;
  code?: 'CSRF_ORIGIN_MISMATCH' | 'CROSS_SYSTEM_FORBIDDEN' | 'INVALID_CONTENT_TYPE';
  reason?: string;
} {
  const secFetchSite = headers.get('sec-fetch-site')?.toLowerCase();
  if (secFetchSite === 'cross-site') {
    return {
      ok: false,
      code: 'CSRF_ORIGIN_MISMATCH',
      reason: 'Requisição cross-site bloqueada pela política de proteção CSRF.',
    };
  }

  const allowedHosts = getAllowedHosts(headers);
  const origin = headers.get('origin');
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (allowedHosts.size > 0 && !allowedHosts.has(originHost)) {
        return {
          ok: false,
          code: 'CSRF_ORIGIN_MISMATCH',
          reason: 'Origem da requisição não autorizada para este sistema.',
        };
      }
    } catch {
      return {
        ok: false,
        code: 'CSRF_ORIGIN_MISMATCH',
        reason: 'Cabeçalho Origin malformado.',
      };
    }
  } else {
    const referer = headers.get('referer');
    if (referer) {
      try {
        const refererHost = new URL(referer).host.toLowerCase();
        if (allowedHosts.size > 0 && !allowedHosts.has(refererHost)) {
          return {
            ok: false,
            code: 'CSRF_ORIGIN_MISMATCH',
            reason: 'Referer não autorizado para este sistema.',
          };
        }
      } catch {
        return {
          ok: false,
          code: 'CSRF_ORIGIN_MISMATCH',
          reason: 'Cabeçalho Referer malformado.',
        };
      }
    }
  }

  const appSystem = headers.get(APP_SYSTEM_HEADER_NAME)?.trim();
  if (appSystem && appSystem !== CLIENT_SYSTEM_HEADER_VALUE) {
    return {
      ok: false,
      code: 'CROSS_SYSTEM_FORBIDDEN',
      reason:
        'Isolamento entre sistemas: esta rota aceita apenas requisições autenticadas do aplicativo do cliente.',
    };
  }

  const contentType = headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      code: 'INVALID_CONTENT_TYPE',
      reason: 'Content-Type deve ser application/json.',
    };
  }

  return {ok: true};
}

export function isHttpsRequest(headers: Headers, nextUrlProtocol: string): boolean {
  const forwardedProto = headers.get('x-forwarded-proto');
  return nextUrlProtocol === 'https:' || forwardedProto === 'https';
}

export function buildSecurityCookieOptions(secure: boolean, httpOnly: boolean) {
  return {
    httpOnly,
    path: '/',
    secure,
    sameSite: (secure ? 'none' : 'lax') as 'none' | 'lax',
  };
}
