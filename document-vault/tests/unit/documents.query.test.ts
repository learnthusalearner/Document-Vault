import { describe, it, expect, beforeEach } from "bun:test";
import { documentResolver } from "../../src/graphql/resolvers/document.resolver.js";
import {
  makeMockPrisma,
  makeDocument,
  type MockPrisma,
} from "./helpers/mock-prisma.js";

const NULL_PARENT = null as unknown;

function makeCtx(prisma: MockPrisma) {
  return { prisma } as unknown as Parameters<
    typeof documentResolver.Query.documents
  >[2];
}

describe("documents query — search, filter, and pagination", () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makeMockPrisma();
    // By default, cursor validation returns "not found" (no cursor forwarding)
    prisma.document.findFirst.mockResolvedValue(null);
    prisma.document.findMany.mockResolvedValue([]);
  });

  // ── Search ──────────────────────────────────────────────────────────────────

  describe("search", () => {
    it("passes an OR clause for title and content when search is provided", async () => {
      await documentResolver.Query.documents(
        NULL_PARENT,
        { search: "typescript" },
        makeCtx(prisma)
      );

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: "typescript", mode: "insensitive" } },
              { content: { contains: "typescript", mode: "insensitive" } },
            ],
          }),
        })
      );
    });

    it("returns documents matching a substring in the title", async () => {
      const doc = makeDocument({ title: "TypeScript Guide" });
      prisma.document.findMany.mockResolvedValue([doc]);

      const result = await documentResolver.Query.documents(
        NULL_PARENT,
        { search: "typescript" },
        makeCtx(prisma)
      );

      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]?.title).toBe("TypeScript Guide");
    });

    it("returns documents matching a substring in the content", async () => {
      const doc = makeDocument({ content: "Advanced typescript tricks" });
      prisma.document.findMany.mockResolvedValue([doc]);

      const result = await documentResolver.Query.documents(
        NULL_PARENT,
        { search: "tricks" },
        makeCtx(prisma)
      );

      expect(result.documents[0]?.content).toContain("tricks");
    });

    it("omits the OR clause when search is not provided", async () => {
      await documentResolver.Query.documents(
        NULL_PARENT,
        {},
        makeCtx(prisma)
      );

      const firstCall = prisma.document.findMany.mock.calls[0];
      const call = (firstCall?.[0] ?? {}) as { where?: Record<string, unknown> };
      expect(call.where).not.toHaveProperty("OR");
    });
  });

  // ── collectionId filter ─────────────────────────────────────────────────────

  describe("collectionId filter", () => {
    it("adds collectionId to the where clause when provided", async () => {
      await documentResolver.Query.documents(
        NULL_PARENT,
        { collectionId: "col-42" },
        makeCtx(prisma)
      );

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ collectionId: "col-42" }),
        })
      );
    });

    it("omits collectionId from the where clause when not provided", async () => {
      await documentResolver.Query.documents(
        NULL_PARENT,
        {},
        makeCtx(prisma)
      );

      const firstCall = prisma.document.findMany.mock.calls[0];
      const call = (firstCall?.[0] ?? {}) as { where?: Record<string, unknown> };
      expect(call.where).not.toHaveProperty("collectionId");
    });
  });

  // ── isArchived filter ───────────────────────────────────────────────────────

  describe("isArchived filter", () => {
    it("adds isArchived:true to the where clause", async () => {
      await documentResolver.Query.documents(
        NULL_PARENT,
        { isArchived: true },
        makeCtx(prisma)
      );

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isArchived: true }),
        })
      );
    });

    it("adds isArchived:false to the where clause", async () => {
      await documentResolver.Query.documents(
        NULL_PARENT,
        { isArchived: false },
        makeCtx(prisma)
      );

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isArchived: false }),
        })
      );
    });

    it("omits isArchived from the where clause when not provided", async () => {
      await documentResolver.Query.documents(
        NULL_PARENT,
        {},
        makeCtx(prisma)
      );

      const firstCall = prisma.document.findMany.mock.calls[0];
      const call = (firstCall?.[0] ?? {}) as { where?: Record<string, unknown> };
      expect(call.where).not.toHaveProperty("isArchived");
    });
  });

  // ── Combined filters ────────────────────────────────────────────────────────

  describe("combined filters", () => {
    it("combines collectionId, isArchived, and search in a single where clause", async () => {
      await documentResolver.Query.documents(
        NULL_PARENT,
        { collectionId: "col-1", isArchived: false, search: "guide" },
        makeCtx(prisma)
      );

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            collectionId: "col-1",
            isArchived: false,
            OR: [
              { title: { contains: "guide", mode: "insensitive" } },
              { content: { contains: "guide", mode: "insensitive" } },
            ],
          },
        })
      );
    });
  });

  // ── Pagination ──────────────────────────────────────────────────────────────

  describe("cursor-based pagination", () => {
    it("fetches take+1 rows to detect whether a next page exists", async () => {
      await documentResolver.Query.documents(
        NULL_PARENT,
        { take: 5 },
        makeCtx(prisma)
      );

      const firstCall = prisma.document.findMany.mock.calls[0];
      const call = (firstCall?.[0] ?? {}) as { take: number };
      expect(call.take).toBe(6); // take + 1
    });

    it("sets hasMore:false and nextCursor:null when results fit in one page", async () => {
      prisma.document.findMany.mockResolvedValue([
        makeDocument({ id: "d1" }),
        makeDocument({ id: "d2" }),
      ]);

      const result = await documentResolver.Query.documents(
        NULL_PARENT,
        { take: 5 },
        makeCtx(prisma)
      );

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.documents).toHaveLength(2);
    });

    it("sets hasMore:true and nextCursor equals the last returned item's id", async () => {
      prisma.document.findMany.mockResolvedValue([
        makeDocument({ id: "d1" }),
        makeDocument({ id: "d2" }),
        makeDocument({ id: "d3" }),
      ]);

      const result = await documentResolver.Query.documents(
        NULL_PARENT,
        { take: 2 },
        makeCtx(prisma)
      );

      expect(result.hasMore).toBe(true);
      expect(result.documents).toHaveLength(2);
      expect(result.nextCursor).toBe("d2");
    });

    it("strips the extra row from the returned documents", async () => {
      prisma.document.findMany.mockResolvedValue([
        makeDocument({ id: "d1" }),
        makeDocument({ id: "d2" }),
        makeDocument({ id: "d3" }),
      ]);

      const result = await documentResolver.Query.documents(
        NULL_PARENT,
        { take: 2 },
        makeCtx(prisma)
      );

      expect(result.documents.map((d) => d.id)).toEqual(["d1", "d2"]);
    });

    it("passes cursor and skip:1 to prisma when a valid cursor is provided", async () => {
      prisma.document.findFirst.mockResolvedValue(
        makeDocument({ id: "cursor-id" })
      );

      await documentResolver.Query.documents(
        NULL_PARENT,
        { cursor: "cursor-id", take: 5 },
        makeCtx(prisma)
      );

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "cursor-id" },
          skip: 1,
        })
      );
    });

    it("silently falls back to page 1 when the cursor is stale or invalid", async () => {
      prisma.document.findFirst.mockResolvedValue(null); // cursor not found
      prisma.document.findMany.mockResolvedValue([makeDocument()]);

      const result = await documentResolver.Query.documents(
        NULL_PARENT,
        { cursor: "stale-xyz", take: 5 },
        makeCtx(prisma)
      );

      const firstCall = prisma.document.findMany.mock.calls[0];
      const call = (firstCall?.[0] ?? {}) as Record<string, unknown>;
      expect(call).not.toHaveProperty("cursor");
      expect(call).not.toHaveProperty("skip");
      expect(result.documents).toHaveLength(1);
    });

    it("always orders results by createdAt asc for deterministic pages", async () => {
      await documentResolver.Query.documents(
        NULL_PARENT,
        {},
        makeCtx(prisma)
      );

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "asc" } })
      );
    });

    it("caps take at MAX_TAKE (100) even when a larger value is requested", async () => {
      await documentResolver.Query.documents(
        NULL_PARENT,
        { take: 999 },
        makeCtx(prisma)
      );

      const firstCall = prisma.document.findMany.mock.calls[0];
      const call = (firstCall?.[0] ?? {}) as { take: number };
      expect(call.take).toBe(101); // 100 + 1
    });

    it("defaults to take 20 when take is not provided", async () => {
      await documentResolver.Query.documents(
        NULL_PARENT,
        {},
        makeCtx(prisma)
      );

      const firstCall = prisma.document.findMany.mock.calls[0];
      const call = (firstCall?.[0] ?? {}) as { take: number };
      expect(call.take).toBe(21); // 20 + 1
    });
  });
});
