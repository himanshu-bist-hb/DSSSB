"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DifficultyPill } from "@/components/DifficultyPill";

type Progress = {
  status: "ATTEMPTED" | "REVEALED";
  selectedOption: string | null;
  isCorrect: boolean | null;
  correctOption: string;
  explanation: string | null;
};

type Question = {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  difficulty: "EASY" | "MEDIUM" | "HARD";
  isPYQ: boolean;
  pyqYear: number | null;
  progress: Progress | null;
};

const FILTERS = ["All", "Easy", "Medium", "Hard", "PYQ"] as const;
type Filter = (typeof FILTERS)[number];

export function QuizClient({
  topicId,
  questions: initialQuestions,
  resultHref,
}: {
  topicId: string;
  questions: Question[];
  resultHref: string;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [filter, setFilter] = useState<Filter>("All");
  const [unattemptedOnly, setUnattemptedOnly] = useState(false);
  // Resume where the user left off: land on the first unanswered question
  // instead of always restarting from the top.
  const [index, setIndex] = useState(() => {
    const firstUnattempted = initialQuestions.findIndex((q) => !q.progress);
    return firstUnattempted === -1 ? Math.max(initialQuestions.length - 1, 0) : firstUnattempted;
  });
  const [pending, setPending] = useState(false);
  const [resetting, setResetting] = useState(false);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (filter === "Easy" && q.difficulty !== "EASY") return false;
      if (filter === "Medium" && q.difficulty !== "MEDIUM") return false;
      if (filter === "Hard" && q.difficulty !== "HARD") return false;
      if (filter === "PYQ" && !q.isPYQ) return false;
      if (unattemptedOnly && q.progress) return false;
      return true;
    });
  }, [questions, filter, unattemptedOnly]);

  const boundedIndex = Math.min(index, Math.max(filtered.length - 1, 0));
  const current = filtered[boundedIndex];

  function updateFilter(next: Filter) {
    setFilter(next);
    setIndex(0);
  }

  function toggleUnattempted() {
    setUnattemptedOnly((v) => !v);
    setIndex(0);
  }

  async function answer(optionId: string) {
    if (!current || current.progress || pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: current.id, selectedOption: optionId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === current.id
            ? {
                ...q,
                progress: {
                  status: data.status,
                  selectedOption: data.selectedOption,
                  isCorrect: data.isCorrect,
                  correctOption: data.correctOption,
                  explanation: data.explanation,
                },
              }
            : q
        )
      );
    } finally {
      setPending(false);
    }
  }

  async function reveal() {
    if (!current || current.progress || pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: current.id, reveal: true }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === current.id
            ? {
                ...q,
                progress: {
                  status: data.status,
                  selectedOption: data.selectedOption,
                  isCorrect: data.isCorrect,
                  correctOption: data.correctOption,
                  explanation: data.explanation,
                },
              }
            : q
        )
      );
    } finally {
      setPending(false);
    }
  }

  async function resetTopic() {
    if (resetting) return;
    const confirmed = window.confirm(
      "Clear all your answers for this topic? Every question will become fresh again."
    );
    if (!confirmed) return;
    setResetting(true);
    try {
      const res = await fetch("/api/progress/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      });
      if (!res.ok) return;
      setQuestions((prev) => prev.map((q) => ({ ...q, progress: null })));
      setIndex(0);
    } finally {
      setResetting(false);
    }
  }

  const attemptedCount = questions.filter((q) => q.progress).length;
  const allDone = questions.length > 0 && attemptedCount === questions.length;
  const correctCount = questions.filter((q) => q.progress?.isCorrect).length;

  if (questions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-muted">
        No questions in this topic yet.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-1.5 overflow-x-auto px-5 pb-3 pt-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => updateFilter(f)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f
                ? "bg-accent text-white"
                : "bg-[#efece3] text-muted hover:bg-[#e8e5dd]"
            }`}
          >
            {f}
          </button>
        ))}
        <button
          onClick={toggleUnattempted}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            unattemptedOnly
              ? "bg-accent text-white"
              : "bg-[#efece3] text-muted hover:bg-[#e8e5dd]"
          }`}
        >
          Unattempted
        </button>
      </div>

      {!current ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-sm text-muted">
          <p>No questions match this filter.</p>
          <button
            onClick={() => updateFilter("All")}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-5 pb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-muted">
              Question {boundedIndex + 1} of {filtered.length}
            </p>
            <p className="text-xs text-muted">
              {attemptedCount}/{questions.length} done
            </p>
          </div>
          <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-[#efece3]">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${((boundedIndex + 1) / filtered.length) * 100}%` }}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <DifficultyPill difficulty={current.difficulty} />
              {current.isPYQ && (
                <span className="rounded-md bg-[#efece3] px-2 py-0.5 text-[11px] font-medium text-muted">
                  PYQ{current.pyqYear ? ` · ${current.pyqYear}` : ""}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground">{current.text}</p>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {current.options.map((opt) => {
              const p = current.progress;
              const isAnswered = !!p;
              const isSelected = p?.selectedOption === opt.id;
              const isCorrectOpt = isAnswered && p!.correctOption === opt.id;
              const isWrongSelected = isAnswered && isSelected && !isCorrectOpt;

              let cls =
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition";
              if (!isAnswered) {
                cls += " border-border bg-card hover:bg-[#f5f3ec]";
              } else if (isCorrectOpt) {
                cls += " border-[#3f7a53] bg-[#e7f2ea] text-[#2f5f42]";
              } else if (isWrongSelected) {
                cls += " border-[#a13a3a] bg-[#f8e6e6] text-[#8a2f2f]";
              } else {
                cls += " border-border bg-card opacity-60";
              }

              return (
                <button
                  key={opt.id}
                  disabled={isAnswered || pending}
                  onClick={() => answer(opt.id)}
                  className={cls}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-medium uppercase">
                    {opt.id}
                  </span>
                  <span className="flex-1">{opt.text}</span>
                  {isAnswered && isCorrectOpt && <span className="text-xs">✓</span>}
                  {isAnswered && isWrongSelected && <span className="text-xs">✕</span>}
                </button>
              );
            })}
          </div>

          {!current.progress && (
            <button
              onClick={reveal}
              disabled={pending}
              className="mt-3 self-start text-xs font-medium text-muted underline underline-offset-2"
            >
              Show answer
            </button>
          )}

          {current.progress && (
            <div className="mt-3 rounded-2xl border border-border bg-[#f5f3ec] p-4">
              <p className="mb-1 text-xs font-semibold text-foreground">
                {current.progress.status === "REVEALED"
                  ? "Answer revealed"
                  : current.progress.isCorrect
                    ? "Correct!"
                    : "Not quite"}
              </p>
              {current.progress.explanation && (
                <p className="text-xs leading-relaxed text-muted">
                  {current.progress.explanation}
                </p>
              )}
            </div>
          )}

          {allDone && (
            <div className="mt-4 flex flex-col items-center gap-1 rounded-2xl border border-accent bg-accent-soft px-4 py-4 text-center">
              <p className="text-sm font-semibold text-foreground">Section complete 🎉</p>
              <p className="text-xs text-muted">
                {correctCount}/{questions.length} correct
              </p>
              <Link
                href={resultHref}
                className="mt-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                View Result
              </Link>
            </div>
          )}

          <div className="mt-auto flex items-center gap-2 pt-6">
            <button
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={boundedIndex === 0}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setIndex((i) => Math.min(i + 1, filtered.length - 1))}
              disabled={boundedIndex >= filtered.length - 1}
              className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>

          <button
            onClick={resetTopic}
            disabled={resetting}
            className="mt-3 self-center text-xs font-medium text-muted underline underline-offset-2"
          >
            Clear my answers for this topic
          </button>
        </div>
      )}
    </div>
  );
}
