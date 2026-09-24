import "server-only";
import { db } from "./db";
import { hashToken, readParticipantToken, tokenMatches } from "./auth";

export type TripStatus = "collecting" | "generating" | "review" | "published" | "locked";

export type Trip = {
  id: string;
  slug: string;
  name: string;
  coordinator_name: string;
  deadline: string;
  trip_nights: number;
  status: TripStatus;
  admin_token_hash: string;
  created_at: string;
  generated_at: string | null;
  published_at: string | null;
  locked_at: string | null;
  locked_option_id: string | null;
};

export type Participant = {
  id: string;
  trip_id: string;
  name: string;
  is_coordinator: boolean;
  token_hash: string | null;
  claimed_at: string | null;
};

export type ParticipantWithStatus = Participant & {
  submitted: boolean;
  submitted_at: string | null;
};

export type SubmissionRow = {
  participant_id: string;
  budget_cap_inr: number;
  starting_city: string;
  start_lat: number;
  start_lon: number;
  date_windows: { start: string; end: string }[];
  destination_types: string[];
  wont_do: string[];
  wont_do_note: string | null;
  updated_at: string;
};

export type EventType =
  | "created"
  | "submission"
  | "trigger"
  | "publish"
  | "lock"
  | "rerun"
  | "reversal_blocked";

/** PostgREST returns a 1:1 embed as an object, but be tolerant of arrays. */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function getTripBySlug(slug: string): Promise<Trip | null> {
  const { data, error } = await db().from("trips").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Failed to load trip: ${error.message}`);
  return (data as Trip | null) ?? null;
}

export async function getParticipantsWithStatus(tripId: string): Promise<ParticipantWithStatus[]> {
  const { data, error } = await db()
    .from("participants")
    .select("*, submissions(updated_at)")
    .eq("trip_id", tripId)
    .order("is_coordinator", { ascending: false })
    .order("name");
  if (error) throw new Error(`Failed to load participants: ${error.message}`);
  return (data ?? []).map((row) => {
    const { submissions, ...p } = row as Participant & {
      submissions: { updated_at: string } | { updated_at: string }[] | null;
    };
    const s = one(submissions);
    return { ...p, submitted: !!s, submitted_at: s?.updated_at ?? null };
  });
}

/** The participant this browser has claimed, via the httpOnly cookie. */
export async function getViewer(trip: Trip): Promise<{ participant: Participant; token: string } | null> {
  const token = await readParticipantToken(trip.slug);
  if (!token) return null;
  const { data } = await db()
    .from("participants")
    .select("*")
    .eq("trip_id", trip.id)
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  return data ? { participant: data as Participant, token } : null;
}

export function isAdmin(trip: Trip, key: string | null | undefined) {
  return tokenMatches(key, trip.admin_token_hash);
}

export async function getSubmission(participantId: string): Promise<SubmissionRow | null> {
  const { data, error } = await db()
    .from("submissions")
    .select("*")
    .eq("participant_id", participantId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load submission: ${error.message}`);
  return (data as SubmissionRow | null) ?? null;
}

export async function getSubmissionsForTrip(tripId: string): Promise<SubmissionRow[]> {
  const { data, error } = await db()
    .from("submissions")
    .select("*, participants!inner(trip_id)")
    .eq("participants.trip_id", tripId);
  if (error) throw new Error(`Failed to load submissions: ${error.message}`);
  return (data ?? []).map((row) => {
    const { participants, ...s } = row as SubmissionRow & { participants: unknown };
    void participants;
    return s as SubmissionRow;
  });
}

export async function logEvent(tripId: string, type: EventType) {
  const { error } = await db().from("events").insert({ trip_id: tripId, type });
  if (error) console.error(`[events] failed to log ${type}: ${error.message}`);
}

export type RunRow = {
  id: string;
  trip_id: string;
  status: "running" | "done" | "failed" | "stale";
  error: string | null;
  constraints: unknown;
  created_at: string;
};

export async function getLatestRun(tripId: string): Promise<RunRow | null> {
  const { data } = await db()
    .from("runs")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as RunRow | null) ?? null;
}

/** Map DB lock-guard errors to a friendly message. */
export function friendlyDbError(message: string): string {
  if (message.includes("TRIP_LOCKED")) return "This trip is locked, so nothing can be changed.";
  if (message.includes("VOTE_FINAL")) return "Votes are final once cast.";
  return "Something went wrong saving that. Please try again.";
}
