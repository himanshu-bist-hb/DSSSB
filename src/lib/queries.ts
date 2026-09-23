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
    select: { question: { select: { topicId: true } }, isCorrect: true },
  });

  const attemptedByTopic = new Map<string, number>();
  const correctByTopic = new Map<string, number>();
  for (const p of progress) {
    const tId = p.question.topicId;
    attemptedByTopic.set(tId, (attemptedByTopic.get(tId) ?? 0) + 1);
    if (p.isCorrect) correctByTopic.set(tId, (correctByTopic.get(tId) ?? 0) + 1);
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
    })),
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
