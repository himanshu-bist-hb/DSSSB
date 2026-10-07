"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartButton({
  testId,
  slug,
  label,
}: {
  testId: string;
  slug: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/mock/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId }),
      });
      if (!res.ok) throw new Error();
      const { attemptId } = (await res.json()) as { attemptId: string };
      router.push(`/mock-tests/${slug}/attempt/${attemptId}`);
    } catch {
      setError("Could not start the test. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={start}
        disabled={pending}
        className="rounded-xl bg-accent px-8 py-3.5 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Starting…" : label}
      </button>
      {error && <p className="text-xs text-[#8a2f2f]">{error}</p>}
    </div>
  );
}
