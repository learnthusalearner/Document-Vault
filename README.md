# 🗄️ Document Vault — GraphQL API

A production-grade, schema-first **GraphQL API** for managing collections and documents, built with **Bun**, **TypeScript (Strict Mode)**, **GraphQL Yoga**, **Prisma ORM**, and **PostgreSQL**.

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Problem Statement](#-problem-statement)
3. [Tech Stack](#-tech-stack)
4. [Architecture](#-architecture)
5. [Project Structure](#-project-structure)
6. [Prerequisites](#-prerequisites)
7. [Environment Variables](#-environment-variables)
8. [Setup Instructions](#-setup-instructions)
9. [Database & Migration Instructions](#-database--migration-instructions)
10. [Deploying to Vercel](#-deploying-to-vercel)
11. [Running the Development Server](#-running-the-development-server)
12. [Running Tests](#-running-tests)
13. [Running Integration Tests](#-running-integration-tests)
14. [GraphQL Endpoint & Playground](#-graphql-endpoint--playground)
15. [Example GraphQL Queries](#-example-graphql-queries)
16. [Example GraphQL Mutations](#-example-graphql-mutations)
17. [Cursor Pagination Explanation](#-cursor-pagination-explanation)
18. [Validation & Error Handling](#-validation--error-handling)
19. [Design Tradeoffs](#-design-tradeoffs)
20. [Future Extensions & Out of Scope](#-future-extensions--out-of-scope)

---

## 🎯 Project Overview

Document Vault is a document management backend that provides a flexible GraphQL API to organize text documents into collections, filter/search documents, perform partial updates, move documents across collections, and paginate large document lists deterministically using cursor-based pagination.

---

## 🧩 Problem Statement

Organizational knowledge systems require structured APIs to model hierarchical collections and documents with metadata (tags, archival states, creation timestamps). Standard REST endpoints often suffer from over-fetching or under-fetching related data (e.g., retrieving collections with or without nested documents). 

This project implements a **schema-first GraphQL API** satisfying the following core domain rules:
- **Collection**: Unique slug, auto-generated CUID, creation timestamp.
- **Document**: Belongs to exactly one Collection, auto-generated CUID, title, content, string array tags, archival flag (`isArchived`), creation timestamp.
- **Data Integrity**: Deleting a collection with documents is blocked by PostgreSQL foreign key `ON DELETE RESTRICT`. Moving documents validates destination collection existence.
- **Validation**: Strict rejection of empty strings, whitespace-only titles/content, malformed slugs, and missing entities with structured GraphQL errors.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Runtime & Test Runner** | [Bun](https://bun.sh) (v1.1+) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict Mode) |
| **API Framework** | [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server) (Schema-first SDL) |
| **ORM** | [Prisma ORM](https://www.prisma.io/) (v6) |
| **Database** | [PostgreSQL 16](https://www.postgresql.org/) (Docker Compose containerized) |
| **Schema Tools** | `@graphql-tools/schema` |

---

## 🏗️ Architecture

```
Client HTTP Request
      │
      ▼
┌────────────────────────────────────────┐
│ GraphQL Yoga HTTP Server (app.ts)      │
└──────────────────┬─────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│ Schema & Resolvers                     │
│  - schema.ts / schema.graphql (SDL)    │
│  - collection.resolver.ts              │
│  - document.resolver.ts                │
└──────────────────┬─────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│ Validation & Error Layer               │
│  - Slug / Whitespace / Tag rules       │
│  - Prisma P2002/P2025 Error Handler    │
└──────────────────┬─────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│ Prisma Client ORM                      │
└──────────────────┬─────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│ PostgreSQL Database (Docker Port 5434) │
└────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
Document-Vault/
├── api/
│   ├── index.ts                       # Root Vercel serverless function handler
│   └── graphql.ts                     # Root Vercel GraphQL route
├── document-vault/
│   ├── api/
│   │   ├── index.ts                   # Subdirectory Vercel function handler
│   │   └── graphql.ts
│   ├── src/
│   │   ├── app.ts                     # GraphQL Yoga application instance
│   │   ├── server.ts                  # Local HTTP server entry point
│   │   ├── graphql/
│   │   │   ├── schema.ts              # Embedded schema for serverless safety
│   │   │   ├── schema.graphql         # SDL — Schema Definition Language
│   │   │   ├── context.ts             # GraphQL context factory (Prisma client injection)
│   │   │   └── resolvers/
│   │   │       ├── index.ts           # Merged root resolvers & DateTime scalar
│   │   │       ├── collection.resolver.ts # Collection queries, mutations & field resolvers
│   │   │       └── document.resolver.ts   # Document queries, mutations & field resolvers
│   │   ├── lib/
│   │   │   └── prisma.ts              # Serverless-cached Prisma Client singleton
│   │   └── validation/
│   │       └── index.ts               # Validation rules & Prisma error handlers
│   ├── tests/
│   │   ├── unit/                      # 51 pure unit tests (mocked Prisma)
│   │   │   ├── collection.resolver.test.ts
│   │   │   ├── document.resolver.test.ts
│   │   │   ├── documents.query.test.ts
│   │   │   └── helpers/
│   │   │       └── mock-prisma.ts     # Typed mock factory
│   │   └── integration/               # 10 integration tests (real Docker PostgreSQL)
│   │       └── graphql.test.ts
│   ├── prisma/
│   │   ├── schema.prisma              # Prisma data models & database indexes
│   │   └── migrations/                # SQL migration history
│   ├── docker-compose.yml             # PostgreSQL container service (port 5434)
│   ├── vercel.json                    # Vercel deployment routing config
│   ├── .env.example                   # Environment template
│   ├── .gitignore                     # Ignore node_modules, .env, bun output
│   ├── package.json                   # Scripts & dependencies
│   ├── tsconfig.json                  # Strict mode TypeScript configuration
│   └── README.md
├── vercel.json                        # Root Vercel deployment routing config
├── package.json                       # Root workspace package.json
└── README.md
```

---

## ⚡ Prerequisites

- **Bun**: `≥ 1.1.0` ([Install Bun](https://bun.sh))
- **Docker & Docker Compose**: ([Install Docker](https://docs.docker.com/get-docker/))

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` before starting:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_USER` | `vault` | Database user |
| `POSTGRES_PASSWORD` | `vault_secret` | Database password |
| `POSTGRES_DB` | `document_vault` | PostgreSQL database name |
| `POSTGRES_PORT` | `5434` | Host port mapped to container port 5432 |
| `DATABASE_URL` | `postgresql://vault:vault_secret@localhost:5434/document_vault?schema=public` | Prisma database connection string |
| `PORT` | `4001` | HTTP server port |
| `NODE_ENV` | `development` | Environment mode (`development` enables GraphiQL) |

---

## 🚀 Setup Instructions

Run the assignment's single setup command to spin up PostgreSQL, install dependencies, execute database migrations, and boot the development server:

```bash
docker compose up -d && bun install && bun run gendb && bun run dev
```

---

## 🗄️ Database & Migration Instructions

To manually manage PostgreSQL and Prisma migrations:

```bash
# 1. Start the PostgreSQL Docker container
docker compose up -d

# 2. Check database container status
docker compose ps

# 3. Generate Prisma Client & apply migrations
bun run gendb

# 4. Open Prisma Studio (optional database GUI)
npx prisma studio
```

---

## 🚀 Deploying to Vercel

Document Vault is preconfigured for **one-click serverless deployment on Vercel**.

### 1. Prerequisites
- A hosted PostgreSQL database (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com), [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres), or [Aiven](https://aiven.io)).
- A [Vercel](https://vercel.com) account connected to your GitHub.

### 2. Deployment Steps
1. **Push Changes to GitHub**:
   ```bash
   git add .
   git commit -m "feat: configure vercel serverless deployment"
   git push origin main
   ```
2. **Import into Vercel**:
   - Navigate to [vercel.com/new](https://vercel.com/new) and select the `Document-Vault` repository.
   - You can leave **Root Directory** as default (`./`) or select `document-vault` (both are supported).
3. **Configure Environment Variables**:
   - In **Project Settings → Environment Variables**, add:
     - `DATABASE_URL`: `postgresql://username:password@ep-sample-123.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. **Deploy**:
   - Click **Deploy**. Vercel will install dependencies, automatically generate the Prisma Client (`postinstall`), and deploy the serverless GraphQL API.
5. **Apply Database Migrations (One-Time Setup)**:
   - Push your schema to your hosted PostgreSQL database:
     ```bash
     DATABASE_URL="your-hosted-database-url" npx prisma db push
     ```

### 3. Accessing the Live API
- **Interactive GraphiQL Playground**: Open `https://<your-project>.vercel.app/` or `https://<your-project>.vercel.app/graphql` in your browser.
- **GraphQL API Endpoint**: Send HTTP `POST` requests to `https://<your-project>.vercel.app/graphql` with `Content-Type: application/json`.

---

## 💻 Running the Development Server

Start the GraphQL server with automatic hot-reloading:

```bash
bun run dev
```

Server logs will confirm:
```text
🗄️  Document Vault API
   GraphQL  → http://localhost:4001/graphql
   GraphiQL → http://localhost:4001/graphql
   Env      → development
```

---

## 🧪 Running Tests

### Run Full Test Suite (Unit + Integration)

```bash
bun test
```

### Run Sanity Check (Typecheck + Lint + Tests)

```bash
bun run sanity
```

### Run Only Unit Tests (No Database Required)

```bash
bun test tests/unit/
```

---

## 🔬 Running Integration Tests

The integration test suite runs against the real Docker PostgreSQL database:

```bash
# Ensure Docker Postgres is running first
docker compose up -d

# Run the integration test suite
bun test tests/integration/graphql.test.ts
```

---

## 🌐 GraphQL Endpoint & Playground

- **GraphQL HTTP POST Endpoint**: `http://localhost:4001/graphql`
- **Interactive GraphiQL Playground**: Open `http://localhost:4001/graphql` in your browser.

---

## 📖 Example GraphQL Queries

### 1. Get All Collections

```graphql
query GetCollections {
  collections {
    id
    name
    slug
    createdAt
    documents {
      id
      title
      isArchived
    }
  }
}
```

### 2. Get Collection by ID

```graphql
query GetCollection($id: ID!) {
  collection(id: $id) {
    id
    name
    slug
    createdAt
    documents {
      id
      title
      content
      tags
    }
  }
}
```

### 3. Query Documents with Search, Filter & Cursor Pagination

```graphql
query GetDocuments(
  $collectionId: ID
  $search: String
  $isArchived: Boolean
  $take: Int
  $cursor: String
) {
  documents(
    collectionId: $collectionId
    search: $search
    isArchived: $isArchived
    take: $take
    cursor: $cursor
  ) {
    documents {
      id
      title
      content
      tags
      isArchived
      createdAt
      collection {
        id
        name
      }
    }
    nextCursor
    hasMore
  }
}
```

---

## ✍️ Example GraphQL Mutations

### 1. Create Collection

```graphql
mutation CreateCollection($input: CreateCollectionInput!) {
  createCollection(input: $input) {
    id
    name
    slug
    createdAt
  }
}
```
*Variables:*
```json
{
  "input": {
    "name": "Engineering Guides",
    "slug": "engineering-guides"
  }
}
```

### 2. Create Document

```graphql
mutation CreateDocument($input: CreateDocumentInput!) {
  createDocument(input: $input) {
    id
    title
    content
    tags
    collectionId
    isArchived
    createdAt
  }
}
```
*Variables:*
```json
{
  "input": {
    "title": "GraphQL Architecture Guide",
    "content": "Detailed overview of schema-first GraphQL API design with Yoga and Prisma.",
    "tags": ["graphql", "architecture", "bun"],
    "collectionId": "cmt39iwwl0000i1q0u8un1fz8"
  }
}
```

### 3. Update Document (Partial Patch)

```graphql
mutation UpdateDocument($id: ID!, $input: UpdateDocumentInput!) {
  updateDocument(id: $id, input: $input) {
    id
    title
    isArchived
  }
}
```
*Variables:*
```json
{
  "id": "cmt39rxbj0004i11gjvhwxq7h",
  "input": {
    "title": "Updated Architecture Guide",
    "isArchived": true
  }
}
```

### 4. Move Document to Another Collection

```graphql
mutation MoveDocument($id: ID!, $input: MoveDocumentInput!) {
  moveDocument(id: $id, input: $input) {
    id
    collectionId
    collection {
      id
      name
    }
  }
}
```
*Variables:*
```json
{
  "id": "cmt39rxbj0004i11gjvhwxq7h",
  "input": {
    "collectionId": "cmt39rxgm000bi11gr4jiz3fu"
  }
}
```

### 5. Delete Document

```graphql
mutation DeleteDocument($id: ID!) {
  deleteDocument(id: $id)
}
```
*Variables:*
```json
{
  "id": "cmt39rxbj0004i11gjvhwxq7h"
}
```

---

## ⏩ Cursor Pagination Explanation

The API implements **opaque cursor-based pagination** rather than offset-based pagination (`OFFSET N LIMIT M`).

### Why Cursor-Based Pagination?
1. **Consistency**: Offset pagination shifts when rows are inserted or deleted mid-browse, causing clients to see duplicate items or skip items. Cursor pagination remains anchored to the exact last item seen.
2. **Performance**: PostgreSQL offset queries scan and discard $N$ rows ($O(N)$ overhead). Cursor queries use index lookups on `(createdAt, id)` ($O(\log N)$ overhead).

### Implementation (The $N+1$ Window Probe Pattern):
1. When a client requests `take: 20`, the resolver queries Prisma for **`take + 1` (21) rows** ordered deterministically by `createdAt ASC`.
2. If Prisma returns 21 rows:
   - `hasMore = true`
   - The returned array is trimmed to 20 items.
   - `nextCursor` is set to the `id` of the 20th document.
3. If Prisma returns $\le 20$ rows:
   - `hasMore = false`
   - `nextCursor = null`.
4. When the client sends `cursor: "doc_123"` on the next request, the API verifies cursor existence and instructs Prisma to fetch items using `{ cursor: { id: "doc_123" }, skip: 1 }`.
5. Stale or invalid cursors fall back gracefully to Page 1 without throwing execution errors.

---

## 🚨 Validation & Error Handling

All user input errors and database constraint violations are translated into structured `GraphQLError` objects with machine-readable `extensions.code` values:

| Error Case | Trigger Condition | Error Code | Example Message |
|---|---|---|---|
| **Empty String** | `title` or `content` is whitespace-only | `BAD_USER_INPUT` | `"title cannot be empty or whitespace-only."` |
| **Malformed Slug** | Slug contains spaces, caps, or invalid chars | `BAD_USER_INPUT` | `"Slug must contain only lowercase letters, numbers, and hyphens..."` |
| **Duplicate Slug** | Prisma `P2002` unique constraint failure | `CONFLICT` | `"A collection with slug 'engineering' already exists."` |
| **Entity Not Found** | Prisma `P2025` missing record error | `NOT_FOUND` | `"Document with id 'xyz' does not exist."` |
| **Invalid Parent** | Destination `collectionId` does not exist | `NOT_FOUND` | `"Collection with id 'abc' does not exist."` |

No raw Prisma database internals or stack traces leak to API consumers in production.

---

## ⚖️ Design Tradeoffs

1. **Schema-First SDL vs Code-First (Nexus/TypeGraphQL)**:
   - *Tradeoff*: Schema-first requires keeping SDL and TypeScript resolver types aligned manually.
   - *Rationale*: SDL provides a clean, language-agnostic contract (`schema.graphql`) that serves as clear documentation for frontend engineers and reviewers.
2. **Custom Validation vs Heavy Schema Validation Libraries (Zod)**:
   - *Tradeoff*: Hand-written string validators require manual maintenance.
   - *Rationale*: Kept runtime dependency overhead low while guaranteeing explicit, human-friendly GraphQL error codes.
3. **Cursor as CUID Document ID**:
   - *Tradeoff*: Exposes internal CUID as cursor instead of Base64-encoding `(createdAt, id)`.
   - *Rationale*: CUIDs are already unique strings; avoiding Base64 encoding keeps the API lightweight while remaining opaque to clients.

---

## 🔮 Future Extensions & Out of Scope

The following production features were **intentionally excluded** to maintain a tight 4–6 hour take-home scope:

- 🔒 **Authentication**: JWT / Session bearer token authentication.
- 🛡️ **Authorization & RBAC**: Role-based access control (Admin, Editor, Viewer permissions per collection).
- 🔍 **Full-Text Search**: Upgrading Postgres `ILIKE` substring search to `tsvector` / `tsquery` with GIN indexing or Elasticsearch.
- 📜 **Audit Logs**: Event stream / database audit logging for tracking document creation, updates, and deletions.
- 📦 **Object Storage Integration**: Amazon S3 / MinIO storage support for uploading binary file attachments.
- 📊 **Observability**: OpenTelemetry tracing & Prometheus metrics middleware for GraphQL Yoga.
- 🔀 **Advanced Relay Pagination**: Full Relay Connections specification with `edges`, `pageInfo`, `startCursor`, `endCursor`.
- 📜 **Document Versioning**: Immutable document revision history with diff tracking.
