import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { solveDoubt } from "@/lib/doubt/llm";

export const maxDuration = 60;

const dataUrlPattern = /^data:image\/(png|jpe?g|webp);base64,/;

const bodySchema = z.object({
  images: z
    .array(z.string().regex(dataUrlPattern, "Expected a base64 image data URL."))
    .min(1)
    .max(3),
  context: z.string().max(500).optional().default(""),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Please attach at least one clear photo of the question." }, { status: 400 });
  }
  const { images, context } = parsed.data;

  try {
    const solution = await solveDoubt({ images, context });
    return NextResponse.json({ solution });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not solve this doubt. Please try again." },
      { status: 502 }
    );
  }
}
