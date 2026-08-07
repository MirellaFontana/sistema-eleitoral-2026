import { NextResponse } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

// ponytail: in-memory, per-instance. Fine for Vercel Hobby; upgrade to Redis if throughput matters.
export function checkRateLimit(
  userId: string,
  maxRequests = 20,
  windowMs = 60_000,
): NextResponse | null {
  const now = Date.now();
  const bucket = buckets.get(userId);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(userId, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count++;
  if (bucket.count > maxRequests) {
    return NextResponse.json(
      { error: "Limite de requisições excedido. Tente novamente em 1 minuto." },
      { status: 429 },
    );
  }

  return null;
}
