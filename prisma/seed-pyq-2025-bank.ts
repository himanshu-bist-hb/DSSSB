// Imports the DSSSB TGT Social Science 2025 question bank (History, Geography,
// Economics, Civics -> Political Science, Teaching Methodology) as PYQs.
//   - Data: prisma/seed-data/pyq-2025-bank.json (built from
//     Documents/DSSSB_TGT_SST_Question_Bank_2025.xlsx; each question carries a
//     topic, difficulty and a simple explanation, plus the exam date + shift(s))
//   - Creates the "Teaching Methodology" subject and any missing topics.
//   - Existing questions and topics are never modified or deleted.
//
// Run with: npm run db:seed:pyq-2025   (idempotent - matches on topic + question text)
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import sql from "mssql";

function parseDatabaseUrl(url: string): sql.config {
  const withoutProtocol = url.replace(/^sqlserver:\/\//, "");
  const [hostPart, ...paramParts] = withoutProtocol.split(";");
  const [server, portStr] = hostPart.split(":");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    params[part.slice(0, idx).trim()] = part.slice(idx + 1);
  }
  return {
    server,
    port: portStr ? parseInt(portStr, 10) : undefined,
    database: params.database,
    user: params.user,
    password: params.password,
    options: {
      encrypt: params.encrypt?.toLowerCase() !== "false",
      trustServerCertificate: params.trustServerCertificate?.toLowerCase() === "true",
    },
    requestTimeout: 120_000,
    connectionTimeout: 30_000,
    pool: { max: 5, idleTimeoutMillis: 120_000, acquireTimeoutMillis: 60_000 },
  };
}

const adapter = new PrismaMssql(parseDatabaseUrl(process.env.DATABASE_URL!));
const prisma = new PrismaClient({ adapter });

type Difficulty = "EASY" | "MEDIUM" | "HARD";
const OPT_IDS = ["a", "b", "c", "d"] as const;

type BankQuestion = {
  subject: string;
  topic: string;
  difficulty: Difficulty;
  text: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  explanation: string;
  shifts: string[];
};

const PYQ_YEAR = 2025;

// Subjects that do not exist yet.
const NEW_SUBJECTS: { slug: string; name: string; order: number }[] = [
  { slug: "teaching-methodology", name: "Teaching Methodology", order: 9 },
];

// Topics that do not exist yet: subject -> slug -> name.
const NEW_TOPICS: Record<string, Record<string, string>> = {
  history: {
    "constitutional-development-british-india": "Constitutional Development under British Rule",
    "world-wars-and-interwar-period": "World Wars and the Interwar Period",
    "labour-and-trade-union-movement": "Labour and Trade Union Movement",
  },
  economics: {
    "people-as-resource": "People as Resource and Human Capital",
    "employment-and-welfare-schemes": "Employment, Unemployment and Welfare Schemes",
    "poverty-and-inequality": "Poverty and Inequality",
    "food-security-and-pds": "Food Security and PDS",
    "money-credit-and-banking": "Money, Credit and Banking",
    "economic-development-and-planning": "Economic Development and Planning",
    "sectors-of-the-economy": "Sectors of the Economy",
    "economic-reforms-and-industry": "Economic Reforms and Industry",
    "financial-markets": "Financial Markets and SEBI",
    "foreign-trade": "Foreign Trade",
  },
  "political-science": {
    "democracy-and-diversity": "Democracy and Diversity",
    "elections-and-electoral-system": "Elections and Electoral System",
    "political-parties": "Political Parties",
    "federalism-and-power-sharing": "Federalism and Power Sharing",
    "local-government-panchayati-raj": "Local Government and Panchayati Raj",
    "parliament-and-judiciary": "Parliament and Judiciary",
    "democracy-around-the-world": "Democracy Around the World",
  },
  "teaching-methodology": {
    "pedagogy-and-teaching-methods": "Pedagogy and Teaching Methods",
    "curriculum-and-nep-2020": "Curriculum and NEP 2020",
    "learning-theories-and-child-development": "Learning Theories and Child Development",
    "gender-and-inclusive-education": "Gender and Inclusive Education",
    "language-across-the-curriculum": "Language Across the Curriculum",
    "assessment-and-evaluation": "Assessment and Evaluation",
    "nature-of-disciplines-and-social-science": "Nature of Disciplines and Social Science",
    "art-integration-and-aesthetics": "Art Integration and Aesthetics",
  },
};

async function main() {
  const bank: BankQuestion[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "seed-data", "pyq-2025-bank.json"), "utf8")
  );

  // Validate every topic reference before writing anything.
  const knownTopics = new Set<string>();
  for (const t of await prisma.topic.findMany({
    select: { slug: true, subject: { select: { slug: true } } },
  })) {
    knownTopics.add(`${t.subject.slug}/${t.slug}`);
  }
  for (const [subjectSlug, topics] of Object.entries(NEW_TOPICS)) {
    for (const slug of Object.keys(topics)) knownTopics.add(`${subjectSlug}/${slug}`);
  }
  const missing = [...new Set(bank.map((q) => `${q.subject}/${q.topic}`))].filter(
    (k) => !knownTopics.has(k)
  );
  if (missing.length) throw new Error(`Unknown topics referenced: ${missing.join(", ")}`);

  for (const s of NEW_SUBJECTS) {
    await prisma.subject.upsert({
      where: { slug: s.slug },
      update: {},
      create: { slug: s.slug, name: s.name, order: s.order },
    });
  }

  let topicsCreated = 0;
  for (const [subjectSlug, topics] of Object.entries(NEW_TOPICS)) {
    const subject = await prisma.subject.findUnique({ where: { slug: subjectSlug } });
    if (!subject) throw new Error(`Unknown subject: ${subjectSlug}`);
    const last = await prisma.topic.aggregate({
      where: { subjectId: subject.id },
      _max: { order: true },
    });
    let order = (last._max.order ?? -1) + 1;
    for (const [slug, name] of Object.entries(topics)) {
      const exists = await prisma.topic.findUnique({
        where: { subjectId_slug: { subjectId: subject.id, slug } },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.topic.create({ data: { slug, name, subjectId: subject.id, order: order++ } });
      topicsCreated++;
    }
  }

  // Group questions by subject/topic so each topic needs only a few round trips.
  const byTopic = new Map<string, BankQuestion[]>();
  for (const q of bank) {
    const key = `${q.subject}/${q.topic}`;
    byTopic.set(key, [...(byTopic.get(key) ?? []), q]);
  }

  let created = 0;
  let updated = 0;
  for (const [key, questions] of byTopic) {
    const [subjectSlug, topicSlug] = key.split("/");
    const subject = await prisma.subject.findUnique({ where: { slug: subjectSlug } });
    if (!subject) throw new Error(`Unknown subject: ${subjectSlug}`);
    const topic = await prisma.topic.findUnique({
      where: { subjectId_slug: { subjectId: subject.id, slug: topicSlug } },
    });
    if (!topic) throw new Error(`Unknown topic: ${key}`);

    const existing = await prisma.question.findMany({
      where: { topicId: topic.id },
      select: { id: true, text: true },
    });
    const existingByText = new Map(existing.map((e) => [e.text, e.id]));
    const last = await prisma.question.aggregate({
      where: { topicId: topic.id },
      _max: { order: true },
    });
    let order = (last._max.order ?? -1) + 1;

    const toCreate: Prisma.QuestionCreateManyInput[] = [];
    for (const q of questions) {
      const data = {
        text: q.text,
        options: JSON.stringify(OPT_IDS.map((id, i) => ({ id, text: q.options[i] }))),
        correctOption: OPT_IDS[q.correct],
        explanation: q.explanation,
        difficulty: q.difficulty,
        isPYQ: true,
        pyqYear: PYQ_YEAR,
        pyqShift: q.shifts.join("; "),
      };
      const id = existingByText.get(q.text);
      if (id) {
        await prisma.question.update({ where: { id }, data });
        updated++;
      } else {
        toCreate.push({ ...data, topicId: topic.id, order: order++ });
      }
    }
    if (toCreate.length) {
      const res = await prisma.question.createMany({ data: toCreate });
      created += res.count;
    }
    console.log(`${key}: +${toCreate.length}`);
  }

  console.log(
    `PYQ 2025 bank seed complete: ${topicsCreated} topics created, ${created} questions created, ${updated} updated (of ${bank.length}).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
