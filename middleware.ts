import {NextRequest, NextResponse} from 'next/server';
import {
  APP_SYSTEM_HEADER_NAME,
  buildSecurityCookieOptions,
  CLIENT_SYSTEM_HEADER_VALUE,
  CLIENT_UID_HEADER_NAME,
  createSignedCsrfToken,
  createSignedSessionToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  generateRandomId,
  isHttpsRequest,
  SESSION_COOKIE_NAME,
  timingSafeEqualStrings,
  validateSameOriginAndSystem,
  verifySignedCsrfToken,
  verifySignedSessionToken,
} from '@/lib/utils/csrf-edge';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function middleware(req: NextRequest) {
  const {pathname, protocol} = req.nextUrl;
  const method = req.method.toUpperCase();

  // Enforce CSRF + per-user session isolation on all mutating API requests
  if (pathname.startsWith('/api/') && MUTATING_METHODS.has(method)) {
    const originCheck = validateSameOriginAndSystem(req.headers);
    if (!originCheck.ok) {
      return NextResponse.json(
        {
          error: originCheck.reason || 'Requisição bloqueada pela proteção CSRF.',
          code: originCheck.code || 'CSRF_VALIDATION_FAILED',
        },
        {
          status: originCheck.code === 'INVALID_CONTENT_TYPE' ? 415 : 403,
          headers: {'Cache-Control': 'no-store'},
        }
      );
    }

    const appSystemHeader = req.headers.get(APP_SYSTEM_HEADER_NAME)?.trim();
    if (appSystemHeader !== CLIENT_SYSTEM_HEADER_VALUE) {
      return NextResponse.json(
        {
          error:
            'Cabeçalho de identificação do sistema ausente ou não autorizado para esta operação.',
          code: 'CROSS_SYSTEM_FORBIDDEN',
        },
        {status: 403, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const csrfHeaderToken = req.headers.get(CSRF_HEADER_NAME)?.trim();
    const csrfClaims = await verifySignedCsrfToken(csrfHeaderToken, 'client');
    if (!csrfHeaderToken || !csrfClaims) {
      return NextResponse.json(
        {
          error: 'Token de proteção CSRF inválido ou expirado. Recarregue a página.',
          code: 'CSRF_VALIDATION_FAILED',
        },
        {status: 403, headers: {'Cache-Control': 'no-store'}}
      );
    }

    // Bind double-submit cookie & HttpOnly signed session cookie + user UID
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const sessionClaims = await verifySignedSessionToken(sessionCookie, 'client');
      if (!sessionClaims || sessionClaims.sid !== csrfClaims.sid) {
        return NextResponse.json(
          {
            error:
              'Token de sessão inválido ou incompatível com o token CSRF deste sistema.',
            code: 'INVALID_SESSION_TOKEN',
          },
          {status: 403, headers: {'Cache-Control': 'no-store'}}
        );
      }

      if ((sessionClaims.uid ?? '') !== (csrfClaims.uid ?? '')) {
        return NextResponse.json(
          {
            error:
              'Conflito de sessão: o token CSRF pertence a outro usuário. Atualizando sessão...',
            code: 'USER_SESSION_CONFLICT',
          },
          {status: 409, headers: {'Cache-Control': 'no-store'}}
        );
      }

      // Skip x-client-uid check on /api/auth/session (login/logout intentionally switches uid)
      if (pathname !== '/api/auth/session') {
        const expectedUidHeader = req.headers.get(CLIENT_UID_HEADER_NAME)?.trim();
        if (
          expectedUidHeader &&
          sessionClaims.authState === 'authenticated' &&
          expectedUidHeader !== sessionClaims.uid
        ) {
          return NextResponse.json(
            {
              error:
                'Conflito entre contas conectadas em abas diferentes. Recarregue para sincronizar sua conta.',
              code: 'USER_SESSION_CONFLICT',
            },
            {status: 409, headers: {'Cache-Control': 'no-store'}}
          );
        }
      }
    }

    const csrfCookie = req.cookies.get(CSRF_COOKIE_NAME)?.value;
    if (csrfCookie && !timingSafeEqualStrings(csrfCookie, csrfHeaderToken)) {
      return NextResponse.json(
        {
          error: 'Divergência no token CSRF da sessão.',
          code: 'CSRF_VALIDATION_FAILED',
        },
        {status: 403, headers: {'Cache-Control': 'no-store'}}
      );
    }

    return NextResponse.next();
  }

  // Auth and CSRF session routes manage their own paired cookies
  if (pathname === '/api/csrf' || pathname === '/api/auth/session') {
    return NextResponse.next();
  }

  // On safe navigation / GET requests, preserve user session & CSRF pair bound to active uid
  const response = NextResponse.next();
  const secure = isHttpsRequest(req.headers, protocol);

  const existingSession = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validSession = await verifySignedSessionToken(existingSession, 'client');

  const sid = validSession?.sid ?? generateRandomId(18);
  const sessionUid = validSession?.uid;
  if (!validSession) {
    const newSessionToken = await createSignedSessionToken(sid, 'client', 'client');
    response.cookies.set(SESSION_COOKIE_NAME, newSessionToken, {
      ...buildSecurityCookieOptions(secure, true),
      maxAge: 60 * 60 * 24,
    });
  }

  const existingCsrf = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  const validCsrf = await verifySignedCsrfToken(existingCsrf, 'client');
  if (
    !validCsrf ||
    validCsrf.sid !== sid ||
    (validCsrf.uid ?? '') !== (sessionUid ?? '')
  ) {
    const newCsrfToken = await createSignedCsrfToken(sid, 'client', sessionUid);
    response.cookies.set(CSRF_COOKIE_NAME, newCsrfToken, {
      ...buildSecurityCookieOptions(secure, false),
      maxAge: 60 * 60 * 12,
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)',
  ],
};
