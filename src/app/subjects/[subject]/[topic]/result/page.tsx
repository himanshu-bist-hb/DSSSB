import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTopicResult } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { DifficultyPill } from "@/components/DifficultyPill";
import { ResultActions } from "@/components/ResultActions";

export default async function TopicResultPage({
  params,
}: {
  params: Promise<{ subject: string; topic: string }>;
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params;
  const session = await auth();
  const data = await getTopicResult(subjectSlug, topicSlug, session!.user.id);
  if (!data) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        backHref={`/subjects/${subjectSlug}/${topicSlug}`}
        eyebrow={data.subject.name}
        title={`${data.topic.name} · Result`}
      />

      <div className="flex flex-1 flex-col gap-5 px-5 py-4">
        <div className="flex gap-2.5">
          <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
            <p className="text-xl font-semibold text-foreground">
              {data.attempted}/{data.totalQuestions}
            </p>
            <p className="text-[11px] font-medium text-muted">Attempted</p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
            <p className="text-xl font-semibold text-[#3f7a53]">{data.correct}</p>
            <p className="text-[11px] font-medium text-muted">Correct</p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
            <p className="text-xl font-semibold text-[#a13a3a]">{data.wrong}</p>
            <p className="text-[11px] font-medium text-muted">Wrong</p>
          </div>
        </div>

        <section className="flex flex-col gap-2.5">
          <p className="px-1 text-xs font-medium text-muted">PYQ performance</p>
          <div className="flex gap-2.5">
            <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
              <p className="text-lg font-semibold text-foreground">{data.pyqAttempted}</p>
              <p className="text-[11px] font-medium text-muted">PYQ attempted</p>
            </div>
            <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
              <p className="text-lg font-semibold text-[#3f7a53]">{data.pyqCorrect}</p>
              <p className="text-[11px] font-medium text-muted">PYQ correct</p>
            </div>
            <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
              <p className="text-lg font-semibold text-[#a13a3a]">{data.pyqWrong}</p>
              <p className="text-[11px] font-medium text-muted">PYQ wrong</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <p className="px-1 text-xs font-medium text-muted">Retry</p>
          <ResultActions topicId={data.topic.id} />
        </section>

        <section className="flex flex-col gap-2.5">
          <p className="px-1 text-xs font-medium text-muted">
            {data.wrong > 0 ? "Questions you got wrong" : "Wrong answers"}
          </p>

          {data.wrongQuestions.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card px-4 py-4 text-center text-sm text-muted">
              {data.attempted === 0
                ? "No attempts yet in this topic."
                : "No wrong answers — nice work!"}
            </p>
          ) : (
            data.wrongQuestions.map((q, i) => {
              const selected = q.options.find((o) => o.id === q.selectedOption);
              const correct = q.options.find((o) => o.id === q.correctOption);
              return (
                <div
                  key={q.id}
                  className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-muted">Q{i + 1}</p>
                    <DifficultyPill difficulty={q.difficulty} />
                    {q.isPYQ && (
                      <span className="rounded-md bg-[#efece3] px-2 py-0.5 text-[11px] font-medium text-muted">
                        PYQ{q.pyqYear ? ` · ${q.pyqYear}` : ""}
                      </span>
                    )}
                  </div>
                  {q.isPYQ && q.pyqShift && (
                    <p className="text-[11px] text-muted">Asked in: {q.pyqShift}</p>
                  )}
                  <p className="text-sm leading-relaxed text-foreground">{q.text}</p>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start gap-2 rounded-xl border border-[#a13a3a] bg-[#f8e6e6] px-3 py-2 text-xs text-[#8a2f2f]">
                      <span className="mt-0.5">✕</span>
                      <span>
                        Your answer: {q.selectedOption ? selected?.text ?? q.selectedOption : "—"}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 rounded-xl border border-[#3f7a53] bg-[#e7f2ea] px-3 py-2 text-xs text-[#2f5f42]">
                      <span className="mt-0.5">✓</span>
                      <span>Correct answer: {correct?.text ?? q.correctOption}</span>
                    </div>
                  </div>

                  {q.explanation && (
                    <div className="rounded-xl bg-[#f5f3ec] p-3">
                      <p className="mb-1 text-[11px] font-semibold text-foreground">
                        Explanation
                      </p>
                      <p className="text-xs leading-relaxed text-muted">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
