import {Appointment, PaymentMethod} from '@/lib/types/domain';

export function formatPaymentMethodLabel(method?: PaymentMethod): string {
  switch (method) {
    case 'pix':
      return 'Pix';
    case 'cartao_credito':
      return 'Cartão de Crédito';
    case 'cartao_debito':
      return 'Cartão de Débito';
    case 'dinheiro':
      return 'Dinheiro';
    default:
      return 'A definir no local';
  }
}

function formatEMVField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16CCITT(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixCopyPasteCode(params: {
  pixKey: string;
  merchantName: string;
  city: string;
  amountCents: number;
  txId?: string;
}): string {
  const cleanName = params.merchantName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 25);
  const cleanCity = params.city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 15);
  const cleanTxId =
    (params.txId || 'BARBERSHOP').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || '***';
  const amountStr = (params.amountCents / 100).toFixed(2);

  const merchantAccountInfo =
    formatEMVField('00', 'BR.GOV.BCB.PIX') + formatEMVField('01', params.pixKey);

  const additionalData = formatEMVField('05', cleanTxId);

  const payloadWithoutCrc =
    formatEMVField('00', '01') +
    formatEMVField('26', merchantAccountInfo) +
    formatEMVField('52', '0000') +
    formatEMVField('53', '986') +
    formatEMVField('54', amountStr) +
    formatEMVField('58', 'BR') +
    formatEMVField('59', cleanName) +
    formatEMVField('60', cleanCity) +
    formatEMVField('62', additionalData) +
    '6304';

  return payloadWithoutCrc + crc16CCITT(payloadWithoutCrc);
}

export function formatCurrencyBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}min`;
}

export function isValidTimeHHMM(timeStr: string): boolean {
  if (typeof timeStr !== 'string' || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return false;
  }
  const [h, m] = timeStr.split(':').map(Number);
  return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function timeToMinutes(timeStr: string): number {
  if (!isValidTimeHHMM(timeStr)) {
    return Number.NaN;
  }
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes)) {
    return '00:00';
  }
  const clamped = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutesToTime(timeStr: string, durationMinutes: number): string {
  const startMinutes = timeToMinutes(timeStr);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(durationMinutes)) {
    return '00:00';
  }
  return minutesToTime(startMinutes + durationMinutes);
}

export function isValidISODate(dateISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return false;
  }
  const [year, month, day] = dateISO.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const probe = new Date(year, month - 1, day, 12, 0, 0);
  return (
    probe.getFullYear() === year &&
    probe.getMonth() === month - 1 &&
    probe.getDate() === day
  );
}

export function parseISODateLocal(dateISO: string): Date {
  const [year, month, day] = dateISO.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function formatDateLongPTBR(dateISO: string): string {
  const date = parseISODateLocal(dateISO);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateShortPTBR(dateISO: string): string {
  const date = parseISODateLocal(dateISO);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(date);
}

export function formatPhoneBR(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function isValidPhoneBR(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

export function isValidEmailOptional(email: string): boolean {
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function buildWhatsAppLink(whatsappDigits: string, message: string): string {
  return `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(message)}`;
}

export function generateCalendarICS(
  appointment: Appointment,
  shopName: string,
  addressFull: string
): string {
  const cleanDate = appointment.date.replace(/-/g, '');
  const startClean = appointment.startTime.replace(':', '') + '00';
  const endClean = appointment.endTime.replace(':', '') + '00';

  const uid = `${appointment.bookingCode}@blackorangebarber.com`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Barber Shop//Cliente App//PT-BR',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${cleanDate}T${startClean}`,
    `DTEND:${cleanDate}T${endClean}`,
    `SUMMARY:${appointment.serviceName} — ${shopName}`,
    `DESCRIPTION:Profissional: ${appointment.barberName} | Código: ${appointment.bookingCode}`,
    `LOCATION:${addressFull}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

export function getSaoPauloTodayParts(): {
  year: number;
  month: number;
  day: number;
  dateISO: string;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  return {
    year,
    month,
    day,
    dateISO: `${map.year}-${map.month}-${map.day}`,
  };
}

export function getUpcomingDatesList(daysCount = 14): {
  dateISO: string;
  weekdayShort: string;
  dayNumber: string;
  monthShort: string;
  dayOfWeek: number;
  isToday: boolean;
}[] {
  const list = [];
  const {year, month, day} = getSaoPauloTodayParts();
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(year, month - 1, day + i, 12, 0, 0);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    const dateISO = `${y}-${m}-${dayStr}`;

    const weekdayShort = new Intl.DateTimeFormat('pt-BR', {weekday: 'short'})
      .format(d)
      .replace('.', '');
    const monthShort = new Intl.DateTimeFormat('pt-BR', {month: 'short'})
      .format(d)
      .replace('.', '');

    list.push({
      dateISO,
      weekdayShort: weekdayShort.charAt(0).toUpperCase() + weekdayShort.slice(1),
      dayNumber: dayStr,
      monthShort,
      dayOfWeek: d.getDay(),
      isToday: i === 0,
    });
  }
  return list;
}
