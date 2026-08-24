import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton for serverless and long-running processes.
 *
 * In serverless environments like Vercel, caching on globalThis prevents
 * creating excessive database connections across warm function invocations.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env["NODE_ENV"] === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

