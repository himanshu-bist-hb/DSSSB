// Imports mock tests from prisma/seed-data/mock-tests/*.json (files starting
// with "_" are ignored, e.g. the _template.json).
//
// Run with: npm run db:seed:mock
//   - Idempotent: matched on the test's `slug`.
//   - Re-running updates the test's title/description/duration/marks.
//   - Questions are (re)written ONLY if nobody has attempted the test yet, so
//     existing attempts and their results are never corrupted. To fix questions
//     of an already-attempted test, publish it under a new slug instead.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
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

const OPT_IDS = ["a", "b", "c", "d", "e"] as const;

type MockFile = {
  slug: string;
  title: string;
  description?: string;
  durationMin: number;
  marksPerCorrect?: number;
  negativeMarks?: number;
  order?: number;
  questions: {
    section?: string;
    text: string;
    options: string[];
    /** Index (0 = first option) of the correct option. */
    correct: number;
    explanation?: string;
  }[];
};

function validate(file: string, t: MockFile) {
  const where = `${file}:`;
  if (!t.slug || !/^[a-z0-9-]+$/.test(t.slug)) throw new Error(`${where} slug must be lowercase-with-dashes`);
  if (!t.title) throw new Error(`${where} title is required`);
  if (!(t.durationMin > 0)) throw new Error(`${where} durationMin must be > 0`);
  if (!Array.isArray(t.questions) || t.questions.length === 0) throw new Error(`${where} no questions`);
  t.questions.forEach((q, i) => {
    const n = i + 1;
    if (!q.text) throw new Error(`${where} Q${n} has no text`);
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > OPT_IDS.length)
      throw new Error(`${where} Q${n} needs 2-${OPT_IDS.length} options`);
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length)
      throw new Error(`${where} Q${n} "correct" must be an index into options`);
  });
}

async function main() {
  const dir = path.join(__dirname, "seed-data", "mock-tests");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .sort();

  if (files.length === 0) {
    console.log("No mock test files found in", dir);
    return;
  }

  for (const f of files) {
    const t = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as MockFile;
    validate(f, t);

    const data = {
      title: t.title,
      description: t.description ?? null,
      durationMin: t.durationMin,
      marksPerCorrect: t.marksPerCorrect ?? 1,
      negativeMarks: t.negativeMarks ?? 0.25,
      order: t.order ?? 0,
    };
    const test = await prisma.mockTest.upsert({
      where: { slug: t.slug },
      create: { slug: t.slug, ...data },
      update: data,
    });

    const attempts = await prisma.mockAttempt.count({ where: { testId: test.id } });
    if (attempts > 0) {
      console.log(`${t.slug}: has ${attempts} attempt(s) - details updated, questions left untouched`);
      continue;
    }

    await prisma.mockTestQuestion.deleteMany({ where: { testId: test.id } });
    await prisma.mockTestQuestion.createMany({
      data: t.questions.map((q, i) => ({
        testId: test.id,
        order: i,
        section: q.section ?? null,
        text: q.text,
        options: JSON.stringify(q.options.map((text, k) => ({ id: OPT_IDS[k], text }))),
        correctOption: OPT_IDS[q.correct],
        explanation: q.explanation ?? null,
      })),
    });
    console.log(`${t.slug}: imported ${t.questions.length} questions`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
