import {NextRequest, NextResponse} from 'next/server';
import {resolveAuthenticatedClient} from '@/lib/server/firebase-auth';

/**
 * GET /api/auth/me
 * Returns the isolated identity of the currently authenticated user and flags
 * any cross-user session mismatch between tabs or tokens.
 */
export async function GET(req: NextRequest) {
  const auth = await resolveAuthenticatedClient(req);

  if (!auth.ok) {
    return NextResponse.json(
      {
        authenticated: false,
        conflict: auth.code === 'USER_SESSION_CONFLICT',
        code: auth.code,
        error: auth.error,
      },
      {
        status: auth.status,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      uid: auth.uid,
      email: auth.email ?? null,
      system: 'client',
      role: 'client',
      authSource: auth.authSource,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
