import "server-only";
import { headers } from "next/headers";

// Best-effort in-memory sliding-window limiter. On Vercel each function
// instance has its own memory, so this caps bursts per instance; that's
// enough for a five-person trip and keeps the free Gemini quota safe.

const buckets = new Map<string, number[]>();
const MAX_KEYS = 5000;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** true = allowed; false = over the limit. */
export function hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > MAX_KEYS) buckets.clear();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

export const LIMITS = {
  createTrip: { limit: 5, windowMs: 10 * 60_000 },
  claim: { limit: 10, windowMs: 60_000 },
  submit: { limit: 10, windowMs: 60_000 },
  vote: { limit: 10, windowMs: 60_000 },
  personalLink: { limit: 20, windowMs: 60_000 },
  // AI-backed admin actions: protect the free Gemini quota.
  rerun: { limit: 3, windowMs: 10 * 60_000 },
  drop: { limit: 6, windowMs: 10 * 60_000 },
} as const;

/** Rate-limit by client IP (and an optional extra key such as a trip or participant). */
export async function allow(name: keyof typeof LIMITS, extra = ""): Promise<boolean> {
  const { limit, windowMs } = LIMITS[name];
  return hit(`${name}:${await clientIp()}:${extra}`, limit, windowMs);
}

/** Rate-limit by a key only (e.g. per trip, regardless of IP). */
export function allowKey(name: keyof typeof LIMITS, key: string): boolean {
  const { limit, windowMs } = LIMITS[name];
  return hit(`${name}:key:${key}`, limit, windowMs);
}

export const SLOW_DOWN = "Too many attempts. Please wait a minute and try again.";
