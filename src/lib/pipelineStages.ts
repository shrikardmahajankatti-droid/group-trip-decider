// Pipeline stages, in order, labelled to match the Components Map.
export const PIPELINE_STAGES = [
  { id: "aggregate", actor: "Trip App", label: "Aggregate answers: date overlap, budget floor, hard no's" },
  { id: "step1", actor: "AI", label: "Step 1: propose 6–8 candidate destinations" },
  { id: "context", actor: "Free data APIs", label: "Weather (Open-Meteo) + destination info (Wikivoyage)" },
  { id: "costs", actor: "AI + code check", label: "Indicative costs, read from Wikivoyage and verified" },
  { id: "scoring", actor: "Trip App", label: "Hard veto in code → score each person 0–100 → rank" },
  { id: "step2", actor: "AI", label: "Step 2: write 3 option cards + 'where you stand' lines" },
] as const;

export type StageId = (typeof PIPELINE_STAGES)[number]["id"] | "done";
