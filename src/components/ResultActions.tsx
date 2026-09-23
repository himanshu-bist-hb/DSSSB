"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Scope = "all" | "wrong" | "correct";

const ACTIONS: { scope: Scope; label: string; confirm: string }[] = [
  {
    scope: "all",
    label: "Clear all answers",
    confirm: "Clear every answer in this topic? All questions become fresh again.",
  },
  {
    scope: "wrong",
    label: "Clear wrong answers",
    confirm: "Clear only the questions you got wrong (or revealed)? Correct answers are kept.",
  },
  {
    scope: "correct",
    label: "Clear correct answers",
    confirm: "Clear only the questions you got right? Wrong answers are kept.",
  },
];

export function ResultActions({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<Scope | null>(null);

  async function clear(scope: Scope, confirmMsg: string) {
    if (pending) return;
    if (!window.confirm(confirmMsg)) return;
    setPending(scope);
    try {
      const res = await fetch("/api/progress/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, scope }),
      });
      if (!res.ok) return;
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((a) => (
        <button
          key={a.scope}
          onClick={() => clear(a.scope, a.confirm)}
          disabled={pending !== null}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition disabled:opacity-50"
        >
          {pending === a.scope ? "Clearing…" : a.label}
        </button>
      ))}
    </div>
  );
}
