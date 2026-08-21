import type { PrismaClient } from "@prisma/client";
import prisma from "../lib/prisma.js";

/**
 * GraphQL execution context.
 *
 * Every resolver receives this object as its third argument.
 * Centralising it here makes it easy to extend (e.g. add a logger)
 * without touching every resolver file.
 */
export interface Context {
  prisma: PrismaClient;
}

/**
 * Context factory passed to GraphQL Yoga.
 * Called once per request.
 */
export function createContext(): Context {
  return { prisma };
}
