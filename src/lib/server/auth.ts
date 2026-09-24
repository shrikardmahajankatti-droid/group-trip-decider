import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { env } from "./env";

// There are no accounts. The admin link and each participant's token ARE the
// credentials; the database only ever stores their SHA-256 hashes.

export const newToken = () => randomBytes(24).toString("base64url");

export const hashToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

export function tokenMatches(token: string | null | undefined, hash: string | null) {
  if (!token || !hash) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const participantCookieName = (slug: string) => `gtd_p_${slug}`;

export function participantCookieOptions(slug: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: `/t/${slug}`,
    maxAge: 60 * 60 * 24 * 180,
  };
}

export async function setParticipantCookie(slug: string, token: string) {
  (await cookies()).set(participantCookieName(slug), token, participantCookieOptions(slug));
}

export async function readParticipantToken(slug: string) {
  return (await cookies()).get(participantCookieName(slug))?.value ?? null;
}

/** Absolute base URL for links we show (share link, admin link, personal link). */
export async function baseUrl(): Promise<string> {
  const configured = env.appUrl();
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
