'use client';

import Image from 'next/image';
import {Clock, ScanFace, Scissors} from 'lucide-react';
import {useMemo, useState} from 'react';
import {BARBERS, SERVICES} from '@/lib/data/seed';
import {Service, ServiceCategory, VirtualHairstyleId} from '@/lib/types/domain';
import {formatCurrencyBRL, formatDuration} from '@/lib/utils/formatters';

interface ServicesViewProps {
  onBookService: (serviceId: string) => void;
  onOpenServiceDetail: (service: Service) => void;
  onOpenTryOn: (styleId: VirtualHairstyleId) => void;
}

const CATEGORIES: ('Todos' | ServiceCategory)[] = [
  'Todos',
  'Cortes',
  'Barba',
  'Combos',
  'Acabamentos',
];

export function ServicesView({
  onBookService,
  onOpenServiceDetail,
  onOpenTryOn,
}: ServicesViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<'Todos' | ServiceCategory>(
    'Todos'
  );

  const filteredServices = useMemo(() => {
    if (selectedCategory === 'Todos') return SERVICES;
    return SERVICES.filter((s) => s.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
          Serviços e Preços
        </h1>
        <p className="text-sm text-[#E5E5E5]/75">
          Cortes, barba e acabamentos com duração transparente e profissionais
          especializados.
        </p>
      </header>

      {/* Filtros por categoria */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1"
        role="tablist"
        aria-label="Filtrar serviços por categoria"
      >
        {CATEGORIES.map((category) => {
          const active = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedCategory(category)}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#F7931E] text-[#111111] font-semibold'
                  : 'bg-[#1C1C1C] text-[#E5E5E5]/80 border border-[#2B2B2B] hover:border-[#F7931E]/50'
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Lista de serviços */}
      {filteredServices.length === 0 ? (
        <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-10 text-center space-y-3">
          <Scissors className="h-8 w-8 text-[#F7931E] mx-auto" />
          <p className="text-base font-semibold text-white">
            Nenhum serviço encontrado nesta categoria
          </p>
          <button
            type="button"
            onClick={() => setSelectedCategory('Todos')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F7931E] text-sm font-semibold text-[#111111]"
          >
            Mostrar todos os serviços
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.map((service) => {
            const barberNames = service.barberIds
              .map((id) => BARBERS.find((b) => b.id === id)?.name.split(' ')[0])
              .filter(Boolean)
              .join(', ');

            return (
              <article
                key={service.id}
                className="flex flex-col rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] overflow-hidden"
              >
                <div className="relative aspect-[4/3] w-full bg-[#111111]">
                  <Image
                    src={service.imageUrl}
                    alt={service.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    referrerPolicy="no-referrer"
                    className="object-cover"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#E5E5E5]/65">
                      <span>{service.category}</span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-[#F7931E]" />
                        {formatDuration(service.durationMinutes)}
                      </span>
                    </div>

                    <h2 className="font-display text-xl font-bold text-white">
                      {service.name}
                    </h2>

                    <p className="text-sm leading-relaxed text-[#E5E5E5]/75">
                      {service.shortDescription}
                    </p>

                    <p className="text-xs text-[#E5E5E5]/60">
                      Profissionais: {barberNames}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#2B2B2B] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xl font-bold text-white tabular-nums">
                        {formatCurrencyBRL(service.priceCents)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenServiceDetail(service)}
                        className="min-h-[40px] px-2 text-xs font-medium text-[#E5E5E5] hover:text-[#F7931E] transition-colors"
                      >
                        Ver detalhes
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => onBookService(service.id)}
                        className="w-full min-h-[44px] rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
                      >
                        Agendar
                      </button>

                      {service.supportsVirtualTryOn && service.tryOnStyleId && (
                        <button
                          type="button"
                          onClick={() => onOpenTryOn(service.tryOnStyleId!)}
                          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 px-4 py-2 text-xs font-medium text-white transition-colors"
                        >
                          <ScanFace className="h-4 w-4 text-[#F7931E] shrink-0" />
                          <span>Ver compatibilidade (Face ID)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
