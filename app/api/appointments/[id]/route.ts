import {NextRequest, NextResponse} from 'next/server';
import {resolveAuthenticatedClient} from '@/lib/server/firebase-auth';
import {
  getAppointmentById,
  updateAppointmentStatus,
} from '@/lib/services/barbershop-store';
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
    return NextResponse.json({error: 'Agendamento inválido.'}, {status: 400});
  }

  const appointment = getAppointmentById(id);
  if (!appointment) {
    return NextResponse.json({error: 'Agendamento não encontrado.'}, {status: 404});
  }

  if (appointment.clientId !== auth.uid) {
    return NextResponse.json(
      {
        error: 'Acesso não autorizado a este agendamento.',
        code: 'FORBIDDEN_USER_MISMATCH',
      },
      {status: 403}
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
        {status: auth.status}
      );
    }

    const {id} = await context.params;
    if (!isSafeEntityId(id)) {
      return NextResponse.json({error: 'Agendamento inválido.'}, {status: 400});
    }

    const existing = getAppointmentById(id);
    if (!existing) {
      return NextResponse.json({error: 'Agendamento não encontrado.'}, {status: 404});
    }

    if (existing.clientId !== auth.uid) {
      return NextResponse.json(
        {
          error: 'Você só pode alterar os seus próprios agendamentos.',
          code: 'FORBIDDEN_USER_MISMATCH',
        },
        {status: 403}
      );
    }

    const body = await req.json();
    const {clientId, action, preferredDate, preferredTime, reason} = body ?? {};

    if (typeof clientId === 'string' && clientId.trim() && clientId !== auth.uid) {
      return NextResponse.json(
        {
          error: 'Identificador de cliente divergente da sessão autenticada.',
          code: 'FORBIDDEN_USER_MISMATCH',
        },
        {status: 403}
      );
    }

    if (action !== 'cancel' && action !== 'request_reschedule') {
      return NextResponse.json(
        {error: 'Ação inválida para atualização de agendamento.'},
        {status: 400}
      );
    }

    if (action === 'request_reschedule') {
      if (
        typeof preferredDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) ||
        typeof preferredTime !== 'string' ||
        !/^\d{2}:\d{2}$/.test(preferredTime)
      ) {
        return NextResponse.json(
          {
            error:
              'Informe uma data (YYYY-MM-DD) e horário (HH:mm) válidos para reagendar.',
          },
          {status: 400}
        );
      }
    }

    const result = updateAppointmentStatus({
      id,
      action,
      preferredDate,
      preferredTime,
      reason: sanitizeTextField(reason, 300) || undefined,
    });

    if (result.error) {
      return NextResponse.json({error: result.error}, {status: result.status ?? 400});
    }

    return NextResponse.json({appointment: result.appointment});
  } catch {
    return NextResponse.json(
      {error: 'Erro ao atualizar o agendamento.'},
      {status: 500}
    );
  }
}
