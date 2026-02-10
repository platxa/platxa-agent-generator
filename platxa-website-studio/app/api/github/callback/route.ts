/**
 * GitHub OAuth Callback - Handle OAuth response
 *
 * GET /api/github/callback - Process OAuth callback from GitHub
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encryptToken } from '@/lib/auth/crypto';
import {
  exchangeCodeForToken,
  fetchGitHubUser,
  fetchGitHubEmail,
} from '@/lib/github/oauth-helpers';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      const errorDesc = searchParams.get('error_description') || error;
      return NextResponse.redirect(
        new URL(`/?github_error=${encodeURIComponent(errorDesc)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/?github_error=Missing+authorization+code', request.url)
      );
    }

    // Verify state from cookie
    const stateCookie = request.cookies.get('github_oauth_state');
    if (!stateCookie?.value) {
      return NextResponse.redirect(
        new URL('/?github_error=Invalid+state', request.url)
      );
    }

    const stateData = JSON.parse(stateCookie.value);
    if (stateData.value !== state || stateData.userId !== session.user.id) {
      return NextResponse.redirect(
        new URL('/?github_error=State+mismatch', request.url)
      );
    }

    if (Date.now() > stateData.expiresAt) {
      return NextResponse.redirect(
        new URL('/?github_error=State+expired', request.url)
      );
    }

    // Exchange code for access token
    const redirectUri = process.env.GITHUB_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/github/callback`;
    const tokenResult = await exchangeCodeForToken(code, redirectUri);

    if (!tokenResult.success || !tokenResult.accessToken) {
      return NextResponse.redirect(
        new URL(`/?github_error=${encodeURIComponent(tokenResult.error || 'Token exchange failed')}`, request.url)
      );
    }

    // Encrypt the access token before storage
    const encryptedAccessToken = encryptToken(tokenResult.accessToken);

    // Get GitHub user info
    const userData = await fetchGitHubUser(tokenResult.accessToken);

    if (!userData) {
      return NextResponse.redirect(
        new URL('/?github_error=Failed+to+fetch+user+info', request.url)
      );
    }

    // Get primary email if not public
    let email = userData.email;
    if (!email) {
      email = await fetchGitHubEmail(tokenResult.accessToken);
    }

    // Upsert GitHub connection with encrypted token
    await db.gitHubConnection.upsert({
      where: { userId: session.user.id },
      update: {
        accessToken: encryptedAccessToken,
        tokenType: tokenResult.tokenType || 'bearer',
        scope: tokenResult.scope || '',
        githubId: userData.id,
        githubLogin: userData.login,
        githubEmail: email,
        githubAvatar: userData.avatarUrl,
        obtainedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        accessToken: encryptedAccessToken,
        tokenType: tokenResult.tokenType || 'bearer',
        scope: tokenResult.scope || '',
        githubId: userData.id,
        githubLogin: userData.login,
        githubEmail: email,
        githubAvatar: userData.avatarUrl,
      },
    });

    // Clear state cookie and redirect with success
    const response = NextResponse.redirect(new URL('/?github_connected=true', request.url));
    response.cookies.delete('github_oauth_state');

    return response;
  } catch (error) {
    console.error('GitHub callback error:', error);
    return NextResponse.redirect(
      new URL('/?github_error=Connection+failed', request.url)
    );
  }
}
