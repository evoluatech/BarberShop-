import {NextResponse} from 'next/server';
import {BARBERS, BARBERSHOP_INFO, CLIENT_REVIEWS, SERVICES} from '@/lib/data/seed';

export async function GET() {
  return NextResponse.json({
    shop: BARBERSHOP_INFO,
    services: SERVICES,
    barbers: BARBERS,
    reviews: CLIENT_REVIEWS,
  });
}
