import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import type sql from "mssql";

// The default mssql timeouts (15s request / 30s pool) are too short for a remote
// Azure SQL database that may be cold or paused; a timeout there throws inside a
// render worker and surfaces as "Jest worker encountered child process exceptions".
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
    requestTimeout: 60_000,
    connectionTimeout: 60_000,
    pool: { max: 5, min: 0, idleTimeoutMillis: 120_000, acquireTimeoutMillis: 60_000 },
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaMssql(parseDatabaseUrl(process.env.DATABASE_URL!)) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
