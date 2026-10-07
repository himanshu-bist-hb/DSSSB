import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { formatScore, getMockTestOverview, secondsRemaining } from "@/lib/mock";
import { formatMinSec } from "@/lib/tutor/client-utils";
import { TopBar } from "@/components/TopBar";
import { StartButton } from "@/components/mock/StartButton";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export default async function MockTestIntroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const data = await getMockTestOverview(slug, session!.user.id);
  if (!data) notFound();
  const { test, sections, inProgress, history } = data;

  const resumable =
    inProgress && secondsRemaining(inProgress.startedAt, test.durationMin) > 0 ? inProgress : null;

  const rules = [
    `The test has ${test.questionCount} questions and must be completed in ${test.durationMin} minutes.`,
    `Each correct answer gives +${formatScore(test.marksPerCorrect)} mark${test.marksPerCorrect === 1 ? "" : "s"}.`,
    test.negativeMarks > 0
      ? `Each wrong answer deducts ${formatScore(test.negativeMarks)} mark. Unattempted questions carry no penalty.`
      : "There is no negative marking.",
    "The timer keeps running even if you refresh or close the page. The test is submitted automatically when time is up.",
    "Use Mark for Review to come back to a question. Marked questions that have an answer are still evaluated.",
    "Your answers are saved automatically as you go.",
  ];

  return (
    <div className="flex flex-1 flex-col">
      <TopBar backHref="/mock-tests" eyebrow="Mock Tests" title={test.title} />

      <div className="page-wrap flex flex-1 flex-col gap-5 py-4 lg:grid lg:flex-none lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8 lg:py-8">
        <div className="flex flex-col gap-5">
          {test.description && <p className="text-sm text-muted lg:text-base">{test.description}</p>}

          <section className="rounded-2xl border border-border bg-card p-5 lg:p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Instructions</p>
            <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-sm leading-relaxed text-foreground lg:text-[15px]">
              {rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">
              Question palette colours
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
              {[
                ["border-border bg-card", "Not visited"],
                ["border-[#a13a3a] bg-[#f8e6e6]", "Not answered"],
                ["border-[#3f7a53] bg-[#3f7a53]", "Answered"],
                ["border-[#5b4b8a] bg-[#5b4b8a]", "Marked for review"],
              ].map(([cls, label]) => (
                <span key={label} className="flex items-center gap-2">
                  <i className={`h-4 w-4 rounded border ${cls}`} /> {label}
                </span>
              ))}
            </div>
          </section>

          {history.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5 lg:p-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your attempts</p>
              <div className="mt-3 flex flex-col divide-y divide-border">
                {history.map((h, i) => (
                  <Link
                    key={h.id}
                    href={`/mock-tests/${test.slug}/result/${h.id}`}
                    className="flex items-center justify-between gap-3 py-3 text-sm transition hover:text-accent"
                  >
                    <span>
                      <span className="font-medium text-foreground">Attempt {history.length - i}</span>
                      <span className="block text-xs text-muted">
                        {fmt.format(h.submittedAt)} · {formatMinSec(h.timeTakenSec)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatScore(h.score)} / {formatScore(test.totalMarks)}
                      </span>
                      <span className="block text-xs text-muted">
                        {h.correct} correct · {h.wrong} wrong
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24 lg:p-7">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Questions" value={test.questionCount} />
            <Stat label="Marks" value={formatScore(test.totalMarks)} />
            <Stat label="Minutes" value={test.durationMin} />
          </div>

          {sections.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sections</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {sections.map((s) => (
                  <li key={s.name} className="flex justify-between">
                    <span className="text-foreground">{s.name}</span>
                    <span className="tabular-nums text-muted">{s.count} Qs</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resumable && (
            <p className="rounded-xl bg-[#f8ecdd] px-4 py-3 text-xs text-[#a3672b]">
              You have a test in progress (
              {formatMinSec(secondsRemaining(resumable.startedAt, test.durationMin))} left).
            </p>
          )}

          <StartButton
            testId={test.id}
            slug={test.slug}
            label={resumable ? "Resume test" : history.length > 0 ? "Start new attempt" : "Start test"}
          />
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-[#f5f3ec] px-2 py-3">
      <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
