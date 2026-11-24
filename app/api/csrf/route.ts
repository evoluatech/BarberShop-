import {NextRequest, NextResponse} from 'next/server';
import {enforceRateLimit} from '@/lib/server/rate-limit';
import {
  buildSecurityCookieOptions,
  createSignedCsrfToken,
  createSignedSessionToken,
  CSRF_COOKIE_NAME,
  generateRandomId,
  isHttpsRequest,
  SESSION_COOKIE_NAME,
  verifySignedCsrfToken,
  verifySignedSessionToken,
} from '@/lib/utils/csrf-edge';

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, {
    bucket: 'csrf-get',
    maxRequests: 240,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const secure = isHttpsRequest(req.headers, req.nextUrl.protocol);

  const existingSession = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validSession = await verifySignedSessionToken(existingSession, 'client');
  const sid = validSession?.sid ?? generateRandomId(18);
  const activeUid = validSession?.uid;

  const existingCsrf = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  const validCsrf = await verifySignedCsrfToken(existingCsrf, 'client');

  const csrfToken =
    existingCsrf &&
    validCsrf &&
    validCsrf.sid === sid &&
    (validCsrf.uid ?? '') === (activeUid ?? '')
      ? existingCsrf
      : await createSignedCsrfToken(sid, 'client', activeUid);

  const response = NextResponse.json(
    {
      csrfToken,
      system: 'client',
      role: 'client',
      authState: validSession?.authState ?? 'guest',
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );

  if (!validSession) {
    const newSessionToken = await createSignedSessionToken(sid, 'client', 'client');
    response.cookies.set(SESSION_COOKIE_NAME, newSessionToken, {
      ...buildSecurityCookieOptions(secure, true),
      maxAge: 60 * 60 * 24,
    });
  }

  if (
    !validCsrf ||
    validCsrf.sid !== sid ||
    (validCsrf.uid ?? '') !== (activeUid ?? '')
  ) {
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
      ...buildSecurityCookieOptions(secure, false),
      maxAge: 60 * 60 * 12,
    });
  }

  return response;
}
