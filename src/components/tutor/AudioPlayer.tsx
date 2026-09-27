"use client";

import { useEffect, useRef, useState } from "react";
import { formatMinSec } from "@/lib/tutor/client-utils";

const PRESETS = [1, 1.25, 1.5, 1.75, 2];
const SPEED_KEY = "ai-tutor-speed";

function initialSpeed(): number {
  try {
    const saved = parseFloat(localStorage.getItem(SPEED_KEY) || "");
    if (saved >= 0.25 && saved <= 4) return saved;
  } catch {
    // localStorage unavailable — fall back to default speed
  }
  return 1;
}

export function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState(initialSpeed);
  const [duration, setDuration] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = speed;
    try {
      localStorage.setItem(SPEED_KEY, String(speed));
    } catch {
      // best-effort only
    }
  }, [speed]);

  function apply(v: number) {
    const clamped = Math.min(4, Math.max(0.25, v));
    setSpeed(clamped);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <audio
        ref={audioRef}
        controls
        preload="auto"
        src={src}
        className="w-full"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          e.currentTarget.playbackRate = speed;
        }}
        onPlay={(e) => {
          e.currentTarget.playbackRate = speed;
        }}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-muted">Speed</span>
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => apply(p)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              Math.abs(speed - p) < 1e-6
                ? "border-accent bg-accent text-white"
                : "border-border text-muted hover:border-accent/50"
            }`}
          >
            {p}x
          </button>
        ))}
        <button
          onClick={() => setCustomOpen((v) => !v)}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
            !PRESETS.includes(speed)
              ? "border-accent bg-accent text-white"
              : "border-border text-muted hover:border-accent/50"
          }`}
        >
          {!PRESETS.includes(speed) ? `${speed.toFixed(2)}x` : "Custom"}
        </button>
        {customOpen && (
          <input
            type="number"
            min={0.25}
            max={4}
            step={0.05}
            defaultValue={speed}
            autoFocus
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (v >= 0.25 && v <= 4) apply(v);
            }}
            className="w-16 rounded-lg border border-border bg-transparent px-2 py-1 text-xs"
          />
        )}
      </div>
      {duration != null && (
        <p className="text-[11px] text-muted">
          Length {formatMinSec(duration)} at 1x → {formatMinSec(duration / speed)} at {speed}x
        </p>
      )}
    </div>
  );
}
