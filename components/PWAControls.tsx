'use client';

import {
  CheckCircle2,
  Download,
  PlusSquare,
  Share,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useOnlineStatus} from '@/hooks/useOnlineStatus';
import {usePWAInstall} from '@/hooks/usePWAInstall';

export function PWAServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silencioso para ambientes onde o preview bloqueia SW
    });
  }, []);

  return null;
}

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export function PWAInstallButton({variant = 'compact'}: PWAInstallButtonProps) {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    if (!showGuideModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGuideModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGuideModal]);

  // Quando já estiver instalado em modo standalone:
  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#111111] border border-[#2B2B2B] flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-[#F7931E]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Aplicativo instalado (PWA ativo)
            </p>
            <p className="text-xs text-[#E5E5E5]/70">
              Você está acessando a Barber Shop no modo aplicativo.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  const buttonLabel = isInstallable
    ? 'Instalar aplicativo'
    : isIOS
      ? 'Instalar no iPhone'
      : 'Como instalar (PWA)';

  return (
    <>
      {variant === 'card' ? (
        <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#111111] border border-[#2B2B2B] flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 text-[#F7931E]" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                Aplicativo Web Instalável (PWA)
              </h3>
              <p className="text-xs text-[#E5E5E5]/70 leading-relaxed mt-0.5">
                {isInstallable
                  ? 'Instale a Barber Shop na tela inicial do seu celular ou computador para acesso rápido.'
                  : isIOS
                    ? 'No Safari (iPhone/iPad), toque em Compartilhar e escolha "Adicionar à Tela de Início".'
                    : 'PWA ativo para testes. Abra a URL direta no Chrome, Edge ou Safari para adicionar à tela inicial.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAction}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#111111] transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>{buttonLabel}</span>
          </button>
        </div>
      ) : (
        (isInstallable || isIOS) && (
          <button
            type="button"
            onClick={handleAction}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 px-4 py-2 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5 text-[#F7931E]" />
            <span>{isIOS ? 'Instalar no iPhone' : 'Instalar app'}</span>
          </button>
        )
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Como instalar o aplicativo Barber Shop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGuideModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Instalar Barber Shop na tela inicial
                </h3>
                <p className="text-xs text-[#E5E5E5]/70 mt-1">
                  Modo PWA habilitado para teste em dispositivos móveis e desktop.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#2B2B2B] bg-[#111111] text-[#E5E5E5] hover:text-white"
                aria-label="Fechar instruções de instalação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-3 text-sm text-[#E5E5E5]/90">
                <li className="flex items-start gap-3">
                  <Share className="h-4 w-4 text-[#F7931E] shrink-0 mt-0.5" />
                  <span>
                    1. Toque no botão <strong>Compartilhar</strong> na barra inferior ou
                    superior do Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <PlusSquare className="h-4 w-4 text-[#F7931E] shrink-0 mt-0.5" />
                  <span>
                    2. Role as opções e toque em{' '}
                    <strong>Adicionar à Tela de Início</strong>.
                  </span>
                </li>
              </ol>
            ) : (
              <div className="space-y-3 text-sm text-[#E5E5E5]/85">
                <p>
                  No Chrome ou Edge, abra o aplicativo fora do painel de
                  pré-visualização e toque no ícone de <strong>Instalar</strong> na
                  barra de endereço ou no menu do navegador (
                  <strong className="text-white">Adicionar à tela inicial</strong>).
                </p>
                <p className="text-xs text-[#E5E5E5]/65">
                  Manifesto, Service Worker e ícones 192×192, 512×512 e Apple Touch já
                  estão configurados e ativos.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[44px] rounded-xl bg-[#F7931E] hover:bg-[#D97706] py-2.5 text-sm font-semibold text-[#111111] transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#F7931E] px-3.5 py-2 text-xs font-semibold text-[#111111] shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Modo offline — agendamentos exigem internet</span>
    </div>
  );
}
