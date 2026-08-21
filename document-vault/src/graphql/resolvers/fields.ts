import type { Collection, Document } from "@prisma/client";
import type { Context } from "../context.js";

/**
 * Field resolvers for Collection.
 *
 * `documents` is resolved lazily (only when the client requests it),
 * which avoids an unnecessary JOIN when querying collections without
 * their documents.
 */
export const collectionResolvers = {
  Collection: {
    documents: (parent: Collection, _args: unknown, ctx: Context) =>
      ctx.prisma.document.findMany({
        where: { collectionId: parent.id },
        orderBy: { createdAt: "asc" },
      }),
  },
} as const;

/**
 * Field resolvers for Document.
 *
 * `collection` is resolved lazily so that document-only queries don't
 * pay the cost of joining back to the collection table.
 */
export const documentResolvers = {
  Document: {
    collection: (parent: Document, _args: unknown, ctx: Context) =>
      ctx.prisma.collection.findUniqueOrThrow({
        where: { id: parent.collectionId },
      }),
  },
} as const;
