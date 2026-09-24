"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { getTripBySlug, isAdmin } from "@/lib/server/trips";

async function requireAdmin(slug: string, key: string) {
  const trip = await getTripBySlug(slug);
  if (!trip || !isAdmin(trip, key)) redirect("/");
  return trip;
}

/** Free up a name so its owner can claim it again from a new phone. */
export async function resetClaim(slug: string, key: string, participantId: string): Promise<void> {
  const trip = await requireAdmin(slug, key);
  await db()
    .from("participants")
    .update({ token_hash: null, claimed_at: null })
    .eq("id", participantId)
    .eq("trip_id", trip.id);
  revalidatePath(`/t/${slug}/admin`);
}
