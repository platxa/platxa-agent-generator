/**
 * Image-to-Code Screenshot Analyzer
 *
 * Analyzes website screenshots and generates matching Odoo theme code.
 * Uses vision-capable AI models to extract design elements and produce
 * production-ready QWeb templates, SCSS, and manifest files.
 *
 * Feature #7: Add image-to-code capability for website screenshots
 */

import type {
  Message,
  ContentBlock,
  ImageContent,
  ProviderResponse,
} from "./providers";
import { AnthropicAdapter, OpenAIAdapter } from "./providers";
import type { DesignTokenSet } from "../design-tokens/types";
import { assembleTokenSet } from "../design-tokens/token-assembler";
import { tokensToCssVariables } from "../design-tokens/css-transformer";

// =============================================================================
// Types
// =============================================================================

/** Supported image formats */
export type ImageFormat = "png" | "jpeg" | "webp" | "gif";

/** Image input source */
export interface ImageSource {
  type: "base64" | "url" | "file";
  data: string;
  mediaType?: `image/${ImageFormat}`;
}

/** Extracted color from screenshot */
export interface ExtractedColor {
  name: string;
  hex: string;
  usage: "primary" | "secondary" | "accent" | "background" | "text" | "border";
  confidence: number;
}

/** Extracted typography from screenshot */
export interface ExtractedTypography {
  element: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "body" | "caption";
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
  letterSpacing?: string;
  confidence: number;
}

/** Extracted spacing values */
export interface ExtractedSpacing {
  name: string;
  value: string;
  usage: "margin" | "padding" | "gap";
  confidence: number;
}

/** Detected UI component */
export interface DetectedComponent {
  type:
    | "header"
    | "footer"
    | "hero"
    | "nav"
    | "card"
    | "button"
    | "form"
    | "gallery"
    | "testimonial"
    | "pricing"
    | "cta"
    | "feature"
    | "contact"
    | "unknown";
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  description: string;
}

/** Layout analysis result */
export interface LayoutAnalysis {
  type: "single-column" | "two-column" | "three-column" | "grid" | "asymmetric";
  sections: string[];
  hasSticky: boolean;
  isResponsive: boolean;
  confidence: number;
}

/** Complete screenshot analysis result */
export interface ScreenshotAnalysis {
  /** Extracted color palette */
  colors: ExtractedColor[];
  /** Extracted typography styles */
  typography: ExtractedTypography[];
  /** Extracted spacing values */
  spacing: ExtractedSpacing[];
  /** Detected UI components */
  components: DetectedComponent[];
  /** Layout analysis */
  layout: LayoutAnalysis;
  /** Overall design style */
  style: {
    mood: "modern" | "classic" | "minimal" | "bold" | "playful" | "corporate";
    hasGradients: boolean;
    hasShadows: boolean;
    hasRoundedCorners: boolean;
    hasAnimations: boolean;
  };
  /** Raw AI description */
  description: string;
  /** Confidence score 0-100 */
  confidence: number;
}

/** Generated Odoo theme file */
export interface GeneratedFile {
  path: string;
  content: string;
  type: "xml" | "scss" | "js" | "manifest" | "css";
}

/** Complete theme generation result */
export interface ThemeGenerationResult {
  /** Theme module name */
  moduleName: string;
  /** Generated files */
  files: GeneratedFile[];
  /** Design tokens extracted */
  tokens: DesignTokenSet | null;
  /** CSS variables */
  cssVariables: string;
  /** Analysis used for generation */
  analysis: ScreenshotAnalysis;
  /** Generation metadata */
  metadata: {
    generatedAt: string;
    modelUsed: string;
    processingTimeMs: number;
  };
}

/** Image-to-code options */
export interface ImageToCodeOptions {
  /** AI provider to use */
  provider?: "anthropic" | "openai";
  /** Model to use (defaults to best vision model) */
  model?: string;
  /** Theme name (defaults to auto-generated) */
  themeName?: string;
  /** Target Odoo version */
  odooVersion?: "16.0" | "17.0" | "18.0";
  /** Include demo data */
  includeDemo?: boolean;
  /** Generate responsive styles */
  generateResponsive?: boolean;
  /** Include dark mode */
  includeDarkMode?: boolean;
  /** API key (or uses env var) */
  apiKey?: string;
}

// =============================================================================
// Analysis Prompt
// =============================================================================

const ANALYSIS_PROMPT = `You are an expert UI/UX designer and web developer. Analyze this website screenshot and extract design details.

Return a JSON object with this exact structure:
{
  "colors": [
    {"name": "primary", "hex": "#XXXXXX", "usage": "primary|secondary|accent|background|text|border", "confidence": 0-100}
  ],
  "typography": [
    {"element": "h1|h2|h3|h4|h5|h6|body|caption", "fontFamily": "Font Name", "fontSize": "16px", "fontWeight": 400, "lineHeight": 1.5, "confidence": 0-100}
  ],
  "spacing": [
    {"name": "section", "value": "80px", "usage": "margin|padding|gap", "confidence": 0-100}
  ],
  "components": [
    {"type": "header|footer|hero|nav|card|button|form|gallery|testimonial|pricing|cta|feature|contact", "bounds": {"x": 0, "y": 0, "width": 100, "height": 50}, "confidence": 0-100, "description": "Brief description"}
  ],
  "layout": {
    "type": "single-column|two-column|three-column|grid|asymmetric",
    "sections": ["header", "hero", "features", "footer"],
    "hasSticky": true|false,
    "isResponsive": true|false,
    "confidence": 0-100
  },
  "style": {
    "mood": "modern|classic|minimal|bold|playful|corporate",
    "hasGradients": true|false,
    "hasShadows": true|false,
    "hasRoundedCorners": true|false,
    "hasAnimations": true|false
  },
  "description": "A detailed description of the website design",
  "confidence": 0-100
}

Be precise with hex colors. Estimate font sizes and weights. Identify all major sections and components.`;

// =============================================================================
// Code Generation Prompts
// =============================================================================

const QWEB_GENERATION_PROMPT = `You are an expert Odoo developer. Generate QWeb templates for an Odoo website theme based on this design analysis.

Create proper Odoo 17.0 QWeb templates with:
- Proper t-name attributes
- Bootstrap 5 classes
- Odoo snippet structure
- Semantic HTML5
- Accessibility attributes

Return XML content only, no markdown.`;

const SCSS_GENERATION_PROMPT = `You are an expert frontend developer. Generate SCSS styles for an Odoo website theme based on this design analysis.

Create proper SCSS with:
- CSS custom properties for colors
- Responsive breakpoints
- Component-specific styles
- Animation keyframes if needed
- Odoo-compatible class names

Return SCSS content only, no markdown.`;

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Convert image source to provider-compatible format
 */
function imageSourceToContent(source: ImageSource): ImageContent {
  if (source.type === "url") {
    return {
      type: "image",
      source: {
        type: "url",
        url: source.data,
      },
    };
  }

  return {
    type: "image",
    source: {
      type: "base64",
      mediaType: source.mediaType || "image/png",
      data: source.data,
    },
  };
}

/**
 * Parse JSON from AI response, handling markdown code blocks
 */
function parseJsonResponse<T>(text: string): T {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return JSON.parse(cleaned.trim());
}

/**
 * Analyze a website screenshot and extract design elements
 */
export async function analyzeScreenshot(
  image: ImageSource,
  options: Pick<ImageToCodeOptions, "provider" | "model" | "apiKey"> = {}
): Promise<ScreenshotAnalysis> {
  const provider = options.provider || "anthropic";
  const apiKey =
    options.apiKey ||
    (provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY);

  if (!apiKey) {
    throw new Error(
      `API key required for ${provider}. Set ${provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"} or pass apiKey option.`
    );
  }

  const imageContent = imageSourceToContent(image);

  const messages: Message[] = [
    {
      role: "user",
      content: [
        imageContent,
        {
          type: "text",
          text: ANALYSIS_PROMPT,
        },
      ],
    },
  ];

  let response: ProviderResponse;

  if (provider === "anthropic") {
    const adapter = new AnthropicAdapter({ apiKey });
    response = await adapter.chat(messages, {
      model: options.model || "claude-3-5-sonnet-20241022",
      maxTokens: 4096,
    });
  } else {
    const adapter = new OpenAIAdapter({ apiKey });
    response = await adapter.chat(messages, {
      model: options.model || "gpt-4o",
      maxTokens: 4096,
    });
  }

  const textContent = response.content.find(
    (c): c is { type: "text"; text: string } => c.type === "text"
  );

  if (!textContent) {
    throw new Error("No text response from AI model");
  }

  return parseJsonResponse<ScreenshotAnalysis>(textContent.text);
}

/**
 * Generate design tokens from screenshot analysis
 */
export function analysisToTokens(analysis: ScreenshotAnalysis): DesignTokenSet {
  // Extract primary/secondary colors
  const primaryColor =
    analysis.colors.find((c) => c.usage === "primary")?.hex || "#6366f1";
  const secondaryColor =
    analysis.colors.find((c) => c.usage === "secondary")?.hex || "#8b5cf6";

  // Extract typography
  const bodyTypo = analysis.typography.find((t) => t.element === "body");
  const h1Typo = analysis.typography.find((t) => t.element === "h1");

  return assembleTokenSet({
    brandName: "Generated Theme",
    primaryColor,
    secondaryColor,
    fontFamily: bodyTypo?.fontFamily || "Inter",
    headingFontFamily: h1Typo?.fontFamily,
    baseSize: parseInt(bodyTypo?.fontSize || "16", 10),
  });
}

/**
 * Generate QWeb template from analysis
 */
async function generateQWebTemplate(
  analysis: ScreenshotAnalysis,
  themeName: string,
  options: Pick<ImageToCodeOptions, "provider" | "model" | "apiKey">
): Promise<string> {
  const provider = options.provider || "anthropic";
  const apiKey =
    options.apiKey ||
    (provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY);

  if (!apiKey) {
    throw new Error(`API key required for ${provider}`);
  }

  const messages: Message[] = [
    {
      role: "user",
      content: `${QWEB_GENERATION_PROMPT}

Theme name: ${themeName}
Design analysis:
${JSON.stringify(analysis, null, 2)}

Generate the main theme QWeb template (views/templates.xml).`,
    },
  ];

  let response: ProviderResponse;

  if (provider === "anthropic") {
    const adapter = new AnthropicAdapter({ apiKey });
    response = await adapter.chat(messages, {
      model: options.model || "claude-3-5-sonnet-20241022",
      maxTokens: 8192,
    });
  } else {
    const adapter = new OpenAIAdapter({ apiKey });
    response = await adapter.chat(messages, {
      model: options.model || "gpt-4o",
      maxTokens: 8192,
    });
  }

  const textContent = response.content.find(
    (c): c is { type: "text"; text: string } => c.type === "text"
  );

  if (!textContent) {
    throw new Error("No template generated");
  }

  // Clean markdown if present
  let template = textContent.text.trim();
  if (template.startsWith("```xml")) {
    template = template.slice(6);
  } else if (template.startsWith("```")) {
    template = template.slice(3);
  }
  if (template.endsWith("```")) {
    template = template.slice(0, -3);
  }

  return template.trim();
}

/**
 * Generate SCSS styles from analysis
 */
async function generateScssStyles(
  analysis: ScreenshotAnalysis,
  themeName: string,
  options: Pick<ImageToCodeOptions, "provider" | "model" | "apiKey">
): Promise<string> {
  const provider = options.provider || "anthropic";
  const apiKey =
    options.apiKey ||
    (provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY);

  if (!apiKey) {
    throw new Error(`API key required for ${provider}`);
  }

  const messages: Message[] = [
    {
      role: "user",
      content: `${SCSS_GENERATION_PROMPT}

Theme name: ${themeName}
Design analysis:
${JSON.stringify(analysis, null, 2)}

Generate the main SCSS file (static/src/scss/theme.scss).`,
    },
  ];

  let response: ProviderResponse;

  if (provider === "anthropic") {
    const adapter = new AnthropicAdapter({ apiKey });
    response = await adapter.chat(messages, {
      model: options.model || "claude-3-5-sonnet-20241022",
      maxTokens: 8192,
    });
  } else {
    const adapter = new OpenAIAdapter({ apiKey });
    response = await adapter.chat(messages, {
      model: options.model || "gpt-4o",
      maxTokens: 8192,
    });
  }

  const textContent = response.content.find(
    (c): c is { type: "text"; text: string } => c.type === "text"
  );

  if (!textContent) {
    throw new Error("No styles generated");
  }

  // Clean markdown if present
  let scss = textContent.text.trim();
  if (scss.startsWith("```scss") || scss.startsWith("```css")) {
    scss = scss.slice(7);
  } else if (scss.startsWith("```")) {
    scss = scss.slice(3);
  }
  if (scss.endsWith("```")) {
    scss = scss.slice(0, -3);
  }

  return scss.trim();
}

/**
 * Generate Odoo manifest file
 */
function generateManifest(
  themeName: string,
  analysis: ScreenshotAnalysis,
  odooVersion: string
): string {
  const moduleName = `theme_${themeName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

  return `{
    'name': '${themeName} Theme',
    'version': '${odooVersion}.1.0.0',
    'category': 'Theme/Creative',
    'summary': 'Auto-generated theme from screenshot analysis',
    'description': """
${analysis.description}

Generated with Platxa Image-to-Code.
    """,
    'author': 'Platxa',
    'website': 'https://platxa.com',
    'license': 'LGPL-3',
    'depends': ['website'],
    'data': [
        'views/templates.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            '${moduleName}/static/src/scss/theme.scss',
        ],
    },
    'images': [
        'static/description/banner.png',
        'static/description/icon.png',
    ],
    'application': False,
    'installable': True,
    'auto_install': False,
}`;
}

/**
 * Generate complete Odoo theme from a website screenshot
 */
export async function generateThemeFromScreenshot(
  image: ImageSource,
  options: ImageToCodeOptions = {}
): Promise<ThemeGenerationResult> {
  const startTime = Date.now();

  const odooVersion = options.odooVersion || "17.0";
  const themeName = options.themeName || `Generated_${Date.now()}`;
  const moduleName = `theme_${themeName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

  // Step 1: Analyze screenshot
  const analysis = await analyzeScreenshot(image, options);

  // Step 2: Generate design tokens
  const tokens = analysisToTokens(analysis);
  const cssVariables = tokensToCssVariables(tokens);

  // Step 3: Generate QWeb templates
  const qwebTemplate = await generateQWebTemplate(analysis, themeName, options);

  // Step 4: Generate SCSS styles
  const scssStyles = await generateScssStyles(analysis, themeName, options);

  // Step 5: Generate manifest
  const manifest = generateManifest(themeName, analysis, odooVersion);

  // Assemble files
  const files: GeneratedFile[] = [
    {
      path: `${moduleName}/__manifest__.py`,
      content: manifest,
      type: "manifest",
    },
    {
      path: `${moduleName}/__init__.py`,
      content: "# -*- coding: utf-8 -*-\n",
      type: "manifest",
    },
    {
      path: `${moduleName}/views/templates.xml`,
      content: qwebTemplate,
      type: "xml",
    },
    {
      path: `${moduleName}/static/src/scss/theme.scss`,
      content: scssStyles,
      type: "scss",
    },
    {
      path: `${moduleName}/static/src/scss/variables.scss`,
      content: cssVariables,
      type: "scss",
    },
  ];

  return {
    moduleName,
    files,
    tokens,
    cssVariables,
    analysis,
    metadata: {
      generatedAt: new Date().toISOString(),
      modelUsed:
        options.model ||
        (options.provider === "openai" ? "gpt-4o" : "claude-3-5-sonnet-20241022"),
      processingTimeMs: Date.now() - startTime,
    },
  };
}

/**
 * Load image from file path (Node.js environment)
 */
export async function loadImageFromFile(
  filePath: string
): Promise<ImageSource> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const data = await fs.readFile(filePath);
  const base64 = data.toString("base64");

  const ext = path.extname(filePath).toLowerCase().slice(1) as ImageFormat;
  const mediaType: `image/${ImageFormat}` =
    ext === "jpg" ? "image/jpeg" : (`image/${ext}` as `image/${ImageFormat}`);

  return {
    type: "base64",
    data: base64,
    mediaType,
  };
}

/**
 * Load image from URL
 */
export function loadImageFromUrl(url: string): ImageSource {
  return {
    type: "url",
    data: url,
  };
}

/**
 * Load image from base64 string
 */
export function loadImageFromBase64(
  base64: string,
  format: ImageFormat = "png"
): ImageSource {
  // Remove data URL prefix if present
  const data = base64.replace(/^data:image\/\w+;base64,/, "");

  return {
    type: "base64",
    data,
    mediaType: `image/${format}`,
  };
}

/**
 * Write generated theme to filesystem
 */
export async function writeThemeToDirectory(
  result: ThemeGenerationResult,
  outputDir: string
): Promise<string[]> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const writtenPaths: string[] = [];

  for (const file of result.files) {
    const fullPath = path.join(outputDir, file.path);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, file.content, "utf-8");
    writtenPaths.push(fullPath);
  }

  return writtenPaths;
}

/**
 * Validate that an image source is valid for analysis
 */
export function validateImageSource(source: ImageSource): {
  valid: boolean;
  error?: string;
} {
  if (!source.data) {
    return { valid: false, error: "Image data is empty or missing" };
  }

  if (source.type === "base64") {
    // Basic base64 validation
    try {
      if (source.data.length === 0) {
        return { valid: false, error: "Base64 data is empty" };
      }
      // Check if it's valid base64 (rough check)
      if (!/^[A-Za-z0-9+/=]+$/.test(source.data)) {
        return { valid: false, error: "Invalid base64 encoding" };
      }
    } catch {
      return { valid: false, error: "Invalid base64 data" };
    }
  }

  if (source.type === "url") {
    try {
      new URL(source.data);
    } catch {
      return { valid: false, error: "Invalid URL format" };
    }
  }

  return { valid: true };
}

/**
 * Get supported image formats
 */
export function getSupportedFormats(): ImageFormat[] {
  return ["png", "jpeg", "webp", "gif"];
}

/**
 * Estimate analysis cost based on image size
 */
export function estimateAnalysisCost(
  imageSizeBytes: number,
  provider: "anthropic" | "openai" = "anthropic"
): { inputCost: number; outputCost: number; totalCost: number } {
  // Rough token estimation for images
  // Claude: ~85 tokens per 512x512 tile
  // GPT-4o: ~170 tokens per 512x512 tile
  const estimatedTiles = Math.ceil(imageSizeBytes / (512 * 512 * 3));
  const tokensPerTile = provider === "anthropic" ? 85 : 170;
  const imageTokens = estimatedTiles * tokensPerTile;

  // Add prompt tokens
  const promptTokens = 500;
  const outputTokens = 2000;

  // Cost per 1K tokens (approximate)
  const costPer1kInput = provider === "anthropic" ? 0.003 : 0.005;
  const costPer1kOutput = provider === "anthropic" ? 0.015 : 0.015;

  const inputCost = ((imageTokens + promptTokens) / 1000) * costPer1kInput;
  const outputCost = (outputTokens / 1000) * costPer1kOutput;

  return {
    inputCost: Math.round(inputCost * 10000) / 10000,
    outputCost: Math.round(outputCost * 10000) / 10000,
    totalCost: Math.round((inputCost + outputCost) * 10000) / 10000,
  };
}
