import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { env } from "./env";
import { sleep } from "./http";

// One structured-output call, validated with Zod. Gemini (free tier) by
// default; Claude is used instead only if ANTHROPIC_API_KEY is set.

// Free-tier latency (measured 2026-09-25): flash-lite answers in seconds,
// 3.5-flash can take well over a minute on our prompts. Primary comes from
// GEMINI_MODEL; the other one is the fallback.
const GEMINI_DEFAULT_MODEL = "gemini-3.1-flash-lite";
const GEMINI_ALT_MODEL = "gemini-3.5-flash";
const CALL_TIMEOUT_MS = 60_000;

export class LlmError extends Error {}

type Args<T> = {
  /** Short label for logs. */
  name: string;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  /** Extra check after schema validation; return an error message to retry once. */
  validate?: (value: T) => string | null;
};

export function llmProvider(): "claude" | "gemini" {
  return process.env.ANTHROPIC_API_KEY ? "claude" : "gemini";
}

export async function generateStructured<T>(args: Args<T>): Promise<T> {
  let feedback: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = feedback
      ? `${args.prompt}\n\nYour previous answer was rejected: ${feedback}\nReturn corrected JSON only.`
      : args.prompt;
    const raw = llmProvider() === "claude" ? await callClaude(args, prompt) : await callGemini(args, prompt);

    const parsed = args.schema.safeParse(raw);
    if (!parsed.success) {
      feedback = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      console.warn(`[llm:${args.name}] invalid JSON on attempt ${attempt + 1}: ${feedback}`);
      continue;
    }
    const problem = args.validate?.(parsed.data) ?? null;
    if (problem) {
      feedback = problem;
      console.warn(`[llm:${args.name}] failed validation on attempt ${attempt + 1}: ${problem}`);
      continue;
    }
    return parsed.data;
  }
  throw new LlmError(`${args.name}: model returned invalid output twice`);
}

// ---------------------------------------------------------------- Gemini

let gemini: GoogleGenAI | null = null;

function jsonSchemaFor(schema: z.ZodType): unknown {
  const js = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

function isRetryable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /"code":\s*(429|500|503|504)|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED|overloaded|high demand|timed? ?out|aborted/i.test(msg);
}

async function callGemini<T>(args: Args<T>, prompt: string): Promise<unknown> {
  const apiKey = env.geminiApiKey();
  if (!apiKey) throw new LlmError("GEMINI_API_KEY is not set");
  gemini ??= new GoogleGenAI({ apiKey });

  const primary = env.geminiModel() || GEMINI_DEFAULT_MODEL;
  const models = [primary, primary === GEMINI_DEFAULT_MODEL ? GEMINI_ALT_MODEL : GEMINI_DEFAULT_MODEL];
  let lastError: unknown = null;
  for (const [i, model] of models.entries()) {
    try {
      const res = await gemini.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: args.system,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchemaFor(args.schema),
          temperature: 0.4,
          // Structured extraction/writing, not deep reasoning: keep latency low.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          httpOptions: { timeout: CALL_TIMEOUT_MS },
        },
      });
      const text = res.text ?? "";
      try {
        return JSON.parse(text);
      } catch {
        // Defensive: strip code fences if the model added them.
        const m = text.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
        throw new LlmError(`${args.name}: response was not JSON`);
      }
    } catch (e) {
      lastError = e;
      if (!isRetryable(e) || i === models.length - 1) break;
      console.warn(`[llm:${args.name}] ${model} unavailable, falling back`);
      await sleep(1500);
    }
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new LlmError(`${args.name}: Gemini failed (${msg.slice(0, 160)})`);
}

// ---------------------------------------------------------------- Claude (optional)

let claude: Anthropic | null = null;

async function callClaude<T>(args: Args<T>, prompt: string): Promise<unknown> {
  claude ??= new Anthropic({ apiKey: env.anthropicApiKey(), timeout: CALL_TIMEOUT_MS, maxRetries: 2 });
  const res = await claude.messages.parse({
    model: env.anthropicModel(),
    max_tokens: 16000,
    system: args.system,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(args.schema) },
  });
  if (res.stop_reason === "refusal") throw new LlmError(`${args.name}: Claude declined`);
  return res.parsed_output;
}
