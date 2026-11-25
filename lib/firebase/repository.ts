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
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
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
  AppointmentStatus,
  Barber,
  ClientProfile,
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
import {sanitizeTextField} from '@/lib/utils/security';

const ADMIN_BOOTSTRAP_EMAIL = 'evoluatechbr@gmail.com';
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{2,128}$/;
const BOOKING_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const VALID_PAYMENT_METHODS: ReadonlySet<PaymentMethod> = new Set([
  'pix',
  'cartao_credito',
  'cartao_debito',
  'dinheiro',
]);

const SAO_PAULO_NOW_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export interface BusySlotLock {
  slotId: string;
  barberId: string;
  startTime: string;
  endTime: string;
}

const BUSY_LOCKS_CACHE_TTL_MS = 5_000;
const BARBERS_CACHE_TTL_MS = 5 * 60_000;
const PROFILE_SESSION_CACHE_TTL_MS = 2 * 60_000;
const CATALOG_SEED_SESSION_TTL_MS = 12 * 60 * 60_000;

const busyLocksCache = new Map<string, {locks: BusySlotLock[]; expiresAt: number}>();
const inFlightBusyLocks = new Map<string, Promise<BusySlotLock[]>>();

let cachedBarbersDir: {barbers: Barber[]; expiresAt: number} | null = null;
let inFlightBarbersDir: Promise<Barber[]> | null = null;

export function invalidateDateBusyLocksCache(dateISO?: string): void {
  if (dateISO) {
    busyLocksCache.delete(dateISO);
    return;
  }
  busyLocksCache.clear();
}

export async function loadFirestoreBarbersWithFallback(): Promise<Barber[]> {
  if (!isFirebaseSyncEnabled || !db) {
    return BARBERS;
  }
  const now = Date.now();
  if (cachedBarbersDir && cachedBarbersDir.expiresAt > now) {
    return cachedBarbersDir.barbers;
  }
  if (inFlightBarbersDir) {
    return inFlightBarbersDir;
  }

  const activeDb = db;
  inFlightBarbersDir = (async () => {
    try {
      const snap = await getDocs(query(collection(activeDb, 'barbers'), limit(20)));
      if (snap.empty) {
        cachedBarbersDir = {barbers: BARBERS, expiresAt: Date.now() + BARBERS_CACHE_TTL_MS};
        return BARBERS;
      }

      const byId = new Map<string, Record<string, unknown>>();
      for (const d of snap.docs) {
        byId.set(d.id, d.data());
      }

      const merged = BARBERS.map((base) => {
        const remote = byId.get(base.id);
        if (!remote) return base;
        return {
          ...base,
          name: typeof remote.name === 'string' && remote.name ? remote.name : base.name,
          role: typeof remote.role === 'string' && remote.role ? remote.role : base.role,
          isAvailable:
            typeof remote.isAvailable === 'boolean'
              ? remote.isAvailable
              : base.isAvailable,
          workingDays: Array.isArray(remote.workingDays)
            ? (remote.workingDays as number[])
            : base.workingDays,
          serviceIds: Array.isArray(remote.serviceIds)
            ? (remote.serviceIds as string[])
            : base.serviceIds,
        };
      });

      cachedBarbersDir = {barbers: merged, expiresAt: Date.now() + BARBERS_CACHE_TTL_MS};
      return merged;
    } catch {
      return BARBERS;
    } finally {
      inFlightBarbersDir = null;
    }
  })();

  return inFlightBarbersDir;
}

function assertSafeId(value: string, fallback: string): string {
  const cleaned = sanitizeTextField(value, 128);
  return SAFE_ID_REGEX.test(cleaned) ? cleaned : fallback;
}

function generateCryptoHex(byteCount: number): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(byteCount);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random()
    .toString(16)
    .slice(2, 2 + byteCount * 2)
    .padEnd(byteCount * 2, '0');
}

function generateRandomBookingCode(): string {
  const len = 6;
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(len);
    globalThis.crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < len; i++) {
      out += BOOKING_CODE_ALPHABET[bytes[i] % BOOKING_CODE_ALPHABET.length];
    }
    return `BO-${out}`;
  }
  let out = '';
  for (let i = 0; i < len; i++) {
    out +=
      BOOKING_CODE_ALPHABET[Math.floor(Math.random() * BOOKING_CODE_ALPHABET.length)];
  }
  return `BO-${out}`;
}

function generateRandomIndex(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    const arr = new Uint32Array(1);
    globalThis.crypto.getRandomValues(arr);
    return arr[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
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
    id: assertSafeId(entry.id, `hist-${Date.now()}-${generateCryptoHex(2)}`),
    timestamp: sanitizeTextField(entry.timestamp, 40) || new Date().toISOString(),
    actor:
      entry.actor === 'cliente' || entry.actor === 'barbeiro' || entry.actor === 'sistema'
        ? entry.actor
        : 'cliente',
    action: sanitizeTextField(entry.action, 200) || 'Atualização de agendamento',
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

  const seedSessionKey = `bs_catalog_seeded_v1_${user.uid}`;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(seedSessionKey);
      const ts = raw ? Number(raw) : 0;
      if (Number.isFinite(ts) && ts > 0 && Date.now() - ts < CATALOG_SEED_SESSION_TTL_MS) {
        return;
      }
    } catch {
      // Ignore storage failures
    }
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
    const existingServicesSnap = await getDocs(
      query(collection(db, 'services'), limit(50))
    );
    const existingBarbersSnap = await getDocs(
      query(collection(db, 'barbers'), limit(50))
    );
    if (
      existingServicesSnap.size >= SERVICES.length &&
      existingBarbersSnap.size >= BARBERS.length
    ) {
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(seedSessionKey, String(Date.now()));
        } catch {
          // Ignore storage failures
        }
      }
      return;
    }

    const batch = writeBatch(db);
    for (const svc of SERVICES) {
      batch.set(
        doc(db, 'services', svc.id),
        {
          id: svc.id,
          name: sanitizeTextField(svc.name, 100),
          category: svc.category,
          priceCents: Math.round(svc.priceCents),
          durationMinutes: Math.round(svc.durationMinutes),
          active: true,
          barberIds: svc.barberIds.slice(0, 20),
          updatedAt: serverTimestamp(),
        },
        {merge: true}
      );
    }

    for (const barber of BARBERS) {
      batch.set(
        doc(db, 'barbers', barber.id),
        {
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
        },
        {merge: true}
      );
    }

    await batch.commit();
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(seedSessionKey, String(Date.now()));
      } catch {
        // Ignore storage failures
      }
    }
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

  const profileSessionKey = `bs_profile_sync_v1_${user.uid}`;
  if (!overrides && typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(profileSessionKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {expiresAt?: number; profile?: ClientProfile};
        if (
          parsed.profile &&
          parsed.profile.id === user.uid &&
          typeof parsed.expiresAt === 'number' &&
          parsed.expiresAt > Date.now()
        ) {
          return parsed.profile;
        }
      }
    } catch {
      // Ignore storage failures
    }
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
    const resolvedEmail =
      nextProfile.email.length >= 3
        ? nextProfile.email
        : safeEmail.length >= 3
          ? safeEmail
          : 'cliente@barbershop.app';
    const updatePayload: Record<string, unknown> = {
      name: nextProfile.name.length >= 2 ? nextProfile.name : 'Cliente Barber',
      phone: nextProfile.phone,
      email: resolvedEmail,
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
      await setDoc(userRef, updatePayload, {merge: true});
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(
        profileSessionKey,
        JSON.stringify({
          expiresAt: Date.now() + PROFILE_SESSION_CACHE_TTL_MS,
          profile: nextProfile,
        })
      );
    } catch {
      // Ignore storage failures
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
  const activeDb = db;
  let unsubscribed = false;
  let activeUnsub: () => void = () => {};

  const mapSnapshot = (snapshot: {
    docs: {id: string; data: () => Record<string, unknown>}[];
  }): Appointment[] =>
    snapshot.docs.map((docSnap) => {
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

  const appointmentsQuery = query(
    collection(activeDb, 'appointments'),
    where('clientId', '==', uid),
    limit(100)
  );

  activeUnsub = onSnapshot(
    appointmentsQuery,
    (snapshot) => {
      if (!unsubscribed) onData(mapSnapshot(snapshot));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'appointments');
      } catch (wrapped) {
        onFailure?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    unsubscribed = true;
    activeUnsub();
  };
}

function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

export function computeAvailabilityFromBusyLocks(params: {
  dateISO: string;
  serviceId: string;
  barberId: string;
  busyLocks: BusySlotLock[];
  barbers?: Barber[];
}): {
  isShopOpen: boolean;
  closedReason?: string;
  openingHoursLabel: string;
  slots: TimeSlotAvailability[];
} {
  if (!isValidISODate(params.dateISO)) {
    return {
      isShopOpen: false,
      closedReason: 'Data selecionada inválida.',
      openingHoursLabel: 'Indisponível',
      slots: [],
    };
  }
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
  const activeBarbers = params.barbers && params.barbers.length > 0 ? params.barbers : BARBERS;

  const eligibleBarbers = activeBarbers.filter((barber) => {
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

  const locksByBarber = new Map<string, {start: number; end: number}[]>();
  for (const lock of params.busyLocks) {
    if (!isValidTimeHHMM(lock.startTime) || !isValidTimeHHMM(lock.endTime)) {
      continue;
    }
    const start = timeToMinutes(lock.startTime);
    const end = timeToMinutes(lock.endTime);
    if (start >= end) continue;
    const list = locksByBarber.get(lock.barberId);
    if (list) {
      list.push({start, end});
    } else {
      locksByBarber.set(lock.barberId, [{start, end}]);
    }
  }

  const spParts = SAO_PAULO_NOW_FORMATTER.formatToParts(new Date());
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
      const barberLocks = locksByBarber.get(barber.id);
      const hasConflict = barberLocks
        ? barberLocks.some((b) => intervalsOverlap(slotStart, slotEnd, b.start, b.end))
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

async function loadDateBusyLocks(
  dateISO: string,
  forceFresh = false
): Promise<BusySlotLock[]> {
  if (!isFirebaseSyncEnabled || !db) {
    throw new Error(FIREBASE_SYNC_PAUSED_MESSAGE);
  }
  const activeDb = db;
  const now = Date.now();
  if (!forceFresh) {
    const cached = busyLocksCache.get(dateISO);
    if (cached && cached.expiresAt > now) {
      return cached.locks;
    }
    const existingFlight = inFlightBusyLocks.get(dateISO);
    if (existingFlight) {
      return existingFlight;
    }
  }

  const fetchPromise = (async () => {
    try {
      const snap = await getDocs(
        query(
          collection(activeDb, 'availabilitySlots'),
          where('date', '==', dateISO),
          limit(200)
        )
      );
      const locks: BusySlotLock[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          slotId: d.id,
          barberId: String(data.barberId ?? ''),
          startTime: String(data.startTime ?? ''),
          endTime: String(data.endTime ?? ''),
        };
      });
      busyLocksCache.set(dateISO, {
        locks,
        expiresAt: Date.now() + BUSY_LOCKS_CACHE_TTL_MS,
      });
      return locks;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'availabilitySlots');
    } finally {
      inFlightBusyLocks.delete(dateISO);
    }
  })();

  if (!forceFresh) {
    inFlightBusyLocks.set(dateISO, fetchPromise);
  }
  return fetchPromise;
}

export function subscribeFirestoreDateBusyLocks(
  dateISO: string,
  onLocks: (locks: BusySlotLock[]) => void,
  onFailure?: (err: Error) => void
): () => void {
  if (!isFirebaseSyncEnabled || !db || !isValidISODate(dateISO)) {
    return () => {};
  }
  const q = query(
    collection(db, 'availabilitySlots'),
    where('date', '==', dateISO),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => {
      const locks: BusySlotLock[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          slotId: d.id,
          barberId: String(data.barberId ?? ''),
          startTime: String(data.startTime ?? ''),
          endTime: String(data.endTime ?? ''),
        };
      });
      busyLocksCache.set(dateISO, {
        locks,
        expiresAt: Date.now() + BUSY_LOCKS_CACHE_TTL_MS,
      });
      onLocks(locks);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'availabilitySlots');
      } catch (wrapped) {
        onFailure?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function fetchFirestoreAvailabilitySlots(params: {
  dateISO: string;
  serviceId: string;
  barberId: string;
  forceFresh?: boolean;
}): Promise<{
  isShopOpen: boolean;
  closedReason?: string;
  openingHoursLabel: string;
  slots: TimeSlotAvailability[];
}> {
  if (!isValidISODate(params.dateISO)) {
    return {
      isShopOpen: false,
      closedReason: 'Data selecionada inválida.',
      openingHoursLabel: 'Indisponível',
      slots: [],
    };
  }
  const [busyLocks, activeBarbers] = await Promise.all([
    loadDateBusyLocks(params.dateISO, Boolean(params.forceFresh)),
    loadFirestoreBarbersWithFallback(),
  ]);
  return computeAvailabilityFromBusyLocks({
    dateISO: params.dateISO,
    serviceId: params.serviceId,
    barberId: params.barberId,
    busyLocks,
    barbers: activeBarbers,
  });
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
  const activeDb = db;
  if (!input.user.emailVerified) {
    return {
      ok: false,
      status: 403,
      error: 'Confirme seu e-mail antes de finalizar o agendamento.',
    };
  }

  if (!isValidISODate(input.date) || !isValidTimeHHMM(input.startTime)) {
    return {
      ok: false,
      status: 400,
      error: 'Data ou horário inválido para confirmação do agendamento.',
    };
  }

  const safePaymentMethod: PaymentMethod = VALID_PAYMENT_METHODS.has(input.paymentMethod)
    ? input.paymentMethod
    : 'pix';

  const cleanName = sanitizeTextField(input.clientName, 80);
  const cleanPhone = sanitizeTextField(input.clientPhone, 24);
  if (cleanName.length < 2 || cleanPhone.length < 8) {
    return {
      ok: false,
      status: 400,
      error: 'Informe nome completo e telefone válido antes de concluir a reserva.',
    };
  }

  const localService = SERVICES.find((s) => s.id === input.serviceId);
  if (!localService) {
    return {ok: false, status: 400, error: 'Serviço selecionado não encontrado.'};
  }

  // Always force a fresh availability read before running the atomic transaction
  const [busyLocks, activeBarbers] = await Promise.all([
    loadDateBusyLocks(input.date, true),
    loadFirestoreBarbersWithFallback(),
  ]);
  const availability = computeAvailabilityFromBusyLocks({
    dateISO: input.date,
    serviceId: input.serviceId,
    barberId: input.barberId,
    busyLocks,
    barbers: activeBarbers,
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

  // When 'any' barber is chosen, distribute concurrent load across free barbers
  // and failover cleanly if another client wins the first barber concurrently.
  let candidateBarberIds: string[];
  if (input.barberId === 'any') {
    const free = [...slot.availableBarberIds];
    const startIdx = generateRandomIndex(free.length);
    candidateBarberIds = [...free.slice(startIdx), ...free.slice(0, startIdx)];
  } else {
    candidateBarberIds = [input.barberId];
  }

  const cleanEmail = sanitizeTextField(input.clientEmail, 120);
  const cleanNotes = sanitizeTextField(input.notes, 400);
  const requestedStartMin = timeToMinutes(input.startTime);
  const requestedEndWindowMin = requestedStartMin + localService.durationMinutes;

  for (const candidateBarberId of candidateBarberIds) {
    const assignedBarber = activeBarbers.find((b) => b.id === candidateBarberId);
    if (!assignedBarber) continue;

    // Narrow transaction slot reads to overlapping time windows (~4-6 docs instead of all 14)
    const slotLockId = `${assignedBarber.id}__${input.date}__${input.startTime.replace(':', '-')}`;
    const candidateSlotIds = new Set<string>([slotLockId]);
    for (const demoSlot of DEMONSTRATION_SLOTS) {
      const slotStartMin = timeToMinutes(demoSlot);
      if (slotStartMin >= requestedStartMin - 180 && slotStartMin < requestedEndWindowMin) {
        candidateSlotIds.add(
          `${assignedBarber.id}__${input.date}__${demoSlot.replace(':', '-')}`
        );
      }
    }
    for (const lock of busyLocks) {
      if (lock.barberId !== assignedBarber.id || !lock.slotId) continue;
      if (!isValidTimeHHMM(lock.startTime) || !isValidTimeHHMM(lock.endTime)) {
        candidateSlotIds.add(lock.slotId);
        continue;
      }
      const lockStartMin = timeToMinutes(lock.startTime);
      const lockEndMin = timeToMinutes(lock.endTime);
      if (intervalsOverlap(requestedStartMin, requestedEndWindowMin, lockStartMin, lockEndMin)) {
        candidateSlotIds.add(lock.slotId);
      }
    }

    const appointmentId = `apt-${Date.now()}-${generateCryptoHex(4)}`;
    const bookingCode = generateRandomBookingCode();
    const nowISO = new Date().toISOString();

    const historyEntry = cleanHistoryEntry({
      id: `hist-${Date.now()}-${generateCryptoHex(2)}`,
      timestamp: nowISO,
      actor: 'cliente',
      action: 'Agendamento confirmado pelo aplicativo do cliente',
      newStatus: 'Confirmado',
    });

    try {
      const createdAppointment = await runTransaction(activeDb, async (tx) => {
        const svcRef = doc(activeDb, 'services', input.serviceId);
        const barberRef = doc(activeDb, 'barbers', assignedBarber.id);
        const slotIdsArray = Array.from(candidateSlotIds);

        const [svcSnap, barberSnap, ...slotSnaps] = await Promise.all([
          tx.get(svcRef),
          tx.get(barberRef),
          ...slotIdsArray.map((id) => tx.get(doc(activeDb, 'availabilitySlots', id))),
        ]);

        if (!svcSnap.exists()) {
          throw new Error('CATALOG_NOT_INITIALIZED');
        }
        const svcData = svcSnap.data();
        if (svcData.active === false) {
          throw new Error('SERVICE_INACTIVE');
        }
        const authoritativeServiceName =
          sanitizeTextField(svcData.name, 100) || localService.name;
        const rawPriceCents = Number(svcData.priceCents);
        const rawDuration = Number(svcData.durationMinutes);
        const authoritativePriceCents =
          Number.isFinite(rawPriceCents) && rawPriceCents > 0
            ? Math.round(rawPriceCents)
            : localService.priceCents;
        const authoritativeDuration =
          Number.isFinite(rawDuration) && rawDuration > 0
            ? Math.round(rawDuration)
            : localService.durationMinutes;

        let authoritativeBarberName = assignedBarber.name;
        if (barberSnap.exists()) {
          const barberData = barberSnap.data();
          if (barberData.isAvailable === false) {
            throw new Error('BARBER_UNAVAILABLE');
          }
          authoritativeBarberName =
            sanitizeTextField(barberData.name, 80) || assignedBarber.name;
        } else {
          throw new Error('CATALOG_NOT_INITIALIZED');
        }

        const requestedEndMin = requestedStartMin + authoritativeDuration;
        const endTime = addMinutesToTime(input.startTime, authoritativeDuration);

        // Atomic overlap check across all slot locks for this barber on this date
        for (const sSnap of slotSnaps) {
          if (!sSnap.exists()) continue;
          if (sSnap.id === slotLockId) {
            throw new Error('SLOT_CONFLICT');
          }
          const sData = sSnap.data();
          const sStartStr = String(sData.startTime ?? '');
          const sEndStr = String(sData.endTime ?? '');
          if (isValidTimeHHMM(sStartStr) && isValidTimeHHMM(sEndStr)) {
            const sStart = timeToMinutes(sStartStr);
            const sEnd = timeToMinutes(sEndStr);
            if (
              sStart < sEnd &&
              intervalsOverlap(requestedStartMin, requestedEndMin, sStart, sEnd)
            ) {
              throw new Error('SLOT_CONFLICT');
            }
          }
        }

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
          barberName: sanitizeTextField(authoritativeBarberName, 80),
          anyBarberRequested: input.barberId === 'any',
          date: input.date,
          startTime: input.startTime,
          endTime,
          slotLockId,
          paymentMethod: safePaymentMethod,
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

        tx.set(doc(activeDb, 'appointments', appointmentId), appointmentDocPayload);
        tx.set(doc(activeDb, 'availabilitySlots', slotLockId), slotLockPayload);

        return {
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
          barberName: authoritativeBarberName,
          anyBarberRequested: input.barberId === 'any',
          date: input.date,
          startTime: input.startTime,
          endTime,
          slotLockId,
          notes: cleanNotes || undefined,
          paymentMethod: safePaymentMethod,
          status: 'Confirmado' as const,
          changeHistory: [historyEntry],
          createdAt: nowISO,
          updatedAt: nowISO,
        } satisfies Appointment;
      });

      invalidateDateBusyLocksCache(input.date);
      return {ok: true, status: 201, appointment: createdAppointment};
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const lower = msg.toLowerCase();

      if (msg === 'CATALOG_NOT_INITIALIZED') {
        return {
          ok: false,
          status: 400,
          error:
            'O catálogo oficial no banco ainda está sendo inicializado pelo administrador da barbearia.',
        };
      }
      if (msg === 'SERVICE_INACTIVE') {
        return {
          ok: false,
          status: 400,
          error: 'Este serviço está temporariamente indisponível para agendamento.',
        };
      }
      if (
        msg === 'SLOT_CONFLICT' ||
        msg === 'BARBER_UNAVAILABLE' ||
        lower.includes('already exists') ||
        lower.includes('aborted') ||
        lower.includes('failed-precondition') ||
        lower.includes('permission')
      ) {
        invalidateDateBusyLocksCache(input.date);
        // Try next available barber when user selected 'any'
        continue;
      }

      handleFirestoreError(error, OperationType.WRITE, `appointments/${appointmentId}`);
    }
  }

  invalidateDateBusyLocksCache(input.date);
  return {
    ok: false,
    status: 409,
    error:
      'Este horário acabou de ser reservado por outro cliente. Escolha outro horário livre.',
  };
}

export async function cancelFirestoreAppointment(params: {
  uid: string;
  appointment: Appointment;
  reason?: string;
}): Promise<Appointment> {
  if (!isFirebaseSyncEnabled || !db) {
    throw new Error(FIREBASE_SYNC_PAUSED_MESSAGE);
  }
  const activeDb = db;
  const {uid, appointment, reason} = params;
  const nowISO = new Date().toISOString();
  const cleanReason = sanitizeTextField(reason, 300);

  const aptRef = doc(activeDb, 'appointments', appointment.id);

  try {
    const updated = await runTransaction(activeDb, async (tx) => {
      const aptSnap = await tx.get(aptRef);
      if (!aptSnap.exists()) {
        throw new Error('NOT_FOUND');
      }
      const latest = aptSnap.data();
      if (latest.clientId !== uid) {
        throw new Error('FORBIDDEN_OWNER');
      }
      const latestStatus = String(latest.status ?? appointment.status) as AppointmentStatus;
      if (latestStatus === 'Concluído' || latestStatus === 'Cancelado') {
        throw new Error('ALREADY_FINALIZED');
      }

      const slotLockId =
        (typeof latest.slotLockId === 'string' && latest.slotLockId) ||
        appointment.slotLockId ||
        `${appointment.barberId}__${appointment.date}__${appointment.startTime.replace(':', '-')}`;
      const slotRef = doc(activeDb, 'availabilitySlots', slotLockId);
      const slotSnap = await tx.get(slotRef);

      const serverHistory = Array.isArray(latest.changeHistory)
        ? (latest.changeHistory as AppointmentHistoryEntry[]).map(cleanHistoryEntry)
        : appointment.changeHistory.map(cleanHistoryEntry);

      const nextHistory = [
        ...serverHistory.slice(-29),
        cleanHistoryEntry({
          id: `hist-${Date.now()}-${generateCryptoHex(2)}`,
          timestamp: nowISO,
          actor: 'cliente',
          action: 'Cancelamento realizado pelo cliente',
          previousStatus: latestStatus,
          newStatus: 'Cancelado',
          note: cleanReason || undefined,
        }),
      ];

      tx.update(aptRef, {
        status: 'Cancelado',
        changeHistory: nextHistory,
        updatedAt: serverTimestamp(),
      });
      if (slotSnap.exists()) {
        tx.delete(slotRef);
      }

      return {
        ...appointment,
        clientId: uid,
        status: 'Cancelado' as const,
        changeHistory: nextHistory,
        updatedAt: nowISO,
      };
    });

    invalidateDateBusyLocksCache(appointment.date);
    return updated;
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (msg === 'NOT_FOUND') {
      throw new Error('Agendamento não encontrado no servidor.');
    }
    if (msg === 'FORBIDDEN_OWNER') {
      throw new Error('Você só pode cancelar os seus próprios agendamentos.');
    }
    if (msg === 'ALREADY_FINALIZED') {
      throw new Error(
        'Este agendamento já foi concluído ou cancelado pela barbearia.'
      );
    }
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `appointments/${appointment.id}`
    );
  }
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
  const activeDb = db;
  const {appointment, preferredDate, preferredTime, reason} = params;
  if (!isValidISODate(preferredDate) || !isValidTimeHHMM(preferredTime)) {
    throw new Error('Data ou horário inválido para solicitação de reagendamento.');
  }
  const nowISO = new Date().toISOString();
  const cleanReason = sanitizeTextField(reason, 300);

  const rescheduleAvailability = await fetchFirestoreAvailabilitySlots({
    dateISO: preferredDate,
    serviceId: appointment.serviceId,
    barberId: appointment.anyBarberRequested ? 'any' : appointment.barberId,
    forceFresh: true,
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

  const aptRef = doc(activeDb, 'appointments', appointment.id);
  try {
    return await runTransaction(activeDb, async (tx) => {
      const aptSnap = await tx.get(aptRef);
      if (!aptSnap.exists()) {
        throw new Error('NOT_FOUND');
      }
      const latest = aptSnap.data();
      const latestStatus = String(latest.status ?? appointment.status) as AppointmentStatus;
      if (latestStatus === 'Concluído' || latestStatus === 'Cancelado') {
        throw new Error('ALREADY_FINALIZED');
      }

      const serverHistory = Array.isArray(latest.changeHistory)
        ? (latest.changeHistory as AppointmentHistoryEntry[]).map(cleanHistoryEntry)
        : appointment.changeHistory.map(cleanHistoryEntry);

      const nextHistory = [
        ...serverHistory.slice(-29),
        cleanHistoryEntry({
          id: `hist-${Date.now()}-${generateCryptoHex(2)}`,
          timestamp: nowISO,
          actor: 'cliente',
          action: `Solicitação de reagendamento para ${preferredDate} às ${preferredTime}`,
          previousStatus: latestStatus,
          newStatus: 'Reagendamento solicitado',
          note: cleanReason || undefined,
        }),
      ];

      tx.update(aptRef, {
        status: 'Reagendamento solicitado',
        rescheduleRequest,
        changeHistory: nextHistory,
        updatedAt: serverTimestamp(),
      });

      return {
        ...appointment,
        status: 'Reagendamento solicitado' as const,
        rescheduleRequest: {
          preferredDate,
          preferredTime,
          reason: cleanReason || undefined,
          requestedAt: nowISO,
        },
        changeHistory: nextHistory,
        updatedAt: nowISO,
      };
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (msg === 'NOT_FOUND') {
      throw new Error('Agendamento não encontrado no servidor.');
    }
    if (msg === 'ALREADY_FINALIZED') {
      throw new Error(
        'Não é possível solicitar reagendamento porque este atendimento já foi concluído ou cancelado.'
      );
    }
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `appointments/${appointment.id}`
    );
  }
}
