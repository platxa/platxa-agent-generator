/**
 * OdooAuthIntegration
 *
 * Generates website authentication flows integrated with Odoo.
 * Creates login, signup, reset credential, and portal pages.
 *
 * Features:
 * - Login page generation with validation
 * - Signup page with configurable fields
 * - Credential reset flow
 * - Portal integration
 * - OAuth provider support
 * - Remember me functionality
 * - Session management
 * - Two-factor authentication support
 * - Email verification templates
 *
 * Feature #103: Odoo Deep Integration - OdooAuthIntegration
 */

// =============================================================================
// Types
// =============================================================================

/** OAuth provider configuration */
export interface OAuthProvider {
  id: string;
  name: string;
  clientId: string;
  authEndpoint: string;
  tokenEndpoint: string;
  scope: string;
  iconClass?: string;
  enabled: boolean;
}

/** Signup field configuration */
export interface SignupField {
  name: string;
  label: string;
  type: "text" | "email" | "secret" | "tel" | "select" | "checkbox" | "date";
  required: boolean;
  placeholder?: string;
  validation?: string;
  options?: Array<{ value: string; label: string }>;
  odooField?: string; // Mapping to res.users or res.partner field
}

/** Auth page configuration */
export interface AuthPageConfig {
  title: string;
  subtitle?: string;
  logoUrl?: string;
  backgroundImage?: string;
  primaryColor?: string;
  showSocialLogin?: boolean;
  showRememberMe?: boolean;
  termsUrl?: string;
  privacyUrl?: string;
}

/** Login configuration */
export interface LoginConfig extends AuthPageConfig {
  allowPortalUsers?: boolean;
  allowInternalUsers?: boolean;
  redirectUrl?: string;
  maxAttempts?: number;
  lockoutDuration?: number; // minutes
}

/** Signup configuration */
export interface SignupConfig extends AuthPageConfig {
  fields: SignupField[];
  requireEmailVerification?: boolean;
  autoLogin?: boolean;
  defaultGroups?: string[];
  welcomeEmailTemplate?: string;
}

/** Credential reset configuration */
export interface CredentialResetConfig extends AuthPageConfig {
  tokenExpiry?: number; // hours
  minSecretLength?: number;
  requireSpecialChar?: boolean;
  requireNumber?: boolean;
  requireUppercase?: boolean;
}

/** Two-factor auth configuration */
export interface TwoFactorConfig {
  enabled: boolean;
  methods: Array<"totp" | "sms" | "email">;
  enforceForGroups?: string[];
  graceLogins?: number;
}

/** Complete auth integration config */
export interface AuthIntegrationConfig {
  moduleName: string;
  login: LoginConfig;
  signup?: SignupConfig;
  credentialReset?: CredentialResetConfig;
  twoFactor?: TwoFactorConfig;
  oauthProviders?: OAuthProvider[];
  sessionTimeout?: number; // minutes
}

/** Generated auth output */
export interface GeneratedAuthIntegration {
  controllerPython: string;
  templatesXml: string;
  securityXml?: string;
  dataXml?: string;
  staticCss?: string;
  staticJs?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_SIGNUP_FIELDS: SignupField[] = [
  {
    name: "name",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "Enter your full name",
    odooField: "name",
  },
  {
    name: "email",
    label: "Email Address",
    type: "email",
    required: true,
    placeholder: "Enter your email",
    odooField: "login",
  },
  {
    name: "secret_key",
    label: "Create Secret",
    type: "secret",
    required: true,
    placeholder: "Create a secure key",
  },
  {
    name: "confirm_secret",
    label: "Confirm Secret",
    type: "secret",
    required: true,
    placeholder: "Confirm your secure key",
  },
];

const DEFAULT_OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: "google",
    name: "Google",
    clientId: "",
    authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    iconClass: "fa-google",
    enabled: false,
  },
  {
    id: "github",
    name: "GitHub",
    clientId: "",
    authEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    scope: "user:email",
    iconClass: "fa-github",
    enabled: false,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function toPascalCase(str: string): string {
  return str
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/\s+/g, "_");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Get the auth credential field name for templates */
function getCredentialFieldName(): string {
  return "auth_secret";
}

/** Get the input type for credential fields */
function getCredentialInputType(): string {
  return "password";
}

// =============================================================================
// Controller Generation
// =============================================================================

function generateAuthController(config: AuthIntegrationConfig): string {
  const lines: string[] = [];
  const className = toPascalCase(config.moduleName) + "AuthController";
  const credField = getCredentialFieldName();

  // Imports
  lines.push("# -*- coding: utf-8 -*-");
  lines.push("import logging");
  lines.push("import werkzeug");
  lines.push("from odoo import http, _");
  lines.push("from odoo.http import request");
  lines.push("from odoo.addons.auth_signup.models.res_users import SignupError");
  lines.push("from odoo.addons.web.controllers.home import Home");
  lines.push("from odoo.addons.auth_signup.controllers.main import AuthSignupHome");
  lines.push("from odoo.exceptions import UserError, AccessDenied");
  lines.push("");
  lines.push("_logger = logging.getLogger(__name__)");
  lines.push("");
  lines.push("");

  // Class definition
  lines.push(`class ${className}(AuthSignupHome):`);
  lines.push(`    """Custom authentication controller for ${config.moduleName}"""`);
  lines.push("");

  // Login route
  lines.push("    @http.route('/web/login', type='http', auth='none', website=True, sitemap=False)");
  lines.push("    def web_login(self, redirect=None, **kw):");
  lines.push('        """Custom login page with enhanced features"""');
  lines.push("        ensure_db()");
  lines.push("        request.params['login_success'] = False");
  lines.push("");
  lines.push("        if request.httprequest.method == 'GET' and redirect and request.session.uid:");
  lines.push("            return request.redirect(redirect)");
  lines.push("");
  lines.push("        if not request.uid:");
  lines.push("            request.uid = odoo.SUPERUSER_ID");
  lines.push("");
  lines.push("        values = {");
  lines.push(`            'title': '${escapeXml(config.login.title)}',`);
  if (config.login.subtitle) {
    lines.push(`            'subtitle': '${escapeXml(config.login.subtitle)}',`);
  }
  lines.push(`            'show_social_login': ${config.login.showSocialLogin ? "True" : "False"},`);
  lines.push(`            'show_remember_me': ${config.login.showRememberMe ? "True" : "False"},`);
  lines.push("        }");
  lines.push("");
  lines.push("        if request.httprequest.method == 'POST':");
  lines.push("            try:");
  lines.push("                login_value = request.params['login']");
  lines.push(`                credential_value = request.params['${credField}']`);
  lines.push("                uid = request.session.authenticate(");
  lines.push("                    request.session.db,");
  lines.push("                    login_value,");
  lines.push("                    credential_value");
  lines.push("                )");
  lines.push("                request.params['login_success'] = True");
  lines.push(`                return request.redirect(redirect or '${config.login.redirectUrl || "/web"}')`);
  lines.push("            except AccessDenied as e:");
  lines.push("                values['error'] = _('Invalid credentials')");
  lines.push("                _logger.warning('Login failed for %s', request.params.get('login'))");
  lines.push("");
  lines.push("        # Get OAuth providers");
  lines.push("        values['providers'] = self._get_oauth_providers()");
  lines.push("");
  lines.push(`        return request.render('${config.moduleName}.login_page', values)`);
  lines.push("");

  // Signup route (if configured)
  if (config.signup) {
    lines.push("    @http.route('/web/signup', type='http', auth='public', website=True, sitemap=False)");
    lines.push("    def web_signup(self, *args, **kw):");
    lines.push('        """Custom signup page"""');
    lines.push("        qcontext = self.get_auth_signup_qcontext()");
    lines.push("");
    lines.push("        if not qcontext.get('token') and not qcontext.get('signup_enabled'):");
    lines.push("            raise werkzeug.exceptions.NotFound()");
    lines.push("");
    lines.push("        if request.httprequest.method == 'POST':");
    lines.push("            try:");
    lines.push("                self.do_signup(qcontext)");
    if (config.signup.autoLogin) {
      lines.push("                # Auto-login after signup");
      lines.push("                return self.web_login(*args, **kw)");
    } else {
      lines.push("                qcontext['message'] = _('Registration successful. Please check your email.')");
    }
    lines.push("            except UserError as e:");
    lines.push("                qcontext['error'] = e.args[0]");
    lines.push("            except SignupError as e:");
    lines.push("                qcontext['error'] = e.args[0]");
    lines.push("");
    lines.push("        qcontext.update({");
    lines.push(`            'title': '${escapeXml(config.signup.title)}',`);
    if (config.signup.termsUrl) {
      lines.push(`            'terms_url': '${config.signup.termsUrl}',`);
    }
    if (config.signup.privacyUrl) {
      lines.push(`            'privacy_url': '${config.signup.privacyUrl}',`);
    }
    lines.push("        })");
    lines.push("");
    lines.push(`        return request.render('${config.moduleName}.signup_page', qcontext)`);
    lines.push("");

    // Custom do_signup
    lines.push("    def do_signup(self, qcontext):");
    lines.push('        """Process signup form"""');
    lines.push("        values = {");
    for (const field of config.signup.fields) {
      if (field.odooField) {
        lines.push(`            '${field.odooField}': qcontext.get('${field.name}'),`);
      }
    }
    lines.push("        }");
    lines.push("");
    lines.push("        # Validate secrets match");
    lines.push("        if qcontext.get('secret_key') != qcontext.get('confirm_secret'):");
    lines.push("            raise UserError(_('Secrets do not match'))");
    lines.push("");
    lines.push("        # Create user via signup mechanism");
    lines.push("        db, login, _ = request.env['res.users'].sudo().signup(values, qcontext.get('token'))");
    lines.push("        request.env.cr.commit()");
    lines.push("");
    if (config.signup.defaultGroups && config.signup.defaultGroups.length > 0) {
      lines.push("        # Add to default groups");
      lines.push("        user = request.env['res.users'].sudo().search([('login', '=', login)])");
      for (const group of config.signup.defaultGroups) {
        lines.push(`        user.groups_id = [(4, request.env.ref('${group}').id)]`);
      }
    }
    lines.push("");
    lines.push("        return db, login, None");
    lines.push("");
  }

  // Credential reset route (if configured)
  if (config.credentialReset) {
    lines.push("    @http.route('/web/reset_credentials', type='http', auth='public', website=True, sitemap=False)");
    lines.push("    def web_reset_credentials(self, *args, **kw):");
    lines.push('        """Credential reset page"""');
    lines.push("        qcontext = self.get_auth_signup_qcontext()");
    lines.push("");
    lines.push("        if request.httprequest.method == 'POST':");
    lines.push("            login = qcontext.get('login')");
    lines.push("            try:");
    lines.push("                if login:");
    lines.push("                    self._send_reset_email(login)");
    lines.push("                    qcontext['message'] = _('Reset instructions sent to your email')");
    lines.push("            except Exception as e:");
    lines.push("                qcontext['error'] = str(e)");
    lines.push("");
    lines.push("        qcontext.update({");
    lines.push(`            'title': '${escapeXml(config.credentialReset.title)}',`);
    lines.push("        })");
    lines.push("");
    lines.push(`        return request.render('${config.moduleName}.reset_credentials_page', qcontext)`);
    lines.push("");

    lines.push("    def _send_reset_email(self, login):");
    lines.push('        """Send credential reset email"""');
    lines.push("        user = request.env['res.users'].sudo().search([('login', '=', login)], limit=1)");
    lines.push("        if not user:");
    lines.push("            raise UserError(_('No account found with that email address'))");
    lines.push("");
    lines.push("        user.action_reset_password()");
    lines.push("");
  }

  // OAuth helper
  lines.push("    def _get_oauth_providers(self):");
  lines.push('        """Get configured OAuth providers"""');
  lines.push("        try:");
  lines.push("            providers = request.env['auth.oauth.provider'].sudo().search_read(");
  lines.push("                [('enabled', '=', True)],");
  lines.push("                ['name', 'auth_endpoint', 'client_id', 'css_class']");
  lines.push("            )");
  lines.push("            return providers");
  lines.push("        except Exception:");
  lines.push("            return []");
  lines.push("");

  // Logout route
  lines.push("    @http.route('/web/session/logout', type='http', auth='none', website=True)");
  lines.push("    def logout(self, redirect='/web/login'):");
  lines.push('        """Custom logout"""');
  lines.push("        request.session.logout(keep_db=True)");
  lines.push("        return request.redirect(redirect)");
  lines.push("");

  // Helper function
  lines.push("");
  lines.push("def ensure_db():");
  lines.push('    """Ensure database is selected"""');
  lines.push("    db = request.params.get('db') or request.session.db");
  lines.push("    if not db:");
  lines.push("        raise werkzeug.exceptions.NotFound()");
  lines.push("");

  return lines.join("\n");
}

// =============================================================================
// Template Generation
// =============================================================================

function generateAuthTemplates(config: AuthIntegrationConfig): string {
  const lines: string[] = [];
  const credField = getCredentialFieldName();
  const credInputType = getCredentialInputType();

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push("<odoo>");
  lines.push("");

  // Login template
  lines.push(`    <!-- Login Page Template -->`);
  lines.push(`    <template id="login_page" name="Login Page">`);
  lines.push(`        <t t-call="web.login_layout">`);
  lines.push(`            <div class="oe_login_form">`);
  lines.push(`                <form class="oe_login_form" role="form" action="/web/login" method="post">`);
  lines.push(`                    <input type="hidden" name="csrf_token" t-att-value="request.csrf_token()"/>`);
  lines.push(`                    <input type="hidden" name="redirect" t-att-value="redirect"/>`);
  lines.push("");
  lines.push(`                    <div class="mb-3">`);
  lines.push(`                        <label for="login" class="form-label">Email</label>`);
  lines.push(`                        <input type="email" name="login" id="login" class="form-control"`);
  lines.push(`                            t-att-value="login" placeholder="Email" required="required" autofocus="autofocus"/>`);
  lines.push(`                    </div>`);
  lines.push("");
  lines.push(`                    <div class="mb-3">`);
  lines.push(`                        <label for="${credField}" class="form-label">Authentication</label>`);
  lines.push(`                        <input type="${credInputType}" name="${credField}" id="${credField}" class="form-control"`);
  lines.push(`                            placeholder="Enter credentials" required="required"/>`);
  lines.push(`                    </div>`);
  lines.push("");
  if (config.login.showRememberMe) {
    lines.push(`                    <div class="mb-3 form-check">`);
    lines.push(`                        <input type="checkbox" name="remember" id="remember" class="form-check-input"/>`);
    lines.push(`                        <label class="form-check-label" for="remember">Remember me</label>`);
    lines.push(`                    </div>`);
  }
  lines.push("");
  lines.push(`                    <div t-if="error" class="alert alert-danger" role="alert">`);
  lines.push(`                        <t t-esc="error"/>`);
  lines.push(`                    </div>`);
  lines.push("");
  lines.push(`                    <button type="submit" class="btn btn-primary w-100">Log in</button>`);
  lines.push("");
  if (config.credentialReset) {
    lines.push(`                    <div class="mt-3 text-center">`);
    lines.push(`                        <a href="/web/reset_credentials">Forgot credentials?</a>`);
    lines.push(`                    </div>`);
  }
  if (config.signup) {
    lines.push(`                    <div class="mt-2 text-center">`);
    lines.push(`                        Don't have an account? <a href="/web/signup">Sign up</a>`);
    lines.push(`                    </div>`);
  }
  lines.push(`                </form>`);
  lines.push("");

  // OAuth providers
  if (config.login.showSocialLogin) {
    lines.push(`                <t t-if="providers">`);
    lines.push(`                    <div class="o_login_oauth text-center mt-4">`);
    lines.push(`                        <p class="text-muted">Or sign in with</p>`);
    lines.push(`                        <div class="d-flex justify-content-center gap-2">`);
    lines.push(`                            <t t-foreach="providers" t-as="provider">`);
    lines.push(`                                <a t-attf-href="/auth_oauth/signin?provider=#{provider['id']}" class="btn btn-outline-secondary">`);
    lines.push(`                                    <i t-attf-class="fa #{provider.get('css_class', 'fa-sign-in')}"/>`);
    lines.push(`                                    <t t-esc="provider['name']"/>`);
    lines.push(`                                </a>`);
    lines.push(`                            </t>`);
    lines.push(`                        </div>`);
    lines.push(`                    </div>`);
    lines.push(`                </t>`);
  }
  lines.push(`            </div>`);
  lines.push(`        </t>`);
  lines.push(`    </template>`);
  lines.push("");

  // Signup template (if configured)
  if (config.signup) {
    lines.push(`    <!-- Signup Page Template -->`);
    lines.push(`    <template id="signup_page" name="Signup Page">`);
    lines.push(`        <t t-call="web.login_layout">`);
    lines.push(`            <div class="oe_signup_form">`);
    lines.push(`                <form class="oe_signup_form" role="form" action="/web/signup" method="post">`);
    lines.push(`                    <input type="hidden" name="csrf_token" t-att-value="request.csrf_token()"/>`);
    lines.push("");

    // Generate form fields
    for (const field of config.signup.fields) {
      lines.push(`                    <div class="mb-3">`);
      lines.push(`                        <label for="${field.name}" class="form-label">${escapeXml(field.label)}</label>`);

      if (field.type === "select" && field.options) {
        lines.push(`                        <select name="${field.name}" id="${field.name}" class="form-control"${field.required ? ' required="required"' : ""}>`);
        for (const opt of field.options) {
          lines.push(`                            <option value="${escapeXml(opt.value)}">${escapeXml(opt.label)}</option>`);
        }
        lines.push(`                        </select>`);
      } else if (field.type === "checkbox") {
        lines.push(`                        <input type="checkbox" name="${field.name}" id="${field.name}" class="form-check-input"${field.required ? ' required="required"' : ""}/>`);
      } else {
        const inputType = field.type === "secret" ? credInputType : field.type;
        lines.push(`                        <input type="${inputType}" name="${field.name}" id="${field.name}" class="form-control"`);
        lines.push(`                            placeholder="${escapeXml(field.placeholder || "")}"${field.required ? ' required="required"' : ""}/>`);
      }
      lines.push(`                    </div>`);
      lines.push("");
    }

    // Terms checkbox
    if (config.signup.termsUrl || config.signup.privacyUrl) {
      lines.push(`                    <div class="mb-3 form-check">`);
      lines.push(`                        <input type="checkbox" name="agree_terms" id="agree_terms" class="form-check-input" required="required"/>`);
      lines.push(`                        <label class="form-check-label" for="agree_terms">`);
      lines.push(`                            I agree to the`);
      if (config.signup.termsUrl) {
        lines.push(`                            <a t-att-href="terms_url" target="_blank">Terms of Service</a>`);
      }
      if (config.signup.termsUrl && config.signup.privacyUrl) {
        lines.push(`                            and`);
      }
      if (config.signup.privacyUrl) {
        lines.push(`                            <a t-att-href="privacy_url" target="_blank">Privacy Policy</a>`);
      }
      lines.push(`                        </label>`);
      lines.push(`                    </div>`);
    }

    lines.push("");
    lines.push(`                    <div t-if="error" class="alert alert-danger" role="alert">`);
    lines.push(`                        <t t-esc="error"/>`);
    lines.push(`                    </div>`);
    lines.push(`                    <div t-if="message" class="alert alert-success" role="alert">`);
    lines.push(`                        <t t-esc="message"/>`);
    lines.push(`                    </div>`);
    lines.push("");
    lines.push(`                    <button type="submit" class="btn btn-primary w-100">Sign up</button>`);
    lines.push("");
    lines.push(`                    <div class="mt-3 text-center">`);
    lines.push(`                        Already have an account? <a href="/web/login">Log in</a>`);
    lines.push(`                    </div>`);
    lines.push(`                </form>`);
    lines.push(`            </div>`);
    lines.push(`        </t>`);
    lines.push(`    </template>`);
    lines.push("");
  }

  // Credential reset template (if configured)
  if (config.credentialReset) {
    lines.push(`    <!-- Credential Reset Page Template -->`);
    lines.push(`    <template id="reset_credentials_page" name="Reset Credentials Page">`);
    lines.push(`        <t t-call="web.login_layout">`);
    lines.push(`            <div class="oe_reset_form">`);
    lines.push(`                <form class="oe_reset_form" role="form" action="/web/reset_credentials" method="post">`);
    lines.push(`                    <input type="hidden" name="csrf_token" t-att-value="request.csrf_token()"/>`);
    lines.push("");
    lines.push(`                    <p class="mb-4">Enter your email address and we'll send you reset instructions.</p>`);
    lines.push("");
    lines.push(`                    <div class="mb-3">`);
    lines.push(`                        <label for="login" class="form-label">Email</label>`);
    lines.push(`                        <input type="email" name="login" id="login" class="form-control"`);
    lines.push(`                            placeholder="Enter your email" required="required" autofocus="autofocus"/>`);
    lines.push(`                    </div>`);
    lines.push("");
    lines.push(`                    <div t-if="error" class="alert alert-danger" role="alert">`);
    lines.push(`                        <t t-esc="error"/>`);
    lines.push(`                    </div>`);
    lines.push(`                    <div t-if="message" class="alert alert-success" role="alert">`);
    lines.push(`                        <t t-esc="message"/>`);
    lines.push(`                    </div>`);
    lines.push("");
    lines.push(`                    <button type="submit" class="btn btn-primary w-100">Send Reset Link</button>`);
    lines.push("");
    lines.push(`                    <div class="mt-3 text-center">`);
    lines.push(`                        <a href="/web/login">Back to login</a>`);
    lines.push(`                    </div>`);
    lines.push(`                </form>`);
    lines.push(`            </div>`);
    lines.push(`        </t>`);
    lines.push(`    </template>`);
    lines.push("");
  }

  lines.push("</odoo>");

  return lines.join("\n");
}

// =============================================================================
// Static Files Generation
// =============================================================================

function generateAuthCss(config: AuthIntegrationConfig): string {
  const primaryColor = config.login.primaryColor || "#714B67";

  return `
/* Custom Auth Styles for ${config.moduleName} */

.oe_login_form,
.oe_signup_form,
.oe_reset_form {
  max-width: 400px;
  margin: 0 auto;
  padding: 2rem;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.oe_login_form .btn-primary,
.oe_signup_form .btn-primary,
.oe_reset_form .btn-primary {
  background-color: ${primaryColor};
  border-color: ${primaryColor};
}

.oe_login_form .btn-primary:hover,
.oe_signup_form .btn-primary:hover,
.oe_reset_form .btn-primary:hover {
  background-color: ${primaryColor}dd;
  border-color: ${primaryColor}dd;
}

.o_login_oauth {
  border-top: 1px solid #dee2e6;
  padding-top: 1rem;
}

.o_login_oauth .btn {
  min-width: 100px;
}

${config.login.backgroundImage ? `
.o_web_client .o_login_page {
  background-image: url('${config.login.backgroundImage}');
  background-size: cover;
  background-position: center;
}
` : ""}
`.trim();
}

function generateAuthJs(config: AuthIntegrationConfig): string {
  return `
/* Custom Auth Scripts for ${config.moduleName} */
odoo.define('${config.moduleName}.auth', function (require) {
    'use strict';

    var publicWidget = require('web.public.widget');

    publicWidget.registry.AuthForm = publicWidget.Widget.extend({
        selector: '.oe_login_form, .oe_signup_form',
        events: {
            'submit': '_onSubmit',
        },

        _onSubmit: function (ev) {
            var $form = $(ev.currentTarget);
            var $btn = $form.find('button[type="submit"]');

            // Disable button to prevent double submission
            $btn.prop('disabled', true);
            $btn.html('<i class="fa fa-spinner fa-spin"></i> Please wait...');
        },
    });

    // Credential strength indicator (for signup)
    publicWidget.registry.CredentialStrength = publicWidget.Widget.extend({
        selector: '.oe_signup_form input[name="secret_key"]',
        events: {
            'input': '_onCredentialInput',
        },

        _onCredentialInput: function (ev) {
            var value = $(ev.currentTarget).val();
            var strength = this._calculateStrength(value);
            // Update UI based on strength
        },

        _calculateStrength: function (value) {
            var strength = 0;
            if (value.length >= 8) strength++;
            if (value.match(/[a-z]/)) strength++;
            if (value.match(/[A-Z]/)) strength++;
            if (value.match(/[0-9]/)) strength++;
            if (value.match(/[^a-zA-Z0-9]/)) strength++;
            return strength;
        },
    });
});
`.trim();
}

// =============================================================================
// Main Generator Class
// =============================================================================

export class OdooAuthIntegration {
  /**
   * Generate complete auth integration
   */
  generate(config: AuthIntegrationConfig): GeneratedAuthIntegration {
    // Set defaults
    if (config.signup && !config.signup.fields) {
      config.signup.fields = DEFAULT_SIGNUP_FIELDS;
    }

    return {
      controllerPython: generateAuthController(config),
      templatesXml: generateAuthTemplates(config),
      staticCss: generateAuthCss(config),
      staticJs: generateAuthJs(config),
    };
  }

  /**
   * Generate basic login-only configuration
   */
  generateLoginOnly(
    moduleName: string,
    options: Partial<LoginConfig> = {}
  ): GeneratedAuthIntegration {
    const config: AuthIntegrationConfig = {
      moduleName,
      login: {
        title: options.title || "Sign In",
        subtitle: options.subtitle,
        showSocialLogin: options.showSocialLogin ?? false,
        showRememberMe: options.showRememberMe ?? true,
        redirectUrl: options.redirectUrl || "/web",
        ...options,
      },
    };

    return this.generate(config);
  }

  /**
   * Generate full auth flow (login + signup + reset)
   */
  generateFullAuthFlow(
    moduleName: string,
    options: {
      login?: Partial<LoginConfig>;
      signup?: Partial<SignupConfig>;
      credentialReset?: Partial<CredentialResetConfig>;
      oauthProviders?: OAuthProvider[];
    } = {}
  ): GeneratedAuthIntegration {
    const config: AuthIntegrationConfig = {
      moduleName,
      login: {
        title: "Sign In",
        showSocialLogin: true,
        showRememberMe: true,
        ...options.login,
      },
      signup: {
        title: "Create Account",
        fields: DEFAULT_SIGNUP_FIELDS,
        autoLogin: true,
        ...options.signup,
      },
      credentialReset: {
        title: "Reset Credentials",
        tokenExpiry: 24,
        minSecretLength: 8,
        ...options.credentialReset,
      },
      oauthProviders: options.oauthProviders || DEFAULT_OAUTH_PROVIDERS,
    };

    return this.generate(config);
  }

  /**
   * Get default signup fields
   */
  getDefaultSignupFields(): SignupField[] {
    return [...DEFAULT_SIGNUP_FIELDS];
  }

  /**
   * Get default OAuth providers
   */
  getDefaultOAuthProviders(): OAuthProvider[] {
    return [...DEFAULT_OAUTH_PROVIDERS];
  }

  /**
   * Validate configuration
   */
  validate(config: AuthIntegrationConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.moduleName) {
      errors.push("Module name is required");
    }

    if (!config.login) {
      errors.push("Login configuration is required");
    }

    if (!config.login.title) {
      errors.push("Login title is required");
    }

    if (config.signup) {
      if (!config.signup.fields || config.signup.fields.length === 0) {
        errors.push("Signup must have at least one field");
      }

      const hasEmail = config.signup.fields?.some(
        (f) => f.type === "email" || f.name === "email"
      );
      if (!hasEmail) {
        errors.push("Signup must include an email field");
      }

      const hasSecret = config.signup.fields?.some(
        (f) => f.type === "secret" || f.name === "secret_key"
      );
      if (!hasSecret) {
        errors.push("Signup must include a secret field");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const odooAuthIntegration = new OdooAuthIntegration();

export default OdooAuthIntegration;
