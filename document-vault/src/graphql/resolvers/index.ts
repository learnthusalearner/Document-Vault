import { queryResolvers } from "./query.js";
import { mutationResolvers } from "./mutation.js";
import { collectionResolvers, documentResolvers } from "./fields.js";

/**
 * Root resolver map — merged from individual modules.
 *
 * The DateTime scalar serialises JS Date objects (returned by Prisma) to
 * ISO-8601 strings. GraphQL Yoga passes them through its JSON serialiser
 * which calls .toISOString(), so a simple identity coerce is enough here.
 */
export const resolvers = {
  // ── Scalar ────────────────────────────────────────────────────────────────
  DateTime: {
    serialize: (value: unknown) => {
      if (value instanceof Date) return value.toISOString();
      if (typeof value === "string") return value;
      throw new Error(`DateTime cannot serialize value: ${String(value)}`);
    },
    parseValue: (value: unknown) => {
      if (typeof value === "string") return new Date(value);
      throw new Error(`DateTime cannot parse value: ${String(value)}`);
    },
    parseLiteral: (ast: { kind: string; value?: string }) => {
      if (ast.kind === "StringValue" && ast.value !== undefined)
        return new Date(ast.value);
      throw new Error(`DateTime cannot parse literal kind: ${ast.kind}`);
    },
  },

  // ── Operations ────────────────────────────────────────────────────────────
  Query: queryResolvers,
  Mutation: mutationResolvers,

  // ── Field resolvers ───────────────────────────────────────────────────────
  ...collectionResolvers,
  ...documentResolvers,
};
