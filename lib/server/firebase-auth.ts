import {getApp, getApps, initializeApp} from 'firebase-admin/app';
import {DecodedIdToken, getAuth} from 'firebase-admin/auth';
import {NextRequest} from 'next/server';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  FIREBASE_SYNC_PAUSED,
  FIREBASE_SYNC_PAUSED_MESSAGE,
} from '@/lib/firebase/sync-config';
import {
  CLIENT_UID_HEADER_NAME,
  SESSION_COOKIE_NAME,
  verifySignedSessionToken,
} from '@/lib/utils/csrf-edge';
import {isSafeEntityId} from '@/lib/utils/security';

export interface VerifiedClientResult {
  ok: true;
  uid: string;
  email?: string;
  decoded?: DecodedIdToken;
  authSource: 'firebase_bearer' | 'signed_session';
}

export interface AuthFailureResult {
  ok: false;
  status: number;
  code:
    | 'AUTH_TOKEN_MISSING'
    | 'AUTH_TOKEN_INVALID'
    | 'EMAIL_NOT_VERIFIED'
    | 'CROSS_SYSTEM_FORBIDDEN'
    | 'USER_SESSION_CONFLICT'
    | 'AUTH_REQUIRED';
  error: string;
}

function getFirebaseAdminApp() {
  if (FIREBASE_SYNC_PAUSED) {
    throw new Error(FIREBASE_SYNC_PAUSED_MESSAGE);
  }
  const projectId = firebaseConfig?.projectId;
  if (!projectId || projectId === 'remixed-project-id') {
    throw new Error('Firebase projectId não configurado para verificação de tokens.');
  }
  return getApps().length > 0 ? getApp() : initializeApp({projectId});
}

export function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token && token.length >= 20 ? token : null;
}

/**
 * Verifies a Firebase ID Token cryptographically (zero IAM required) and enforces
 * verified-email and client-system isolation rules.
 */
export async function verifyFirebaseBearerToken(
  token: string
): Promise<VerifiedClientResult | AuthFailureResult> {
  if (FIREBASE_SYNC_PAUSED) {
    return {
      ok: false,
      status: 503,
      code: 'AUTH_TOKEN_INVALID',
      error: FIREBASE_SYNC_PAUSED_MESSAGE,
    };
  }
  try {
    const adminApp = getFirebaseAdminApp();
    const decoded = await getAuth(adminApp).verifyIdToken(token);

    if (!decoded.uid || !isSafeEntityId(decoded.uid)) {
      return {
        ok: false,
        status: 401,
        code: 'AUTH_TOKEN_INVALID',
        error: 'Identificador de usuário inválido no token de autenticação.',
      };
    }

    if (decoded.email_verified !== true) {
      return {
        ok: false,
        status: 403,
        code: 'EMAIL_NOT_VERIFIED',
        error: 'Confirme seu e-mail antes de acessar esta rota da API.',
      };
    }

    // Strict login/role isolation: reject dedicated barber-only tokens on client API
    if (
      decoded.appSystem === 'barber' ||
      decoded.system === 'barber' ||
      decoded.role === 'barber'
    ) {
      return {
        ok: false,
        status: 403,
        code: 'CROSS_SYSTEM_FORBIDDEN',
        error:
          'Isolamento de login: contas com sessão exclusiva de barbeiro não podem operar rotas privadas do cliente.',
      };
    }

    return {
      ok: true,
      uid: decoded.uid,
      email: typeof decoded.email === 'string' ? decoded.email : undefined,
      decoded,
      authSource: 'firebase_bearer',
    };
  } catch {
    return {
      ok: false,
      status: 401,
      code: 'AUTH_TOKEN_INVALID',
      error: 'Token de autenticação Firebase inválido ou expirado.',
    };
  }
}

/**
 * Resolves the active authenticated user for client API endpoints and blocks
 * conflicts between the Bearer token UID, the HttpOnly session cookie UID,
 * and the optional x-client-uid assertion header.
 */
export async function resolveAuthenticatedClient(
  req: NextRequest
): Promise<VerifiedClientResult | AuthFailureResult> {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const sessionClaims = await verifySignedSessionToken(sessionCookie, 'client');
  const expectedUidHeader = req.headers.get(CLIENT_UID_HEADER_NAME)?.trim();
  const bearerToken = extractBearerToken(req);

  if (bearerToken) {
    const bearerAuth = await verifyFirebaseBearerToken(bearerToken);
    if (!bearerAuth.ok) {
      return bearerAuth;
    }

    if (
      sessionClaims?.authState === 'authenticated' &&
      sessionClaims.uid &&
      sessionClaims.uid !== bearerAuth.uid
    ) {
      return {
        ok: false,
        status: 409,
        code: 'USER_SESSION_CONFLICT',
        error:
          'Conflito entre contas: a sessão do navegador pertence a outro usuário. Sincronize seu login.',
      };
    }

    if (expectedUidHeader && expectedUidHeader !== bearerAuth.uid) {
      return {
        ok: false,
        status: 409,
        code: 'USER_SESSION_CONFLICT',
        error:
          'Conflito de usuário na requisição: identificador divergente do usuário autenticado.',
      };
    }

    return bearerAuth;
  }

  if (sessionClaims?.authState === 'authenticated' && sessionClaims.uid) {
    if (expectedUidHeader && expectedUidHeader !== sessionClaims.uid) {
      return {
        ok: false,
        status: 409,
        code: 'USER_SESSION_CONFLICT',
        error:
          'Conflito entre sessões de usuário no navegador. Recarregue para sincronizar.',
      };
    }

    return {
      ok: true,
      uid: sessionClaims.uid,
      authSource: 'signed_session',
    };
  }

  return {
    ok: false,
    status: 401,
    code: 'AUTH_REQUIRED',
    error: 'Autenticação necessária. Entre com sua conta Google / Gmail para continuar.',
  };
}
