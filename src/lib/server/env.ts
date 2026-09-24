import "server-only";
import { z } from "zod";

// Server-side env, validated lazily so a missing optional key (e.g. Gemini)
// never crashes pages that don't need it.

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
};

export const env = {
  supabaseUrl: () => z.string().url().parse(required("SUPABASE_URL")),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY"),
  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),
  anthropicModel: () => required("ANTHROPIC_MODEL"),
  geminiApiKey: () => process.env.GEMINI_API_KEY || null,
  geminiModel: () => process.env.GEMINI_MODEL || null,
  cronSecret: () => required("CRON_SECRET"),
  wikivoyageUserAgent: () =>
    process.env.WIKIVOYAGE_USER_AGENT || "GroupTripDecider/1.0",
  appUrl: () =>
    (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""),
};
