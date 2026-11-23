'use client';

import {ShieldCheck, X} from 'lucide-react';
import {useEffect} from 'react';
import {BARBERSHOP_INFO} from '@/lib/data/seed';

interface PrivacyPolicyModalProps {
  open: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({open, onClose}: PrivacyPolicyModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-xl max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#1C1C1C] border border-[#2B2B2B] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2B2B2B]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-[#F7931E]" />
            <h2
              id="privacy-modal-title"
              className="font-display text-lg font-semibold text-white"
            >
              Política de Privacidade e LGPD
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar política de privacidade"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#E5E5E5]/70 hover:text-white hover:bg-[#2B2B2B] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-sm leading-relaxed text-[#E5E5E5]/85">
          <p>
            A <strong className="text-white">{BARBERSHOP_INFO.name}</strong> respeita a
            sua privacidade e trata os seus dados pessoais em conformidade com os
            princípios da Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
          </p>

          <div className="space-y-1.5">
            <h3 className="font-display text-base font-semibold text-white">
              1. Dados de Agendamento
            </h3>
            <p className="text-[#E5E5E5]/75">
              Coletamos apenas seu nome, telefone e, opcionalmente, e-mail e observações
              para confirmar seu horário, evitar reservas duplicadas e permitir
              cancelamentos ou solicitações de reagendamento.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-display text-base font-semibold text-white">
              2. Face ID em Dados (Sem Captura de Fotos ou Vídeo)
            </h3>
            <p className="text-[#E5E5E5]/75">
              O diagnóstico de compatibilidade funciona exclusivamente com os dados que
              você informa no formulário (formato do rosto, tipo de fio, comprimento e
              medidas básicas opcionais). Nenhuma imagem, foto ou vídeo é capturada,
              processada ou armazenada.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-display text-base font-semibold text-white">
              3. Critérios Técnicos de Visagismo
            </h3>
            <p className="text-[#E5E5E5]/75">
              O sistema calcula localmente a compatibilidade do corte escolhido com o
              formato do rosto e o tipo de cabelo informados, exibindo um retorno
              objetivo positivo (verde) ou negativo (vermelho). Converse com nossos
              barbeiros para confirmar os detalhes na cadeira.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-display text-base font-semibold text-white">
              4. Direitos do Titular e Contato
            </h3>
            <p className="text-[#E5E5E5]/75">
              Você pode solicitar atualização ou exclusão dos seus dados de contato a
              qualquer momento pelo e-mail{' '}
              <span className="text-white font-medium">
                {BARBERSHOP_INFO.contact.email}
              </span>{' '}
              ou pelo telefone{' '}
              <span className="text-white font-medium">
                {BARBERSHOP_INFO.contact.phone}
              </span>
              .
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-[#2B2B2B] bg-[#111111]/60">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
