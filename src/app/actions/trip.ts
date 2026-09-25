"use server";

import { randomBytes } from "node:crypto";
import { istLocalToDate } from "@/lib/logic/dates";
import { createTripSchema } from "@/lib/schemas";
import { baseUrl, hashToken, newToken, setParticipantCookie } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { allow, SLOW_DOWN } from "@/lib/server/ratelimit";
import { logEvent } from "@/lib/server/trips";

export type CreateTripState = {
  error?: string;
  created?: { slug: string; groupUrl: string; adminUrl: string };
};

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");
  const suffix = randomBytes(4).toString("hex").slice(0, 6);
  return `${base || "trip"}-${suffix}`;
}

export async function createTrip(
  _prev: CreateTripState,
  formData: FormData,
): Promise<CreateTripState> {
  if (!(await allow("createTrip"))) return { error: SLOW_DOWN };
  const parsed = createTripSchema.safeParse({
    tripName: formData.get("tripName"),
    coordinatorName: formData.get("coordinatorName"),
    friendNames: formData.getAll("friendNames"),
    deadlineLocal: formData.get("deadlineLocal"),
    tripNights: formData.get("tripNights"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;

  const deadline = istLocalToDate(input.deadlineLocal);
  if (!deadline) return { error: "Set a valid response deadline" };
  const now = Date.now();
  if (deadline.getTime() <= now + 10 * 60 * 1000)
    return { error: "The deadline must be at least 10 minutes from now" };
  if (deadline.getTime() > now + 60 * 86_400_000)
    return { error: "The deadline must be within 60 days" };

  const adminToken = newToken();
  let trip: { id: string; slug: string } | null = null;
  for (let attempt = 0; attempt < 3 && !trip; attempt++) {
    const { data, error } = await db()
      .from("trips")
      .insert({
        slug: slugify(input.tripName),
        name: input.tripName,
        coordinator_name: input.coordinatorName,
        deadline: deadline.toISOString(),
        trip_nights: input.tripNights,
        admin_token_hash: hashToken(adminToken),
      })
      .select("id, slug")
      .single();
    if (data) trip = data;
    else if (error && error.code !== "23505") {
      console.error(`[createTrip] insert failed: ${error.message}`);
      return { error: "Could not create the trip. Please try again." };
    }
  }
  if (!trip) return { error: "Could not create the trip. Please try again." };

  // The coordinator is a participant too, and is signed in to their own row
  // straight away so they can fill in their preferences.
  const coordinatorToken = newToken();
  const { error: pErr } = await db()
    .from("participants")
    .insert([
      {
        trip_id: trip.id,
        name: input.coordinatorName,
        is_coordinator: true,
        token_hash: hashToken(coordinatorToken),
        claimed_at: new Date().toISOString(),
      },
      ...input.friendNames.map((name) => ({
        trip_id: trip.id,
        name,
        is_coordinator: false,
        token_hash: null,
        claimed_at: null,
      })),
    ]);
  if (pErr) {
    console.error(`[createTrip] participants insert failed: ${pErr.message}`);
    await db().from("trips").delete().eq("id", trip.id);
    return { error: "Could not create the trip. Please try again." };
  }

  await setParticipantCookie(trip.slug, coordinatorToken);
  await logEvent(trip.id, "created");

  const base = await baseUrl();
  return {
    created: {
      slug: trip.slug,
      groupUrl: `${base}/t/${trip.slug}`,
      adminUrl: `${base}/t/${trip.slug}/admin?k=${adminToken}`,
    },
  };
}
