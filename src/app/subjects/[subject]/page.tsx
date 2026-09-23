import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSubjectWithTopics } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { ProgressBadge } from "@/components/ProgressBadge";

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject: subjectSlug } = await params;
  const session = await auth();
  const subject = await getSubjectWithTopics(subjectSlug, session!.user.id);
  if (!subject) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <TopBar backHref="/" eyebrow="Home" title={subject.name} />

      <div className="flex flex-1 flex-col gap-2.5 px-5 py-4">
        <p className="px-1 text-xs font-medium text-muted">Choose a topic</p>
        {subject.topics.map((t) => (
          <Link
            key={t.id}
            href={`/subjects/${subject.slug}/${t.slug}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition active:scale-[0.99]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
              <p className="text-xs text-muted">
                {t.questionCount} questions ·{" "}
                {t.attemptedCount > 0
                  ? `${t.attemptedCount}/${t.questionCount} done`
                  : "Not started"}
              </p>
            </div>
            <ProgressBadge attempted={t.attemptedCount} total={t.questionCount} />
          </Link>
        ))}

        {subject.topics.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted">
            No topics yet for this subject.
          </p>
        )}
      </div>
    </div>
  );
}
