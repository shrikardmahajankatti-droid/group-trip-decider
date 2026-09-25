"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { loadPeople } from "@/lib/server/people";
import { runPipeline, writeSingleCard } from "@/lib/server/pipeline";
import { allowKey } from "@/lib/server/ratelimit";
import { getShortlist } from "@/lib/server/shortlist";
import { isUuid } from "@/lib/server/validate";
import { getTripBySlug, isAdmin, logEvent, type Trip } from "@/lib/server/trips";

export type AdminState = { error?: string; ok?: string };

async function requireAdmin(slug: string, key: string): Promise<Trip> {
  const trip = await getTripBySlug(slug);
  if (!trip || !isAdmin(trip, key)) redirect("/");
  return trip;
}

function done(slug: string, ok?: string): AdminState {
  revalidatePath(`/t/${slug}/admin`);
  revalidatePath(`/t/${slug}`);
  return { ok };
}

/** Free up a name so its owner can claim it again from a new phone. */
export async function resetClaim(slug: string, key: string, participantId: string): Promise<void> {
  const trip = await requireAdmin(slug, key);
  if (trip.status === "locked" || !isUuid(participantId)) return;
  await db()
    .from("participants")
    .update({ token_hash: null, claimed_at: null })
    .eq("id", participantId)
    .eq("trip_id", trip.id);
  done(slug);
}

/** Drop an option; the next-ranked surviving candidate fills the slot and gets its own card. */
export async function dropOption(slug: string, key: string, optionId: string): Promise<AdminState> {
  const trip = await requireAdmin(slug, key);
  if (trip.status !== "review") return { error: "Options can only be dropped while you're reviewing." };
  if (!isUuid(optionId)) return { error: "That option is no longer on the shortlist." };
  if (!allowKey("drop", trip.id)) return { error: "That's a lot of drops. Wait a few minutes, or re-run." };

  const shortlist = await getShortlist(trip.id);
  const option = shortlist?.options.find((o) => o.id === optionId);
  if (!shortlist || !option) return { error: "That option is no longer on the shortlist." };

  const { data: dropped } = await db()
    .from("options")
    .update({ dropped: true })
    .eq("id", optionId)
    .eq("dropped", false)
    .select("id");
  if (!dropped?.length) return done(slug);

  const next = shortlist.reserve[0];
  if (!next) return done(slug, "Option dropped. There are no more surviving candidates to replace it.");

  const people = await loadPeople(trip.id);
  const card = await writeSingleCard(people, {
    data: next.data,
    weather: next.weather,
    wikivoyage: next.wikivoyage,
    costs: next.costs,
    scores: next.scores ?? {},
  }).catch((e) => {
    console.error(`[dropOption] card failed: ${e instanceof Error ? e.message : e}`);
    return null;
  });

  const { error } = await db().from("options").insert({
    run_id: shortlist.run.id,
    candidate_id: next.id,
    position: option.position,
    card,
  });
  if (error) return { error: "Couldn't add the replacement option. Try re-running." };
  return done(slug, `Dropped. ${next.data.name} takes its place.`);
}

/** Re-run the full pipeline. After publish this sends the trip back to review and clears votes. */
export async function rerun(slug: string, key: string): Promise<AdminState> {
  const trip = await requireAdmin(slug, key);
  if (trip.status !== "review" && trip.status !== "published") {
    return { error: trip.status === "locked" ? "The trip is locked." : "Options are already being generated." };
  }
  if (!allowKey("rerun", trip.id)) {
    return { error: "You've re-run a few times in a row. Please wait a few minutes (this keeps the free AI quota safe)." };
  }

  const { data } = await db()
    .from("trips")
    .update({ status: "generating", published_at: null })
    .eq("id", trip.id)
    .eq("status", trip.status)
    .select("id");
  if (!data?.length) return { error: "The trip changed while you were looking. Refresh and try again." };

  if (trip.status === "published") await db().from("votes").delete().eq("trip_id", trip.id);
  await logEvent(trip.id, "rerun");
  after(() => runPipeline(trip.id));
  return done(slug, "Re-running. New options in a minute or two.");
}

export async function publish(slug: string, key: string): Promise<AdminState> {
  const trip = await requireAdmin(slug, key);
  if (trip.status !== "review") return { error: "Only a reviewed shortlist can be published." };
  const shortlist = await getShortlist(trip.id);
  if (!shortlist?.options.length) return { error: "There are no options to publish. Re-run first." };

  const { data } = await db()
    .from("trips")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", trip.id)
    .eq("status", "review")
    .select("id");
  if (!data?.length) return { error: "The trip changed while you were looking. Refresh and try again." };
  await logEvent(trip.id, "publish");
  return done(slug, "Published. Your group can now see the options and vote.");
}

export async function lockTrip(slug: string, key: string, optionId: string): Promise<AdminState> {
  const trip = await requireAdmin(slug, key);
  if (trip.status !== "published") return { error: "You can lock once the options are published." };
  if (!isUuid(optionId)) return { error: "That option isn't on the shortlist." };
  const shortlist = await getShortlist(trip.id);
  if (!shortlist?.options.some((o) => o.id === optionId)) return { error: "That option isn't on the shortlist." };

  const { data } = await db()
    .from("trips")
    .update({ status: "locked", locked_option_id: optionId, locked_at: new Date().toISOString() })
    .eq("id", trip.id)
    .eq("status", "published")
    .select("id");
  if (!data?.length) return { error: "The trip changed while you were looking. Refresh and try again." };
  await logEvent(trip.id, "lock");
  return done(slug, "Locked. Nothing can change now.");
}
