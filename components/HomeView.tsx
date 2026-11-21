'use client';

import Image from 'next/image';
import {
  ArrowRight,
  Calendar,
  Camera,
  Clock,
  ExternalLink,
  MapPin,
  ScanFace,
  Scissors,
  ShieldCheck,
  Star,
} from 'lucide-react';
import {useState} from 'react';
import {PWAInstallButton} from '@/components/PWAControls';
import {useCameraPermission} from '@/hooks/useCameraPermission';
import {BARBERS, BARBERSHOP_INFO, CLIENT_REVIEWS, SERVICES} from '@/lib/data/seed';
import {Barber, Service, VirtualHairstyleId} from '@/lib/types/domain';
import {formatCurrencyBRL, formatDuration} from '@/lib/utils/formatters';

interface HomeViewProps {
  onBookNow: (serviceId?: string, barberId?: string) => void;
  onOpenServices: () => void;
  onOpenServiceDetail: (service: Service) => void;
  onOpenBarbers: () => void;
  onOpenBarberProfile: (barber: Barber) => void;
  onOpenShopAbout: () => void;
  onOpenMap: () => void;
  onOpenTryOn: (styleId?: VirtualHairstyleId) => void;
}

export function HomeView({
  onBookNow,
  onOpenServices,
  onOpenServiceDetail,
  onOpenBarbers,
  onOpenBarberProfile,
  onOpenShopAbout,
  onOpenMap,
  onOpenTryOn,
}: HomeViewProps) {
  const popularServices = SERVICES.filter((s) => s.popular).slice(0, 4);
  const {preference: cameraPref, allowCamera, denyCamera} = useCameraPermission();
  const [cameraRequesting, setCameraRequesting] = useState(false);
  const [cameraFeedback, setCameraFeedback] = useState<{
    message: string;
    isIframeBlocked: boolean;
  } | null>(null);

  const handleAllowCameraEntry = async () => {
    setCameraRequesting(true);
    setCameraFeedback(null);
    const result = await allowCamera();
    setCameraRequesting(false);
    if (!result.ok && result.error) {
      setCameraFeedback({
        message: result.error,
        isIframeBlocked: Boolean(result.isIframeBlocked),
      });
    }
  };

  return (
    <div className="space-y-8 sm:space-y-12 pb-8">
      {/* Opção inicial de acesso à câmera para leitura Face ID */}
      {(cameraPref === 'unset' || cameraFeedback) && (
        <section
          aria-label="Preferência de acesso à câmera"
          className="rounded-2xl border border-[#F7931E]/40 bg-[#1C1C1C] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3 sm:gap-3.5 max-w-2xl min-w-0">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-[#111111] border border-[#2B2B2B] flex items-center justify-center shrink-0">
              <Camera className="h-5 w-5 text-[#F7931E]" />
            </div>
            <div className="space-y-1 min-w-0">
              <h2 className="font-display text-base font-bold text-white leading-snug break-words">
                Permitir acesso à câmera para leitura Face ID?
              </h2>
              <p className="text-xs sm:text-sm text-[#E5E5E5]/75 leading-relaxed break-words">
                O Face ID lê pela câmera o formato do seu rosto, tipo de cabelo e
                comprimento atual e exibe apenas o resultado em dados — sem exibir ou
                salvar fotos ou vídeos do corte.
              </p>
              {cameraFeedback && (
                <p className="text-xs text-amber-300 pt-1 leading-relaxed break-words">
                  {cameraFeedback.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0">
            {cameraFeedback?.isIframeBlocked && typeof window !== 'undefined' && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="min-[360px]:col-span-2 sm:col-span-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2 text-xs sm:text-sm font-semibold text-[#111111] transition-colors text-center leading-snug"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span>Abrir em nova aba</span>
              </a>
            )}
            <button
              type="button"
              disabled={cameraRequesting}
              onClick={handleAllowCameraEntry}
              className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-colors text-center leading-snug disabled:opacity-60 ${
                cameraFeedback?.isIframeBlocked
                  ? 'border border-[#2B2B2B] bg-[#111111] text-white hover:border-[#F7931E]/60'
                  : 'bg-[#F7931E] hover:bg-[#D97706] text-[#111111]'
              }`}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                {cameraRequesting
                  ? 'Solicitando...'
                  : cameraFeedback
                    ? 'Tentar novamente'
                    : 'Permitir câmera'}
              </span>
            </button>
            <button
              type="button"
              disabled={cameraRequesting}
              onClick={() => {
                setCameraFeedback(null);
                denyCamera();
              }}
              className="min-h-[44px] inline-flex items-center justify-center rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#E5E5E5]/40 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-[#E5E5E5] transition-colors text-center leading-snug"
            >
              Não permitir
            </button>
          </div>
        </section>
      )}

      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C]">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-6 p-4 sm:p-8 lg:p-10 flex flex-col justify-between min-w-0">
            <div>
              <p className="text-xs font-medium text-[#F7931E]">
                {BARBERSHOP_INFO.name} · Centro, São Paulo
              </p>
              <h1 className="mt-2.5 sm:mt-3 font-display text-[28px] leading-[1.12] sm:text-4xl lg:text-5xl font-bold tracking-tight text-white [text-wrap:balance]">
                Seu estilo começa aqui
              </h1>
              <p className="mt-3 sm:mt-4 text-sm sm:text-base leading-relaxed text-[#E5E5E5]/80 max-w-xl">
                Agende seu próximo corte em poucos segundos. Cortes modernos, barba com
                toalha quente e atendimento personalizado sem filas.
              </p>
            </div>

            <div className="mt-6 sm:mt-8 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => onBookNow()}
                  className="w-full min-[360px]:w-auto min-h-[46px] sm:min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-5 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold text-[#111111] transition-colors whitespace-nowrap shrink-0"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Agendar horário</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenServices}
                  className="w-full min-[360px]:w-auto min-h-[46px] sm:min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Scissors className="h-4 w-4 text-[#F7931E]" />
                  <span>Ver serviços</span>
                </button>
                <PWAInstallButton variant="compact" />
              </div>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#E5E5E5]/65 pt-1 sm:pt-2">
                <span>Terça a sexta · 09h às 20h</span>
                <span aria-hidden="true">·</span>
                <span>Sábado · 08h às 18h</span>
                <span aria-hidden="true">·</span>
                <span>Domingo · 09h às 14h</span>
              </div>
            </div>
          </div>

          <div className="relative lg:col-span-6 min-h-[220px] sm:min-h-[300px] lg:min-h-[380px] bg-[#111111]">
            <Image
              src={BARBERSHOP_INFO.heroImageUrl}
              alt="Ambiente interno da Barber Shop"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              referrerPolicy="no-referrer"
              className="object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#111111]/85 via-[#111111]/25 to-transparent lg:bg-gradient-to-r lg:from-[#1C1C1C] lg:via-transparent lg:to-transparent"
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={onOpenShopAbout}
              className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#111111]/90 border border-[#2B2B2B] px-3.5 py-2 text-xs font-medium text-white hover:border-[#F7931E] transition-colors max-w-[calc(100%-1.5rem)]"
            >
              <span className="truncate">Conhecer a barbearia</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#F7931E] shrink-0" />
            </button>
          </div>
        </div>
      </section>

      {/* Destaque Face ID em Dados */}
      <section className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-4 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          <div className="space-y-2 max-w-2xl min-w-0">
            <p className="text-xs font-medium text-[#F7931E]">
              Análise Face ID em Dados
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white [text-wrap:balance]">
              Veja pelos seus dados se o corte combina com você
            </h2>
            <p className="text-sm text-[#E5E5E5]/75 leading-relaxed break-words">
              O Face ID lê pela câmera o formato do seu rosto (ex.: oval, quadrado), tipo
              de cabelo e comprimento atual para mostrar em dados objetivos se dá bom
              corte ou não — sem exibir imagens ou vídeos simulados.
            </p>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onOpenTryOn()}
              className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-5 sm:px-6 py-3 text-sm font-semibold text-[#111111] transition-colors text-center leading-snug"
            >
              <ScanFace className="h-4 w-4 shrink-0" />
              <span>Fazer leitura Face ID</span>
            </button>
          </div>
        </div>
      </section>

      {/* Serviços mais populares */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
              Serviços mais populares
            </h2>
            <p className="mt-1 text-sm text-[#E5E5E5]/70">
              Escolha o visual que combina com você.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenServices}
            className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-[#F7931E] hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <span>Todos os serviços</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {popularServices.map((service) => (
            <article
              key={service.id}
              className="flex flex-col rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] overflow-hidden"
            >
              <div className="relative aspect-[4/3] w-full bg-[#111111]">
                <Image
                  src={service.imageUrl}
                  alt={service.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  referrerPolicy="no-referrer"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-4 space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#E5E5E5]/65">
                    <span>{service.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatDuration(service.durationMinutes)}
                    </span>
                  </div>
                  <h3 className="mt-1.5 font-display text-lg font-semibold text-white">
                    {service.name}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#E5E5E5]/70 line-clamp-2">
                    {service.shortDescription}
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-[#2B2B2B]">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-lg font-bold text-white tabular-nums">
                      {formatCurrencyBRL(service.priceCents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenServiceDetail(service)}
                      className="min-h-[36px] text-xs font-medium text-[#E5E5E5]/80 hover:text-[#F7931E] transition-colors"
                    >
                      Ver detalhes
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => onBookNow(service.id)}
                      className="w-full min-h-[44px] rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2 text-sm font-semibold text-[#111111] transition-colors"
                    >
                      Agendar
                    </button>
                    {service.supportsVirtualTryOn && service.tryOnStyleId && (
                      <button
                        type="button"
                        onClick={() => onOpenTryOn(service.tryOnStyleId)}
                        className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 px-3 py-2 text-xs font-medium text-[#E5E5E5] transition-colors"
                      >
                        <ScanFace className="h-3.5 w-3.5 text-[#F7931E] shrink-0" />
                        <span>Ver compatibilidade (Face ID)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Profissionais em destaque */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
              Profissionais em destaque
            </h2>
            <p className="mt-1 text-sm text-[#E5E5E5]/70">
              Barbeiros experientes para o corte clássico ou moderno.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBarbers}
            className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-[#F7931E] hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <span>Ver equipe</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BARBERS.map((barber) => (
            <article
              key={barber.id}
              className="flex flex-col rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-5 space-y-4"
            >
              <div className="flex items-center gap-4">
                <Image
                  src={barber.avatarUrl}
                  alt={barber.name}
                  width={64}
                  height={64}
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-xl object-cover object-top border border-[#2B2B2B] shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold text-white truncate">
                    {barber.name}
                  </h3>
                  <p className="text-xs text-[#F7931E] line-clamp-1">{barber.role}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#E5E5E5]/75 tabular-nums">
                    <span className="inline-flex items-center gap-1 text-white font-medium">
                      <Star className="h-3.5 w-3.5 fill-[#F7931E] text-[#F7931E]" />
                      {barber.rating.toFixed(1).replace('.', ',')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{barber.experienceYears} anos de experiência</span>
                  </div>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-[#E5E5E5]/75">{barber.bio}</p>

              <p className="text-xs text-[#E5E5E5]/60">
                {barber.specialties.slice(0, 3).join(' · ')}
              </p>

              <div className="mt-auto pt-3 border-t border-[#2B2B2B] flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenBarberProfile(barber)}
                  className="flex-1 min-h-[44px] rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 px-3 py-2 text-xs font-medium text-white transition-colors"
                >
                  Ver perfil
                </button>
                <button
                  type="button"
                  onClick={() => onBookNow(undefined, barber.id)}
                  className="flex-1 min-h-[44px] rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-3 py-2 text-xs font-semibold text-[#111111] transition-colors"
                >
                  Agendar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Avaliações de clientes */}
      <section className="space-y-5">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">
            Avaliações de clientes
          </h2>
          <p className="mt-1 text-sm text-[#E5E5E5]/70">
            Experiências reais de quem cuida do visual na Barber Shop.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CLIENT_REVIEWS.map((review) => (
            <article
              key={review.id}
              className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#E5E5E5]/65">
                  <span className="inline-flex items-center gap-1 font-semibold text-white tabular-nums">
                    <Star className="h-3.5 w-3.5 fill-[#F7931E] text-[#F7931E]" />
                    {review.rating.toFixed(1).replace('.', ',')}
                  </span>
                  <span>{review.dateLabel}</span>
                </div>
                <p className="text-sm leading-relaxed text-[#E5E5E5]/90">
                  “{review.comment}”
                </p>
              </div>

              <div className="pt-3 border-t border-[#2B2B2B] text-xs">
                <p className="font-semibold text-white">{review.clientName}</p>
                <p className="text-[#E5E5E5]/65">
                  {review.serviceName} · com {review.barberName}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Horário de funcionamento e Localização */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-[#F7931E]" />
            <h2 className="font-display text-xl font-bold text-white">
              Horário de funcionamento
            </h2>
          </div>

          <div className="divide-y divide-[#2B2B2B] text-sm">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="text-[#E5E5E5]/80">Segunda-feira</span>
              <span className="font-medium text-[#E5E5E5]/55">Fechado</span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="text-[#E5E5E5]/80">Terça a sexta-feira</span>
              <span className="font-mono font-medium text-white tabular-nums">
                09h às 20h
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="text-[#E5E5E5]/80">Sábado</span>
              <span className="font-mono font-medium text-white tabular-nums">
                08h às 18h
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-3">
              <span className="text-[#E5E5E5]/80">Domingo</span>
              <span className="font-mono font-medium text-white tabular-nums">
                09h às 14h
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-4 sm:p-6 flex flex-col justify-between space-y-5 min-w-0">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-2.5">
              <MapPin className="h-5 w-5 text-[#F7931E] shrink-0" />
              <h2 className="font-display text-xl font-bold text-white">
                Onde estamos
              </h2>
            </div>
            <p className="text-sm font-medium text-white">
              {BARBERSHOP_INFO.address.street} — {BARBERSHOP_INFO.address.neighborhood}
            </p>
            <p className="text-sm text-[#E5E5E5]/75">
              {BARBERSHOP_INFO.address.city} — {BARBERSHOP_INFO.address.state} · CEP{' '}
              <span className="font-mono tabular-nums">
                {BARBERSHOP_INFO.address.zipCode}
              </span>
            </p>
            <p className="text-xs text-[#E5E5E5]/60 break-words">
              Telefone: {BARBERSHOP_INFO.contact.phone} ·{' '}
              {BARBERSHOP_INFO.contact.email}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onOpenMap}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-5 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
            >
              <MapPin className="h-4 w-4 shrink-0" />
              <span>Abrir localização no mapa</span>
            </button>
            <button
              type="button"
              onClick={onOpenShopAbout}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 px-4 py-2.5 text-sm font-medium text-white transition-colors"
            >
              <span>Sobre a barbearia</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
