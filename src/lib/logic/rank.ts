import { SHORTLIST_SIZE } from "./constants";
import { scorePerson } from "./scoring";
import type { CandidateInput, Person, PersonScore, VetoReason } from "./types";
import { vetoReasons } from "./veto";

export type EvaluatedCandidate = {
  id: string;
  vetoed: boolean;
  vetoReasons: VetoReason[];
  scores: Record<string, PersonScore>;
  minScore: number | null;
  avgScore: number | null;
  /** 1-based rank among survivors; null if vetoed. */
  rank: number | null;
};

export type Evaluation = {
  candidates: EvaluatedCandidate[];
  /** Ids of the top survivors, best first (at most SHORTLIST_SIZE). */
  shortlist: string[];
  /** Survivors after the shortlist, in rank order (fill slots when an option is dropped). */
  reserve: string[];
};

/**
 * Hard veto first (in code, whatever the AI suggested), then score every
 * person × surviving candidate, then rank by the lowest person's score and
 * then the average. Ties keep the AI's original order.
 */
export function evaluateCandidates(candidates: CandidateInput[], people: Person[]): Evaluation {
  const evaluated: EvaluatedCandidate[] = candidates.map((c) => {
    const reasons = vetoReasons(c, people);
    if (reasons.length > 0) {
      return { id: c.id, vetoed: true, vetoReasons: reasons, scores: {}, minScore: null, avgScore: null, rank: null };
    }
    const scores: Record<string, PersonScore> = {};
    for (const p of people) scores[p.id] = scorePerson(c, p);
    const totals = Object.values(scores).flatMap((s) => (s.noData ? [] : [s.total]));
    return {
      id: c.id,
      vetoed: false,
      vetoReasons: [],
      scores,
      minScore: totals.length ? Math.min(...totals) : 0,
      avgScore: totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : 0,
      rank: null,
    };
  });

  const survivors = evaluated
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => !c.vetoed)
    .sort((a, b) => b.c.minScore! - a.c.minScore! || b.c.avgScore! - a.c.avgScore! || a.index - b.index)
    .map(({ c }) => c);
  survivors.forEach((c, i) => (c.rank = i + 1));

  return {
    candidates: evaluated,
    shortlist: survivors.slice(0, SHORTLIST_SIZE).map((c) => c.id),
    reserve: survivors.slice(SHORTLIST_SIZE).map((c) => c.id),
  };
}
