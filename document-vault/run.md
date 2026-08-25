# Running Document Vault

A quick-start reference for getting the project up and running locally.

---

## Prerequisites

| Tool | Version |
|------|---------|
| [Bun](https://bun.sh) | ≥ 1.x |
| [Docker](https://www.docker.com/) + Docker Compose | any recent |
| Node.js (optional, for npx) | ≥ 18 |

---

## 1. Environment Setup

Copy the example env file and adjust values if needed:

```bash
cp .env.example .env
```

> Default credentials (`vault` / `vault_secret`) match the Docker Compose service out of the box — no changes required for local dev.

---

## 2. Start the Database

Spin up the Postgres container:

```bash
docker compose up -d
```

Wait for the health-check to pass (a few seconds), then verify:

```bash
docker compose ps
```

---

## 3. Install Dependencies & Generate Prisma Client

```bash
bun install
```

> `postinstall` runs `prisma generate` automatically.

---

## 4. Run Migrations

Apply all pending Prisma migrations and (re)generate the client:

```bash
bun run gendb
```

> This runs `prisma generate && prisma migrate dev` — use it whenever the schema changes.

---

## 5. Start the Dev Server

```bash
bun run dev
```

The GraphQL API will be available at:

```
http://localhost:4000/graphql
```

The server hot-reloads on file changes via `--watch`.

---

## 6. Run Tests

```bash
bun run test
```

---

## All Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `bun run dev` | Start dev server with hot-reload |
| `test` | `bun run test` | Run the test suite |
| `gendb` | `bun run gendb` | Generate Prisma client + run migrations |
| `build` | `bun run build` | Generate Prisma client (CI/production) |
| `typecheck` | `bun run typecheck` | Type-check without emitting |
| `lint` | `bun run lint` | Alias for typecheck |
| `sanity` | `bun run sanity` | Lint + typecheck + test (pre-commit check) |

---

## Stopping the Database

```bash
docker compose down
```

To also remove the persisted volume:

```bash
docker compose down -v
```
