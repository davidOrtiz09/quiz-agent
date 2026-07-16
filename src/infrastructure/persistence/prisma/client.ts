import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../../generated/prisma/client";
import { getEnv } from "../../../shared/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const env = getEnv();
  const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });
  const client = new PrismaClient({ adapter });

  // WAL mode lets the async LLM-judge write-back (see QuizEvaluator) happen without
  // colliding with concurrent reads from the request path.
  void client.$executeRawUnsafe("PRAGMA journal_mode = WAL;").catch((error: unknown) => {
    console.error("Failed to enable SQLite WAL mode", error);
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
