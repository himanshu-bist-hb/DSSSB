import { z } from "zod";
import { prisma } from "@/lib/prisma";

export type AnswerState = {
  sel: string | null;
  marked: boolean;
  visited: boolean;
  timeMs: number;
};
export type Answers = Record<string, AnswerState>;

export const answersSchema = z.record(
  z.string(),
  z.object({
    sel: z.string().nullable(),
    marked: z.boolean(),
    visited: z.boolean(),
    timeMs: z.number().int().min(0).max(1000 * 60 * 60 * 6),
  })
);

export type McqOption = { id: string; text: string };

export function parseAnswers(raw: string): Answers {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Answers) : {};
  } catch {
    return {};
  }
}

export function parseOptions(raw: string): McqOption[] {
  try {
    return JSON.parse(raw) as McqOption[];
  } catch {
    return [];
  }
}

export function formatScore(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** Seconds left on an in-progress attempt (never negative). */
export function secondsRemaining(startedAt: Date, durationMin: number, now = Date.now()) {
  return Math.max(0, Math.floor(durationMin * 60 - (now - startedAt.getTime()) / 1000));
}

export async function listMockTests(userId: string) {
  const tests = await prisma.mockTest.findMany({
    where: { isPublished: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { questions: true } } },
  });
  const attempts = await prisma.mockAttempt.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    select: { id: true, testId: true, status: true, score: true },
  });

  return tests.map((t) => {
    const mine = attempts.filter((a) => a.testId === t.id);
    const submitted = mine.filter((a) => a.status === "SUBMITTED" && a.score != null);
    return {
      id: t.id,
      slug: t.slug,
      title: t.title,
      description: t.description,
      durationMin: t.durationMin,
      questionCount: t._count.questions,
      totalMarks: t._count.questions * t.marksPerCorrect,
      inProgressId: mine.find((a) => a.status === "IN_PROGRESS")?.id ?? null,
      attemptsCount: submitted.length,
      bestScore: submitted.length ? Math.max(...submitted.map((a) => a.score!)) : null,
      latestSubmittedId: submitted[0]?.id ?? null,
    };
  });
}

export async function getMockTestOverview(slug: string, userId: string) {
  const test = await prisma.mockTest.findUnique({
    where: { slug },
    include: {
      questions: { select: { id: true, section: true }, orderBy: { order: "asc" } },
    },
  });
  if (!test || !test.isPublished) return null;

  const attempts = await prisma.mockAttempt.findMany({
    where: { userId, testId: test.id },
    orderBy: { startedAt: "desc" },
  });

  const sections = new Map<string, number>();
  for (const q of test.questions) {
    const key = q.section ?? "General";
    sections.set(key, (sections.get(key) ?? 0) + 1);
  }

  return {
    test: {
      id: test.id,
      slug: test.slug,
      title: test.title,
      description: test.description,
      durationMin: test.durationMin,
      marksPerCorrect: test.marksPerCorrect,
      negativeMarks: test.negativeMarks,
      questionCount: test.questions.length,
      totalMarks: test.questions.length * test.marksPerCorrect,
    },
    sections: [...sections.entries()].map(([name, count]) => ({ name, count })),
    inProgress: attempts.find((a) => a.status === "IN_PROGRESS") ?? null,
    history: attempts
      .filter((a) => a.status === "SUBMITTED")
      .map((a) => ({
        id: a.id,
        score: a.score ?? 0,
        correct: a.correct ?? 0,
        wrong: a.wrong ?? 0,
        submittedAt: a.submittedAt ?? a.startedAt,
        timeTakenSec: a.timeTakenSec ?? 0,
      })),
  };
}

type FinalizeInput = {
  attemptId: string;
  userId: string;
  /** Latest client answers; falls back to what was last autosaved. */
  answers?: Answers;
};

/** Scores an attempt on the server and marks it SUBMITTED. Idempotent. */
export async function finalizeAttempt({ attemptId, userId, answers }: FinalizeInput) {
  const attempt = await prisma.mockAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { test: { include: { questions: true } } },
  });
  if (!attempt) return null;
  if (attempt.status === "SUBMITTED") return attempt;

  const { test } = attempt;
  const final = answers ?? parseAnswers(attempt.answers);

  let correct = 0;
  let wrong = 0;
  let unattempted = 0;
  for (const q of test.questions) {
    const sel = final[q.id]?.sel ?? null;
    if (sel == null) unattempted++;
    else if (sel === q.correctOption) correct++;
    else wrong++;
  }
  const score = correct * test.marksPerCorrect - wrong * test.negativeMarks;

  const now = new Date();
  const elapsed = Math.floor((now.getTime() - attempt.startedAt.getTime()) / 1000);

  return prisma.mockAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "SUBMITTED",
      submittedAt: now,
      answers: JSON.stringify(final),
      score,
      correct,
      wrong,
      unattempted,
      timeTakenSec: Math.min(elapsed, test.durationMin * 60),
    },
    include: { test: { include: { questions: true } } },
  });
}

export async function getAttemptForExam(attemptId: string, userId: string) {
  const attempt = await prisma.mockAttempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      test: {
        include: { questions: { orderBy: { order: "asc" } } },
      },
    },
  });
  return attempt;
}

export async function getMockResult(attemptId: string, userId: string) {
  const attempt = await prisma.mockAttempt.findFirst({
    where: { id: attemptId, userId, status: "SUBMITTED" },
    include: { test: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
  if (!attempt) return null;

  const answers = parseAnswers(attempt.answers);
  const { test } = attempt;

  const questions = test.questions.map((q, i) => {
    const a = answers[q.id];
    const sel = a?.sel ?? null;
    const status: "correct" | "wrong" | "unattempted" =
      sel == null ? "unattempted" : sel === q.correctOption ? "correct" : "wrong";
    return {
      id: q.id,
      number: i + 1,
      section: q.section ?? "General",
      text: q.text,
      options: parseOptions(q.options),
      correctOption: q.correctOption,
      explanation: q.explanation,
      selected: sel,
      marked: a?.marked ?? false,
      timeMs: a?.timeMs ?? 0,
      status,
    };
  });

  const bySection = new Map<
    string,
    { name: string; total: number; correct: number; wrong: number; unattempted: number; timeMs: number }
  >();
  for (const q of questions) {
    const s =
      bySection.get(q.section) ??
      { name: q.section, total: 0, correct: 0, wrong: 0, unattempted: 0, timeMs: 0 };
    s.total++;
    s[q.status]++;
    s.timeMs += q.timeMs;
    bySection.set(q.section, s);
  }

  const totalMarks = test.questions.length * test.marksPerCorrect;
  const attempted = (attempt.correct ?? 0) + (attempt.wrong ?? 0);

  return {
    attemptId: attempt.id,
    test: {
      slug: test.slug,
      title: test.title,
      durationMin: test.durationMin,
      marksPerCorrect: test.marksPerCorrect,
      negativeMarks: test.negativeMarks,
    },
    score: attempt.score ?? 0,
    totalMarks,
    correct: attempt.correct ?? 0,
    wrong: attempt.wrong ?? 0,
    unattempted: attempt.unattempted ?? 0,
    attempted,
    accuracy: attempted > 0 ? Math.round(((attempt.correct ?? 0) / attempted) * 100) : 0,
    timeTakenSec: attempt.timeTakenSec ?? 0,
    submittedAt: attempt.submittedAt ?? attempt.startedAt,
    sections: [...bySection.values()],
    questions,
  };
}
