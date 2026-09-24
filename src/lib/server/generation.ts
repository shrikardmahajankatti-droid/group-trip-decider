import "server-only";
import { after } from "next/server";
import { shouldTrigger } from "@/lib/logic/trigger";
import { db } from "./db";
import { runPipeline } from "./pipeline";
import { getLatestRun, logEvent, type Trip } from "./trips";

const STUCK_AFTER_MS = 6 * 60 * 1000; // > Vercel Hobby maxDuration (300s)

/**
 * If the trigger condition holds, atomically move collecting → generating.
 * Only the caller whose UPDATE matched the row gets `true`, so the pipeline
 * starts exactly once even if several requests race.
 */
export async function claimGeneration(trip: Trip, now = new Date()): Promise<boolean> {
  if (trip.status !== "collecting") return false;

  const [{ count: participantCount }, { count: submittedCount }] = await Promise.all([
    db().from("participants").select("id", { count: "exact", head: true }).eq("trip_id", trip.id),
    db()
      .from("submissions")
      .select("participant_id, participants!inner(trip_id)", { count: "exact", head: true })
      .eq("participants.trip_id", trip.id),
  ]);

  const due = shouldTrigger({
    submittedCount: submittedCount ?? 0,
    participantCount: participantCount ?? 0,
    deadline: new Date(trip.deadline),
    now,
  });
  if (!due) return false;

  const { data } = await db()
    .from("trips")
    .update({ status: "generating" })
    .eq("id", trip.id)
    .eq("status", "collecting")
    .select("id");
  if (!data?.length) return false;

  await logEvent(trip.id, "trigger");
  return true;
}

/** Claim and, if this request won, run the pipeline after the response. */
export async function triggerIfDue(trip: Trip): Promise<boolean> {
  const claimed = await claimGeneration(trip);
  if (claimed) after(() => runPipeline(trip.id));
  return claimed;
}

/**
 * A function that died mid-run leaves the trip in "generating" forever.
 * After the max function lifetime has passed, fail the run and hand it to the
 * coordinator (who can re-run).
 */
export async function recoverStuckGeneration(trip: Trip): Promise<Trip> {
  if (trip.status !== "generating") return trip;
  const run = await getLatestRun(trip.id);
  const { data: lastTrigger } = await db()
    .from("events")
    .select("at")
    .eq("trip_id", trip.id)
    .in("type", ["trigger", "rerun"])
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const startedAt = Date.parse(run?.created_at ?? lastTrigger?.at ?? trip.created_at);
  if (Date.now() - startedAt < STUCK_AFTER_MS) return trip;

  if (run?.status === "running") {
    await db()
      .from("runs")
      .update({ status: "failed", error: "Timed out. Please re-run." })
      .eq("id", run.id);
  }
  await db().from("trips").update({ status: "review" }).eq("id", trip.id).eq("status", "generating");
  return { ...trip, status: "review" };
}
