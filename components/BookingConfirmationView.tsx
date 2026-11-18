'use client';

import {
  CalendarPlus,
  CheckCircle2,
  MapPin,
  MessageCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import {PixPaymentCard} from '@/components/PixPaymentCard';
import {BARBERS, BARBERSHOP_INFO} from '@/lib/data/seed';
import {Appointment} from '@/lib/types/domain';
import {
  buildWhatsAppLink,
  formatCurrencyBRL,
  formatDateLongPTBR,
  formatPaymentMethodLabel,
  generateCalendarICS,
} from '@/lib/utils/formatters';

interface BookingConfirmationViewProps {
  appointment: Appointment;
  onOpenMap: () => void;
  onViewMyAppointments: () => void;
  onRequestCancel: (appointment: Appointment) => void;
  onRequestReschedule: (appointment: Appointment) => void;
}

export function BookingConfirmationView({
  appointment,
  onOpenMap,
  onViewMyAppointments,
  onRequestCancel,
  onRequestReschedule,
}: BookingConfirmationViewProps) {
  const handleDownloadCalendar = () => {
    const icsContent = generateCalendarICS(
      appointment,
      BARBERSHOP_INFO.name,
      BARBERSHOP_INFO.address.fullFormatted
    );
    const blob = new Blob([icsContent], {type: 'text/calendar;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agendamento-${appointment.bookingCode}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const assignedBarber = BARBERS.find((b) => b.id === appointment.barberId);
  const pixDetails = assignedBarber?.pixDetails ?? BARBERSHOP_INFO.pixDetails;

  const whatsappUrl = buildWhatsAppLink(
    BARBERSHOP_INFO.contact.whatsappDigits,
    `Olá! Acabei de realizar um agendamento na ${BARBERSHOP_INFO.name}.\nCódigo: ${appointment.bookingCode}\nServiço: ${appointment.serviceName}\nProfissional: ${appointment.barberName}\nPagamento: ${formatPaymentMethodLabel(appointment.paymentMethod)}\nData: ${appointment.date} às ${appointment.startTime}`
  );

  return (
    <div className="space-y-6 pb-8 max-w-2xl mx-auto">
      <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-6 sm:p-8 text-center space-y-4">
        <div className="h-16 w-16 rounded-2xl bg-[#F7931E]/15 border border-[#F7931E]/40 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-9 w-9 text-[#F7931E]" />
        </div>

        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Agendamento realizado com sucesso
          </h1>
          <p className="text-sm text-[#E5E5E5]/75">
            Seu horário está reservado na {BARBERSHOP_INFO.name}.
          </p>
        </div>

        <div className="pt-2">
          <span className="text-xs text-[#E5E5E5]/60 block">Código da reserva</span>
          <span className="font-mono text-2xl font-bold tracking-wider text-[#F7931E] tabular-nums">
            {appointment.bookingCode}
          </span>
        </div>
      </div>

      {/* Resumo detalhado */}
      <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-5 sm:p-6 divide-y divide-[#2B2B2B] text-sm">
        <div className="py-3 flex items-center justify-between gap-4">
          <span className="text-[#E5E5E5]/65">Cliente</span>
          <span className="font-semibold text-white text-right">
            {appointment.clientName}
          </span>
        </div>
        <div className="py-3 flex items-center justify-between gap-4">
          <span className="text-[#E5E5E5]/65">Serviço escolhido</span>
          <span className="font-semibold text-white text-right">
            {appointment.serviceName}
          </span>
        </div>
        <div className="py-3 flex items-center justify-between gap-4">
          <span className="text-[#E5E5E5]/65">Profissional</span>
          <span className="font-semibold text-white text-right">
            {appointment.barberName}
          </span>
        </div>
        <div className="py-3 flex items-center justify-between gap-4">
          <span className="text-[#E5E5E5]/65">Data</span>
          <span className="font-semibold text-white capitalize text-right">
            {formatDateLongPTBR(appointment.date)}
          </span>
        </div>
        <div className="py-3 flex items-center justify-between gap-4">
          <span className="text-[#E5E5E5]/65">Horário</span>
          <span className="font-mono font-bold text-white tabular-nums">
            {appointment.startTime} às {appointment.endTime}
          </span>
        </div>
        <div className="py-3 flex items-center justify-between gap-4">
          <span className="text-[#E5E5E5]/65">Forma de pagamento</span>
          <span className="font-semibold text-white text-right">
            {formatPaymentMethodLabel(appointment.paymentMethod)}
          </span>
        </div>
        <div className="py-3 flex items-center justify-between gap-4">
          <span className="text-[#E5E5E5]/65">Preço</span>
          <span className="font-mono font-bold text-[#F7931E] tabular-nums">
            {formatCurrencyBRL(appointment.priceCents)}
          </span>
        </div>
        <div className="py-3 flex items-start justify-between gap-4">
          <span className="text-[#E5E5E5]/65 shrink-0">Endereço</span>
          <span className="text-[#E5E5E5]/90 text-right">
            {BARBERSHOP_INFO.address.fullFormatted}
          </span>
        </div>
      </div>

      {appointment.paymentMethod === 'pix' && appointment.status !== 'Cancelado' && (
        <PixPaymentCard
          pixDetails={pixDetails}
          amountCents={appointment.priceCents}
          bookingCode={appointment.bookingCode}
          subtitle={`${pixDetails.bankName} · Chave direta do barbeiro ${appointment.barberName}`}
        />
      )}

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={handleDownloadCalendar}
          className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
        >
          <CalendarPlus className="h-4 w-4" />
          <span>Adicionar ao calendário</span>
        </button>

        <button
          type="button"
          onClick={onOpenMap}
          className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-4 py-2.5 text-sm font-medium text-white transition-colors"
        >
          <MapPin className="h-4 w-4 text-[#F7931E]" />
          <span>Abrir localização</span>
        </button>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-4 py-2.5 text-sm font-medium text-white transition-colors"
        >
          <MessageCircle className="h-4 w-4 text-[#F7931E]" />
          <span>Falar com a barbearia</span>
        </a>
      </div>

      {/* Gerenciar agendamento */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onViewMyAppointments}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#2B2B2B] hover:bg-[#383838] text-sm font-medium text-white transition-colors"
        >
          Ver meus agendamentos
        </button>

        {appointment.status !== 'Cancelado' && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onRequestReschedule(appointment)}
              className="flex-1 sm:flex-initial min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-[#2B2B2B] bg-[#111111] text-xs font-medium text-[#E5E5E5] hover:border-[#F7931E]/60 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#F7931E]" />
              <span>Reagendar</span>
            </button>
            <button
              type="button"
              onClick={() => onRequestCancel(appointment)}
              className="flex-1 sm:flex-initial min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-red-500/30 bg-[#111111] text-xs font-medium text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Cancelar</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
