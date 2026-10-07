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
      <div className="border-b border-border lg:bg-card">
      <div className="page-wrap flex items-center justify-between gap-3 pb-3 pt-6 lg:py-7">
        <div>
          <p className="text-xs font-medium text-muted lg:text-sm">{greeting()}</p>
          <h1 className="text-xl font-semibold text-foreground lg:text-3xl">{firstName}</h1>
          <p className="mt-1 hidden text-sm text-muted lg:block">
            Pick up where you left off, or start something new.
          </p>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
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
      </div>

      <div className="page-wrap flex flex-1 flex-col gap-2.5 pb-8 lg:grid lg:flex-none lg:grid-cols-2 lg:content-start lg:gap-5 lg:py-8">
        <div className="flex gap-2.5 lg:col-span-full lg:gap-5">
          <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5 lg:py-6">
            <p className="text-xl font-semibold text-foreground lg:text-3xl">{stats.answered}</p>
            <p className="text-[11px] font-medium text-muted">Attempted</p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5 lg:py-6">
            <p className="text-xl font-semibold text-foreground lg:text-3xl">{stats.accuracy}%</p>
            <p className="text-[11px] font-medium text-muted">Accuracy</p>
          </div>
        </div>

        <Link
          href="/practice"
          className="group mt-2 flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-5 transition active:scale-[0.99] lg:mt-0 lg:hover:border-accent lg:hover:shadow-md"
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
          href="/mock-tests"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-5 transition active:scale-[0.99] lg:hover:border-accent lg:hover:shadow-md"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-2xl">
            ⏱️
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-foreground">Mock Tests</p>
            <p className="text-xs text-muted">Full-length timed tests with negative marking and analysis</p>
          </div>
          <span className="text-muted transition group-active:translate-x-0.5">→</span>
        </Link>

        <Link
          href="/tutor"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-5 transition active:scale-[0.99] lg:hover:border-accent lg:hover:shadow-md"
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
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-5 transition active:scale-[0.99] lg:hover:border-accent lg:hover:shadow-md"
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
