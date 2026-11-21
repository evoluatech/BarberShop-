'use client';

import Image from 'next/image';
import {Calendar, Check, Clock, ScanFace, Star, X} from 'lucide-react';
import {useEffect} from 'react';
import {BARBERS} from '@/lib/data/seed';
import {Barber, Service, VirtualHairstyleId} from '@/lib/types/domain';
import {formatCurrencyBRL, formatDuration} from '@/lib/utils/formatters';

interface ServiceDetailSheetProps {
  service: Service | null;
  onClose: () => void;
  onBookService: (serviceId: string, barberId?: string) => void;
  onSelectBarber: (barber: Barber) => void;
  onOpenTryOn: (styleId: VirtualHairstyleId) => void;
}

export function ServiceDetailSheet({
  service,
  onClose,
  onBookService,
  onSelectBarber,
  onOpenTryOn,
}: ServiceDetailSheetProps) {
  useEffect(() => {
    if (!service) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [service, onClose]);

  if (!service) return null;

  const eligibleBarbers = BARBERS.filter((b) => service.barberIds.includes(b.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#1C1C1C] border border-[#2B2B2B] overflow-hidden shadow-2xl">
        <div className="relative h-52 sm:h-64 w-full bg-[#111111] shrink-0">
          <Image
            src={service.imageUrl}
            alt={service.name}
            fill
            sizes="(max-width: 640px) 100vw, 672px"
            referrerPolicy="no-referrer"
            className="object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#1C1C1C] via-black/35 to-transparent"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes do serviço"
            className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#111111]/85 border border-[#2B2B2B] text-white hover:border-[#F7931E] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#F7931E]">
                {service.category} ·{' '}
                <span className="font-mono tabular-nums">
                  {formatDuration(service.durationMinutes)}
                </span>
              </p>
              <h2
                id="service-detail-title"
                className="font-display text-2xl font-bold text-white"
              >
                {service.name}
              </h2>
            </div>
            <span className="font-mono text-2xl font-bold text-white tabular-nums shrink-0">
              {formatCurrencyBRL(service.priceCents)}
            </span>
          </div>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <h3 className="font-display text-base font-semibold text-white">
              Descrição do serviço
            </h3>
            <p className="text-sm leading-relaxed text-[#E5E5E5]/85">
              {service.detailedDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#E5E5E5]/75 py-3 border-y border-[#2B2B2B]">
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
              <Clock className="h-4 w-4 text-[#F7931E]" />
              Duração estimada: {formatDuration(service.durationMinutes)}
            </span>
            <span aria-hidden="true">·</span>
            <span>Valor fixo transparente</span>
          </div>

          {/* Profissionais que realizam */}
          <div className="space-y-3">
            <h3 className="font-display text-base font-semibold text-white">
              Profissionais que realizam este serviço
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {eligibleBarbers.map((barber) => (
                <div
                  key={barber.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#2B2B2B] bg-[#111111] p-3"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectBarber(barber);
                    }}
                    className="flex items-center gap-3 text-left min-w-0 flex-1"
                  >
                    <Image
                      src={barber.avatarUrl}
                      alt={barber.name}
                      width={44}
                      height={44}
                      referrerPolicy="no-referrer"
                      className="h-11 w-11 rounded-lg object-cover object-top shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {barber.name}
                      </p>
                      <p className="text-xs text-[#E5E5E5]/65 inline-flex items-center gap-1 tabular-nums">
                        <Star className="h-3 w-3 fill-[#F7931E] text-[#F7931E]" />
                        {barber.rating.toFixed(1).replace('.', ',')}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onBookService(service.id, barber.id);
                    }}
                    className="min-h-[38px] px-3 rounded-lg bg-[#2B2B2B] hover:bg-[#F7931E] hover:text-[#111111] text-xs font-medium text-white transition-colors shrink-0"
                  >
                    Escolher
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cuidados e recomendações */}
          <div className="space-y-2.5">
            <h3 className="font-display text-base font-semibold text-white">
              Cuidados e recomendações
            </h3>
            <ul className="space-y-2">
              {service.careRecommendations.map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-2.5 text-sm text-[#E5E5E5]/80"
                >
                  <Check className="h-4 w-4 text-[#F7931E] shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-4 sm:px-6 border-t border-[#2B2B2B] bg-[#111111] flex flex-col sm:flex-row gap-3">
          {service.supportsVirtualTryOn && service.tryOnStyleId && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTryOn(service.tryOnStyleId!);
              }}
              className="sm:flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-4 py-2.5 text-sm font-medium text-white transition-colors"
            >
              <ScanFace className="h-4 w-4 text-[#F7931E] shrink-0" />
              <span>Ver compatibilidade (Face ID)</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onClose();
              onBookService(service.id);
            }}
            className="sm:flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-5 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
          >
            <Calendar className="h-4 w-4" />
            <span>Agendar este serviço</span>
          </button>
        </div>
      </div>
    </div>
  );
}
