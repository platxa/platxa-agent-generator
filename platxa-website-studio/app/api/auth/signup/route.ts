/**
 * Signup API Route
 *
 * Creates new user accounts with proper validation and error handling.
 */

import { NextRequest, NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/services/user-service";
import { z } from "zod";

// Validation schema
const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(1, "Name is required").max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = signupSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password, name } = result.data;

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Create user
    const user = await createUser({
      email,
      password,
      name,
    });

    // Return success (don't expose password hash)
    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Signup] Error:", error);

    // Handle Prisma errors
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint")) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }
}
