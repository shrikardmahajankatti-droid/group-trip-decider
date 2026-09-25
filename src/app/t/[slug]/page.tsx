import { notFound } from "next/navigation";
import { castVote, claimName } from "@/app/actions/participant";
import { ActionButton } from "@/components/ActionButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CopyField } from "@/components/CopyButton";
import { Disclaimer } from "@/components/Disclaimer";
import { FitMatrix } from "@/components/FitMatrix";
import { OptionCard } from "@/components/OptionCard";
import { PrefsForm } from "@/components/PrefsForm";
import { SubmissionCounter } from "@/components/SubmissionCounter";
import { formatWindow, placeName } from "@/lib/format";
import { formatIST, hasPassed, todayIST } from "@/lib/logic/dates";
import { baseUrl } from "@/lib/server/auth";
import { recoverStuckGeneration, triggerIfDue } from "@/lib/server/generation";
import { getShortlist, getViewerVote } from "@/lib/server/shortlist";
import {
  getParticipantsWithStatus,
  getSubmission,
  getTripBySlug,
  getViewer,
} from "@/lib/server/trips";

export const maxDuration = 300; // server actions on this page may run the pipeline via after()

const ERRORS: Record<string, string> = {
  taken: "Someone already picked that name. If it's really you, ask the coordinator to reset it.",
  locked: "This trip is locked.",
  link: "That personal link isn't valid any more. Pick your name again, or ask the coordinator to reset it.",
};

export default async function TripPage({ params, searchParams }: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  const { e } = await searchParams;

  let trip = await getTripBySlug(slug);
  if (!trip) notFound();

  // Lazy trigger: any visit after the deadline (or once everyone is in) starts generation.
  trip = await recoverStuckGeneration(trip);
  if (await triggerIfDue(trip)) trip = { ...trip, status: "generating" };

  const visible = trip.status === "published" || trip.status === "locked";
  const [participants, viewer, shortlist] = await Promise.all([
    getParticipantsWithStatus(trip.id),
    getViewer(trip),
    // Nothing reaches the group before the coordinator publishes.
    visible ? getShortlist(trip.id) : Promise.resolve(null),
  ]);
  const [submission, myVote] = viewer
    ? await Promise.all([getSubmission(viewer.participant.id), visible ? getViewerVote(viewer.participant.id) : null])
    : [null, null];
  const deadlinePassed = hasPassed(trip.deadline);
  const personalLink = viewer ? `${await baseUrl()}/t/${slug}/me?p=${viewer.token}` : null;
  const errorMessage = typeof e === "string" ? ERRORS[e] : undefined;
  const locked = trip.status === "locked";
  const people = participants.map((p) => ({ id: p.id, name: p.name }));
  const options = shortlist?.options ?? [];
  const winner = locked ? options.find((o) => o.id === trip.locked_option_id) : undefined;
  const totalVotes = options.reduce((n, o) => n + o.votes, 0);
  const viewerId = viewer?.participant.id;

  const prefsForm = viewer && !locked && (
    <PrefsForm
      slug={slug}
      tripNights={trip.trip_nights}
      today={todayIST()}
      staleWarning={trip.status !== "collecting"}
      initial={
        submission && {
          budgetCapInr: submission.budget_cap_inr,
          startingCity: submission.starting_city,
          startLat: submission.start_lat,
          startLon: submission.start_lon,
          dateWindows: submission.date_windows,
          destinationTypes: submission.destination_types,
          wontDo: submission.wont_do,
          wontDoNote: submission.wont_do_note ?? "",
        }
      }
    />
  );

  return (
    <div className="space-y-5">
      {!locked && <AutoRefresh seconds={trip.status === "generating" ? 10 : 20} />}
      <header className="space-y-1">
        <p className="text-sm text-slate-500">Coordinated by {trip.coordinator_name}</p>
        <h1 className="text-2xl font-bold tracking-tight">{trip.name}</h1>
        <p className="text-sm text-slate-600">
          {trip.trip_nights} nights · Responses due {formatIST(trip.deadline)}
        </p>
      </header>

      {errorMessage && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      )}

      {!visible && <SubmissionCounter participants={participants} deadlinePassed={deadlinePassed} />}

      <ResultsStatus status={trip.status} coordinator={trip.coordinator_name} deadline={trip.deadline} />

      {locked && winner && (
        <section className="space-y-2 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
          <p className="text-sm font-semibold uppercase tracking-wide">🔒 It&apos;s decided</p>
          <p className="text-xl font-bold">{placeName(winner.candidate.data)}</p>
          <p>{formatWindow(winner.candidate.data.suggested_window)}</p>
        </section>
      )}

      {visible && (
        <>
          {trip.status === "published" && (
            <p className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
              Look at the {options.length} options and where you stand, then vote once. <strong>Votes are final.</strong>{" "}
              {totalVotes} of {participants.length} voted so far.
            </p>
          )}

          {!viewer && trip.status === "published" && (
            <ClaimPicker slug={slug} participants={participants} title="Who are you? Pick your name to vote" />
          )}

          <div className="space-y-4">
            {(winner ? [winner, ...options.filter((o) => o.id !== winner.id)] : options).map((o) => (
              <OptionCard key={o.id} option={o} people={people} viewerId={viewerId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {o.votes} vote{o.votes === 1 ? "" : "s"}
                    {myVote === o.id ? " · ✓ your vote" : ""}
                    {winner?.id === o.id ? " · 🔒 chosen" : ""}
                  </p>
                  {trip.status === "published" && viewer && !myVote && (
                    <div className="w-full sm:w-auto">
                      <ActionButton
                        action={castVote.bind(null, slug, o.id)}
                        label={`Vote for ${o.candidate.data.name}`}
                        pendingLabel="Voting…"
                        confirm={`Vote for ${o.candidate.data.name}? You can't change your vote afterwards.`}
                      />
                    </div>
                  )}
                </div>
              </OptionCard>
            ))}
          </div>

          {options.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-semibold">How each option fits each person</h2>
              <FitMatrix
                rows={people}
                highlightId={viewerId}
                cols={options.map((o) => ({ id: o.id, label: o.candidate.data.name, scores: o.candidate.scores ?? {} }))}
              />
            </section>
          )}

          <Disclaimer />
        </>
      )}

      {!viewer && !locked && !visible && (
        <ClaimPicker slug={slug} participants={participants} title="Who are you?" />
      )}

      {viewer && (
        <section className="space-y-4">
          <div className="card space-y-2">
            <h2 className="text-lg font-semibold">Hi {viewer.participant.name} 👋</h2>
            <p className="text-sm text-slate-600">Bookmark your personal link to edit from another device:</p>
            {personalLink && <CopyField value={personalLink} label="Copy" />}
          </div>

          {locked ? (
            <p className="card text-sm text-slate-600">The trip is locked, so answers can no longer be edited.</p>
          ) : visible ? (
            <details className="card">
              <summary className="cursor-pointer font-semibold">Edit my answers</summary>
              <div className="mt-4">{prefsForm}</div>
            </details>
          ) : (
            prefsForm
          )}
        </section>
      )}
    </div>
  );
}

function ClaimPicker({
  slug,
  participants,
  title,
}: {
  slug: string;
  participants: { id: string; name: string; claimed_at: string | null }[];
  title: string;
}) {
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-slate-600">Tap your name. This phone will remember you.</p>
      <div className="grid grid-cols-2 gap-2">
        {participants.map((p) => {
          const taken = !!p.claimed_at;
          return (
            <form key={p.id} action={claimName.bind(null, slug, p.id)}>
              <button className={taken ? "btn-secondary w-full" : "btn-primary w-full"} disabled={taken}>
                {p.name}
                {taken ? " · taken" : ""}
              </button>
            </form>
          );
        })}
      </div>
    </section>
  );
}

function ResultsStatus({
  status,
  coordinator,
  deadline,
}: {
  status: string;
  coordinator: string;
  deadline: string;
}) {
  const box = "rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900";
  switch (status) {
    case "collecting":
      return <p className={box}>Options appear when all 5 submit or at {formatIST(deadline)}.</p>;
    case "generating":
      return <p className={box}>Responses are in. Working out the best options… (this takes a minute or two)</p>;
    case "review":
      return <p className={box}>{coordinator} is reviewing the options.</p>;
    default:
      return null;
  }
}
