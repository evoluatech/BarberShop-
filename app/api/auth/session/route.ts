import {NextRequest, NextResponse} from 'next/server';
import {
  extractBearerToken,
  verifyFirebaseBearerToken,
} from '@/lib/server/firebase-auth';
import {enforceRateLimit} from '@/lib/server/rate-limit';
import {
  buildSecurityCookieOptions,
  createSignedCsrfToken,
  createSignedSessionToken,
  CSRF_COOKIE_NAME,
  generateRandomId,
  isHttpsRequest,
  SESSION_COOKIE_NAME,
} from '@/lib/utils/csrf-edge';

/**
 * POST /api/auth/session
 * Establishes an isolated per-user HttpOnly session + rotated CSRF token bound strictly
 * to the verified Firebase UID and 'client' system scope, eliminating cross-user conflicts.
 */
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, {
    bucket: 'auth-session-post',
    maxRequests: 150,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const bearerToken = extractBearerToken(req);
  if (!bearerToken) {
    return NextResponse.json(
      {
        error: 'Token de autenticação Firebase ausente no cabeçalho Authorization.',
        code: 'AUTH_TOKEN_MISSING',
      },
      {status: 401, headers: {'Cache-Control': 'no-store, no-cache, must-revalidate'}}
    );
  }

  let loginScope = 'client';
  try {
    const body = (await req.json()) as {loginScope?: unknown};
    if (typeof body?.loginScope === 'string' && body.loginScope.trim().length > 0) {
      loginScope = body.loginScope.trim();
    }
  } catch {
    return NextResponse.json(
      {error: 'Corpo JSON inválido.', code: 'INVALID_BODY'},
      {status: 400, headers: {'Cache-Control': 'no-store, no-cache, must-revalidate'}}
    );
  }

  if (loginScope !== 'client') {
    return NextResponse.json(
      {
        error:
          'Escopo de login inválido para o aplicativo do cliente. Sessões de barbeiro são isoladas.',
        code: 'CROSS_SYSTEM_FORBIDDEN',
      },
      {status: 403, headers: {'Cache-Control': 'no-store, no-cache, must-revalidate'}}
    );
  }

  const verified = await verifyFirebaseBearerToken(bearerToken);
  if (!verified.ok) {
    return NextResponse.json(
      {error: verified.error, code: verified.code},
      {
        status: verified.status,
        headers: {'Cache-Control': 'no-store, no-cache, must-revalidate'},
      }
    );
  }

  const secure = isHttpsRequest(req.headers, req.nextUrl.protocol);
  const freshSid = generateRandomId(18);
  const newSessionToken = await createSignedSessionToken(
    freshSid,
    'client',
    'client',
    verified.uid
  );
  const newCsrfToken = await createSignedCsrfToken(freshSid, 'client', verified.uid);

  const response = NextResponse.json(
    {
      authenticated: true,
      uid: verified.uid,
      email: verified.email ?? null,
      system: 'client',
      role: 'client',
      csrfToken: newCsrfToken,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );

  response.cookies.set(SESSION_COOKIE_NAME, newSessionToken, {
    ...buildSecurityCookieOptions(secure, true),
    maxAge: 60 * 60 * 24,
  });
  response.cookies.set(CSRF_COOKIE_NAME, newCsrfToken, {
    ...buildSecurityCookieOptions(secure, false),
    maxAge: 60 * 60 * 12,
  });

  return response;
}

/**
 * DELETE /api/auth/session
 * Cleanly revokes the current user's session and rotates cookies back to an isolated guest session.
 */
export async function DELETE(req: NextRequest) {
  const limited = enforceRateLimit(req, {
    bucket: 'auth-session-delete',
    maxRequests: 150,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const secure = isHttpsRequest(req.headers, req.nextUrl.protocol);
  const freshSid = generateRandomId(18);
  const guestSessionToken = await createSignedSessionToken(freshSid, 'client', 'client');
  const guestCsrfToken = await createSignedCsrfToken(freshSid, 'client');

  const response = NextResponse.json(
    {
      authenticated: false,
      uid: null,
      system: 'client',
      role: 'client',
      csrfToken: guestCsrfToken,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );

  response.cookies.set(SESSION_COOKIE_NAME, guestSessionToken, {
    ...buildSecurityCookieOptions(secure, true),
    maxAge: 60 * 60 * 24,
  });
  response.cookies.set(CSRF_COOKIE_NAME, guestCsrfToken, {
    ...buildSecurityCookieOptions(secure, false),
    maxAge: 60 * 60 * 12,
  });

  return response;
}
