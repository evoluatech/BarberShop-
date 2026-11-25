import {NextRequest, NextResponse} from 'next/server';
import {
  APP_SYSTEM_HEADER_NAME,
  CLIENT_SYSTEM_HEADER_VALUE,
  CLIENT_UID_HEADER_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SESSION_COOKIE_NAME,
  timingSafeEqualStrings,
  validateSameOriginAndSystem,
  verifySignedCsrfToken,
  verifySignedSessionToken,
} from '@/lib/utils/csrf-edge';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function middleware(req: NextRequest) {
  const {pathname} = req.nextUrl;
  const method = req.method.toUpperCase();

  // Only inspect mutating API requests in Edge Middleware so GET routes & pages
  // remain fully CDN-cacheable on Vercel without unnecessary invocations or Set-Cookie headers.
  if (!pathname.startsWith('/api/') || !MUTATING_METHODS.has(method)) {
    return NextResponse.next();
  }

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

export const config = {
  matcher: ['/api/:path*'],
};
