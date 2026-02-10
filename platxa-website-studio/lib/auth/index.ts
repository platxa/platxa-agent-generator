import NextAuth from "next-auth";
import { authConfig } from "./config";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);

// Enterprise SSO exports
export {
  SSOProvider,
  getSSOProvider,
  createSSOProvider,
  createSAMLProvider,
  createOIDCProvider,
  initiateSSOLogin,
  handleSSOCallback,
  type SSOProtocol,
  type SAMLProviderType,
  type OIDCProviderType,
  type SSOProviderStatus,
  type SAMLProviderConfig,
  type OIDCProviderConfig,
  type SSOAuthRequest,
  type SSOAuthResponse,
  type SSOUser,
  type SSOSession,
  type CreateSAMLProviderInput,
  type CreateOIDCProviderInput,
} from "./sso-provider";
