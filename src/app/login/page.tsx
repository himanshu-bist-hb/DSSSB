import { signIn } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex flex-1 lg:grid lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between bg-[#5a1620] p-14 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-sm font-bold text-accent">
            SS
          </div>
          <p className="text-lg font-semibold">DSSSB TGT S.St</p>
        </div>
        <div className="max-w-xl">
          <h2 className="text-4xl font-semibold leading-tight xl:text-5xl">
            Prepare for DSSSB TGT Social Studies, the smart way.
          </h2>
          <ul className="mt-8 space-y-4 text-base text-white/80">
            <li className="flex gap-3"><span>✔</span> Subject-wise and topic-wise MCQ practice</li>
            <li className="flex gap-3"><span>✔</span> Previous year questions with explanations</li>
            <li className="flex gap-3"><span>✔</span> Per-question timing and performance analytics</li>
            <li className="flex gap-3"><span>✔</span> AI tutor for audio lessons and an AI doubt solver</li>
          </ul>
        </div>
        <p className="text-xs text-white/50">Exam Practice Portal</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-8 text-center lg:mx-auto lg:w-full lg:max-w-md">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-xl font-semibold text-white">
          SS
        </div>
        <h1 className="text-xl font-semibold text-foreground">DSSSB TGT S.St</h1>
        <p className="max-w-[280px] text-sm leading-relaxed text-muted">
          Practice subject-wise MCQs, track your progress, and revise at your own pace.
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: callbackUrl || "/" });
        }}
        className="w-full"
      >
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-[#f5f3ec]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A8.98 8.98 0 0 0 9 0 9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
            />
          </svg>
          Continue with Google
        </button>
      </form>

      <p className="max-w-[260px] text-xs text-muted">
        Sign-in is limited to Google accounts. We use it only to save your practice
        progress.
      </p>
      </div>
    </div>
  );
}
