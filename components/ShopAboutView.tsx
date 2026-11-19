'use client';

import Image from 'next/image';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
} from 'lucide-react';
import {BrandLogo} from '@/components/BrandLogo';
import {BARBERSHOP_INFO, SERVICES} from '@/lib/data/seed';
import {buildWhatsAppLink, formatCurrencyBRL} from '@/lib/utils/formatters';

interface ShopAboutViewProps {
  onBack: () => void;
  onBookNow: () => void;
  onOpenMap: () => void;
  onOpenServices: () => void;
}

export function ShopAboutView({
  onBack,
  onBookNow,
  onOpenMap,
  onOpenServices,
}: ShopAboutViewProps) {
  const whatsappUrl = buildWhatsAppLink(
    BARBERSHOP_INFO.contact.whatsappDigits,
    'Olá! Gostaria de tirar uma dúvida sobre os serviços da Barber Shop.'
  );

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] text-white hover:border-[#F7931E]/60 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            A Barbearia
          </h1>
          <p className="text-xs sm:text-sm text-[#E5E5E5]/70">
            Estrutura, diferenciais, horários e contatos oficiais
          </p>
        </div>
      </div>

      {/* Apresentação principal */}
      <section className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-4 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BrandLogo size="lg" />
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                {BARBERSHOP_INFO.name}
              </h2>
              <p className="text-sm text-[#F7931E]">{BARBERSHOP_INFO.tagline}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBookNow}
            className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-6 py-3 text-sm font-semibold text-[#111111] transition-colors whitespace-nowrap shrink-0"
          >
            <Calendar className="h-4 w-4" />
            <span>Agendar horário</span>
          </button>
        </div>

        <p className="text-sm sm:text-base leading-relaxed text-[#E5E5E5]/85">
          {BARBERSHOP_INFO.description}
        </p>

        {/* Galeria do ambiente */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BARBERSHOP_INFO.galleryImages.map((img, index) => (
            <figure
              key={index}
              className="rounded-xl border border-[#2B2B2B] bg-[#111111] overflow-hidden"
            >
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={img.url}
                  alt={img.caption}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  referrerPolicy="no-referrer"
                  className="object-cover"
                />
              </div>
              <figcaption className="p-3 text-xs leading-relaxed text-[#E5E5E5]/75">
                {img.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Diferenciais & Resumo de Serviços */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-4 sm:p-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-white">
            Nossos diferenciais
          </h2>
          <ul className="space-y-3">
            {BARBERSHOP_INFO.highlights.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-sm text-[#E5E5E5]/85"
              >
                <CheckCircle2 className="h-4 w-4 text-[#F7931E] shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-4 sm:p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-white">
                Serviços oferecidos
              </h2>
              <button
                type="button"
                onClick={onOpenServices}
                className="text-xs font-medium text-[#F7931E] hover:underline"
              >
                Ver catálogo completo
              </button>
            </div>
            <div className="divide-y divide-[#2B2B2B]">
              {SERVICES.slice(0, 5).map((service) => (
                <div
                  key={service.id}
                  className="py-2.5 flex items-center justify-between text-sm"
                >
                  <span className="text-[#E5E5E5]/90">{service.name}</span>
                  <span className="font-mono font-semibold text-white tabular-nums">
                    {formatCurrencyBRL(service.priceCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenServices}
            className="w-full min-h-[44px] rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 px-4 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Explorar todos os {SERVICES.length} serviços
          </button>
        </section>
      </div>

      {/* Horários, Endereço e Contatos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#F7931E]" />
            <h2 className="font-display text-xl font-bold text-white">
              Horários de funcionamento
            </h2>
          </div>
          <div className="divide-y divide-[#2B2B2B] text-sm">
            {BARBERSHOP_INFO.openingHours.map((day) => (
              <div
                key={day.dayOfWeek}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <span className="text-[#E5E5E5]/80">{day.label}</span>
                <span
                  className={
                    day.isOpen
                      ? 'font-mono font-medium text-white tabular-nums'
                      : 'font-medium text-[#E5E5E5]/50'
                  }
                >
                  {day.displayText}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-4 sm:p-6 space-y-5 min-w-0">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#F7931E] shrink-0" />
            <h2 className="font-display text-xl font-bold text-white">
              Endereço e canais de atendimento
            </h2>
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-semibold text-white">
              {BARBERSHOP_INFO.address.street} — {BARBERSHOP_INFO.address.neighborhood}
            </p>
            <p className="text-[#E5E5E5]/75">
              {BARBERSHOP_INFO.address.city} — {BARBERSHOP_INFO.address.state} · CEP{' '}
              <span className="font-mono tabular-nums">
                {BARBERSHOP_INFO.address.zipCode}
              </span>
            </p>
          </div>

          <div className="space-y-2.5 text-sm text-[#E5E5E5]/85 min-w-0">
            <div className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-[#F7931E] shrink-0" />
              <span className="font-mono tabular-nums">
                {BARBERSHOP_INFO.contact.phone}
              </span>
            </div>
            <div className="flex items-center gap-2.5 min-w-0">
              <Mail className="h-4 w-4 text-[#F7931E] shrink-0" />
              <span className="break-all">{BARBERSHOP_INFO.contact.email}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Instagram className="h-4 w-4 text-[#F7931E] shrink-0" />
              <span>{BARBERSHOP_INFO.contact.instagram}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Share2 className="h-4 w-4 text-[#F7931E] shrink-0" />
              <span>fb.com{BARBERSHOP_INFO.contact.facebook}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenMap}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 px-4 py-2.5 text-sm font-medium text-white transition-colors"
            >
              <MapPin className="h-4 w-4 text-[#F7931E]" />
              <span>Abrir mapa</span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Falar no WhatsApp</span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
