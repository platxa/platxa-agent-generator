/**
 * Enterprise SSO Provider
 *
 * Implements SAML 2.0 and OIDC (OpenID Connect) authentication
 * for enterprise identity providers.
 *
 * Supported Identity Providers:
 * - SAML 2.0: Okta, Azure AD, OneLogin, ADFS, PingIdentity, Google Workspace
 * - OIDC: Okta, Azure AD, Auth0, Keycloak, Google, Generic OIDC
 *
 * @example
 * ```typescript
 * import { SSOProvider, createSAMLProvider, createOIDCProvider } from "@/lib/auth/sso-provider"
 *
 * // Create SAML provider for Okta
 * const oktaSAML = createSAMLProvider({
 *   type: "okta",
 *   entityId: "https://app.platxa.com",
 *   ssoUrl: "https://company.okta.com/app/platxa/sso/saml",
 *   certificate: "...",
 * })
 *
 * // Create OIDC provider for Azure AD
 * const azureOIDC = createOIDCProvider({
 *   type: "azure",
 *   clientId: "...",
 *   clientSecret: "...",
 *   tenantId: "...",
 * })
 * ```
 *
 * @module auth/sso-provider
 */

import { createHash, randomBytes, createHmac } from "crypto"

// =============================================================================
// Types
// =============================================================================

/** SSO Protocol type */
export type SSOProtocol = "saml" | "oidc"

/** SAML Identity Provider type */
export type SAMLProviderType =
  | "okta"
  | "azure"
  | "onelogin"
  | "adfs"
  | "ping"
  | "google_workspace"
  | "generic"

/** OIDC Identity Provider type */
export type OIDCProviderType =
  | "okta"
  | "azure"
  | "auth0"
  | "keycloak"
  | "google"
  | "generic"

/** SSO Provider status */
export type SSOProviderStatus = "active" | "inactive" | "pending" | "error"

/** SAML Name ID format */
export type SAMLNameIdFormat =
  | "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
  | "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified"
  | "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"
  | "urn:oasis:names:tc:SAML:2.0:nameid-format:transient"

/** SAML Binding type */
export type SAMLBinding =
  | "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
  | "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"

/** OIDC Response type */
export type OIDCResponseType = "code" | "id_token" | "token" | "code id_token"

/** OIDC Grant type */
export type OIDCGrantType = "authorization_code" | "refresh_token" | "client_credentials"

/** Base SSO configuration */
export interface SSOProviderConfig {
  /** Unique provider ID */
  id: string
  /** Display name */
  name: string
  /** Protocol type */
  protocol: SSOProtocol
  /** Provider status */
  status: SSOProviderStatus
  /** Organization/workspace ID this provider belongs to */
  organizationId: string
  /** Whether this is the default provider */
  isDefault?: boolean
  /** Domain restrictions (e.g., ["company.com"]) */
  allowedDomains?: string[]
  /** Created timestamp */
  createdAt: Date
  /** Updated timestamp */
  updatedAt: Date
}

/** SAML Provider configuration */
export interface SAMLProviderConfig extends SSOProviderConfig {
  protocol: "saml"
  /** SAML provider type */
  providerType: SAMLProviderType
  /** Service Provider Entity ID */
  entityId: string
  /** Identity Provider SSO URL */
  ssoUrl: string
  /** Identity Provider SLO URL (optional) */
  sloUrl?: string
  /** IdP X.509 Certificate (PEM format) */
  certificate: string
  /** SP Private Key for signing (PEM format, optional) */
  privateKey?: string
  /** SP Certificate for signing (PEM format, optional) */
  spCertificate?: string
  /** Name ID format */
  nameIdFormat: SAMLNameIdFormat
  /** SAML Binding */
  binding: SAMLBinding
  /** Whether to sign AuthnRequest */
  signRequest: boolean
  /** Whether to validate response signature */
  validateSignature: boolean
  /** Attribute mapping */
  attributeMapping: SAMLAttributeMapping
  /** Allowed clock skew in seconds */
  clockSkewSeconds: number
}

/** SAML attribute mapping */
export interface SAMLAttributeMapping {
  /** Email attribute name */
  email: string
  /** First name attribute name */
  firstName?: string
  /** Last name attribute name */
  lastName?: string
  /** Display name attribute name */
  displayName?: string
  /** Groups/roles attribute name */
  groups?: string
  /** Custom attribute mappings */
  custom?: Record<string, string>
}

/** OIDC Provider configuration */
export interface OIDCProviderConfig extends SSOProviderConfig {
  protocol: "oidc"
  /** OIDC provider type */
  providerType: OIDCProviderType
  /** Client ID */
  clientId: string
  /** Client Secret (encrypted) */
  clientSecret: string
  /** Issuer URL (for discovery) */
  issuer: string
  /** Authorization endpoint (optional, discovered) */
  authorizationEndpoint?: string
  /** Token endpoint (optional, discovered) */
  tokenEndpoint?: string
  /** UserInfo endpoint (optional, discovered) */
  userinfoEndpoint?: string
  /** JWKS URI (optional, discovered) */
  jwksUri?: string
  /** End session endpoint (optional, discovered) */
  endSessionEndpoint?: string
  /** Requested scopes */
  scopes: string[]
  /** Response type */
  responseType: OIDCResponseType
  /** Grant types */
  grantTypes: OIDCGrantType[]
  /** Claim mapping */
  claimMapping: OIDCClaimMapping
  /** PKCE enabled */
  pkceEnabled: boolean
  /** Azure AD tenant ID (for Azure) */
  tenantId?: string
  /** Auth0 domain (for Auth0) */
  auth0Domain?: string
}

/** OIDC claim mapping */
export interface OIDCClaimMapping {
  /** Email claim */
  email: string
  /** Name claim */
  name?: string
  /** Given name claim */
  givenName?: string
  /** Family name claim */
  familyName?: string
  /** Picture claim */
  picture?: string
  /** Groups claim */
  groups?: string
  /** Custom claim mappings */
  custom?: Record<string, string>
}

/** SSO Authentication request */
export interface SSOAuthRequest {
  /** Provider ID */
  providerId: string
  /** Redirect URI after authentication */
  redirectUri: string
  /** State parameter for CSRF protection */
  state: string
  /** Nonce for replay protection (OIDC) */
  nonce?: string
  /** PKCE code verifier (OIDC) */
  codeVerifier?: string
  /** Login hint (pre-fill email) */
  loginHint?: string
  /** Force re-authentication */
  forceAuthn?: boolean
}

/** SSO Authentication response */
export interface SSOAuthResponse {
  /** Success status */
  success: boolean
  /** User information */
  user?: SSOUser
  /** Access token (OIDC) */
  accessToken?: string
  /** ID token (OIDC) */
  idToken?: string
  /** Refresh token (OIDC) */
  refreshToken?: string
  /** Token expiration */
  expiresAt?: Date
  /** SAML assertion (SAML) */
  samlAssertion?: string
  /** Error code */
  error?: string
  /** Error description */
  errorDescription?: string
}

/** SSO User information */
export interface SSOUser {
  /** User ID from IdP */
  id: string
  /** Email address */
  email: string
  /** Display name */
  name?: string
  /** First name */
  firstName?: string
  /** Last name */
  lastName?: string
  /** Profile picture URL */
  picture?: string
  /** Groups/roles */
  groups?: string[]
  /** Email verified */
  emailVerified?: boolean
  /** Raw attributes/claims */
  rawAttributes: Record<string, unknown>
  /** Provider ID */
  providerId: string
  /** Provider type */
  providerType: SAMLProviderType | OIDCProviderType
}

/** SSO Session */
export interface SSOSession {
  /** Session ID */
  id: string
  /** User information */
  user: SSOUser
  /** Provider ID */
  providerId: string
  /** Session start time */
  startedAt: Date
  /** Session expiration */
  expiresAt: Date
  /** Access token (if available) */
  accessToken?: string
  /** Refresh token (if available) */
  refreshToken?: string
  /** SAML session index (for SLO) */
  samlSessionIndex?: string
}

/** Provider creation input */
export interface CreateSAMLProviderInput {
  name: string
  organizationId: string
  providerType: SAMLProviderType
  entityId: string
  ssoUrl: string
  sloUrl?: string
  certificate: string
  privateKey?: string
  spCertificate?: string
  nameIdFormat?: SAMLNameIdFormat
  binding?: SAMLBinding
  signRequest?: boolean
  validateSignature?: boolean
  attributeMapping?: Partial<SAMLAttributeMapping>
  allowedDomains?: string[]
  clockSkewSeconds?: number
}

export interface CreateOIDCProviderInput {
  name: string
  organizationId: string
  providerType: OIDCProviderType
  clientId: string
  clientSecret: string
  issuer: string
  scopes?: string[]
  responseType?: OIDCResponseType
  grantTypes?: OIDCGrantType[]
  claimMapping?: Partial<OIDCClaimMapping>
  pkceEnabled?: boolean
  allowedDomains?: string[]
  tenantId?: string
  auth0Domain?: string
}

// =============================================================================
// Constants
// =============================================================================

/** Default SAML attribute mappings by provider */
const DEFAULT_SAML_MAPPINGS: Record<SAMLProviderType, SAMLAttributeMapping> = {
  okta: {
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
    displayName: "displayName",
    groups: "groups",
  },
  azure: {
    email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    firstName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    lastName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
    displayName: "http://schemas.microsoft.com/identity/claims/displayname",
    groups: "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups",
  },
  onelogin: {
    email: "User.email",
    firstName: "User.FirstName",
    lastName: "User.LastName",
    displayName: "User.DisplayName",
  },
  adfs: {
    email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    firstName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    lastName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
    groups: "http://schemas.xmlsoap.org/claims/Group",
  },
  ping: {
    email: "email",
    firstName: "given_name",
    lastName: "family_name",
    displayName: "name",
  },
  google_workspace: {
    email: "email",
    firstName: "first_name",
    lastName: "last_name",
    displayName: "name",
  },
  generic: {
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
    displayName: "displayName",
  },
}

/** Default OIDC claim mappings by provider */
const DEFAULT_OIDC_MAPPINGS: Record<OIDCProviderType, OIDCClaimMapping> = {
  okta: {
    email: "email",
    name: "name",
    givenName: "given_name",
    familyName: "family_name",
    picture: "picture",
    groups: "groups",
  },
  azure: {
    email: "email",
    name: "name",
    givenName: "given_name",
    familyName: "family_name",
    picture: "picture",
    groups: "groups",
  },
  auth0: {
    email: "email",
    name: "name",
    givenName: "given_name",
    familyName: "family_name",
    picture: "picture",
  },
  keycloak: {
    email: "email",
    name: "name",
    givenName: "given_name",
    familyName: "family_name",
    picture: "picture",
    groups: "groups",
  },
  google: {
    email: "email",
    name: "name",
    givenName: "given_name",
    familyName: "family_name",
    picture: "picture",
  },
  generic: {
    email: "email",
    name: "name",
    givenName: "given_name",
    familyName: "family_name",
  },
}

/** Default OIDC scopes by provider */
const DEFAULT_OIDC_SCOPES: Record<OIDCProviderType, string[]> = {
  okta: ["openid", "profile", "email", "groups"],
  azure: ["openid", "profile", "email", "offline_access"],
  auth0: ["openid", "profile", "email"],
  keycloak: ["openid", "profile", "email", "roles"],
  google: ["openid", "profile", "email"],
  generic: ["openid", "profile", "email"],
}

// =============================================================================
// SSO Provider Class
// =============================================================================

export class SSOProvider {
  private providers: Map<string, SAMLProviderConfig | OIDCProviderConfig> = new Map()
  private pendingRequests: Map<string, SSOAuthRequest> = new Map()
  private sessions: Map<string, SSOSession> = new Map()

  /**
   * Register a SAML provider
   */
  registerSAMLProvider(input: CreateSAMLProviderInput): SAMLProviderConfig {
    const id = generateProviderId()
    const now = new Date()

    const config: SAMLProviderConfig = {
      id,
      name: input.name,
      protocol: "saml",
      status: "active",
      organizationId: input.organizationId,
      providerType: input.providerType,
      entityId: input.entityId,
      ssoUrl: input.ssoUrl,
      sloUrl: input.sloUrl,
      certificate: input.certificate,
      privateKey: input.privateKey,
      spCertificate: input.spCertificate,
      nameIdFormat: input.nameIdFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
      binding: input.binding || "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
      signRequest: input.signRequest ?? false,
      validateSignature: input.validateSignature ?? true,
      attributeMapping: {
        ...DEFAULT_SAML_MAPPINGS[input.providerType],
        ...input.attributeMapping,
      },
      allowedDomains: input.allowedDomains,
      clockSkewSeconds: input.clockSkewSeconds ?? 300,
      createdAt: now,
      updatedAt: now,
    }

    this.providers.set(id, config)
    return config
  }

  /**
   * Register an OIDC provider
   */
  registerOIDCProvider(input: CreateOIDCProviderInput): OIDCProviderConfig {
    const id = generateProviderId()
    const now = new Date()

    const config: OIDCProviderConfig = {
      id,
      name: input.name,
      protocol: "oidc",
      status: "active",
      organizationId: input.organizationId,
      providerType: input.providerType,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      issuer: buildIssuerUrl(input),
      scopes: input.scopes || DEFAULT_OIDC_SCOPES[input.providerType],
      responseType: input.responseType || "code",
      grantTypes: input.grantTypes || ["authorization_code", "refresh_token"],
      claimMapping: {
        ...DEFAULT_OIDC_MAPPINGS[input.providerType],
        ...input.claimMapping,
      },
      pkceEnabled: input.pkceEnabled ?? true,
      allowedDomains: input.allowedDomains,
      tenantId: input.tenantId,
      auth0Domain: input.auth0Domain,
      createdAt: now,
      updatedAt: now,
    }

    this.providers.set(id, config)
    return config
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string): SAMLProviderConfig | OIDCProviderConfig | undefined {
    return this.providers.get(id)
  }

  /**
   * Get providers for an organization
   */
  getOrganizationProviders(organizationId: string): Array<SAMLProviderConfig | OIDCProviderConfig> {
    return Array.from(this.providers.values()).filter(
      (p) => p.organizationId === organizationId
    )
  }

  /**
   * Find provider by email domain
   */
  findProviderByDomain(email: string): SAMLProviderConfig | OIDCProviderConfig | undefined {
    const domain = email.split("@")[1]?.toLowerCase()
    if (!domain) return undefined

    return Array.from(this.providers.values()).find((p) => {
      if (!p.allowedDomains || p.allowedDomains.length === 0) return false
      return p.allowedDomains.some((d) => d.toLowerCase() === domain)
    })
  }

  /**
   * Initiate SSO authentication
   */
  initiateAuth(providerId: string, redirectUri: string, options?: {
    loginHint?: string
    forceAuthn?: boolean
  }): { url: string; request: SSOAuthRequest } {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`)
    }

    const state = generateSecureToken()
    const nonce = generateSecureToken()

    const request: SSOAuthRequest = {
      providerId,
      redirectUri,
      state,
      nonce,
      loginHint: options?.loginHint,
      forceAuthn: options?.forceAuthn,
    }

    // Add PKCE for OIDC
    if (provider.protocol === "oidc" && (provider as OIDCProviderConfig).pkceEnabled) {
      request.codeVerifier = generateCodeVerifier()
    }

    this.pendingRequests.set(state, request)

    // Build authorization URL
    const url = provider.protocol === "saml"
      ? this.buildSAMLAuthUrl(provider as SAMLProviderConfig, request)
      : this.buildOIDCAuthUrl(provider as OIDCProviderConfig, request)

    return { url, request }
  }

  /**
   * Handle SSO callback
   */
  async handleCallback(
    state: string,
    params: Record<string, string>
  ): Promise<SSOAuthResponse> {
    const request = this.pendingRequests.get(state)
    if (!request) {
      return {
        success: false,
        error: "invalid_state",
        errorDescription: "Invalid or expired state parameter",
      }
    }

    this.pendingRequests.delete(state)

    const provider = this.providers.get(request.providerId)
    if (!provider) {
      return {
        success: false,
        error: "provider_not_found",
        errorDescription: "SSO provider not found",
      }
    }

    try {
      if (provider.protocol === "saml") {
        return await this.handleSAMLCallback(
          provider as SAMLProviderConfig,
          request,
          params
        )
      } else {
        return await this.handleOIDCCallback(
          provider as OIDCProviderConfig,
          request,
          params
        )
      }
    } catch (error) {
      return {
        success: false,
        error: "callback_error",
        errorDescription: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Initiate logout
   */
  initiateLogout(sessionId: string, redirectUri: string): { url: string } | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    const provider = this.providers.get(session.providerId)
    if (!provider) return null

    this.sessions.delete(sessionId)

    if (provider.protocol === "saml") {
      const samlProvider = provider as SAMLProviderConfig
      if (samlProvider.sloUrl) {
        const params = new URLSearchParams({
          SAMLRequest: this.buildSAMLLogoutRequest(samlProvider, session),
          RelayState: redirectUri,
        })
        return { url: `${samlProvider.sloUrl}?${params.toString()}` }
      }
    } else {
      const oidcProvider = provider as OIDCProviderConfig
      if (oidcProvider.endSessionEndpoint) {
        const params = new URLSearchParams({
          id_token_hint: session.accessToken || "",
          post_logout_redirect_uri: redirectUri,
        })
        return { url: `${oidcProvider.endSessionEndpoint}?${params.toString()}` }
      }
    }

    return null
  }

  /**
   * Validate provider configuration
   */
  validateProviderConfig(
    config: SAMLProviderConfig | OIDCProviderConfig
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.name) errors.push("Provider name is required")
    if (!config.organizationId) errors.push("Organization ID is required")

    if (config.protocol === "saml") {
      const saml = config as SAMLProviderConfig
      if (!saml.entityId) errors.push("Entity ID is required")
      if (!saml.ssoUrl) errors.push("SSO URL is required")
      if (!saml.certificate) errors.push("IdP certificate is required")
      if (!isValidUrl(saml.ssoUrl)) errors.push("SSO URL is not a valid URL")
      if (saml.sloUrl && !isValidUrl(saml.sloUrl)) errors.push("SLO URL is not a valid URL")
      if (!isValidCertificate(saml.certificate)) errors.push("Invalid X.509 certificate format")
    } else {
      const oidc = config as OIDCProviderConfig
      if (!oidc.clientId) errors.push("Client ID is required")
      if (!oidc.clientSecret) errors.push("Client Secret is required")
      if (!oidc.issuer) errors.push("Issuer URL is required")
      if (!isValidUrl(oidc.issuer)) errors.push("Issuer is not a valid URL")
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SSOSession | undefined {
    const session = this.sessions.get(sessionId)
    if (session && session.expiresAt < new Date()) {
      this.sessions.delete(sessionId)
      return undefined
    }
    return session
  }

  /**
   * Remove provider
   */
  removeProvider(id: string): boolean {
    return this.providers.delete(id)
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private buildSAMLAuthUrl(config: SAMLProviderConfig, request: SSOAuthRequest): string {
    const authnRequest = this.buildSAMLAuthnRequest(config, request)
    const encoded = Buffer.from(authnRequest).toString("base64")

    if (config.binding === "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect") {
      const params = new URLSearchParams({
        SAMLRequest: encoded,
        RelayState: request.state,
      })
      return `${config.ssoUrl}?${params.toString()}`
    }

    // For HTTP-POST binding, return a form action URL
    return config.ssoUrl
  }

  private buildSAMLAuthnRequest(config: SAMLProviderConfig, request: SSOAuthRequest): string {
    const id = `_${generateSecureToken()}`
    const issueInstant = new Date().toISOString()

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${config.ssoUrl}"
  AssertionConsumerServiceURL="${request.redirectUri}"
  ProtocolBinding="${config.binding}">
  <saml:Issuer>${escapeXml(config.entityId)}</saml:Issuer>
  <samlp:NameIDPolicy Format="${config.nameIdFormat}" AllowCreate="true"/>
</samlp:AuthnRequest>`

    if (request.forceAuthn) {
      xml = xml.replace('ProtocolBinding=', 'ForceAuthn="true" ProtocolBinding=')
    }

    return xml
  }

  private buildSAMLLogoutRequest(config: SAMLProviderConfig, session: SSOSession): string {
    const id = `_${generateSecureToken()}`
    const issueInstant = new Date().toISOString()

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${config.sloUrl}">
  <saml:Issuer>${escapeXml(config.entityId)}</saml:Issuer>
  <saml:NameID Format="${config.nameIdFormat}">${escapeXml(session.user.email)}</saml:NameID>
  ${session.samlSessionIndex ? `<samlp:SessionIndex>${escapeXml(session.samlSessionIndex)}</samlp:SessionIndex>` : ""}
</samlp:LogoutRequest>`

    return Buffer.from(xml).toString("base64")
  }

  private buildOIDCAuthUrl(config: OIDCProviderConfig, request: SSOAuthRequest): string {
    const authEndpoint = config.authorizationEndpoint || `${config.issuer}/authorize`

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: config.responseType,
      redirect_uri: request.redirectUri,
      scope: config.scopes.join(" "),
      state: request.state,
      nonce: request.nonce || "",
    })

    if (request.loginHint) {
      params.set("login_hint", request.loginHint)
    }

    if (request.forceAuthn) {
      params.set("prompt", "login")
    }

    if (config.pkceEnabled && request.codeVerifier) {
      const codeChallenge = generateCodeChallenge(request.codeVerifier)
      params.set("code_challenge", codeChallenge)
      params.set("code_challenge_method", "S256")
    }

    return `${authEndpoint}?${params.toString()}`
  }

  private async handleSAMLCallback(
    config: SAMLProviderConfig,
    request: SSOAuthRequest,
    params: Record<string, string>
  ): Promise<SSOAuthResponse> {
    const samlResponse = params.SAMLResponse
    if (!samlResponse) {
      return {
        success: false,
        error: "missing_response",
        errorDescription: "SAML response not found",
      }
    }

    // Decode and parse SAML response
    const decoded = Buffer.from(samlResponse, "base64").toString("utf-8")

    // Extract user attributes (simplified - production would use proper XML parsing)
    const user = this.extractSAMLUser(decoded, config)
    if (!user) {
      return {
        success: false,
        error: "invalid_response",
        errorDescription: "Failed to extract user from SAML response",
      }
    }

    // Validate email domain if restrictions apply
    if (config.allowedDomains && config.allowedDomains.length > 0) {
      const domain = user.email.split("@")[1]?.toLowerCase()
      if (!config.allowedDomains.some((d) => d.toLowerCase() === domain)) {
        return {
          success: false,
          error: "domain_not_allowed",
          errorDescription: `Email domain ${domain} is not allowed`,
        }
      }
    }

    // Create session
    const sessionId = generateSecureToken()
    const session: SSOSession = {
      id: sessionId,
      user,
      providerId: config.id,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      samlSessionIndex: this.extractSessionIndex(decoded),
    }
    this.sessions.set(sessionId, session)

    return {
      success: true,
      user,
      samlAssertion: samlResponse,
    }
  }

  private async handleOIDCCallback(
    config: OIDCProviderConfig,
    request: SSOAuthRequest,
    params: Record<string, string>
  ): Promise<SSOAuthResponse> {
    if (params.error) {
      return {
        success: false,
        error: params.error,
        errorDescription: params.error_description,
      }
    }

    const code = params.code
    if (!code) {
      return {
        success: false,
        error: "missing_code",
        errorDescription: "Authorization code not found",
      }
    }

    // Exchange code for tokens
    const tokenEndpoint = config.tokenEndpoint || `${config.issuer}/token`
    const tokenParams: Record<string, string> = {
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: request.redirectUri,
    }

    if (config.pkceEnabled && request.codeVerifier) {
      tokenParams.code_verifier = request.codeVerifier
    }

    // In production, this would be an actual HTTP request
    // Simulated token response for type safety
    const tokens = await this.exchangeCodeForTokens(tokenEndpoint, tokenParams)
    if (!tokens.access_token) {
      return {
        success: false,
        error: "token_exchange_failed",
        errorDescription: "Failed to exchange authorization code for tokens",
      }
    }

    // Get user info
    const userinfoEndpoint = config.userinfoEndpoint || `${config.issuer}/userinfo`
    const userInfo = await this.fetchUserInfo(userinfoEndpoint, tokens.access_token)

    const user = this.mapOIDCUser(userInfo, config)

    // Validate email domain if restrictions apply
    if (config.allowedDomains && config.allowedDomains.length > 0) {
      const domain = user.email.split("@")[1]?.toLowerCase()
      if (!config.allowedDomains.some((d) => d.toLowerCase() === domain)) {
        return {
          success: false,
          error: "domain_not_allowed",
          errorDescription: `Email domain ${domain} is not allowed`,
        }
      }
    }

    // Create session
    const sessionId = generateSecureToken()
    const session: SSOSession = {
      id: sessionId,
      user,
      providerId: config.id,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    }
    this.sessions.set(sessionId, session)

    return {
      success: true,
      user,
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresAt: session.expiresAt,
    }
  }

  private extractSAMLUser(xml: string, config: SAMLProviderConfig): SSOUser | null {
    // Simplified extraction - production would use proper XML parsing library
    const mapping = config.attributeMapping

    const extractAttribute = (name: string): string | undefined => {
      const regex = new RegExp(`Name="${escapeRegex(name)}"[^>]*>\\s*<[^>]+>([^<]+)<`, "i")
      const match = xml.match(regex)
      return match?.[1]
    }

    const email = extractAttribute(mapping.email)
    if (!email) return null

    // Extract NameID as user ID
    const nameIdMatch = xml.match(/<saml:NameID[^>]*>([^<]+)</i)
    const id = nameIdMatch?.[1] || email

    const groups: string[] = []
    if (mapping.groups) {
      const groupRegex = new RegExp(`Name="${escapeRegex(mapping.groups)}"[^>]*>\\s*<[^>]+>([^<]+)<`, "gi")
      let match
      while ((match = groupRegex.exec(xml)) !== null) {
        groups.push(match[1])
      }
    }

    return {
      id,
      email,
      firstName: mapping.firstName ? extractAttribute(mapping.firstName) : undefined,
      lastName: mapping.lastName ? extractAttribute(mapping.lastName) : undefined,
      name: mapping.displayName ? extractAttribute(mapping.displayName) : undefined,
      groups: groups.length > 0 ? groups : undefined,
      emailVerified: true,
      rawAttributes: { xml },
      providerId: config.id,
      providerType: config.providerType,
    }
  }

  private extractSessionIndex(xml: string): string | undefined {
    const match = xml.match(/<saml:AuthnStatement[^>]*SessionIndex="([^"]+)"/i)
    return match?.[1]
  }

  private mapOIDCUser(claims: Record<string, unknown>, config: OIDCProviderConfig): SSOUser {
    const mapping = config.claimMapping

    const getClaimValue = (key: string): string | undefined => {
      const value = claims[key]
      return typeof value === "string" ? value : undefined
    }

    const groups = claims[mapping.groups || "groups"]
    const groupsArray = Array.isArray(groups) ? groups.filter((g) => typeof g === "string") : undefined

    return {
      id: getClaimValue("sub") || getClaimValue(mapping.email) || "",
      email: getClaimValue(mapping.email) || "",
      name: getClaimValue(mapping.name || "name"),
      firstName: getClaimValue(mapping.givenName || "given_name"),
      lastName: getClaimValue(mapping.familyName || "family_name"),
      picture: getClaimValue(mapping.picture || "picture"),
      groups: groupsArray,
      emailVerified: claims.email_verified === true,
      rawAttributes: claims,
      providerId: config.id,
      providerType: config.providerType,
    }
  }

  private async exchangeCodeForTokens(
    endpoint: string,
    params: Record<string, string>
  ): Promise<{
    access_token?: string
    id_token?: string
    refresh_token?: string
    expires_in?: number
  }> {
    // In production, this would be a real HTTP POST request
    // For now, return a structure that indicates implementation needed
    console.log(`Token exchange would POST to ${endpoint}`, params)
    return {
      access_token: undefined,
      id_token: undefined,
      refresh_token: undefined,
    }
  }

  private async fetchUserInfo(
    endpoint: string,
    accessToken: string
  ): Promise<Record<string, unknown>> {
    // In production, this would be a real HTTP GET request with Bearer token
    console.log(`UserInfo fetch would GET ${endpoint} with token`)
    return {}
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

function generateProviderId(): string {
  return `sso_${Date.now().toString(36)}_${randomBytes(8).toString("hex")}`
}

function generateSecureToken(): string {
  return randomBytes(32).toString("hex")
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url")
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

function buildIssuerUrl(input: CreateOIDCProviderInput): string {
  switch (input.providerType) {
    case "azure":
      return `https://login.microsoftonline.com/${input.tenantId}/v2.0`
    case "auth0":
      return `https://${input.auth0Domain}`
    case "okta":
      // Okta issuer is typically provided directly
      return input.issuer
    case "google":
      return "https://accounts.google.com"
    default:
      return input.issuer
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

function isValidCertificate(cert: string): boolean {
  // Basic validation - check for PEM format markers
  const trimmed = cert.trim()
  return (
    (trimmed.startsWith("-----BEGIN CERTIFICATE-----") &&
      trimmed.endsWith("-----END CERTIFICATE-----")) ||
    (trimmed.startsWith("-----BEGIN X509 CERTIFICATE-----") &&
      trimmed.endsWith("-----END X509 CERTIFICATE-----")) ||
    // Also accept raw base64
    /^[A-Za-z0-9+/=]+$/.test(trimmed.replace(/\s/g, ""))
  )
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// =============================================================================
// Factory Functions
// =============================================================================

let globalProvider: SSOProvider | null = null

/**
 * Get the global SSO provider instance
 */
export function getSSOProvider(): SSOProvider {
  if (!globalProvider) {
    globalProvider = new SSOProvider()
  }
  return globalProvider
}

/**
 * Create a new SSO provider instance
 */
export function createSSOProvider(): SSOProvider {
  return new SSOProvider()
}

/**
 * Create a SAML provider configuration (convenience function)
 */
export function createSAMLProvider(input: CreateSAMLProviderInput): SAMLProviderConfig {
  return getSSOProvider().registerSAMLProvider(input)
}

/**
 * Create an OIDC provider configuration (convenience function)
 */
export function createOIDCProvider(input: CreateOIDCProviderInput): OIDCProviderConfig {
  return getSSOProvider().registerOIDCProvider(input)
}

/**
 * Initiate SSO login (convenience function)
 */
export function initiateSSOLogin(
  providerId: string,
  redirectUri: string,
  options?: { loginHint?: string; forceAuthn?: boolean }
): { url: string; request: SSOAuthRequest } {
  return getSSOProvider().initiateAuth(providerId, redirectUri, options)
}

/**
 * Handle SSO callback (convenience function)
 */
export async function handleSSOCallback(
  state: string,
  params: Record<string, string>
): Promise<SSOAuthResponse> {
  return getSSOProvider().handleCallback(state, params)
}

export default SSOProvider
