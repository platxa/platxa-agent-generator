/**
 * GitHub OAuth API - Initiate OAuth flow
 *
 * GET /api/github/oauth - Get OAuth authorization URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import crypto from 'crypto';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/github/callback`;

// Required scopes for repository access
const REQUIRED_SCOPES = [
  'repo',           // Full control of private repositories
  'read:user',      // Read user profile
  'user:email',     // Access user email
  'write:repo_hook', // Create/manage webhooks
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!GITHUB_CLIENT_ID) {
      return NextResponse.json(
        { error: 'GitHub OAuth not configured' },
        { status: 500 }
      );
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in cookie for verification
    const stateData = {
      value: state,
      userId: session.user.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    };

    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI);
    authUrl.searchParams.set('scope', REQUIRED_SCOPES.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('allow_signup', 'false');

    const response = NextResponse.json({
      authUrl: authUrl.toString(),
      state,
    });

    // Set state cookie for verification in callback
    response.cookies.set('github_oauth_state', JSON.stringify(stateData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
}
