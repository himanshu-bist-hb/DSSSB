import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  finalizeAttempt,
  getAttemptForExam,
  parseAnswers,
  parseOptions,
  secondsRemaining,
} from "@/lib/mock";
import { ExamClient } from "@/components/mock/ExamClient";

export const dynamic = "force-dynamic";

export default async function MockAttemptPage({
  params,
}: {
  params: Promise<{ slug: string; attemptId: string }>;
}) {
  const { slug, attemptId } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const attempt = await getAttemptForExam(attemptId, userId);
  if (!attempt || attempt.test.slug !== slug) notFound();

  const resultHref = `/mock-tests/${slug}/result/${attempt.id}`;
  if (attempt.status === "SUBMITTED") redirect(resultHref);

  const remainingSec = secondsRemaining(attempt.startedAt, attempt.test.durationMin);
  if (remainingSec <= 0) {
    await finalizeAttempt({ attemptId: attempt.id, userId });
    redirect(resultHref);
  }

  // Correct answers and explanations are deliberately NOT sent to the browser.
  const questions = attempt.test.questions.map((q) => ({
    id: q.id,
    section: q.section ?? "General",
    text: q.text,
    options: parseOptions(q.options),
  }));

  return (
    <ExamClient
      attemptId={attempt.id}
      title={attempt.test.title}
      questions={questions}
      initialAnswers={parseAnswers(attempt.answers)}
      remainingSec={remainingSec}
      resultHref={resultHref}
    />
  );
}
