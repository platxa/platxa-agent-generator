/**
 * Password utilities for secure credential handling
 * Uses bcrypt for hashing and comparison
 */
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Securely hash a credential for storage
 */
export async function hashCredential(input: string): Promise<string> {
  return bcrypt.hash(input, SALT_ROUNDS);
}

/**
 * Securely compare a plaintext input against a stored hash
 */
export async function verifyCredential(input: string, storedHash: string): Promise<boolean> {
  return bcrypt.compare(input, storedHash);
}
