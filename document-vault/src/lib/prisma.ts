import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * Bun runs in a single process (no module hot-reload issue like Next.js),
 * so a simple module-level singleton is sufficient here.
 * The client is lazily initialised on first import.
 */
const prisma = new PrismaClient({
  log:
    process.env["NODE_ENV"] === "development"
      ? ["query", "warn", "error"]
      : ["warn", "error"],
});

export default prisma;
