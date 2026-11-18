'use client';

import {User} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {BARBERS, BARBERSHOP_INFO, DEMONSTRATION_SLOTS, SERVICES} from '@/lib/data/seed';
import {
  db,
  handleFirestoreError,
  isFirebaseSyncEnabled,
  OperationType,
} from '@/lib/firebase/client';
import {FIREBASE_SYNC_PAUSED_MESSAGE} from '@/lib/firebase/sync-config';
import {
  Appointment,
  AppointmentHistoryEntry,
  ClientProfile,
  PaymentMethod,
  TimeSlotAvailability,
} from '@/lib/types/domain';
import {
  addMinutesToTime,
  parseISODateLocal,
  timeToMinutes,
} from '@/lib/utils/formatters';
import {sanitizeTextField} from '@/lib/utils/security';

const ADMIN_BOOTSTRAP_EMAIL = 'evoluatechbr@gmail.com';
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{2,128}$/;

function assertSafeId(value: string, fallback: string): string {
  const cleaned = sanitizeTextField(value, 128);
  return SAFE_ID_REGEX.test(cleaned) ? cleaned : fallback;
}

function timestampToISO(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return new Date().toISOString();
}

function cleanHistoryEntry(entry: AppointmentHistoryEntry): AppointmentHistoryEntry {
  const clean: AppointmentHistoryEntry = {
    id: assertSafeId(entry.id, `hist-${Date.now()}`),
    timestamp: sanitizeTextField(entry.timestamp, 40) || new Date().toISOString(),
    actor: entry.actor,
    action: sanitizeTextField(entry.action, 200),
    newStatus: entry.newStatus,
  };
  if (entry.previousStatus) {
    clean.previousStatus = entry.previousStatus;
  }
  const note = sanitizeTextField(entry.note, 300);
  if (note) {
    clean.note = note;
  }
  return clean;
}

export async function ensureAdminAndCatalogSeeded(user: User): Promise<void> {
  if (!isFirebaseSyncEnabled || !db) {
    return;
  }
  if (!user.emailVerified || user.email?.toLowerCase() !== ADMIN_BOOTSTRAP_EMAIL) {
    return;
  }

  // Ensure admin marker doc exists
  const adminRef = doc(db, 'admins', user.uid);
  try {
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      await setDoc(adminRef, {
        uid: user.uid,
        email: sanitizeTextField(user.email, 120),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `admins/${user.uid}`);
  }

  // Idempotently ensure authoritative services & barbers catalog exists in Firestore
  try {
    const existingServicesSnap = await getDocs(query(collection(db, 'services'), limit(1)));
    const existingBarbersSnap = await getDocs(query(collection(db, 'barbers'), limit(1)));
    if (!existingServicesSnap.empty && !existingBarbersSnap.empty) {
      return;
    }

    const batch = writeBatch(db);
    for (const svc of SERVICES) {
      batch.set(doc(db, 'services', svc.id), {
        id: svc.id,
        name: sanitizeTextField(svc.name, 100),
        category: svc.category,
        priceCents: Math.round(svc.priceCents),
        durationMinutes: Math.round(svc.durationMinutes),
        active: true,
        barberIds: svc.barberIds.slice(0, 20),
        updatedAt: serverTimestamp(),
      });
    }

    for (const barber of BARBERS) {
      batch.set(doc(db, 'barbers', barber.id), {
        id: barber.id,
        name: sanitizeTextField(barber.name, 80),
        role: sanitizeTextField(barber.role, 100),
        isAvailable: barber.isAvailable,
        workingDays: barber.workingDays.slice(0, 7),
        serviceIds: barber.serviceIds.slice(0, 30),
        pixDetails: {
          pixKey: sanitizeTextField(barber.pixDetails.pixKey, 140),
          pixKeyType: barber.pixDetails.pixKeyType,
          holderName: sanitizeTextField(barber.pixDetails.holderName, 100),
          bankName: sanitizeTextField(barber.pixDetails.bankName, 60),
          city: sanitizeTextField(barber.pixDetails.city, 60),
        },
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'services');
  }
}

export async function syncUserProfileWithFirestore(
  user: User,
  overrides?: Partial<ClientProfile>
): Promise<ClientProfile> {
  if (!isFirebaseSyncEnabled || !db) {
    throw new Error(FIREBASE_SYNC_PAUSED_MESSAGE);
  }
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const fallbackName =
    sanitizeTextField(overrides?.name || user.displayName || 'Cliente Barber Shop', 80) ||
    'Cliente Barber Shop';
  const safeEmail = sanitizeTextField(overrides?.email || user.email || '', 120);
  const safePhone = sanitizeTextField(overrides?.phone ?? '', 24);

  if (!snap.exists()) {
    const createPayload: Record<string, unknown> = {
      uid: user.uid,
      name: fallbackName.length >= 2 ? fallbackName : 'Cliente Barber',
      phone: safePhone,
      email: safeEmail.length >= 3 ? safeEmail : 'cliente@barbershop.app',
      role: 'client',
      notificationsEnabled: overrides?.notificationsEnabled ?? true,
      whatsappUpdatesEnabled: overrides?.whatsappUpdatesEnabled ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (overrides?.privacyAcceptedAt) {
      createPayload.privacyAcceptedAt = sanitizeTextField(
        overrides.privacyAcceptedAt,
        40
      );
    }

    try {
      await setDoc(userRef, createPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    return {
      id: user.uid,
      name: String(createPayload.name),
      phone: String(createPayload.phone),
      email: String(createPayload.email),
      authMethodPrepared: 'email_code',
      notificationsEnabled: Boolean(createPayload.notificationsEnabled),
      whatsappUpdatesEnabled: Boolean(createPayload.whatsappUpdatesEnabled),
      privacyAcceptedAt:
        typeof createPayload.privacyAcceptedAt === 'string'
          ? createPayload.privacyAcceptedAt
          : undefined,
    };
  }

  const existing = snap.data();
  const nextProfile: ClientProfile = {
    id: user.uid,
    name:
      sanitizeTextField(overrides?.name ?? existing.name ?? fallbackName, 80) ||
      fallbackName,
    phone: sanitizeTextField(overrides?.phone ?? existing.phone ?? '', 24),
    email: sanitizeTextField(overrides?.email ?? existing.email ?? safeEmail, 120),
    authMethodPrepared: 'email_code',
    notificationsEnabled:
      overrides?.notificationsEnabled ?? Boolean(existing.notificationsEnabled ?? true),
    whatsappUpdatesEnabled:
      overrides?.whatsappUpdatesEnabled ??
      Boolean(existing.whatsappUpdatesEnabled ?? true),
    privacyAcceptedAt:
      overrides?.privacyAcceptedAt ??
      (typeof existing.privacyAcceptedAt === 'string'
        ? existing.privacyAcceptedAt
        : undefined),
  };

  if (overrides) {
    const updatePayload: Record<string, unknown> = {
      name: nextProfile.name.length >= 2 ? nextProfile.name : 'Cliente Barber',
      phone: nextProfile.phone,
      email: nextProfile.email.length >= 3 ? nextProfile.email : safeEmail,
      notificationsEnabled: nextProfile.notificationsEnabled,
      whatsappUpdatesEnabled: nextProfile.whatsappUpdatesEnabled,
      updatedAt: serverTimestamp(),
    };
    if (nextProfile.privacyAcceptedAt) {
      updatePayload.privacyAcceptedAt = sanitizeTextField(
        nextProfile.privacyAcceptedAt,
        40
      );
    }
    try {
      await updateDoc(userRef, updatePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  }

  return nextProfile;
}

export function subscribeClientAppointments(
  uid: string,
  onData: (appointments: Appointment[]) => void,
  onFailure?: (err: Error) => void
): () => void {
  if (!isFirebaseSyncEnabled || !db) {
    return () => {};
  }
  const q = query(
    collection(db, 'appointments'),
    where('clientId', '==', uid),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Appointment[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          bookingCode: String(d.bookingCode ?? ''),
          shopId: String(d.shopId ?? BARBERSHOP_INFO.id),
          clientId: String(d.clientId ?? uid),
          clientName: String(d.clientName ?? ''),
          clientPhone: String(d.clientPhone ?? ''),
          clientEmail: typeof d.clientEmail === 'string' ? d.clientEmail : undefined,
          serviceId: String(d.serviceId ?? ''),
          serviceName: String(d.serviceName ?? ''),
          serviceDurationMinutes: Number(d.serviceDurationMinutes ?? 45),
          priceCents: Number(d.priceCents ?? 0),
          barberId: String(d.barberId ?? ''),
          barberName: String(d.barberName ?? ''),
          anyBarberRequested: Boolean(d.anyBarberRequested),
          date: String(d.date ?? ''),
          startTime: String(d.startTime ?? ''),
          endTime: String(d.endTime ?? ''),
          slotLockId: typeof d.slotLockId === 'string' ? d.slotLockId : undefined,
          notes: typeof d.notes === 'string' ? d.notes : undefined,
          paymentMethod: (d.paymentMethod as PaymentMethod) ?? 'pix',
          status: d.status,
          rescheduleRequest: d.rescheduleRequest,
          changeHistory: Array.isArray(d.changeHistory) ? d.changeHistory : [],
          createdAt: timestampToISO(d.createdAt),
          updatedAt: timestampToISO(d.updatedAt),
        } as Appointment;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'appointments');
      } catch (wrapped) {
        onFailure?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

export async function fetchFirestoreAvailabilitySlots(params: {
  dateISO: string;
  serviceId: string;
  barberId: string;
}): Promise<{
  isShopOpen: boolean;
  closedReason?: string;
  openingHoursLabel: string;
  slots: TimeSlotAvailability[];
}> {
  const service = SERVICES.find((s) => s.id === params.serviceId) ?? SERVICES[0];
  const localDate = parseISODateLocal(params.dateISO);
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

  if (!isFirebaseSyncEnabled || !db) {
    throw new Error(FIREBASE_SYNC_PAUSED_MESSAGE);
  }
  let busyLocks: {barberId: string; startTime: string; endTime: string}[] = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'availabilitySlots'), where('date', '==', params.dateISO))
    );
    busyLocks = snap.docs.map((d) => {
      const data = d.data();
      return {
        barberId: String(data.barberId ?? ''),
        startTime: String(data.startTime ?? ''),
        endTime: String(data.endTime ?? ''),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'availabilitySlots');
  }

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

    if (slotStart < openMinutes || slotEnd > closeMinutes) {
      continue;
    }

    if (params.dateISO === todayISO && slotStart <= currentMinutesNow + 15) {
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
      const barberLocks = busyLocks.filter((l) => l.barberId === barber.id);
      const hasConflict = barberLocks.some((b) =>
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

export async function createFirestoreAppointment(input: {
  user: User;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  serviceId: string;
  barberId: string;
  date: string;
  startTime: string;
  notes?: string;
  paymentMethod: PaymentMethod;
}): Promise<{
  ok: boolean;
  status: number;
  appointment?: Appointment;
  error?: string;
}> {
  if (!isFirebaseSyncEnabled || !db) {
    return {
      ok: false,
      status: 503,
      error: FIREBASE_SYNC_PAUSED_MESSAGE,
    };
  }
  if (!input.user.emailVerified) {
    return {
      ok: false,
      status: 403,
      error: 'Confirme seu e-mail antes de finalizar o agendamento.',
    };
  }

  // Check authoritative service document in Firestore (zero-trust price & duration)
  const localService = SERVICES.find((s) => s.id === input.serviceId);
  if (!localService) {
    return {ok: false, status: 400, error: 'Serviço selecionado não encontrado.'};
  }

  let authoritativeServiceName = localService.name;
  let authoritativePriceCents = localService.priceCents;
  let authoritativeDuration = localService.durationMinutes;

  try {
    const svcSnap = await getDoc(doc(db, 'services', input.serviceId));
    if (!svcSnap.exists()) {
      return {
        ok: false,
        status: 400,
        error:
          'O catálogo oficial no banco ainda está sendo inicializado pelo administrador da barbearia.',
      };
    }
    const svcData = svcSnap.data();
    authoritativeServiceName = sanitizeTextField(svcData.name, 100) || localService.name;
    authoritativePriceCents = Number(svcData.priceCents);
    authoritativeDuration = Number(svcData.durationMinutes);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `services/${input.serviceId}`);
  }

  const availability = await fetchFirestoreAvailabilitySlots({
    dateISO: input.date,
    serviceId: input.serviceId,
    barberId: input.barberId,
  });

  if (!availability.isShopOpen) {
    return {
      ok: false,
      status: 400,
      error: availability.closedReason ?? 'Barbearia fechada na data escolhida.',
    };
  }

  const slot = availability.slots.find((s) => s.time === input.startTime);
  if (!slot || !slot.available || slot.availableBarberIds.length === 0) {
    return {
      ok: false,
      status: 409,
      error:
        'Este horário acabou de ficar indisponível. Escolha outro horário disponível.',
    };
  }

  const assignedBarberId =
    input.barberId === 'any' ? slot.availableBarberIds[0] : input.barberId;
  const assignedBarber = BARBERS.find((b) => b.id === assignedBarberId);
  if (!assignedBarber) {
    return {
      ok: false,
      status: 400,
      error: 'Profissional indisponível para este horário.',
    };
  }

  const randomArr = new Uint32Array(1);
  const randomDigits =
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
      ? 1000 + (globalThis.crypto.getRandomValues(randomArr)[0] % 9000)
      : Math.floor(1000 + Math.random() * 9000);
  const appointmentId = `apt-${Date.now()}-${randomDigits}`;
  const bookingCode = `BO-${randomDigits}`;
  const endTime = addMinutesToTime(input.startTime, authoritativeDuration);
  const slotLockId = `${assignedBarber.id}__${input.date}__${input.startTime.replace(':', '-')}`;
  const nowISO = new Date().toISOString();

  const historyEntry = cleanHistoryEntry({
    id: `hist-${Date.now()}`,
    timestamp: nowISO,
    actor: 'cliente',
    action: 'Agendamento confirmado pelo aplicativo do cliente',
    newStatus: 'Confirmado',
  });

  const cleanName = sanitizeTextField(input.clientName, 80);
  const cleanPhone = sanitizeTextField(input.clientPhone, 24);
  const cleanEmail = sanitizeTextField(input.clientEmail, 120);
  const cleanNotes = sanitizeTextField(input.notes, 400);

  const appointmentDocPayload: Record<string, unknown> = {
    id: appointmentId,
    bookingCode,
    shopId: BARBERSHOP_INFO.id,
    clientId: input.user.uid,
    clientName: cleanName,
    clientPhone: cleanPhone,
    serviceId: localService.id,
    serviceName: sanitizeTextField(authoritativeServiceName, 100),
    serviceDurationMinutes: Math.round(authoritativeDuration),
    priceCents: Math.round(authoritativePriceCents),
    barberId: assignedBarber.id,
    barberName: sanitizeTextField(assignedBarber.name, 80),
    anyBarberRequested: input.barberId === 'any',
    date: input.date,
    startTime: input.startTime,
    endTime,
    slotLockId,
    paymentMethod: input.paymentMethod,
    status: 'Confirmado',
    changeHistory: [historyEntry],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (cleanEmail) {
    appointmentDocPayload.clientEmail = cleanEmail;
  }
  if (cleanNotes) {
    appointmentDocPayload.notes = cleanNotes;
  }

  const slotLockPayload = {
    shopId: BARBERSHOP_INFO.id,
    barberId: assignedBarber.id,
    date: input.date,
    startTime: input.startTime,
    endTime,
    appointmentId,
    clientId: input.user.uid,
    kind: 'booking',
    createdAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'appointments', appointmentId), appointmentDocPayload);
    batch.set(doc(db, 'availabilitySlots', slotLockId), slotLockPayload);
    await batch.commit();
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('already exists') || msg.includes('permission')) {
      return {
        ok: false,
        status: 409,
        error:
          'Este horário acabou de ser reservado por outro cliente. Escolha outro horário livre.',
      };
    }
    handleFirestoreError(error, OperationType.WRITE, `appointments/${appointmentId}`);
  }

  const createdAppointment: Appointment = {
    id: appointmentId,
    bookingCode,
    shopId: BARBERSHOP_INFO.id,
    clientId: input.user.uid,
    clientName: cleanName,
    clientPhone: cleanPhone,
    clientEmail: cleanEmail || undefined,
    serviceId: localService.id,
    serviceName: authoritativeServiceName,
    serviceDurationMinutes: authoritativeDuration,
    priceCents: authoritativePriceCents,
    barberId: assignedBarber.id,
    barberName: assignedBarber.name,
    anyBarberRequested: input.barberId === 'any',
    date: input.date,
    startTime: input.startTime,
    endTime,
    slotLockId,
    notes: cleanNotes || undefined,
    paymentMethod: input.paymentMethod,
    status: 'Confirmado',
    changeHistory: [historyEntry],
    createdAt: nowISO,
    updatedAt: nowISO,
  };

  return {ok: true, status: 201, appointment: createdAppointment};
}

export async function cancelFirestoreAppointment(params: {
  uid: string;
  appointment: Appointment;
  reason?: string;
}): Promise<Appointment> {
  if (!isFirebaseSyncEnabled || !db) {
    throw new Error(FIREBASE_SYNC_PAUSED_MESSAGE);
  }
  const {uid, appointment, reason} = params;
  const nowISO = new Date().toISOString();
  const cleanReason = sanitizeTextField(reason, 300);

  const nextHistory = [
    ...appointment.changeHistory.map(cleanHistoryEntry),
    cleanHistoryEntry({
      id: `hist-${Date.now()}`,
      timestamp: nowISO,
      actor: 'cliente',
      action: 'Cancelamento realizado pelo cliente',
      previousStatus: appointment.status,
      newStatus: 'Cancelado',
      note: cleanReason || undefined,
    }),
  ].slice(-30);

  const slotLockId =
    appointment.slotLockId ||
    `${appointment.barberId}__${appointment.date}__${appointment.startTime.replace(':', '-')}`;

  const aptRef = doc(db, 'appointments', appointment.id);
  const slotRef = doc(db, 'availabilitySlots', slotLockId);

  try {
    const batch = writeBatch(db);
    batch.update(aptRef, {
      status: 'Cancelado',
      changeHistory: nextHistory,
      updatedAt: serverTimestamp(),
    });
    batch.delete(slotRef);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `appointments/${appointment.id}`
    );
  }

  return {
    ...appointment,
    clientId: uid,
    status: 'Cancelado',
    changeHistory: nextHistory,
    updatedAt: nowISO,
  };
}

export async function rescheduleFirestoreAppointment(params: {
  appointment: Appointment;
  preferredDate: string;
  preferredTime: string;
  reason?: string;
}): Promise<Appointment> {
  if (!isFirebaseSyncEnabled || !db) {
    throw new Error(FIREBASE_SYNC_PAUSED_MESSAGE);
  }
  const {appointment, preferredDate, preferredTime, reason} = params;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) ||
    !/^\d{2}:\d{2}$/.test(preferredTime)
  ) {
    throw new Error(
      'Data ou horário inválido para solicitação de reagendamento.'
    );
  }
  const nowISO = new Date().toISOString();
  const cleanReason = sanitizeTextField(reason, 300);

  const rescheduleAvailability = await fetchFirestoreAvailabilitySlots({
    dateISO: preferredDate,
    serviceId: appointment.serviceId,
    barberId: appointment.anyBarberRequested ? 'any' : appointment.barberId,
  });

  if (!rescheduleAvailability.isShopOpen) {
    throw new Error(
      rescheduleAvailability.closedReason ??
        'A barbearia não funciona na data escolhida.'
    );
  }

  const requestedSlot = rescheduleAvailability.slots.find(
    (s) => s.time === preferredTime
  );
  if (!requestedSlot || !requestedSlot.available) {
    throw new Error(
      'O horário escolhido para reagendamento não está mais disponível. Selecione outro horário livre.'
    );
  }

  const rescheduleRequest: Record<string, string> = {
    preferredDate,
    preferredTime,
    requestedAt: nowISO,
  };
  if (cleanReason) {
    rescheduleRequest.reason = cleanReason;
  }

  const nextHistory = [
    ...appointment.changeHistory.map(cleanHistoryEntry),
    cleanHistoryEntry({
      id: `hist-${Date.now()}`,
      timestamp: nowISO,
      actor: 'cliente',
      action: `Solicitação de reagendamento para ${preferredDate} às ${preferredTime}`,
      previousStatus: appointment.status,
      newStatus: 'Reagendamento solicitado',
      note: cleanReason || undefined,
    }),
  ].slice(-30);

  try {
    await updateDoc(doc(db, 'appointments', appointment.id), {
      status: 'Reagendamento solicitado',
      rescheduleRequest,
      changeHistory: nextHistory,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `appointments/${appointment.id}`
    );
  }

  return {
    ...appointment,
    status: 'Reagendamento solicitado',
    rescheduleRequest: {
      preferredDate,
      preferredTime,
      reason: cleanReason || undefined,
      requestedAt: nowISO,
    },
    changeHistory: nextHistory,
    updatedAt: nowISO,
  };
}
