import {NextRequest, NextResponse} from 'next/server';
import {computeAvailability} from '@/lib/services/barbershop-store';
import {isValidISODate} from '@/lib/utils/formatters';
import {isSafeEntityId} from '@/lib/utils/security';

export async function GET(req: NextRequest) {
  const {searchParams} = new URL(req.url);
  const date = searchParams.get('date');
  const serviceId = searchParams.get('serviceId') ?? 'corte-degrade';
  const barberId = searchParams.get('barberId') ?? 'any';

  if (!date || !isValidISODate(date)) {
    return NextResponse.json(
      {error: 'Parâmetro date inválido. Use o formato YYYY-MM-DD com uma data real.'},
      {status: 400, headers: {'Cache-Control': 'no-store'}}
    );
  }

  if (!isSafeEntityId(serviceId) || (barberId !== 'any' && !isSafeEntityId(barberId))) {
    return NextResponse.json(
      {error: 'Parâmetros serviceId ou barberId inválidos.'},
      {status: 400, headers: {'Cache-Control': 'no-store'}}
    );
  }

  const availability = computeAvailability({date, serviceId, barberId});
  return NextResponse.json(availability, {
    headers: {'Cache-Control': 'no-store'},
  });
}
