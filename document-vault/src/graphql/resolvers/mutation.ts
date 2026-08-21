import type { Context } from "../context.js";

export const mutationResolvers = {
  createCollection: (
    _parent: unknown,
    args: { input: { name: string; slug: string } },
    ctx: Context
  ) =>
    ctx.prisma.collection.create({
      data: {
        name: args.input.name,
        slug: args.input.slug,
      },
    }),

  createDocument: (
    _parent: unknown,
    args: {
      input: {
        title: string;
        content: string;
        tags?: string[];
        collectionId: string;
      };
    },
    ctx: Context
  ) =>
    ctx.prisma.document.create({
      data: {
        title: args.input.title,
        content: args.input.content,
        tags: args.input.tags ?? [],
        collectionId: args.input.collectionId,
      },
    }),

  updateDocument: (
    _parent: unknown,
    args: {
      id: string;
      input: {
        title?: string;
        content?: string;
        tags?: string[];
        isArchived?: boolean;
      };
    },
    ctx: Context
  ) =>
    ctx.prisma.document.update({
      where: { id: args.id },
      data: {
        ...(args.input.title !== undefined && { title: args.input.title }),
        ...(args.input.content !== undefined && { content: args.input.content }),
        ...(args.input.tags !== undefined && { tags: args.input.tags }),
        ...(args.input.isArchived !== undefined && {
          isArchived: args.input.isArchived,
        }),
      },
    }),

  deleteDocument: async (
    _parent: unknown,
    args: { id: string },
    ctx: Context
  ) => {
    await ctx.prisma.document.delete({ where: { id: args.id } });
    return args.id;
  },

  moveDocument: (
    _parent: unknown,
    args: { id: string; input: { collectionId: string } },
    ctx: Context
  ) =>
    ctx.prisma.document.update({
      where: { id: args.id },
      data: { collectionId: args.input.collectionId },
    }),
} as const;
