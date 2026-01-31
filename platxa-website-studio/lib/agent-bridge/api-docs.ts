/**
 * API Documentation for Agent Bridge Tools
 *
 * Comprehensive documentation for each tool including:
 * - Purpose: What the tool does
 * - Parameters: Input arguments with types
 * - Return Value: Output with types
 * - Examples: Usage examples
 */

// =============================================================================
// Types
// =============================================================================

export interface ParameterDoc {
  /** Parameter name */
  name: string;
  /** TypeScript type */
  type: string;
  /** Description of the parameter */
  description: string;
  /** Whether the parameter is optional */
  optional?: boolean;
  /** Default value if optional */
  defaultValue?: string;
}

export interface ReturnDoc {
  /** TypeScript type of return value */
  type: string;
  /** Description of what is returned */
  description: string;
}

export interface ExampleDoc {
  /** Title of the example */
  title: string;
  /** Code snippet */
  code: string;
  /** Expected output or result description */
  output?: string;
}

export interface ToolDoc {
  /** Tool/function name */
  name: string;
  /** Module where the tool is located */
  module: string;
  /** Category for grouping */
  category: ToolCategory;
  /** Purpose: What the tool does */
  purpose: string;
  /** Parameters with full documentation */
  parameters: ParameterDoc[];
  /** Return value documentation */
  returns: ReturnDoc;
  /** Usage examples */
  examples: ExampleDoc[];
  /** Related tools */
  relatedTools?: string[];
  /** Since version (if applicable) */
  since?: string;
}

export type ToolCategory =
  | 'color'
  | 'generation'
  | 'validation'
  | 'pipeline'
  | 'odoo'
  | 'editor'
  | 'accessibility'
  | 'state'
  | 'streaming'
  | 'routing'
  | 'optimization'
  | 'telemetry'
  | 'formatting';

// =============================================================================
// Color Tools Documentation
// =============================================================================

export const colorMapperDocs: ToolDoc[] = [
  {
    name: 'hexToOklch',
    module: 'color-mapper',
    category: 'color',
    purpose: 'Converts a hex color string to OKLCH color space, providing perceptually uniform color manipulation.',
    parameters: [
      {
        name: 'hex',
        type: 'string',
        description: 'Hex color string (e.g., "#FF5733" or "FF5733")',
      },
    ],
    returns: {
      type: 'OklchColor',
      description: 'Object with l (lightness 0-1), c (chroma 0-0.4), h (hue 0-360) properties',
    },
    examples: [
      {
        title: 'Convert brand color to OKLCH',
        code: `const oklch = hexToOklch("#FF5733");
// { l: 0.65, c: 0.21, h: 35 }`,
        output: 'OKLCH color object for perceptual manipulation',
      },
    ],
    relatedTools: ['oklchToHex', 'generateLightnessScale'],
  },
  {
    name: 'oklchToHex',
    module: 'color-mapper',
    category: 'color',
    purpose: 'Converts OKLCH color back to hex string for CSS output.',
    parameters: [
      {
        name: 'color',
        type: 'OklchColor',
        description: 'OKLCH color object with l, c, h properties',
      },
    ],
    returns: {
      type: 'string',
      description: 'Hex color string with # prefix',
    },
    examples: [
      {
        title: 'Convert OKLCH to hex',
        code: `const hex = oklchToHex({ l: 0.65, c: 0.21, h: 35 });
// "#FF5733"`,
      },
    ],
    relatedTools: ['hexToOklch'],
  },
  {
    name: 'mapOdooPaletteToBrandTokens',
    module: 'color-mapper',
    category: 'color',
    purpose: 'Maps an Odoo color palette to CSS custom properties (brand tokens) for theme generation.',
    parameters: [
      {
        name: 'palette',
        type: 'OdooColorPalette',
        description: 'Odoo palette with primary, secondary, success, info, warning, danger colors',
      },
    ],
    returns: {
      type: 'BrandTokenContext',
      description: 'CSS custom properties map for brand tokens',
    },
    examples: [
      {
        title: 'Generate brand tokens from Odoo palette',
        code: `const tokens = mapOdooPaletteToBrandTokens({
  primary: "#714B67",
  secondary: "#017E84",
  success: "#28A745",
  info: "#17A2B8",
  warning: "#FFC107",
  danger: "#DC3545"
});
// { "--brand-primary": "#714B67", ... }`,
      },
    ],
    relatedTools: ['generateLightnessScale', 'injectBrandTokens'],
  },
  {
    name: 'generateLightnessScale',
    module: 'color-mapper',
    category: 'color',
    purpose: 'Generates a lightness scale (50-900) for a color, useful for design systems.',
    parameters: [
      {
        name: 'baseColor',
        type: 'OklchColor',
        description: 'Base color in OKLCH format',
      },
      {
        name: 'steps',
        type: 'number[]',
        description: 'Scale steps to generate (default: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900])',
        optional: true,
      },
    ],
    returns: {
      type: 'Map<number, string>',
      description: 'Map of step numbers to hex colors',
    },
    examples: [
      {
        title: 'Generate color scale',
        code: `const scale = generateLightnessScale(hexToOklch("#714B67"));
// Map { 50 => "#F5EDF3", 100 => "#E8D4E3", ..., 900 => "#2A1B26" }`,
      },
    ],
    relatedTools: ['hexToOklch', 'mapOdooPaletteToBrandTokens'],
  },
  {
    name: 'meetsContrastAA',
    module: 'color-mapper',
    category: 'color',
    purpose: 'Checks if two colors meet WCAG AA contrast requirements (4.5:1 for normal text).',
    parameters: [
      {
        name: 'foreground',
        type: 'string',
        description: 'Foreground hex color',
      },
      {
        name: 'background',
        type: 'string',
        description: 'Background hex color',
      },
    ],
    returns: {
      type: 'boolean',
      description: 'True if contrast ratio >= 4.5:1',
    },
    examples: [
      {
        title: 'Check text contrast',
        code: `meetsContrastAA("#333333", "#FFFFFF"); // true
meetsContrastAA("#CCCCCC", "#FFFFFF"); // false`,
      },
    ],
    relatedTools: ['contrastRatio', 'getWcagLevel'],
  },
  {
    name: 'injectBrandTokens',
    module: 'brand-token-injector',
    category: 'color',
    purpose: 'Injects brand token CSS custom properties into generated templates and styles.',
    parameters: [
      {
        name: 'content',
        type: 'string',
        description: 'Template or CSS content to inject tokens into',
      },
      {
        name: 'tokens',
        type: 'BrandTokenContext',
        description: 'Brand tokens from mapOdooPaletteToBrandTokens',
      },
    ],
    returns: {
      type: 'string',
      description: 'Content with brand tokens injected as CSS custom properties',
    },
    examples: [
      {
        title: 'Inject brand tokens into template',
        code: `const result = injectBrandTokens(template, {
  "--brand-primary": "#714B67",
  "--brand-secondary": "#017E84"
});
// Template with :root { --brand-primary: #714B67; ... }`,
      },
    ],
    relatedTools: ['mapOdooPaletteToBrandTokens', 'generateOdooColorVariables'],
  },
];

export const colorHarmonyDocs: ToolDoc[] = [
  {
    name: 'hexToHsl',
    module: 'color-harmony',
    category: 'color',
    purpose: 'Converts hex color to HSL for harmony calculations.',
    parameters: [
      { name: 'hex', type: 'string', description: 'Hex color string' },
    ],
    returns: {
      type: 'HslColor',
      description: 'Object with h (0-360), s (0-100), l (0-100)',
    },
    examples: [
      {
        title: 'Convert to HSL',
        code: `const hsl = hexToHsl("#FF5733");
// { h: 11, s: 100, l: 60 }`,
      },
    ],
  },
  {
    name: 'validateHarmony',
    module: 'color-harmony',
    category: 'color',
    purpose: 'Validates if a set of colors follows color harmony rules (complementary, analogous, triadic, etc.).',
    parameters: [
      { name: 'colors', type: 'string[]', description: 'Array of hex colors' },
      { name: 'harmonyType', type: 'HarmonyType', description: 'Type of harmony to check', optional: true },
    ],
    returns: {
      type: 'HarmonyResult',
      description: 'Validation result with detected harmony type and issues',
    },
    examples: [
      {
        title: 'Validate palette harmony',
        code: `const result = validateHarmony(["#FF5733", "#33FF57", "#3357FF"]);
// { isValid: true, harmonyType: "triadic", issues: [] }`,
      },
    ],
    relatedTools: ['generateHarmoniousPalette'],
  },
  {
    name: 'generateHarmoniousPalette',
    module: 'color-harmony',
    category: 'color',
    purpose: 'Generates a harmonious color palette from a base color.',
    parameters: [
      { name: 'baseColor', type: 'string', description: 'Base hex color' },
      { name: 'harmonyType', type: 'HarmonyType', description: 'Type: complementary, analogous, triadic, split-complementary' },
      { name: 'count', type: 'number', description: 'Number of colors to generate', optional: true, defaultValue: '5' },
    ],
    returns: {
      type: 'string[]',
      description: 'Array of hex colors forming a harmonious palette',
    },
    examples: [
      {
        title: 'Generate triadic palette',
        code: `const palette = generateHarmoniousPalette("#714B67", "triadic", 3);
// ["#714B67", "#67714B", "#4B6771"]`,
      },
    ],
  },
];

export const colorSwatchDocs: ToolDoc[] = [
  {
    name: 'contrastRatio',
    module: 'color-swatch-panel',
    category: 'color',
    purpose: 'Calculates the WCAG contrast ratio between two colors.',
    parameters: [
      { name: 'color1', type: 'string', description: 'First hex color' },
      { name: 'color2', type: 'string', description: 'Second hex color' },
    ],
    returns: {
      type: 'number',
      description: 'Contrast ratio (1:1 to 21:1)',
    },
    examples: [
      {
        title: 'Calculate contrast',
        code: `contrastRatio("#000000", "#FFFFFF"); // 21
contrastRatio("#714B67", "#FFFFFF"); // 5.2`,
      },
    ],
  },
  {
    name: 'getWcagLevel',
    module: 'color-swatch-panel',
    category: 'color',
    purpose: 'Determines WCAG compliance level for a contrast ratio.',
    parameters: [
      { name: 'ratio', type: 'number', description: 'Contrast ratio' },
      { name: 'isLargeText', type: 'boolean', description: 'Whether text is large (18pt+ or 14pt bold)', optional: true },
    ],
    returns: {
      type: 'WcagLevel',
      description: '"AAA" | "AA" | "fail"',
    },
    examples: [
      {
        title: 'Check WCAG level',
        code: `getWcagLevel(7.5); // "AAA"
getWcagLevel(4.5); // "AA"
getWcagLevel(3.0); // "fail"`,
      },
    ],
  },
  {
    name: 'generateSwatchPanel',
    module: 'color-swatch-panel',
    category: 'color',
    purpose: 'Generates a swatch panel with contrast information for all color pairs.',
    parameters: [
      { name: 'colors', type: 'Record<string, string>', description: 'Named colors map' },
    ],
    returns: {
      type: 'SwatchPanelData',
      description: 'Swatches with contrast pairs matrix',
    },
    examples: [
      {
        title: 'Generate swatch panel',
        code: `const panel = generateSwatchPanel({
  primary: "#714B67",
  secondary: "#017E84",
  background: "#FFFFFF"
});`,
      },
    ],
  },
];

// =============================================================================
// Generation Pipeline Documentation
// =============================================================================

export const pipelineDocs: ToolDoc[] = [
  {
    name: 'runPreGeneration',
    module: 'pre-generation',
    category: 'pipeline',
    purpose: 'Executes pre-generation hooks: analyzes design intent, validates inputs, prepares context.',
    parameters: [
      {
        name: 'input',
        type: 'PreGenerationInput',
        description: 'Contains prompt, projectConfig, and optional existingTheme',
      },
    ],
    returns: {
      type: 'PreGenerationResult',
      description: 'Design analysis, brand tokens, validated constraints',
    },
    examples: [
      {
        title: 'Run pre-generation',
        code: `const result = await runPreGeneration({
  prompt: "Create a modern SaaS landing page",
  projectConfig: { industry: "technology", brandColors: ["#714B67"] }
});
// { designAnalysis: {...}, brandTokens: {...}, constraints: {...} }`,
      },
    ],
    relatedTools: ['runPostGeneration', 'AgentPipeline'],
  },
  {
    name: 'runPostGeneration',
    module: 'post-generation',
    category: 'pipeline',
    purpose: 'Executes post-generation hooks: validates output, runs accessibility checks, optimizes assets.',
    parameters: [
      {
        name: 'input',
        type: 'PostGenerationInput',
        description: 'Generated code, templates, styles, and config',
      },
    ],
    returns: {
      type: 'PostGenerationResult',
      description: 'Validation results, accessibility report, optimized output',
    },
    examples: [
      {
        title: 'Run post-generation',
        code: `const result = await runPostGeneration({
  templates: [...],
  styles: [...],
  config: projectConfig
});
// { accessibilityReport: {...}, qualityReport: {...}, optimizedOutput: {...} }`,
      },
    ],
    relatedTools: ['runPreGeneration', 'AgentPipeline'],
  },
  {
    name: 'AgentPipeline',
    module: 'pipeline',
    category: 'pipeline',
    purpose: 'Main orchestration class that runs the complete generation pipeline with hooks.',
    parameters: [
      {
        name: 'config',
        type: 'AgentPipelineConfig',
        description: 'Pipeline configuration including hooks, validators, and options',
        optional: true,
      },
    ],
    returns: {
      type: 'AgentPipeline',
      description: 'Pipeline instance with run() method',
    },
    examples: [
      {
        title: 'Run complete pipeline',
        code: `const pipeline = new AgentPipeline(config);
const result = await pipeline.run({
  prompt: "Create an e-commerce theme",
  projectConfig: { ... }
});`,
      },
    ],
    relatedTools: ['runPreGeneration', 'runPostGeneration'],
  },
];

export const orchestratorDocs: ToolDoc[] = [
  {
    name: 'decomposePage',
    module: 'orchestrator-workers',
    category: 'pipeline',
    purpose: 'Decomposes a page generation request into section-level tasks for parallel processing.',
    parameters: [
      { name: 'pageSpec', type: 'PageSpec', description: 'Page specification with sections' },
      { name: 'context', type: 'BrandContext', description: 'Brand context for generation' },
    ],
    returns: {
      type: 'SectionTask[]',
      description: 'Array of section tasks ready for worker execution',
    },
    examples: [
      {
        title: 'Decompose page into tasks',
        code: `const tasks = decomposePage(
  { type: "landing", sections: ["hero", "features", "testimonials", "cta"] },
  brandContext
);
// [{ id: "hero", type: "hero", context: {...} }, ...]`,
      },
    ],
    relatedTools: ['runWorkers', 'orchestratePage'],
  },
  {
    name: 'runWorkers',
    module: 'orchestrator-workers',
    category: 'pipeline',
    purpose: 'Executes section tasks in parallel with concurrency control.',
    parameters: [
      { name: 'tasks', type: 'SectionTask[]', description: 'Tasks from decomposePage' },
      { name: 'workerFn', type: 'SectionWorkerFn', description: 'Function to generate each section' },
      { name: 'options', type: 'OrchestratorOptions', description: 'Concurrency and timeout options', optional: true },
    ],
    returns: {
      type: 'WorkerResult[]',
      description: 'Results from each worker with success/failure status',
    },
    examples: [
      {
        title: 'Run parallel workers',
        code: `const results = await runWorkers(tasks, generateSection, {
  concurrency: 4,
  timeoutMs: 30000
});`,
      },
    ],
    relatedTools: ['decomposePage', 'orchestratePage'],
  },
  {
    name: 'orchestratePage',
    module: 'orchestrator-workers',
    category: 'pipeline',
    purpose: 'High-level function that decomposes, runs workers, and assembles final page.',
    parameters: [
      { name: 'pageSpec', type: 'PageSpec', description: 'Page specification' },
      { name: 'context', type: 'BrandContext', description: 'Brand context' },
      { name: 'workerFn', type: 'SectionWorkerFn', description: 'Section generator function' },
      { name: 'options', type: 'OrchestratorOptions', description: 'Options', optional: true },
    ],
    returns: {
      type: 'OrchestrationResult',
      description: 'Complete page with all sections assembled',
    },
    examples: [
      {
        title: 'Orchestrate full page',
        code: `const page = await orchestratePage(
  { type: "landing", sections: ["hero", "features", "cta"] },
  brandContext,
  myGeneratorFn
);`,
      },
    ],
  },
];

export const evaluatorDocs: ToolDoc[] = [
  {
    name: 'evaluate',
    module: 'evaluator-optimizer',
    category: 'pipeline',
    purpose: 'Evaluates generated output against quality gates.',
    parameters: [
      { name: 'output', type: 'GeneratedOutput', description: 'Generated code/templates' },
      { name: 'gate', type: 'QualityGate', description: 'Quality thresholds', optional: true },
    ],
    returns: {
      type: 'EvaluationResult',
      description: 'Score, passed status, and detailed feedback',
    },
    examples: [
      {
        title: 'Evaluate output',
        code: `const result = evaluate(generatedCode, {
  minQuality: 80,
  maxErrors: 0,
  requiredA11y: true
});
// { score: 85, passed: true, feedback: [...] }`,
      },
    ],
    relatedTools: ['runFeedbackLoop'],
  },
  {
    name: 'runFeedbackLoop',
    module: 'evaluator-optimizer',
    category: 'pipeline',
    purpose: 'Runs iterative evaluate-optimize loop until quality gate is met.',
    parameters: [
      { name: 'initialOutput', type: 'GeneratedOutput', description: 'Initial generation' },
      { name: 'evaluator', type: 'EvaluatorFn', description: 'Evaluation function' },
      { name: 'optimizer', type: 'OptimizerFn', description: 'Optimization function' },
      { name: 'options', type: 'FeedbackLoopOptions', description: 'Max iterations, gate', optional: true },
    ],
    returns: {
      type: 'FeedbackLoopResult',
      description: 'Final output with iteration history',
    },
    examples: [
      {
        title: 'Run feedback loop',
        code: `const result = await runFeedbackLoop(
  initialCode,
  evaluate,
  optimize,
  { maxIterations: 3 }
);`,
      },
    ],
  },
];

// =============================================================================
// Validation Tools Documentation
// =============================================================================

export const accessibilityDocs: ToolDoc[] = [
  {
    name: 'checkA11yLabels',
    module: 'a11y-label-checker',
    category: 'accessibility',
    purpose: 'Checks HTML for missing accessibility labels (alt, aria-label, etc.).',
    parameters: [
      { name: 'html', type: 'string', description: 'HTML content to check' },
    ],
    returns: {
      type: 'A11yLabelResult',
      description: 'List of issues with element references and fix suggestions',
    },
    examples: [
      {
        title: 'Check accessibility labels',
        code: `const result = checkA11yLabels('<img src="logo.png">');
// { issues: [{ type: "missing_alt", element: "img", fix: "Add alt attribute" }] }`,
      },
    ],
    relatedTools: ['validateKeyboardNav', 'validateSemantics'],
  },
  {
    name: 'validateKeyboardNav',
    module: 'keyboard-nav-validator',
    category: 'accessibility',
    purpose: 'Validates keyboard navigation: focus order, skip links, keyboard traps.',
    parameters: [
      { name: 'html', type: 'string', description: 'HTML content' },
    ],
    returns: {
      type: 'KbNavResult',
      description: 'Keyboard navigation issues and recommendations',
    },
    examples: [
      {
        title: 'Validate keyboard navigation',
        code: `const result = validateKeyboardNav(pageHtml);
// { issues: [{ rule: "no_skip_link", severity: "warning" }] }`,
      },
    ],
  },
  {
    name: 'validateSemantics',
    module: 'semantic-validator',
    category: 'accessibility',
    purpose: 'Validates semantic HTML usage (headings hierarchy, landmarks, etc.).',
    parameters: [
      { name: 'html', type: 'string', description: 'HTML content' },
    ],
    returns: {
      type: 'SemanticValidationResult',
      description: 'Semantic issues with severity levels',
    },
    examples: [
      {
        title: 'Validate semantics',
        code: `const result = validateSemantics(pageHtml);
// { issues: [{ type: "heading_skip", message: "H1 to H3 skips H2" }] }`,
      },
    ],
  },
  {
    name: 'validateResponsive',
    module: 'responsive-validator',
    category: 'accessibility',
    purpose: 'Validates responsive design: viewport issues, touch targets, overflow.',
    parameters: [
      { name: 'html', type: 'string', description: 'HTML content' },
      { name: 'css', type: 'string', description: 'CSS styles' },
      { name: 'viewports', type: 'Viewport[]', description: 'Viewports to check', optional: true },
    ],
    returns: {
      type: 'ResponsiveResult',
      description: 'Responsive issues per viewport',
    },
    examples: [
      {
        title: 'Validate responsive design',
        code: `const result = validateResponsive(html, css, DEFAULT_VIEWPORTS);
// { issues: [{ viewport: "mobile", rule: "touch_target_size" }] }`,
      },
    ],
  },
];

export const cssValidationDocs: ToolDoc[] = [
  {
    name: 'calculateSpecificity',
    module: 'css-specificity',
    category: 'validation',
    purpose: 'Calculates CSS specificity for a selector.',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector' },
    ],
    returns: {
      type: 'Specificity',
      description: '[ids, classes, elements] tuple',
    },
    examples: [
      {
        title: 'Calculate specificity',
        code: `calculateSpecificity("#main .nav a"); // [1, 1, 1]
calculateSpecificity(".btn.primary");   // [0, 2, 0]`,
      },
    ],
  },
  {
    name: 'analyzeSpecificity',
    module: 'css-specificity',
    category: 'validation',
    purpose: 'Analyzes CSS for specificity issues: too high specificity, deep nesting.',
    parameters: [
      { name: 'css', type: 'string', description: 'CSS content' },
      { name: 'thresholds', type: 'SpecificityThresholds', description: 'Warning thresholds', optional: true },
    ],
    returns: {
      type: 'SpecificityResult',
      description: 'Issues with problematic selectors',
    },
    examples: [
      {
        title: 'Analyze CSS specificity',
        code: `const result = analyzeSpecificity(css, { maxSpecificity: [1, 3, 3] });
// { issues: [{ selector: "#app .nav .menu a.active", message: "Too specific" }] }`,
      },
    ],
  },
];

// =============================================================================
// Odoo Tools Documentation
// =============================================================================

export const odooDocs: ToolDoc[] = [
  {
    name: 'deployToOdoo',
    module: 'odoo-xmlrpc-deploy',
    category: 'odoo',
    purpose: 'Deploys a theme module to an Odoo instance via XML-RPC.',
    parameters: [
      { name: 'connection', type: 'OdooConnection', description: 'Odoo server connection details' },
      { name: 'moduleFiles', type: 'PackagedFile[]', description: 'Files to deploy' },
      { name: 'options', type: 'DeployOptions', description: 'Deploy options', optional: true },
    ],
    returns: {
      type: 'DeployResult',
      description: 'Deploy status with step-by-step results',
    },
    examples: [
      {
        title: 'Deploy theme to Odoo',
        code: `const result = await deployToOdoo(
  { url: "https://my-odoo.com", db: "main", user: "admin", password: "***" },
  packagedFiles,
  { installAfterUpload: true }
);`,
      },
    ],
    relatedTools: ['packageOdooModule'],
  },
  {
    name: 'packageOdooModule',
    module: 'odoo-packager',
    category: 'odoo',
    purpose: 'Packages generated files into an Odoo module structure.',
    parameters: [
      { name: 'input', type: 'PackagerInput', description: 'Module name, templates, styles, assets' },
    ],
    returns: {
      type: 'PackagerResult',
      description: 'Packaged files with __manifest__.py, views/, static/',
    },
    examples: [
      {
        title: 'Package module',
        code: `const result = packageOdooModule({
  moduleName: "theme_my_brand",
  templates: [...],
  styles: [...],
  assets: [...]
});`,
      },
    ],
    relatedTools: ['deployToOdoo'],
  },
  {
    name: 'adaptForVersion',
    module: 'odoo-compat',
    category: 'odoo',
    purpose: 'Adapts theme files for a specific Odoo version (14.0, 15.0, 16.0, 17.0).',
    parameters: [
      { name: 'theme', type: 'ThemeDefinition', description: 'Theme with templates, styles, manifest' },
      { name: 'targetVersion', type: 'OdooVersion', description: 'Target Odoo version' },
    ],
    returns: {
      type: 'VersionOutput',
      description: 'Adapted files for the target version',
    },
    examples: [
      {
        title: 'Adapt for Odoo 16',
        code: `const adapted = adaptForVersion(theme, "16.0");
// Converts owl directives, updates asset bundles, etc.`,
      },
    ],
  },
  {
    name: 'runDockerThemeTest',
    module: 'odoo-docker-tester',
    category: 'odoo',
    purpose: 'Tests a theme in a Docker Odoo container.',
    parameters: [
      { name: 'modulePath', type: 'string', description: 'Path to module' },
      { name: 'config', type: 'OdooDockerConfig', description: 'Docker config', optional: true },
      { name: 'options', type: 'DockerTestOptions', description: 'Test options', optional: true },
    ],
    returns: {
      type: 'DockerTestResult',
      description: 'Test results with screenshots and logs',
    },
    examples: [
      {
        title: 'Test theme in Docker',
        code: `const result = await runDockerThemeTest("./theme_my_brand", {
  odooVersion: "16.0",
  testPages: ["/", "/shop", "/contactus"]
});`,
      },
    ],
  },
  {
    name: 'validateSubmission',
    module: 'appstore-validator',
    category: 'odoo',
    purpose: 'Validates a theme submission for the Odoo App Store.',
    parameters: [
      { name: 'manifest', type: 'ManifestData', description: 'Module manifest' },
      { name: 'assets', type: 'SubmissionAssets', description: 'Icons, screenshots, description' },
    ],
    returns: {
      type: 'ValidationResult',
      description: 'Validation issues blocking submission',
    },
    examples: [
      {
        title: 'Validate for app store',
        code: `const result = validateSubmission(manifest, {
  icon: iconBuffer,
  screenshots: [...],
  description: "..."
});`,
      },
    ],
  },
];

// =============================================================================
// Editor Tools Documentation
// =============================================================================

export const editorDocs: ToolDoc[] = [
  {
    name: 'createTimeline',
    module: 'snapshot-timeline',
    category: 'editor',
    purpose: 'Creates a new snapshot timeline for undo/redo across the entire project.',
    parameters: [
      { name: 'maxSnapshots', type: 'number', description: 'Maximum snapshots to keep', optional: true, defaultValue: '50' },
    ],
    returns: {
      type: 'Timeline',
      description: 'Timeline state with snapshots array and current index',
    },
    examples: [
      {
        title: 'Create timeline',
        code: `const timeline = createTimeline(100);
// { snapshots: [], currentIndex: -1, maxSnapshots: 100 }`,
      },
    ],
    relatedTools: ['addSnapshot', 'undo'],
  },
  {
    name: 'addSnapshot',
    module: 'snapshot-timeline',
    category: 'editor',
    purpose: 'Adds a snapshot to the timeline, clearing any redo history.',
    parameters: [
      { name: 'timeline', type: 'Timeline', description: 'Current timeline' },
      { name: 'state', type: 'any', description: 'State to snapshot' },
      { name: 'label', type: 'string', description: 'Human-readable label', optional: true },
    ],
    returns: {
      type: 'Timeline',
      description: 'Updated timeline with new snapshot',
    },
    examples: [
      {
        title: 'Add snapshot',
        code: `const updated = addSnapshot(timeline, currentState, "Added hero section");`,
      },
    ],
  },
  {
    name: 'undo',
    module: 'snapshot-timeline',
    category: 'editor',
    purpose: 'Moves to the previous snapshot in the timeline.',
    parameters: [
      { name: 'timeline', type: 'Timeline', description: 'Current timeline' },
    ],
    returns: {
      type: 'RestoreResult',
      description: 'Updated timeline and restored state',
    },
    examples: [
      {
        title: 'Undo',
        code: `const { timeline: newTimeline, state } = undo(timeline);`,
      },
    ],
  },
  {
    name: 'createStack',
    module: 'undo-redo-stack',
    category: 'editor',
    purpose: 'Creates an undo/redo stack for granular edit operations.',
    parameters: [
      { name: 'maxDepth', type: 'number', description: 'Maximum stack depth', optional: true, defaultValue: '100' },
    ],
    returns: {
      type: 'UndoRedoStack',
      description: 'Stack state with undo/redo arrays',
    },
    examples: [
      {
        title: 'Create stack',
        code: `const stack = createStack(50);`,
      },
    ],
  },
  {
    name: 'moveSection',
    module: 'section-reorder',
    category: 'editor',
    purpose: 'Moves a section to a new position in the page.',
    parameters: [
      { name: 'sections', type: 'PageSection[]', description: 'Current sections' },
      { name: 'fromIndex', type: 'number', description: 'Source index' },
      { name: 'toIndex', type: 'number', description: 'Target index' },
    ],
    returns: {
      type: 'DragResult',
      description: 'Reordered sections array',
    },
    examples: [
      {
        title: 'Move section',
        code: `const reordered = moveSection(sections, 3, 1); // Move section 3 to position 1`,
      },
    ],
  },
];

// =============================================================================
// Streaming Tools Documentation
// =============================================================================

export const streamingDocs: ToolDoc[] = [
  {
    name: 'createSSEEmitter',
    module: 'sse-stream',
    category: 'streaming',
    purpose: 'Creates an SSE emitter for streaming generation progress to clients.',
    parameters: [
      { name: 'writer', type: 'SSEWriter', description: 'Write function (e.g., response.write)' },
    ],
    returns: {
      type: 'SSEEmitter',
      description: 'Emitter with progress(), token(), sectionComplete(), error(), done() methods',
    },
    examples: [
      {
        title: 'Create SSE emitter',
        code: `const emitter = createSSEEmitter((data) => res.write(data));
emitter.progress({ phase: "generating", percent: 50 });
emitter.token({ content: "..." });
emitter.done({ totalTime: 5000 });`,
      },
    ],
    relatedTools: ['createSSEConsumer'],
  },
  {
    name: 'createSSEConsumer',
    module: 'sse-stream',
    category: 'streaming',
    purpose: 'Creates an SSE consumer for parsing streaming responses.',
    parameters: [
      { name: 'handlers', type: 'SSEHandlers', description: 'Event handlers for each event type' },
    ],
    returns: {
      type: 'SSEConsumer',
      description: 'Consumer with feed() method to parse incoming data',
    },
    examples: [
      {
        title: 'Consume SSE stream',
        code: `const consumer = createSSEConsumer({
  onProgress: (data) => updateUI(data.percent),
  onToken: (data) => appendToken(data.content),
  onDone: () => finalize()
});
// In event source: consumer.feed(event.data);`,
      },
    ],
  },
  {
    name: 'createProgressState',
    module: 'progress-streaming',
    category: 'streaming',
    purpose: 'Creates progress tracking state for multi-phase generation.',
    parameters: [
      { name: 'phases', type: 'PhaseName[]', description: 'Phases to track', optional: true },
    ],
    returns: {
      type: 'ProgressState',
      description: 'State with phases, current phase, and timing',
    },
    examples: [
      {
        title: 'Track progress',
        code: `let state = createProgressState(["analyze", "generate", "validate"]);
state = advancePhase(state); // Move to next phase
const progress = computeProgress(state); // 0-100`,
      },
    ],
  },
];

// =============================================================================
// Routing Tools Documentation
// =============================================================================

export const routingDocs: ToolDoc[] = [
  {
    name: 'routeTask',
    module: 'task-router',
    category: 'routing',
    purpose: 'Routes a generation task to the most appropriate worker type.',
    parameters: [
      { name: 'task', type: 'RoutableTask', description: 'Task with type and requirements' },
      { name: 'config', type: 'RouterConfig', description: 'Router configuration', optional: true },
    ],
    returns: {
      type: 'RoutingDecision',
      description: 'Selected worker type with confidence score',
    },
    examples: [
      {
        title: 'Route task',
        code: `const decision = routeTask({ type: "hero_section", complexity: "high" });
// { worker: "LAYOUT_WORKER", confidence: 0.85 }`,
      },
    ],
  },
  {
    name: 'routeModelTask',
    module: 'model-router',
    category: 'routing',
    purpose: 'Routes a task to the appropriate AI model based on task type.',
    parameters: [
      { name: 'request', type: 'RoutingRequest', description: 'Task type and token estimate' },
      { name: 'config', type: 'ModelRouterConfig', description: 'Router config', optional: true },
    ],
    returns: {
      type: 'ModelRoutingDecision',
      description: 'Selected model with cost estimate',
    },
    examples: [
      {
        title: 'Route to model',
        code: `const decision = routeModelTask({ taskType: "code_review", tokens: 5000 });
// { model: "REASONING_MODEL", estimatedCost: 0.15 }`,
      },
    ],
  },
];

// =============================================================================
// State Management Documentation
// =============================================================================

export const stateDocs: ToolDoc[] = [
  {
    name: 'createMemory',
    module: 'preference-memory',
    category: 'state',
    purpose: 'Creates a preference memory store for learning user preferences.',
    parameters: [],
    returns: {
      type: 'PreferenceMemory',
      description: 'Memory state with preferences, rejections, favorites',
    },
    examples: [
      {
        title: 'Create preference memory',
        code: `const memory = createMemory();`,
      },
    ],
    relatedTools: ['recordPreference'],
  },
  {
    name: 'recordPreference',
    module: 'preference-memory',
    category: 'state',
    purpose: 'Records a user preference for future generations.',
    parameters: [
      { name: 'memory', type: 'PreferenceMemory', description: 'Current memory state' },
      { name: 'category', type: 'PreferenceCategory', description: 'Category (color, font, layout)' },
      { name: 'key', type: 'string', description: 'Preference key' },
      { name: 'value', type: 'any', description: 'Preferred value' },
    ],
    returns: {
      type: 'PreferenceMemory',
      description: 'Updated memory with new preference',
    },
    examples: [
      {
        title: 'Record preference',
        code: `const updated = recordPreference(memory, "color", "primary", "#714B67");`,
      },
    ],
  },
  {
    name: 'createContextWindow',
    module: 'context-window',
    category: 'state',
    purpose: 'Creates a context window manager for assembling LLM prompts within token budgets.',
    parameters: [
      { name: 'budget', type: 'ContextBudget', description: 'Token budget allocation' },
    ],
    returns: {
      type: 'ContextWindowState',
      description: 'State with items and budget tracking',
    },
    examples: [
      {
        title: 'Create context window',
        code: `const ctx = createContextWindow({
  total: 8000,
  system: 1000,
  history: 2000,
  content: 5000
});`,
      },
    ],
  },
  {
    name: 'createRateLimitState',
    module: 'rate-limiter',
    category: 'state',
    purpose: 'Creates rate limiting state for API call management.',
    parameters: [
      { name: 'config', type: 'RateLimitConfig', description: 'Rate limit configuration', optional: true },
    ],
    returns: {
      type: 'RateLimitState',
      description: 'State tracking API calls, tokens, costs',
    },
    examples: [
      {
        title: 'Create rate limiter',
        code: `const limiter = createRateLimitState({
  maxCallsPerMinute: 60,
  maxTokensPerDay: 1000000,
  budgetLimit: 100.00
});`,
      },
    ],
  },
];

// =============================================================================
// Telemetry Documentation
// =============================================================================

export const telemetryDocs: ToolDoc[] = [
  {
    name: 'createTelemetryState',
    module: 'telemetry',
    category: 'telemetry',
    purpose: 'Creates telemetry state for tracking generation metrics.',
    parameters: [
      { name: 'config', type: 'TelemetryConfig', description: 'Telemetry configuration', optional: true },
    ],
    returns: {
      type: 'TelemetryState',
      description: 'State with events, metrics, and counters',
    },
    examples: [
      {
        title: 'Create telemetry',
        code: `const telemetry = createTelemetryState({ maxEvents: 10000 });`,
      },
    ],
    relatedTools: ['recordGeneration', 'computeAnalytics'],
  },
  {
    name: 'recordGeneration',
    module: 'telemetry',
    category: 'telemetry',
    purpose: 'Records metrics for a generation event.',
    parameters: [
      { name: 'state', type: 'TelemetryState', description: 'Current state' },
      { name: 'metrics', type: 'GenerationMetrics', description: 'Generation metrics' },
    ],
    returns: {
      type: 'TelemetryState',
      description: 'Updated state with recorded metrics',
    },
    examples: [
      {
        title: 'Record generation',
        code: `const updated = recordGeneration(state, {
  durationMs: 5000,
  tokens: 3500,
  cost: 0.05,
  success: true
});`,
      },
    ],
  },
  {
    name: 'computeAnalytics',
    module: 'telemetry',
    category: 'telemetry',
    purpose: 'Computes analytics summary from telemetry data.',
    parameters: [
      { name: 'state', type: 'TelemetryState', description: 'Telemetry state' },
      { name: 'windowMs', type: 'number', description: 'Time window', optional: true },
    ],
    returns: {
      type: 'AnalyticsSummary',
      description: 'Summary with averages, totals, trends',
    },
    examples: [
      {
        title: 'Get analytics',
        code: `const analytics = computeAnalytics(state, 3600000); // Last hour
// { avgDuration: 4500, totalCost: 12.50, successRate: 0.95, ... }`,
      },
    ],
  },
  {
    name: 'computeMetrics',
    module: 'observability-dashboard',
    category: 'telemetry',
    purpose: 'Computes dashboard metrics from generation records.',
    parameters: [
      { name: 'state', type: 'DashboardState', description: 'Dashboard state' },
    ],
    returns: {
      type: 'DashboardMetrics',
      description: 'Metrics including latency, quality, cost breakdowns',
    },
    examples: [
      {
        title: 'Compute dashboard metrics',
        code: `const metrics = computeMetrics(dashboardState);
// { avgLatencyMs: 2500, p95LatencyMs: 4500, avgQualityScore: 85, ... }`,
      },
    ],
  },
];

// =============================================================================
// Optimization Documentation
// =============================================================================

export const optimizationDocs: ToolDoc[] = [
  {
    name: 'optimizeAssets',
    module: 'asset-optimizer',
    category: 'optimization',
    purpose: 'Optimizes theme assets (SCSS, images, fonts) for production.',
    parameters: [
      { name: 'assets', type: 'AssetInput[]', description: 'Assets to optimize' },
      { name: 'config', type: 'OptimizerConfig', description: 'Optimization config', optional: true },
    ],
    returns: {
      type: 'AssetOptimizationResult',
      description: 'Optimized assets with compression stats',
    },
    examples: [
      {
        title: 'Optimize assets',
        code: `const result = await optimizeAssets(assets, {
  minifyScss: true,
  optimizeImages: true,
  subsetFonts: true
});
// { totalSaved: 125000, optimized: [...] }`,
      },
    ],
  },
  {
    name: 'checkBudget',
    module: 'performance-budget',
    category: 'optimization',
    purpose: 'Checks theme against performance budget constraints.',
    parameters: [
      { name: 'assets', type: 'AssetEntry[]', description: 'Theme assets' },
      { name: 'budget', type: 'PerformanceBudget', description: 'Budget constraints', optional: true },
    ],
    returns: {
      type: 'BudgetCheckResult',
      description: 'Violations and warnings',
    },
    examples: [
      {
        title: 'Check performance budget',
        code: `const result = checkBudget(assets, {
  maxCssKb: 100,
  maxFonts: 3,
  maxImageKb: 500
});`,
      },
    ],
  },
  {
    name: 'applyRules',
    module: 'prompt-optimizer',
    category: 'optimization',
    purpose: 'Applies optimization rules to improve prompt quality.',
    parameters: [
      { name: 'prompt', type: 'string', description: 'Original prompt' },
      { name: 'rules', type: 'OptimizationRule[]', description: 'Rules to apply' },
      { name: 'feedback', type: 'QualityFeedback', description: 'Previous quality feedback', optional: true },
    ],
    returns: {
      type: 'string',
      description: 'Optimized prompt',
    },
    examples: [
      {
        title: 'Optimize prompt',
        code: `const optimized = applyRules(prompt, rules, { score: 65, issues: [...] });`,
      },
    ],
  },
];

// =============================================================================
// Formatting Documentation
// =============================================================================

export const formattingDocs: ToolDoc[] = [
  {
    name: 'generateOdooColorVariables',
    module: 'scss-transformer',
    category: 'formatting',
    purpose: 'Generates Odoo SCSS color variable declarations.',
    parameters: [
      { name: 'palette', type: 'OdooColorPalette', description: 'Color palette' },
    ],
    returns: {
      type: 'string',
      description: 'SCSS variable declarations',
    },
    examples: [
      {
        title: 'Generate SCSS variables',
        code: `const scss = generateOdooColorVariables(palette);
// "$o-brand-primary: #714B67;\n$o-brand-secondary: #017E84;..."`,
      },
    ],
  },
  {
    name: 'renderQWeb',
    module: 'preview-server',
    category: 'formatting',
    purpose: 'Renders a QWeb template to HTML.',
    parameters: [
      { name: 'template', type: 'string', description: 'QWeb template XML' },
      { name: 'context', type: 'QWebContext', description: 'Template context' },
    ],
    returns: {
      type: 'RenderResult',
      description: 'Rendered HTML or error',
    },
    examples: [
      {
        title: 'Render QWeb',
        code: `const result = renderQWeb('<t t-esc="name"/>', { name: "Hello" });
// { html: "Hello", success: true }`,
      },
    ],
  },
  {
    name: 'generateOpenApiSpec',
    module: 'openapi-generator',
    category: 'formatting',
    purpose: 'Generates OpenAPI 3.0 specification from documented endpoints.',
    parameters: [
      { name: 'state', type: 'ApiDocState', description: 'API documentation state' },
    ],
    returns: {
      type: 'OpenApiSpec',
      description: 'Complete OpenAPI specification object',
    },
    examples: [
      {
        title: 'Generate OpenAPI spec',
        code: `const spec = generateOpenApiSpec(state);
const json = generateOpenApiJson(state); // JSON string`,
      },
    ],
  },
];

// =============================================================================
// All Documentation
// =============================================================================

export const ALL_TOOL_DOCS: ToolDoc[] = [
  ...colorMapperDocs,
  ...colorHarmonyDocs,
  ...colorSwatchDocs,
  ...pipelineDocs,
  ...orchestratorDocs,
  ...evaluatorDocs,
  ...accessibilityDocs,
  ...cssValidationDocs,
  ...odooDocs,
  ...editorDocs,
  ...streamingDocs,
  ...routingDocs,
  ...stateDocs,
  ...telemetryDocs,
  ...optimizationDocs,
  ...formattingDocs,
];

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Gets documentation for a specific tool by name.
 */
export function getToolDoc(name: string): ToolDoc | undefined {
  return ALL_TOOL_DOCS.find((doc) => doc.name === name);
}

/**
 * Gets all tools in a category.
 */
export function getToolsByCategory(category: ToolCategory): ToolDoc[] {
  return ALL_TOOL_DOCS.filter((doc) => doc.category === category);
}

/**
 * Gets all tools in a module.
 */
export function getToolsByModule(module: string): ToolDoc[] {
  return ALL_TOOL_DOCS.filter((doc) => doc.module === module);
}

/**
 * Searches tools by name or purpose.
 */
export function searchTools(query: string): ToolDoc[] {
  const lower = query.toLowerCase();
  return ALL_TOOL_DOCS.filter(
    (doc) =>
      doc.name.toLowerCase().includes(lower) ||
      doc.purpose.toLowerCase().includes(lower),
  );
}

/**
 * Gets all unique categories.
 */
export function getCategories(): ToolCategory[] {
  return [...new Set(ALL_TOOL_DOCS.map((doc) => doc.category))];
}

/**
 * Gets all unique modules.
 */
export function getModules(): string[] {
  return [...new Set(ALL_TOOL_DOCS.map((doc) => doc.module))];
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Formats a tool documentation as markdown.
 */
export function formatToolAsMarkdown(doc: ToolDoc): string {
  const lines: string[] = [];

  lines.push(`## ${doc.name}`);
  lines.push('');
  lines.push(`**Module:** \`${doc.module}\` | **Category:** ${doc.category}`);
  lines.push('');
  lines.push('### Purpose');
  lines.push(doc.purpose);
  lines.push('');

  if (doc.parameters.length > 0) {
    lines.push('### Parameters');
    lines.push('');
    lines.push('| Name | Type | Description |');
    lines.push('|------|------|-------------|');
    for (const param of doc.parameters) {
      const optional = param.optional ? ' (optional)' : '';
      const defaultVal = param.defaultValue ? ` Default: \`${param.defaultValue}\`` : '';
      lines.push(`| \`${param.name}\`${optional} | \`${param.type}\` | ${param.description}${defaultVal} |`);
    }
    lines.push('');
  }

  lines.push('### Returns');
  lines.push('');
  lines.push(`**Type:** \`${doc.returns.type}\``);
  lines.push('');
  lines.push(doc.returns.description);
  lines.push('');

  if (doc.examples.length > 0) {
    lines.push('### Examples');
    lines.push('');
    for (const example of doc.examples) {
      lines.push(`#### ${example.title}`);
      lines.push('');
      lines.push('```typescript');
      lines.push(example.code);
      lines.push('```');
      if (example.output) {
        lines.push('');
        lines.push(`*${example.output}*`);
      }
      lines.push('');
    }
  }

  if (doc.relatedTools && doc.relatedTools.length > 0) {
    lines.push('### Related Tools');
    lines.push('');
    lines.push(doc.relatedTools.map((t) => `\`${t}\``).join(', '));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats all documentation as markdown.
 */
export function formatAllDocsAsMarkdown(): string {
  const lines: string[] = [];

  lines.push('# Agent Bridge API Documentation');
  lines.push('');
  lines.push('Comprehensive documentation for all agent bridge tools.');
  lines.push('');

  // Table of contents by category
  lines.push('## Table of Contents');
  lines.push('');
  for (const category of getCategories()) {
    const tools = getToolsByCategory(category);
    lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
    for (const tool of tools) {
      lines.push(`- [\`${tool.name}\`](#${tool.name.toLowerCase()})`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Full documentation
  for (const doc of ALL_TOOL_DOCS) {
    lines.push(formatToolAsMarkdown(doc));
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats tool documentation as JSON schema (for AI tool calling).
 */
export function formatToolAsJsonSchema(doc: ToolDoc): object {
  return {
    name: doc.name,
    description: doc.purpose,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(
        doc.parameters.map((p) => [
          p.name,
          {
            type: inferJsonType(p.type),
            description: p.description,
          },
        ]),
      ),
      required: doc.parameters.filter((p) => !p.optional).map((p) => p.name),
    },
  };
}

function inferJsonType(tsType: string): string {
  const lower = tsType.toLowerCase();
  if (lower.includes('string')) return 'string';
  if (lower.includes('number')) return 'number';
  if (lower.includes('boolean')) return 'boolean';
  if (lower.includes('[]')) return 'array';
  return 'object';
}

// =============================================================================
// Summary Statistics
// =============================================================================

export interface DocsSummary {
  totalTools: number;
  byCategory: Record<ToolCategory, number>;
  byModule: Record<string, number>;
  totalExamples: number;
}

/**
 * Computes summary statistics for the documentation.
 */
export function computeDocsSummary(): DocsSummary {
  const byCategory: Record<string, number> = {};
  const byModule: Record<string, number> = {};
  let totalExamples = 0;

  for (const doc of ALL_TOOL_DOCS) {
    byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
    byModule[doc.module] = (byModule[doc.module] || 0) + 1;
    totalExamples += doc.examples.length;
  }

  return {
    totalTools: ALL_TOOL_DOCS.length,
    byCategory: byCategory as Record<ToolCategory, number>,
    byModule,
    totalExamples,
  };
}
