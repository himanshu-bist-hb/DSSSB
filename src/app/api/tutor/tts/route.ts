import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { synthesize } from "@/lib/tutor/tts";

export const maxDuration = 60;

const bodySchema = z.object({
  script: z.string().min(1).max(50_000),
  voice: z.string().min(1),
  language: z.enum(["English", "Hindi", "Hinglish"]),
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
  const { script, voice, language } = parsed.data;

  try {
    const audio = await synthesize(script, voice, language);
    return new NextResponse(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to record the audio." },
      { status: 502 }
    );
  }
}
