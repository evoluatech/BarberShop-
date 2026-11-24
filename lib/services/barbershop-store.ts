import crypto from 'node:crypto';
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
  isValidISODate,
  isValidTimeHHMM,
  parseISODateLocal,
  timeToMinutes,
} from '@/lib/utils/formatters';

const STORE_FILE = path.join('/tmp', 'black-orange-appointments-v1.json');
const MAX_STORED_APPOINTMENTS = 2500;

const SAO_PAULO_NOW_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const BOOKING_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

let memoryFallbackStore: Appointment[] | null = null;
let byIdIndex = new Map<string, Appointment>();
let activeByDateIndex = new Map<string, Appointment[]>();
let pendingPersistPromise: Promise<void> = Promise.resolve();
let persistQueued = false;

function isBlockingStatus(status: AppointmentStatus): boolean {
  return status !== 'Cancelado';
}

function rebuildIndexes(appointments: Appointment[]): void {
  const nextById = new Map<string, Appointment>();
  const nextActiveByDate = new Map<string, Appointment[]>();

  for (const apt of appointments) {
    nextById.set(apt.id, apt);
    if (isBlockingStatus(apt.status)) {
      const bucket = nextActiveByDate.get(apt.date);
      if (bucket) {
        bucket.push(apt);
      } else {
        nextActiveByDate.set(apt.date, [apt]);
      }
    }
  }

  byIdIndex = nextById;
  activeByDateIndex = nextActiveByDate;
}

function pruneOversizedAppointments(appointments: Appointment[]): Appointment[] {
  if (appointments.length <= MAX_STORED_APPOINTMENTS) {
    return appointments;
  }
  const active: Appointment[] = [];
  const archived: Appointment[] = [];
  for (const apt of appointments) {
    if (apt.status === 'Concluído' || apt.status === 'Cancelado') {
      archived.push(apt);
    } else {
      active.push(apt);
    }
  }
  const keepArchivedCount = Math.max(0, MAX_STORED_APPOINTMENTS - active.length);
  return [...active, ...archived.slice(0, keepArchivedCount)];
}

function scheduleAsyncDiskPersist(): void {
  if (persistQueued) return;
  persistQueued = true;

  pendingPersistPromise = pendingPersistPromise
    .then(async () => {
      persistQueued = false;
      const snapshot = memoryFallbackStore;
      if (!snapshot) return;
      const tmpFile = `${STORE_FILE}.${process.pid}.tmp`;
      const serialized = JSON.stringify(snapshot);
      await fs.promises.writeFile(tmpFile, serialized, 'utf-8');
      await fs.promises.rename(tmpFile, STORE_FILE);
    })
    .catch(() => {
      persistQueued = false;
      // In-memory store remains authoritative if /tmp is read-only
    });
}

function readStore(): Appointment[] {
  if (memoryFallbackStore) {
    return memoryFallbackStore;
  }
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Appointment[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = pruneOversizedAppointments(
          parsed.map((apt) => ({
            ...apt,
            paymentMethod: apt.paymentMethod ?? 'pix',
          }))
        );
        memoryFallbackStore = normalized;
        rebuildIndexes(normalized);
        return normalized;
      }
    }
  } catch {
    // Fallback to initial seed
  }
  const initial = createInitialSeedAppointments();
  memoryFallbackStore = initial;
  rebuildIndexes(initial);
  scheduleAsyncDiskPersist();
  return initial;
}

function writeStore(appointments: Appointment[]): void {
  const bounded = pruneOversizedAppointments(appointments);
  memoryFallbackStore = bounded;
  rebuildIndexes(bounded);
  scheduleAsyncDiskPersist();
}

function generateUniqueBookingCode(existingCodes: Set<string>): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    const bytes = crypto.randomBytes(6);
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += BOOKING_CODE_ALPHABET[bytes[i] % BOOKING_CODE_ALPHABET.length];
    }
    const candidate = `BO-${suffix}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `BO-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export function listAllAppointments(clientId?: string): Appointment[] {
  const all = readStore();
  if (clientId) {
    return all.filter((a) => a.clientId === clientId);
  }
  return all;
}

export function getAppointmentById(id: string): Appointment | undefined {
  readStore();
  return byIdIndex.get(id);
}

function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
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
  if (!isValidISODate(params.date)) {
    return {
      isShopOpen: false,
      closedReason: 'Data selecionada inválida.',
      openingHoursLabel: 'Indisponível',
      slots: [],
    };
  }
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

  readStore();
  const allAppointmentsOnDate = activeByDateIndex.get(params.date) ?? [];

  const spParts = SAO_PAULO_NOW_FORMATTER.formatToParts(new Date());
  const partMap = Object.fromEntries(spParts.map((p) => [p.type, p.value]));
  const todayISO = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const currentMinutesNow =
    Number(partMap.hour === '24' ? '0' : partMap.hour) * 60 + Number(partMap.minute);

  const bookingsByBarber = new Map<string, {start: number; end: number}[]>();
  for (const apt of allAppointmentsOnDate) {
    if (!isValidTimeHHMM(apt.startTime) || !isValidTimeHHMM(apt.endTime)) {
      continue;
    }
    const start = timeToMinutes(apt.startTime);
    const end = timeToMinutes(apt.endTime);
    if (start >= end) continue;
    const list = bookingsByBarber.get(apt.barberId);
    if (list) {
      list.push({start, end});
    } else {
      bookingsByBarber.set(apt.barberId, [{start, end}]);
    }
  }

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
      const barberBookings = bookingsByBarber.get(barber.id);
      const hasConflict = barberBookings
        ? barberBookings.some((b) => intervalsOverlap(slotStart, slotEnd, b.start, b.end))
        : false;
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

  if (!isValidTimeHHMM(input.startTime)) {
    return {error: 'Horário selecionado inválido.', status: 400};
  }

  const all = readStore();
  const existingCodes = new Set(all.map((a) => a.bookingCode));
  const nowISO = new Date().toISOString();
  const bookingCode = generateUniqueBookingCode(existingCodes);
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const slotLockId = `${assignedBarber.id}__${input.date}__${input.startTime.replace(':', '-')}`;
  const newAppointment: Appointment = {
    id: `apt-${Date.now()}-${randomSuffix}`,
    bookingCode,
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
    slotLockId,
    notes: input.notes?.trim().slice(0, 400) || undefined,
    paymentMethod: input.paymentMethod ?? 'pix',
    status: 'Confirmado',
    changeHistory: [
      {
        id: `hist-${Date.now()}-${randomSuffix}`,
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
  const histSuffix = crypto.randomBytes(3).toString('hex');
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
          id: `hist-${Date.now()}-${histSuffix}`,
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
          id: `hist-${Date.now()}-${histSuffix}`,
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
