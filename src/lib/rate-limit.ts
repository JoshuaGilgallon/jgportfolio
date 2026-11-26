import "server-only";

// in memory, only works for a single instance
const WINDOW_MS = 15 * 60 * 1000;
const PER_IP = 5;
const GLOBAL = 30;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function hit(key: string, limit: number, now: number) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

// false once over the ip or global limit
export function allowSignInAttempt(ip: string) {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  }
  const perIp = hit(`ip:${ip}`, PER_IP, now);
  const global = hit("global", GLOBAL, now);
  return perIp && global;
}

export function clearSignInAttempts(ip: string) {
  buckets.delete(`ip:${ip}`);
}
