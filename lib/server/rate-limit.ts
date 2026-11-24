import {NextRequest, NextResponse} from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_BUCKET_ENTRIES = 5000;
const rateBuckets = new Map<string, RateLimitEntry>();
let lastPruneAt = 0;

function pruneExpiredEntries(now: number): void {
  if (now - lastPruneAt < 30_000 && rateBuckets.size < MAX_BUCKET_ENTRIES) {
    return;
  }
  lastPruneAt = now;
  for (const [key, entry] of rateBuckets) {
    if (entry.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }
  if (rateBuckets.size >= MAX_BUCKET_ENTRIES) {
    const excess = rateBuckets.size - Math.floor(MAX_BUCKET_ENTRIES * 0.8);
    let removed = 0;
    for (const key of rateBuckets.keys()) {
      rateBuckets.delete(key);
      removed++;
      if (removed >= excess) break;
    }
  }
}

export function extractClientIpKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp.slice(0, 64);
  return 'unknown-client';
}

export function enforceRateLimit(
  req: NextRequest,
  params: {
    bucket: string;
    maxRequests: number;
    windowMs: number;
  }
): NextResponse | null {
  const now = Date.now();
  pruneExpiredEntries(now);

  const clientKey = extractClientIpKey(req);
  const key = `${params.bucket}:${clientKey}`;
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, {
      count: 1,
      resetAt: now + params.windowMs,
    });
    return null;
  }

  current.count += 1;
  if (current.count <= params.maxRequests) {
    return null;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return NextResponse.json(
    {
      error: 'Muitas solicitações simultâneas no momento. Aguarde alguns segundos e tente novamente.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}
