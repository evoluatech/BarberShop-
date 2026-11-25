'use client';

import Image from 'next/image';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Calendar,
  Check,
  Clock,
  CreditCard,
  Loader2,
  LogIn,
  QrCode,
  Scissors,
  ShieldCheck,
  Star,
  User,
  Users,
  WifiOff,
} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {useFirebaseAuth} from '@/components/FirebaseProvider';
import {PixPaymentCard} from '@/components/PixPaymentCard';
import {useOnlineStatus} from '@/hooks/useOnlineStatus';
import {BARBERS, BARBERSHOP_INFO, SERVICES} from '@/lib/data/seed';
import {fetchAvailabilitySlots} from '@/lib/api/client';
import {
  BusySlotLock,
  computeAvailabilityFromBusyLocks,
  createFirestoreAppointment,
  loadFirestoreBarbersWithFallback,
  subscribeFirestoreDateBusyLocks,
} from '@/lib/firebase/repository';
import {
  Appointment,
  Barber,
  ClientProfile,
  PaymentMethod,
  TimeSlotAvailability,
} from '@/lib/types/domain';
import {
  formatCurrencyBRL,
  formatDateLongPTBR,
  formatDuration,
  formatPaymentMethodLabel,
  formatPhoneBR,
  getUpcomingDatesList,
  isValidEmailOptional,
  isValidPhoneBR,
} from '@/lib/utils/formatters';
import {sanitizeTextField} from '@/lib/utils/security';

interface BookingFlowViewProps {
  initialServiceId?: string;
  initialBarberId?: string;
  initialDateISO?: string;
  initialTime?: string;
  clientProfile: ClientProfile;
  onUpdateProfile: (next: Partial<ClientProfile>) => void;
  onBookingConfirmed: (appointment: Appointment) => void;
  onCancelFlow: () => void;
}

const STEPS = [
  {number: 1, label: 'Serviço'},
  {number: 2, label: 'Profissional'},
  {number: 3, label: 'Data'},
  {number: 4, label: 'Horário'},
  {number: 5, label: 'Dados e pagamento'},
  {number: 6, label: 'Revisão'},
];

const PAYMENT_OPTIONS: {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: typeof QrCode;
}[] = [
  {
    id: 'pix',
    label: 'Pix',
    description: 'Veja a chave Pix do barbeiro na hora',
    icon: QrCode,
  },
  {
    id: 'cartao_credito',
    label: 'Cartão de Crédito',
    description: 'Pagamento na maquininha da barbearia',
    icon: CreditCard,
  },
  {
    id: 'cartao_debito',
    label: 'Cartão de Débito',
    description: 'Pagamento na maquininha da barbearia',
    icon: CreditCard,
  },
  {
    id: 'dinheiro',
    label: 'Dinheiro',
    description: 'Pagamento presencial após o atendimento',
    icon: Banknote,
  },
];

export function BookingFlowView({
  initialServiceId,
  initialBarberId,
  initialDateISO,
  initialTime,
  clientProfile,
  onUpdateProfile,
  onBookingConfirmed,
  onCancelFlow,
}: BookingFlowViewProps) {
  const isOnline = useOnlineStatus();
  const {user, authReady, isVerifiedUser, openAuthModal, saveFirestoreProfile} =
    useFirebaseAuth();
  const upcomingDates = useMemo(() => getUpcomingDatesList(14), []);
  const selectedBarberObj = useMemo(
    () => BARBERS.find((b) => b.id === initialBarberId),
    [initialBarberId]
  );
  const firstOpenDate = useMemo(() => {
    const valid = upcomingDates.find(
      (d) =>
        d.dayOfWeek !== 1 &&
        (!selectedBarberObj || selectedBarberObj.workingDays.includes(d.dayOfWeek))
    );
    return valid?.dateISO ?? upcomingDates[0].dateISO;
  }, [upcomingDates, selectedBarberObj]);

  const [step, setStep] = useState<number>(() => {
    if (initialServiceId && initialBarberId && initialDateISO && initialTime) return 5;
    if (initialServiceId && initialBarberId) return 3;
    if (initialServiceId) return 2;
    return 1;
  });

  const [serviceId, setServiceId] = useState<string>(
    initialServiceId || SERVICES[0].id
  );
  const [barberId, setBarberId] = useState<string>(initialBarberId || 'any');
  const [dateISO, setDateISO] = useState<string>(initialDateISO || firstOpenDate);
  const [selectedTime, setSelectedTime] = useState<string>(initialTime || '');

  const [draftProfile, setDraftProfile] = useState<{
    forProfileId: string;
    name?: string;
    phone?: string;
    email?: string;
  }>({forProfileId: clientProfile.id});

  const clientName =
    draftProfile.forProfileId === clientProfile.id &&
    draftProfile.name !== undefined
      ? draftProfile.name
      : clientProfile.name;
  const clientPhone =
    draftProfile.forProfileId === clientProfile.id &&
    draftProfile.phone !== undefined
      ? draftProfile.phone
      : clientProfile.phone;
  const clientEmail =
    draftProfile.forProfileId === clientProfile.id &&
    draftProfile.email !== undefined
      ? draftProfile.email
      : clientProfile.email;
  const [notes, setNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [slotsRefreshNonce, setSlotsRefreshNonce] = useState<number>(0);

  const [availabilityState, setAvailabilityState] = useState<{
    key: string;
    slots: TimeSlotAvailability[];
    isShopOpen: boolean;
    closedReason?: string;
    fetchFailed?: boolean;
    openingHoursLabel: string;
  }>({
    key: '',
    slots: [],
    isShopOpen: true,
    openingHoursLabel: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [directoryBarbers, setDirectoryBarbers] = useState<Barber[]>(BARBERS);

  useEffect(() => {
    if (!isOnline || !isVerifiedUser) return;
    let active = true;
    loadFirestoreBarbersWithFallback()
      .then((list) => {
        if (active && list.length > 0) {
          setDirectoryBarbers(list);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isOnline, isVerifiedUser]);

  const selectedService = useMemo(
    () => SERVICES.find((s) => s.id === serviceId) ?? SERVICES[0],
    [serviceId]
  );

  const eligibleBarbers = useMemo(
    () =>
      directoryBarbers.filter(
        (b) => b.isAvailable && selectedService.barberIds.includes(b.id)
      ),
    [directoryBarbers, selectedService]
  );

  const [liveLocksState, setLiveLocksState] = useState<{
    key: string;
    locks: BusySlotLock[];
    fetchFailed: boolean;
  }>({
    key: '',
    locks: [],
    fetchFailed: false,
  });

  const liveLocksKey = `${dateISO}:${slotsRefreshNonce}`;
  const guestRequestKey = `${dateISO}:${serviceId}:${barberId}:${slotsRefreshNonce}`;

  // Subscribe in real time ONLY on Step 4 when verified & online so 100+ concurrent clients
  // and the Barber App see slot locks immediately with zero extra reads on service/barber change.
  useEffect(() => {
    if (!isOnline || !isVerifiedUser || step !== 4) {
      return;
    }
    let active = true;
    const targetKey = `${dateISO}:${slotsRefreshNonce}`;
    const unsubscribe = subscribeFirestoreDateBusyLocks(
      dateISO,
      (locks) => {
        if (!active) return;
        setLiveLocksState({
          key: targetKey,
          locks,
          fetchFailed: false,
        });
      },
      () => {
        if (!active) return;
        setLiveLocksState({
          key: targetKey,
          locks: [],
          fetchFailed: true,
        });
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [dateISO, slotsRefreshNonce, isOnline, isVerifiedUser, step]);

  // Guest fallback: fetch availability from /api/availability only when Step 4 is active
  useEffect(() => {
    if (!isOnline || isVerifiedUser || step !== 4) {
      return;
    }
    let active = true;
    const targetKey = guestRequestKey;

    fetchAvailabilitySlots({dateISO, serviceId, barberId})
      .then((data) => {
        if (!active) return;
        setAvailabilityState({
          key: targetKey,
          isShopOpen: data.isShopOpen,
          closedReason: data.closedReason,
          fetchFailed: false,
          openingHoursLabel: data.openingHoursLabel,
          slots: data.slots,
        });
      })
      .catch(() => {
        if (!active) return;
        setAvailabilityState({
          key: targetKey,
          isShopOpen: true,
          closedReason: 'Não foi possível consultar os horários no momento.',
          fetchFailed: true,
          openingHoursLabel: '',
          slots: [],
        });
      });

    return () => {
      active = false;
    };
  }, [dateISO, serviceId, barberId, guestRequestKey, isOnline, isVerifiedUser, step]);

  const liveComputedAvailability = useMemo(() => {
    if (!isVerifiedUser || liveLocksState.key !== liveLocksKey || liveLocksState.fetchFailed) {
      return null;
    }
    return computeAvailabilityFromBusyLocks({
      dateISO,
      serviceId,
      barberId,
      busyLocks: liveLocksState.locks,
      barbers: directoryBarbers,
    });
  }, [
    isVerifiedUser,
    liveLocksState,
    liveLocksKey,
    dateISO,
    serviceId,
    barberId,
    directoryBarbers,
  ]);

  const loadingSlots = isVerifiedUser
    ? step === 4 && isOnline && liveLocksState.key !== liveLocksKey
    : step === 4 && isOnline && availabilityState.key !== guestRequestKey;

  const slots = isVerifiedUser
    ? (liveComputedAvailability?.slots ?? [])
    : availabilityState.key === guestRequestKey
      ? availabilityState.slots
      : [];

  const isShopOpen = isVerifiedUser
    ? liveLocksState.fetchFailed
      ? true
      : (liveComputedAvailability?.isShopOpen ?? true)
    : availabilityState.isShopOpen;

  const closedReason = isVerifiedUser
    ? liveLocksState.fetchFailed
      ? 'Não foi possível consultar os horários no momento.'
      : liveComputedAvailability?.closedReason
    : availabilityState.closedReason;

  const fetchFailed = isVerifiedUser
    ? Boolean(liveLocksState.key === liveLocksKey && liveLocksState.fetchFailed)
    : Boolean(availabilityState.key === guestRequestKey && availabilityState.fetchFailed);

  const openingHoursLabel = isVerifiedUser
    ? (liveComputedAvailability?.openingHoursLabel ?? '')
    : availabilityState.openingHoursLabel;

  const selectedBarberLabel = useMemo(() => {
    if (barberId === 'any') return 'Qualquer profissional disponível';
    return BARBERS.find((b) => b.id === barberId)?.name ?? 'Profissional';
  }, [barberId]);

  const activePixDetails = useMemo(() => {
    if (barberId !== 'any') {
      const specific = BARBERS.find((b) => b.id === barberId);
      if (specific) return specific.pixDetails;
    }
    return BARBERSHOP_INFO.pixDetails;
  }, [barberId]);

  const handleNextFromDetails = () => {
    setFormError(null);
    const cleanName = sanitizeTextField(clientName, 80);
    const cleanPhone = sanitizeTextField(clientPhone, 20);
    const cleanEmail = sanitizeTextField(clientEmail, 120);

    if (cleanName.length < 2) {
      setFormError('Por favor, informe seu nome completo.');
      return;
    }
    if (!isValidPhoneBR(cleanPhone)) {
      setFormError(
        'Por favor, informe um telefone válido com DDD (ex.: 11 98888-7766).'
      );
      return;
    }
    if (!isValidEmailOptional(cleanEmail)) {
      setFormError('O e-mail informado não parece válido.');
      return;
    }

    setDraftProfile({
      forProfileId: clientProfile.id,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
    });

    onUpdateProfile({
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
    });
    setStep(6);
  };

  const handleConfirmBooking = async () => {
    if (!isOnline) {
      setFormError(
        'Você está offline. Conecte-se à internet para confirmar o agendamento.'
      );
      return;
    }
    if (!isVerifiedUser || !user) {
      setFormError(
        'Conecte sua conta Google / Gmail (ou e-mail verificado) antes de confirmar o agendamento.'
      );
      openAuthModal();
      return;
    }

    const cleanName = sanitizeTextField(clientName, 80);
    const cleanPhone = sanitizeTextField(clientPhone, 20);
    const cleanEmail = sanitizeTextField(clientEmail, 120);
    const cleanNotes = sanitizeTextField(notes, 400);

    if (cleanName.length < 2 || !isValidPhoneBR(cleanPhone)) {
      setFormError(
        'Confirme seu nome completo e WhatsApp para a conta conectada antes de finalizar.'
      );
      setStep(5);
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const res = await createFirestoreAppointment({
        user,
        clientName: cleanName,
        clientPhone: cleanPhone,
        clientEmail: cleanEmail || undefined,
        serviceId,
        barberId,
        date: dateISO,
        startTime: selectedTime,
        notes: cleanNotes || undefined,
        paymentMethod,
      });

      if (!res.ok) {
        setFormError(
          res.error || 'Não foi possível concluir o agendamento. Tente outro horário.'
        );
        if (res.status === 409) {
          setSlotsRefreshNonce((n) => n + 1);
          setStep(4);
        }
        return;
      }

      saveFirestoreProfile({
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
      }).catch(() => undefined);

      if (res.appointment) {
        onBookingConfirmed(res.appointment);
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Erro de conexão ao confirmar o agendamento. Tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header do fluxo */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => (step > 1 ? setStep(step - 1) : onCancelFlow())}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] text-white hover:border-[#F7931E]/60 disabled:opacity-50 transition-colors"
            aria-label="Voltar etapa"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              Agendar Horário
            </h1>
            <p className="text-xs sm:text-sm text-[#E5E5E5]/70">
              Etapa {step} de {STEPS.length} · {STEPS[step - 1]?.label ?? 'Revisão'}
            </p>
          </div>
        </div>

        <span className="font-mono text-xs font-medium text-[#F7931E] tabular-nums">
          {step}/{STEPS.length}
        </span>
      </div>

      {/* Barra de progresso das etapas */}
      <div className="grid grid-cols-6 gap-1.5" aria-label="Progresso do agendamento">
        {STEPS.map((s) => {
          const isCompleted = step > s.number;
          const isCurrent = step === s.number;
          return (
            <button
              key={s.number}
              type="button"
              disabled={s.number > step || submitting}
              onClick={() => {
                if (s.number < step) setStep(s.number);
              }}
              className="text-left space-y-1.5 group disabled:cursor-default"
            >
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${
                  isCompleted || isCurrent ? 'bg-[#F7931E]' : 'bg-[#2B2B2B]'
                }`}
              />
              <span
                className={`hidden sm:block text-[11px] truncate ${
                  isCurrent
                    ? 'text-white font-semibold'
                    : isCompleted
                      ? 'text-[#E5E5E5]/80'
                      : 'text-[#E5E5E5]/40'
                }`}
              >
                {s.number}. {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {!isOnline && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-100"
        >
          <WifiOff className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Você está offline. É possível navegar pelo aplicativo normalmente, mas
            consultar horários livres em tempo real e finalizar agendamentos exige
            conexão com a internet.
          </span>
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
        >
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* Etapa 1: Escolher o serviço */}
      {step === 1 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-white">
            1. Escolha o serviço desejado
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SERVICES.map((service) => {
              const selected = service.id === serviceId;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setServiceId(service.id);
                    let nextBarberId = barberId;
                    if (barberId !== 'any' && !service.barberIds.includes(barberId)) {
                      nextBarberId = 'any';
                      setBarberId('any');
                    }
                    const nextBarberObj =
                      nextBarberId !== 'any'
                        ? BARBERS.find((b) => b.id === nextBarberId)
                        : undefined;
                    const currentDayObj = upcomingDates.find(
                      (d) => d.dateISO === dateISO
                    );
                    if (
                      !currentDayObj ||
                      currentDayObj.dayOfWeek === 1 ||
                      (nextBarberObj &&
                        !nextBarberObj.workingDays.includes(currentDayObj.dayOfWeek))
                    ) {
                      const validDay = upcomingDates.find(
                        (d) =>
                          d.dayOfWeek !== 1 &&
                          (!nextBarberObj ||
                            nextBarberObj.workingDays.includes(d.dayOfWeek))
                      );
                      if (validDay) setDateISO(validDay.dateISO);
                    }
                    setSelectedTime('');
                    setStep(2);
                  }}
                  className={`flex items-center gap-4 rounded-2xl border p-3.5 text-left transition-colors ${
                    selected
                      ? 'border-[#F7931E] bg-[#F7931E]/10'
                      : 'border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/50'
                  }`}
                >
                  <Image
                    src={service.imageUrl}
                    alt={service.name}
                    width={64}
                    height={64}
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-semibold text-white truncate">
                      {service.name}
                    </p>
                    <p className="text-xs text-[#E5E5E5]/65 mt-0.5">
                      {service.category} ·{' '}
                      <span className="font-mono tabular-nums">
                        {formatDuration(service.durationMinutes)}
                      </span>
                    </p>
                    <p className="font-mono text-sm font-bold text-[#F7931E] mt-1 tabular-nums">
                      {formatCurrencyBRL(service.priceCents)}
                    </p>
                  </div>
                  {selected && <Check className="h-5 w-5 text-[#F7931E] shrink-0" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Etapa 2: Escolher o profissional */}
      {step === 2 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-white">
              2. Escolha o profissional
            </h2>
            <span className="text-xs text-[#E5E5E5]/70">
              Serviço: <strong className="text-white">{selectedService.name}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setBarberId('any');
                setSelectedTime('');
                setStep(3);
              }}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                barberId === 'any'
                  ? 'border-[#F7931E] bg-[#F7931E]/10'
                  : 'border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/50'
              }`}
            >
              <div className="h-14 w-14 rounded-xl bg-[#111111] border border-[#2B2B2B] flex items-center justify-center shrink-0">
                <Users className="h-6 w-6 text-[#F7931E]" />
              </div>
              <div className="flex-1">
                <p className="font-display text-base font-semibold text-white">
                  Qualquer profissional disponível
                </p>
                <p className="text-xs text-[#E5E5E5]/70 mt-0.5">
                  Mostra todos os horários livres da equipe para o serviço escolhido.
                </p>
              </div>
              {barberId === 'any' && (
                <Check className="h-5 w-5 text-[#F7931E] shrink-0" />
              )}
            </button>

            {eligibleBarbers.map((barber) => {
              const selected = barberId === barber.id;
              return (
                <button
                  key={barber.id}
                  type="button"
                  onClick={() => {
                    setBarberId(barber.id);
                    const currentDayObj = upcomingDates.find(
                      (d) => d.dateISO === dateISO
                    );
                    if (
                      !currentDayObj ||
                      currentDayObj.dayOfWeek === 1 ||
                      !barber.workingDays.includes(currentDayObj.dayOfWeek)
                    ) {
                      const validDay = upcomingDates.find(
                        (d) =>
                          d.dayOfWeek !== 1 && barber.workingDays.includes(d.dayOfWeek)
                      );
                      if (validDay) setDateISO(validDay.dateISO);
                    }
                    setSelectedTime('');
                    setStep(3);
                  }}
                  className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                    selected
                      ? 'border-[#F7931E] bg-[#F7931E]/10'
                      : 'border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/50'
                  }`}
                >
                  <Image
                    src={barber.avatarUrl}
                    alt={barber.name}
                    width={56}
                    height={56}
                    referrerPolicy="no-referrer"
                    className="h-14 w-14 rounded-xl object-cover object-top shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-semibold text-white truncate">
                      {barber.name}
                    </p>
                    <p className="text-xs text-[#F7931E] truncate">{barber.role}</p>
                    <p className="text-xs text-[#E5E5E5]/70 mt-0.5 inline-flex items-center gap-1 tabular-nums">
                      <Star className="h-3 w-3 fill-[#F7931E] text-[#F7931E]" />
                      {barber.rating.toFixed(1).replace('.', ',')} ·{' '}
                      {barber.experienceYears} anos
                    </p>
                  </div>
                  {selected && <Check className="h-5 w-5 text-[#F7931E] shrink-0" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Etapa 3: Escolher a data */}
      {step === 3 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-white">
            3. Escolha a data
          </h2>
          <p className="text-xs text-[#E5E5E5]/70">
            Segundas-feiras a barbearia permanece fechada.
            {barberId !== 'any'
              ? ` Dias sem atendimento de ${selectedBarberLabel} aparecem desabilitados.`
              : ''}
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2.5">
            {upcomingDates.map((d) => {
              const isMonday = d.dayOfWeek === 1;
              const activeBarber =
                barberId !== 'any' ? BARBERS.find((b) => b.id === barberId) : undefined;
              const barberOff = Boolean(
                activeBarber && !activeBarber.workingDays.includes(d.dayOfWeek)
              );
              const disabledDay = isMonday || barberOff;
              const selected = d.dateISO === dateISO && !disabledDay;
              return (
                <button
                  key={d.dateISO}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => {
                    setDateISO(d.dateISO);
                    setSelectedTime('');
                    setStep(4);
                  }}
                  className={`min-h-[82px] flex flex-col items-center justify-center rounded-xl border p-2.5 transition-colors ${
                    disabledDay
                      ? 'border-[#2B2B2B]/50 bg-[#1C1C1C]/40 text-[#E5E5E5]/30 cursor-not-allowed'
                      : selected
                        ? 'border-[#F7931E] bg-[#F7931E] text-[#111111]'
                        : 'border-[#2B2B2B] bg-[#1C1C1C] text-white hover:border-[#F7931E]/60'
                  }`}
                >
                  <span className="text-[11px] font-medium">
                    {d.isToday ? 'Hoje' : d.weekdayShort}
                  </span>
                  <span className="font-mono text-xl font-bold tabular-nums my-0.5">
                    {d.dayNumber}
                  </span>
                  <span className="text-[11px] opacity-80">
                    {isMonday ? 'Fechado' : barberOff ? 'Folga' : d.monthShort}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Etapa 4: Escolher o horário */}
      {step === 4 && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">
                4. Escolha o horário disponível
              </h2>
              <p className="text-xs text-[#E5E5E5]/70 capitalize">
                {formatDateLongPTBR(dateISO)} · Funcionamento:{' '}
                {openingHoursLabel || '—'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStep(3)}
              className="self-start min-h-[38px] px-3 rounded-lg border border-[#2B2B2B] bg-[#1C1C1C] text-xs font-medium text-[#F7931E]"
            >
              Alterar data
            </button>
          </div>

          {authReady && !isVerifiedUser && isOnline && (
            <div className="rounded-xl border border-[#F7931E]/40 bg-[#F7931E]/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-[#F7931E] shrink-0 mt-0.5" />
                <p className="text-xs text-[#E5E5E5]/85">
                  Conecte sua conta Google / Gmail para sincronizar os bloqueios em tempo
                  real da agenda do barbeiro antes de confirmar.
                </p>
              </div>
              <button
                type="button"
                onClick={openAuthModal}
                className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F7931E] hover:bg-[#D97706] px-3.5 py-1.5 text-xs font-semibold text-[#111111] transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{user ? 'Verificar e-mail' : 'Entrar com Google'}</span>
              </button>
            </div>
          )}

          {!isOnline ? (
            <div className="rounded-2xl border border-amber-500/40 bg-[#1C1C1C] p-8 text-center space-y-3">
              <WifiOff className="h-7 w-7 text-amber-400 mx-auto" />
              <p className="text-sm font-semibold text-white">
                Conexão necessária para consultar horários disponíveis
              </p>
              <p className="text-xs text-[#E5E5E5]/70 max-w-md mx-auto">
                Reconecte-se à internet para verificar a agenda atualizada da barbearia
                e escolher um horário livre.
              </p>
            </div>
          ) : loadingSlots ? (
            <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-10 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 text-[#F7931E] animate-spin" />
              <p className="text-sm text-[#E5E5E5]/75">
                Consultando agenda em tempo real...
              </p>
            </div>
          ) : !isShopOpen || closedReason ? (
            <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-8 text-center space-y-3">
              <Calendar className="h-7 w-7 text-[#F7931E] mx-auto" />
              <p className="text-sm font-medium text-white">
                {closedReason || 'Nenhum horário disponível para esta data.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {fetchFailed && (
                  <button
                    type="button"
                    onClick={() => setSlotsRefreshNonce((n) => n + 1)}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] text-sm font-semibold text-[#111111] transition-colors"
                  >
                    Tentar novamente
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className={`min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    fetchFailed
                      ? 'border border-[#2B2B2B] bg-[#111111] text-white hover:border-[#F7931E]/60'
                      : 'bg-[#F7931E] hover:bg-[#D97706] text-[#111111]'
                  }`}
                >
                  Escolher outra data
                </button>
              </div>
            </div>
          ) : (
            <>
              {slots.every((s) => !s.available) && (
                <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs sm:text-sm text-amber-100">
                    Todos os horários para esta data já estão ocupados ou encerrados.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="min-h-[40px] rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2 text-xs font-semibold text-[#111111] whitespace-nowrap shrink-0"
                  >
                    Escolher outra data
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {slots.map((slot) => {
                  const isSelected = slot.time === selectedTime;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => {
                        setSelectedTime(slot.time);
                        setStep(5);
                      }}
                      className={`min-h-[52px] flex flex-col items-center justify-center rounded-xl border px-3 py-2 transition-colors ${
                        !slot.available
                          ? 'border-[#2B2B2B]/40 bg-[#1C1C1C]/40 text-[#E5E5E5]/30 cursor-not-allowed'
                          : isSelected
                            ? 'border-[#F7931E] bg-[#F7931E] text-[#111111]'
                            : 'border-[#2B2B2B] bg-[#1C1C1C] text-white hover:border-[#F7931E]'
                      }`}
                    >
                      <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                          !slot.available ? 'line-through' : ''
                        }`}
                      >
                        {slot.time}
                      </span>
                      <span className="text-[10px] opacity-75">
                        {slot.available ? 'Disponível' : 'Ocupado'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-[#E5E5E5]/60">
                Os horários exibidos consideram a duração de{' '}
                <span className="font-mono tabular-nums text-white">
                  {formatDuration(selectedService.durationMinutes)}
                </span>{' '}
                do serviço e a agenda do profissional selecionado.
              </p>
            </>
          )}
        </section>
      )}

      {/* Etapa 5: Dados do cliente e forma de pagamento */}
      {step === 5 && (
        <section className="space-y-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">
              5. Seus dados e forma de pagamento
            </h2>
            <p className="text-xs text-[#E5E5E5]/70 mt-1">
              Informe seus dados de contato e escolha como prefere pagar.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleNextFromDetails();
            }}
            className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-4 sm:p-5 space-y-5"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="booking-name"
                className="block text-xs font-medium text-[#E5E5E5]/85"
              >
                Nome completo *
              </label>
              <input
                id="booking-name"
                type="text"
                required
                maxLength={80}
                value={clientName}
                onChange={(e) =>
                  setDraftProfile((prev) => ({
                    ...(prev.forProfileId === clientProfile.id
                      ? prev
                      : {forProfileId: clientProfile.id}),
                    name: e.target.value,
                  }))
                }
                placeholder="Ex.: Lucas Ribeiro"
                className="w-full min-h-[46px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-4 py-2.5 text-sm text-white placeholder:text-[#E5E5E5]/35 focus:border-[#F7931E] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="booking-phone"
                  className="block text-xs font-medium text-[#E5E5E5]/85"
                >
                  Telefone / WhatsApp *
                </label>
                <input
                  id="booking-phone"
                  type="tel"
                  required
                  maxLength={20}
                  value={clientPhone}
                  onChange={(e) =>
                    setDraftProfile((prev) => ({
                      ...(prev.forProfileId === clientProfile.id
                        ? prev
                        : {forProfileId: clientProfile.id}),
                      phone: formatPhoneBR(e.target.value),
                    }))
                  }
                  placeholder="(11) 99999-9999"
                  className="w-full min-h-[46px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-4 py-2.5 text-sm font-mono text-white placeholder:text-[#E5E5E5]/35 focus:border-[#F7931E] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="booking-email"
                  className="block text-xs font-medium text-[#E5E5E5]/85"
                >
                  E-mail (opcional)
                </label>
                <input
                  id="booking-email"
                  type="email"
                  maxLength={120}
                  value={clientEmail}
                  onChange={(e) =>
                    setDraftProfile((prev) => ({
                      ...(prev.forProfileId === clientProfile.id
                        ? prev
                        : {forProfileId: clientProfile.id}),
                      email: e.target.value,
                    }))
                  }
                  placeholder="seu@email.com"
                  className="w-full min-h-[46px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-4 py-2.5 text-sm text-white placeholder:text-[#E5E5E5]/35 focus:border-[#F7931E] focus:outline-none"
                />
              </div>
            </div>

            {/* Forma de pagamento */}
            <div className="space-y-3 pt-2 border-t border-[#2B2B2B]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">
                  Forma de pagamento *
                </span>
                <span className="font-mono text-xs font-bold text-[#F7931E] tabular-nums">
                  {formatCurrencyBRL(selectedService.priceCents)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PAYMENT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = paymentMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPaymentMethod(opt.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                        active
                          ? 'border-[#F7931E] bg-[#F7931E]/10'
                          : 'border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/50'
                      }`}
                    >
                      <div className="h-9 w-9 rounded-lg bg-[#1C1C1C] border border-[#2B2B2B] flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-[#F7931E]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{opt.label}</p>
                        <p className="text-[11px] text-[#E5E5E5]/65 mt-0.5">
                          {opt.description}
                        </p>
                      </div>
                      {active && (
                        <Check className="h-4 w-4 text-[#F7931E] shrink-0 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>

              {paymentMethod === 'pix' && (
                <PixPaymentCard
                  pixDetails={activePixDetails}
                  amountCents={selectedService.priceCents}
                  subtitle={
                    barberId === 'any'
                      ? `${activePixDetails.bankName} · Chave da barbearia (após confirmar, exibimos também a do barbeiro)`
                      : `${activePixDetails.bankName} · Chave direta do profissional escolhido`
                  }
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="booking-notes"
                className="block text-xs font-medium text-[#E5E5E5]/85"
              >
                Observação para o barbeiro (opcional)
              </label>
              <textarea
                id="booking-notes"
                rows={3}
                maxLength={400}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: Prefiro degradê mais baixo nas laterais ou acabamento na navalha."
                className="w-full rounded-xl border border-[#2B2B2B] bg-[#111111] px-4 py-3 text-sm text-white placeholder:text-[#E5E5E5]/35 focus:border-[#F7931E] focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-6 py-3 text-sm font-semibold text-[#111111] transition-colors"
              >
                <span>Revisar agendamento</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Etapa 6 e 7: Revisar informações e Confirmar */}
      {step === 6 && (
        <section className="space-y-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">
              6. Revise e confirme seu agendamento
            </h2>
            <p className="text-xs text-[#E5E5E5]/70 mt-1">
              Confira os detalhes antes de finalizar a reserva.
            </p>
          </div>

          <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-4 sm:p-6 space-y-4">
            <div className="divide-y divide-[#2B2B2B] text-sm">
              <div className="py-3 flex items-center justify-between gap-4">
                <span className="text-[#E5E5E5]/65 inline-flex items-center gap-2 shrink-0">
                  <Scissors className="h-4 w-4 text-[#F7931E]" />
                  Serviço
                </span>
                <span className="font-semibold text-white text-right min-w-0 break-words">
                  {selectedService.name} (
                  {formatDuration(selectedService.durationMinutes)})
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <span className="text-[#E5E5E5]/65 inline-flex items-center gap-2 shrink-0">
                  <User className="h-4 w-4 text-[#F7931E]" />
                  Profissional
                </span>
                <span className="font-semibold text-white text-right min-w-0 break-words">
                  {selectedBarberLabel}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <span className="text-[#E5E5E5]/65 inline-flex items-center gap-2 shrink-0">
                  <Calendar className="h-4 w-4 text-[#F7931E]" />
                  Data
                </span>
                <span className="font-semibold text-white capitalize text-right min-w-0 break-words">
                  {formatDateLongPTBR(dateISO)}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <span className="text-[#E5E5E5]/65 inline-flex items-center gap-2 shrink-0">
                  <Clock className="h-4 w-4 text-[#F7931E]" />
                  Horário
                </span>
                <span className="font-mono font-bold text-white tabular-nums shrink-0">
                  {selectedTime}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <span className="text-[#E5E5E5]/65 shrink-0">Cliente</span>
                <span className="text-white text-right min-w-0 break-words">
                  {clientName} · <span className="font-mono">{clientPhone}</span>
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <span className="text-[#E5E5E5]/65 shrink-0">Forma de pagamento</span>
                <span className="font-semibold text-white text-right min-w-0 break-words">
                  {formatPaymentMethodLabel(paymentMethod)}
                </span>
              </div>

              {notes.trim() && (
                <div className="py-3 flex items-start justify-between gap-4">
                  <span className="text-[#E5E5E5]/65 shrink-0">Observação</span>
                  <span className="text-white text-right min-w-0 break-words">
                    {notes}
                  </span>
                </div>
              )}

              <div className="pt-4 flex items-center justify-between">
                <span className="text-base font-medium text-[#E5E5E5]/80">
                  Valor total
                </span>
                <span className="font-mono text-2xl font-bold text-[#F7931E] tabular-nums">
                  {formatCurrencyBRL(selectedService.priceCents)}
                </span>
              </div>
            </div>

            {paymentMethod === 'pix' && (
              <PixPaymentCard
                pixDetails={activePixDetails}
                amountCents={selectedService.priceCents}
              />
            )}

            <div className="pt-2 text-xs text-[#E5E5E5]/60">
              Local: {BARBERSHOP_INFO.address.fullFormatted}
            </div>

            {authReady && !isVerifiedUser && (
              <div className="rounded-xl border border-[#F7931E]/45 bg-[#F7931E]/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-[#F7931E] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      {user
                        ? 'Confirme seu e-mail para finalizar'
                        : 'Entre com Google / Gmail para concluir a reserva'}
                    </p>
                    <p className="text-xs text-[#E5E5E5]/75">
                      Para proteger sua agenda e evitar reservas inválidas, é necessário
                      estar autenticado no Firebase.
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

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(5)}
                disabled={submitting}
                className="sm:w-1/3 min-h-[48px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-4 py-3 text-sm font-medium text-white hover:border-[#F7931E]/60 transition-colors"
              >
                Editar dados
              </button>
              <button
                type="button"
                disabled={submitting || !selectedTime || !isOnline}
                onClick={handleConfirmBooking}
                className="sm:flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] disabled:opacity-60 px-6 py-3 text-sm font-semibold text-[#111111] transition-colors"
              >
                {!isOnline ? (
                  <>
                    <WifiOff className="h-4 w-4" />
                    <span>Conecte-se à internet para confirmar</span>
                  </>
                ) : submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Confirmando...</span>
                  </>
                ) : !isVerifiedUser ? (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Entrar com Google e confirmar</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Confirmar agendamento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
