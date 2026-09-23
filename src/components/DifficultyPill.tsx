const STYLES: Record<string, string> = {
  EASY: "bg-[#e7f2ea] text-[#3f7a53]",
  MEDIUM: "bg-[#f8ecdd] text-[#a3672b]",
  HARD: "bg-[#f8e6e6] text-[#a13a3a]",
};

const LABELS: Record<string, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

export function DifficultyPill({ difficulty }: { difficulty: string }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${STYLES[difficulty] ?? ""}`}
    >
      {LABELS[difficulty] ?? difficulty}
    </span>
  );
}
