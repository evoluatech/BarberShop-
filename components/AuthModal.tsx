'use client';

import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {useFirebaseAuth} from '@/components/FirebaseProvider';
import {sanitizeTextField} from '@/lib/utils/security';

export function AuthModal() {
  const {
    user,
    authModalOpen,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resendVerificationEmail,
    reloadAuthUser,
  } = useFirebaseAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleCloseModal = useCallback(() => {
    setPassword('');
    setError(null);
    setNotice(null);
    setMode('login');
    closeAuthModal();
  }, [closeAuthModal]);

  useEffect(() => {
    if (!authModalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [authModalOpen, busy, handleCloseModal]);

  if (!authModalOpen) return null;

  const needsEmailVerification = Boolean(user && !user.emailVerified);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await signInWithGoogle();
      setPassword('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao entrar com Google / Gmail.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const cleanEmail = sanitizeTextField(email, 120);
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(cleanEmail, password);
        setPassword('');
      } else {
        const cleanName = sanitizeTextField(name, 80);
        if (cleanName.length < 2) {
          setError('Informe seu nome completo para criar a conta.');
          setBusy(false);
          return;
        }
        await registerWithEmail(cleanName, cleanEmail, password);
        setPassword('');
        setNotice(
          'Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme antes de continuar.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na autenticação por e-mail.');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckVerified = async () => {
    setBusy(true);
    setError(null);
    try {
      const ok = await reloadAuthUser();
      if (!ok) {
        setError(
          'E-mail ainda não confirmado. Verifique sua caixa de entrada ou spam no Gmail.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) handleCloseModal();
      }}
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2
              id="auth-modal-title"
              className="font-display text-xl font-bold text-white"
            >
              Entrar na Barber Shop
            </h2>
            <p className="text-xs text-[#E5E5E5]/70">
              Conecte sua conta Google / Gmail para salvar seus horários na nuvem com
              segurança.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleCloseModal}
            aria-label="Fechar janela de login"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#E5E5E5]/70 hover:text-white hover:bg-[#2B2B2B] disabled:opacity-50 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {needsEmailVerification ? (
          <div className="rounded-xl border border-[#F7931E]/40 bg-[#111111] p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <Mail className="h-5 w-5 text-[#F7931E] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  Confirme seu endereço de e-mail
                </p>
                <p className="text-xs text-[#E5E5E5]/75 leading-relaxed">
                  Enviamos um link de verificação para{' '}
                  <strong className="text-white">{user?.email}</strong>. Por segurança
                  das regras do banco, é necessário confirmar seu e-mail para liberar
                  agendamentos.
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-300 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleCheckVerified}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2 text-xs font-semibold text-[#111111]"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                <span>Já confirmei meu e-mail</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await resendVerificationEmail();
                    setNotice('Novo e-mail de confirmação enviado!');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Erro ao reenviar.');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="min-h-[42px] rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] px-4 py-2 text-xs font-medium text-white hover:border-[#F7931E]/60"
              >
                Reenviar e-mail de verificação
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Botão principal: Google / Gmail */}
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleSignIn}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2.5 rounded-xl bg-white hover:bg-[#E5E5E5] disabled:opacity-60 px-4 py-3 text-sm font-semibold text-[#111111] transition-colors"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4 text-[#F7931E]" />
              )}
              <span>Continuar com Google / Gmail</span>
            </button>

            <div className="relative flex items-center justify-center">
              <span className="h-px w-full bg-[#2B2B2B]" />
              <span className="bg-[#1C1C1C] px-3 text-[11px] text-[#E5E5E5]/55 whitespace-nowrap">
                ou usar e-mail e senha
              </span>
              <span className="h-px w-full bg-[#2B2B2B]" />
            </div>

            <div className="grid grid-cols-2 rounded-xl bg-[#111111] border border-[#2B2B2B] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setNotice(null);
                }}
                className={`min-h-[36px] rounded-lg text-xs font-medium transition-colors ${
                  mode === 'login'
                    ? 'bg-[#F7931E] text-[#111111] font-semibold'
                    : 'text-[#E5E5E5]/70 hover:text-white'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setNotice(null);
                }}
                className={`min-h-[36px] rounded-lg text-xs font-medium transition-colors ${
                  mode === 'register'
                    ? 'bg-[#F7931E] text-[#111111] font-semibold'
                    : 'text-[#E5E5E5]/70 hover:text-white'
                }`}
              >
                Criar conta
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {mode === 'register' && (
                <div className="space-y-1">
                  <label
                    htmlFor="auth-name"
                    className="block text-xs font-medium text-[#E5E5E5]/80"
                  >
                    Nome completo
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full min-h-[44px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-3.5 text-sm text-white focus:border-[#F7931E] focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-medium text-[#E5E5E5]/80"
                >
                  E-mail (Gmail ou outro)
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  maxLength={120}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@gmail.com"
                  className="w-full min-h-[44px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-3.5 text-sm text-white focus:border-[#F7931E] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-[#E5E5E5]/80"
                >
                  Senha
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  maxLength={80}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full min-h-[44px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-3.5 text-sm text-white focus:border-[#F7931E] focus:outline-none"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {notice && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{notice}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
              >
                {mode === 'login' ? (
                  <>
                    <KeyRound className="h-4 w-4" />
                    <span>Entrar com e-mail</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>Cadastrar conta</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <div className="flex items-center gap-2 text-[11px] text-[#E5E5E5]/60 pt-1">
          <ShieldCheck className="h-4 w-4 text-[#F7931E] shrink-0" />
          <span>
            Dados protegidos por autenticação Firebase e regras restritas ao seu usuário.
          </span>
        </div>
      </div>
    </div>
  );
}
