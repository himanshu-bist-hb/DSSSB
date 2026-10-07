"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Answers } from "@/lib/mock";

type ExamQuestion = {
  id: string;
  section: string;
  text: string;
  options: { id: string; text: string }[];
};

type Props = {
  attemptId: string;
  title: string;
  questions: ExamQuestion[];
  initialAnswers: Answers;
  remainingSec: number;
  resultHref: string;
};

type Status = "unvisited" | "unanswered" | "answered" | "marked" | "answeredMarked";

function statusOf(a: Answers[string] | undefined): Status {
  if (!a || !a.visited) return "unvisited";
  if (a.sel && a.marked) return "answeredMarked";
  if (a.sel) return "answered";
  if (a.marked) return "marked";
  return "unanswered";
}

const STATUS_STYLE: Record<Status, string> = {
  unvisited: "border-border bg-card text-foreground",
  unanswered: "border-[#a13a3a] bg-[#f8e6e6] text-[#8a2f2f]",
  answered: "border-[#3f7a53] bg-[#3f7a53] text-white",
  marked: "border-[#5b4b8a] bg-[#5b4b8a] text-white",
  answeredMarked: "border-[#5b4b8a] bg-[#5b4b8a] text-white",
};

function clock(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function ExamClient({
  attemptId,
  title,
  questions,
  initialAnswers,
  remainingSec,
  resultHref,
}: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(() => {
    const first = questions[0];
    if (!first) return initialAnswers;
    const prev = initialAnswers[first.id] ?? { sel: null, marked: false, timeMs: 0 };
    return { ...initialAnswers, [first.id]: { ...prev, visited: true } };
  });
  const answersRef = useRef(answers);
  const [index, setIndex] = useState(0);
  const enteredAtRef = useRef(0);
  const [remaining, setRemaining] = useState(remainingSec);
  const [confirming, setConfirming] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const current = questions[index];

  const sections = useMemo(() => {
    const out: { name: string; start: number; count: number }[] = [];
    questions.forEach((q, i) => {
      const last = out[out.length - 1];
      if (last && last.name === q.section) last.count++;
      else out.push({ name: q.section, start: i, count: 1 });
    });
    return out;
  }, [questions]);
  const activeSection = sections.find((s) => index >= s.start && index < s.start + s.count);

  const apply = useCallback((fn: (prev: Answers) => Answers) => {
    const next = fn(answersRef.current);
    answersRef.current = next;
    setAnswers(next);
  }, []);

  // Adds the time spent since the question was shown to its running total.
  const commitTime = useCallback(
    (qId: string) => {
      const now = Date.now();
      const delta = enteredAtRef.current ? now - enteredAtRef.current : 0;
      enteredAtRef.current = now;
      if (delta <= 0) return;
      apply((prev) => {
        const cur = prev[qId] ?? { sel: null, marked: false, visited: true, timeMs: 0 };
        return { ...prev, [qId]: { ...cur, timeMs: cur.timeMs + delta } };
      });
    },
    [apply]
  );

  useEffect(() => {
    enteredAtRef.current = Date.now();
  }, []);

  function patch(qId: string, change: Partial<Answers[string]>) {
    apply((prev) => {
      const cur = prev[qId] ?? { sel: null, marked: false, visited: true, timeMs: 0 };
      return { ...prev, [qId]: { ...cur, ...change } };
    });
  }

  function goTo(i: number) {
    if (i < 0 || i >= questions.length || i === index) return;
    commitTime(current.id);
    patch(questions[i].id, { visited: true });
    setIndex(i);
    setPaletteOpen(false);
  }

  // ---- autosave (debounced) ----
  useEffect(() => {
    if (submittedRef.current) return;
    const t = setTimeout(() => {
      fetch(`/api/mock/attempt/${attemptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersRef.current }),
      }).catch(() => {
        // best-effort; the final submit sends the full state again
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [answers, attemptId]);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    if (current) commitTime(current.id);
    try {
      const res = await fetch(`/api/mock/attempt/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersRef.current }),
      });
      if (!res.ok) throw new Error("Submit failed");
      router.replace(resultHref);
    } catch {
      submittedRef.current = false;
      setSubmitting(false);
      setError("Could not submit. Check your connection and try again.");
    }
  }, [attemptId, commitTime, current, resultHref, router]);

  // ---- countdown (derived from a fixed end time, so tab throttling can't drift it) ----
  const endAtRef = useRef(0);
  useEffect(() => {
    endAtRef.current = Date.now() + remainingSec * 1000;
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [remainingSec]);

  useEffect(() => {
    if (remaining === 0) void submit();
  }, [remaining, submit]);

  // Warn before accidentally leaving mid-test.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!submittedRef.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const counts = useMemo(() => {
    const c: Record<Status, number> = {
      unvisited: 0,
      unanswered: 0,
      answered: 0,
      marked: 0,
      answeredMarked: 0,
    };
    for (const q of questions) c[statusOf(answers[q.id])]++;
    return c;
  }, [answers, questions]);

  if (!current) return null;
  const a = answers[current.id];
  const lowTime = remaining <= 300;

  const palette = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-muted">
        <Legend tone="answered" label={`Answered (${counts.answered + counts.answeredMarked})`} />
        <Legend tone="unanswered" label={`Not answered (${counts.unanswered})`} />
        <Legend tone="unvisited" label={`Not visited (${counts.unvisited})`} />
        <Legend tone="marked" label={`Marked (${counts.marked + counts.answeredMarked})`} />
      </div>
      {sections.length > 1 && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {activeSection?.name}
        </p>
      )}
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {questions.map((q, i) => {
          if (activeSection && (i < activeSection.start || i >= activeSection.start + activeSection.count))
            return null;
          const st = statusOf(answers[q.id]);
          return (
            <button
              key={q.id}
              onClick={() => goTo(i)}
              aria-label={`Question ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className={`relative flex h-10 items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition ${STATUS_STYLE[st]} ${
                i === index ? "ring-2 ring-accent ring-offset-1" : ""
              }`}
            >
              {i + 1}
              {st === "answeredMarked" && (
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#3f7a53]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 bg-[#5a1620] px-4 py-3 text-white lg:px-8">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold lg:text-base">{title}</p>
          <p className="text-[11px] text-white/60">
            Question {index + 1} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`rounded-lg px-3 py-1.5 text-center tabular-nums ${
              lowTime ? "animate-pulse bg-[#a13a3a]" : "bg-white/15"
            }`}
            role="timer"
            aria-label="Time left"
          >
            <p className="text-[10px] uppercase leading-none tracking-wide text-white/70">Time left</p>
            <p className="text-base font-semibold leading-tight lg:text-lg">{clock(remaining)}</p>
          </div>
          <button
            onClick={() => setConfirming(true)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-accent transition hover:bg-white/90"
          >
            Submit
          </button>
        </div>
      </header>

      {sections.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-4 lg:px-8">
          {sections.map((s) => {
            const on = s === activeSection;
            return (
              <button
                key={s.name}
                onClick={() => goTo(s.start)}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition ${
                  on ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-10 lg:py-8">
            <div className="mx-auto max-w-4xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Question {index + 1}
              </p>
              <p className="whitespace-pre-line text-base leading-relaxed text-foreground lg:text-xl lg:leading-9">
                {current.text}
              </p>

              <div className="mt-6 flex flex-col gap-3" role="radiogroup">
                {current.options.map((opt) => {
                  const on = a?.sel === opt.id;
                  return (
                    <button
                      key={opt.id}
                      role="radio"
                      aria-checked={on}
                      onClick={() => patch(current.id, { sel: opt.id, visited: true })}
                      className={`flex items-center gap-4 rounded-xl border px-4 py-3.5 text-left text-sm transition lg:px-5 lg:py-4 lg:text-base ${
                        on
                          ? "border-accent bg-accent-soft text-foreground"
                          : "border-border bg-card hover:bg-[#f5f3ec]"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold uppercase ${
                          on ? "border-accent bg-accent text-white" : "border-border text-muted"
                        }`}
                      >
                        {opt.id}
                      </span>
                      <span className="flex-1">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-card px-4 py-3 lg:px-10">
            <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  patch(current.id, { marked: !a?.marked });
                }}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition lg:px-4 lg:text-sm ${
                  a?.marked
                    ? "border-[#5b4b8a] bg-[#ece8f5] text-[#5b4b8a]"
                    : "border-border text-foreground hover:bg-[#f5f3ec]"
                }`}
              >
                {a?.marked ? "Unmark review" : "Mark for review"}
              </button>
              <button
                onClick={() => patch(current.id, { sel: null })}
                disabled={!a?.sel}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition hover:bg-[#f5f3ec] disabled:opacity-40 lg:px-4 lg:text-sm"
              >
                Clear response
              </button>
              <button
                onClick={() => setPaletteOpen(true)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground lg:hidden"
              >
                Palette
              </button>

              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => goTo(index - 1)}
                  disabled={index === 0}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground transition hover:bg-[#f5f3ec] disabled:opacity-40 lg:px-6 lg:text-sm"
                >
                  Previous
                </button>
                {index < questions.length - 1 ? (
                  <button
                    onClick={() => goTo(index + 1)}
                    className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90 lg:px-8 lg:text-sm"
                  >
                    Save &amp; Next
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirming(true)}
                    className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90 lg:px-8 lg:text-sm"
                  >
                    Finish
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>

        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border bg-card p-5 lg:block">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
            Question palette
          </p>
          {palette}
        </aside>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/40 lg:hidden" onClick={() => setPaletteOpen(false)}>
          <div
            className="max-h-[75dvh] w-full overflow-y-auto rounded-t-2xl bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Question palette</p>
              <button onClick={() => setPaletteOpen(false)} className="text-sm text-muted">
                Close
              </button>
            </div>
            {palette}
          </div>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Submit test?</h2>
            <p className="mt-1 text-sm text-muted">You can&apos;t change your answers after submitting.</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Summary label="Answered" value={counts.answered + counts.answeredMarked} />
              <Summary label="Not answered" value={counts.unanswered + counts.unvisited} />
              <Summary label="Marked for review" value={counts.marked + counts.answeredMarked} />
              <Summary label="Time left" value={clock(remaining)} />
            </dl>
            {error && <p className="mt-3 text-sm text-[#8a2f2f]">{error}</p>}
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground disabled:opacity-50"
              >
                Go back
              </button>
              <button
                onClick={() => void submit()}
                disabled={submitting}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {submitting && !confirming && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-background/80 text-sm font-medium text-foreground">
          Submitting your test…
        </div>
      )}
    </div>
  );
}

function Legend({ tone, label }: { tone: Status; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={`h-3.5 w-3.5 rounded-sm border ${STATUS_STYLE[tone]}`} />
      {label}
    </span>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-[#f5f3ec] px-3 py-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
