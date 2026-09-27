import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { writeSection } from "@/lib/tutor/llm";
import type { LessonPlan } from "@/lib/tutor/types";

export const maxDuration = 60;

const sectionSchema = z.object({
  title: z.string(),
  time_span: z.string().optional(),
  beats: z.array(z.string()).optional(),
  key_facts: z.array(z.string()).optional(),
  handoff: z.string().optional(),
  goal: z.string().optional(),
});

const bodySchema = z.object({
  plan: z.object({ title: z.string(), frame: z.string().optional(), sections: z.array(sectionSchema) }),
  index: z.number().int().min(0),
  topic: z.string().min(1).max(200),
  exam: z.string().min(1).max(200),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  minutes: z.number().int().min(5).max(30),
  style: z.string().min(1).max(200),
  language: z.enum(["English", "Hindi", "Hinglish"]),
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
  const { plan, index, topic, exam, level, minutes, style, language, mode } = parsed.data;
  if (index >= plan.sections.length) {
    return NextResponse.json({ error: "Section index out of range" }, { status: 400 });
  }

  try {
    const text = await writeSection({
      plan: plan as LessonPlan, index, topic, exam, level, minutes, style, language, mode,
    });
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to write this section." },
      { status: 502 }
    );
  }
}
