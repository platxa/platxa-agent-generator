/**
 * Prisma Database Client Singleton (Prisma 7+)
 *
 * Uses PostgreSQL adapter for direct database connections.
 * Ensures a single database connection pool is reused across hot reloads in development.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

function createPrismaClient(): PrismaClient {
  // Create PostgreSQL connection pool
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn("[DB] DATABASE_URL not set, using mock client for development");
    // Return a client that will fail gracefully
    return new PrismaClient();
  }

  // Reuse existing pool in development
  const pool = globalThis.pgPool ?? new Pool({ connectionString });

  if (process.env.NODE_ENV !== "production") {
    globalThis.pgPool = pool;
  }

  // Create Prisma adapter
  const adapter = new PrismaPg(pool);

  // Create Prisma client with adapter
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development"
      ? ["warn", "error"]
      : ["error"],
  });
}

export const db = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = db;
}

export default db;

// Re-export types for convenience
export type {
  User,
  Project,
  ProjectFile,
  ProjectSnapshot,
  Deployment,
  Session,
  ApiKey,
  RateLimitEntry,
  UsageLog,
  UserRole,
  ProjectStatus,
  DeploymentStatus,
} from "@prisma/client";
