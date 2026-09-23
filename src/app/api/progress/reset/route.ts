import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  topicId: z.string().min(1),
  scope: z.enum(["all", "correct", "wrong"]).optional().default("all"),
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
  const { topicId, scope } = parsed.data;

  // "wrong" clears incorrect answers plus revealed-without-answering rows, since
  // both mean the user didn't get the question right on their own. "correct"
  // clears only rows that were answered correctly.
  const scopeFilter =
    scope === "correct"
      ? { status: "ATTEMPTED", isCorrect: true }
      : scope === "wrong"
        ? { OR: [{ status: "ATTEMPTED", isCorrect: false }, { status: "REVEALED" }] }
        : {};

  const { count } = await prisma.userProgress.deleteMany({
    where: {
      userId: session.user.id,
      question: { topicId },
      ...scopeFilter,
    },
  });

  return NextResponse.json({ cleared: count });
}
