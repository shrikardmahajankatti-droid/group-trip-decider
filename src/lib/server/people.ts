import "server-only";
import type { WontDoTag } from "@/lib/logic/constants";
import type { Person } from "@/lib/logic/types";
import { getParticipantsWithStatus, getSubmissionsForTrip } from "./trips";

/** Participants + their submissions as pure-logic `Person`s (no data → prefs null). */
export async function loadPeople(tripId: string): Promise<Person[]> {
  const [participants, submissions] = await Promise.all([
    getParticipantsWithStatus(tripId),
    getSubmissionsForTrip(tripId),
  ]);
  const byId = new Map(submissions.map((s) => [s.participant_id, s]));
  return participants.map((p) => {
    const s = byId.get(p.id);
    return {
      id: p.id,
      name: p.name,
      prefs: s
        ? {
            budgetCapInr: s.budget_cap_inr,
            startingCity: s.starting_city,
            startLat: s.start_lat,
            startLon: s.start_lon,
            dateWindows: s.date_windows,
            destinationTypes: s.destination_types,
            wontDo: s.wont_do as WontDoTag[],
            wontDoNote: s.wont_do_note,
          }
        : null,
    };
  });
}
