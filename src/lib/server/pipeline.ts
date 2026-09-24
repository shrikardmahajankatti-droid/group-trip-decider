import "server-only";
import { db } from "./db";

// Generation pipeline. Phase 4 stub: records a run and moves the trip to
// review. Phases 5–6 fill in aggregation → Claude → context → veto → scoring
// → cards.

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
    // TODO(phase 5/6): real pipeline.
    await db()
      .from("runs")
      .update({ status: "done", constraints: { stub: true } })
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
