// Script generation: plan a lesson, then write each section as spoken teaching.
// Ported from the Streamlit prototype's tutor/llm.py — same prompts, same
// word-budget math — pointed only at the gpt-5.1 Azure deployment (no model picker).
import { AzureOpenAI } from "openai";
import * as P from "./prompts";
import type { LessonPlan, Level, Mode, StorySection, TeachSection } from "./types";

const WORDS_PER_MINUTE: Record<Mode, number> = { story: 140, teach: 145 };
// Measured: the model writes ~2x (story) / ~1.5x (teach) more than the word count it is asked
// for. Ask for proportionally less so the finished audio lands near the length chosen.
const ASK_FACTOR: Record<Mode, number> = { story: 0.5, teach: 0.65 };

function settings() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5.1";
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";
  if (!apiKey || !endpoint) {
    throw new Error("AI Tutor is not configured: missing AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT.");
  }
  return { apiKey, endpoint, deployment, apiVersion };
}

function client() {
  const s = settings();
  // Fail fast on a stalled connection and retry, instead of hanging.
  return new AzureOpenAI({
    apiKey: s.apiKey,
    endpoint: s.endpoint,
    apiVersion: s.apiVersion,
    deployment: s.deployment,
    timeout: 120_000,
    maxRetries: 4,
  });
}

async function chat(system: string, user: string, maxTokens = 4096): Promise<string> {
  const s = settings();
  const resp = await client().chat.completions.create({
    model: s.deployment,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_completion_tokens: maxTokens,
  });
  return (resp.choices[0]?.message?.content || "").trim();
}

export function numParts(minutes: number, mode: Mode): number {
  // Story parts are shorter (about 2.5 min) so each holds only a few beats and stays vivid.
  const per = mode === "story" ? 2.5 : 3.0;
  const min = mode === "story" ? 4 : 3;
  return Math.max(min, Math.min(12, Math.round(minutes / per)));
}

export function maxBeats(minutes: number, n: number, mode: Mode): number {
  // A vividly told story beat costs about 110 words, so the word budget caps the beats.
  return Math.max(2, Math.round((minutes * WORDS_PER_MINUTE[mode]) / n / 110));
}

function bullets(items: (string | undefined)[] | undefined): string {
  const list = (items || []).map((i) => String(i ?? "").trim()).filter(Boolean);
  return list.length ? list.map((i) => `- ${i}`).join("\n") : "- (use your best judgement)";
}

function extractJson(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

export async function planLesson(args: {
  topic: string;
  exam: string;
  level: Level;
  minutes: number;
  focus: string;
  mode: Mode;
}): Promise<LessonPlan> {
  const { topic, exam, minutes, focus, mode } = args;
  const level = P.LEVEL_RULES[args.level] ?? args.level;
  const n = numParts(minutes, mode);
  const partMinutes = Math.round((minutes / n) * 10) / 10;
  const partWords = Math.floor((minutes * WORDS_PER_MINUTE[mode]) / n);
  const beats = maxBeats(minutes, n, mode);

  const persona = mode === "story" ? P.STORY_PERSONA : P.TEACH_PERSONA;
  const prompt =
    mode === "story"
      ? P.storyPlanPrompt({ topic, exam, level, minutes, n, focus: focus || "none", partMinutes, partWords, maxBeats: beats })
      : P.teachPlanPrompt({ topic, exam, level, minutes, n, focus: focus || "none" });

  const raw = await chat(persona, prompt, 4096);
  const plan = extractJson(raw) as LessonPlan;
  if (!plan?.sections?.length) {
    throw new Error("The model returned an empty lesson plan.");
  }
  return plan;
}

export async function writeSection(args: {
  plan: LessonPlan;
  index: number;
  topic: string;
  exam: string;
  level: Level;
  minutes: number;
  style: string;
  language: keyof typeof P.LANGUAGE_RULES;
  mode: Mode;
}): Promise<string> {
  const { plan, index, topic, exam, minutes, style, language, mode } = args;
  const level = P.LEVEL_RULES[args.level] ?? args.level;
  const sections = plan.sections;
  const sec = sections[index];
  const n = sections.length;
  const words = Math.floor((minutes * WORDS_PER_MINUTE[mode]) / n);
  const langRule = P.LANGUAGE_RULES[language];
  const outline = sections.map((x, i) => `${i + 1}. ${x.title}`).join("\n");
  const pos = index === 0 ? "first" : index === n - 1 ? "last" : "middle";

  if (mode === "story") {
    const storySec = sec as StorySection;
    const position = P.positionFor("story", pos);
    const prev = index > 0 ? (sections[index - 1] as StorySection) : null;
    const next = index < n - 1 ? (sections[index + 1] as StorySection) : null;
    const prevRecap = prev ? `The previous part, "${prev.title}", ended with: ${prev.handoff ?? ""}\n` : "";
    const nextHook = next
      ? `The next part, "${next.title}", will cover: ${(next.beats ?? []).slice(0, 3).join(", ")}.\n`
      : "";
    const beatsForPart = (storySec.beats ?? []).slice(0, maxBeats(minutes, n, mode));
    const partMinutes = Math.round((minutes / n) * 10) / 10;
    const paras = Math.max(3, Math.round(words / 100));

    const prompt = P.storySectionPrompt({
      idx1: index + 1, n, title: plan.title, topic, exam, level, langRule, outline,
      thisTitle: storySec.title, timeSpan: storySec.time_span ?? "", beats: bullets(beatsForPart),
      keyFacts: bullets(storySec.key_facts), prevRecap, nextHook,
      handoff: storySec.handoff || "nothing, this is the end of the story", position,
      words, paras, partMinutes, spokenRules: P.SPOKEN_TEXT_RULES,
    });
    let draft = cleanForSpeech(await chat(P.STORY_PERSONA, prompt, 8192));

    // Backstop: one trim pass if the draft still ran far over budget.
    if (draft.split(/\s+/).filter(Boolean).length > words * 1.3) {
      const draftWords = draft.split(/\s+/).filter(Boolean).length;
      const fit = P.fitLengthPrompt({
        wordsNow: draftWords, wordsTarget: words, partMinutes, spokenRules: P.SPOKEN_TEXT_RULES, draft,
      });
      const trimmed = cleanForSpeech(await chat(P.STORY_PERSONA, fit, 8192));
      if (trimmed && trimmed.split(/\s+/).filter(Boolean).length < draftWords) {
        draft = trimmed;
      }
    }
    return draft;
  } else {
    const teachSec = sec as TeachSection;
    const position = P.positionFor("teach", pos);
    const prompt = P.teachSectionPrompt({
      idx1: index + 1, n, title: plan.title, topic, exam, level, style, langRule, outline,
      thisTitle: teachSec.title, goal: teachSec.goal ?? "", position,
      words: Math.floor(words * ASK_FACTOR[mode]), spokenRules: P.SPOKEN_TEXT_RULES,
    });
    return cleanForSpeech(await chat(P.TEACH_PERSONA, prompt, 8192));
  }
}

export function cleanForSpeech(text: string): string {
  text = text.replace(/‑/g, "-").replace(/ /g, " ").replace(/ /g, " ");
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/^\s{0,3}#{1,6}\s*/gm, "");
  text = text.replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "");
  text = text.replace(/[*_`~]+/g, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

export { WORDS_PER_MINUTE };
