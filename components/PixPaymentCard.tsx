'use client';

import {Check, Copy, QrCode} from 'lucide-react';
import {useMemo, useState} from 'react';
import {PixDetails} from '@/lib/types/domain';
import {formatCurrencyBRL, generatePixCopyPasteCode} from '@/lib/utils/formatters';
import {copyTextResilient} from '@/lib/utils/security';

interface PixPaymentCardProps {
  pixDetails: PixDetails;
  amountCents: number;
  bookingCode?: string;
  subtitle?: string;
}

export function PixPaymentCard({
  pixDetails,
  amountCents,
  bookingCode,
  subtitle,
}: PixPaymentCardProps) {
  const [copiedField, setCopiedField] = useState<'key' | 'code' | null>(null);

  const pixCopyPaste = useMemo(
    () =>
      generatePixCopyPasteCode({
        pixKey: pixDetails.pixKey,
        merchantName: pixDetails.holderName,
        city: pixDetails.city,
        amountCents,
        txId: bookingCode || 'BARBERSHOP',
      }),
    [pixDetails, amountCents, bookingCode]
  );

  const handleCopy = async (text: string, field: 'key' | 'code') => {
    const ok = await copyTextResilient(text);
    setCopiedField(ok ? field : null);
    if (ok) {
      window.setTimeout(() => setCopiedField(null), 2200);
    }
  };

  return (
    <div className="rounded-xl border border-[#F7931E]/45 bg-[#111111] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-[#F7931E]/15 border border-[#F7931E]/35 flex items-center justify-center shrink-0">
            <QrCode className="h-4 w-4 text-[#F7931E]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Pix do barbeiro · {pixDetails.holderName}
            </p>
            <p className="text-xs text-[#E5E5E5]/65">
              {subtitle || `${pixDetails.bankName} · Chave ${pixDetails.pixKeyType}`}
            </p>
          </div>
        </div>

        <span className="font-mono text-sm font-bold text-[#F7931E] tabular-nums shrink-0">
          {formatCurrencyBRL(amountCents)}
        </span>
      </div>

      <div className="rounded-lg border border-[#2B2B2B] bg-[#1C1C1C] px-3 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-[10px] uppercase tracking-wider text-[#E5E5E5]/55">
            Chave Pix ({pixDetails.pixKeyType})
          </span>
          <span className="block font-mono text-xs sm:text-sm text-white truncate">
            {pixDetails.pixKey}
          </span>
        </div>

        <button
          type="button"
          onClick={() => handleCopy(pixDetails.pixKey, 'key')}
          className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E] px-3 py-1.5 text-xs font-medium text-white transition-colors shrink-0"
        >
          {copiedField === 'key' ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Chave copiada</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-[#F7931E]" />
              <span>Copiar chave</span>
            </>
          )}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <p className="text-[11px] text-[#E5E5E5]/65 leading-relaxed">
          Pague agora ou diretamente na barbearia apresentando o comprovante ao
          profissional.
        </p>
        <button
          type="button"
          onClick={() => handleCopy(pixCopyPaste, 'code')}
          className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F7931E] hover:bg-[#D97706] px-3.5 py-1.5 text-xs font-semibold text-[#111111] transition-colors whitespace-nowrap shrink-0"
        >
          {copiedField === 'code' ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copia e Cola copiado</span>
            </>
          ) : (
            <>
              <QrCode className="h-3.5 w-3.5" />
              <span>Pix Copia e Cola</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
