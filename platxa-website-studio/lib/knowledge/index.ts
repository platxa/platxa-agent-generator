/**
 * Knowledge Module
 *
 * Project-specific knowledge management for AI-guided generation.
 */

export {
  // Main schema
  ProjectKnowledgeSchema,

  // Section schemas
  GuidelinesSchema,
  DesignGuidelinesSchema,
  ContentGuidelinesSchema,
  BrandAssetsSchema,
  LogoAssetSchema,
  BrandColorSchema,
  BrandTypographySchema,
  CodingConventionsSchema,
  NamingConventionSchema,
  CodeStyleSchema,
  FrameworkConventionsSchema,
  PersonasSchema,
  PersonaSchema,
  SecuritySchema,
  AuthenticationSchema,
  DataHandlingSchema,
  InputValidationSchema,

  // Types
  type ProjectKnowledge,
  type Guidelines,
  type DesignGuidelines,
  type ContentGuidelines,
  type BrandAssets,
  type LogoAsset,
  type BrandColor,
  type BrandTypography,
  type CodingConventions,
  type NamingConvention,
  type CodeStyle,
  type FrameworkConventions,
  type Personas,
  type Persona,
  type Security,
  type Authentication,
  type DataHandling,
  type InputValidation,

  // Helpers
  validateProjectKnowledge,
  createEmptyProjectKnowledge,
  mergeProjectKnowledge,
} from "./schema";
