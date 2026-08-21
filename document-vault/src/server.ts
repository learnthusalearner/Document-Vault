import { createServer } from "http";
import { createYoga } from "graphql-yoga";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { resolvers } from "./graphql/resolvers/index.js";
import { createContext } from "./graphql/context.js";

const PORT = Number(process.env["PORT"] ?? 4000);

// ── Resolve __dirname for ESM ──────────────────────────────────────────────
// import.meta.dir is Bun-specific; fileURLToPath keeps us portable for tsc.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Schema ─────────────────────────────────────────────────────────────────
// Load the SDL from disk (schema-first), then combine with resolvers so we
// get proper resolver attachment without any code-gen at runtime.
const typeDefs = readFileSync(
  join(__dirname, "graphql", "schema.graphql"),
  "utf-8"
);

const schema = makeExecutableSchema({ typeDefs, resolvers });

// ── Yoga instance ──────────────────────────────────────────────────────────
const yoga = createYoga({
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

// ── HTTP server ────────────────────────────────────────────────────────────
// Using Node's http.createServer keeps us compatible with both Bun and Node.
// Bun runs Node's http module natively, so there is no performance penalty.
const server = createServer(yoga);

server.listen(PORT, () => {
  console.info(`🗄️  Document Vault API`);
  console.info(`   GraphQL  → http://localhost:${PORT}/graphql`);
  console.info(`   GraphiQL → http://localhost:${PORT}/graphql`);
  console.info(`   Env      → ${process.env["NODE_ENV"] ?? "development"}`);
});
