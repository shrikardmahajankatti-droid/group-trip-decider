import "server-only";
import { aggregate } from "@/lib/logic/aggregate";
import { todayIST } from "@/lib/logic/dates";
import { db } from "./db";
import { loadPeople } from "./people";

// Generation pipeline. So far: aggregation (code). Phase 6 adds Claude →
// context → veto/scoring (src/lib/logic/rank.ts) → cards.

export async function runPipeline(tripId: string): Promise<void> {
  const { data: run, error } = await db()
    .from("runs")
    .insert({ trip_id: tripId, status: "running" })
    .select("id")
    .single();
  if (error || !run) {
    console.error(`[pipeline] could not create run: ${error?.message}`);
    await db().from("trips").update({ status: "review" }).eq("id", tripId).eq("status", "generating");
    return;
  }

  try {
    const { data: trip } = await db().from("trips").select("trip_nights").eq("id", tripId).single();
    const people = await loadPeople(tripId);
    const constraints = aggregate(people, trip?.trip_nights ?? 3, todayIST());

    // TODO(phase 6): candidates, context, veto + scoring, cards.
    await db()
      .from("runs")
      .update({ status: "done", constraints })
      .eq("id", run.id)
      .eq("status", "running"); // a concurrent edit may have marked it stale
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[pipeline] run ${run.id} failed: ${message}`);
    await db().from("runs").update({ status: "failed", error: message.slice(0, 500) }).eq("id", run.id);
  } finally {
    await db()
      .from("trips")
      .update({ status: "review", generated_at: new Date().toISOString() })
      .eq("id", tripId)
      .eq("status", "generating");
  }
}
