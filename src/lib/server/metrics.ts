import "server-only";
import { db } from "./db";
import type { ParticipantWithStatus, Trip } from "./trips";

export type Metrics = {
  submitted: number;
  total: number;
  /** Hours from creation until everyone had submitted, if that happened before the deadline. */
  allInAfterHours: number | null;
  daysToLock: number | null;
  daysSoFar: number;
  /** Changes applied after lock. Always 0: the DB refuses them. */
  reversals: 0;
  blockedAttempts: number;
  lowestFitOnWinner: number | null;
};

export async function getMetrics(trip: Trip, participants: ParticipantWithStatus[]): Promise<Metrics> {
  const created = Date.parse(trip.created_at);
  const [{ data: firstTrigger }, { count: blocked }, winner] = await Promise.all([
    db()
      .from("events")
      .select("at")
      .eq("trip_id", trip.id)
      .eq("type", "trigger")
      .order("at")
      .limit(1)
      .maybeSingle(),
    db()
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", trip.id)
      .eq("type", "reversal_blocked"),
    trip.locked_option_id
      ? db().from("options").select("candidates(min_score)").eq("id", trip.locked_option_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const triggerAt = firstTrigger ? Date.parse(firstTrigger.at) : null;
  const allInBeforeDeadline = triggerAt !== null && triggerAt < Date.parse(trip.deadline);
  const cand = (winner.data as { candidates: { min_score: number | null } | { min_score: number | null }[] } | null)
    ?.candidates;
  const minScore = Array.isArray(cand) ? cand[0]?.min_score : cand?.min_score;

  return {
    submitted: participants.filter((p) => p.submitted).length,
    total: participants.length,
    allInAfterHours: allInBeforeDeadline ? Math.round((triggerAt! - created) / 3_600_000) : null,
    daysToLock: trip.locked_at ? Math.max(1, Math.ceil((Date.parse(trip.locked_at) - created) / 86_400_000)) : null,
    daysSoFar: Math.max(1, Math.ceil((Date.now() - created) / 86_400_000)),
    reversals: 0,
    blockedAttempts: blocked ?? 0,
    lowestFitOnWinner: minScore === null || minScore === undefined ? null : Number(minScore),
  };
}
