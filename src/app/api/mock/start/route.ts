import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { finalizeAttempt, secondsRemaining } from "@/lib/mock";

const bodySchema = z.object({ testId: z.string().min(1) });

// Starts a new attempt, or resumes the one already running. A running attempt
// whose time has run out is scored first, then a fresh attempt is started.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const userId = session.user.id;

  const test = await prisma.mockTest.findUnique({
    where: { id: parsed.data.testId },
    include: { _count: { select: { questions: true } } },
  });
  if (!test || !test.isPublished || test._count.questions === 0) {
    return NextResponse.json({ error: "Test not available" }, { status: 404 });
  }

  const running = await prisma.mockAttempt.findFirst({
    where: { userId, testId: test.id, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });
  if (running) {
    if (secondsRemaining(running.startedAt, test.durationMin) > 0) {
      return NextResponse.json({ attemptId: running.id });
    }
    await finalizeAttempt({ attemptId: running.id, userId });
  }

  const attempt = await prisma.mockAttempt.create({ data: { userId, testId: test.id } });
  return NextResponse.json({ attemptId: attempt.id });
}
