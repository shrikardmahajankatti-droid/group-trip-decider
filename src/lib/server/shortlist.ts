import "server-only";
import type { GroupConstraints } from "@/lib/logic/aggregate";
import type { PersonScore, VetoReason } from "@/lib/logic/types";
import type {
  StoredCandidateData,
  StoredCard,
  StoredCosts,
  StoredSource,
  StoredWeather,
  StoredWikivoyage,
} from "@/lib/pipelineTypes";
import { db } from "./db";
import { getLatestRun, type RunRow } from "./trips";

export type CandidateRow = {
  id: string;
  run_id: string;
  data: StoredCandidateData;
  weather: StoredWeather | null;
  wikivoyage: StoredWikivoyage | null;
  costs: StoredCosts | null;
  sources: StoredSource[] | null;
  vetoed: boolean;
  veto_reasons: VetoReason[] | null;
  scores: Record<string, PersonScore> | null;
  min_score: number | null;
  avg_score: number | null;
  rank: number | null;
};

export type OptionView = {
  id: string;
  position: number;
  card: StoredCard | null;
  candidate: CandidateRow;
  votes: number;
};

export type Shortlist = {
  run: RunRow;
  constraints: GroupConstraints | null;
  options: OptionView[];
  vetoed: CandidateRow[];
  /** Surviving candidates not on the shortlist, in rank order. */
  reserve: CandidateRow[];
};

export async function getShortlist(tripId: string): Promise<Shortlist | null> {
  const run = await getLatestRun(tripId);
  if (!run) return null;

  const [{ data: candidates }, { data: options }, { data: votes }] = await Promise.all([
    db().from("candidates").select("*").eq("run_id", run.id),
    db().from("options").select("*").eq("run_id", run.id).order("position"),
    db().from("votes").select("option_id").eq("trip_id", tripId),
  ]);

  const cands = (candidates ?? []).map((c) => ({
    ...c,
    min_score: c.min_score === null ? null : Number(c.min_score),
    avg_score: c.avg_score === null ? null : Number(c.avg_score),
  })) as CandidateRow[];
  const byId = new Map(cands.map((c) => [c.id, c]));
  const tally = new Map<string, number>();
  for (const v of votes ?? []) tally.set(v.option_id, (tally.get(v.option_id) ?? 0) + 1);

  const allOptions = (options ?? []) as {
    id: string;
    candidate_id: string;
    position: number;
    card: StoredCard | null;
    dropped: boolean;
  }[];
  const live = allOptions.filter((o) => !o.dropped && byId.has(o.candidate_id));
  const used = new Set(allOptions.map((o) => o.candidate_id));

  return {
    run,
    constraints: (run.constraints as GroupConstraints | null) ?? null,
    options: live.map((o) => ({
      id: o.id,
      position: o.position,
      card: o.card,
      candidate: byId.get(o.candidate_id)!,
      votes: tally.get(o.id) ?? 0,
    })),
    vetoed: cands.filter((c) => c.vetoed),
    reserve: cands
      .filter((c) => !c.vetoed && !used.has(c.id))
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
  };
}

export async function getViewerVote(participantId: string): Promise<string | null> {
  const { data } = await db().from("votes").select("option_id").eq("participant_id", participantId).maybeSingle();
  return data?.option_id ?? null;
}
