import { auth } from "@/lib/auth";
import { getUserStats } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { subjectMeta } from "@/lib/subject-meta";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-[11px] font-medium text-muted">{label}</p>
    </div>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#efece3]">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }}
      />
    </div>
  );
}

const DIFFICULTY_LABEL: Record<string, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
const DIFFICULTY_COLOR: Record<string, string> = {
  EASY: "var(--easy)",
  MEDIUM: "var(--medium)",
  HARD: "var(--hard)",
};

export default async function StatsPage() {
  const session = await auth();
  const stats = await getUserStats(session!.user.id);

  return (
    <div className="flex flex-1 flex-col">
      <TopBar backHref="/" eyebrow="Home" title="Your Performance" />

      <div className="flex flex-1 flex-col gap-6 px-5 py-4">
        <div className="flex gap-2.5">
          <StatTile label="Attempted" value={stats.answered} />
          <StatTile label="Correct" value={stats.correct} />
          <StatTile label="Accuracy" value={`${stats.accuracy}%`} />
        </div>

        <p className="-mb-3 text-xs text-muted">
          {stats.answered} of {stats.totalQuestions} questions answered
          {stats.incorrect > 0 ? ` · ${stats.incorrect} incorrect` : ""}
        </p>

        <section className="flex flex-col gap-2.5">
          <p className="px-1 text-xs font-medium text-muted">By subject</p>
          {stats.bySubject.length === 0 && (
            <p className="rounded-2xl border border-border bg-card px-4 py-4 text-center text-sm text-muted">
              No attempts yet — start a topic to see your stats here.
            </p>
          )}
          {stats.bySubject.map((s) => {
            const meta = subjectMeta(s.slug);
            const pct = s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0;
            return (
              <div
                key={s.id}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
                    style={{ backgroundColor: meta.soft, color: meta.color }}
                  >
                    {meta.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted">
                      {s.correct}/{s.attempted} correct
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{pct}%</p>
                </div>
                <Bar pct={pct} color={meta.color} />
              </div>
            );
          })}
        </section>

        <section className="flex flex-col gap-2.5">
          <p className="px-1 text-xs font-medium text-muted">By difficulty</p>
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3.5">
            {(["EASY", "MEDIUM", "HARD"] as const).map((d) => {
              const t = stats.byDifficulty[d];
              const pct = t.attempted > 0 ? Math.round((t.correct / t.attempted) * 100) : 0;
              return (
                <div key={d} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{DIFFICULTY_LABEL[d]}</span>
                    <span className="text-muted">
                      {t.attempted > 0 ? `${t.correct}/${t.attempted} · ${pct}%` : "Not attempted"}
                    </span>
                  </div>
                  <Bar pct={pct} color={DIFFICULTY_COLOR[d]} />
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <p className="px-1 text-xs font-medium text-muted">Previous year vs practice</p>
          <div className="flex gap-2.5">
            {[
              { label: "PYQ", t: stats.pyq },
              { label: "Practice", t: stats.nonPyq },
            ].map(({ label, t }) => {
              const pct = t.attempted > 0 ? Math.round((t.correct / t.attempted) * 100) : 0;
              return (
                <div
                  key={label}
                  className="flex flex-1 flex-col gap-1.5 rounded-2xl border border-border bg-card px-4 py-3.5"
                >
                  <p className="text-xs font-medium text-muted">{label}</p>
                  <p className="text-lg font-semibold text-foreground">
                    {t.attempted > 0 ? `${pct}%` : "—"}
                  </p>
                  <p className="text-[11px] text-muted">{t.correct}/{t.attempted} correct</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
