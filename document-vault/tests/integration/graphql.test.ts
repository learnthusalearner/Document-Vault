import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { yoga } from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";

// ── GraphQL Client Helper ──────────────────────────────────────────────────────
// Executes requests against GraphQL Yoga's native HTTP fetch handler.
// This tests the full pipeline: HTTP parsing -> Yoga -> Resolvers -> Prisma -> PostgreSQL.
async function gql<TData = Record<string, any>>(
  query: string,
  variables?: Record<string, any>
): Promise<{ data: TData; errors?: Array<{ message: string }> }> {
  const response = await yoga.fetch("http://localhost:4000/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  return (await response.json()) as {
    data: TData;
    errors?: Array<{ message: string }>;
  };
}

describe("GraphQL API Integration Test (PostgreSQL)", () => {
  const timestamp = Date.now();
  let collection1Id: string;
  let collection2Id: string;
  let doc1Id: string;
  let doc2Id: string;
  let doc3Id: string;
  let doc4Id: string;

  beforeAll(async () => {
    // Ensure clean state before test execution
    await prisma.document.deleteMany({});
    await prisma.collection.deleteMany({});
  });

  afterAll(async () => {
    // Clean up all created test records and close Prisma pool
    await prisma.document.deleteMany({});
    await prisma.collection.deleteMany({});
    await prisma.$disconnect();
  });

  it("1. Creates a collection through GraphQL", async () => {
    const query = `
      mutation CreateCol($input: CreateCollectionInput!) {
        createCollection(input: $input) {
          id
          name
          slug
          createdAt
        }
      }
    `;

    const res = await gql<{ createCollection: { id: string; name: string; slug: string; createdAt: string } }>(
      query,
      { input: { name: "Engineering Specs", slug: `eng-specs-${timestamp}` } }
    );

    expect(res.errors).toBeUndefined();
    expect(res.data.createCollection.id).toBeDefined();
    expect(res.data.createCollection.name).toBe("Engineering Specs");
    expect(res.data.createCollection.slug).toBe(`eng-specs-${timestamp}`);
    expect(res.data.createCollection.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    collection1Id = res.data.createCollection.id;
  });

  it("2. Creates multiple documents through GraphQL", async () => {
    const createQuery = `
      mutation CreateDoc($input: CreateDocumentInput!) {
        createDocument(input: $input) {
          id
          title
          content
          tags
          collectionId
          isArchived
          createdAt
        }
      }
    `;

    // Doc 1
    const res1 = await gql<{ createDocument: { id: string; title: string } }>(createQuery, {
      input: {
        title: "Architecture Blueprint",
        content: "Microservices design and database schema guidelines.",
        tags: ["architecture", "postgres"],
        collectionId: collection1Id,
      },
    });
    expect(res1.errors).toBeUndefined();
    doc1Id = res1.data.createDocument.id;

    // Doc 2
    const res2 = await gql<{ createDocument: { id: string; title: string } }>(createQuery, {
      input: {
        title: "API Reference Guide",
        content: "GraphQL Yoga specification and endpoint details.",
        tags: ["api", "graphql"],
        collectionId: collection1Id,
      },
    });
    expect(res2.errors).toBeUndefined();
    doc2Id = res2.data.createDocument.id;
    expect(doc2Id).toBeDefined();

    // Doc 3
    const res3 = await gql<{ createDocument: { id: string; title: string } }>(createQuery, {
      input: {
        title: "Deployment Playbook",
        content: "Docker Compose infrastructure setup for production.",
        tags: ["devops", "docker"],
        collectionId: collection1Id,
      },
    });
    expect(res3.errors).toBeUndefined();
    doc3Id = res3.data.createDocument.id;
    expect(doc3Id).toBeDefined();

    // Doc 4 (and mark as archived)
    const res4 = await gql<{ createDocument: { id: string; title: string } }>(createQuery, {
      input: {
        title: "Legacy System Manual",
        content: "Monolith system overview and migration notes.",
        tags: ["legacy"],
        collectionId: collection1Id,
      },
    });
    expect(res4.errors).toBeUndefined();
    doc4Id = res4.data.createDocument.id;

    // Archive doc 4 via GraphQL mutation
    const archiveQuery = `
      mutation ArchiveDoc($id: ID!, $input: UpdateDocumentInput!) {
        updateDocument(id: $id, input: $input) {
          id
          isArchived
        }
      }
    `;
    const archiveRes = await gql<{ updateDocument: { id: string; isArchived: boolean } }>(archiveQuery, {
      id: doc4Id,
      input: { isArchived: true },
    });
    expect(archiveRes.errors).toBeUndefined();
    expect(archiveRes.data.updateDocument.isArchived).toBe(true);
  });

  it("3. Queries documents through GraphQL", async () => {
    const query = `
      query GetDocs($collectionId: ID) {
        documents(collectionId: $collectionId) {
          documents {
            id
            title
            collectionId
          }
          hasMore
          nextCursor
        }
      }
    `;

    const res = await gql<{ documents: { documents: Array<{ id: string; collectionId: string }>; hasMore: boolean } }>(
      query,
      { collectionId: collection1Id }
    );

    expect(res.errors).toBeUndefined();
    expect(res.data.documents.documents).toHaveLength(4);
  });

  it("4. Verifies substring search", async () => {
    const query = `
      query SearchDocs($collectionId: ID, $search: String) {
        documents(collectionId: $collectionId, search: $search) {
          documents {
            id
            title
            content
          }
        }
      }
    `;

    // Search by title substring
    const titleMatch = await gql<{ documents: { documents: Array<{ id: string; title: string }> } }>(query, {
      collectionId: collection1Id,
      search: "Blueprint",
    });
    expect(titleMatch.errors).toBeUndefined();
    expect(titleMatch.data.documents.documents).toHaveLength(1);
    expect(titleMatch.data.documents.documents[0]?.title).toBe("Architecture Blueprint");

    // Search by content substring
    const contentMatch = await gql<{ documents: { documents: Array<{ id: string; title: string }> } }>(query, {
      collectionId: collection1Id,
      search: "infrastructure",
    });
    expect(contentMatch.errors).toBeUndefined();
    expect(contentMatch.data.documents.documents).toHaveLength(1);
    expect(contentMatch.data.documents.documents[0]?.title).toBe("Deployment Playbook");
  });

  it("5. Verifies archived filtering", async () => {
    const query = `
      query FilterArchived($collectionId: ID, $isArchived: Boolean) {
        documents(collectionId: $collectionId, isArchived: $isArchived) {
          documents {
            id
            title
            isArchived
          }
        }
      }
    `;

    // Non-archived docs
    const activeRes = await gql<{ documents: { documents: Array<{ id: string; isArchived: boolean }> } }>(query, {
      collectionId: collection1Id,
      isArchived: false,
    });
    expect(activeRes.errors).toBeUndefined();
    expect(activeRes.data.documents.documents).toHaveLength(3);
    expect(activeRes.data.documents.documents.every((d) => d.isArchived === false)).toBe(true);

    // Archived docs
    const archivedRes = await gql<{ documents: { documents: Array<{ id: string; title: string; isArchived: boolean }> } }>(query, {
      collectionId: collection1Id,
      isArchived: true,
    });
    expect(archivedRes.errors).toBeUndefined();
    expect(archivedRes.data.documents.documents).toHaveLength(1);
    expect(archivedRes.data.documents.documents[0]?.id).toBe(doc4Id);
    expect(archivedRes.data.documents.documents[0]?.isArchived).toBe(true);
  });

  it("6. Verifies collection filtering", async () => {
    const query = `
      query GetCollectionDocs($collectionId: ID) {
        documents(collectionId: $collectionId) {
          documents {
            id
            collectionId
          }
        }
      }
    `;

    const res = await gql<{ documents: { documents: Array<{ id: string; collectionId: string }> } }>(query, {
      collectionId: collection1Id,
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.documents.documents.every((d) => d.collectionId === collection1Id)).toBe(true);
  });

  it("7. Tests cursor pagination", async () => {
    const query = `
      query PageDocs($collectionId: ID, $take: Int, $cursor: String) {
        documents(collectionId: $collectionId, take: $take, cursor: $cursor) {
          documents {
            id
            title
          }
          nextCursor
          hasMore
        }
      }
    `;

    // Fetch page 1 (take 2)
    const page1 = await gql<{
      documents: {
        documents: Array<{ id: string }>;
        nextCursor: string | null;
        hasMore: boolean;
      };
    }>(query, { collectionId: collection1Id, take: 2 });

    expect(page1.errors).toBeUndefined();
    expect(page1.data.documents.documents).toHaveLength(2);
    expect(page1.data.documents.hasMore).toBe(true);
    expect(page1.data.documents.nextCursor).toBeTruthy();

    const cursor = page1.data.documents.nextCursor;

    // Fetch page 2 using cursor
    const page2 = await gql<{
      documents: {
        documents: Array<{ id: string }>;
        nextCursor: string | null;
        hasMore: boolean;
      };
    }>(query, { collectionId: collection1Id, take: 2, cursor });

    expect(page2.errors).toBeUndefined();
    expect(page2.data.documents.documents).toHaveLength(2);
    expect(page2.data.documents.hasMore).toBe(false);
    expect(page2.data.documents.nextCursor).toBeNull();

    // Verify page 1 and page 2 have unique document IDs
    const page1Ids = page1.data.documents.documents.map((d) => d.id);
    const page2Ids = page2.data.documents.documents.map((d) => d.id);
    expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
  });

  it("8. Creates another collection", async () => {
    const query = `
      mutation CreateCol2($input: CreateCollectionInput!) {
        createCollection(input: $input) {
          id
          name
          slug
        }
      }
    `;

    const res = await gql<{ createCollection: { id: string; name: string } }>(query, {
      input: { name: "Archived Vault", slug: `archived-vault-${timestamp}` },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.createCollection.id).toBeDefined();
    collection2Id = res.data.createCollection.id;
  });

  it("9. Moves a document to the second collection", async () => {
    const query = `
      mutation MoveDoc($id: ID!, $input: MoveDocumentInput!) {
        moveDocument(id: $id, input: $input) {
          id
          collectionId
          collection {
            id
            name
          }
        }
      }
    `;

    const res = await gql<{
      moveDocument: { id: string; collectionId: string; collection: { id: string; name: string } };
    }>(query, {
      id: doc1Id,
      input: { collectionId: collection2Id },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.moveDocument.id).toBe(doc1Id);
    expect(res.data.moveDocument.collectionId).toBe(collection2Id);
    expect(res.data.moveDocument.collection.id).toBe(collection2Id);
    expect(res.data.moveDocument.collection.name).toBe("Archived Vault");
  });

  it("10 & 11. Queries the second collection and verifies the moved document appears there", async () => {
    const colQuery = `
      query GetCol2($id: ID!) {
        collection(id: $id) {
          id
          name
          documents {
            id
            title
            collectionId
          }
        }
      }
    `;

    const colRes = await gql<{
      collection: {
        id: string;
        name: string;
        documents: Array<{ id: string; title: string; collectionId: string }>;
      };
    }>(colQuery, { id: collection2Id });

    expect(colRes.errors).toBeUndefined();
    expect(colRes.data.collection).not.toBeNull();
    expect(colRes.data.collection.id).toBe(collection2Id);
    expect(colRes.data.collection.documents).toHaveLength(1);
    expect(colRes.data.collection.documents[0]?.id).toBe(doc1Id);
    expect(colRes.data.collection.documents[0]?.title).toBe("Architecture Blueprint");

    // Also query documents by collectionId=collection2Id
    const docsQuery = `
      query GetCol2Docs($collectionId: ID) {
        documents(collectionId: $collectionId) {
          documents {
            id
            collectionId
          }
        }
      }
    `;

    const docsRes = await gql<{ documents: { documents: Array<{ id: string; collectionId: string }> } }>(
      docsQuery,
      { collectionId: collection2Id }
    );

    expect(docsRes.errors).toBeUndefined();
    expect(docsRes.data.documents.documents).toHaveLength(1);
    expect(docsRes.data.documents.documents[0]?.id).toBe(doc1Id);
  });
});
