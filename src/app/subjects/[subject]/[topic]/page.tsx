import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTopicQuiz } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { QuizClient } from "@/components/QuizClient";

export default async function TopicQuizPage({
  params,
}: {
  params: Promise<{ subject: string; topic: string }>;
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params;
  const session = await auth();
  const data = await getTopicQuiz(subjectSlug, topicSlug, session!.user.id);
  if (!data) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <TopBar backHref={`/subjects/${subjectSlug}`} eyebrow={data.subject.name} title={data.topic.name} />
      <QuizClient topicId={data.topic.id} questions={data.questions} />
    </div>
  );
}
