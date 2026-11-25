'use client';

import {FirebaseApp, getApp, getApps, initializeApp} from 'firebase/app';
import {Auth, getAuth, GoogleAuthProvider} from 'firebase/auth';
import {doc, Firestore, getDocFromServer, getFirestore} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {FIREBASE_SYNC_PAUSED} from '@/lib/firebase/sync-config';

export const isFirebaseSyncEnabled =
  !FIREBASE_SYNC_PAUSED &&
  Boolean(
    firebaseConfig?.projectId && firebaseConfig.projectId !== 'remixed-project-id'
  );

const app: FirebaseApp | null = isFirebaseSyncEnabled
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const db: Firestore | null = app
  ? firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app)
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;
const CONN_SESSION_KEY = 'bs_fb_conn_ok';

export async function testFirestoreConnection(): Promise<void> {
  if (!isFirebaseSyncEnabled || !db) return;
  if (connectionTested) return;
  connectionTested = true;
  try {
    if (
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem(CONN_SESSION_KEY) === '1'
    ) {
      return;
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(CONN_SESSION_KEY, '1');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
