'use client';

import Image from 'next/image';
import {Calendar, Check, Clock, Star, WifiOff, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import {useFirebaseAuth} from '@/components/FirebaseProvider';
import {useOnlineStatus} from '@/hooks/useOnlineStatus';
import {fetchAvailabilitySlots} from '@/lib/api/client';
import {SERVICES} from '@/lib/data/seed';
import {fetchFirestoreAvailabilitySlots} from '@/lib/firebase/repository';
import {Barber, Service, TimeSlotAvailability} from '@/lib/types/domain';
import {formatCurrencyBRL, getUpcomingDatesList} from '@/lib/utils/formatters';

interface BarberProfileSheetProps {
  barber: Barber | null;
  onClose: () => void;
  onBookWithBarber: (
    barberId: string,
    serviceId?: string,
    dateISO?: string,
    time?: string
  ) => void;
  onSelectService: (service: Service) => void;
}

export function BarberProfileSheet({
  barber,
  onClose,
  onBookWithBarber,
  onSelectService,
}: BarberProfileSheetProps) {
  const isOnline = useOnlineStatus();
  const {isVerifiedUser} = useFirebaseAuth();
  const [slotsData, setSlotsData] = useState<{
    key: string;
    slots: TimeSlotAvailability[];
  }>({key: '', slots: []});

  const nextOpenDay = getUpcomingDatesList(7).find(
    (d) => d.dayOfWeek !== 1 && barber?.workingDays.includes(d.dayOfWeek)
  );
  const targetDateISO = nextOpenDay?.dateISO ?? '';
  const requestKey =
    barber && targetDateISO
      ? `${barber.id}:${targetDateISO}:${isVerifiedUser ? 'fb' : 'local'}`
      : '';
  const loadingSlots = Boolean(isOnline && requestKey && slotsData.key !== requestKey);
  const slots = slotsData.key === requestKey ? slotsData.slots : [];

  useEffect(() => {
    if (!isOnline || !barber || !targetDateISO || !requestKey) return;
    let active = true;
    const loader = isVerifiedUser
      ? fetchFirestoreAvailabilitySlots
      : fetchAvailabilitySlots;

    loader({
      dateISO: targetDateISO,
      serviceId: barber.serviceIds[0],
      barberId: barber.id,
    })
      .then((data) => {
        if (active) {
          setSlotsData({
            key: requestKey,
            slots: data.slots,
          });
        }
      })
      .catch(() => {
        if (active) {
          setSlotsData({key: requestKey, slots: []});
        }
      });

    return () => {
      active = false;
    };
  }, [barber, targetDateISO, requestKey, isOnline, isVerifiedUser]);

  useEffect(() => {
    if (!barber) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barber, onClose]);

  if (!barber) return null;

  const barberServices = SERVICES.filter((s) => barber.serviceIds.includes(s.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barber-profile-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#1C1C1C] border border-[#2B2B2B] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2B2B2B]">
          <h2
            id="barber-profile-title"
            className="font-display text-lg font-bold text-white"
          >
            Perfil do Profissional
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar perfil do profissional"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#E5E5E5]/70 hover:text-white hover:bg-[#2B2B2B] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Cabeçalho com foto maior */}
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            <Image
              src={barber.avatarUrl}
              alt={barber.name}
              width={128}
              height={128}
              referrerPolicy="no-referrer"
              className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl object-cover object-top border border-[#2B2B2B] shrink-0"
            />
            <div className="space-y-2">
              <h3 className="font-display text-2xl font-bold text-white">
                {barber.name}
              </h3>
              <p className="text-sm font-medium text-[#F7931E]">{barber.role}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#E5E5E5]/75 tabular-nums">
                <span className="inline-flex items-center gap-1 font-semibold text-white">
                  <Star className="h-4 w-4 fill-[#F7931E] text-[#F7931E]" />
                  {barber.rating.toFixed(1).replace('.', ',')} de 5 (
                  {barber.reviewCount} avaliações)
                </span>
                <span aria-hidden="true">·</span>
                <span>{barber.experienceYears} anos de experiência</span>
              </div>
              <p className="text-sm leading-relaxed text-[#E5E5E5]/85">{barber.bio}</p>
            </div>
          </div>

          {/* Especialidades */}
          <div className="space-y-2.5">
            <h4 className="font-display text-base font-semibold text-white">
              Especialidades
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {barber.specialties.map((spec) => (
                <div
                  key={spec}
                  className="flex items-center gap-2 text-sm text-[#E5E5E5]/85"
                >
                  <Check className="h-4 w-4 text-[#F7931E] shrink-0" />
                  <span>{spec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Horários disponíveis */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-base font-semibold text-white">
                Próximos horários ({nextOpenDay?.weekdayShort}, {nextOpenDay?.dayNumber}
                /{nextOpenDay?.monthShort})
              </h4>
              <span className="text-xs text-[#E5E5E5]/60 inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-[#F7931E]" />
                Agenda ao vivo
              </span>
            </div>

            {!isOnline ? (
              <p className="text-xs text-amber-200 flex items-center gap-1.5 py-2">
                <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>
                  Conecte-se à internet para consultar os horários livres ao vivo.
                </span>
              </p>
            ) : loadingSlots ? (
              <p className="text-xs text-[#E5E5E5]/60 py-2">
                Carregando horários disponíveis...
              </p>
            ) : slots.filter((s) => s.available).length === 0 ? (
              <p className="text-xs text-[#E5E5E5]/65 py-2">
                Nenhum horário livre para esta data. Veja outras datas na tela de
                agendamento.
              </p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {slots.slice(0, 12).map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => {
                      onClose();
                      onBookWithBarber(
                        barber.id,
                        barber.serviceIds[0],
                        targetDateISO,
                        slot.time
                      );
                    }}
                    className={`min-h-[40px] rounded-lg font-mono text-xs font-medium tabular-nums transition-colors ${
                      slot.available
                        ? 'bg-[#111111] border border-[#2B2B2B] text-white hover:border-[#F7931E] hover:text-[#F7931E]'
                        : 'bg-[#111111]/40 border border-[#2B2B2B]/40 text-[#E5E5E5]/30 line-through cursor-not-allowed'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Serviços realizados */}
          <div className="space-y-2.5">
            <h4 className="font-display text-base font-semibold text-white">
              Serviços realizados
            </h4>
            <div className="divide-y divide-[#2B2B2B] rounded-xl border border-[#2B2B2B] bg-[#111111] px-4">
              {barberServices.map((service) => (
                <div
                  key={service.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectService(service);
                    }}
                    className="text-left text-sm font-medium text-white hover:text-[#F7931E] transition-colors"
                  >
                    {service.name}
                  </button>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm font-semibold text-white tabular-nums">
                      {formatCurrencyBRL(service.priceCents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onBookWithBarber(barber.id, service.id);
                      }}
                      className="min-h-[36px] px-3 rounded-lg bg-[#2B2B2B] hover:bg-[#F7931E] hover:text-[#111111] text-xs font-medium text-white transition-colors"
                    >
                      Agendar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Avaliações */}
          <div className="space-y-2.5">
            <h4 className="font-display text-base font-semibold text-white">
              Avaliações recentes
            </h4>
            <div className="space-y-3">
              {barber.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-xl border border-[#2B2B2B] bg-[#111111] p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs text-[#E5E5E5]/65">
                    <span className="font-semibold text-white">{rev.clientName}</span>
                    <span>
                      {rev.serviceName} · {rev.dateLabel}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#E5E5E5]/80">
                    “{rev.comment}”
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 sm:px-6 border-t border-[#2B2B2B] bg-[#111111]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onBookWithBarber(barber.id);
            }}
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-5 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
          >
            <Calendar className="h-4 w-4" />
            <span>Agendar com este profissional</span>
          </button>
        </div>
      </div>
    </div>
  );
}
