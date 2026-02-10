/**
 * User Service - Database-backed user management
 */

import { db } from "@/lib/db";
import { hashCredential, verifyCredential } from "@/lib/auth/password";
import type { User, UserRole } from "@prisma/client";
import { getOrCreateCreditAccount } from "@/lib/services/credit-service";

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

export interface UpdateUserInput {
  name?: string;
  avatar?: string;
  role?: UserRole;
}

/**
 * Create a new user with hashed password and initialize credit account
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const hashedValue = await hashCredential(input.password);

  const user = await db.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      password: hashedValue,
      name: input.name?.trim(),
    },
  });

  // Initialize credit account with signup bonus
  try {
    await getOrCreateCreditAccount(user.id);
  } catch (error) {
    console.error('Failed to create credit account for user:', error);
    // Don't fail user creation if credit account fails
  }

  return user;
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  return db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  return db.user.findUnique({
    where: { id },
  });
}

/**
 * Verify user credentials
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<User | null> {
  const user = await findUserByEmail(email);

  if (!user) {
    return null;
  }

  const isValid = await verifyCredential(password, user.password);

  if (!isValid) {
    return null;
  }

  return user;
}

/**
 * Update user profile
 */
export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<User> {
  return db.user.update({
    where: { id },
    data: input,
  });
}

/**
 * Update user password
 */
export async function updateUserCredential(
  id: string,
  newCredential: string
): Promise<User> {
  const hashedValue = await hashCredential(newCredential);

  return db.user.update({
    where: { id },
    data: { password: hashedValue },
  });
}

/**
 * Delete user and all related data
 */
export async function deleteUser(id: string): Promise<void> {
  await db.user.delete({
    where: { id },
  });
}

/**
 * Mark email as verified
 */
export async function markEmailVerified(id: string): Promise<User> {
  return db.user.update({
    where: { id },
    data: { emailVerified: new Date() },
  });
}

/**
 * Get user with projects
 */
export async function getUserWithProjects(id: string) {
  return db.user.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}
