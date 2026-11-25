'use client';

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  QrCode,
  RefreshCw,
  Scissors,
  ShieldCheck,
  User,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {useFirebaseAuth} from '@/components/FirebaseProvider';
import {PixPaymentCard} from '@/components/PixPaymentCard';
import {useOnlineStatus} from '@/hooks/useOnlineStatus';
import {BARBERS, BARBERSHOP_INFO} from '@/lib/data/seed';
import {fetchAvailabilitySlots} from '@/lib/api/client';
import {fetchFirestoreAvailabilitySlots} from '@/lib/firebase/repository';
import {Appointment, AppointmentStatus, TimeSlotAvailability} from '@/lib/types/domain';
import {
  formatCurrencyBRL,
  formatDateShortPTBR,
  formatPaymentMethodLabel,
  getUpcomingDatesList,
} from '@/lib/utils/formatters';
import {sanitizeTextField} from '@/lib/utils/security';

interface AppointmentsViewProps {
  appointments: Appointment[];
  loading: boolean;
  initialActionTarget?: {
    appointment: Appointment;
    action: 'cancel' | 'reschedule';
  } | null;
  onClearInitialAction?: () => void;
  onBookNew: () => void;
  onCancelAppointment: (id: string, reason?: string) => Promise<void>;
  onRequestReschedule: (
    id: string,
    preferredDate: string,
    preferredTime: string,
    reason?: string
  ) => Promise<void>;
}

function StatusDisplay({status}: {status: AppointmentStatus}) {
  switch (status) {
    case 'Confirmado':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Confirmado</span>
        </span>
      );
    case 'Pendente':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
          <Clock className="h-3.5 w-3.5" />
          <span>Pendente</span>
        </span>
      );
    case 'Reagendamento solicitado':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F7931E]">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Reagendamento solicitado</span>
        </span>
      );
    case 'Concluído':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E5E5E5]/70">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Concluído</span>
        </span>
      );
    case 'Cancelado':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400">
          <XCircle className="h-3.5 w-3.5" />
          <span>Cancelado</span>
        </span>
      );
  }
}

export function AppointmentsView({
  appointments,
  loading,
  initialActionTarget,
  onClearInitialAction,
  onBookNew,
  onCancelAppointment,
  onRequestReschedule,
}: AppointmentsViewProps) {
  const isOnline = useOnlineStatus();
  const {user, authReady, isVerifiedUser, openAuthModal} = useFirebaseAuth();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [pastVisibleCount, setPastVisibleCount] = useState<number>(6);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(() =>
    initialActionTarget?.action === 'cancel' ? initialActionTarget.appointment : null
  );
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(() =>
    initialActionTarget?.action === 'reschedule'
      ? initialActionTarget.appointment
      : null
  );

  const openDates = useMemo(() => {
    const allOpen = getUpcomingDatesList(14).filter((d) => d.dayOfWeek !== 1);
    if (!rescheduleTarget || rescheduleTarget.anyBarberRequested) {
      return allOpen;
    }
    const barber = BARBERS.find((b) => b.id === rescheduleTarget.barberId);
    if (!barber) return allOpen;
    return allOpen.filter((d) => barber.workingDays.includes(d.dayOfWeek));
  }, [rescheduleTarget]);

  const [preferredDate, setPreferredDate] = useState<string>(
    openDates[0]?.dateISO ?? ''
  );
  const [preferredTime, setPreferredTime] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [busyAction, setBusyAction] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openPixId, setOpenPixId] = useState<string | null>(null);

  const [availabilityState, setAvailabilityState] = useState<{
    key: string;
    slots: TimeSlotAvailability[];
  }>({key: '', slots: []});

  const effectivePreferredDate = openDates.some((d) => d.dateISO === preferredDate)
    ? preferredDate
    : (openDates[0]?.dateISO ?? '');

  const rescheduleRequestKey =
    rescheduleTarget && effectivePreferredDate
      ? `${rescheduleTarget.id}:${effectivePreferredDate}:${isVerifiedUser ? 'fb' : 'local'}`
      : '';
  const loadingSlots = Boolean(
    rescheduleRequestKey && availabilityState.key !== rescheduleRequestKey
  );

  const availableRescheduleSlots = useMemo(() => {
    if (availabilityState.key !== rescheduleRequestKey) return [];
    return availabilityState.slots.filter((s) => s.available).map((s) => s.time);
  }, [availabilityState, rescheduleRequestKey]);

  const effectivePreferredTime = availableRescheduleSlots.includes(preferredTime)
    ? preferredTime
    : (availableRescheduleSlots[0] ?? '');

  useEffect(() => {
    if (
      !isOnline ||
      !rescheduleTarget ||
      !effectivePreferredDate ||
      !rescheduleRequestKey
    ) {
      return;
    }
    let active = true;
    const barberParam = rescheduleTarget.anyBarberRequested
      ? 'any'
      : rescheduleTarget.barberId;
    const loader = isVerifiedUser
      ? fetchFirestoreAvailabilitySlots
      : fetchAvailabilitySlots;

    loader({
      dateISO: effectivePreferredDate,
      serviceId: rescheduleTarget.serviceId,
      barberId: barberParam,
    })
      .then((data) => {
        if (!active) return;
        setAvailabilityState({
          key: rescheduleRequestKey,
          slots: data.slots,
        });
      })
      .catch(() => {
        if (!active) return;
        setAvailabilityState({key: rescheduleRequestKey, slots: []});
      });

    return () => {
      active = false;
    };
  }, [
    isOnline,
    isVerifiedUser,
    rescheduleTarget,
    effectivePreferredDate,
    rescheduleRequestKey,
  ]);

  useEffect(() => {
    if (!cancelTarget && !rescheduleTarget) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyAction) {
        setCancelTarget(null);
        setRescheduleTarget(null);
        onClearInitialAction?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelTarget, rescheduleTarget, busyAction, onClearInitialAction]);

  const upcomingList = useMemo(
    () =>
      appointments
        .filter((a) => a.status !== 'Concluído' && a.status !== 'Cancelado')
        .sort((a, b) =>
          `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`)
        ),
    [appointments]
  );

  const pastList = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'Concluído' || a.status === 'Cancelado')
        .sort((a, b) =>
          `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)
        ),
    [appointments]
  );

  const visiblePastList = useMemo(
    () => pastList.slice(0, pastVisibleCount),
    [pastList, pastVisibleCount]
  );

  const displayedList = tab === 'upcoming' ? upcomingList : visiblePastList;
  const hasMorePast = tab === 'past' && pastList.length > visiblePastList.length;

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setBusyAction(true);
    setActionError(null);
    try {
      await onCancelAppointment(
        cancelTarget.id,
        'Cancelado pelo cliente no aplicativo'
      );
      setCancelTarget(null);
      onClearInitialAction?.();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Erro ao cancelar agendamento.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleTarget || !effectivePreferredDate || !effectivePreferredTime) {
      return;
    }
    setBusyAction(true);
    setActionError(null);
    try {
      const cleanReason = sanitizeTextField(rescheduleReason, 300);
      await onRequestReschedule(
        rescheduleTarget.id,
        effectivePreferredDate,
        effectivePreferredTime,
        cleanReason || undefined
      );
      setRescheduleTarget(null);
      setRescheduleReason('');
      onClearInitialAction?.();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Erro ao solicitar reagendamento.'
      );
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Meus Horários
          </h1>
          <p className="text-sm text-[#E5E5E5]/75 mt-1">
            Acompanhe seus próximos atendimentos, histórico, cancelamentos e
            reagendamentos.
          </p>
        </div>

        <button
          type="button"
          disabled={!isOnline}
          onClick={onBookNew}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-[#111111] transition-colors whitespace-nowrap shrink-0"
        >
          <Calendar className="h-4 w-4" />
          <span>{isOnline ? 'Novo agendamento' : 'Agendar (requer internet)'}</span>
        </button>
      </header>

      {!isOnline && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-start gap-2.5 text-xs text-amber-100">
          <WifiOff className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Modo offline: exibindo seus horários salvos em cache. Para cancelar,
            reagendar ou fazer um novo agendamento, conecte-se à internet.
          </span>
        </div>
      )}

      {authReady && !isVerifiedUser && (
        <div className="rounded-2xl border border-[#F7931E]/40 bg-[#1C1C1C] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-[#F7931E] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-white">
                {user
                  ? 'Confirme seu e-mail para sincronizar seus horários'
                  : 'Entre com Google / Gmail para sincronizar na nuvem'}
              </p>
              <p className="text-xs text-[#E5E5E5]/70">
                {user
                  ? `Verifique o link enviado para ${user.email} para visualizar seus agendamentos reais do Firebase.`
                  : 'Conecte sua conta para ver seus agendamentos reais em tempo real e gerenciar cancelamentos com segurança.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openAuthModal}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2 text-xs font-semibold text-[#111111] transition-colors whitespace-nowrap shrink-0"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>{user ? 'Verificar e-mail' : 'Entrar com Google'}</span>
          </button>
        </div>
      )}

      {/* Segmented tabs */}
      <div className="grid grid-cols-2 sm:inline-flex rounded-xl bg-[#1C1C1C] border border-[#2B2B2B] p-1 w-full sm:w-auto">
        <button
          type="button"
          onClick={() => setTab('upcoming')}
          className={`min-h-[40px] px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'upcoming'
              ? 'bg-[#F7931E] text-[#111111] font-semibold'
              : 'text-[#E5E5E5]/75 hover:text-white'
          }`}
        >
          Próximos ({upcomingList.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('past')}
          className={`min-h-[40px] px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'past'
              ? 'bg-[#F7931E] text-[#111111] font-semibold'
              : 'text-[#E5E5E5]/75 hover:text-white'
          }`}
        >
          Anteriores ({pastList.length})
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-10 text-center text-sm text-[#E5E5E5]/70">
          Carregando seus agendamentos...
        </div>
      ) : displayedList.length === 0 ? (
        <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-10 text-center space-y-4">
          <Scissors className="h-8 w-8 text-[#F7931E] mx-auto" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-white">
              {tab === 'upcoming'
                ? 'Você não possui agendamentos futuros no momento'
                : 'Nenhum agendamento anterior encontrado'}
            </p>
            <p className="text-sm text-[#E5E5E5]/70">
              Escolha um serviço e reserve seu horário em poucos segundos.
            </p>
          </div>
          <button
            type="button"
            disabled={!isOnline}
            onClick={onBookNew}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#F7931E] hover:bg-[#D97706] disabled:opacity-50 text-sm font-semibold text-[#111111] transition-colors"
          >
            {isOnline ? 'Agendar horário' : 'Agendar (requer internet)'}
          </button>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedList.map((apt) => (
            <article
              key={apt.id}
              className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <StatusDisplay status={apt.status} />
                  <span className="font-mono text-xs text-[#E5E5E5]/60 tabular-nums">
                    {apt.bookingCode}
                  </span>
                </div>

                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    {apt.serviceName}
                  </h2>
                  <p className="text-xs text-[#E5E5E5]/70 mt-1 inline-flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-[#F7931E]" />
                    <span>{apt.barberName}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#E5E5E5]/85 pt-1">
                  <span className="inline-flex items-center gap-1.5 capitalize">
                    <Calendar className="h-3.5 w-3.5 text-[#F7931E]" />
                    {formatDateShortPTBR(apt.date)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                    <Clock className="h-3.5 w-3.5 text-[#F7931E]" />
                    {apt.startTime} – {apt.endTime}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-white tabular-nums">
                    {formatCurrencyBRL(apt.priceCents)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#E5E5E5]/75">
                    {formatPaymentMethodLabel(apt.paymentMethod)}
                  </span>
                </div>

                {apt.paymentMethod === 'pix' &&
                  apt.status !== 'Concluído' &&
                  apt.status !== 'Cancelado' && (
                    <div className="pt-1 space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenPixId((curr) => (curr === apt.id ? null : apt.id))
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F7931E] hover:underline"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        <span>
                          {openPixId === apt.id
                            ? 'Ocultar Pix do barbeiro'
                            : 'Ver Pix do barbeiro'}
                        </span>
                      </button>
                      {openPixId === apt.id && (
                        <PixPaymentCard
                          pixDetails={
                            BARBERS.find((b) => b.id === apt.barberId)?.pixDetails ??
                            BARBERSHOP_INFO.pixDetails
                          }
                          amountCents={apt.priceCents}
                          bookingCode={apt.bookingCode}
                        />
                      )}
                    </div>
                  )}

                {apt.rescheduleRequest && (
                  <p className="text-xs text-[#F7931E]/90 bg-[#111111] border border-[#2B2B2B] rounded-lg px-3 py-2">
                    Reagendamento solicitado para{' '}
                    <span className="font-semibold">
                      {formatDateShortPTBR(apt.rescheduleRequest.preferredDate)} às{' '}
                      {apt.rescheduleRequest.preferredTime}
                    </span>
                    .
                  </p>
                )}
              </div>

              {apt.status !== 'Concluído' && apt.status !== 'Cancelado' && (
                <div className="pt-3 border-t border-[#2B2B2B] flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={!isOnline}
                    onClick={() => {
                      setActionError(null);
                      setRescheduleTarget(apt);
                    }}
                    className="flex-1 min-w-[160px] min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 disabled:opacity-45 px-3 py-2 text-xs font-medium text-white transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-[#F7931E]" />
                    <span>Solicitar reagendamento</span>
                  </button>
                  <button
                    type="button"
                    disabled={!isOnline}
                    onClick={() => {
                      setActionError(null);
                      setCancelTarget(apt);
                    }}
                    className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-[#111111] hover:bg-red-500/10 disabled:opacity-45 px-3.5 py-2 text-xs font-medium text-red-300 transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Cancelar</span>
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        {hasMorePast && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setPastVisibleCount((count) => count + 6)}
              className="min-h-[44px] px-5 py-2 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 text-xs font-semibold text-white transition-colors"
            >
              Ver mais anteriores ({pastList.length - visiblePastList.length} restantes)
            </button>
          </div>
        )}
        </>
      )}

      {/* Modal de confirmação de cancelamento */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busyAction) {
              setCancelTarget(null);
              onClearInitialAction?.();
            }
          }}
        >
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-white">
                Cancelar agendamento?
              </h3>
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  onClearInitialAction?.();
                }}
                aria-label="Fechar"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#E5E5E5]/70 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-[#E5E5E5]/80">
              Você deseja cancelar o horário de{' '}
              <strong className="text-white">{cancelTarget.serviceName}</strong> em{' '}
              <strong className="text-white">
                {formatDateShortPTBR(cancelTarget.date)} às {cancelTarget.startTime}
              </strong>
              ? O horário ficará livre novamente para outros clientes.
            </p>
            {actionError && (
              <p className="text-xs text-red-300 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                {actionError}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  onClearInitialAction?.();
                }}
                disabled={busyAction}
                className="flex-1 min-h-[44px] rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 text-sm font-medium text-white transition-colors"
              >
                Manter horário
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={busyAction || !isOnline}
                className="flex-1 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
              >
                {busyAction ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de solicitação de reagendamento */}
      {rescheduleTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busyAction) {
              setRescheduleTarget(null);
              onClearInitialAction?.();
            }
          }}
        >
          <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Solicitar reagendamento
                </h3>
                <p className="text-xs text-[#E5E5E5]/65 mt-0.5">
                  {rescheduleTarget.serviceName} · {rescheduleTarget.barberName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRescheduleTarget(null);
                  onClearInitialAction?.();
                }}
                aria-label="Fechar"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#E5E5E5]/70 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#E5E5E5]/80">
                  Nova data de preferência
                </label>
                <select
                  value={effectivePreferredDate}
                  onChange={(e) => {
                    setPreferredDate(e.target.value);
                    setActionError(null);
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-3 text-sm text-white"
                >
                  {openDates.map((d) => (
                    <option key={d.dateISO} value={d.dateISO}>
                      {d.isToday ? 'Hoje' : d.weekdayShort}, {d.dayNumber} de{' '}
                      {d.monthShort}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#E5E5E5]/80">
                  Novo horário disponível
                </label>
                {!isOnline ? (
                  <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
                    Conecte-se à internet para consultar horários disponíveis.
                  </p>
                ) : loadingSlots ? (
                  <div className="min-h-[44px] flex items-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#111111] px-3 text-xs text-[#E5E5E5]/70">
                    <Loader2 className="h-4 w-4 text-[#F7931E] animate-spin" />
                    <span>Consultando horários livres...</span>
                  </div>
                ) : availableRescheduleSlots.length === 0 ? (
                  <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
                    Nenhum horário livre nesta data. Selecione outra data acima.
                  </p>
                ) : (
                  <select
                    value={effectivePreferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-3 text-sm font-mono text-white"
                  >
                    {availableRescheduleSlots.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#E5E5E5]/80">
                  Motivo ou observação (opcional)
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Ex.: Tive um imprevisto no trabalho."
                  className="w-full rounded-xl border border-[#2B2B2B] bg-[#111111] p-3 text-sm text-white"
                />
              </div>
            </div>

            {actionError && (
              <p className="text-xs text-red-300 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                {actionError}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRescheduleTarget(null);
                  onClearInitialAction?.();
                }}
                disabled={busyAction}
                className="flex-1 min-h-[44px] rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 text-sm font-medium text-white transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                disabled={
                  !isOnline ||
                  busyAction ||
                  loadingSlots ||
                  availableRescheduleSlots.length === 0 ||
                  !effectivePreferredTime
                }
                className="flex-1 min-h-[44px] rounded-xl bg-[#F7931E] hover:bg-[#D97706] disabled:opacity-50 text-sm font-semibold text-[#111111] transition-colors"
              >
                {busyAction ? 'Enviando...' : 'Enviar solicitação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
