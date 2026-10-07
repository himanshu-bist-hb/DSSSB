import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { formatScore, getMockResult } from "@/lib/mock";
import { formatDuration } from "@/lib/format";
import { formatMinSec } from "@/lib/tutor/client-utils";
import { TopBar } from "@/components/TopBar";
import { ResultReview } from "@/components/mock/ResultReview";

export const dynamic = "force-dynamic";

export default async function MockResultPage({
  params,
}: {
  params: Promise<{ slug: string; attemptId: string }>;
}) {
  const { slug, attemptId } = await params;
  const session = await auth();
  const r = await getMockResult(attemptId, session!.user.id);
  if (!r || r.test.slug !== slug) notFound();

  const pct = r.totalMarks > 0 ? Math.max(0, Math.round((r.score / r.totalMarks) * 100)) : 0;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar backHref={`/mock-tests/${slug}`} eyebrow="Mock Test" title={`${r.test.title} · Result`} />

      <div className="page-wrap flex flex-1 flex-col gap-6 py-4 lg:py-8">
        <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 lg:flex-row lg:items-center lg:gap-10 lg:p-8">
          <div className="flex items-center gap-5">
            <div
              className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full lg:h-36 lg:w-36"
              style={{ background: `conic-gradient(var(--accent) ${pct * 3.6}deg, #efece3 0deg)` }}
            >
              <div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-card lg:h-28 lg:w-28">
                <p className="text-2xl font-semibold tabular-nums text-foreground lg:text-3xl">{pct}%</p>
                <p className="text-[11px] text-muted">score</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Your score</p>
              <p className="text-3xl font-semibold tabular-nums text-foreground lg:text-4xl">
                {formatScore(r.score)}
                <span className="text-lg font-normal text-muted"> / {formatScore(r.totalMarks)}</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                +{formatScore(r.test.marksPerCorrect)} correct · −{formatScore(r.test.negativeMarks)} wrong
              </p>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Correct" value={r.correct} tone="text-[#3f7a53]" />
            <Tile label="Wrong" value={r.wrong} tone="text-[#a13a3a]" />
            <Tile label="Unattempted" value={r.unattempted} />
            <Tile label="Accuracy" value={`${r.accuracy}%`} />
            <Tile label="Time taken" value={formatMinSec(r.timeTakenSec)} />
            <Tile label="Attempted" value={`${r.attempted}/${r.questions.length}`} />
            <Tile
              label="Avg / question"
              value={r.attempted > 0 ? formatDuration((r.timeTakenSec * 1000) / r.attempted) : "—"}
            />
            <Tile label="Allowed time" value={`${r.test.durationMin}m`} />
          </div>
        </section>

        {r.sections.length > 1 && (
          <section className="flex flex-col gap-2.5">
            <p className="px-1 text-xs font-medium text-muted lg:text-sm">Section-wise performance</p>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-border text-xs text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Section</th>
                    <th className="px-3 py-3 text-right font-medium">Questions</th>
                    <th className="px-3 py-3 text-right font-medium">Correct</th>
                    <th className="px-3 py-3 text-right font-medium">Wrong</th>
                    <th className="px-3 py-3 text-right font-medium">Skipped</th>
                    <th className="px-3 py-3 text-right font-medium">Marks</th>
                    <th className="px-4 py-3 text-right font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {r.sections.map((s) => (
                    <tr key={s.name}>
                      <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                      <td className="px-3 py-3 text-right">{s.total}</td>
                      <td className="px-3 py-3 text-right text-[#3f7a53]">{s.correct}</td>
                      <td className="px-3 py-3 text-right text-[#a13a3a]">{s.wrong}</td>
                      <td className="px-3 py-3 text-right text-muted">{s.unattempted}</td>
                      <td className="px-3 py-3 text-right font-semibold">
                        {formatScore(s.correct * r.test.marksPerCorrect - s.wrong * r.test.negativeMarks)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">{formatMinSec(s.timeMs / 1000)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="px-1 text-xs font-medium text-muted lg:text-sm">Review all questions</p>
            <Link
              href={`/mock-tests/${slug}`}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
            >
              Retake test
            </Link>
          </div>
          <ResultReview questions={r.questions} />
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl bg-[#f5f3ec] px-3 py-3">
      <p className={`text-lg font-semibold tabular-nums ${tone ?? "text-foreground"}`}>{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
