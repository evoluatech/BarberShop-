'use client';

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  clearApiUserSession,
  setApiAuthContext,
  syncApiUserSession,
} from '@/lib/api/client';
import {
  auth,
  googleProvider,
  isFirebaseSyncEnabled,
  testFirestoreConnection,
} from '@/lib/firebase/client';
import {FIREBASE_SYNC_PAUSED_MESSAGE} from '@/lib/firebase/sync-config';
import {
  ensureAdminAndCatalogSeeded,
  syncUserProfileWithFirestore,
} from '@/lib/firebase/repository';
import {ClientProfile} from '@/lib/types/domain';
import {sanitizeTextField} from '@/lib/utils/security';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  isVerifiedUser: boolean;
  catalogSeeded: boolean;
  firestoreProfile: ClientProfile | null;
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadAuthUser: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
  saveFirestoreProfile: (next: Partial<ClientProfile>) => Promise<ClientProfile | null>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function mapFirebaseAuthError(error: unknown): Error {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as {code?: unknown}).code)
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return new Error('O login com Google foi cancelado antes de concluir.');
    case 'auth/popup-blocked':
      return new Error(
        'O navegador bloqueou a janela do Google. Permita pop-ups ou abra o aplicativo em uma nova aba.'
      );
    case 'auth/operation-not-allowed':
      return new Error(
        'O provedor de E-mail/Senha ainda não foi ativado no Console do Firebase (Authentication > Sign-in method). Use o botão "Continuar com Google / Gmail" acima ou ative E-mail/Senha no Console.'
      );
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new Error('E-mail ou senha incorretos.');
    case 'auth/email-already-in-use':
      return new Error('Este e-mail já possui cadastro. Faça login na aba Entrar.');
    case 'auth/weak-password':
      return new Error('A senha precisa ter pelo menos 6 caracteres.');
    case 'auth/invalid-email':
      return new Error('O endereço de e-mail informado é inválido.');
    case 'auth/too-many-requests':
      return new Error(
        'Muitas tentativas seguidas. Aguarde alguns instantes antes de tentar novamente.'
      );
    case 'auth/unauthorized-domain':
      return new Error(
        'Domínio ainda não autorizado no Console do Firebase. Adicione este endereço em Authentication > Settings > Authorized domains.'
      );
    default:
      return new Error(
        error instanceof Error
          ? error.message
          : 'Não foi possível autenticar no Firebase no momento.'
      );
  }
}

export function FirebaseProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [, setAuthVersion] = useState<number>(0);
  const [authReady, setAuthReady] = useState<boolean>(!isFirebaseSyncEnabled);
  const [catalogSeeded, setCatalogSeeded] = useState<boolean>(false);
  const [firestoreProfile, setFirestoreProfile] = useState<ClientProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const lastSyncedApiUidRef = useRef<string | null>(null);
  const inFlightSyncRef = useRef<{uid: string; promise: Promise<void>} | null>(null);

  const syncVerifiedUserState = useCallback(async (verifiedUser: User) => {
    if (!verifiedUser.emailVerified) return;

    const existing = inFlightSyncRef.current;
    if (existing && existing.uid === verifiedUser.uid) {
      return existing.promise;
    }

    const syncPromise = (async () => {
      if (lastSyncedApiUidRef.current !== verifiedUser.uid) {
        try {
          const idToken = await verifiedUser.getIdToken();
          const apiOk = await syncApiUserSession(idToken);
          if (apiOk) {
            lastSyncedApiUidRef.current = verifiedUser.uid;
          }
        } catch {
          // Keep working offline; next API call will re-sync
        }
      }

      try {
        await ensureAdminAndCatalogSeeded(verifiedUser);
        setCatalogSeeded(true);
      } catch {
        // Non-admin user or offline
      }

      try {
        const synced = await syncUserProfileWithFirestore(verifiedUser);
        setFirestoreProfile(synced);
      } catch {
        // Ignore passive profile sync failures when offline
      }
    })();

    inFlightSyncRef.current = {uid: verifiedUser.uid, promise: syncPromise};
    try {
      await syncPromise;
    } finally {
      if (inFlightSyncRef.current?.promise === syncPromise) {
        inFlightSyncRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseSyncEnabled || !auth) {
      setApiAuthContext({
        getIdToken: async () => null,
        getExpectedUid: () => null,
      });
      clearApiUserSession().catch(() => undefined);
      return;
    }

    const activeAuth = auth;
    setApiAuthContext({
      getIdToken: async () => {
        const current = activeAuth.currentUser;
        if (!current || !current.emailVerified) return null;
        return current.getIdToken();
      },
      getExpectedUid: () => {
        const current = activeAuth.currentUser;
        return current && current.emailVerified ? current.uid : null;
      },
    });

    testFirestoreConnection();
    const unsub = onAuthStateChanged(activeAuth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser && nextUser.emailVerified) {
        await syncVerifiedUserState(nextUser);
      } else {
        setFirestoreProfile(null);
        setCatalogSeeded(false);
        if (lastSyncedApiUidRef.current !== null) {
          lastSyncedApiUidRef.current = null;
          await clearApiUserSession().catch(() => undefined);
        }
      }
      setAuthReady(true);
    });
    return () => {
      unsub();
      setApiAuthContext({
        getIdToken: async () => null,
        getExpectedUid: () => null,
      });
    };
  }, [syncVerifiedUserState]);

  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseSyncEnabled || !auth) {
      throw new Error(FIREBASE_SYNC_PAUSED_MESSAGE);
    }
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user.emailVerified) {
        await syncVerifiedUserState(cred.user);
        setAuthModalOpen(false);
      }
    } catch (err) {
      throw mapFirebaseAuthError(err);
    }
  }, [syncVerifiedUserState]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!isFirebaseSyncEnabled || !auth) {
        throw new Error(FIREBASE_SYNC_PAUSED_MESSAGE);
      }
      try {
        const cred = await signInWithEmailAndPassword(
          auth,
          sanitizeTextField(email, 120),
          password
        );
        if (cred.user.emailVerified) {
          await syncVerifiedUserState(cred.user);
          setAuthModalOpen(false);
        }
      } catch (err) {
        throw mapFirebaseAuthError(err);
      }
    },
    [syncVerifiedUserState]
  );

  const registerWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      if (!isFirebaseSyncEnabled || !auth) {
        throw new Error(FIREBASE_SYNC_PAUSED_MESSAGE);
      }
      const cleanName = sanitizeTextField(name, 80);
      const cleanEmail = sanitizeTextField(email, 120);
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (cleanName) {
          await updateProfile(cred.user, {displayName: cleanName}).catch(
            () => undefined
          );
        }
        await sendEmailVerification(cred.user).catch(() => undefined);
      } catch (err) {
        throw mapFirebaseAuthError(err);
      }
    },
    []
  );

  const resendVerificationEmail = useCallback(async () => {
    if (!isFirebaseSyncEnabled || !auth?.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      throw mapFirebaseAuthError(err);
    }
  }, []);

  const reloadAuthUser = useCallback(async () => {
    if (!isFirebaseSyncEnabled || !auth?.currentUser) return false;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    setUser(refreshed);
    setAuthVersion((v) => v + 1);
    if (refreshed?.emailVerified) {
      await syncVerifiedUserState(refreshed);
      setAuthModalOpen(false);
      return true;
    }
    return false;
  }, [syncVerifiedUserState]);

  const signOutUser = useCallback(async () => {
    lastSyncedApiUidRef.current = null;
    inFlightSyncRef.current = null;
    await clearApiUserSession().catch(() => undefined);
    if (isFirebaseSyncEnabled && auth) {
      await signOut(auth);
    }
    setCatalogSeeded(false);
    setFirestoreProfile(null);
  }, []);

  const saveFirestoreProfile = useCallback(
    async (next: Partial<ClientProfile>) => {
      if (
        !isFirebaseSyncEnabled ||
        !auth?.currentUser ||
        !auth.currentUser.emailVerified
      ) {
        return null;
      }
      const saved = await syncUserProfileWithFirestore(auth.currentUser, next);
      setFirestoreProfile(saved);
      return saved;
    },
    []
  );

  const value = useMemo<FirebaseContextValue>(
    () => ({
      user,
      authReady,
      isVerifiedUser: Boolean(user && user.emailVerified),
      catalogSeeded,
      firestoreProfile,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      signInWithGoogle,
      signInWithEmail,
      registerWithEmail,
      resendVerificationEmail,
      reloadAuthUser,
      signOutUser,
      saveFirestoreProfile,
    }),
    [
      user,
      authReady,
      catalogSeeded,
      firestoreProfile,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      signInWithGoogle,
      signInWithEmail,
      registerWithEmail,
      resendVerificationEmail,
      reloadAuthUser,
      signOutUser,
      saveFirestoreProfile,
    ]
  );

  return (
    <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>
  );
}

export function useFirebaseAuth() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebaseAuth must be used inside FirebaseProvider');
  }
  return ctx;
}
