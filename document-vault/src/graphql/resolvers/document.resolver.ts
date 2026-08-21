import { GraphQLError } from "graphql";
import type { Context } from "../context.js";
import {
  validateNonEmpty,
  validateTags,
  handleNotFound,
} from "../../validation/index.js";
import { assertCollectionExists } from "./collection.resolver.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;

// ── Input types ───────────────────────────────────────────────────────────────

interface CreateDocumentInput {
  title: string;
  content: string;
  tags?: string[];
  collectionId: string;
}

interface UpdateDocumentInput {
  title?: string;
  content?: string;
  tags?: string[];
  isArchived?: boolean;
}

interface DocumentsArgs {
  collectionId?: string;
  search?: string;
  isArchived?: boolean;
  take?: number;
  cursor?: string;
}

// ── Query resolvers ───────────────────────────────────────────────────────────

const documents = async (
  _parent: unknown,
  args: DocumentsArgs,
  ctx: Context
) => {
  const take = Math.min(args.take ?? DEFAULT_TAKE, MAX_TAKE);

  // Build where clause — only include filters that were explicitly supplied
  const where = {
    ...(args.collectionId !== undefined && {
      collectionId: args.collectionId,
    }),
    ...(args.isArchived !== undefined && {
      isArchived: args.isArchived,
    }),
    ...(args.search !== undefined && {
      OR: [
        { title: { contains: args.search, mode: "insensitive" as const } },
        { content: { contains: args.search, mode: "insensitive" as const } },
      ],
    }),
  };

  // Handle invalid cursor gracefully — unknown cursor → start from beginning
  let cursorClause:
    | { cursor: { id: string }; skip: number }
    | Record<string, never> = {};

  if (args.cursor !== undefined) {
    const cursorExists = await ctx.prisma.document.findUnique({
      where: { id: args.cursor },
      select: { id: true },
    });
    if (cursorExists !== null) {
      cursorClause = { cursor: { id: args.cursor }, skip: 1 };
    }
    // If cursor is invalid/stale, silently start from the beginning (no error)
  }

  // Fetch take+1 to detect whether a next page exists
  const rows = await ctx.prisma.document.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: take + 1,
    ...cursorClause,
  });

  const hasMore = rows.length > take;
  const pageRows = hasMore ? rows.slice(0, take) : rows;
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor = hasMore && lastRow !== undefined ? lastRow.id : null;

  return { documents: pageRows, nextCursor, hasMore };
};

// ── Mutation resolvers ────────────────────────────────────────────────────────

const createDocument = async (
  _parent: unknown,
  args: { input: CreateDocumentInput },
  ctx: Context
) => {
  const { title, content, collectionId } = args.input;
  const tags = args.input.tags ?? [];

  validateNonEmpty(title, "title");
  validateNonEmpty(content, "content");
  validateTags(tags);

  // Verify the collection exists before inserting — gives a clean error
  await assertCollectionExists(ctx, collectionId);

  return ctx.prisma.document.create({
    data: {
      title: title.trim(),
      content: content.trim(),
      tags,
      collectionId,
    },
  });
};

const updateDocument = async (
  _parent: unknown,
  args: { id: string; input: UpdateDocumentInput },
  ctx: Context
) => {
  const { title, content, tags, isArchived } = args.input;

  // Validate only supplied fields
  if (title !== undefined) validateNonEmpty(title, "title");
  if (content !== undefined) validateNonEmpty(content, "content");
  if (tags !== undefined) validateTags(tags);

  // Build a partial update — only include fields that were provided
  const data = {
    ...(title !== undefined && { title: title.trim() }),
    ...(content !== undefined && { content: content.trim() }),
    ...(tags !== undefined && { tags }),
    ...(isArchived !== undefined && { isArchived }),
  };

  if (Object.keys(data).length === 0) {
    throw new GraphQLError("No fields provided to update.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  try {
    return await ctx.prisma.document.update({
      where: { id: args.id },
      data,
    });
  } catch (err) {
    handleNotFound(err, `Document with id "${args.id}" does not exist.`);
  }
};

const deleteDocument = async (
  _parent: unknown,
  args: { id: string },
  ctx: Context
) => {
  try {
    await ctx.prisma.document.delete({ where: { id: args.id } });
    return args.id;
  } catch (err) {
    handleNotFound(err, `Document with id "${args.id}" does not exist.`);
  }
};

const moveDocument = async (
  _parent: unknown,
  args: { id: string; input: { collectionId: string } },
  ctx: Context
) => {
  const { collectionId } = args.input;

  // Both document and destination collection must exist
  await assertCollectionExists(ctx, collectionId);

  try {
    return await ctx.prisma.document.update({
      where: { id: args.id },
      data: { collectionId },
    });
  } catch (err) {
    handleNotFound(err, `Document with id "${args.id}" does not exist.`);
  }
};

// ── Field resolvers ───────────────────────────────────────────────────────────

const documentCollection = (
  parent: { collectionId: string },
  _args: unknown,
  ctx: Context
) =>
  ctx.prisma.collection.findUniqueOrThrow({
    where: { id: parent.collectionId },
  });

// ── Export ────────────────────────────────────────────────────────────────────

export const documentResolver = {
  Query: {
    documents,
  },
  Mutation: {
    createDocument,
    updateDocument,
    deleteDocument,
    moveDocument,
  },
  Document: {
    collection: documentCollection,
  },
};
