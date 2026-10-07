"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatTurn, DoubtHistoryEntry, DoubtSolution } from "@/lib/doubt/types";
import { compressImage, loadHistory, saveToHistory, toThumbnail } from "@/lib/doubt/client-utils";

type Stage = "capture" | "solving" | "result" | "error";
type ResultTab = "explanation" | "tricks";

const MAX_IMAGES = 3;

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

const CONFIDENCE_LABEL: Record<DoubtSolution["confidence"], string> = {
  high: "Confident",
  medium: "Fairly confident",
  low: "Low confidence",
};

const CONFIDENCE_CLASS: Record<DoubtSolution["confidence"], string> = {
  high: "bg-[#e7f2ea] text-[#3f7a53]",
  medium: "bg-[#f8ecdd] text-[#a3672b]",
  low: "bg-[#f8e6e6] text-[#a13a3a]",
};

export function DoubtClient() {
  const [images, setImages] = useState<string[]>([]);
  const [context, setContext] = useState("");
  const [stage, setStage] = useState<Stage>("capture");
  const [error, setError] = useState<string | null>(null);
  const [solution, setSolution] = useState<DoubtSolution | null>(null);
  const [tab, setTab] = useState<ResultTab>("explanation");
  const [copied, setCopied] = useState(false);

  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  const [history, setHistory] = useState<DoubtHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const busy = stage === "solving";

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  async function addFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    setError(null);
    const room = MAX_IMAGES - images.length;
    const files = Array.from(fileList).slice(0, Math.max(0, room));
    try {
      const compressed = await Promise.all(files.map((f) => compressImage(f)));
      setImages((prev) => [...prev, ...compressed]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image.");
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function reset() {
    setImages([]);
    setContext("");
    setSolution(null);
    setChat([]);
    setChatInput("");
    setError(null);
    setStage("capture");
  }

  async function solve() {
    if (busy || images.length === 0) return;
    setError(null);
    setStage("solving");
    try {
      const res = await fetch("/api/doubt/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, context }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not solve this doubt."));
      const { solution } = (await res.json()) as { solution: DoubtSolution };
      setSolution(solution);
      setChat([]);
      setTab("explanation");
      setStage("result");

      const thumb = await toThumbnail(images[0]);
      setHistory(saveToHistory(thumb, solution));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("error");
    }
  }

  async function sendFollowup() {
    const text = chatInput.trim();
    if (!text || chatBusy || !solution) return;
    setChatInput("");
    const nextHistory: ChatTurn[] = [...chat, { role: "user", content: text }];
    setChat(nextHistory);
    setChatBusy(true);
    try {
      const res = await fetch("/api/doubt/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: solution.question,
          answer: solution.answer,
          explanation: solution.explanation,
          history: nextHistory,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not answer that."));
      const { reply } = (await res.json()) as { reply: string };
      setChat((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setChat((prev) => [
        ...prev,
        { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong." },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  function copyAnswer() {
    if (!solution) return;
    const text = `Q: ${solution.question}\n\nAnswer: ${solution.answer}\n\nExplanation:\n${solution.explanation}${
      solution.shortTricks.length ? `\n\nShort tricks:\n${solution.shortTricks.map((t) => `- ${t}`).join("\n")}` : ""
    }`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function openHistoryEntry(entry: DoubtHistoryEntry) {
    setImages([entry.thumbnail]);
    setSolution(entry.solution);
    setChat([]);
    setTab("explanation");
    setStage("result");
    setHistoryOpen(false);
  }

  return (
    <div className="page-wrap flex flex-1 flex-col gap-5 py-4 lg:max-w-[920px]! lg:py-8">
      {stage === "capture" && (
        <>
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-lg">
                📷
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Stuck on a question?</p>
                <p className="text-xs text-muted">Snap a photo or upload one - get the answer, a full explanation, and exam tricks</p>
              </div>
            </div>

            {images.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {images.map((src, i) => (
                  <div key={i} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Question ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white"
                      aria-label="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length < MAX_IMAGES && (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-background px-3 py-4 text-xs font-medium text-foreground transition active:scale-[0.98]"
                >
                  <span className="text-xl">📸</span>
                  Take photo
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-background px-3 py-4 text-xs font-medium text-foreground transition active:scale-[0.98]"
                >
                  <span className="text-xl">🖼️</span>
                  Upload photo
                </button>
              </div>
            )}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {images.length >= MAX_IMAGES && (
              <p className="mt-1 text-[11px] text-muted">Up to {MAX_IMAGES} photos per question.</p>
            )}

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-muted">
                Anything to add? (optional)
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={2}
                placeholder="e.g. this is Q.14, I think the answer is (b) but not sure why"
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none"
              />
            </div>

            <button
              onClick={solve}
              disabled={images.length === 0}
              className="mt-3 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-40"
            >
              Solve my doubt
            </button>
          </section>

          {history.length > 0 && (
            <section className="rounded-2xl border border-border bg-card">
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
              >
                Recent doubts ({history.length})
                <span className="text-muted">{historyOpen ? "−" : "+"}</span>
              </button>
              {historyOpen && (
                <div className="flex flex-col gap-1 border-t border-border p-2">
                  {history.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => openHistoryEntry(entry)}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 text-left transition active:scale-[0.99] hover:bg-background"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entry.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">{entry.solution.topic}</p>
                        <p className="truncate text-[11px] text-muted">{entry.solution.answer}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {stage === "solving" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm font-semibold text-foreground">Reading your question…</p>
          <p className="text-xs text-muted">Working out the answer, the explanation, and quick tricks for it</p>
        </section>
      )}

      {stage === "error" && (
        <section className="flex flex-col gap-3 rounded-2xl border border-[#a13a3a] bg-[#f8e6e6] p-4">
          <div>
            <p className="text-sm font-semibold text-[#8a2f2f]">Something went wrong</p>
            <p className="mt-1 text-xs text-[#8a2f2f]">{error}</p>
          </div>
          <button
            onClick={() => setStage("capture")}
            className="rounded-xl border border-[#a13a3a] py-2.5 text-center text-sm font-medium text-[#8a2f2f] transition active:scale-[0.99]"
          >
            Try again
          </button>
        </section>
      )}

      {stage === "result" && solution && (
        <section className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                  {solution.subject}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_CLASS[solution.confidence]}`}>
                  {CONFIDENCE_LABEL[solution.confidence]}
                </span>
              </div>
              <p className="text-xs font-medium text-muted">{solution.topic}</p>
            </div>
            <button
              onClick={reset}
              className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
            >
              New doubt
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-1 text-xs font-medium text-muted">Question</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{solution.question}</p>
          </div>

          <div className="rounded-2xl border border-accent bg-accent-soft p-4">
            <p className="mb-1 text-xs font-medium text-accent">Answer</p>
            <p className="whitespace-pre-line text-base font-semibold leading-snug text-foreground">{solution.answer}</p>
          </div>

          {solution.notes && (
            <div className="rounded-2xl border border-[#a3672b] bg-[#f8ecdd] p-3">
              <p className="text-xs leading-relaxed text-[#7a4e1f]">⚠️ {solution.notes}</p>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card">
            <div className="flex border-b border-border">
              <button
                onClick={() => setTab("explanation")}
                className={`flex-1 py-2.5 text-center text-xs font-semibold transition ${
                  tab === "explanation" ? "text-accent" : "text-muted"
                }`}
              >
                Explanation
              </button>
              <button
                onClick={() => setTab("tricks")}
                className={`flex-1 py-2.5 text-center text-xs font-semibold transition ${
                  tab === "tricks" ? "text-accent" : "text-muted"
                }`}
              >
                Short tricks{solution.shortTricks.length ? ` (${solution.shortTricks.length})` : ""}
              </button>
            </div>
            <div className="p-4">
              {tab === "explanation" ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{solution.explanation}</p>
              ) : solution.shortTricks.length ? (
                <ul className="flex flex-col gap-2.5">
                  {solution.shortTricks.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                        ⚡
                      </span>
                      <span className="text-sm leading-relaxed text-foreground">{tip}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No shortcuts needed for this one.</p>
              )}
            </div>
          </div>

          <button
            onClick={copyAnswer}
            className="rounded-xl border border-border py-2.5 text-center text-sm font-medium text-foreground transition active:scale-[0.99]"
          >
            {copied ? "Copied ✓" : "Copy answer + explanation"}
          </button>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-medium text-muted">Still confused? Ask a follow-up</p>
            {chat.length > 0 && (
              <div className="mb-3 flex flex-col gap-2.5">
                {chat.map((turn, i) => (
                  <div
                    key={i}
                    className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      turn.role === "user"
                        ? "ml-6 bg-accent-soft text-foreground"
                        : "mr-6 bg-background text-foreground"
                    }`}
                  >
                    {turn.content}
                  </div>
                ))}
                {chatBusy && <div className="mr-6 rounded-xl bg-background px-3 py-2 text-xs text-muted">Thinking…</div>}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendFollowup()}
                placeholder="e.g. why not option (c)?"
                disabled={chatBusy}
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none disabled:opacity-60"
              />
              <button
                onClick={sendFollowup}
                disabled={chatBusy || !chatInput.trim()}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-40"
              >
                Ask
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
