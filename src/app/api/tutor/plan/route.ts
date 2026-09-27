import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { planLesson } from "@/lib/tutor/llm";

export const maxDuration = 60;

const bodySchema = z.object({
  topic: z.string().min(1).max(200),
  exam: z.string().min(1).max(200),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  minutes: z.number().int().min(5).max(30),
  focus: z.string().max(500).optional().default(""),
  mode: z.enum(["story", "teach"]),
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
  const { topic, exam, level, minutes, focus, mode } = parsed.data;

  try {
    const plan = await planLesson({ topic, exam, level, minutes, focus, mode });
    return NextResponse.json({ plan, sectionCount: plan.sections.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to plan the lesson." },
      { status: 502 }
    );
  }
}
