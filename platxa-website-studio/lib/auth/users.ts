/**
 * Simple in-memory user store for development.
 * In production, replace with database (Prisma, Drizzle, etc.)
 */

import { isE2ETestMode, E2E_TEST_USER } from "./env";
import { hashCredential } from "./password";

export interface User {
  id: string;
  email: string;
  name: string;
  hashedPassword: string;
  createdAt: Date;
}

// In-memory store (replace with database in production)
const users: Map<string, User> = new Map();

// Track if test user has been seeded
let testUserSeeded = false;

/**
 * Seed the E2E test user if in test mode
 * This ensures tests can authenticate without going through signup
 */
async function seedTestUserIfNeeded(): Promise<void> {
  if (!isE2ETestMode() || testUserSeeded) {
    return;
  }

  const existingUser = users.get(E2E_TEST_USER.email.toLowerCase());
  if (!existingUser) {
    const hashedPassword = await hashCredential(E2E_TEST_USER.password);
    const testUser: User = {
      id: "e2e-test-user-001",
      email: E2E_TEST_USER.email.toLowerCase(),
      name: E2E_TEST_USER.name,
      hashedPassword,
      createdAt: new Date(),
    };
    users.set(testUser.email, testUser);
    console.log("[E2E] Test user seeded:", E2E_TEST_USER.email);
  }
  testUserSeeded = true;
}

// Seed test user on module load if in test mode
if (isE2ETestMode()) {
  seedTestUserIfNeeded().catch(console.error);
}

export function getUserByEmail(email: string): User | undefined {
  return users.get(email.toLowerCase());
}

export function getUserById(id: string): User | undefined {
  for (const user of users.values()) {
    if (user.id === id) {
      return user;
    }
  }
  return undefined;
}

export function createUser(data: {
  email: string;
  name: string;
  hashedPassword: string;
}): User {
  const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const user: User = {
    id,
    email: data.email.toLowerCase(),
    name: data.name,
    hashedPassword: data.hashedPassword,
    createdAt: new Date(),
  };
  users.set(user.email, user);
  return user;
}

export function getAllUsers(): User[] {
  return Array.from(users.values());
}
