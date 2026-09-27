"use client";

import { useEffect, useRef, useState } from "react";
import { VOICES_BY_LANGUAGE } from "@/lib/tutor/voices";
import { EXAMS } from "@/lib/tutor/types";
import type { Language, Level, Mode, TeachStyle, LessonPlan } from "@/lib/tutor/types";
import { runWithConcurrency, slug } from "@/lib/tutor/client-utils";
import { AudioPlayer } from "@/components/tutor/AudioPlayer";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "हिन्दी (Hindi)" },
  { value: "Hinglish", label: "Hinglish" },
];

const LEVELS: Level[] = ["Beginner", "Intermediate", "Advanced"];

const TEACH_STYLES: TeachStyle[] = [
  "Friendly and conversational, with analogies",
  "Structured and rigorous, exam-focused",
  "Quick revision, crisp and high-yield",
];

type Stage = "idle" | "planning" | "writing" | "recording" | "done" | "error";

type Result = {
  plan: LessonPlan;
  scripts: string[];
  script: string;
  audioUrl: string;
  scriptUrl: string;
  name: string;
  topic: string;
  exam: string;
};

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

export function TutorClient() {
  const [topic, setTopic] = useState("");
  const [exam, setExam] = useState<string>(EXAMS[0]);
  const [language, setLanguage] = useState<Language>("English");
  const [voiceLabel, setVoiceLabel] = useState(Object.keys(VOICES_BY_LANGUAGE.English)[0]);
  const [mode, setMode] = useState<Mode>("story");
  const [style, setStyle] = useState<TeachStyle>(TEACH_STYLES[0]);
  const [level, setLevel] = useState<Level>("Beginner");
  const [minutes, setMinutes] = useState(8);
  const [focus, setFocus] = useState("");

  const [stage, setStage] = useState<Stage>("idle");
  const [sectionProgress, setSectionProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);

  // Object URLs are created once per successful generation (in `generate`, below) and
  // torn down here — on the next generation and on unmount — rather than reacting to
  // `result` changes with an effect that would just be re-deriving state we already have.
  const objectUrlsRef = useRef<{ audio: string | null; script: string | null }>({
    audio: null,
    script: null,
  });

  useEffect(() => {
    return () => {
      if (objectUrlsRef.current.audio) URL.revokeObjectURL(objectUrlsRef.current.audio);
      if (objectUrlsRef.current.script) URL.revokeObjectURL(objectUrlsRef.current.script);
    };
  }, []);

  function onLanguageChange(next: Language) {
    setLanguage(next);
    setVoiceLabel(Object.keys(VOICES_BY_LANGUAGE[next])[0]);
  }

  const busy = stage === "planning" || stage === "writing" || stage === "recording";

  async function generate() {
    if (busy) return;
    setError(null);
    setResult(null);
    if (objectUrlsRef.current.audio) URL.revokeObjectURL(objectUrlsRef.current.audio);
    if (objectUrlsRef.current.script) URL.revokeObjectURL(objectUrlsRef.current.script);
    objectUrlsRef.current = { audio: null, script: null };

    try {
      setStage("planning");
      const planRes = await fetch("/api/tutor/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, exam, level, minutes, focus, mode }),
      });
      if (!planRes.ok) throw new Error(await readError(planRes, "Could not plan the lesson."));
      const { plan, sectionCount } = (await planRes.json()) as { plan: LessonPlan; sectionCount: number };

      setStage("writing");
      setSectionProgress({ done: 0, total: sectionCount });
      const indices = Array.from({ length: sectionCount }, (_, i) => i);
      const scripts = await runWithConcurrency(
        indices,
        4,
        async (index) => {
          const res = await fetch("/api/tutor/section", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan, index, topic, exam, level, minutes, style, language, mode }),
          });
          if (!res.ok) throw new Error(await readError(res, `Could not write part ${index + 1}.`));
          const data = (await res.json()) as { text: string };
          return data.text;
        },
        (_i, _r, done, total) => setSectionProgress({ done, total })
      );
      const script = scripts.join("\n\n");

      setStage("recording");
      const voiceId = VOICES_BY_LANGUAGE[language][voiceLabel];
      const audioRes = await fetch("/api/tutor/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, voice: voiceId, language }),
      });
      if (!audioRes.ok) throw new Error(await readError(audioRes, "Could not record the audio."));
      const audioBlob = await audioRes.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const scriptUrl = URL.createObjectURL(new Blob([script], { type: "text/plain" }));
      objectUrlsRef.current = { audio: audioUrl, script: scriptUrl };

      const stamp = new Date();
      const name = `${slug(topic)}-${slug(exam)}-${stamp.toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
      setResult({ plan, scripts, script, audioUrl, scriptUrl, name, topic, exam });
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("error");
    }
  }

  const words = result ? result.script.split(/\s+/).filter(Boolean).length : 0;

  const canGenerate = topic.trim().length > 0 && !busy;

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-lg">
            🎧
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Your AI Teacher</p>
            <p className="text-xs text-muted">Type a topic and get a full spoken lesson</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. French Revolution, Fundamental Rights, Photosynthesis"
              disabled={busy}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Exam</label>
            <select
              value={exam}
              onChange={(e) => setExam(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-60"
            >
              {EXAMS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Your level</label>
            <div className="flex gap-1.5">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  disabled={busy}
                  onClick={() => setLevel(l)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                    level === l ? "bg-accent text-white" : "bg-[#efece3] text-muted hover:bg-[#e8e5dd]"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center justify-between text-xs font-medium text-muted">
              <span>Lesson length</span>
              <span className="text-foreground">{minutes} min</span>
            </label>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={minutes}
              disabled={busy}
              onChange={(e) => setMinutes(parseInt(e.target.value, 10))}
              className="w-full accent-[var(--accent)] disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Lesson language</label>
            <div className="flex gap-1.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  disabled={busy}
                  onClick={() => onLanguageChange(l.value)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                    language === l.value ? "bg-accent text-white" : "bg-[#efece3] text-muted hover:bg-[#e8e5dd]"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Teacher voice</label>
            <select
              value={voiceLabel}
              onChange={(e) => setVoiceLabel(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-60"
            >
              {Object.keys(VOICES_BY_LANGUAGE[language]).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Lesson mode</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("story")}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                  mode === "story" ? "bg-accent text-white" : "bg-[#efece3] text-muted hover:bg-[#e8e5dd]"
                }`}
              >
                Story mode
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("teach")}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                  mode === "teach" ? "bg-accent text-white" : "bg-[#efece3] text-muted hover:bg-[#e8e5dd]"
                }`}
              >
                Teaching mode
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {mode === "story"
                ? "Tells the topic as a gripping start-to-finish story with the exam facts woven in."
                : "Classic step-by-step lecture with examples and common traps."}
            </p>
          </div>

          {mode === "teach" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Teaching style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as TeachStyle)}
                disabled={busy}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-60"
              >
                {TEACH_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Anything specific to cover? (optional)
            </label>
            <textarea
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              disabled={busy}
              rows={2}
              placeholder="e.g. focus on previous-year question patterns, explain with examples"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none disabled:opacity-60"
            />
          </div>

          <button
            onClick={generate}
            disabled={!canGenerate}
            className="mt-1 rounded-xl bg-accent py-3 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-40"
          >
            {busy ? "Building your lesson…" : "Generate audio lesson"}
          </button>
        </div>
      </section>

      {busy && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <Steps stage={stage} sectionProgress={sectionProgress} mode={mode} />
        </section>
      )}

      {error && (
        <section className="rounded-2xl border border-[#a13a3a] bg-[#f8e6e6] p-4">
          <p className="text-sm font-semibold text-[#8a2f2f]">Something went wrong</p>
          <p className="mt-1 text-xs text-[#8a2f2f]">{error}</p>
        </section>
      )}

      {result && stage === "done" && (
        <section className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-medium text-muted">Ready</p>
            <h2 className="text-lg font-semibold text-foreground">{result.plan.title}</h2>
          </div>

          <div className="flex gap-2.5">
            <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
              <p className="text-lg font-semibold text-foreground">{result.plan.sections.length}</p>
              <p className="text-[11px] font-medium text-muted">Parts</p>
            </div>
            <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
              <p className="text-lg font-semibold text-foreground">{words.toLocaleString()}</p>
              <p className="text-[11px] font-medium text-muted">Script words</p>
            </div>
            <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
              <p className="text-lg font-semibold text-foreground">{Math.round(words / 140)} min</p>
              <p className="text-[11px] font-medium text-muted">Est. length</p>
            </div>
          </div>

          <AudioPlayer src={result.audioUrl} />

          <div className="flex gap-2.5">
            <a
              href={result.audioUrl}
              download={`${result.name}.mp3`}
              className="flex-1 rounded-xl border border-border py-2.5 text-center text-sm font-medium text-foreground transition active:scale-[0.99]"
            >
              Download MP3
            </a>
            <a
              href={result.scriptUrl}
              download={`${result.name}.txt`}
              className="flex-1 rounded-xl border border-border py-2.5 text-center text-sm font-medium text-foreground transition active:scale-[0.99]"
            >
              Download script
            </a>
          </div>

          <div className="rounded-2xl border border-border bg-card">
            <button
              onClick={() => setScriptOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
            >
              Read the script by section
              <span className="text-muted">{scriptOpen ? "−" : "+"}</span>
            </button>
            {scriptOpen && (
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
                {result.plan.sections.map((sec, i) => (
                  <div key={i}>
                    <p className="mb-1 text-xs font-semibold text-foreground">{sec.title}</p>
                    <p className="whitespace-pre-line text-xs leading-relaxed text-muted">
                      {result.scripts[i]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-muted">
            Not saved — download the MP3 to keep it.
          </p>
        </section>
      )}
    </div>
  );
}

function Steps({
  stage,
  sectionProgress,
  mode,
}: {
  stage: Stage;
  sectionProgress: { done: number; total: number };
  mode: Mode;
}) {
  const writingSub =
    stage === "writing" && sectionProgress.total > 0
      ? `${sectionProgress.done}/${sectionProgress.total} parts written`
      : undefined;

  const steps: { key: Stage; label: string; sub?: string }[] = [
    { key: "planning", label: mode === "story" ? "Planning the story arc" : "Planning the lesson outline" },
    {
      key: "writing",
      label: mode === "story" ? "Writing the story script" : "Writing the teaching script",
      sub: writingSub,
    },
    { key: "recording", label: "Recording the audio" },
  ];
  const order: Stage[] = ["planning", "writing", "recording"];
  const currentIdx = order.indexOf(stage);

  return (
    <div className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const stepIdx = order.indexOf(s.key);
        const isDone = stepIdx < currentIdx;
        const isCurrent = stepIdx === currentIdx;
        return (
          <div key={s.key} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                isDone
                  ? "bg-[#3f7a53] text-white"
                  : isCurrent
                    ? "animate-pulse bg-accent text-white"
                    : "bg-[#efece3] text-muted"
              }`}
            >
              {isDone ? "✓" : i + 1}
            </span>
            <div>
              <p className={`text-sm ${isCurrent ? "font-semibold text-foreground" : "text-muted"}`}>
                {s.label}
              </p>
              {s.sub && isCurrent && <p className="text-[11px] text-muted">{s.sub}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
