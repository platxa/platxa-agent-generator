/**
 * ProjectKnowledge Schema
 *
 * Comprehensive schema for project-specific knowledge that guides AI generation.
 * Includes sections for guidelines, brand assets, coding conventions, personas, and security.
 *
 * Feature #30: Custom Knowledge Schema
 */

import { z } from "zod";

// =============================================================================
// Guidelines Section
// =============================================================================

/**
 * Design guidelines for the project
 */
export const DesignGuidelinesSchema = z.object({
  /** Overall design philosophy/approach */
  philosophy: z.string().optional(),
  /** Visual style preferences (e.g., "minimal", "playful", "corporate") */
  visualStyle: z.string().optional(),
  /** Layout preferences */
  layoutPreferences: z.array(z.string()).optional(),
  /** Component style guidelines */
  componentGuidelines: z.array(z.string()).optional(),
  /** Animation/motion preferences */
  motionGuidelines: z.string().optional(),
  /** Responsive design approach */
  responsiveStrategy: z.string().optional(),
  /** Additional design notes */
  notes: z.array(z.string()).optional(),
});

/**
 * Content guidelines for the project
 */
export const ContentGuidelinesSchema = z.object({
  /** Writing tone (e.g., "formal", "casual", "friendly") */
  tone: z.string().optional(),
  /** Voice characteristics */
  voice: z.string().optional(),
  /** Words/phrases to use */
  preferredTerms: z.array(z.string()).optional(),
  /** Words/phrases to avoid */
  avoidedTerms: z.array(z.string()).optional(),
  /** Maximum content lengths */
  lengthLimits: z.object({
    headline: z.number().optional(),
    paragraph: z.number().optional(),
    buttonText: z.number().optional(),
  }).optional(),
  /** Localization notes */
  localization: z.string().optional(),
});

/**
 * Combined guidelines section
 */
export const GuidelinesSchema = z.object({
  /** Design-related guidelines */
  design: DesignGuidelinesSchema.optional(),
  /** Content/copy guidelines */
  content: ContentGuidelinesSchema.optional(),
  /** General project guidelines */
  general: z.array(z.string()).optional(),
  /** Do's - things to always do */
  dos: z.array(z.string()).optional(),
  /** Don'ts - things to never do */
  donts: z.array(z.string()).optional(),
});

// =============================================================================
// Brand Assets Section
// =============================================================================

/**
 * Logo asset definition
 */
export const LogoAssetSchema = z.object({
  /** Asset name/identifier */
  name: z.string(),
  /** URL or path to the asset */
  url: z.string(),
  /** Logo variant (primary, secondary, icon, wordmark) */
  variant: z.enum(["primary", "secondary", "icon", "wordmark", "monochrome"]).optional(),
  /** Format (svg, png, etc.) */
  format: z.string().optional(),
  /** Usage context */
  usage: z.string().optional(),
  /** Minimum size requirements */
  minSize: z.object({
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
  /** Clear space requirements */
  clearSpace: z.string().optional(),
});

/**
 * Color definition with semantic meaning
 */
export const BrandColorSchema = z.object({
  /** Color name */
  name: z.string(),
  /** Hex value */
  hex: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  /** RGB value */
  rgb: z.object({
    r: z.number().min(0).max(255),
    g: z.number().min(0).max(255),
    b: z.number().min(0).max(255),
  }).optional(),
  /** OKLCH value for perceptual uniformity */
  oklch: z.object({
    l: z.number().min(0).max(1),
    c: z.number().min(0).max(0.5),
    h: z.number().min(0).max(360),
  }).optional(),
  /** Semantic role */
  role: z.enum([
    "primary",
    "secondary",
    "accent",
    "background",
    "surface",
    "text",
    "error",
    "warning",
    "success",
    "info",
    "neutral",
  ]).optional(),
  /** Usage description */
  usage: z.string().optional(),
  /** Accessible text color for this background */
  contrastText: z.string().optional(),
});

/**
 * Typography definition
 */
export const BrandTypographySchema = z.object({
  /** Font family for headings */
  headingFamily: z.string(),
  /** Font family for body text */
  bodyFamily: z.string(),
  /** Font family for code/monospace */
  monoFamily: z.string().optional(),
  /** Font weights available */
  weights: z.array(z.number()).optional(),
  /** Type scale ratio (e.g., 1.25 for major third) */
  scaleRatio: z.number().optional(),
  /** Base font size in pixels */
  baseFontSize: z.number().optional(),
  /** Line height for body text */
  bodyLineHeight: z.number().optional(),
  /** Line height for headings */
  headingLineHeight: z.number().optional(),
  /** Font sources/CDN URLs */
  fontSources: z.array(z.string()).optional(),
});

/**
 * Complete brand assets section
 */
export const BrandAssetsSchema = z.object({
  /** Brand name */
  brandName: z.string(),
  /** Brand tagline */
  tagline: z.string().optional(),
  /** Logo assets */
  logos: z.array(LogoAssetSchema).optional(),
  /** Brand colors */
  colors: z.array(BrandColorSchema).optional(),
  /** Typography settings */
  typography: BrandTypographySchema.optional(),
  /** Favicon URL */
  favicon: z.string().optional(),
  /** Social media images */
  socialImages: z.object({
    ogImage: z.string().optional(),
    twitterCard: z.string().optional(),
  }).optional(),
  /** Brand guidelines document URL */
  guidelinesUrl: z.string().optional(),
});

// =============================================================================
// Coding Conventions Section
// =============================================================================

/**
 * File/folder naming conventions
 */
export const NamingConventionSchema = z.object({
  /** Component naming (PascalCase, kebab-case, etc.) */
  components: z.enum(["PascalCase", "camelCase", "kebab-case", "snake_case"]).optional(),
  /** File naming */
  files: z.enum(["PascalCase", "camelCase", "kebab-case", "snake_case"]).optional(),
  /** CSS class naming (BEM, utility-first, etc.) */
  cssClasses: z.string().optional(),
  /** Variable naming */
  variables: z.enum(["camelCase", "PascalCase", "snake_case", "SCREAMING_SNAKE_CASE"]).optional(),
  /** Type/Interface naming */
  types: z.enum(["PascalCase", "IPascalCase"]).optional(),
  /** Constants naming */
  constants: z.enum(["SCREAMING_SNAKE_CASE", "camelCase", "PascalCase"]).optional(),
});

/**
 * Code style preferences
 */
export const CodeStyleSchema = z.object({
  /** Indentation (spaces or tabs) */
  indentation: z.enum(["spaces", "tabs"]).optional(),
  /** Indent size */
  indentSize: z.number().optional(),
  /** Quote style */
  quotes: z.enum(["single", "double"]).optional(),
  /** Semicolons */
  semicolons: z.boolean().optional(),
  /** Trailing commas */
  trailingCommas: z.enum(["none", "es5", "all"]).optional(),
  /** Max line length */
  maxLineLength: z.number().optional(),
  /** Import order preferences */
  importOrder: z.array(z.string()).optional(),
});

/**
 * Framework-specific conventions
 */
export const FrameworkConventionsSchema = z.object({
  /** React-specific conventions */
  react: z.object({
    /** Prefer functional components */
    functionalComponents: z.boolean().optional(),
    /** Hook naming prefix */
    hookPrefix: z.string().optional(),
    /** State management approach */
    stateManagement: z.string().optional(),
    /** Component file structure */
    componentStructure: z.string().optional(),
  }).optional(),
  /** CSS/styling conventions */
  styling: z.object({
    /** Styling approach (CSS modules, Tailwind, styled-components, etc.) */
    approach: z.string().optional(),
    /** CSS variable naming */
    variableNaming: z.string().optional(),
    /** Utility class preferences */
    utilityClasses: z.boolean().optional(),
  }).optional(),
  /** Testing conventions */
  testing: z.object({
    /** Test file naming pattern */
    filePattern: z.string().optional(),
    /** Testing library preferences */
    libraries: z.array(z.string()).optional(),
    /** Coverage requirements */
    coverageThreshold: z.number().optional(),
  }).optional(),
});

/**
 * Complete coding conventions section
 */
export const CodingConventionsSchema = z.object({
  /** Naming conventions */
  naming: NamingConventionSchema.optional(),
  /** Code style */
  style: CodeStyleSchema.optional(),
  /** Framework-specific conventions */
  framework: FrameworkConventionsSchema.optional(),
  /** File organization patterns */
  fileOrganization: z.string().optional(),
  /** Comment style requirements */
  commentStyle: z.string().optional(),
  /** Documentation requirements */
  documentation: z.object({
    /** Require JSDoc comments */
    requireJsdoc: z.boolean().optional(),
    /** README requirements */
    readmeTemplate: z.string().optional(),
  }).optional(),
  /** Additional conventions as free-form rules */
  additionalRules: z.array(z.string()).optional(),
});

// =============================================================================
// Personas Section
// =============================================================================

/**
 * User persona definition
 */
export const PersonaSchema = z.object({
  /** Persona identifier */
  id: z.string(),
  /** Persona name */
  name: z.string(),
  /** Brief description */
  description: z.string(),
  /** Demographics */
  demographics: z.object({
    ageRange: z.string().optional(),
    occupation: z.string().optional(),
    location: z.string().optional(),
    techSavviness: z.enum(["low", "medium", "high"]).optional(),
  }).optional(),
  /** Goals and motivations */
  goals: z.array(z.string()).optional(),
  /** Pain points and frustrations */
  painPoints: z.array(z.string()).optional(),
  /** Behaviors and preferences */
  behaviors: z.array(z.string()).optional(),
  /** Preferred devices/platforms */
  devices: z.array(z.string()).optional(),
  /** Accessibility needs */
  accessibilityNeeds: z.array(z.string()).optional(),
  /** Quote that represents this persona */
  quote: z.string().optional(),
  /** Avatar/image URL */
  avatar: z.string().optional(),
  /** Priority level for design decisions */
  priority: z.enum(["primary", "secondary", "tertiary"]).optional(),
});

/**
 * Complete personas section
 */
export const PersonasSchema = z.object({
  /** List of user personas */
  personas: z.array(PersonaSchema),
  /** Target audience summary */
  targetAudience: z.string().optional(),
  /** Accessibility compliance level */
  accessibilityLevel: z.enum(["A", "AA", "AAA"]).optional(),
  /** Internationalization requirements */
  i18nRequirements: z.array(z.string()).optional(),
});

// =============================================================================
// Security Section
// =============================================================================

/**
 * Authentication requirements
 */
export const AuthenticationSchema = z.object({
  /** Authentication methods supported */
  methods: z.array(z.enum([
    "password",
    "oauth",
    "saml",
    "magic-link",
    "passkey",
    "mfa",
    "sso",
  ])).optional(),
  /** Session configuration */
  session: z.object({
    /** Session timeout in minutes */
    timeout: z.number().optional(),
    /** Refresh token enabled */
    refreshTokens: z.boolean().optional(),
    /** Secure cookie requirements */
    secureCookies: z.boolean().optional(),
  }).optional(),
  /** Password requirements */
  passwordPolicy: z.object({
    minLength: z.number().optional(),
    requireUppercase: z.boolean().optional(),
    requireLowercase: z.boolean().optional(),
    requireNumbers: z.boolean().optional(),
    requireSymbols: z.boolean().optional(),
  }).optional(),
});

/**
 * Data handling requirements
 */
export const DataHandlingSchema = z.object({
  /** Data classification levels */
  classificationLevels: z.array(z.string()).optional(),
  /** PII handling requirements */
  piiHandling: z.string().optional(),
  /** Data retention policy */
  retentionPolicy: z.string().optional(),
  /** Encryption requirements */
  encryption: z.object({
    atRest: z.boolean().optional(),
    inTransit: z.boolean().optional(),
    algorithm: z.string().optional(),
  }).optional(),
  /** GDPR compliance requirements */
  gdprCompliance: z.boolean().optional(),
  /** Other compliance standards */
  complianceStandards: z.array(z.string()).optional(),
});

/**
 * Input validation requirements
 */
export const InputValidationSchema = z.object({
  /** XSS prevention enabled */
  xssPrevention: z.boolean().optional(),
  /** CSRF protection enabled */
  csrfProtection: z.boolean().optional(),
  /** SQL injection prevention */
  sqlInjectionPrevention: z.boolean().optional(),
  /** Input sanitization library */
  sanitizationLibrary: z.string().optional(),
  /** File upload restrictions */
  fileUpload: z.object({
    allowedTypes: z.array(z.string()).optional(),
    maxSize: z.number().optional(),
    scanForMalware: z.boolean().optional(),
  }).optional(),
});

/**
 * Complete security section
 */
export const SecuritySchema = z.object({
  /** Authentication requirements */
  authentication: AuthenticationSchema.optional(),
  /** Data handling requirements */
  dataHandling: DataHandlingSchema.optional(),
  /** Input validation requirements */
  inputValidation: InputValidationSchema.optional(),
  /** Content Security Policy */
  csp: z.string().optional(),
  /** CORS configuration */
  cors: z.object({
    allowedOrigins: z.array(z.string()).optional(),
    allowedMethods: z.array(z.string()).optional(),
    allowCredentials: z.boolean().optional(),
  }).optional(),
  /** Rate limiting */
  rateLimiting: z.object({
    enabled: z.boolean().optional(),
    requestsPerMinute: z.number().optional(),
  }).optional(),
  /** Security headers to include */
  securityHeaders: z.array(z.string()).optional(),
  /** Audit logging requirements */
  auditLogging: z.boolean().optional(),
  /** Vulnerability scanning */
  vulnerabilityScanning: z.boolean().optional(),
  /** Additional security notes */
  notes: z.array(z.string()).optional(),
});

// =============================================================================
// Main ProjectKnowledge Schema
// =============================================================================

/**
 * Complete ProjectKnowledge schema
 */
export const ProjectKnowledgeSchema = z.object({
  /** Schema version for migrations */
  version: z.string().default("1.0.0"),
  /** Project identifier */
  projectId: z.string(),
  /** Last updated timestamp */
  updatedAt: z.string().datetime().optional(),
  /** Project guidelines */
  guidelines: GuidelinesSchema.optional(),
  /** Brand assets and visual identity */
  brandAssets: BrandAssetsSchema.optional(),
  /** Coding conventions and standards */
  codingConventions: CodingConventionsSchema.optional(),
  /** User personas and target audience */
  personas: PersonasSchema.optional(),
  /** Security requirements and policies */
  security: SecuritySchema.optional(),
  /** Custom metadata */
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// TypeScript Types (exported)
// =============================================================================

export type DesignGuidelines = z.infer<typeof DesignGuidelinesSchema>;
export type ContentGuidelines = z.infer<typeof ContentGuidelinesSchema>;
export type Guidelines = z.infer<typeof GuidelinesSchema>;

export type LogoAsset = z.infer<typeof LogoAssetSchema>;
export type BrandColor = z.infer<typeof BrandColorSchema>;
export type BrandTypography = z.infer<typeof BrandTypographySchema>;
export type BrandAssets = z.infer<typeof BrandAssetsSchema>;

export type NamingConvention = z.infer<typeof NamingConventionSchema>;
export type CodeStyle = z.infer<typeof CodeStyleSchema>;
export type FrameworkConventions = z.infer<typeof FrameworkConventionsSchema>;
export type CodingConventions = z.infer<typeof CodingConventionsSchema>;

export type Persona = z.infer<typeof PersonaSchema>;
export type Personas = z.infer<typeof PersonasSchema>;

export type Authentication = z.infer<typeof AuthenticationSchema>;
export type DataHandling = z.infer<typeof DataHandlingSchema>;
export type InputValidation = z.infer<typeof InputValidationSchema>;
export type Security = z.infer<typeof SecuritySchema>;

export type ProjectKnowledge = z.infer<typeof ProjectKnowledgeSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate a ProjectKnowledge object
 */
export function validateProjectKnowledge(data: unknown): {
  success: boolean;
  data?: ProjectKnowledge;
  errors?: z.ZodError;
} {
  const result = ProjectKnowledgeSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Create an empty ProjectKnowledge object with required fields
 */
export function createEmptyProjectKnowledge(projectId: string): ProjectKnowledge {
  return {
    version: "1.0.0",
    projectId,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Merge partial knowledge into existing knowledge
 */
export function mergeProjectKnowledge(
  existing: ProjectKnowledge,
  partial: Partial<ProjectKnowledge>
): ProjectKnowledge {
  return {
    ...existing,
    ...partial,
    updatedAt: new Date().toISOString(),
    guidelines: partial.guidelines
      ? { ...existing.guidelines, ...partial.guidelines }
      : existing.guidelines,
    brandAssets: partial.brandAssets
      ? { ...existing.brandAssets, ...partial.brandAssets }
      : existing.brandAssets,
    codingConventions: partial.codingConventions
      ? { ...existing.codingConventions, ...partial.codingConventions }
      : existing.codingConventions,
    personas: partial.personas
      ? { ...existing.personas, ...partial.personas }
      : existing.personas,
    security: partial.security
      ? { ...existing.security, ...partial.security }
      : existing.security,
  };
}

// =============================================================================
// Re-export index
// =============================================================================

export default ProjectKnowledgeSchema;
