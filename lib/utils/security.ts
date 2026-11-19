import {
  Appointment,
  AppointmentStatus,
  ClientProfile,
  PaymentMethod,
} from '@/lib/types/domain';

const VALID_PAYMENT_METHODS: ReadonlySet<PaymentMethod> = new Set([
  'pix',
  'cartao_credito',
  'cartao_debito',
  'dinheiro',
]);

const VALID_APPOINTMENT_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  'Pendente',
  'Confirmado',
  'Concluído',
  'Cancelado',
  'Reagendamento solicitado',
]);

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{2,128}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HM_REGEX = /^\d{2}:\d{2}$/;

/**
 * Removes invisible ASCII control characters and trims oversized whitespace
 * to prevent malformed strings across UI forms and future backend persistence.
 */
export function sanitizeTextField(input: unknown, maxLength = 120): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function isSafeEntityId(id: unknown): id is string {
  return typeof id === 'string' && SAFE_ID_REGEX.test(id);
}

export function isSafeExternalHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Safely hydrates a ClientProfile stored in localStorage, stripping unexpected keys,
 * enforcing primitive types, and falling back to safe defaults if tampered/corrupted.
 */
export function sanitizeClientProfile(
  raw: unknown,
  fallback: ClientProfile
): ClientProfile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback;
  }
  const obj = raw as Record<string, unknown>;
  const safeId = isSafeEntityId(obj.id) ? obj.id : fallback.id;
  const safeName =
    typeof obj.name === 'string' ? sanitizeTextField(obj.name, 80) : fallback.name;
  const safePhone =
    typeof obj.phone === 'string' ? sanitizeTextField(obj.phone, 24) : fallback.phone;
  const safeEmail =
    typeof obj.email === 'string' ? sanitizeTextField(obj.email, 120) : fallback.email;

  return {
    id: safeId,
    name: safeName,
    phone: safePhone,
    email:
      safeEmail === ''
        ? ''
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)
          ? safeEmail
          : fallback.email,
    authMethodPrepared:
      obj.authMethodPrepared === 'phone_otp' ||
      obj.authMethodPrepared === 'email_code' ||
      obj.authMethodPrepared === 'guest_demo'
        ? obj.authMethodPrepared
        : fallback.authMethodPrepared,
    notificationsEnabled:
      typeof obj.notificationsEnabled === 'boolean'
        ? obj.notificationsEnabled
        : fallback.notificationsEnabled,
    whatsappUpdatesEnabled:
      typeof obj.whatsappUpdatesEnabled === 'boolean'
        ? obj.whatsappUpdatesEnabled
        : fallback.whatsappUpdatesEnabled,
    privacyAcceptedAt:
      typeof obj.privacyAcceptedAt === 'string'
        ? obj.privacyAcceptedAt.slice(0, 40)
        : undefined,
  };
}

/**
 * Validates cached appointment arrays from localStorage before rendering in React state.
 */
export function sanitizeAppointmentsList(raw: unknown): Appointment[] {
  if (!Array.isArray(raw)) return [];
  const clean: Appointment[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const a = item as Record<string, unknown>;

    if (
      !isSafeEntityId(a.id) ||
      !isSafeEntityId(a.clientId) ||
      typeof a.bookingCode !== 'string' ||
      typeof a.date !== 'string' ||
      !ISO_DATE_REGEX.test(a.date) ||
      typeof a.startTime !== 'string' ||
      !TIME_HM_REGEX.test(a.startTime) ||
      typeof a.endTime !== 'string' ||
      !TIME_HM_REGEX.test(a.endTime) ||
      typeof a.serviceId !== 'string' ||
      typeof a.serviceName !== 'string' ||
      typeof a.barberId !== 'string' ||
      typeof a.barberName !== 'string' ||
      typeof a.priceCents !== 'number' ||
      a.priceCents < 0
    ) {
      continue;
    }

    const paymentMethod: PaymentMethod = VALID_PAYMENT_METHODS.has(
      a.paymentMethod as PaymentMethod
    )
      ? (a.paymentMethod as PaymentMethod)
      : 'pix';

    const status: AppointmentStatus = VALID_APPOINTMENT_STATUSES.has(
      a.status as AppointmentStatus
    )
      ? (a.status as AppointmentStatus)
      : 'Confirmado';

    clean.push({
      id: a.id,
      bookingCode: sanitizeTextField(a.bookingCode, 20),
      shopId: isSafeEntityId(a.shopId) ? a.shopId : 'black-orange-barber',
      clientId: a.clientId,
      clientName: sanitizeTextField(a.clientName, 80) || 'Cliente',
      clientPhone: sanitizeTextField(a.clientPhone, 24),
      clientEmail:
        typeof a.clientEmail === 'string'
          ? sanitizeTextField(a.clientEmail, 120) || undefined
          : undefined,
      serviceId: sanitizeTextField(a.serviceId, 60),
      serviceName: sanitizeTextField(a.serviceName, 100),
      serviceDurationMinutes:
        typeof a.serviceDurationMinutes === 'number' && a.serviceDurationMinutes > 0
          ? a.serviceDurationMinutes
          : 45,
      priceCents: Math.round(a.priceCents),
      barberId: sanitizeTextField(a.barberId, 60),
      barberName: sanitizeTextField(a.barberName, 80),
      anyBarberRequested: Boolean(a.anyBarberRequested),
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      slotLockId: isSafeEntityId(a.slotLockId) ? a.slotLockId : undefined,
      notes:
        typeof a.notes === 'string'
          ? sanitizeTextField(a.notes, 400) || undefined
          : undefined,
      paymentMethod,
      status,
      rescheduleRequest:
        a.rescheduleRequest &&
        typeof a.rescheduleRequest === 'object' &&
        !Array.isArray(a.rescheduleRequest)
          ? (() => {
              const rr = a.rescheduleRequest as Record<string, unknown>;
              if (
                typeof rr.preferredDate === 'string' &&
                ISO_DATE_REGEX.test(rr.preferredDate) &&
                typeof rr.preferredTime === 'string' &&
                TIME_HM_REGEX.test(rr.preferredTime)
              ) {
                return {
                  preferredDate: rr.preferredDate,
                  preferredTime: rr.preferredTime,
                  reason:
                    typeof rr.reason === 'string'
                      ? sanitizeTextField(rr.reason, 300) || undefined
                      : undefined,
                  requestedAt:
                    typeof rr.requestedAt === 'string'
                      ? rr.requestedAt.slice(0, 40)
                      : new Date().toISOString(),
                };
              }
              return undefined;
            })()
          : undefined,
      changeHistory: Array.isArray(a.changeHistory) ? a.changeHistory.slice(0, 30) : [],
      createdAt:
        typeof a.createdAt === 'string'
          ? a.createdAt.slice(0, 40)
          : new Date().toISOString(),
      updatedAt:
        typeof a.updatedAt === 'string'
          ? a.updatedAt.slice(0, 40)
          : new Date().toISOString(),
    });
  }

  return clean;
}

/**
 * Shared resilient clipboard copy utility (works in both secure top-level and restricted iframe contexts).
 */
export async function copyTextResilient(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    if (typeof document === 'undefined') return false;
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    helper.style.pointerEvents = 'none';
    document.body.appendChild(helper);
    helper.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(helper);
    return ok;
  } catch {
    return false;
  }
}
