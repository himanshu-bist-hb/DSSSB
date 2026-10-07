"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/format";

type Q = {
  id: string;
  number: number;
  section: string;
  text: string;
  options: { id: string; text: string }[];
  correctOption: string;
  explanation: string | null;
  selected: string | null;
  marked: boolean;
  timeMs: number;
  status: "correct" | "wrong" | "unattempted";
};

const FILTERS = ["All", "Correct", "Wrong", "Unattempted", "Marked"] as const;
type Filter = (typeof FILTERS)[number];

export function ResultReview({ questions }: { questions: Q[] }) {
  const [filter, setFilter] = useState<Filter>("All");

  const shown = questions.filter((q) => {
    if (filter === "Correct") return q.status === "correct";
    if (filter === "Wrong") return q.status === "wrong";
    if (filter === "Unattempted") return q.status === "unattempted";
    if (filter === "Marked") return q.marked;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition lg:text-sm ${
              filter === f ? "bg-accent text-white" : "bg-[#efece3] text-muted hover:bg-[#e8e5dd]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted">
          No questions in this view.
        </p>
      )}

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        {shown.map((q) => (
          <article key={q.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 lg:p-5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
              <span className="text-muted">Q{q.number}</span>
              <span className="rounded-md bg-[#efece3] px-2 py-0.5 text-muted">{q.section}</span>
              <span
                className={`rounded-md px-2 py-0.5 ${
                  q.status === "correct"
                    ? "bg-[#e7f2ea] text-[#3f7a53]"
                    : q.status === "wrong"
                      ? "bg-[#f8e6e6] text-[#a13a3a]"
                      : "bg-[#efece3] text-muted"
                }`}
              >
                {q.status === "correct" ? "Correct" : q.status === "wrong" ? "Wrong" : "Not attempted"}
              </span>
              {q.marked && <span className="rounded-md bg-[#ece8f5] px-2 py-0.5 text-[#5b4b8a]">Marked</span>}
              {q.timeMs > 0 && <span className="ml-auto text-muted">⏱ {formatDuration(q.timeMs)}</span>}
            </div>

            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground lg:text-[15px]">{q.text}</p>

            <div className="flex flex-col gap-1.5">
              {q.options.map((o) => {
                const isCorrect = o.id === q.correctOption;
                const isPicked = o.id === q.selected;
                let cls = "border-border bg-background text-foreground";
                if (isCorrect) cls = "border-[#3f7a53] bg-[#e7f2ea] text-[#2f5f42]";
                else if (isPicked) cls = "border-[#a13a3a] bg-[#f8e6e6] text-[#8a2f2f]";
                return (
                  <div key={o.id} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-xs lg:text-sm ${cls}`}>
                    <span className="mt-px font-semibold uppercase">{o.id}.</span>
                    <span className="flex-1">{o.text}</span>
                    {isCorrect && <span>✓</span>}
                    {isPicked && !isCorrect && <span>✕</span>}
                  </div>
                );
              })}
            </div>

            {q.explanation && (
              <div className="rounded-xl bg-[#f5f3ec] p-3">
                <p className="mb-1 text-[11px] font-semibold text-foreground">Explanation</p>
                <p className="text-xs leading-relaxed text-muted lg:text-sm">{q.explanation}</p>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
