import type { Context } from "../context.js";

const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;

export const queryResolvers = {
  health: () => "ok",

  collections: (_parent: unknown, _args: unknown, ctx: Context) =>
    ctx.prisma.collection.findMany({ orderBy: { createdAt: "asc" } }),

  collection: (
    _parent: unknown,
    args: { id: string },
    ctx: Context
  ) =>
    ctx.prisma.collection.findUnique({ where: { id: args.id } }),

  documents: async (
    _parent: unknown,
    args: {
      collectionId?: string;
      search?: string;
      isArchived?: boolean;
      take?: number;
      cursor?: string;
    },
    ctx: Context
  ) => {
    const take = Math.min(args.take ?? DEFAULT_TAKE, MAX_TAKE);

    // Fetch one extra to determine whether there is a next page
    const rows = await ctx.prisma.document.findMany({
      where: {
        ...(args.collectionId !== undefined && {
          collectionId: args.collectionId,
        }),
        ...(args.isArchived !== undefined && {
          isArchived: args.isArchived,
        }),
        ...(args.search !== undefined && {
          OR: [
            { title: { contains: args.search, mode: "insensitive" } },
            { content: { contains: args.search, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { createdAt: "asc" },
      take: take + 1,
      ...(args.cursor !== undefined && {
        cursor: { id: args.cursor },
        skip: 1, // skip the cursor item itself
      }),
    });

    const hasMore = rows.length > take;
    const documents = hasMore ? rows.slice(0, take) : rows;
    const lastDoc = documents[documents.length - 1];
    const nextCursor = hasMore && lastDoc ? lastDoc.id : null;

    return { documents, nextCursor, hasMore };
  },
} as const;
