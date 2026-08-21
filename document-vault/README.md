# Document Vault — GraphQL API

A schema-first GraphQL API built with **Bun**, **GraphQL Yoga**, **Prisma**, and **PostgreSQL**.

---

## Prerequisites

| Tool | Version |
|------|---------|
| [Bun](https://bun.sh) | ≥ 1.1 |
| [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/) | any recent |
| [Node.js](https://nodejs.org) | not required — Bun handles everything |

---

## Quick Start

### 1. Clone & install dependencies

```bash
git clone <repo-url>
cd document-vault
bun install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env if you need different credentials
```

### 3. Start PostgreSQL

```bash
docker compose up -d
```

Wait for the health-check to pass (usually a few seconds):

```bash
docker compose ps   # Status should show "healthy"
```

### 4. Generate Prisma client & run migrations

```bash
bun run gendb
```

### 5. Start the development server

```bash
bun run dev
```

The API will be available at:

- **GraphQL endpoint** → `http://localhost:4000/graphql`
- **GraphiQL playground** → `http://localhost:4000/graphql` *(opens in browser)*

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start server with file-watching (hot reload) |
| `bun run test` | Run the test suite with Bun's built-in runner |
| `bun run typecheck` | Run `tsc --noEmit` (no output, type-check only) |
| `bun run gendb` | `prisma generate` + `prisma migrate dev` |

---

## Project Structure

```
document-vault/
├── src/
│   ├── graphql/
│   │   ├── schema.graphql      # SDL — single source of truth for the schema
│   │   ├── context.ts          # Request context factory (Prisma client injection)
│   │   └── resolvers/
│   │       └── index.ts        # Root resolver map
│   ├── lib/
│   │   └── prisma.ts           # Prisma client singleton
│   ├── validation/             # Input validation helpers (zod etc.)
│   └── server.ts               # Bun HTTP + GraphQL Yoga entry point
├── tests/
│   ├── unit/                   # Pure unit tests (no DB)
│   └── integration/            # Tests that hit the DB
├── prisma/
│   └── schema.prisma           # Prisma data model
├── docker-compose.yml          # PostgreSQL service
├── .env.example                # Environment variable template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | see `.env.example` | Prisma PostgreSQL connection string |
| `POSTGRES_USER` | `vault` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `vault_secret` | PostgreSQL password |
| `POSTGRES_DB` | `document_vault` | PostgreSQL database name |
| `POSTGRES_PORT` | `5432` | Host port mapped to Postgres |
| `PORT` | `4000` | HTTP server port |
| `NODE_ENV` | `development` | Enables GraphiQL and query logging |

---

## Tech Stack

- **Runtime** — [Bun](https://bun.sh) (TypeScript, bundler, test runner, HTTP server)
- **GraphQL** — [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server) (schema-first via SDL)
- **ORM** — [Prisma](https://www.prisma.io) with PostgreSQL
- **Database** — PostgreSQL 16 (Docker)
- **Testing** — Bun built-in test runner

---

## Development Notes

- **Schema-first**: Edit `src/graphql/schema.graphql` first, then add resolvers.
- **No `any`**: TypeScript strict mode + additional strictness flags are enforced.
- **No auth**: This project intentionally omits authentication and RBAC.
