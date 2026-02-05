/**
 * OdooServerConnector
 *
 * Connects to remote Odoo instances via URL and API key.
 * Provides secure authentication and connection verification.
 *
 * Features:
 * - Connect via URL + API key or username/password
 * - Connection verification and health checks
 * - Session management
 * - Model access and CRUD operations
 * - Website-specific queries
 * - Secure credential handling
 *
 * Feature #83: Deployment - OdooServerConnector
 */

// =============================================================================
// Types
// =============================================================================

/** Authentication method */
export type AuthMethod = "api_key" | "password";

/** Connection status */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/** Odoo server info */
export interface OdooServerInfo {
  version: string;
  versionInfo: number[];
  serverSerie: string;
  protocol: number;
}

/** User info from Odoo */
export interface OdooUserInfo {
  uid: number;
  name: string;
  username: string;
  email?: string;
  companyId: number;
  companyName: string;
  partnerId: number;
  isAdmin: boolean;
  groups: string[];
}

/** Database info */
export interface OdooDatabaseInfo {
  name: string;
  exists: boolean;
  websiteCount?: number;
  moduleCount?: number;
}

/** Connection configuration */
export interface OdooConnectionConfig {
  /** Server URL (e.g., https://mycompany.odoo.com) */
  url: string;
  /** Database name */
  database: string;
  /** Authentication method */
  authMethod: AuthMethod;
  /** API key getter (for api_key auth) */
  getApiKey?: () => string | undefined;
  /** Username (for password auth) */
  username?: string;
  /** Password getter (for password auth) */
  getPassword?: () => string | undefined;
  /** Request timeout in ms */
  timeout?: number;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
}

/** Connection result */
export interface ConnectionResult {
  success: boolean;
  serverInfo?: OdooServerInfo;
  userInfo?: OdooUserInfo;
  databaseInfo?: OdooDatabaseInfo;
  error?: string;
  errorCode?: string;
}

/** JSON-RPC response */
interface JsonRpcResponse<T = unknown> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: {
      name: string;
      message: string;
      debug?: string;
    };
  };
}

/** Model record */
export interface OdooRecord {
  id: number;
  [key: string]: unknown;
}

/** Search domain */
export type OdooDomain = Array<string | [string, string, unknown]>;

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT = 30000;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build authentication credentials from config
 */
function buildAuthCredentials(config: OdooConnectionConfig): { login: string; getCredential: () => string } {
  if (config.authMethod === "api_key") {
    return {
      login: "",
      getCredential: () => config.getApiKey?.() || "",
    };
  }
  return {
    login: config.username || "",
    getCredential: () => config.getPassword?.() || "",
  };
}

// =============================================================================
// OdooServerConnector Class
// =============================================================================

/**
 * Connector for remote Odoo instances
 */
export class OdooServerConnector {
  private config: OdooConnectionConfig;
  private status: ConnectionStatus = "disconnected";
  private sessionId: string | null = null;
  private uid: number | null = null;
  private serverInfo: OdooServerInfo | null = null;
  private userInfo: OdooUserInfo | null = null;
  private reconnectAttempts = 0;
  private requestId = 0;
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

  constructor(config: OdooConnectionConfig) {
    this.config = {
      ...config,
      url: config.url.replace(/\/+$/, ""),
      timeout: config.timeout || DEFAULT_TIMEOUT,
    };
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Get server info (if connected)
   */
  getServerInfo(): OdooServerInfo | null {
    return this.serverInfo;
  }

  /**
   * Get user info (if connected)
   */
  getUserInfo(): OdooUserInfo | null {
    return this.userInfo;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status === "connected" && this.sessionId !== null;
  }

  /**
   * Add status change listener
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Connect to Odoo server
   */
  async connect(): Promise<ConnectionResult> {
    if (this.status === "connecting") {
      return { success: false, error: "Connection already in progress" };
    }

    this.setStatus("connecting");

    try {
      // Step 1: Get server version info
      const versionResult = await this.getVersionInfo();
      if (!versionResult.success) {
        this.setStatus("error");
        return versionResult;
      }
      this.serverInfo = versionResult.serverInfo!;

      // Step 2: Authenticate
      const authResult = await this.authenticate();
      if (!authResult.success) {
        this.setStatus("error");
        return authResult;
      }

      this.uid = authResult.userInfo!.uid;
      this.userInfo = authResult.userInfo!;

      // Step 3: Get database info
      const dbInfo = await this.getDatabaseInfo();

      this.setStatus("connected");
      this.reconnectAttempts = 0;

      return {
        success: true,
        serverInfo: this.serverInfo,
        userInfo: this.userInfo,
        databaseInfo: dbInfo,
      };
    } catch (error) {
      this.setStatus("error");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
        errorCode: "CONNECTION_ERROR",
      };
    }
  }

  /**
   * Disconnect from server
   */
  async disconnect(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.jsonRpcCall("/web/session/destroy", {});
      } catch {
        // Ignore errors during disconnect
      }
    }

    this.sessionId = null;
    this.uid = null;
    this.userInfo = null;
    this.setStatus("disconnected");
  }

  /**
   * Verify connection is still active
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    try {
      const result = await this.jsonRpcCall<{ uid: number }>("/web/session/get_session_info", {});
      return result?.uid === this.uid;
    } catch {
      this.setStatus("error");
      return false;
    }
  }

  /**
   * Search records
   */
  async search(
    model: string,
    domain: OdooDomain = [],
    options?: { limit?: number; offset?: number; order?: string }
  ): Promise<number[]> {
    this.ensureConnected();

    return this.callModel(model, "search", [domain], {
      limit: options?.limit,
      offset: options?.offset,
      order: options?.order,
    });
  }

  /**
   * Read records
   */
  async read(model: string, ids: number[], fields?: string[]): Promise<OdooRecord[]> {
    this.ensureConnected();

    return this.callModel(model, "read", [ids, fields || []]);
  }

  /**
   * Search and read records
   */
  async searchRead(
    model: string,
    domain: OdooDomain = [],
    fields?: string[],
    options?: { limit?: number; offset?: number; order?: string }
  ): Promise<OdooRecord[]> {
    this.ensureConnected();

    return this.callModel(model, "search_read", [domain, fields || []], {
      limit: options?.limit,
      offset: options?.offset,
      order: options?.order,
    });
  }

  /**
   * Create record
   */
  async create(model: string, values: Record<string, unknown>): Promise<number> {
    this.ensureConnected();

    return this.callModel(model, "create", [values]);
  }

  /**
   * Update records
   */
  async write(model: string, ids: number[], values: Record<string, unknown>): Promise<boolean> {
    this.ensureConnected();

    return this.callModel(model, "write", [ids, values]);
  }

  /**
   * Delete records
   */
  async unlink(model: string, ids: number[]): Promise<boolean> {
    this.ensureConnected();

    return this.callModel(model, "unlink", [ids]);
  }

  /**
   * Get installed modules
   */
  async getInstalledModules(): Promise<OdooRecord[]> {
    return this.searchRead(
      "ir.module.module",
      [["state", "=", "installed"]],
      ["name", "shortdesc", "state", "installed_version"]
    );
  }

  /**
   * Get websites
   */
  async getWebsites(): Promise<OdooRecord[]> {
    return this.searchRead(
      "website",
      [],
      ["name", "domain", "default_lang_id", "theme_id"]
    );
  }

  /**
   * Check if module is installed
   */
  async isModuleInstalled(moduleName: string): Promise<boolean> {
    const modules = await this.searchRead(
      "ir.module.module",
      [["name", "=", moduleName], ["state", "=", "installed"]],
      ["id"]
    );
    return modules.length > 0;
  }

  /**
   * Update module list
   */
  async updateModuleList(): Promise<void> {
    this.ensureConnected();

    await this.callModel("ir.module.module", "update_list", []);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  private ensureConnected(): void {
    if (!this.isConnected()) {
      throw new Error("Not connected to Odoo server");
    }
  }

  private async getVersionInfo(): Promise<ConnectionResult> {
    try {
      const result = await this.jsonRpcCall<{
        server_version: string;
        server_version_info: number[];
        server_serie: string;
        protocol_version: number;
      }>("/web/webclient/version_info", {});

      if (!result) {
        return { success: false, error: "Failed to get server version" };
      }

      return {
        success: true,
        serverInfo: {
          version: result.server_version,
          versionInfo: result.server_version_info,
          serverSerie: result.server_serie,
          protocol: result.protocol_version,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get server version",
        errorCode: "VERSION_ERROR",
      };
    }
  }

  private async authenticate(): Promise<ConnectionResult> {
    try {
      const credentials = buildAuthCredentials(this.config);

      const result = await this.jsonRpcCall<{
        uid: number;
        session_id: string;
        name: string;
        username: string;
        partner_id: number;
        company_id: number;
        is_admin: boolean;
        user_context: Record<string, unknown>;
      }>("/web/session/authenticate", {
        db: this.config.database,
        login: credentials.login,
        password: credentials.getCredential(),
      });

      if (!result || !result.uid) {
        return {
          success: false,
          error: "Authentication failed. Invalid credentials.",
          errorCode: "AUTH_FAILED",
        };
      }

      this.sessionId = result.session_id;

      // Get additional user info
      const userGroups = await this.getUserGroups(result.uid);

      return {
        success: true,
        userInfo: {
          uid: result.uid,
          name: result.name,
          username: result.username,
          companyId: result.company_id,
          companyName: "", // Would need additional query
          partnerId: result.partner_id,
          isAdmin: result.is_admin,
          groups: userGroups,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
        errorCode: "AUTH_ERROR",
      };
    }
  }

  private async getUserGroups(uid: number): Promise<string[]> {
    try {
      const groups = await this.callModel(
        "res.users",
        "read",
        [[uid], ["groups_id"]]
      );
      return groups?.[0]?.groups_id || [];
    } catch {
      return [];
    }
  }

  private async getDatabaseInfo(): Promise<OdooDatabaseInfo> {
    try {
      const websites = await this.getWebsites();
      const modules = await this.getInstalledModules();

      return {
        name: this.config.database,
        exists: true,
        websiteCount: websites.length,
        moduleCount: modules.length,
      };
    } catch {
      return {
        name: this.config.database,
        exists: true,
      };
    }
  }

  private async callModel<T = unknown>(
    model: string,
    method: string,
    args: unknown[],
    kwargs?: Record<string, unknown>
  ): Promise<T> {
    return this.jsonRpcCall<T>("/web/dataset/call_kw", {
      model,
      method,
      args,
      kwargs: kwargs || {},
    });
  }

  private async jsonRpcCall<T = unknown>(path: string, params: Record<string, unknown>): Promise<T> {
    const url = `${this.config.url}${path}`;
    const requestId = ++this.requestId;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.sessionId) {
      headers["Cookie"] = `session_id=${this.sessionId}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "call",
          params,
          id: requestId,
        }),
        signal: controller.signal,
        credentials: "include",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      // Extract session ID from cookies
      const cookies = response.headers.get("set-cookie");
      if (cookies) {
        const match = cookies.match(/session_id=([^;]+)/);
        if (match) {
          this.sessionId = match[1];
        }
      }

      const data: JsonRpcResponse<T> = await response.json();

      if (data.error) {
        const errorMsg = data.error.data?.message || data.error.message;
        throw new Error(errorMsg);
      }

      return data.result as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout");
      }

      throw error;
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create OdooServerConnector instance
 */
export function createOdooConnector(config: OdooConnectionConfig): OdooServerConnector {
  return new OdooServerConnector(config);
}

/**
 * Quick connect to Odoo with API key
 */
export async function connectToOdoo(
  url: string,
  database: string,
  getApiKey: () => string | undefined
): Promise<{ connector: OdooServerConnector; result: ConnectionResult }> {
  const connector = createOdooConnector({
    url,
    database,
    authMethod: "api_key",
    getApiKey,
  });

  const result = await connector.connect();
  return { connector, result };
}

/**
 * Quick connect to Odoo with username/password
 */
export async function connectToOdooWithCredentials(
  url: string,
  database: string,
  username: string,
  getCredential: () => string | undefined
): Promise<{ connector: OdooServerConnector; result: ConnectionResult }> {
  const connector = createOdooConnector({
    url,
    database,
    authMethod: "password",
    username,
    getPassword: getCredential,
  });

  const result = await connector.connect();
  return { connector, result };
}
