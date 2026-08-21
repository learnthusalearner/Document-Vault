import { createYoga } from "graphql-yoga";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { resolvers } from "./graphql/resolvers/index.js";
import { createContext } from "./graphql/context.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Schema ─────────────────────────────────────────────────────────────────
const typeDefs = readFileSync(
  join(__dirname, "graphql", "schema.graphql"),
  "utf-8"
);

export const schema = makeExecutableSchema({ typeDefs, resolvers });

// ── Yoga instance ──────────────────────────────────────────────────────────
export const yoga = createYoga({
  schema,
  context: createContext,
  graphiql: process.env["NODE_ENV"] !== "production",
  logging: {
    debug: (...args: unknown[]) => console.debug(...args),
    info: (...args: unknown[]) => console.info(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
  },
});
