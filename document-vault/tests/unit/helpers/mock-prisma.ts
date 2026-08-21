/**
 * Typed Prisma mock factory.
 *
 * Provides typed mocks for Prisma Client delegates using Bun's test runner mock function.
 */

import { mock, type Mock } from "bun:test";
import type { Collection, Document } from "@prisma/client";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface MockCollectionDelegate {
  findMany: Mock<(args?: any) => Promise<Collection[]>>;
  findUnique: Mock<(args?: any) => Promise<Collection | null>>;
  create: Mock<(args?: any) => Promise<Collection>>;
}

export interface MockDocumentDelegate {
  findMany: Mock<(args?: any) => Promise<Document[]>>;
  findUnique: Mock<(args?: any) => Promise<Document | null>>;
  create: Mock<(args?: any) => Promise<Document>>;
  update: Mock<(args?: any) => Promise<Document>>;
  delete: Mock<(args?: any) => Promise<Document>>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface MockPrisma {
  collection: MockCollectionDelegate;
  document: MockDocumentDelegate;
}

export function makeMockPrisma(): MockPrisma {
  return {
    collection: {
      findMany: mock(() => Promise.resolve([])),
      findUnique: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({} as Collection)),
    },
    document: {
      findMany: mock(() => Promise.resolve([])),
      findUnique: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({} as Document)),
      update: mock(() => Promise.resolve({} as Document)),
      delete: mock(() => Promise.resolve({} as Document)),
    },
  };
}

// ── Fixture builders ──────────────────────────────────────────────────────────

export function makeCollection(
  overrides: Partial<Collection> = {}
): Collection {
  return {
    id: "col-1",
    name: "Guides",
    slug: "guides",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeDocument(
  overrides: Partial<Document> = {}
): Document {
  return {
    id: "doc-1",
    title: "Getting Started",
    content: "Step by step setup.",
    tags: ["intro"],
    collectionId: "col-1",
    isArchived: false,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ── Prisma error simulators ───────────────────────────────────────────────────

export function prismaUniqueError(): Error & { code: string } {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
  });
}

export function prismaNotFoundError(): Error & { code: string } {
  return Object.assign(new Error("Record not found"), { code: "P2025" });
}
