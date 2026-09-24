import type { ParticipantWithStatus } from "@/lib/server/trips";

/** "3 of 5 submitted": names only, never answers. */
export function SubmissionCounter({
  participants,
  deadlinePassed,
}: {
  participants: Pick<ParticipantWithStatus, "id" | "name" | "submitted">[];
  deadlinePassed: boolean;
}) {
  const done = participants.filter((p) => p.submitted).length;
  return (
    <div className="card space-y-2">
      <p className="font-semibold">
        {done} of {participants.length} submitted
      </p>
      <ul className="flex flex-wrap gap-2">
        {participants.map((p) => (
          <li
            key={p.id}
            className={`rounded-full px-3 py-1 text-sm ${
              p.submitted
                ? "bg-emerald-100 text-emerald-800"
                : deadlinePassed
                  ? "bg-slate-200 text-slate-500"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {p.submitted ? "✓ " : ""}
            {p.name}
            {!p.submitted && deadlinePassed ? " · no data" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
