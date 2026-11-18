import {NextRequest, NextResponse} from 'next/server';
import {computeAvailability} from '@/lib/services/barbershop-store';
import {isSafeEntityId} from '@/lib/utils/security';

export async function GET(req: NextRequest) {
  const {searchParams} = new URL(req.url);
  const date = searchParams.get('date');
  const serviceId = searchParams.get('serviceId') ?? 'corte-degrade';
  const barberId = searchParams.get('barberId') ?? 'any';

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      {error: 'Parâmetro date inválido. Use o formato YYYY-MM-DD.'},
      {status: 400}
    );
  }

  if (!isSafeEntityId(serviceId) || (barberId !== 'any' && !isSafeEntityId(barberId))) {
    return NextResponse.json(
      {error: 'Parâmetros serviceId ou barberId inválidos.'},
      {status: 400}
    );
  }

  const availability = computeAvailability({date, serviceId, barberId});
  return NextResponse.json(availability);
}
