import "server-only";
import { aggregate } from "@/lib/logic/aggregate";
import { todayIST } from "@/lib/logic/dates";
import { evaluateCandidates } from "@/lib/logic/rank";
import type { CandidateInput, Person } from "@/lib/logic/types";
import type { StageId } from "@/lib/pipelineStages";
import type {
  RunTrace,
  StoredCandidateData,
  StoredCosts,
  StoredSource,
  StoredWeather,
  StoredWikivoyage,
} from "@/lib/pipelineTypes";
import { extractCosts } from "./costs";
import { db } from "./db";
import { mapLimit } from "./http";
import { llmProvider } from "./llm";
import { getWeather } from "./openmeteo";
import { loadPeople } from "./people";
import { proposeCandidates } from "./step1Candidates";
import { writeCards, type CardInput } from "./step2Cards";
import { getWikivoyage } from "./wikivoyage";

// Generation pipeline:
//   aggregate (code) → step 1 candidates (AI) → weather + Wikivoyage per
//   candidate → indicative costs from Wikivoyage text (AI, code-verified) →
//   hard veto + scoring + ranking (code) → step 2 option cards (AI).

class PipelineError extends Error {}

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
    await generate(tripId, run.id);
    await db().from("runs").update({ status: "done" }).eq("id", run.id).eq("status", "running");
  } catch (e) {
    const message =
      e instanceof PipelineError ? e.message : "Something went wrong while generating options. Please re-run.";
    console.error(`[pipeline] run ${run.id} failed: ${e instanceof Error ? e.message : e}`);
    await db().from("runs").update({ status: "failed", error: message.slice(0, 500) }).eq("id", run.id);
  } finally {
    await db()
      .from("trips")
      .update({ status: "review", generated_at: new Date().toISOString() })
      .eq("id", tripId)
      .eq("status", "generating");
  }
}

/** Records the current stage (shown live on both pages) and times each stage. */
function stageTracker(runId: string) {
  const ms: Record<string, number> = {};
  const started = Date.now();
  let current: { id: StageId; at: number } | null = null;
  return {
    ms,
    started,
    async enter(id: StageId) {
      const now = Date.now();
      if (current) ms[current.id] = now - current.at;
      current = { id, at: now };
      await db().from("runs").update({ stage: id }).eq("id", runId);
    },
  };
}

async function generate(tripId: string, runId: string) {
  const stages = stageTracker(runId);
  const models: RunTrace["models"] = {};
  await stages.enter("aggregate");
  const { data: trip } = await db().from("trips").select("trip_nights").eq("id", tripId).single();
  const nights: number = trip?.trip_nights ?? 3;
  const people = await loadPeople(tripId);
  const constraints = aggregate(people, nights, todayIST());
  await db().from("runs").update({ constraints }).eq("id", runId);

  if (constraints.submittedIds.length === 0) throw new PipelineError("Nobody submitted preferences.");
  if (constraints.windows.length === 0) {
    throw new PipelineError(
      `No one has a free date range of at least ${nights} nights, so there is no window to plan around.`,
    );
  }

  // Step 1: candidates.
  await stages.enter("step1");
  const step1Meta: { model?: string } = {};
  let proposals: StoredCandidateData[];
  try {
    proposals = await proposeCandidates(people, constraints, nights, step1Meta);
    models.step1 = step1Meta.model;
  } catch (e) {
    console.error(`[pipeline] step 1 failed: ${e instanceof Error ? e.message : e}`);
    throw new PipelineError("The AI couldn't propose destinations right now. Please re-run in a minute.");
  }

  // Free context per candidate, in parallel with a small concurrency cap.
  await stages.enter("context");
  const context = await mapLimit(proposals, 4, async (c) => {
    const [weather, wikivoyage] = await Promise.all([
      getWeather(c.lat, c.lon, c.suggested_window).catch((e) => {
        console.warn(`[pipeline] weather failed for ${c.name}: ${e instanceof Error ? e.message : e}`);
        return null;
      }),
      getWikivoyage(c.wikivoyage_title || c.name).catch((e) => {
        console.warn(`[pipeline] wikivoyage failed for ${c.name}: ${e instanceof Error ? e.message : e}`);
        return null;
      }),
    ]);
    return { weather, wikivoyage };
  });

  // Indicative costs from the Wikivoyage text (one batched AI call).
  await stages.enter("costs");
  const costsMeta: { model?: string } = {};
  const refs = proposals.map((_, i) => `D${i + 1}`);
  const costMap = await extractCosts(
    proposals.flatMap((c, i) => {
      const wv = context[i]?.wikivoyage;
      return wv ? [{ ref: refs[i], name: c.name, pageUrl: wv.url, getIn: wv.getIn, sleep: wv.sleep }] : [];
    }),
    people,
    nights,
    costsMeta,
  );
  models.costs = costsMeta.model;

  // Hard veto + scoring + ranking, all in code.
  await stages.enter("scoring");
  const inputs: CandidateInput[] = proposals.map((c, i) => {
    const costs = costMap.get(refs[i])?.costs ?? null;
    return {
      id: refs[i],
      name: c.name,
      country: c.country,
      destinationTypes: c.destination_types,
      attributeTags: c.attribute_tags,
      window: c.suggested_window,
      weather: context[i]?.weather ?? null,
      costs: costs && costs.status !== "unavailable" ? { travel: costs.travel, stay: costs.stay } : null,
    };
  });
  const evaluation = evaluateCandidates(inputs, people);

  // Persist every candidate (vetoed ones too, so the coordinator sees why).
  const rows = proposals.map((c, i) => {
    const ev = evaluation.candidates[i];
    const wv = context[i]?.wikivoyage ?? null;
    const cost = costMap.get(refs[i]) ?? {
      costs: { travel: {}, stay: null, status: "unavailable" } as StoredCosts,
      sources: [] as StoredSource[],
    };
    const weather: StoredWeather | null = context[i]?.weather ?? null;
    const wikivoyage: StoredWikivoyage | null = wv && {
      title: wv.title,
      url: wv.url,
      intro: wv.intro,
      getIn: wv.getIn.slice(0, 1500),
    };
    return {
      run_id: runId,
      data: c,
      weather,
      wikivoyage,
      costs: cost.costs,
      sources: cost.sources,
      vetoed: ev.vetoed,
      veto_reasons: ev.vetoReasons,
      scores: ev.scores,
      min_score: ev.minScore,
      avg_score: ev.avgScore,
      rank: ev.rank,
    };
  });
  const { data: saved, error } = await db().from("candidates").insert(rows).select("id");
  if (error || !saved) throw new Error(`saving candidates failed: ${error?.message}`);
  const dbId = (ref: string) => saved[refs.indexOf(ref)].id as string;

  const trace: RunTrace = {
    provider: llmProvider(),
    models,
    submitted: constraints.submittedIds.length,
    noData: constraints.noDataIds.length,
    windows: constraints.windows.length,
    fullOverlap: constraints.fullOverlap,
    budgetFloorInr: constraints.budgetFloorInr,
    hardNos: constraints.hardNos.length,
    candidates: proposals.length,
    weatherOk: context.filter((c) => c?.weather).length,
    wikivoyageOk: context.filter((c) => c?.wikivoyage).length,
    costsSourced: rows.filter((r) => r.costs.status === "wikivoyage").length,
    vetoed: rows
      .filter((r) => r.vetoed)
      .map((r) => ({ name: r.data.name, reasons: r.veto_reasons.map((v) => `${v.name} won't do ${v.tag}`) })),
    survivors: rows.filter((r) => !r.vetoed).length,
    shortlisted: evaluation.shortlist.length,
    ms: stages.ms,
    totalMs: 0,
  };
  const finish = async () => {
    await stages.enter("done");
    trace.totalMs = Date.now() - stages.started;
    await db().from("runs").update({ trace }).eq("id", runId);
  };

  if (evaluation.shortlist.length === 0) return finish(); // all vetoed: the review page explains

  // Step 2: option cards for the shortlist.
  const cardInputs: CardInput[] = evaluation.shortlist.map((ref) => {
    const i = refs.indexOf(ref);
    return {
      ref,
      data: proposals[i],
      weather: rows[i].weather,
      wikivoyage: rows[i].wikivoyage,
      costs: rows[i].costs,
      scores: rows[i].scores,
    };
  });
  await stages.enter("step2");
  const step2Meta: { model?: string } = {};
  const cards = await writeCards(cardInputs, people, step2Meta).catch((e) => {
    console.error(`[pipeline] step 2 failed: ${e instanceof Error ? e.message : e}`);
    return null;
  });

  const { error: optErr } = await db()
    .from("options")
    .insert(
      evaluation.shortlist.map((ref, position) => ({
        run_id: runId,
        candidate_id: dbId(ref),
        position: position + 1,
        card: cards?.get(ref) ?? null,
      })),
    );
  if (optErr) throw new Error(`saving options failed: ${optErr.message}`);
  models.step2 = step2Meta.model;
  await finish();
}

/** Re-write one option's card (used when the coordinator drops an option). */
export async function writeSingleCard(
  people: Person[],
  candidate: Omit<CardInput, "ref">,
) {
  const cards = await writeCards([{ ref: "D1", ...candidate }], people);
  return cards.get("D1") ?? null;
}
