/**
 * Plan Generator — Step-by-Step Implementation Plans from User Requests
 *
 * Analyzes user requests in Chat mode and generates structured implementation
 * plans with steps, affected files, complexity estimates, and dependencies.
 *
 * This is the core of Lovable's "plan before execute" paradigm.
 */

import type { ImplementationPlan, PlanStep } from "./chat-mode";

// =============================================================================
// Types
// =============================================================================

/** User request to be converted into a plan */
export interface PlanRequest {
  /** User's natural language request */
  message: string;
  /** Optional context about the current file/selection */
  context?: RequestContext;
  /** Optional constraints on the plan */
  constraints?: PlanConstraints;
}

/** Context for plan generation */
export interface RequestContext {
  /** Currently open file */
  currentFile?: string;
  /** Selected text or code */
  selection?: string;
  /** Recent files modified */
  recentFiles?: string[];
  /** Project type (e.g., "odoo-theme", "odoo-module") */
  projectType?: string;
  /** Available snippets/components */
  availableComponents?: string[];
}

/** Constraints on generated plans */
export interface PlanConstraints {
  /** Maximum number of steps */
  maxSteps?: number;
  /** Only modify certain file types */
  allowedFileTypes?: string[];
  /** Exclude certain directories */
  excludeDirs?: string[];
  /** Require tests for all changes */
  requireTests?: boolean;
  /** Maximum complexity level */
  maxComplexity?: "simple" | "moderate" | "complex";
}

/** Analysis of a user request */
export interface RequestAnalysis {
  /** Primary intent detected */
  intent: RequestIntent;
  /** Secondary intents */
  secondaryIntents: RequestIntent[];
  /** Entities extracted from request */
  entities: ExtractedEntity[];
  /** Detected file patterns */
  filePatterns: string[];
  /** Keywords that influenced analysis */
  keywords: string[];
  /** Confidence score (0-1) */
  confidence: number;
}

/** Types of user intents */
export type RequestIntent =
  | "create_component"
  | "modify_component"
  | "delete_component"
  | "add_feature"
  | "fix_bug"
  | "refactor"
  | "style_change"
  | "add_page"
  | "modify_page"
  | "configure"
  | "integrate"
  | "test"
  | "document"
  | "deploy"
  | "unknown";

/** Entity extracted from user request */
export interface ExtractedEntity {
  type: "component" | "page" | "style" | "file" | "feature" | "color" | "text" | "other";
  value: string;
  original: string;
}

/** Plan generation result */
export interface PlanGenerationResult {
  success: boolean;
  plan?: ImplementationPlan;
  analysis: RequestAnalysis;
  error?: string;
  suggestions?: string[];
}

/** Plan generator configuration */
export interface PlanGeneratorConfig {
  /** Default constraints */
  defaultConstraints: PlanConstraints;
  /** Enable automatic file detection */
  autoDetectFiles: boolean;
  /** Enable dependency analysis */
  analyzeDependencies: boolean;
  /** Minimum confidence to generate plan */
  minConfidence: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Default configuration */
export const DEFAULT_PLAN_CONFIG: PlanGeneratorConfig = {
  defaultConstraints: {
    maxSteps: 10,
    requireTests: false,
  },
  autoDetectFiles: true,
  analyzeDependencies: true,
  minConfidence: 0.3,
};

/** Intent detection patterns */
const INTENT_PATTERNS: Record<RequestIntent, RegExp[]> = {
  create_component: [
    /\b(create|add|new|build|make)\b.*\b(component|widget|snippet|section|block)\b/i,
    /\b(component|widget|snippet)\b.*\b(for|that|which)\b/i,
  ],
  modify_component: [
    /\b(change|modify|update|edit|alter)\b.*\b(component|widget|snippet)\b/i,
    /\b(component|widget|snippet)\b.*\b(should|needs to|must)\b/i,
  ],
  delete_component: [
    /\b(delete|remove|drop)\b.*\b(component|widget|snippet)\b/i,
  ],
  add_feature: [
    /\b(add|implement|include|enable)\b.*\b(feature|functionality|capability)\b/i,
    /\b(want|need|should have)\b.*\b(feature|ability)\b/i,
  ],
  fix_bug: [
    /\b(fix|repair|solve|resolve|debug)\b.*\b(bug|issue|problem|error)\b/i,
    /\b(not working|broken|fails|crashes)\b/i,
  ],
  refactor: [
    /\b(refactor|restructure|reorganize|clean up|improve)\b.*\b(code|structure)\b/i,
    /\b(make|code)\b.*\b(cleaner|better|more readable)\b/i,
  ],
  style_change: [
    /\b(change|modify|update)\b.*\b(style|color|font|spacing|layout)\b/i,
    /\b(make|should be)\b.*\b(bigger|smaller|darker|lighter|centered)\b/i,
    /\b(color|background|border|margin|padding)\b.*\b(to|should be)\b/i,
  ],
  add_page: [
    /\b(create|add|new|build)\b.*\b(page|view|screen|route)\b/i,
  ],
  modify_page: [
    /\b(change|modify|update|edit)\b.*\b(page|view|screen)\b/i,
  ],
  configure: [
    /\b(configure|setup|set up|config)\b/i,
    /\b(settings|options|preferences)\b/i,
  ],
  integrate: [
    /\b(integrate|connect|link|sync)\b.*\b(with|to)\b/i,
    /\b(api|service|database)\b.*\b(integration|connection)\b/i,
  ],
  test: [
    /\b(test|write tests|add tests|unit test)\b/i,
  ],
  document: [
    /\b(document|docs|readme|comment)\b/i,
  ],
  deploy: [
    /\b(deploy|publish|release|ship)\b/i,
  ],
  unknown: [],
};

/** Entity extraction patterns */
const ENTITY_PATTERNS: Array<{ type: ExtractedEntity["type"]; pattern: RegExp }> = [
  { type: "component", pattern: /\b(?:component|widget|snippet|section|block)\s+["']?(\w+)["']?/i },
  { type: "page", pattern: /\b(?:page|view|screen)\s+["']?(\w+)["']?/i },
  { type: "file", pattern: /["']([^"']+\.(ts|tsx|js|jsx|py|xml|scss|css))["']/i },
  { type: "color", pattern: /#([0-9a-fA-F]{3,8})\b/i },
  { type: "color", pattern: /\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey)\b/i },
  { type: "feature", pattern: /\b(?:feature|functionality)\s+["']?([^"',]+)["']?/i },
  { type: "text", pattern: /["']([^"']{3,50})["']/g },
];

// =============================================================================
// Plan ID Generator
// =============================================================================

let _planCounter = 0;
let _stepCounter = 0;

function generatePlanId(): string {
  return `plan_${Date.now()}_${++_planCounter}`;
}

function generateStepId(): string {
  return `step_${Date.now()}_${++_stepCounter}`;
}

/** Reset counters (for testing) */
export function resetPlanGeneratorCounters(): void {
  _planCounter = 0;
  _stepCounter = 0;
}

// =============================================================================
// Request Analysis
// =============================================================================

/**
 * Analyze a user request to extract intent, entities, and patterns.
 */
export function analyzeRequest(request: PlanRequest): RequestAnalysis {
  const message = request.message.toLowerCase();
  const intents: Array<{ intent: RequestIntent; score: number }> = [];

  // Score each intent based on pattern matches
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (intent === "unknown") continue;

    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        score += 1;
      }
    }

    if (score > 0) {
      intents.push({ intent: intent as RequestIntent, score });
    }
  }

  // Sort by score and get primary intent
  intents.sort((a, b) => b.score - a.score);
  const primaryIntent = intents[0]?.intent || "unknown";
  const secondaryIntents = intents.slice(1, 3).map((i) => i.intent);

  // Extract entities
  const entities = extractEntities(request.message);

  // Extract file patterns
  const filePatterns = extractFilePatterns(request.message, request.context);

  // Extract keywords
  const keywords = extractKeywords(request.message);

  // Calculate confidence
  const confidence = calculateConfidence(intents, entities, filePatterns);

  return {
    intent: primaryIntent,
    secondaryIntents,
    entities,
    filePatterns,
    keywords,
    confidence,
  };
}

/**
 * Extract entities from the request message.
 */
function extractEntities(message: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  for (const { type, pattern } of ENTITY_PATTERNS) {
    const regex = new RegExp(pattern, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(message)) !== null) {
      entities.push({
        type,
        value: match[1] || match[0],
        original: match[0],
      });
    }
  }

  return entities;
}

/**
 * Extract file patterns from message and context.
 */
function extractFilePatterns(message: string, context?: RequestContext): string[] {
  const patterns: string[] = [];

  // Extract explicit file references
  const fileMatches = message.match(/["']([^"']+\.[a-z]+)["']/gi) || [];
  for (const match of fileMatches) {
    patterns.push(match.replace(/["']/g, ""));
  }

  // Infer from component/page names
  const componentMatch = message.match(/\b(?:component|widget)\s+["']?(\w+)["']?/i);
  if (componentMatch) {
    patterns.push(`**/*${componentMatch[1]}*.{ts,tsx,js,jsx}`);
  }

  const pageMatch = message.match(/\b(?:page|view)\s+["']?(\w+)["']?/i);
  if (pageMatch) {
    patterns.push(`**/pages/*${pageMatch[1]}*.{ts,tsx,xml}`);
  }

  // Add context files
  if (context?.currentFile) {
    patterns.push(context.currentFile);
  }
  if (context?.recentFiles) {
    patterns.push(...context.recentFiles.slice(0, 3));
  }

  // Deduplicate
  return patterns.filter((p, i) => patterns.indexOf(p) === i);
}

/**
 * Extract important keywords from the message.
 */
function extractKeywords(message: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "to", "of",
    "in", "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "during", "before", "after", "above", "below", "between", "under",
    "again", "further", "then", "once", "here", "there", "when", "where",
    "why", "how", "all", "each", "few", "more", "most", "other", "some",
    "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
    "very", "just", "also", "now", "it", "its", "this", "that", "these",
    "those", "i", "me", "my", "we", "our", "you", "your", "he", "she",
    "they", "them", "their", "what", "which", "who", "whom", "and", "but",
    "if", "or", "because", "until", "while", "please", "want", "like",
  ]);

  const words = message
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Return unique keywords
  return words.filter((w, i) => words.indexOf(w) === i).slice(0, 10);
}

/**
 * Calculate confidence score for the analysis.
 */
function calculateConfidence(
  intents: Array<{ intent: RequestIntent; score: number }>,
  entities: ExtractedEntity[],
  filePatterns: string[]
): number {
  let confidence = 0;

  // Intent confidence
  if (intents.length > 0) {
    confidence += Math.min(intents[0].score * 0.2, 0.4);
  }

  // Entity confidence
  if (entities.length > 0) {
    confidence += Math.min(entities.length * 0.1, 0.3);
  }

  // File pattern confidence
  if (filePatterns.length > 0) {
    confidence += Math.min(filePatterns.length * 0.1, 0.2);
  }

  // Base confidence for having a message
  confidence += 0.1;

  return Math.min(confidence, 1);
}

// =============================================================================
// Plan Generation
// =============================================================================

/**
 * Generate an implementation plan from a user request.
 */
export function generatePlan(
  request: PlanRequest,
  config: PlanGeneratorConfig = DEFAULT_PLAN_CONFIG
): PlanGenerationResult {
  // Analyze the request
  const analysis = analyzeRequest(request);

  // Check confidence threshold
  if (analysis.confidence < config.minConfidence) {
    return {
      success: false,
      analysis,
      error: "Could not understand the request well enough to generate a plan",
      suggestions: [
        "Try being more specific about what you want to change",
        "Mention specific file names or component names",
        "Describe the expected outcome",
      ],
    };
  }

  // Generate steps based on intent
  const steps = generateStepsForIntent(analysis, request, config);

  // Apply constraints
  const constraints = { ...config.defaultConstraints, ...request.constraints };
  const constrainedSteps = applyConstraints(steps, constraints);

  // Calculate affected files
  const affectedFiles = calculateAffectedFiles(constrainedSteps, analysis);

  // Estimate complexity
  const complexity = estimateComplexity(constrainedSteps);

  // Create the plan
  const plan: ImplementationPlan = {
    id: generatePlanId(),
    title: generatePlanTitle(analysis),
    description: generatePlanDescription(analysis, request),
    steps: constrainedSteps,
    createdAt: Date.now(),
    estimatedComplexity: complexity,
    affectedFiles,
    requiresConfirmation: constrainedSteps.some((s) => s.estimatedImpact === "high"),
  };

  return {
    success: true,
    plan,
    analysis,
  };
}

/**
 * Generate steps based on the detected intent.
 */
function generateStepsForIntent(
  analysis: RequestAnalysis,
  request: PlanRequest,
  config: PlanGeneratorConfig
): PlanStep[] {
  const steps: PlanStep[] = [];

  switch (analysis.intent) {
    case "create_component":
      steps.push(...generateCreateComponentSteps(analysis, request));
      break;
    case "modify_component":
      steps.push(...generateModifyComponentSteps(analysis, request));
      break;
    case "style_change":
      steps.push(...generateStyleChangeSteps(analysis, request));
      break;
    case "add_page":
      steps.push(...generateAddPageSteps(analysis, request));
      break;
    case "fix_bug":
      steps.push(...generateFixBugSteps(analysis, request));
      break;
    case "add_feature":
      steps.push(...generateAddFeatureSteps(analysis, request));
      break;
    case "refactor":
      steps.push(...generateRefactorSteps(analysis, request));
      break;
    default:
      steps.push(...generateGenericSteps(analysis, request));
  }

  // Number the steps
  return steps.map((step, index) => ({
    ...step,
    order: index + 1,
  }));
}

/**
 * Generate steps for creating a component.
 */
function generateCreateComponentSteps(
  analysis: RequestAnalysis,
  request: PlanRequest
): PlanStep[] {
  const componentEntity = analysis.entities.find((e) => e.type === "component");
  const componentName = componentEntity?.value || "NewComponent";

  return [
    createStep("search_codebase", {
      description: `Search for existing similar components to ${componentName}`,
      params: { query: componentName, type: "component" },
      impact: "low",
      files: [],
    }),
    createStep("create_file", {
      description: `Create component file for ${componentName}`,
      params: { path: `components/${componentName}.tsx` },
      impact: "medium",
      files: [`components/${componentName}.tsx`],
    }),
    createStep("write_file", {
      description: `Write component implementation for ${componentName}`,
      params: { path: `components/${componentName}.tsx` },
      impact: "medium",
      files: [`components/${componentName}.tsx`],
    }),
    createStep("create_file", {
      description: `Create styles for ${componentName}`,
      params: { path: `components/${componentName}.scss` },
      impact: "low",
      files: [`components/${componentName}.scss`],
    }),
  ];
}

/**
 * Generate steps for modifying a component.
 */
function generateModifyComponentSteps(
  analysis: RequestAnalysis,
  request: PlanRequest
): PlanStep[] {
  const componentEntity = analysis.entities.find((e) => e.type === "component");
  const componentName = componentEntity?.value || "Component";

  return [
    createStep("search_codebase", {
      description: `Find ${componentName} component files`,
      params: { query: componentName },
      impact: "low",
      files: [],
    }),
    createStep("read_file", {
      description: `Read current ${componentName} implementation`,
      params: {},
      impact: "low",
      files: [],
    }),
    createStep("edit_file", {
      description: `Modify ${componentName} based on requirements`,
      params: {},
      impact: "medium",
      files: [],
    }),
  ];
}

/**
 * Generate steps for style changes.
 */
function generateStyleChangeSteps(
  analysis: RequestAnalysis,
  request: PlanRequest
): PlanStep[] {
  const colorEntities = analysis.entities.filter((e) => e.type === "color");

  return [
    createStep("search_codebase", {
      description: "Find relevant style files",
      params: { query: "styles", fileType: "scss" },
      impact: "low",
      files: [],
    }),
    createStep("read_file", {
      description: "Read current styles",
      params: {},
      impact: "low",
      files: [],
    }),
    createStep("edit_file", {
      description: `Update styles: ${colorEntities.map((e) => e.original).join(", ") || "as requested"}`,
      params: { colors: colorEntities.map((e) => e.value) },
      impact: "low",
      files: [],
    }),
  ];
}

/**
 * Generate steps for adding a page.
 */
function generateAddPageSteps(
  analysis: RequestAnalysis,
  request: PlanRequest
): PlanStep[] {
  const pageEntity = analysis.entities.find((e) => e.type === "page");
  const pageName = pageEntity?.value || "NewPage";

  return [
    createStep("create_file", {
      description: `Create page template for ${pageName}`,
      params: { path: `views/${pageName}.xml` },
      impact: "medium",
      files: [`views/${pageName}.xml`],
    }),
    createStep("create_file", {
      description: `Create page styles for ${pageName}`,
      params: { path: `static/src/scss/${pageName}.scss` },
      impact: "low",
      files: [`static/src/scss/${pageName}.scss`],
    }),
    createStep("edit_file", {
      description: "Register page in manifest",
      params: { path: "__manifest__.py" },
      impact: "medium",
      files: ["__manifest__.py"],
    }),
    createStep("edit_file", {
      description: "Add page to website menu",
      params: { path: "data/menu.xml" },
      impact: "low",
      files: ["data/menu.xml"],
    }),
  ];
}

/**
 * Generate steps for fixing a bug.
 */
function generateFixBugSteps(
  analysis: RequestAnalysis,
  request: PlanRequest
): PlanStep[] {
  return [
    createStep("search_codebase", {
      description: "Search for code related to the bug",
      params: { query: analysis.keywords.slice(0, 3).join(" ") },
      impact: "low",
      files: [],
    }),
    createStep("read_file", {
      description: "Read potentially affected files",
      params: {},
      impact: "low",
      files: [],
    }),
    createStep("inspect_logs", {
      description: "Check for error logs or stack traces",
      params: {},
      impact: "low",
      files: [],
    }),
    createStep("edit_file", {
      description: "Apply fix to resolve the issue",
      params: {},
      impact: "medium",
      files: [],
    }),
    createStep("run_tests", {
      description: "Verify the fix doesn't break existing functionality",
      params: {},
      impact: "low",
      files: [],
    }),
  ];
}

/**
 * Generate steps for adding a feature.
 */
function generateAddFeatureSteps(
  analysis: RequestAnalysis,
  request: PlanRequest
): PlanStep[] {
  const featureEntity = analysis.entities.find((e) => e.type === "feature");
  const featureName = featureEntity?.value || "new feature";

  return [
    createStep("search_codebase", {
      description: `Find related code for ${featureName}`,
      params: { query: featureName },
      impact: "low",
      files: [],
    }),
    createStep("read_file", {
      description: "Understand existing implementation",
      params: {},
      impact: "low",
      files: [],
    }),
    createStep("create_file", {
      description: `Create new files for ${featureName} if needed`,
      params: {},
      impact: "medium",
      files: [],
    }),
    createStep("edit_file", {
      description: `Implement ${featureName} functionality`,
      params: {},
      impact: "medium",
      files: [],
    }),
    createStep("edit_file", {
      description: "Integrate feature with existing code",
      params: {},
      impact: "medium",
      files: [],
    }),
  ];
}

/**
 * Generate steps for refactoring.
 */
function generateRefactorSteps(
  analysis: RequestAnalysis,
  request: PlanRequest
): PlanStep[] {
  return [
    createStep("search_codebase", {
      description: "Identify code to refactor",
      params: { query: analysis.keywords.slice(0, 3).join(" ") },
      impact: "low",
      files: [],
    }),
    createStep("read_file", {
      description: "Analyze current code structure",
      params: {},
      impact: "low",
      files: [],
    }),
    createStep("edit_file", {
      description: "Refactor code structure",
      params: {},
      impact: "medium",
      files: [],
    }),
    createStep("edit_file", {
      description: "Update imports and references",
      params: {},
      impact: "medium",
      files: [],
    }),
    createStep("run_tests", {
      description: "Ensure refactoring doesn't break functionality",
      params: {},
      impact: "low",
      files: [],
    }),
  ];
}

/**
 * Generate generic steps when intent is unclear.
 */
function generateGenericSteps(
  analysis: RequestAnalysis,
  request: PlanRequest
): PlanStep[] {
  return [
    createStep("search_codebase", {
      description: "Search for relevant code",
      params: { query: analysis.keywords.slice(0, 5).join(" ") },
      impact: "low",
      files: analysis.filePatterns,
    }),
    createStep("read_file", {
      description: "Read and understand relevant files",
      params: {},
      impact: "low",
      files: [],
    }),
    createStep("edit_file", {
      description: "Make requested changes",
      params: {},
      impact: "medium",
      files: [],
    }),
  ];
}

/**
 * Helper to create a plan step.
 */
function createStep(
  tool: string,
  options: {
    description: string;
    params: Record<string, unknown>;
    impact: "low" | "medium" | "high";
    files: string[];
  }
): PlanStep {
  return {
    id: generateStepId(),
    order: 0,
    action: tool,
    tool,
    params: options.params,
    description: options.description,
    estimatedImpact: options.impact,
    affectedFiles: options.files,
  };
}

/**
 * Apply constraints to the steps.
 */
function applyConstraints(
  steps: PlanStep[],
  constraints: PlanConstraints
): PlanStep[] {
  let result = [...steps];

  // Limit number of steps
  if (constraints.maxSteps && result.length > constraints.maxSteps) {
    result = result.slice(0, constraints.maxSteps);
  }

  // Filter by complexity
  if (constraints.maxComplexity === "simple") {
    result = result.filter((s) => s.estimatedImpact === "low");
  } else if (constraints.maxComplexity === "moderate") {
    result = result.filter((s) => s.estimatedImpact !== "high");
  }

  return result;
}

/**
 * Calculate all affected files from steps and analysis.
 */
function calculateAffectedFiles(
  steps: PlanStep[],
  analysis: RequestAnalysis
): string[] {
  const files = new Set<string>();

  // From steps
  for (const step of steps) {
    for (const file of step.affectedFiles) {
      files.add(file);
    }
  }

  // From analysis
  for (const pattern of analysis.filePatterns) {
    if (!pattern.includes("*")) {
      files.add(pattern);
    }
  }

  const result: string[] = [];
  files.forEach((f) => result.push(f));
  return result;
}

/**
 * Estimate overall plan complexity.
 */
function estimateComplexity(steps: PlanStep[]): "simple" | "moderate" | "complex" {
  const highImpact = steps.filter((s) => s.estimatedImpact === "high").length;
  const mediumImpact = steps.filter((s) => s.estimatedImpact === "medium").length;

  if (highImpact > 0 || steps.length > 7) return "complex";
  if (mediumImpact > 2 || steps.length > 4) return "moderate";
  return "simple";
}

/**
 * Generate a title for the plan.
 */
function generatePlanTitle(analysis: RequestAnalysis): string {
  const intentTitles: Record<RequestIntent, string> = {
    create_component: "Create new component",
    modify_component: "Modify component",
    delete_component: "Remove component",
    add_feature: "Add feature",
    fix_bug: "Fix bug",
    refactor: "Refactor code",
    style_change: "Update styles",
    add_page: "Add new page",
    modify_page: "Modify page",
    configure: "Configure settings",
    integrate: "Integrate service",
    test: "Add tests",
    document: "Add documentation",
    deploy: "Deploy changes",
    unknown: "Implementation plan",
  };

  let title = intentTitles[analysis.intent];

  // Add entity context
  const primaryEntity = analysis.entities[0];
  if (primaryEntity) {
    title += `: ${primaryEntity.value}`;
  }

  return title;
}

/**
 * Generate a description for the plan.
 */
function generatePlanDescription(
  analysis: RequestAnalysis,
  request: PlanRequest
): string {
  const parts: string[] = [];

  parts.push(`Based on request: "${request.message.slice(0, 100)}${request.message.length > 100 ? "..." : ""}"`);

  if (analysis.entities.length > 0) {
    const entityList = analysis.entities
      .slice(0, 3)
      .map((e) => `${e.type}: ${e.value}`)
      .join(", ");
    parts.push(`Identified: ${entityList}`);
  }

  if (analysis.filePatterns.length > 0) {
    parts.push(`Files: ${analysis.filePatterns.slice(0, 3).join(", ")}`);
  }

  return parts.join("\n");
}

// =============================================================================
// PlanGenerator Class
// =============================================================================

/**
 * PlanGenerator creates implementation plans from user requests.
 *
 * Usage:
 * ```ts
 * const generator = new PlanGenerator();
 *
 * const result = generator.generate({
 *   message: "Create a hero section with a blue background",
 *   context: { projectType: "odoo-theme" },
 * });
 *
 * if (result.success) {
 *   console.log(result.plan.steps);
 * }
 * ```
 */
export class PlanGenerator {
  private config: PlanGeneratorConfig;
  private history: PlanGenerationResult[] = [];

  constructor(config: Partial<PlanGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_PLAN_CONFIG, ...config };
  }

  /**
   * Generate a plan from a user request.
   */
  generate(request: PlanRequest): PlanGenerationResult {
    const result = generatePlan(request, this.config);
    this.history.push(result);
    return result;
  }

  /**
   * Analyze a request without generating a plan.
   */
  analyze(request: PlanRequest): RequestAnalysis {
    return analyzeRequest(request);
  }

  /**
   * Get generation history.
   */
  getHistory(): PlanGenerationResult[] {
    return [...this.history];
  }

  /**
   * Clear history.
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get configuration.
   */
  getConfig(): PlanGeneratorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  setConfig(config: Partial<PlanGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// Singleton
// =============================================================================

let _instance: PlanGenerator | null = null;

/**
 * Get the global PlanGenerator instance.
 */
export function getPlanGenerator(): PlanGenerator {
  if (!_instance) {
    _instance = new PlanGenerator();
  }
  return _instance;
}

/**
 * Reset the global PlanGenerator instance.
 */
export function resetPlanGenerator(): void {
  if (_instance) {
    _instance.clearHistory();
    _instance = null;
  }
}
