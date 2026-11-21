import {
  Appointment,
  FaceShape,
  FacialMeasurements,
  HairLengthCategory,
  HairType,
  PaymentMethod,
  TimeSlotAvailability,
  VirtualHairstyleId,
  VirtualTryOnAnalysis,
} from '@/lib/types/domain';
import {
  APP_SYSTEM_HEADER_NAME,
  CLIENT_SYSTEM_HEADER_VALUE,
  CLIENT_UID_HEADER_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from '@/lib/utils/csrf-edge';
import {sanitizeAppointmentsList} from '@/lib/utils/security';

const DEFAULT_TIMEOUT_MS = 12000;
const VISION_TIMEOUT_MS = 28000;
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let cachedCsrfToken: string | null = null;
let pendingCsrfFetch: Promise<string | null> | null = null;

interface ApiAuthProvider {
  getIdToken: () => Promise<string | null>;
  getExpectedUid: () => string | null;
}

let apiAuthProvider: ApiAuthProvider = {
  getIdToken: async () => null,
  getExpectedUid: () => null,
};

export function setApiAuthContext(provider: ApiAuthProvider): void {
  apiAuthProvider = provider;
}

export function clearCachedCsrfToken(): void {
  cachedCsrfToken = null;
}

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const prefix = `${CSRF_COOKIE_NAME}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      const raw = trimmed.slice(prefix.length);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

async function resolveCsrfToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh) {
    const fromCookie = readCsrfCookie();
    if (fromCookie) {
      cachedCsrfToken = fromCookie;
      return fromCookie;
    }
    if (cachedCsrfToken) {
      return cachedCsrfToken;
    }
  }

  if (pendingCsrfFetch) {
    return pendingCsrfFetch;
  }

  pendingCsrfFetch = (async () => {
    try {
      const res = await fetch('/api/csrf', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {Accept: 'application/json'},
      });
      if (!res.ok) return null;
      const payload = (await res.json()) as {csrfToken?: string};
      if (payload.csrfToken) {
        cachedCsrfToken = payload.csrfToken;
        return payload.csrfToken;
      }
      return readCsrfCookie();
    } catch {
      return null;
    } finally {
      pendingCsrfFetch = null;
    }
  })();

  return pendingCsrfFetch;
}

export async function syncApiUserSession(idToken: string): Promise<boolean> {
  const csrfToken = await resolveCsrfToken(true);
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      [APP_SYSTEM_HEADER_NAME]: CLIENT_SYSTEM_HEADER_VALUE,
      ...(csrfToken ? {[CSRF_HEADER_NAME]: csrfToken} : {}),
    },
    body: JSON.stringify({loginScope: 'client'}),
  });
  if (!res.ok) {
    return false;
  }
  const payload = (await res.json()) as {csrfToken?: string};
  if (payload.csrfToken) {
    cachedCsrfToken = payload.csrfToken;
  }
  return true;
}

export async function clearApiUserSession(): Promise<void> {
  cachedCsrfToken = null;
  const csrfToken = await resolveCsrfToken(true);
  try {
    const res = await fetch('/api/auth/session', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        [APP_SYSTEM_HEADER_NAME]: CLIENT_SYSTEM_HEADER_VALUE,
        ...(csrfToken ? {[CSRF_HEADER_NAME]: csrfToken} : {}),
      },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const payload = (await res.json()) as {csrfToken?: string};
      cachedCsrfToken = payload.csrfToken ?? null;
    }
  } catch {
    // Ignore offline signout network failures
  }
}

async function fetchJsonWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retriedAuth = false
): Promise<{ok: boolean; status: number; data: T}> {
  const method = (options.method || 'GET').toUpperCase();
  const isMutating = MUTATING_METHODS.has(method);
  const csrfToken = isMutating ? await resolveCsrfToken(retriedAuth) : null;
  const [idToken, expectedUid] = await Promise.all([
    apiAuthProvider.getIdToken().catch(() => null),
    Promise.resolve(apiAuthProvider.getExpectedUid()),
  ]);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        [APP_SYSTEM_HEADER_NAME]: CLIENT_SYSTEM_HEADER_VALUE,
        ...(idToken ? {Authorization: `Bearer ${idToken}`} : {}),
        ...(expectedUid ? {[CLIENT_UID_HEADER_NAME]: expectedUid} : {}),
        ...(options.body ? {'Content-Type': 'application/json'} : {}),
        ...(isMutating && csrfToken ? {[CSRF_HEADER_NAME]: csrfToken} : {}),
        ...(options.headers ?? {}),
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? ((await response.json()) as T & {code?: string})
      : ({} as T & {code?: string});

    if (
      (response.status === 403 || response.status === 409) &&
      !retriedAuth &&
      (data.code === 'CSRF_VALIDATION_FAILED' ||
        data.code === 'INVALID_SESSION_TOKEN' ||
        data.code === 'USER_SESSION_CONFLICT')
    ) {
      cachedCsrfToken = null;
      clearTimeout(timer);
      if (data.code === 'USER_SESSION_CONFLICT' && idToken) {
        await syncApiUserSession(idToken).catch(() => false);
      }
      return fetchJsonWithTimeout<T>(url, options, timeoutMs, true);
    }

    return {ok: response.ok, status: response.status, data};
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchClientAppointments(
  clientId: string
): Promise<Appointment[]> {
  const {ok, data} = await fetchJsonWithTimeout<{appointments?: unknown}>(
    `/api/appointments?clientId=${encodeURIComponent(clientId)}`
  );
  if (!ok || !data.appointments) {
    return [];
  }
  return sanitizeAppointmentsList(data.appointments);
}

export async function fetchAvailabilitySlots(params: {
  dateISO: string;
  serviceId: string;
  barberId: string;
}): Promise<{
  isShopOpen: boolean;
  closedReason?: string;
  openingHoursLabel: string;
  slots: TimeSlotAvailability[];
}> {
  const {ok, data} = await fetchJsonWithTimeout<{
    isShopOpen?: boolean;
    closedReason?: string;
    openingHoursLabel?: string;
    slots?: TimeSlotAvailability[];
    error?: string;
  }>(
    `/api/availability?date=${encodeURIComponent(
      params.dateISO
    )}&serviceId=${encodeURIComponent(
      params.serviceId
    )}&barberId=${encodeURIComponent(params.barberId)}`
  );

  if (!ok) {
    throw new Error(data.error || 'Não foi possível consultar os horários no momento.');
  }

  return {
    isShopOpen: Boolean(data.isShopOpen),
    closedReason: data.closedReason,
    openingHoursLabel: data.openingHoursLabel || '',
    slots: Array.isArray(data.slots) ? data.slots : [],
  };
}

export async function createClientAppointment(payload: {
  clientId: string;
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
  const {ok, status, data} = await fetchJsonWithTimeout<{
    appointment?: Appointment;
    error?: string;
  }>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    ok,
    status,
    appointment: data.appointment,
    error: data.error,
  };
}

export async function updateClientAppointment(params: {
  id: string;
  clientId: string;
  action: 'cancel' | 'request_reschedule';
  preferredDate?: string;
  preferredTime?: string;
  reason?: string;
}): Promise<Appointment> {
  const {ok, data} = await fetchJsonWithTimeout<{
    appointment?: Appointment;
    error?: string;
  }>(`/api/appointments/${encodeURIComponent(params.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      clientId: params.clientId,
      action: params.action,
      preferredDate: params.preferredDate,
      preferredTime: params.preferredTime,
      reason: params.reason,
    }),
  });

  if (!ok || !data.appointment) {
    throw new Error(data.error || 'Não foi possível atualizar o agendamento.');
  }
  return data.appointment;
}

export async function analyzeTryOnVision(params: {
  styleId: VirtualHairstyleId;
  imageBase64: string;
  mimeType?: string;
}): Promise<VirtualTryOnAnalysis> {
  const {ok, data} = await fetchJsonWithTimeout<{
    analysis?: VirtualTryOnAnalysis;
    error?: string;
  }>(
    '/api/try-on',
    {
      method: 'POST',
      body: JSON.stringify({
        mode: 'vision',
        styleId: params.styleId,
        imageBase64: params.imageBase64,
        mimeType: params.mimeType || 'image/jpeg',
      }),
    },
    VISION_TIMEOUT_MS
  );

  if (!ok || !data.analysis) {
    throw new Error(
      data.error || 'Erro ao executar leitura Face ID por inteligência artificial.'
    );
  }
  return data.analysis;
}

export async function calculateTryOnManual(params: {
  styleId: VirtualHairstyleId;
  manualFaceShape?: FaceShape;
  facialMeasurements?: FacialMeasurements;
  manualHairType?: HairType;
  manualHairLength?: HairLengthCategory;
}): Promise<VirtualTryOnAnalysis> {
  const {ok, data} = await fetchJsonWithTimeout<{
    analysis?: VirtualTryOnAnalysis;
    error?: string;
  }>('/api/try-on', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'manual',
      styleId: params.styleId,
      ...(params.manualFaceShape ? {manualFaceShape: params.manualFaceShape} : {}),
      ...(params.facialMeasurements
        ? {facialMeasurements: params.facialMeasurements}
        : {}),
      ...(params.manualHairType ? {manualHairType: params.manualHairType} : {}),
      ...(params.manualHairLength ? {manualHairLength: params.manualHairLength} : {}),
    }),
  });

  if (!ok || !data.analysis) {
    throw new Error(data.error || 'Erro ao calcular compatibilidade.');
  }
  return data.analysis;
}
