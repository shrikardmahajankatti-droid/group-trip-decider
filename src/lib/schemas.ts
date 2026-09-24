import { z } from "zod";
import { DESTINATION_TYPES, WONT_DO_TAGS } from "./logic/constants";
import { isIsoDate } from "./logic/dates";

// Shared input schemas (safe to import on the client). AI response schemas
// live next to their integrations.

const personName = z
  .string()
  .trim()
  .min(1, "Every name is required")
  .max(40, "Names must be 40 characters or fewer");

export const createTripSchema = z
  .object({
    tripName: z.string().trim().min(1, "Give the trip a name").max(80),
    coordinatorName: personName,
    friendNames: z.array(personName).length(4),
    deadlineLocal: z.string().min(1, "Set a response deadline"),
    tripNights: z.coerce
      .number()
      .int("Trip length must be a whole number of nights")
      .min(1, "Trip must be at least 1 night")
      .max(30, "Trip can be at most 30 nights"),
  })
  .refine(
    (v) => {
      const all = [v.coordinatorName, ...v.friendNames].map((n) => n.toLowerCase());
      return new Set(all).size === all.length;
    },
    { message: "Each person needs a different name" },
  );

export const isoDate = z.string().refine(isIsoDate, "Use a valid date");

export const dateWindowSchema = z
  .object({ start: isoDate, end: isoDate })
  .refine((w) => w.end >= w.start, "A date window can't end before it starts");
export type DateWindow = z.infer<typeof dateWindowSchema>;

export const submissionSchema = z.object({
  budgetCapInr: z
    .number({ error: "Enter your budget" })
    .int()
    .min(1000, "Budget must be at least ₹1,000")
    .max(10_000_000, "That budget looks too large"),
  startingCity: z.string().trim().min(1, "Pick your starting city").max(120),
  startLat: z.number({ error: "Pick your city from the suggestions" }).min(-90).max(90),
  startLon: z.number({ error: "Pick your city from the suggestions" }).min(-180).max(180),
  dateWindows: z
    .array(dateWindowSchema)
    .min(1, "Add at least one date window")
    .max(6, "At most 6 date windows"),
  destinationTypes: z
    .array(z.enum(DESTINATION_TYPES))
    .min(1, "Pick at least one destination type"),
  wontDo: z.array(z.enum(WONT_DO_TAGS)),
  wontDoNote: z.string().trim().max(500, "Keep the note under 500 characters").optional(),
});
export type SubmissionInput = z.infer<typeof submissionSchema>;
