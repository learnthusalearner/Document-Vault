/**
 * Root resolver map.
 *
 * Individual resolver modules (query.ts, mutation.ts, etc.) will be
 * imported and merged here as the schema grows.
 */
export const resolvers = {
  Query: {
    health: () => "ok",
  },
} as const;
