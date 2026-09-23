import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  questionId: z.string().min(1),
  selectedOption: z.string().min(1).optional(),
  reveal: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { questionId, selectedOption, reveal } = parsed.data;

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const status = reveal ? "REVEALED" : "ATTEMPTED";
  const isCorrect = reveal ? null : selectedOption === question.correctOption;

  if (!reveal && !selectedOption) {
    return NextResponse.json({ error: "selectedOption is required" }, { status: 400 });
  }

  const progress = await prisma.userProgress.upsert({
    where: { userId_questionId: { userId: session.user.id, questionId } },
    create: {
      userId: session.user.id,
      questionId,
      status,
      selectedOption: reveal ? null : selectedOption,
      isCorrect,
    },
    update: {
      // Don't downgrade an already-answered question back to just "revealed",
      // and don't overwrite a prior answer if the user re-reveals.
      status: reveal ? undefined : status,
      selectedOption: reveal ? undefined : selectedOption,
      isCorrect: reveal ? undefined : isCorrect,
    },
  });

  return NextResponse.json({
    status: progress.status,
    selectedOption: progress.selectedOption,
    isCorrect: progress.isCorrect,
    correctOption: question.correctOption,
    explanation: question.explanation,
  });
}
