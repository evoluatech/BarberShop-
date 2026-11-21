import {NextRequest, NextResponse} from 'next/server';
import {resolveAuthenticatedClient} from '@/lib/server/firebase-auth';
import {
  getAppointmentById,
  updateAppointmentStatus,
} from '@/lib/services/barbershop-store';
import {isValidISODate} from '@/lib/utils/formatters';
import {isSafeEntityId, sanitizeTextField} from '@/lib/utils/security';

export async function GET(req: NextRequest, context: {params: Promise<{id: string}>}) {
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

  const {id} = await context.params;
  if (!isSafeEntityId(id)) {
    return NextResponse.json(
      {error: 'Agendamento inválido.'},
      {status: 400, headers: {'Cache-Control': 'no-store'}}
    );
  }

  const appointment = getAppointmentById(id);
  if (!appointment) {
    return NextResponse.json(
      {error: 'Agendamento não encontrado.'},
      {status: 404, headers: {'Cache-Control': 'no-store'}}
    );
  }

  if (appointment.clientId !== auth.uid) {
    return NextResponse.json(
      {
        error: 'Acesso não autorizado a este agendamento.',
        code: 'FORBIDDEN_USER_MISMATCH',
      },
      {status: 403, headers: {'Cache-Control': 'no-store'}}
    );
  }

  return NextResponse.json(
    {appointment},
    {headers: {'Cache-Control': 'no-store'}}
  );
}

export async function PATCH(
  req: NextRequest,
  context: {params: Promise<{id: string}>}
) {
  try {
    const auth = await resolveAuthenticatedClient(req);
    if (!auth.ok) {
      return NextResponse.json(
        {error: auth.error, code: auth.code},
        {status: auth.status, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const {id} = await context.params;
    if (!isSafeEntityId(id)) {
      return NextResponse.json(
        {error: 'Agendamento inválido.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const existing = getAppointmentById(id);
    if (!existing) {
      return NextResponse.json(
        {error: 'Agendamento não encontrado.'},
        {status: 404, headers: {'Cache-Control': 'no-store'}}
      );
    }

    if (existing.clientId !== auth.uid) {
      return NextResponse.json(
        {
          error: 'Você só pode alterar os seus próprios agendamentos.',
          code: 'FORBIDDEN_USER_MISMATCH',
        },
        {status: 403, headers: {'Cache-Control': 'no-store'}}
      );
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json(
          {error: 'Corpo da requisição inválido para atualização.'},
          {status: 400, headers: {'Cache-Control': 'no-store'}}
        );
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        {error: 'Requisição JSON inválida para atualização.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const {clientId, action, preferredDate, preferredTime, reason} = body;

    if (typeof clientId === 'string' && clientId.trim() && clientId !== auth.uid) {
      return NextResponse.json(
        {
          error: 'Identificador de cliente divergente da sessão autenticada.',
          code: 'FORBIDDEN_USER_MISMATCH',
        },
        {status: 403, headers: {'Cache-Control': 'no-store'}}
      );
    }

    if (action !== 'cancel' && action !== 'request_reschedule') {
      return NextResponse.json(
        {error: 'Ação inválida para atualização de agendamento.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const safePreferredDate =
      typeof preferredDate === 'string' ? preferredDate : undefined;
    const safePreferredTime =
      typeof preferredTime === 'string' ? preferredTime : undefined;

    if (action === 'request_reschedule') {
      if (
        !safePreferredDate ||
        !isValidISODate(safePreferredDate) ||
        !safePreferredTime ||
        !/^\d{2}:\d{2}$/.test(safePreferredTime)
      ) {
        return NextResponse.json(
          {
            error:
              'Informe uma data (YYYY-MM-DD) e horário (HH:mm) válidos para reagendar.',
          },
          {status: 400, headers: {'Cache-Control': 'no-store'}}
        );
      }
    }

    const result = updateAppointmentStatus({
      id,
      action,
      preferredDate: safePreferredDate,
      preferredTime: safePreferredTime,
      reason: sanitizeTextField(reason, 300) || undefined,
    });

    if (result.error) {
      return NextResponse.json(
        {error: result.error},
        {status: result.status ?? 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    return NextResponse.json(
      {appointment: result.appointment},
      {headers: {'Cache-Control': 'no-store'}}
    );
  } catch {
    return NextResponse.json(
      {error: 'Erro ao atualizar o agendamento.'},
      {status: 500, headers: {'Cache-Control': 'no-store'}}
    );
  }
}
