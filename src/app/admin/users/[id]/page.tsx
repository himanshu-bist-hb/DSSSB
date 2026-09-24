import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAdminUserReport } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { subjectMeta } from "@/lib/subject-meta";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

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
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }}
      />
    </div>
  );
}

const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.isAdmin) notFound();

  const { id } = await params;
  const r = await getAdminUserReport(id);
  if (!r) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <TopBar backHref="/admin" eyebrow="Admin" title={r.user.name ?? r.user.email} />

      <div className="flex flex-1 flex-col gap-6 px-5 py-4">
        <p className="-mb-3 text-xs text-muted">
          {r.user.email} · Joined {fmt.format(r.user.createdAt)}
        </p>

        <div className="flex gap-2.5">
          <StatTile label="Attempted" value={r.answered} />
          <StatTile label="Correct" value={r.correct} />
          <StatTile label="Wrong" value={r.answered - r.correct} />
          <StatTile label="Accuracy" value={`${r.accuracy}%`} />
        </div>
        <p className="-mb-3 text-xs text-muted">
          {r.answered} of {r.totalQuestions} questions answered
        </p>

        {r.subjects.map((s) => {
          const meta = subjectMeta(s.slug);
          const pct = pctOf(s.correct, s.answered);
          return (
            <section
              key={s.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3.5"
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
                    {s.answered}/{s.totalQuestions} attempted · {s.correct} correct ·{" "}
                    {s.answered - s.correct} wrong
                    {s.revealed > 0 ? ` · ${s.revealed} revealed` : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {s.answered > 0 ? `${pct}%` : "—"}
                </p>
              </div>
              <Bar pct={pct} color={meta.color} />

              <div className="flex flex-col gap-2.5 border-t border-border pt-3">
                {s.topics.map((t) => {
                  const tp = pctOf(t.correct, t.answered);
                  return (
                    <div key={t.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate font-medium text-foreground">{t.name}</span>
                        <span className="shrink-0 text-muted">
                          {t.answered > 0 ? `${tp}%` : "Not started"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted">
                        {t.answered}/{t.totalQuestions} attempted · {t.correct} correct ·{" "}
                        {t.answered - t.correct} wrong
                        {t.revealed > 0 ? ` · ${t.revealed} revealed` : ""}
                        {t.lastAt ? ` · last ${fmt.format(t.lastAt)}` : ""}
                      </p>
                      <Bar pct={tp} color={meta.color} />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
