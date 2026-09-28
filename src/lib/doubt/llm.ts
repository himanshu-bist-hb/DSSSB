// Vision + chat calls for the AI Doubt Solver, on the same Azure OpenAI (gpt-5.1)
// deployment the AI Tutor uses - no model picker, no separate credentials.
import { AzureOpenAI } from "openai";
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import * as P from "./prompts";
import type { ChatTurn, DoubtSolution } from "./types";

function settings() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5.1";
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";
  if (!apiKey || !endpoint) {
    throw new Error("AI Doubt Solver is not configured: missing AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT.");
  }
  return { apiKey, endpoint, deployment, apiVersion };
}

function client() {
  const s = settings();
  return new AzureOpenAI({
    apiKey: s.apiKey,
    endpoint: s.endpoint,
    apiVersion: s.apiVersion,
    deployment: s.deployment,
    timeout: 90_000,
    maxRetries: 2,
  });
}

function extractJson(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

function validateSolution(data: unknown): DoubtSolution {
  const d = data as Partial<DoubtSolution> | null;
  if (!d || typeof d !== "object") throw new Error("The model returned an unreadable response.");
  const required: (keyof DoubtSolution)[] = ["subject", "topic", "question", "answer", "explanation"];
  for (const key of required) {
    if (!d[key] || typeof d[key] !== "string") {
      throw new Error("The model's response was missing a required field.");
    }
  }
  const shortTricks = Array.isArray(d.shortTricks) ? d.shortTricks.filter((t) => typeof t === "string" && t.trim()) : [];
  const confidence = d.confidence === "high" || d.confidence === "medium" || d.confidence === "low" ? d.confidence : "medium";
  return {
    subject: d.subject!.trim(),
    topic: d.topic!.trim(),
    question: d.question!.trim(),
    answer: d.answer!.trim(),
    explanation: d.explanation!.trim(),
    shortTricks,
    confidence,
    notes: typeof d.notes === "string" && d.notes.trim() ? d.notes.trim() : undefined,
  };
}

export async function solveDoubt(args: { images: string[]; context: string }): Promise<DoubtSolution> {
  const { images, context } = args;
  if (!images.length) throw new Error("No image was provided.");

  const content: ChatCompletionContentPart[] = [
    { type: "text", text: P.solvePrompt({ context }) },
    ...images.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } })),
  ];

  const s = settings();
  const resp = await client().chat.completions.create({
    model: s.deployment,
    messages: [
      { role: "system", content: P.SOLVE_PERSONA },
      { role: "user", content },
    ],
    max_completion_tokens: 3000,
  });

  const raw = (resp.choices[0]?.message?.content || "").trim();
  if (!raw) throw new Error("The model returned an empty response.");
  return validateSolution(extractJson(raw));
}

export async function askFollowup(args: {
  question: string;
  answer: string;
  explanation: string;
  history: ChatTurn[];
}): Promise<string> {
  const { question, answer, explanation, history } = args;
  const s = settings();

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: `${P.FOLLOWUP_PERSONA}\n\n${P.followupContext({ question, answer, explanation })}` },
    ...history.map((t) => ({ role: t.role, content: t.content }) as ChatCompletionMessageParam),
  ];

  const resp = await client().chat.completions.create({
    model: s.deployment,
    messages,
    max_completion_tokens: 900,
  });

  const raw = (resp.choices[0]?.message?.content || "").trim();
  if (!raw) throw new Error("The model returned an empty response.");
  return raw;
}
