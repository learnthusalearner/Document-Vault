import { describe, it, expect, beforeEach } from "bun:test";
import { collectionResolver } from "../../src/graphql/resolvers/collection.resolver.js";
import {
  makeMockPrisma,
  makeCollection,
  makeDocument,
  prismaUniqueError,
  type MockPrisma,
} from "./helpers/mock-prisma.js";

const NULL_PARENT = null as unknown;

/** Build a typed context from the mock. */
function makeCtx(prisma: MockPrisma) {
  return { prisma } as unknown as Parameters<
    typeof collectionResolver.Query.collections
  >[2];
}

describe("Collection resolver", () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makeMockPrisma();
  });

  // ── Query: collections ──────────────────────────────────────────────────────

  describe("Query.collections", () => {
    it("returns all collections ordered by createdAt asc", async () => {
      const col1 = makeCollection({ id: "a", createdAt: new Date("2024-01-01") });
      const col2 = makeCollection({ id: "b", createdAt: new Date("2024-02-01") });
      prisma.collection.findMany.mockResolvedValue([col1, col2]);

      const result = await collectionResolver.Query.collections(
        NULL_PARENT,
        {},
        makeCtx(prisma)
      );

      expect(result).toEqual([col1, col2]);
      expect(prisma.collection.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "asc" },
      });
    });

    it("returns an empty array when there are no collections", async () => {
      prisma.collection.findMany.mockResolvedValue([]);

      const result = await collectionResolver.Query.collections(
        NULL_PARENT,
        {},
        makeCtx(prisma)
      );

      expect(result).toEqual([]);
    });
  });

  // ── Query: collection ───────────────────────────────────────────────────────

  describe("Query.collection", () => {
    it("returns the collection for a valid id", async () => {
      const col = makeCollection({ id: "col-42" });
      prisma.collection.findUnique.mockResolvedValue(col);

      const result = await collectionResolver.Query.collection(
        NULL_PARENT,
        { id: "col-42" },
        makeCtx(prisma)
      );

      expect(result).toEqual(col);
      expect(prisma.collection.findUnique).toHaveBeenCalledWith({
        where: { id: "col-42" },
      });
    });

    it("returns null when the collection does not exist", async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      const result = await collectionResolver.Query.collection(
        NULL_PARENT,
        { id: "nope" },
        makeCtx(prisma)
      );

      expect(result).toBeNull();
    });
  });

  // ── Mutation: createCollection ──────────────────────────────────────────────

  describe("Mutation.createCollection", () => {
    it("creates and returns a collection, trimming name whitespace", async () => {
      const created = makeCollection({ name: "Engineering", slug: "engineering" });
      prisma.collection.create.mockResolvedValue(created);

      const result = await collectionResolver.Mutation.createCollection(
        NULL_PARENT,
        { input: { name: "  Engineering  ", slug: "engineering" } },
        makeCtx(prisma)
      );

      expect(result).toEqual(created);
      expect(prisma.collection.create).toHaveBeenCalledWith({
        data: { name: "Engineering", slug: "engineering" },
      });
    });

    it("throws BAD_USER_INPUT for an empty name", async () => {
      await expect(
        collectionResolver.Mutation.createCollection(
          NULL_PARENT,
          { input: { name: "", slug: "good-slug" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT", field: "name" },
      });
      expect(prisma.collection.create).not.toHaveBeenCalled();
    });

    it("throws BAD_USER_INPUT for a whitespace-only name", async () => {
      await expect(
        collectionResolver.Mutation.createCollection(
          NULL_PARENT,
          { input: { name: "   ", slug: "fine-slug" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT", field: "name" },
      });
    });

    it("throws BAD_USER_INPUT for a slug containing spaces", async () => {
      await expect(
        collectionResolver.Mutation.createCollection(
          NULL_PARENT,
          { input: { name: "Good Name", slug: "bad slug" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT", field: "slug" },
      });
    });

    it("throws BAD_USER_INPUT for a slug with uppercase letters", async () => {
      await expect(
        collectionResolver.Mutation.createCollection(
          NULL_PARENT,
          { input: { name: "Good Name", slug: "BadSlug" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT", field: "slug" },
      });
    });

    it("throws BAD_USER_INPUT for a slug starting with a hyphen", async () => {
      await expect(
        collectionResolver.Mutation.createCollection(
          NULL_PARENT,
          { input: { name: "Good Name", slug: "-bad" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT", field: "slug" },
      });
    });

    it("throws BAD_USER_INPUT for an empty slug", async () => {
      await expect(
        collectionResolver.Mutation.createCollection(
          NULL_PARENT,
          { input: { name: "Good Name", slug: "" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT", field: "slug" },
      });
    });

    it("throws CONFLICT for a duplicate slug with a descriptive message", async () => {
      prisma.collection.create.mockRejectedValue(prismaUniqueError());

      await expect(
        collectionResolver.Mutation.createCollection(
          NULL_PARENT,
          { input: { name: "Guides 2", slug: "guides" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "CONFLICT" },
        message: expect.stringContaining("guides"),
      });
    });

    it("re-throws unexpected database errors as-is", async () => {
      const boom = new Error("DB connection lost");
      prisma.collection.create.mockRejectedValue(boom);

      await expect(
        collectionResolver.Mutation.createCollection(
          NULL_PARENT,
          { input: { name: "N", slug: "n" } },
          makeCtx(prisma)
        )
      ).rejects.toBe(boom);
    });
  });

  // ── Field: Collection.documents ─────────────────────────────────────────────

  describe("Collection.documents field resolver", () => {
    it("returns documents belonging to the parent collection, ordered by createdAt", async () => {
      const doc = makeDocument({ collectionId: "col-99" });
      prisma.document.findMany.mockResolvedValue([doc]);

      const result = await collectionResolver.Collection.documents(
        { id: "col-99" },
        {},
        makeCtx(prisma)
      );

      expect(result).toEqual([doc]);
      expect(prisma.document.findMany).toHaveBeenCalledWith({
        where: { collectionId: "col-99" },
        orderBy: { createdAt: "asc" },
      });
    });
  });
});
