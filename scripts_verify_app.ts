import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getSubjectsOverview, getSubjectWithTopics, getTopicQuiz } from "../src/lib/queries";

async function main() {
  const overview = await getSubjectsOverview("nonexistent-user-id");
  console.log("Subjects overview:", overview.map(s => `${s.slug}: ${s.questionCount}q / ${s.topicCount}t`));

  const geo = await getSubjectWithTopics("geography", "nonexistent-user-id");
  console.log("\nGeography topics:", geo?.topics.length, "total questions:", geo?.topics.reduce((a,t)=>a+t.questionCount,0));

  const firstTopic = geo?.topics[0];
  if (firstTopic) {
    const quiz = await getTopicQuiz("geography", firstTopic.slug, "nonexistent-user-id");
    console.log("\nSample topic:", firstTopic.slug, "questions loaded:", quiz?.questions.length);
    console.log("Sample question:", JSON.stringify(quiz?.questions[0], null, 2));
  }
}
main().catch(console.error).finally(() => process.exit(0));
