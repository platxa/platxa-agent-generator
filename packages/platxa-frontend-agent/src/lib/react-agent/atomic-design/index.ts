/**
 * Atomic Design Module
 *
 * Implements Atomic Design methodology for component organization:
 * - Atoms: Basic building blocks (buttons, inputs, labels)
 * - Molecules: Combinations of atoms (form fields, search bars)
 * - Organisms: Complex sections combining molecules
 * - Templates: Page-level layouts
 * - Pages: Specific instances with real content
 */

// Types
export type {
  AtomicLevel,
  AtomicClassification,
  ComponentMetadata,
  ComplexityIndicators,
  AtomTemplate,
  MoleculeTemplate,
  OrganismTemplate,
  TemplateConfig,
  PageConfig,
  AtomCategory,
  MoleculeCategory,
  OrganismCategory,
  TemplateCategory,
  PropDefinition,
  VariantDefinition,
  AccessibilityConfig,
  InteractionPattern,
  StructureDefinition,
  StateConfig,
  DataRequirement,
  LayoutDefinition,
  BreakpointConfig,
  SlotDefinition,
  PageMeta,
  RouteConfig,
  AtomicFolderStructure,
  AtomicGenerationOptions,
} from "./types"

// Classification functions
export {
  classifyComponent,
  classifyComponents,
  analyzeComplexity,
} from "./atomic-design"

// Template generators
export {
  generateAtomTemplate,
  generateMoleculeTemplate,
  generateOrganismTemplate,
  generateTemplateComponent,
} from "./atomic-design"

// Folder structure utilities
export {
  generateFolderStructure,
  getComponentPath,
  generateIndexFile,
} from "./atomic-design"
