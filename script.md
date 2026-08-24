# 🎙️ Document Vault — Video Walkthrough Script (5–8 Minutes)

> **Instructions for Recording**:
> - Read the script naturally in the first person.
> - Follow the `[SHOW: ...]` cues to switch tabs/screens seamlessly.
> - Keep an upbeat, confident, and professional engineering tone.
> - Estimated recording time: **6 to 7 minutes**.

---

## ⏱️ [00:00 – 01:00] Introduction & Architecture Overview

**[SHOW: README.md or Project Architecture Diagram]**

"Hi everyone! Today I’m walking you through my implementation of the **Document Vault** backend take-home assignment.

Document Vault is a production-grade, schema-first **GraphQL API** designed to manage hierarchical collections, documents, tags, and archival states with deterministic cursor-based pagination.

When designing this backend, my goal was to build something clean, robust, and production-ready without unnecessary bloat. 

Here is our core technology stack:
1. **Runtime & Test Runner**: **Bun** — chosen for its blazing fast execution speed, native TypeScript engine, and built-in test runner.
2. **Language**: **TypeScript** configured in strict mode with zero `any` types and zero loose assertions.
3. **API Layer**: **GraphQL Yoga** using a **Schema-First SDL** approach.
4. **ORM**: **Prisma ORM (v6)** for type-safe database queries.
5. **Database**: **PostgreSQL 16** running containerized via Docker Compose.

Let’s dive straight into the data layer and see how the database is modeled."

---

## ⏱️ [01:00 – 02:15] Data Modeling, Database Indexes & Migrations

**[SHOW: `prisma/schema.prisma` and then open `prisma/migrations/.../migration.sql`]**

"Let's look at the database schema in `schema.prisma`.

We have two core models: `Collection` and `Document`.

1. **`Collection`**:
   - Uses an auto-generated CUID for IDs.
   - Has a `name` and a `slug`. The `slug` is enforced as `@unique` at both the database level and the application validation layer.
   - Has a `createdAt` timestamp.

2. **`Document`**:
   - Belongs to a collection via a foreign key `collectionId`.
   - Has `title`, `content`, `isArchived` (defaulting to `false`), `createdAt`, and `tags`.
   - Notice that `tags` is stored as a native PostgreSQL string array (`String[]`).

3. **Indexing Strategy**:
   Performance was a first-class consideration:
   - `@@index([collectionId])` speeds up collection-scoped lookups.
   - `@@index([isArchived])` accelerates active vs. archived filtering.
   - `@@index([collectionId, isArchived])` is a composite index for the most common query pattern (active documents in a specific collection).
   - `@@index([collectionId, createdAt])` optimizes chronologically sorted paginated queries.
   - `@@index([tags], type: Gin)` applies a PostgreSQL **GIN index** on the tags array, enabling $O(1)$ containment queries (`@>` operator).

4. **Referential Integrity**:
   In our migration SQL, the foreign key constraint is configured with `ON DELETE RESTRICT`. This prevents accidental deletion of collections that still contain active documents, ensuring our database state remains consistent.

All database changes are tracked via real, version-controlled Prisma migrations."

---

## ⏱️ [02:15 – 03:30] Schema-First GraphQL Design & Resolvers

**[SHOW: `src/graphql/schema.graphql` and `src/graphql/resolvers/index.ts`]**

"Next, let’s look at the GraphQL layer.

I chose a **Schema-First SDL approach** (`schema.graphql`). Defining the schema first gives us a clean, self-documenting contract that is completely decoupled from implementation details.

Our schema provides:
- **Queries**:
  - `collections`: Returns all collections ordered chronologically.
  - `collection(id)`: Returns a nullable collection.
  - `documents(...)`: A paginated document query supporting `collectionId` filtering, `isArchived` status filtering, case-insensitive `search` substring matching, and cursor pagination.
  - `health`: An uptime/health check query returning `'OK'`.
- **Mutations**:
  - `createCollection`
  - `createDocument`
  - `updateDocument` — implements a clean partial patch (only supplied fields are modified).
  - `deleteDocument` — returns the deleted document ID.
  - `moveDocument` — safely relocates a document to a different collection.

**[SHOW: `src/graphql/resolvers/collection.resolver.ts` and `document.resolver.ts`]**

Looking at our resolvers:
- The resolver architecture is modular: `collection.resolver.ts` and `document.resolver.ts` are self-contained and merged in `index.ts`.
- Every resolver receives our typed `Context`, which injects the Prisma client singleton.
- Nested relations are handled efficiently: `Collection.documents` resolves all documents belonging to the parent collection, and `Document.collection` resolves the parent collection."

---

## ⏱️ [03:30 – 04:45] Deep Dive: Deterministic Cursor Pagination

**[SHOW: `src/graphql/resolvers/document.resolver.ts` (scroll to `documents` query)]**

"Now, let's take a close look at our cursor pagination implementation, as this is a critical requirement.

Instead of offset-based pagination (`OFFSET / LIMIT`), which suffers from performance degradation and row-drift anomalies when items are added or deleted, we implement **deterministic, opaque cursor pagination**.

Here is how the algorithm works:

1. **Take Clamping**: `take` is safely clamped between 1 and 100, with a default of 20.
2. **The $N+1$ Window Probe**:
   When the client requests $N$ items (e.g. `take: 20`), the resolver asks Prisma for **`take + 1` (21) rows**, ordered deterministically by `createdAt ASC`.
3. **Page Slicing & `nextCursor`**:
   - If Prisma returns 21 rows, `hasMore` is `true`. We slice off the 21st record, return the 20 records, and assign `nextCursor = records[19].id`.
   - If Prisma returns $\le 20$ rows, `hasMore` is `false`, and `nextCursor` is `null`.
4. **Subsequent Page Navigation**:
   When the client sends `cursor: "doc_xyz"`, Prisma fetches records using `{ cursor: { id: "doc_xyz" }, skip: 1 }`.
5. **Cursor Resilience**:
   Before querying, we verify cursor existence against the active filter criteria using `findFirst`. If a client supplies a stale or invalid cursor (e.g., if the record was deleted), the resolver gracefully falls back to Page 1 instead of crashing or throwing an unhandled exception."

---

## ⏱️ [04:45 – 05:45] Validation & Error Handling

**[SHOW: `src/validation/index.ts`]**

"Data integrity and user feedback are essential, so all validation is strictly enforced before database operations:

1. **Title & Content**: Must not be empty or contain only whitespace.
2. **Slug Validation**: Must follow a strict slug regex (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), rejecting spaces, uppercase letters, and leading or trailing hyphens.
3. **Tags**: Each tag must be non-empty and under 50 characters.
4. **Relational Checks**: `createDocument` and `moveDocument` explicitly assert that the destination collection exists (`assertCollectionExists`), returning a clear `NOT_FOUND` error if missing.
5. **Error Sanitization**:
   Prisma database constraint codes (`P2002` for unique slug collisions, `P2025` for missing records) are caught and translated into structured `GraphQLError` objects with standard machine-readable extension codes: `BAD_USER_INPUT`, `CONFLICT`, and `NOT_FOUND`.
   No raw database internals or SQL stack traces ever leak to API consumers."

---

## ⏱️ [05:45 – 07:00] Testing Strategy & Verification

**[SHOW: Terminal / VS Code split view]**

"Let's look at the testing strategy. We have built a comprehensive, two-tier test suite.

**[SHOW: `tests/unit/helpers/mock-prisma.ts`]**

1. **51 Pure Unit Tests**:
   - Located in `tests/unit/`.
   - Uses `mock-prisma.ts` to provide fully typed mocks of Prisma Client delegates using Bun's native test mock functions.
   - Tests all resolver branches, error paths, validation edge cases, and pagination states in complete isolation without needing a database.

2. **11 PostgreSQL Integration Tests**:
   - Located in `tests/integration/graphql.test.ts`.
   - Executes real GraphQL operations over HTTP against the running PostgreSQL 16 container.
   - Tests the complete end-to-end pipeline: HTTP parsing $\rightarrow$ GraphQL Yoga $\rightarrow$ Schema $\rightarrow$ Resolvers $\rightarrow$ Validation $\rightarrow$ Prisma $\rightarrow$ PostgreSQL.
   - Hooks clean up all test records and cleanly disconnect the Prisma connection pool.

Let's run our full verification suite in the terminal:

**[EXECUTE COMMAND IN TERMINAL]:**
```bash
bun run sanity
```

**[NARRATE AS TESTS PASS]:**
- Typecheck (`tsc --noEmit`): 0 errors.
- Linter: 0 errors.
- Test Suite: **All 62 tests pass across 4 files in under 1 second!**"

---

## ⏱️ [07:00 – 07:45] Design Tradeoffs & Out of Scope

**[SHOW: README.md — Tradeoffs & Future Extensions section]**

"To wrap up, here are a few key design tradeoffs made for this project:

1. **Schema-First SDL vs Code-First**:
   Schema-first gives us a clean, language-agnostic contract (`schema.graphql`) that acts as living documentation for frontend teams, even though it requires maintaining resolver types alongside the SDL.
2. **CUID vs Base64 Cursors**:
   We use the document's CUID as the opaque cursor directly. Since CUIDs are unique and immutable, this avoids unnecessary Base64 serialization overhead while keeping the client contract opaque.
3. **Intentional Scope Boundaries**:
   To deliver a tight, high-quality solution within the 4–6 hour scope, enterprise scaffolding like JWT authentication, role-based access control, Redis caching layers, and microservice federation were intentionally excluded and documented as future extensions.

The code is clean, fully typed, thoroughly tested, and ready for review.

Thank you for your time and for reviewing my Document Vault submission!"
