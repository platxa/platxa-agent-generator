/**
 * GitHub OAuth Helpers - Secure token exchange utilities
 */

interface TokenExchangeResult {
  success: boolean;
  accessToken?: string;
  tokenType?: string;
  scope?: string;
  error?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  avatarUrl: string;
  name: string | null;
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<TokenExchangeResult> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { success: false, error: 'GitHub OAuth not configured' };
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();

  if (data.error) {
    return {
      success: false,
      error: data.error_description || data.error,
    };
  }

  return {
    success: true,
    accessToken: data.access_token,
    tokenType: data.token_type,
    scope: data.scope,
  };
}

/**
 * Fetch GitHub user profile
 */
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser | null> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  return {
    id: data.id,
    login: data.login,
    email: data.email,
    avatarUrl: data.avatar_url,
    name: data.name,
  };
}

/**
 * Fetch user's primary email from GitHub
 */
export async function fetchGitHubEmail(accessToken: string): Promise<string | null> {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const emails = await response.json();
  const primary = emails.find((e: { primary: boolean }) => e.primary);
  return primary?.email || emails[0]?.email || null;
}
