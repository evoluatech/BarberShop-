import {NextRequest, NextResponse} from 'next/server';
import {resolveAuthenticatedClient} from '@/lib/server/firebase-auth';
import {createAppointment, listAllAppointments} from '@/lib/services/barbershop-store';
import {PaymentMethod} from '@/lib/types/domain';
import {
  isValidEmailOptional,
  isValidISODate,
  isValidPhoneBR,
} from '@/lib/utils/formatters';
import {isSafeEntityId, sanitizeTextField} from '@/lib/utils/security';

const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  'pix',
  'cartao_credito',
  'cartao_debito',
  'dinheiro',
];

export async function GET(req: NextRequest) {
  const auth = await resolveAuthenticatedClient(req);
  if (!auth.ok) {
    return NextResponse.json(
      {error: auth.error, code: auth.code},
      {
        status: auth.status,
        headers: {'Cache-Control': 'no-store'},
      }
    );
  }

  const {searchParams} = new URL(req.url);
  const requestedClientId = searchParams.get('clientId');
  if (requestedClientId && requestedClientId !== auth.uid) {
    return NextResponse.json(
      {
        error: 'Acesso negado: você só pode consultar os seus próprios agendamentos.',
        code: 'FORBIDDEN_USER_MISMATCH',
      },
      {status: 403, headers: {'Cache-Control': 'no-store'}}
    );
  }

  const appointments = listAllAppointments(auth.uid);
  return NextResponse.json(
    {appointments},
    {headers: {'Cache-Control': 'no-store'}}
  );
}

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveAuthenticatedClient(req);
    if (!auth.ok) {
      return NextResponse.json(
        {error: auth.error, code: auth.code},
        {status: auth.status, headers: {'Cache-Control': 'no-store'}}
      );
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json(
          {error: 'Corpo da requisição inválido para agendamento.'},
          {status: 400, headers: {'Cache-Control': 'no-store'}}
        );
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        {error: 'Requisição JSON inválida para agendamento.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const {
      clientId,
      clientName,
      clientPhone,
      clientEmail,
      serviceId,
      barberId,
      date,
      startTime,
      notes,
      paymentMethod,
    } = body ?? {};

    if (typeof clientId === 'string' && clientId.trim() && clientId !== auth.uid) {
      return NextResponse.json(
        {
          error:
            'Conflito de usuário: não é permitido criar agendamento em nome de outra conta.',
          code: 'FORBIDDEN_USER_MISMATCH',
        },
        {status: 403, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const cleanClientId = auth.uid;
    const cleanName = sanitizeTextField(clientName, 80);
    const cleanPhone = sanitizeTextField(clientPhone, 24);
    const cleanEmail = sanitizeTextField(clientEmail, 120);
    const cleanNotes = sanitizeTextField(notes, 400);

    if (cleanName.length < 2) {
      return NextResponse.json(
        {error: 'Por favor, informe seu nome completo.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    if (!isValidPhoneBR(cleanPhone)) {
      return NextResponse.json(
        {error: 'Por favor, informe um telefone válido com DDD.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    if (cleanEmail && !isValidEmailOptional(cleanEmail)) {
      return NextResponse.json(
        {error: 'O e-mail informado não parece válido.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    if (
      typeof serviceId !== 'string' ||
      !isSafeEntityId(serviceId) ||
      (barberId !== undefined &&
        (typeof barberId !== 'string' ||
          (barberId !== 'any' && !isSafeEntityId(barberId)))) ||
      typeof date !== 'string' ||
      !isValidISODate(date) ||
      typeof startTime !== 'string' ||
      !/^\d{2}:\d{2}$/.test(startTime)
    ) {
      return NextResponse.json(
        {
          error:
            'Selecione serviço, data e horário válidos para concluir o agendamento.',
        },
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const resolvedPaymentMethod: PaymentMethod =
      typeof paymentMethod === 'string' &&
      VALID_PAYMENT_METHODS.includes(paymentMethod as PaymentMethod)
        ? (paymentMethod as PaymentMethod)
        : 'pix';

    const result = createAppointment({
      clientId: cleanClientId,
      clientName: cleanName,
      clientPhone: cleanPhone,
      clientEmail: cleanEmail || undefined,
      serviceId,
      barberId: typeof barberId === 'string' && barberId ? barberId : 'any',
      date,
      startTime,
      notes: cleanNotes || undefined,
      paymentMethod: resolvedPaymentMethod,
    });

    if (result.error) {
      return NextResponse.json(
        {error: result.error},
        {status: result.status ?? 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    return NextResponse.json(
      {appointment: result.appointment},
      {status: 201, headers: {'Cache-Control': 'no-store'}}
    );
  } catch {
    return NextResponse.json(
      {error: 'Não foi possível processar a solicitação de agendamento.'},
      {status: 500, headers: {'Cache-Control': 'no-store'}}
    );
  }
}
