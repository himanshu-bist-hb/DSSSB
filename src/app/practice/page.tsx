import Link from "next/link";
import { auth } from "@/lib/auth";
import { getSubjectsOverview } from "@/lib/queries";
import { subjectMeta } from "@/lib/subject-meta";
import { ProgressBadge } from "@/components/ProgressBadge";
import { TopBar } from "@/components/TopBar";

export default async function PracticePage() {
  const session = await auth();
  const subjects = await getSubjectsOverview(session!.user.id);

  return (
    <div className="flex flex-1 flex-col">
      <TopBar backHref="/" eyebrow="Home" title="Question Practice" />

      <div className="flex flex-1 flex-col gap-2.5 px-5 py-4">
        <p className="px-1 text-xs font-medium text-muted">Choose a subject to practice</p>

        {subjects.map((s) => {
          const meta = subjectMeta(s.slug);
          return (
            <Link
              key={s.id}
              href={`/subjects/${s.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition active:scale-[0.99]"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold"
                style={{ backgroundColor: meta.soft, color: meta.color }}
              >
                {meta.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                <p className="text-xs text-muted">
                  {s.topicCount} topics · {s.questionCount} questions
                </p>
              </div>
              <ProgressBadge attempted={s.attemptedCount} total={s.questionCount} />
            </Link>
          );
        })}

        {subjects.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted">
            No subjects yet. Seed the database to get started.
          </p>
        )}
      </div>
    </div>
  );
}
