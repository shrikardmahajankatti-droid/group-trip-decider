"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayIST } from "@/lib/logic/dates";
import { submissionSchema } from "@/lib/schemas";
import { hashToken, newToken, setParticipantCookie } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { triggerIfDue } from "@/lib/server/generation";
import { getShortlist } from "@/lib/server/shortlist";
import {
  friendlyDbError,
  getTripBySlug,
  getViewer,
  logEvent,
} from "@/lib/server/trips";

/** Claim a name on this device. First come, first served; Riya can reset. */
export async function claimName(slug: string, participantId: string): Promise<void> {
  const trip = await getTripBySlug(slug);
  if (!trip) redirect("/");
  if (trip.status === "locked") redirect(`/t/${slug}?e=locked`);

  const token = newToken();
  const { data } = await db()
    .from("participants")
    .update({ token_hash: hashToken(token), claimed_at: new Date().toISOString() })
    .eq("id", participantId)
    .eq("trip_id", trip.id)
    .is("token_hash", null) // atomic: only if nobody has claimed it
    .select("id");
  if (!data?.length) redirect(`/t/${slug}?e=taken`);

  await setParticipantCookie(slug, token);
  revalidatePath(`/t/${slug}`);
}

export type SubmitState = { error?: string; savedAt?: string };

export async function submitPreferences(
  slug: string,
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const trip = await getTripBySlug(slug);
  if (!trip) return { error: "Trip not found" };
  if (trip.status === "locked") {
    await logEvent(trip.id, "reversal_blocked");
    return { error: "This trip is locked, so answers can't be changed." };
  }

  const viewer = await getViewer(trip);
  if (!viewer) return { error: "Choose your name first." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Could not read the form. Please try again." };
  }
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;

  const today = todayIST();
  if (input.dateWindows.some((w) => w.end < today))
    return { error: "Date windows must be in the future" };

  const { error } = await db()
    .from("submissions")
    .upsert({
      participant_id: viewer.participant.id,
      budget_cap_inr: input.budgetCapInr,
      starting_city: input.startingCity,
      start_lat: input.startLat,
      start_lon: input.startLon,
      date_windows: input.dateWindows,
      destination_types: input.destinationTypes,
      wont_do: input.wontDo,
      wont_do_note: input.wontDoNote || null,
      updated_at: new Date().toISOString(),
    });
  if (error) return { error: friendlyDbError(error.message) };

  await logEvent(trip.id, "submission");

  // An edit after a shortlist exists (or is being built) makes it stale;
  // the coordinator sees a banner with a Re-run button.
  if (trip.status !== "collecting") {
    await db()
      .from("runs")
      .update({ status: "stale" })
      .eq("trip_id", trip.id)
      .in("status", ["running", "done"]);
  }

  await triggerIfDue(trip);
  revalidatePath(`/t/${slug}`);
  return { savedAt: new Date().toISOString() };
}

export type VoteState = { error?: string; ok?: string };

/** One vote per participant, final once cast (unique constraint + DB trigger). */
export async function castVote(slug: string, optionId: string): Promise<VoteState> {
  const trip = await getTripBySlug(slug);
  if (!trip) return { error: "Trip not found" };
  if (trip.status === "locked") {
    await logEvent(trip.id, "reversal_blocked");
    return { error: "Voting has closed. The trip is locked." };
  }
  if (trip.status !== "published") return { error: "Voting opens once the options are published." };

  const viewer = await getViewer(trip);
  if (!viewer) return { error: "Choose your name first." };

  const shortlist = await getShortlist(trip.id);
  if (!shortlist?.options.some((o) => o.id === optionId)) return { error: "That option isn't on the shortlist." };

  const { error } = await db()
    .from("votes")
    .insert({ trip_id: trip.id, participant_id: viewer.participant.id, option_id: optionId });
  if (error) {
    if (error.code === "23505") return { error: "You've already voted. Votes are final." };
    return { error: friendlyDbError(error.message) };
  }
  revalidatePath(`/t/${slug}`);
  return { ok: "Vote recorded ✓" };
}
