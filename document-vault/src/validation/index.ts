import { GraphQLError } from "graphql";

// ── Slug ──────────────────────────────────────────────────────────────────────

/** Allowed: lowercase letters, digits, hyphens. Must start/end with alnum. */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateSlug(slug: string): void {
  const trimmed = slug.trim();
  if (trimmed.length === 0) {
    throw new GraphQLError("Slug cannot be empty.", {
      extensions: { code: "BAD_USER_INPUT", field: "slug" },
    });
  }
  if (!SLUG_REGEX.test(trimmed)) {
    throw new GraphQLError(
      "Slug must contain only lowercase letters, numbers, and hyphens, " +
        "and must start and end with a letter or number.",
      { extensions: { code: "BAD_USER_INPUT", field: "slug" } }
    );
  }
}

// ── Non-empty strings ─────────────────────────────────────────────────────────

export function validateNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new GraphQLError(`${fieldName} cannot be empty or whitespace-only.`, {
      extensions: { code: "BAD_USER_INPUT", field: fieldName },
    });
  }
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export function validateTags(tags: string[]): void {
  for (const tag of tags) {
    if (tag.trim().length === 0) {
      throw new GraphQLError("Each tag must be a non-empty string.", {
        extensions: { code: "BAD_USER_INPUT", field: "tags" },
      });
    }
    if (tag.length > 50) {
      throw new GraphQLError(
        `Tag "${tag.slice(0, 20)}…" exceeds the 50-character limit.`,
        { extensions: { code: "BAD_USER_INPUT", field: "tags" } }
      );
    }
  }
}

// ── Prisma error helpers ───────────────────────────────────────────────────────

/**
 * Detect Prisma unique-constraint violations (P2002) and rethrow as a
 * meaningful GraphQL error. Any other error is re-thrown as-is.
 */
export function handleUniqueConstraint(
  err: unknown,
  message: string
): never {
  if (isPrismaError(err, "P2002")) {
    throw new GraphQLError(message, {
      extensions: { code: "CONFLICT" },
    });
  }
  throw err;
}

/**
 * Detect Prisma "record not found" errors (P2025) and rethrow as a
 * meaningful GraphQL error.
 */
export function handleNotFound(err: unknown, message: string): never {
  if (isPrismaError(err, "P2025")) {
    throw new GraphQLError(message, {
      extensions: { code: "NOT_FOUND" },
    });
  }
  throw err;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function isPrismaError(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === code
  );
}
