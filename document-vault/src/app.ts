import { createYoga } from "graphql-yoga";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./graphql/schema.js";
import { resolvers } from "./graphql/resolvers/index.js";
import { createContext } from "./graphql/context.js";

// ── Schema ─────────────────────────────────────────────────────────────────
export const schema = makeExecutableSchema({ typeDefs, resolvers });

// ── Yoga instance ──────────────────────────────────────────────────────────
export const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: process.env["GRAPHQL_ENDPOINT"] ?? "/graphql",
  graphiql: process.env["DISABLE_GRAPHIQL"] !== "true",
  logging: {
    debug: (...args: unknown[]) => console.debug(...args),
    info: (...args: unknown[]) => console.info(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
  },
});

