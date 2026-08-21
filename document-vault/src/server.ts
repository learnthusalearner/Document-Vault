import { createServer } from "http";
import { yoga } from "./app.js";

const PORT = Number(process.env["PORT"] ?? 4000);

// ── HTTP server ────────────────────────────────────────────────────────────
const server = createServer(yoga);

server.listen(PORT, () => {
  console.info(`🗄️  Document Vault API`);
  console.info(`   GraphQL  → http://localhost:${PORT}/graphql`);
  console.info(`   GraphiQL → http://localhost:${PORT}/graphql`);
  console.info(`   Env      → ${process.env["NODE_ENV"] ?? "development"}`);
});
