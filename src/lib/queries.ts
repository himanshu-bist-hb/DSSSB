import { prisma } from "@/lib/prisma";

type Difficulty = "EASY" | "MEDIUM" | "HARD";

export async function getSubjectsOverview(userId: string) {
  const subjects = await prisma.subject.findMany({
    orderBy: { order: "asc" },
    include: {
      topics: { select: { id: true, _count: { select: { questions: true } } } },
    },
  });

  const progress = await prisma.userProgress.findMany({
    where: { userId },
    select: { question: { select: { topicId: true } } },
  });

  const attemptedByTopic = new Map<string, number>();
  for (const p of progress) {
    attemptedByTopic.set(
      p.question.topicId,
      (attemptedByTopic.get(p.question.topicId) ?? 0) + 1
    );
  }

  return subjects.map((s) => {
    const topicIds = s.topics.map((t) => t.id);
    const questionCount = s.topics.reduce((sum, t) => sum + t._count.questions, 0);
    const attemptedCount = topicIds.reduce(
      (sum, id) => sum + (attemptedByTopic.get(id) ?? 0),
      0
    );
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      topicCount: s.topics.length,
      questionCount,
      attemptedCount,
    };
  });
}

export async function getSubjectWithTopics(subjectSlug: string, userId: string) {
  const subject = await prisma.subject.findUnique({
    where: { slug: subjectSlug },
    include: {
      topics: {
        orderBy: { order: "asc" },
        select: { id: true, slug: true, name: true, _count: { select: { questions: true } } },
      },
    },
  });
  if (!subject) return null;

  const progress = await prisma.userProgress.findMany({
    where: { userId, question: { topic: { subjectId: subject.id } } },
    select: { question: { select: { topicId: true } }, status: true, isCorrect: true },
  });

  const attemptedByTopic = new Map<string, number>();
  const correctByTopic = new Map<string, number>();
  const wrongByTopic = new Map<string, number>();
  for (const p of progress) {
    const tId = p.question.topicId;
    attemptedByTopic.set(tId, (attemptedByTopic.get(tId) ?? 0) + 1);
    if (p.status === "ATTEMPTED") {
      if (p.isCorrect) correctByTopic.set(tId, (correctByTopic.get(tId) ?? 0) + 1);
      else wrongByTopic.set(tId, (wrongByTopic.get(tId) ?? 0) + 1);
    }
  }

  return {
    id: subject.id,
    slug: subject.slug,
    name: subject.name,
    topics: subject.topics.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      questionCount: t._count.questions,
      attemptedCount: attemptedByTopic.get(t.id) ?? 0,
      correctCount: correctByTopic.get(t.id) ?? 0,
      wrongCount: wrongByTopic.get(t.id) ?? 0,
    })),
  };
}

export type ResultQuestion = {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  selectedOption: string | null;
  correctOption: string;
  explanation: string | null;
  difficulty: Difficulty;
  isPYQ: boolean;
  pyqYear: number | null;
};

export type TopicResult = {
  subject: { slug: string; name: string };
  topic: { id: string; slug: string; name: string };
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  pyqAttempted: number;
  pyqCorrect: number;
  pyqWrong: number;
  wrongQuestions: ResultQuestion[];
};

export async function getTopicResult(
  subjectSlug: string,
  topicSlug: string,
  userId: string
): Promise<TopicResult | null> {
  const subject = await prisma.subject.findUnique({ where: { slug: subjectSlug } });
  if (!subject) return null;

  const topic = await prisma.topic.findUnique({
    where: { subjectId_slug: { subjectId: subject.id, slug: topicSlug } },
    select: { id: true, slug: true, name: true, _count: { select: { questions: true } } },
  });
  if (!topic) return null;

  const progress = await prisma.userProgress.findMany({
    where: { userId, question: { topicId: topic.id } },
    select: {
      status: true,
      selectedOption: true,
      isCorrect: true,
      question: {
        select: {
          id: true,
          text: true,
          options: true,
          correctOption: true,
          explanation: true,
          difficulty: true,
          isPYQ: true,
          pyqYear: true,
        },
      },
    },
  });

  let correct = 0;
  let pyqAttempted = 0;
  let pyqCorrect = 0;
  const wrongQuestions: ResultQuestion[] = [];
  for (const p of progress) {
    if (p.status !== "ATTEMPTED") continue;
    if (p.question.isPYQ) pyqAttempted += 1;
    if (p.isCorrect) {
      correct += 1;
      if (p.question.isPYQ) pyqCorrect += 1;
      continue;
    }
    wrongQuestions.push({
      id: p.question.id,
      text: p.question.text,
      options: JSON.parse(p.question.options) as { id: string; text: string }[],
      selectedOption: p.selectedOption,
      correctOption: p.question.correctOption,
      explanation: p.question.explanation,
      difficulty: p.question.difficulty as Difficulty,
      isPYQ: p.question.isPYQ,
      pyqYear: p.question.pyqYear,
    });
  }

  return {
    subject: { slug: subject.slug, name: subject.name },
    topic: { id: topic.id, slug: topic.slug, name: topic.name },
    totalQuestions: topic._count.questions,
    attempted: progress.length,
    correct,
    wrong: wrongQuestions.length,
    pyqAttempted,
    pyqCorrect,
    pyqWrong: pyqAttempted - pyqCorrect,
    wrongQuestions,
  };
}

type Tally = { attempted: number; correct: number };

export type UserStats = {
  totalQuestions: number;
  attempted: number; // rows with status ATTEMPTED or REVEALED
  answered: number; // rows with status ATTEMPTED (an option was actually picked)
  correct: number;
  incorrect: number;
  accuracy: number; // % of answered questions that were correct
  bySubject: (Tally & { id: string; slug: string; name: string })[];
  byDifficulty: Record<Difficulty, Tally>;
  pyq: Tally;
  nonPyq: Tally;
};

export async function getUserStats(userId: string): Promise<UserStats> {
  const [totalQuestions, progress] = await Promise.all([
    prisma.question.count(),
    prisma.userProgress.findMany({
      where: { userId },
      select: {
        status: true,
        isCorrect: true,
        question: {
          select: {
            difficulty: true,
            isPYQ: true,
            topic: { select: { subject: { select: { id: true, slug: true, name: true } } } },
          },
        },
      },
    }),
  ]);

  const bySubject = new Map<string, Tally & { id: string; slug: string; name: string }>();
  const byDifficulty: Record<Difficulty, Tally> = {
    EASY: { attempted: 0, correct: 0 },
    MEDIUM: { attempted: 0, correct: 0 },
    HARD: { attempted: 0, correct: 0 },
  };
  const pyq: Tally = { attempted: 0, correct: 0 };
  const nonPyq: Tally = { attempted: 0, correct: 0 };

  let answered = 0;
  let correct = 0;

  for (const p of progress) {
    const isAnswered = p.status === "ATTEMPTED";
    const wasCorrect = isAnswered && p.isCorrect === true;
    if (isAnswered) {
      answered += 1;
      if (wasCorrect) correct += 1;
    }

    const subj = p.question.topic.subject;
    const s = bySubject.get(subj.id) ?? { ...subj, attempted: 0, correct: 0 };
    s.attempted += 1;
    if (wasCorrect) s.correct += 1;
    bySubject.set(subj.id, s);

    const diff = byDifficulty[p.question.difficulty as Difficulty];
    if (diff) {
      diff.attempted += 1;
      if (wasCorrect) diff.correct += 1;
    }

    const bucket = p.question.isPYQ ? pyq : nonPyq;
    bucket.attempted += 1;
    if (wasCorrect) bucket.correct += 1;
  }

  return {
    totalQuestions,
    attempted: progress.length,
    answered,
    correct,
    incorrect: answered - correct,
    accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    bySubject: [...bySubject.values()].sort((a, b) => b.attempted - a.attempted),
    byDifficulty,
    pyq,
    nonPyq,
  };
}

export type QuestionForClient = {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  difficulty: Difficulty;
  isPYQ: boolean;
  pyqYear: number | null;
  progress: {
    status: "ATTEMPTED" | "REVEALED";
    selectedOption: string | null;
    isCorrect: boolean | null;
    correctOption: string;
    explanation: string | null;
  } | null;
};

export async function getTopicQuiz(subjectSlug: string, topicSlug: string, userId: string) {
  const subject = await prisma.subject.findUnique({ where: { slug: subjectSlug } });
  if (!subject) return null;

  const topic = await prisma.topic.findUnique({
    where: { subjectId_slug: { subjectId: subject.id, slug: topicSlug } },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          progress: { where: { userId } },
        },
      },
    },
  });
  if (!topic) return null;

  const questions: QuestionForClient[] = topic.questions.map((q) => {
    const p = q.progress[0];
    // SQL Server has no native Json column type, so options are stored as a JSON string.
    const options = JSON.parse(q.options) as { id: string; text: string }[];
    return {
      id: q.id,
      text: q.text,
      options,
      difficulty: q.difficulty as Difficulty,
      isPYQ: q.isPYQ,
      pyqYear: q.pyqYear,
      progress: p
        ? {
            status: p.status as "ATTEMPTED" | "REVEALED",
            selectedOption: p.selectedOption,
            isCorrect: p.isCorrect,
            correctOption: q.correctOption,
            explanation: q.explanation,
          }
        : null,
    };
  });

  return {
    subject: { slug: subject.slug, name: subject.name },
    topic: { id: topic.id, slug: topic.slug, name: topic.name },
    questions,
  };
}

// ---------- Admin ----------

// Auth.js database sessions default to a 30-day maxAge and push `expires`
// forward when a session is used, so `expires - 30d` approximates last visit.
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  signedUpAt: Date;
  lastActiveAt: Date;
  answered: number;
  correct: number;
  accuracy: number;
  revealed: number;
};

export async function getAdminOverview() {
  const [users, progress, sessions] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    }),
    prisma.userProgress.groupBy({
      by: ["userId", "status", "isCorrect"],
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.session.groupBy({ by: ["userId"], _max: { expires: true } }),
  ]);

  const rows = new Map<string, AdminUserRow>();
  for (const u of users) {
    rows.set(u.id, {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      signedUpAt: u.createdAt,
      lastActiveAt: u.createdAt,
      answered: 0,
      correct: 0,
      accuracy: 0,
      revealed: 0,
    });
  }

  const bump = (row: AdminUserRow, d?: Date | null) => {
    if (d && d > row.lastActiveAt) row.lastActiveAt = d;
  };

  for (const s of sessions) {
    const row = rows.get(s.userId);
    if (row && s._max.expires) bump(row, new Date(s._max.expires.getTime() - SESSION_MAX_AGE_MS));
  }
  for (const g of progress) {
    const row = rows.get(g.userId);
    if (!row) continue;
    bump(row, g._max.updatedAt);
    if (g.status === "ATTEMPTED") {
      row.answered += g._count._all;
      if (g.isCorrect === true) row.correct += g._count._all;
    } else {
      row.revealed += g._count._all;
    }
  }

  const list = [...rows.values()];
  for (const r of list) r.accuracy = r.answered > 0 ? Math.round((r.correct / r.answered) * 100) : 0;
  list.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const totalAnswered = list.reduce((n, r) => n + r.answered, 0);
  const totalCorrect = list.reduce((n, r) => n + r.correct, 0);

  return {
    users: list,
    totalUsers: list.length,
    active7d: list.filter((r) => now - r.lastActiveAt.getTime() < 7 * DAY).length,
    newUsers7d: list.filter((r) => now - r.signedUpAt.getTime() < 7 * DAY).length,
    totalAnswered,
    totalCorrect,
    accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
  };
}

export type AdminTopicRow = {
  id: string;
  name: string;
  totalQuestions: number;
  answered: number;
  correct: number;
  revealed: number;
  lastAt: Date | null;
};

export type AdminSubjectRow = {
  id: string;
  slug: string;
  name: string;
  totalQuestions: number;
  answered: number;
  correct: number;
  revealed: number;
  topics: AdminTopicRow[];
};

export async function getAdminUserReport(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!user) return null;

  const [subjects, progress] = await Promise.all([
    prisma.subject.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        topics: {
          orderBy: { order: "asc" },
          select: { id: true, name: true, _count: { select: { questions: true } } },
        },
      },
    }),
    prisma.userProgress.findMany({
      where: { userId },
      select: {
        status: true,
        isCorrect: true,
        updatedAt: true,
        question: { select: { topicId: true } },
      },
    }),
  ]);

  const byTopic = new Map<string, Pick<AdminTopicRow, "answered" | "correct" | "revealed" | "lastAt">>();
  for (const p of progress) {
    const t = byTopic.get(p.question.topicId) ?? { answered: 0, correct: 0, revealed: 0, lastAt: null };
    if (p.status === "ATTEMPTED") {
      t.answered += 1;
      if (p.isCorrect === true) t.correct += 1;
    } else {
      t.revealed += 1;
    }
    if (!t.lastAt || p.updatedAt > t.lastAt) t.lastAt = p.updatedAt;
    byTopic.set(p.question.topicId, t);
  }

  const rows: AdminSubjectRow[] = subjects.map((s) => {
    const topics: AdminTopicRow[] = s.topics.map((t) => ({
      id: t.id,
      name: t.name,
      totalQuestions: t._count.questions,
      answered: 0,
      correct: 0,
      revealed: 0,
      lastAt: null,
      ...byTopic.get(t.id),
    }));
    const sum = (k: "totalQuestions" | "answered" | "correct" | "revealed") =>
      topics.reduce((n, t) => n + t[k], 0);
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      totalQuestions: sum("totalQuestions"),
      answered: sum("answered"),
      correct: sum("correct"),
      revealed: sum("revealed"),
      topics,
    };
  });

  const answered = rows.reduce((n, s) => n + s.answered, 0);
  const correct = rows.reduce((n, s) => n + s.correct, 0);
  return {
    user,
    subjects: rows,
    answered,
    correct,
    accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    totalQuestions: rows.reduce((n, s) => n + s.totalQuestions, 0),
  };
}
