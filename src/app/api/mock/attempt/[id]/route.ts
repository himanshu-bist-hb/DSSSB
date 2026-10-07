import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { answersSchema } from "@/lib/mock";

// Autosave while the test is running.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = z.object({ answers: answersSchema }).safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await prisma.mockAttempt.updateMany({
    where: { id, userId: session.user.id, status: "IN_PROGRESS" },
    data: { answers: JSON.stringify(parsed.data.answers) },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Attempt not active" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
