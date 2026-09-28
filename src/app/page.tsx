import Link from "next/link";
import { auth } from "@/lib/auth";
import { getUserStats } from "@/lib/queries";
import { SignOutButton } from "@/components/SignOutButton";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const session = await auth();
  const stats = await getUserStats(session!.user.id);
  const firstName = session!.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-6">
        <div>
          <p className="text-xs font-medium text-muted">{greeting()}</p>
          <h1 className="text-xl font-semibold text-foreground">{firstName}</h1>
        </div>
        <div className="flex items-center gap-2">
          {session!.user.isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
            >
              Admin
            </Link>
          )}
          <Link
            href="/stats"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
          >
            Stats
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-5 pb-8">
        <div className="flex gap-2.5">
          <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
            <p className="text-xl font-semibold text-foreground">{stats.answered}</p>
            <p className="text-[11px] font-medium text-muted">Attempted</p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
            <p className="text-xl font-semibold text-foreground">{stats.accuracy}%</p>
            <p className="text-[11px] font-medium text-muted">Accuracy</p>
          </div>
        </div>

        <Link
          href="/practice"
          className="group mt-2 flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-5 transition active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-2xl">
            📝
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-foreground">Question Practice</p>
            <p className="text-xs text-muted">
              {stats.answered > 0
                ? `${stats.answered} of ${stats.totalQuestions} questions done · pick a subject to continue`
                : "Pick a subject and start practicing"}
            </p>
          </div>
          <span className="text-muted transition group-active:translate-x-0.5">→</span>
        </Link>

        <Link
          href="/tutor"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-5 transition active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-2xl">
            🎧
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-foreground">AI Tutor (Audio)</p>
            <p className="text-xs text-muted">Get any topic explained as a spoken lesson</p>
          </div>
          <span className="text-muted transition group-active:translate-x-0.5">→</span>
        </Link>

        <Link
          href="/doubt"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-5 transition active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-2xl">
            📷
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-foreground">AI Doubt Solver</p>
            <p className="text-xs text-muted">Snap or upload any question, get an answer, explanation and exam tricks</p>
          </div>
          <span className="text-muted transition group-active:translate-x-0.5">→</span>
        </Link>
      </div>
    </div>
  );
}
