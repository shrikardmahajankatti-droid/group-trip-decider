import { notFound } from "next/navigation";
import { claimName } from "@/app/actions/participant";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CopyField } from "@/components/CopyButton";
import { PrefsForm } from "@/components/PrefsForm";
import { SubmissionCounter } from "@/components/SubmissionCounter";
import { formatIST, hasPassed, todayIST } from "@/lib/logic/dates";
import { baseUrl } from "@/lib/server/auth";
import { recoverStuckGeneration, triggerIfDue } from "@/lib/server/generation";
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

  const [participants, viewer] = await Promise.all([getParticipantsWithStatus(trip.id), getViewer(trip)]);
  const submission = viewer ? await getSubmission(viewer.participant.id) : null;
  const deadlinePassed = hasPassed(trip.deadline);
  const personalLink = viewer ? `${await baseUrl()}/t/${slug}/me?p=${viewer.token}` : null;
  const errorMessage = typeof e === "string" ? ERRORS[e] : undefined;
  const locked = trip.status === "locked";

  return (
    <div className="space-y-5">
      <AutoRefresh seconds={20} />
      <header className="space-y-1">
        <p className="text-sm text-slate-500">Coordinated by {trip.coordinator_name}</p>
        <h1 className="text-2xl font-bold tracking-tight">{trip.name}</h1>
        <p className="text-sm text-slate-600">
          {trip.trip_nights} nights · Responses due {formatIST(trip.deadline)}
        </p>
      </header>

      {errorMessage && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{errorMessage}</p>
      )}

      <SubmissionCounter participants={participants} deadlinePassed={deadlinePassed} />

      <ResultsStatus status={trip.status} coordinator={trip.coordinator_name} deadline={trip.deadline} />

      {!viewer && !locked && (
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">Who are you?</h2>
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
      )}

      {viewer && (
        <section className="space-y-4">
          <div className="card space-y-2">
            <h2 className="text-lg font-semibold">Hi {viewer.participant.name} 👋</h2>
            <p className="text-sm text-slate-600">
              Bookmark your personal link to edit from another device:
            </p>
            {personalLink && <CopyField value={personalLink} label="Copy" />}
          </div>

          {locked ? (
            <p className="card text-sm text-slate-600">The trip is locked, so answers can no longer be edited.</p>
          ) : (
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
          )}
        </section>
      )}
    </div>
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
      return (
        <p className={box}>
          Options appear when all 5 submit or at {formatIST(deadline)}.
        </p>
      );
    case "generating":
      return <p className={box}>Everyone&apos;s in. Working out the best options… (this takes a minute or two)</p>;
    case "review":
      return <p className={box}>{coordinator} is reviewing the options.</p>;
    default:
      // published / locked views arrive in Phase 7
      return <p className={box}>Options are ready.</p>;
  }
}
