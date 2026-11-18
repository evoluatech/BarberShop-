'use client';

import Image from 'next/image';
import {ArrowLeft, Calendar, Star} from 'lucide-react';
import {BARBERS} from '@/lib/data/seed';
import {Barber} from '@/lib/types/domain';

interface BarbersViewProps {
  onBack?: () => void;
  onOpenBarberProfile: (barber: Barber) => void;
  onBookWithBarber: (barberId: string) => void;
}

export function BarbersView({
  onBack,
  onOpenBarberProfile,
  onBookWithBarber,
}: BarbersViewProps) {
  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] text-white hover:border-[#F7931E]/60 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Nossos Profissionais
          </h1>
          <p className="text-sm text-[#E5E5E5]/75">
            Especialistas dedicados ao corte masculino, barba e visagismo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {BARBERS.map((barber) => (
          <article
            key={barber.id}
            className="flex flex-col rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] overflow-hidden"
          >
            <div className="relative aspect-square w-full bg-[#111111] overflow-hidden">
              <Image
                src={barber.avatarUrl}
                alt={barber.name}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                referrerPolicy="no-referrer"
                className="object-cover object-top"
              />
            </div>

            <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#E5E5E5]/70 tabular-nums">
                  <span className="inline-flex items-center gap-1 font-semibold text-white">
                    <Star className="h-3.5 w-3.5 fill-[#F7931E] text-[#F7931E]" />
                    {barber.rating.toFixed(1).replace('.', ',')} ({barber.reviewCount})
                  </span>
                  <span>{barber.experienceYears} anos de exp.</span>
                </div>

                <h2 className="font-display text-xl font-bold text-white">
                  {barber.name}
                </h2>
                <p className="text-xs font-medium text-[#F7931E]">{barber.role}</p>
                <p className="text-sm leading-relaxed text-[#E5E5E5]/75">
                  {barber.bio}
                </p>

                <p className="text-xs text-[#E5E5E5]/60 pt-1">
                  {barber.specialties.join(' · ')}
                </p>
              </div>

              <div className="pt-3 border-t border-[#2B2B2B] flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onOpenBarberProfile(barber)}
                  className="w-full min-h-[44px] rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  Ver perfil
                </button>
                <button
                  type="button"
                  onClick={() => onBookWithBarber(barber.id)}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2 text-sm font-semibold text-[#111111] transition-colors"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Agendar com {barber.name.split(' ')[0]}</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
