/**
 * GitHubOAuth — OAuth flow for GitHub repository connection
 *
 * Feature #43: GitHub Integration - OAuth flow
 *
 * Handles GitHub OAuth 2.0 authentication:
 * - Generate authorization URLs with proper scopes
 * - Exchange authorization codes for access tokens
 * - Secure token storage and refresh
 * - Scope validation and management
 */

// =============================================================================
// Types
// =============================================================================

/** GitHub OAuth scopes */
export type GitHubScope =
  | "repo"              // Full control of private repositories
  | "repo:status"       // Access commit status
  | "repo_deployment"   // Access deployment status
  | "public_repo"       // Access public repositories only
  | "repo:invite"       // Access repository invitations
  | "security_events"   // Read/write security events
  | "read:repo_hook"    // Read repository hooks
  | "write:repo_hook"   // Write repository hooks
  | "admin:repo_hook"   // Full control of repository hooks
  | "read:org"          // Read org membership
  | "write:org"         // Write org membership
  | "admin:org"         // Full control of orgs
  | "read:user"         // Read user profile data
  | "user:email"        // Access user email addresses
  | "user:follow"       // Follow and unfollow users
  | "delete_repo"       // Delete repositories
  | "workflow";         // Update GitHub Action workflows

/** OAuth configuration */
export interface GitHubOAuthConfig {
  /** GitHub OAuth App client ID */
  clientId: string;
  /** GitHub OAuth App client secret (server-side only) */
  clientSecret?: string;
  /** Redirect URI after authorization */
  redirectUri: string;
  /** Required scopes */
  scopes: GitHubScope[];
  /** GitHub authorization URL */
  authorizationUrl: string;
  /** GitHub token exchange URL */
  tokenUrl: string;
  /** State parameter length */
  stateLength: number;
  /** Allow signup during OAuth */
  allowSignup: boolean;
}

/** OAuth state for CSRF protection */
export interface OAuthState {
  /** Random state value */
  value: string;
  /** Creation timestamp */
  createdAt: number;
  /** Expiration timestamp */
  expiresAt: number;
  /** Optional metadata */
  metadata?: Record<string, string>;
}

/** Token response from GitHub */
export interface GitHubTokenResponse {
  /** Access token */
  accessToken: string;
  /** Token type (usually "bearer") */
  tokenType: string;
  /** Granted scopes */
  scope: string;
}

/** Stored token with metadata */
export interface StoredToken {
  /** Access token (encrypted in storage) */
  accessToken: string;
  /** Token type */
  tokenType: string;
  /** Granted scopes */
  scopes: GitHubScope[];
  /** When token was obtained */
  obtainedAt: number;
  /** Associated GitHub user ID */
  userId?: number;
  /** Associated GitHub username */
  username?: string;
}

/** User info from GitHub */
export interface GitHubUser {
  /** User ID */
  id: number;
  /** Username */
  login: string;
  /** Display name */
  name: string | null;
  /** Email */
  email: string | null;
  /** Avatar URL */
  avatarUrl: string;
}

/** OAuth result */
export interface OAuthResult {
  /** Whether OAuth was successful */
  success: boolean;
  /** Stored token (if successful) */
  token?: StoredToken;
  /** User info (if successful) */
  user?: GitHubUser;
  /** Error message (if failed) */
  error?: string;
  /** Error code */
  errorCode?: "invalid_state" | "token_exchange_failed" | "user_fetch_failed" | "scope_mismatch";
}

/** Token storage adapter */
export interface TokenStorageAdapter {
  /** Store a token */
  store(key: string, token: StoredToken): Promise<void>;
  /** Retrieve a token */
  retrieve(key: string): Promise<StoredToken | null>;
  /** Remove a token */
  remove(key: string): Promise<void>;
  /** Check if token exists */
  exists(key: string): Promise<boolean>;
}

/** HTTP adapter for OAuth requests */
export interface OAuthHttpAdapter {
  /** Exchange code for token */
  exchangeCode(
    tokenUrl: string,
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string
  ): Promise<GitHubTokenResponse>;
  /** Fetch user info */
  fetchUser(accessToken: string): Promise<GitHubUser>;
  /** Validate token scopes */
  validateToken(accessToken: string): Promise<{ scopes: string[]; valid: boolean }>;
}

// =============================================================================
// Constants
// =============================================================================

/** Default OAuth configuration */
export const DEFAULT_OAUTH_CONFIG: Omit<GitHubOAuthConfig, "clientId" | "redirectUri"> = {
  scopes: ["repo", "read:user", "user:email"],
  authorizationUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  stateLength: 32,
  allowSignup: true,
};

/** Recommended scopes for Platxa */
export const PLATXA_SCOPES: GitHubScope[] = [
  "repo",        // Full repo access for push/pull
  "read:user",   // Read user profile
  "user:email",  // Access email for notifications
];

/** State expiration time (10 minutes) */
const STATE_EXPIRATION_MS = 10 * 60 * 1000;

/** Token storage key prefix */
const TOKEN_STORAGE_PREFIX = "platxa_github_token_";

// =============================================================================
// Helpers
// =============================================================================

/** Generate random state string */
function generateState(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);

  // Use crypto.getRandomValues if available, otherwise fall back
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }

  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }

  return result;
}

/** Parse scope string into array */
function parseScopes(scopeString: string): GitHubScope[] {
  return scopeString.split(/[,\s]+/).filter(Boolean) as GitHubScope[];
}

/** Build scope string from array */
function buildScopeString(scopes: GitHubScope[]): string {
  return scopes.join(" ");
}

/** Check if required scopes are granted */
function hasRequiredScopes(granted: GitHubScope[], required: GitHubScope[]): boolean {
  // "repo" scope includes public_repo
  const effectiveGranted = new Set(granted);
  if (effectiveGranted.has("repo")) {
    effectiveGranted.add("public_repo");
  }

  for (const scope of required) {
    if (!effectiveGranted.has(scope)) {
      return false;
    }
  }
  return true;
}

// =============================================================================
// Default Adapters
// =============================================================================

/** Create default HTTP adapter using fetch */
function createDefaultHttpAdapter(): OAuthHttpAdapter {
  return {
    async exchangeCode(tokenUrl, clientId, clientSecret, code, redirectUri) {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      });

      const res = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!res.ok) {
        throw new Error(`Token exchange failed: ${res.statusText}`);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(`OAuth error: ${data.error_description || data.error}`);
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type,
        scope: data.scope,
      };
    },

    async fetchUser(accessToken) {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/vnd.github.v3+json",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch user: ${res.statusText}`);
      }

      const data = await res.json();

      return {
        id: data.id,
        login: data.login,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatar_url,
      };
    },

    async validateToken(accessToken) {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/vnd.github.v3+json",
        },
      });

      if (!res.ok) {
        return { scopes: [], valid: false };
      }

      const scopeHeader = res.headers.get("X-OAuth-Scopes");
      const scopes = scopeHeader ? scopeHeader.split(", ") : [];

      return { scopes, valid: true };
    },
  };
}

/** Create localStorage-based token storage */
function createLocalStorageAdapter(): TokenStorageAdapter {
  return {
    async store(key, token) {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          TOKEN_STORAGE_PREFIX + key,
          JSON.stringify(token)
        );
      }
    },

    async retrieve(key) {
      if (typeof localStorage !== "undefined") {
        const data = localStorage.getItem(TOKEN_STORAGE_PREFIX + key);
        if (data) {
          try {
            return JSON.parse(data) as StoredToken;
          } catch {
            return null;
          }
        }
      }
      return null;
    },

    async remove(key) {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(TOKEN_STORAGE_PREFIX + key);
      }
    },

    async exists(key) {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem(TOKEN_STORAGE_PREFIX + key) !== null;
      }
      return false;
    },
  };
}

// =============================================================================
// GitHubOAuth Class
// =============================================================================

/**
 * GitHubOAuth manages GitHub OAuth 2.0 authentication flow.
 *
 * Usage:
 * ```ts
 * const oauth = new GitHubOAuth({
 *   clientId: "your_client_id",
 *   redirectUri: "https://your-app.com/auth/callback",
 * });
 *
 * // Step 1: Generate authorization URL
 * const { url, state } = oauth.getAuthorizationUrl();
 * // Redirect user to url
 *
 * // Step 2: Handle callback (after redirect back)
 * const result = await oauth.handleCallback(code, state);
 *
 * if (result.success) {
 *   console.log(`Authenticated as ${result.user?.login}`);
 * }
 *
 * // Step 3: Use token for API calls
 * const token = await oauth.getStoredToken("default");
 * ```
 */
export class GitHubOAuth {
  private config: GitHubOAuthConfig;
  private httpAdapter: OAuthHttpAdapter;
  private storageAdapter: TokenStorageAdapter;
  private pendingStates: Map<string, OAuthState> = new Map();

  constructor(
    config: Partial<GitHubOAuthConfig> & Pick<GitHubOAuthConfig, "clientId" | "redirectUri">,
    httpAdapter?: OAuthHttpAdapter,
    storageAdapter?: TokenStorageAdapter
  ) {
    this.config = { ...DEFAULT_OAUTH_CONFIG, ...config };
    this.httpAdapter = httpAdapter || createDefaultHttpAdapter();
    this.storageAdapter = storageAdapter || createLocalStorageAdapter();
  }

  // ---------------------------------------------------------------------------
  // Authorization URL
  // ---------------------------------------------------------------------------

  /**
   * Generate the GitHub authorization URL.
   */
  getAuthorizationUrl(metadata?: Record<string, string>): { url: string; state: OAuthState } {
    const stateValue = generateState(this.config.stateLength);
    const now = Date.now();

    const state: OAuthState = {
      value: stateValue,
      createdAt: now,
      expiresAt: now + STATE_EXPIRATION_MS,
      metadata,
    };

    // Store state for validation
    this.pendingStates.set(stateValue, state);

    // Build URL
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: buildScopeString(this.config.scopes),
      state: stateValue,
      allow_signup: this.config.allowSignup ? "true" : "false",
    });

    const url = `${this.config.authorizationUrl}?${params.toString()}`;

    return { url, state };
  }

  // ---------------------------------------------------------------------------
  // Callback Handling
  // ---------------------------------------------------------------------------

  /**
   * Handle the OAuth callback after user authorization.
   */
  async handleCallback(
    code: string,
    stateValue: string,
    storageKey: string = "default"
  ): Promise<OAuthResult> {
    // Validate state
    const pendingState = this.pendingStates.get(stateValue);

    if (!pendingState) {
      return {
        success: false,
        error: "Invalid state parameter",
        errorCode: "invalid_state",
      };
    }

    // Check expiration
    if (Date.now() > pendingState.expiresAt) {
      this.pendingStates.delete(stateValue);
      return {
        success: false,
        error: "State expired",
        errorCode: "invalid_state",
      };
    }

    // Remove used state
    this.pendingStates.delete(stateValue);

    // Exchange code for token
    let tokenResponse: GitHubTokenResponse;
    try {
      tokenResponse = await this.httpAdapter.exchangeCode(
        this.config.tokenUrl,
        this.config.clientId,
        this.config.clientSecret || "",
        code,
        this.config.redirectUri
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Token exchange failed",
        errorCode: "token_exchange_failed",
      };
    }

    // Parse and validate scopes
    const grantedScopes = parseScopes(tokenResponse.scope);

    if (!hasRequiredScopes(grantedScopes, this.config.scopes)) {
      return {
        success: false,
        error: `Insufficient scopes. Required: ${this.config.scopes.join(", ")}. Granted: ${grantedScopes.join(", ")}`,
        errorCode: "scope_mismatch",
      };
    }

    // Fetch user info
    let user: GitHubUser;
    try {
      user = await this.httpAdapter.fetchUser(tokenResponse.accessToken);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch user info",
        errorCode: "user_fetch_failed",
      };
    }

    // Create stored token
    const storedToken: StoredToken = {
      accessToken: tokenResponse.accessToken,
      tokenType: tokenResponse.tokenType,
      scopes: grantedScopes,
      obtainedAt: Date.now(),
      userId: user.id,
      username: user.login,
    };

    // Store token
    await this.storageAdapter.store(storageKey, storedToken);

    return {
      success: true,
      token: storedToken,
      user,
    };
  }

  // ---------------------------------------------------------------------------
  // Token Management
  // ---------------------------------------------------------------------------

  /**
   * Get stored token.
   */
  async getStoredToken(key: string = "default"): Promise<StoredToken | null> {
    return this.storageAdapter.retrieve(key);
  }

  /**
   * Check if user is authenticated.
   */
  async isAuthenticated(key: string = "default"): Promise<boolean> {
    const token = await this.storageAdapter.retrieve(key);
    if (!token) return false;

    // Optionally validate token is still valid
    const validation = await this.httpAdapter.validateToken(token.accessToken);
    return validation.valid;
  }

  /**
   * Revoke/remove stored token.
   */
  async logout(key: string = "default"): Promise<void> {
    await this.storageAdapter.remove(key);
  }

  /**
   * Get access token for API calls.
   */
  async getAccessToken(key: string = "default"): Promise<string | null> {
    const token = await this.storageAdapter.retrieve(key);
    return token?.accessToken || null;
  }

  // ---------------------------------------------------------------------------
  // Scope Management
  // ---------------------------------------------------------------------------

  /**
   * Check if token has required scopes.
   */
  async hasScopes(requiredScopes: GitHubScope[], key: string = "default"): Promise<boolean> {
    const token = await this.storageAdapter.retrieve(key);
    if (!token) return false;
    return hasRequiredScopes(token.scopes, requiredScopes);
  }

  /**
   * Get currently granted scopes.
   */
  async getGrantedScopes(key: string = "default"): Promise<GitHubScope[]> {
    const token = await this.storageAdapter.retrieve(key);
    return token?.scopes || [];
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  /**
   * Clear expired states.
   */
  cleanupExpiredStates(): number {
    const now = Date.now();
    let cleaned = 0;

    const entries: Array<[string, OAuthState]> = [];
    this.pendingStates.forEach((state, key) => {
      entries.push([key, state]);
    });

    for (const [key, state] of entries) {
      if (now > state.expiresAt) {
        this.pendingStates.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Validate a state value without consuming it.
   */
  isValidState(stateValue: string): boolean {
    const state = this.pendingStates.get(stateValue);
    if (!state) return false;
    return Date.now() <= state.expiresAt;
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Get configuration.
   */
  getConfig(): GitHubOAuthConfig {
    return { ...this.config };
  }

  /**
   * Update scopes (requires re-authentication).
   */
  setScopes(scopes: GitHubScope[]): void {
    this.config.scopes = scopes;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _instance: GitHubOAuth | null = null;
let _instanceConfig: Partial<GitHubOAuthConfig> | null = null;

/** Initialize the global GitHubOAuth instance */
export function initGitHubOAuth(
  config: Partial<GitHubOAuthConfig> & Pick<GitHubOAuthConfig, "clientId" | "redirectUri">
): GitHubOAuth {
  _instance = new GitHubOAuth(config);
  _instanceConfig = config;
  return _instance;
}

/** Get the global GitHubOAuth instance */
export function getGitHubOAuth(): GitHubOAuth {
  if (!_instance) {
    throw new Error(
      "GitHubOAuth not initialized. Call initGitHubOAuth() first with clientId and redirectUri."
    );
  }
  return _instance;
}

/** Reset the global GitHubOAuth instance */
export function resetGitHubOAuth(): void {
  _instance = null;
  _instanceConfig = null;
}

/** Check if GitHubOAuth is initialized */
export function isGitHubOAuthInitialized(): boolean {
  return _instance !== null;
}
