import { collectionResolver } from "./collection.resolver.js";
import { documentResolver } from "./document.resolver.js";

/**
 * Root resolver map.
 *
 * Each domain module exports a partial resolver map with the same shape as
 * the root map. They are merged here by spreading each module's Query,
 * Mutation, and type-level resolvers into a single object.
 */
export const resolvers = {
  // ── Custom scalar ──────────────────────────────────────────────────────────
  // Prisma returns JS Date objects; serialise them as ISO-8601 strings.
  DateTime: {
    serialize: (value: unknown): string => {
      if (value instanceof Date) return value.toISOString();
      if (typeof value === "string") return value;
      throw new Error(`DateTime cannot serialize value: ${String(value)}`);
    },
    parseValue: (value: unknown): Date => {
      if (typeof value === "string") return new Date(value);
      throw new Error(`DateTime cannot parse value: ${String(value)}`);
    },
    parseLiteral: (ast: { kind: string; value?: string }): Date => {
      if (ast.kind === "StringValue" && ast.value !== undefined)
        return new Date(ast.value);
      throw new Error(`DateTime cannot parse literal kind: ${ast.kind}`);
    },
  },

  // ── Merged operations ──────────────────────────────────────────────────────
  Query: {
    health: (): string => "OK",
    ...collectionResolver.Query,
    ...documentResolver.Query,
  },
  Mutation: {
    ...collectionResolver.Mutation,
    ...documentResolver.Mutation,
  },

  // ── Type-level field resolvers ─────────────────────────────────────────────
  Collection: collectionResolver.Collection,
  Document: documentResolver.Document,
};
