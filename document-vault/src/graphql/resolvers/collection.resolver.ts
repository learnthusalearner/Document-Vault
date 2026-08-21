import { GraphQLError } from "graphql";
import type { Context } from "../context.js";
import {
  validateNonEmpty,
  validateSlug,
  handleUniqueConstraint,
} from "../../validation/index.js";

// ── Input types ───────────────────────────────────────────────────────────────

interface CreateCollectionInput {
  name: string;
  slug: string;
}

// ── Query resolvers ───────────────────────────────────────────────────────────

const collections = (
  _parent: unknown,
  _args: unknown,
  ctx: Context
) =>
  ctx.prisma.collection.findMany({
    orderBy: { createdAt: "asc" },
  });

const collection = (
  _parent: unknown,
  args: { id: string },
  ctx: Context
) =>
  // findUnique returns null when not found — correct per the schema (Collection nullable)
  ctx.prisma.collection.findUnique({
    where: { id: args.id },
  });

// ── Mutation resolvers ────────────────────────────────────────────────────────

const createCollection = async (
  _parent: unknown,
  args: { input: CreateCollectionInput },
  ctx: Context
) => {
  const { name, slug } = args.input;

  validateNonEmpty(name, "name");
  validateSlug(slug);

  try {
    return await ctx.prisma.collection.create({
      data: { name: name.trim(), slug: slug.trim() },
    });
  } catch (err) {
    handleUniqueConstraint(
      err,
      `A collection with slug "${slug}" already exists.`
    );
  }
};

// ── Field resolvers ───────────────────────────────────────────────────────────

const collectionDocuments = (
  parent: { id: string },
  _args: unknown,
  ctx: Context
) =>
  ctx.prisma.document.findMany({
    where: { collectionId: parent.id },
    orderBy: { createdAt: "asc" },
  });

// ── Export ────────────────────────────────────────────────────────────────────

export const collectionResolver = {
  Query: {
    collections,
    collection,
  },
  Mutation: {
    createCollection,
  },
  Collection: {
    documents: collectionDocuments,
  },
};

// Narrow assertion — confirms collection exists before a document operation.
export async function assertCollectionExists(
  ctx: Context,
  collectionId: string
): Promise<void> {
  const found = await ctx.prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true },
  });
  if (found === null) {
    throw new GraphQLError(
      `Collection with id "${collectionId}" does not exist.`,
      { extensions: { code: "NOT_FOUND", field: "collectionId" } }
    );
  }
}
