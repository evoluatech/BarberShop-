'use client';

import {Check, Copy, ExternalLink, MapPin, Navigation, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import {BARBERSHOP_INFO} from '@/lib/data/seed';
import {copyTextResilient} from '@/lib/utils/security';

interface MapLocationModalProps {
  open: boolean;
  onClose: () => void;
}

export function MapLocationModal({open, onClose}: MapLocationModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const mapsQueryUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    BARBERSHOP_INFO.address.fullFormatted
  )}`;

  const handleCopyAddress = async () => {
    const ok = await copyTextResilient(BARBERSHOP_INFO.address.fullFormatted);
    setCopied(ok);
    if (ok) {
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#1C1C1C] border border-[#2B2B2B] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2B2B2B]">
          <div className="flex items-center gap-2.5">
            <MapPin className="h-5 w-5 text-[#F7931E]" />
            <h2
              id="map-modal-title"
              className="font-display text-lg font-semibold text-white"
            >
              Localização da Barbearia
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar mapa"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#E5E5E5]/70 hover:text-white hover:bg-[#2B2B2B] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stylized architectural street map card (zero external map key needed, fully functional) */}
          <div className="relative h-56 w-full rounded-xl bg-[#111111] border border-[#2B2B2B] overflow-hidden">
            <svg
              viewBox="0 0 400 220"
              className="h-full w-full opacity-90"
              aria-hidden="true"
            >
              <rect width="400" height="220" fill="#141414" />
              <path
                d="M0 55 H400 M0 115 H400 M0 175 H400 M75 0 V220 M195 0 V220 M315 0 V220"
                stroke="#262626"
                strokeWidth="8"
              />
              <path d="M0 115 H400" stroke="#333333" strokeWidth="14" />
              <path d="M195 0 V220" stroke="#2E2E2E" strokeWidth="12" />
              <rect x="92" y="68" width="88" height="34" rx="4" fill="#1C1C1C" />
              <rect x="210" y="68" width="90" height="34" rx="4" fill="#1C1C1C" />
              <rect x="92" y="130" width="88" height="32" rx="4" fill="#1C1C1C" />
              <rect x="210" y="130" width="90" height="32" rx="4" fill="#1C1C1C" />
              <text x="20" y="104" fill="#8E8E8E" fontSize="9" fontFamily="sans-serif">
                Av. Central
              </text>
              <text x="204" y="28" fill="#8E8E8E" fontSize="9" fontFamily="sans-serif">
                R. do Comércio
              </text>
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7931E] text-[#111111] shadow-lg shadow-[#F7931E]/30">
                  <MapPin className="h-6 w-6" />
                </div>
                <span className="mt-2 rounded-lg bg-[#111111]/95 border border-[#2B2B2B] px-3 py-1 text-xs font-semibold text-white">
                  Barber Shop · nº 450
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">
              {BARBERSHOP_INFO.address.street} — {BARBERSHOP_INFO.address.neighborhood}
            </p>
            <p className="text-sm text-[#E5E5E5]/75">
              {BARBERSHOP_INFO.address.city} — {BARBERSHOP_INFO.address.state} · CEP{' '}
              <span className="font-mono tabular-nums">
                {BARBERSHOP_INFO.address.zipCode}
              </span>
            </p>
            <p className="text-xs text-[#E5E5E5]/60">
              Região central com fácil acesso e estacionamentos conveniados a 50 metros.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleCopyAddress}
              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#111111] px-4 py-2.5 text-sm font-medium text-white hover:border-[#F7931E]/60 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-[#F7931E]" />
                  <span>Endereço copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-[#E5E5E5]/75" />
                  <span>Copiar endereço</span>
                </>
              )}
            </button>

            <a
              href={mapsQueryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
            >
              <Navigation className="h-4 w-4" />
              <span>Abrir rota no mapa</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
