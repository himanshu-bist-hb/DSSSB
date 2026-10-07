import Link from "next/link";
import { auth } from "@/lib/auth";
import { formatScore, listMockTests } from "@/lib/mock";
import { TopBar } from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function MockTestsPage() {
  const session = await auth();
  const tests = await listMockTests(session!.user.id);

  return (
    <div className="flex flex-1 flex-col">
      <TopBar backHref="/" eyebrow="Home" title="Mock Tests" />

      <div className="page-wrap flex flex-1 flex-col gap-2.5 py-4 lg:grid lg:flex-none lg:grid-cols-2 lg:content-start lg:gap-5 lg:py-8 xl:grid-cols-3">
        <p className="px-1 text-xs font-medium text-muted lg:col-span-full lg:text-sm">
          Full-length timed tests in the real exam format, with negative marking and a detailed analysis.
        </p>

        {tests.map((t) => (
          <Link
            key={t.id}
            href={`/mock-tests/${t.slug}`}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition active:scale-[0.99] lg:hover:border-accent lg:hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">{t.title}</p>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{t.description}</p>
                )}
              </div>
              {t.inProgressId ? (
                <span className="shrink-0 rounded-md bg-[#f8ecdd] px-2 py-1 text-[11px] font-medium text-[#a3672b]">
                  In progress
                </span>
              ) : t.attemptsCount > 0 ? (
                <span className="shrink-0 rounded-md bg-[#e7f2ea] px-2 py-1 text-[11px] font-medium text-[#3f7a53]">
                  Attempted
                </span>
              ) : (
                <span className="shrink-0 rounded-md bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent">
                  New
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Fact label="Questions" value={t.questionCount} />
              <Fact label="Marks" value={formatScore(t.totalMarks)} />
              <Fact label="Minutes" value={t.durationMin} />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
              <span className="text-muted">
                {t.attemptsCount > 0
                  ? `Best score: ${formatScore(t.bestScore!)} / ${formatScore(t.totalMarks)}`
                  : "Not attempted yet"}
              </span>
              <span className="font-semibold text-accent">
                {t.inProgressId ? "Resume →" : t.attemptsCount > 0 ? "View / Retake →" : "Start →"}
              </span>
            </div>
          </Link>
        ))}

        {tests.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center lg:col-span-full">
            <p className="text-3xl">📋</p>
            <p className="mt-2 text-sm font-semibold text-foreground">Mock tests are coming soon</p>
            <p className="mt-1 text-xs text-muted">New full-length tests will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-[#f5f3ec] px-2 py-2.5">
      <p className="text-base font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
