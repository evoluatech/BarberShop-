import fs from 'node:fs';
import path from 'node:path';
import {
  BARBERS,
  BARBERSHOP_INFO,
  createInitialSeedAppointments,
  DEMONSTRATION_SLOTS,
  SERVICES,
} from '@/lib/data/seed';
import {
  Appointment,
  AppointmentStatus,
  PaymentMethod,
  TimeSlotAvailability,
} from '@/lib/types/domain';
import {
  addMinutesToTime,
  parseISODateLocal,
  timeToMinutes,
} from '@/lib/utils/formatters';

const STORE_FILE = path.join('/tmp', 'black-orange-appointments-v1.json');

let memoryFallbackStore: Appointment[] | null = null;

function readStore(): Appointment[] {
  if (memoryFallbackStore) {
    return memoryFallbackStore;
  }
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Appointment[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map((apt) => ({
          ...apt,
          paymentMethod: apt.paymentMethod ?? 'pix',
        }));
        memoryFallbackStore = normalized;
        return normalized;
      }
    }
  } catch {
    // Fallback to initial seed
  }
  const initial = createInitialSeedAppointments();
  writeStore(initial);
  return initial;
}

function writeStore(appointments: Appointment[]): void {
  memoryFallbackStore = appointments;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(appointments, null, 2), 'utf-8');
  } catch {
    // In-memory store remains active if /tmp is read-only
  }
}

export function listAllAppointments(clientId?: string): Appointment[] {
  const all = readStore();
  if (clientId) {
    return all.filter((a) => a.clientId === clientId);
  }
  return all;
}

export function getAppointmentById(id: string): Appointment | undefined {
  return readStore().find((a) => a.id === id);
}

function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

function isBlockingStatus(status: AppointmentStatus): boolean {
  return status !== 'Cancelado';
}

export function computeAvailability(params: {
  date: string;
  serviceId: string;
  barberId?: string; // 'any' or specific barber id
}): {
  isShopOpen: boolean;
  closedReason?: string;
  openingHoursLabel: string;
  slots: TimeSlotAvailability[];
} {
  const service = SERVICES.find((s) => s.id === params.serviceId) ?? SERVICES[0];
  const localDate = parseISODateLocal(params.date);
  const dayOfWeek = localDate.getDay();

  const hoursConfig = BARBERSHOP_INFO.openingHours.find(
    (h) => h.dayOfWeek === dayOfWeek
  );

  if (
    !hoursConfig ||
    !hoursConfig.isOpen ||
    !hoursConfig.openTime ||
    !hoursConfig.closeTime
  ) {
    return {
      isShopOpen: false,
      closedReason: 'A barbearia não abre às segundas-feiras.',
      openingHoursLabel: 'Fechado',
      slots: [],
    };
  }

  const openMinutes = timeToMinutes(hoursConfig.openTime);
  const closeMinutes = timeToMinutes(hoursConfig.closeTime);

  const eligibleBarbers = BARBERS.filter((barber) => {
    const doesService = barber.serviceIds.includes(service.id);
    const worksThisDay = barber.workingDays.includes(dayOfWeek);
    const matchesSelection =
      !params.barberId || params.barberId === 'any'
        ? true
        : barber.id === params.barberId;
    return doesService && worksThisDay && barber.isAvailable && matchesSelection;
  });

  if (eligibleBarbers.length === 0) {
    return {
      isShopOpen: true,
      closedReason: 'Profissional indisponível nesta data para este serviço.',
      openingHoursLabel: hoursConfig.displayText,
      slots: [],
    };
  }

  const allAppointmentsOnDate = readStore().filter(
    (apt) => apt.date === params.date && isBlockingStatus(apt.status)
  );

  const now = new Date();
  const spParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const partMap = Object.fromEntries(spParts.map((p) => [p.type, p.value]));
  const todayISO = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const currentMinutesNow =
    Number(partMap.hour === '24' ? '0' : partMap.hour) * 60 + Number(partMap.minute);

  const slots: TimeSlotAvailability[] = [];

  for (const slotTime of DEMONSTRATION_SLOTS) {
    const slotStart = timeToMinutes(slotTime);
    const slotEnd = slotStart + service.durationMinutes;

    // Outside shop opening/closing window
    if (slotStart < openMinutes || slotEnd > closeMinutes) {
      continue;
    }

    // Past slots on today's date
    if (params.date === todayISO && slotStart <= currentMinutesNow + 15) {
      slots.push({
        time: slotTime,
        available: false,
        reason: 'Horário já encerrado',
        availableBarberIds: [],
      });
      continue;
    }

    const freeBarberIds: string[] = [];
    for (const barber of eligibleBarbers) {
      const barberBookings = allAppointmentsOnDate.filter(
        (b) => b.barberId === barber.id
      );
      const hasConflict = barberBookings.some((b) =>
        intervalsOverlap(
          slotStart,
          slotEnd,
          timeToMinutes(b.startTime),
          timeToMinutes(b.endTime)
        )
      );
      if (!hasConflict) {
        freeBarberIds.push(barber.id);
      }
    }

    slots.push({
      time: slotTime,
      available: freeBarberIds.length > 0,
      reason: freeBarberIds.length > 0 ? undefined : 'Horário ocupado',
      availableBarberIds: freeBarberIds,
    });
  }

  return {
    isShopOpen: true,
    openingHoursLabel: hoursConfig.displayText,
    slots,
  };
}

export function createAppointment(input: {
  clientId?: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  serviceId: string;
  barberId: string; // 'any' or specific barber id
  date: string;
  startTime: string;
  notes?: string;
  paymentMethod?: PaymentMethod;
}): {appointment?: Appointment; error?: string; status?: number} {
  const service = SERVICES.find((s) => s.id === input.serviceId);
  if (!service) {
    return {error: 'Serviço selecionado não encontrado.', status: 400};
  }

  const availability = computeAvailability({
    date: input.date,
    serviceId: input.serviceId,
    barberId: input.barberId,
  });

  if (!availability.isShopOpen) {
    return {
      error: availability.closedReason ?? 'Barbearia fechada na data escolhida.',
      status: 400,
    };
  }

  const slot = availability.slots.find((s) => s.time === input.startTime);
  if (!slot || !slot.available || slot.availableBarberIds.length === 0) {
    return {
      error:
        'Este horário acabou de ficar indisponível. Escolha outro horário disponível.',
      status: 409,
    };
  }

  const assignedBarberId =
    input.barberId === 'any' ? slot.availableBarberIds[0] : input.barberId;

  const assignedBarber = BARBERS.find((b) => b.id === assignedBarberId);
  if (!assignedBarber) {
    return {error: 'Profissional indisponível para este horário.', status: 400};
  }

  const all = readStore();
  const existingCodes = new Set(all.map((a) => a.bookingCode));
  const nowISO = new Date().toISOString();
  let randomDigits = Math.floor(1000 + Math.random() * 9000);
  while (existingCodes.has(`BO-${randomDigits}`)) {
    randomDigits = Math.floor(1000 + Math.random() * 9000);
  }
  const newAppointment: Appointment = {
    id: `apt-${Date.now()}-${randomDigits}`,
    bookingCode: `BO-${randomDigits}`,
    shopId: BARBERSHOP_INFO.id,
    clientId: input.clientId || 'client-demo',
    clientName: input.clientName.trim(),
    clientPhone: input.clientPhone.trim(),
    clientEmail: input.clientEmail?.trim() || undefined,
    serviceId: service.id,
    serviceName: service.name,
    serviceDurationMinutes: service.durationMinutes,
    priceCents: service.priceCents,
    barberId: assignedBarber.id,
    barberName: assignedBarber.name,
    anyBarberRequested: input.barberId === 'any',
    date: input.date,
    startTime: input.startTime,
    endTime: addMinutesToTime(input.startTime, service.durationMinutes),
    notes: input.notes?.trim().slice(0, 500) || undefined,
    paymentMethod: input.paymentMethod ?? 'pix',
    status: 'Confirmado',
    changeHistory: [
      {
        id: `hist-${Date.now()}`,
        timestamp: nowISO,
        actor: 'cliente',
        action: 'Agendamento confirmado pelo aplicativo do cliente',
        newStatus: 'Confirmado',
      },
    ],
    createdAt: nowISO,
    updatedAt: nowISO,
  };

  writeStore([newAppointment, ...all]);
  return {appointment: newAppointment, status: 201};
}

export function updateAppointmentStatus(params: {
  id: string;
  action: 'cancel' | 'request_reschedule';
  preferredDate?: string;
  preferredTime?: string;
  reason?: string;
}): {appointment?: Appointment; error?: string; status?: number} {
  const all = readStore();
  const idx = all.findIndex((a) => a.id === params.id);
  if (idx === -1) {
    return {error: 'Agendamento não encontrado.', status: 404};
  }

  const current = all[idx];
  if (current.status === 'Concluído' || current.status === 'Cancelado') {
    return {
      error: 'Não é possível alterar um agendamento já concluído ou cancelado.',
      status: 400,
    };
  }

  const nowISO = new Date().toISOString();
  let updated: Appointment;

  if (params.action === 'cancel') {
    const trimmedReason = params.reason?.trim() || undefined;
    updated = {
      ...current,
      status: 'Cancelado',
      updatedAt: nowISO,
      changeHistory: [
        ...current.changeHistory,
        {
          id: `hist-${Date.now()}`,
          timestamp: nowISO,
          actor: 'cliente',
          action: 'Cancelamento realizado pelo cliente',
          previousStatus: current.status,
          newStatus: 'Cancelado',
          note: trimmedReason,
        },
      ],
    };
  } else {
    if (!params.preferredDate || !params.preferredTime) {
      return {
        error:
          'Informe a nova data e horário desejados para solicitar o reagendamento.',
        status: 400,
      };
    }

    const rescheduleAvailability = computeAvailability({
      date: params.preferredDate,
      serviceId: current.serviceId,
      barberId: current.anyBarberRequested ? 'any' : current.barberId,
    });

    if (!rescheduleAvailability.isShopOpen) {
      return {
        error:
          rescheduleAvailability.closedReason ??
          'A barbearia não funciona na data escolhida.',
        status: 400,
      };
    }

    const requestedSlot = rescheduleAvailability.slots.find(
      (s) => s.time === params.preferredTime
    );
    if (!requestedSlot || !requestedSlot.available) {
      return {
        error:
          'O horário escolhido para reagendamento não está mais disponível. Selecione outro horário livre.',
        status: 409,
      };
    }

    const trimmedReason = params.reason?.trim() || undefined;
    updated = {
      ...current,
      status: 'Reagendamento solicitado',
      rescheduleRequest: {
        preferredDate: params.preferredDate,
        preferredTime: params.preferredTime,
        reason: trimmedReason,
        requestedAt: nowISO,
      },
      updatedAt: nowISO,
      changeHistory: [
        ...current.changeHistory,
        {
          id: `hist-${Date.now()}`,
          timestamp: nowISO,
          actor: 'cliente',
          action: `Solicitação de reagendamento para ${params.preferredDate} às ${params.preferredTime}`,
          previousStatus: current.status,
          newStatus: 'Reagendamento solicitado',
          note: trimmedReason,
        },
      ],
    };
  }

  const next = [...all];
  next[idx] = updated;
  writeStore(next);
  return {appointment: updated, status: 200};
}
