import { NextResponse, type NextRequest } from "next/server";
import { hashToken, participantCookieName, participantCookieOptions } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { allow } from "@/lib/server/ratelimit";
import { getTripBySlug } from "@/lib/server/trips";

/** Personal edit link: /t/{slug}/me?p={token} restores the claim on a new device. */
export async function GET(request: NextRequest, ctx: RouteContext<"/t/[slug]/me">) {
  const { slug } = await ctx.params;
  const token = request.nextUrl.searchParams.get("p");
  const trip = await getTripBySlug(slug);
  if (!trip) return NextResponse.redirect(new URL("/", request.url));
  if (!(await allow("personalLink"))) return NextResponse.redirect(new URL(`/t/${slug}?e=slow`, request.url));

  const { data } = token
    ? await db()
        .from("participants")
        .select("id")
        .eq("trip_id", trip.id)
        .eq("token_hash", hashToken(token))
        .maybeSingle()
    : { data: null };

  const res = NextResponse.redirect(new URL(`/t/${slug}${data ? "" : "?e=link"}`, request.url));
  if (data && token) res.cookies.set(participantCookieName(slug), token, participantCookieOptions(slug));
  return res;
}
