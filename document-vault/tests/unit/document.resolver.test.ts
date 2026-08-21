import { describe, it, expect, beforeEach } from "bun:test";
import { documentResolver } from "../../src/graphql/resolvers/document.resolver.js";
import {
  makeMockPrisma,
  makeCollection,
  makeDocument,
  prismaNotFoundError,
  type MockPrisma,
} from "./helpers/mock-prisma.js";

const NULL_PARENT = null as unknown;

function makeCtx(prisma: MockPrisma) {
  return { prisma } as unknown as Parameters<
    typeof documentResolver.Mutation.createDocument
  >[2];
}

describe("Document resolver — mutations", () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makeMockPrisma();
  });

  // ── createDocument ─────────────────────────────────────────────────────────

  describe("Mutation.createDocument", () => {
    it("creates a document and returns it with trimmed title/content", async () => {
      prisma.collection.findUnique.mockResolvedValue(makeCollection());
      const created = makeDocument({ title: "My Doc", content: "Body text" });
      prisma.document.create.mockResolvedValue(created);

      const result = await documentResolver.Mutation.createDocument(
        NULL_PARENT,
        {
          input: {
            title: "  My Doc  ",
            content: "  Body text  ",
            tags: ["tag1"],
            collectionId: "col-1",
          },
        },
        makeCtx(prisma)
      );

      expect(result).toEqual(created);
      expect(prisma.document.create).toHaveBeenCalledWith({
        data: {
          title: "My Doc",
          content: "Body text",
          tags: ["tag1"],
          collectionId: "col-1",
        },
      });
    });

    it("defaults tags to [] when omitted", async () => {
      prisma.collection.findUnique.mockResolvedValue(makeCollection());
      prisma.document.create.mockResolvedValue(makeDocument({ tags: [] }));

      await documentResolver.Mutation.createDocument(
        NULL_PARENT,
        { input: { title: "T", content: "C", collectionId: "col-1" } },
        makeCtx(prisma)
      );

      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tags: [] }),
        })
      );
    });

    it("throws BAD_USER_INPUT for an empty title", async () => {
      await expect(
        documentResolver.Mutation.createDocument(
          NULL_PARENT,
          { input: { title: "", content: "C", collectionId: "col-1" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT", field: "title" },
      });
      expect(prisma.document.create).not.toHaveBeenCalled();
    });

    it("throws BAD_USER_INPUT for a whitespace-only title", async () => {
      await expect(
        documentResolver.Mutation.createDocument(
          NULL_PARENT,
          { input: { title: "   ", content: "C", collectionId: "col-1" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT", field: "title" },
      });
    });

    it("throws BAD_USER_INPUT for an empty content", async () => {
      await expect(
        documentResolver.Mutation.createDocument(
          NULL_PARENT,
          { input: { title: "T", content: "", collectionId: "col-1" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT", field: "content" },
      });
    });

    it("throws BAD_USER_INPUT for a whitespace-only content", async () => {
      await expect(
        documentResolver.Mutation.createDocument(
          NULL_PARENT,
          { input: { title: "T", content: "  \t  ", collectionId: "col-1" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT", field: "content" },
      });
    });

    it("throws NOT_FOUND when the collection does not exist", async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      await expect(
        documentResolver.Mutation.createDocument(
          NULL_PARENT,
          {
            input: {
              title: "T",
              content: "C",
              collectionId: "no-such",
            },
          },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "NOT_FOUND", field: "collectionId" },
      });
      expect(prisma.document.create).not.toHaveBeenCalled();
    });
  });

  // ── updateDocument ─────────────────────────────────────────────────────────

  describe("Mutation.updateDocument", () => {
    it("updates only the supplied fields", async () => {
      const updated = makeDocument({ title: "New Title" });
      prisma.document.update.mockResolvedValue(updated);

      const result = await documentResolver.Mutation.updateDocument(
        NULL_PARENT,
        { id: "doc-1", input: { title: "New Title" } },
        makeCtx(prisma)
      );

      expect(result).toEqual(updated);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { title: "New Title" },
      });
    });

    it("does not include content/tags/isArchived in the update data when only title is provided", async () => {
      prisma.document.update.mockResolvedValue(makeDocument());

      await documentResolver.Mutation.updateDocument(
        NULL_PARENT,
        { id: "doc-1", input: { title: "Only Title" } },
        makeCtx(prisma)
      );

      const firstCall = prisma.document.update.mock.calls[0];
      const callArg = (firstCall?.[0] ?? {}) as { data: Record<string, unknown> };
      expect(callArg.data).not.toHaveProperty("content");
      expect(callArg.data).not.toHaveProperty("tags");
      expect(callArg.data).not.toHaveProperty("isArchived");
    });

    it("trims title and content before writing", async () => {
      prisma.document.update.mockResolvedValue(makeDocument());

      await documentResolver.Mutation.updateDocument(
        NULL_PARENT,
        {
          id: "doc-1",
          input: { title: "  Trimmed  ", content: "  Body  " },
        },
        makeCtx(prisma)
      );

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { title: "Trimmed", content: "Body" },
      });
    });

    it("throws BAD_USER_INPUT when no fields are provided", async () => {
      await expect(
        documentResolver.Mutation.updateDocument(
          NULL_PARENT,
          { id: "doc-1", input: {} },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT" },
        message: "No fields provided to update.",
      });
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it("throws BAD_USER_INPUT for a whitespace-only title on update", async () => {
      await expect(
        documentResolver.Mutation.updateDocument(
          NULL_PARENT,
          { id: "doc-1", input: { title: "   " } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT", field: "title" },
      });
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when the document does not exist", async () => {
      prisma.document.update.mockRejectedValue(prismaNotFoundError());

      await expect(
        documentResolver.Mutation.updateDocument(
          NULL_PARENT,
          { id: "no-such", input: { title: "T" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "NOT_FOUND" },
        message: expect.stringContaining("no-such"),
      });
    });
  });

  // ── deleteDocument ─────────────────────────────────────────────────────────

  describe("Mutation.deleteDocument", () => {
    it("deletes the document and returns its id", async () => {
      prisma.document.delete.mockResolvedValue(makeDocument({ id: "doc-99" }));

      const result = await documentResolver.Mutation.deleteDocument(
        NULL_PARENT,
        { id: "doc-99" },
        makeCtx(prisma)
      );

      expect(result).toBe("doc-99");
      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: "doc-99" },
      });
    });

    it("throws NOT_FOUND for a non-existent document", async () => {
      prisma.document.delete.mockRejectedValue(prismaNotFoundError());

      await expect(
        documentResolver.Mutation.deleteDocument(
          NULL_PARENT,
          { id: "gone" },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "NOT_FOUND" },
        message: expect.stringContaining("gone"),
      });
    });
  });

  // ── moveDocument ───────────────────────────────────────────────────────────

  describe("Mutation.moveDocument", () => {
    it("moves the document to the destination collection and returns it", async () => {
      prisma.collection.findUnique.mockResolvedValue(
        makeCollection({ id: "col-2" })
      );
      const moved = makeDocument({ id: "doc-1", collectionId: "col-2" });
      prisma.document.update.mockResolvedValue(moved);

      const result = await documentResolver.Mutation.moveDocument(
        NULL_PARENT,
        { id: "doc-1", input: { collectionId: "col-2" } },
        makeCtx(prisma)
      );

      expect(result).toEqual(moved);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { collectionId: "col-2" },
      });
    });

    it("throws NOT_FOUND when the destination collection does not exist", async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      await expect(
        documentResolver.Mutation.moveDocument(
          NULL_PARENT,
          { id: "doc-1", input: { collectionId: "no-col" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "NOT_FOUND", field: "collectionId" },
      });
      // document.update must NOT be called if collection check fails
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when the document itself does not exist", async () => {
      prisma.collection.findUnique.mockResolvedValue(makeCollection());
      prisma.document.update.mockRejectedValue(prismaNotFoundError());

      await expect(
        documentResolver.Mutation.moveDocument(
          NULL_PARENT,
          { id: "no-doc", input: { collectionId: "col-1" } },
          makeCtx(prisma)
        )
      ).rejects.toMatchObject({
        extensions: { code: "NOT_FOUND" },
        message: expect.stringContaining("no-doc"),
      });
    });
  });
});
