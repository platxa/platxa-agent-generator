/**
 * Batch Generator
 *
 * Generates multiple pages/snippets in parallel with shared brand context.
 * Execution time targets < 2x single page through concurrent processing.
 */

// =============================================================================
// Types
// =============================================================================

export interface BrandContext {
  /** Brand name */
  name: string;
  /** Primary color (hex) */
  primaryColor: string;
  /** Secondary color (hex) */
  secondaryColor: string;
  /** Font family */
  fontFamily: string;
  /** Industry/niche */
  industry: string;
  /** Tone of voice */
  tone: string;
}

export interface PageSpec {
  /** Unique page ID */
  id: string;
  /** Page type (e.g. "home", "about", "contact", "product", "blog") */
  type: string;
  /** Page title */
  title: string;
  /** Sections to include */
  sections: string[];
  /** Page-specific overrides */
  overrides?: Record<string, unknown>;
}

export interface SnippetSpec {
  /** Unique snippet ID */
  id: string;
  /** Snippet type (e.g. "hero", "cta", "testimonials", "pricing") */
  type: string;
  /** Display name */
  name: string;
  /** Variant (e.g. "centered", "split", "minimal") */
  variant?: string;
}

export interface GeneratedPage {
  /** Page spec ID */
  id: string;
  /** Generated QWeb XML */
  qweb: string;
  /** Generated SCSS */
  scss: string;
  /** Generation time (ms) */
  durationMs: number;
  /** Success flag */
  success: boolean;
  /** Error if failed */
  error?: string;
}

export interface GeneratedSnippet {
  /** Snippet spec ID */
  id: string;
  /** Generated QWeb XML */
  qweb: string;
  /** Generated SCSS */
  scss: string;
  /** Generation time (ms) */
  durationMs: number;
  /** Success flag */
  success: boolean;
  /** Error if failed */
  error?: string;
}

export interface BatchConfig {
  /** Max concurrent generations */
  concurrency: number;
  /** Timeout per page (ms) */
  pageTimeoutMs: number;
  /** Timeout per snippet (ms) */
  snippetTimeoutMs: number;
  /** Whether to continue on individual failures */
  continueOnError: boolean;
}

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  concurrency: 4,
  pageTimeoutMs: 30000,
  snippetTimeoutMs: 15000,
  continueOnError: true,
};

export interface BatchRequest {
  /** Brand context shared across all pages */
  brand: BrandContext;
  /** Pages to generate */
  pages: PageSpec[];
  /** Snippets to generate */
  snippets: SnippetSpec[];
  /** Config overrides */
  config?: Partial<BatchConfig>;
}

export interface BatchResult {
  /** Generated pages */
  pages: GeneratedPage[];
  /** Generated snippets */
  snippets: GeneratedSnippet[];
  /** Total duration (ms) */
  totalDurationMs: number;
  /** Sum of individual durations (ms) — shows parallelism savings */
  sumIndividualMs: number;
  /** Parallelism ratio (sum / total) */
  parallelismRatio: number;
  /** Success count */
  successCount: number;
  /** Failure count */
  failureCount: number;
  /** Total items */
  totalItems: number;
}

export interface BatchState {
  config: BatchConfig;
  brand: BrandContext;
  pages: GeneratedPage[];
  snippets: GeneratedSnippet[];
  startTime: number;
  endTime: number;
  status: "idle" | "running" | "completed" | "failed";
}

/** Generator function type for pages */
export type PageGenerator = (
  spec: PageSpec,
  brand: BrandContext,
) => Promise<{ qweb: string; scss: string }>;

/** Generator function type for snippets */
export type SnippetGenerator = (
  spec: SnippetSpec,
  brand: BrandContext,
) => Promise<{ qweb: string; scss: string }>;

// =============================================================================
// State
// =============================================================================

export function createBatchState(
  brand: BrandContext,
  config: Partial<BatchConfig> = {},
): BatchState {
  return {
    config: { ...DEFAULT_BATCH_CONFIG, ...config },
    brand,
    pages: [],
    snippets: [],
    startTime: 0,
    endTime: 0,
    status: "idle",
  };
}

// =============================================================================
// Brand Context Helpers
// =============================================================================

/** Generates shared SCSS variables from brand context. */
export function generateBrandScss(brand: BrandContext): string {
  return [
    `$brand-primary: ${brand.primaryColor};`,
    `$brand-secondary: ${brand.secondaryColor};`,
    `$brand-font: '${brand.fontFamily}', sans-serif;`,
    `$brand-name: '${brand.name}';`,
  ].join("\n");
}

/** Generates shared QWeb context variables. */
export function generateBrandContext(brand: BrandContext): Record<string, string> {
  return {
    brand_name: brand.name,
    brand_primary: brand.primaryColor,
    brand_secondary: brand.secondaryColor,
    brand_font: brand.fontFamily,
    brand_industry: brand.industry,
    brand_tone: brand.tone,
  };
}

// =============================================================================
// Page/Snippet Generation (Templates)
// =============================================================================

/** Generates a default QWeb page template based on spec and brand. */
export function generatePageTemplate(spec: PageSpec, brand: BrandContext): string {
  const sections = spec.sections
    .map(
      (s) =>
        `    <section class="s_${s}" style="font-family: '${brand.fontFamily}', sans-serif;">\n` +
        `      <div class="container">\n` +
        `        <h2>${s.charAt(0).toUpperCase() + s.slice(1)}</h2>\n` +
        `      </div>\n` +
        `    </section>`,
    )
    .join("\n");

  return (
    `<template id="page_${spec.id}" name="${spec.title}">\n` +
    `  <t t-call="website.layout">\n` +
    `    <div id="wrap" class="page-${spec.type}">\n` +
    sections +
    `\n    </div>\n` +
    `  </t>\n` +
    `</template>`
  );
}

/** Generates default SCSS for a page. */
export function generatePageScss(spec: PageSpec, brand: BrandContext): string {
  const sectionRules = spec.sections
    .map(
      (s) =>
        `.s_${s} {\n` +
        `  padding: 4rem 0;\n` +
        `  h2 { color: ${brand.primaryColor}; }\n` +
        `}`,
    )
    .join("\n\n");

  return `.page-${spec.type} {\n  font-family: '${brand.fontFamily}', sans-serif;\n}\n\n${sectionRules}`;
}

/** Generates a default QWeb snippet template. */
export function generateSnippetTemplate(
  spec: SnippetSpec,
  brand: BrandContext,
): string {
  const variant = spec.variant || "default";
  return (
    `<template id="snippet_${spec.id}" name="${spec.name}">\n` +
    `  <section class="s_${spec.type} s_${spec.type}_${variant}">\n` +
    `    <div class="container" style="font-family: '${brand.fontFamily}', sans-serif;">\n` +
    `      <h2 style="color: ${brand.primaryColor};">${spec.name}</h2>\n` +
    `    </div>\n` +
    `  </section>\n` +
    `</template>`
  );
}

/** Generates default SCSS for a snippet. */
export function generateSnippetScss(
  spec: SnippetSpec,
  brand: BrandContext,
): string {
  const variant = spec.variant || "default";
  return (
    `.s_${spec.type}_${variant} {\n` +
    `  padding: 3rem 0;\n` +
    `  font-family: '${brand.fontFamily}', sans-serif;\n` +
    `  h2 { color: ${brand.primaryColor}; }\n` +
    `}`
  );
}

// =============================================================================
// Parallel Execution
// =============================================================================

/**
 * Runs tasks with bounded concurrency.
 * Returns results in the same order as input.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await fn(items[idx]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// =============================================================================
// Batch Pipeline
// =============================================================================

/**
 * Runs a batch generation with custom generators.
 */
export async function runBatch(
  request: BatchRequest,
  pageGen: PageGenerator,
  snippetGen: SnippetGenerator,
): Promise<BatchResult> {
  const config = { ...DEFAULT_BATCH_CONFIG, ...request.config };
  const batchStart = Date.now();

  // Generate pages
  const pageResults = await runWithConcurrency(
    request.pages,
    async (spec): Promise<GeneratedPage> => {
      const start = Date.now();
      try {
        const result = await pageGen(spec, request.brand);
        return {
          id: spec.id,
          qweb: result.qweb,
          scss: result.scss,
          durationMs: Date.now() - start,
          success: true,
        };
      } catch (err) {
        if (!config.continueOnError) throw err;
        return {
          id: spec.id,
          qweb: "",
          scss: "",
          durationMs: Date.now() - start,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    config.concurrency,
  );

  // Generate snippets
  const snippetResults = await runWithConcurrency(
    request.snippets,
    async (spec): Promise<GeneratedSnippet> => {
      const start = Date.now();
      try {
        const result = await snippetGen(spec, request.brand);
        return {
          id: spec.id,
          qweb: result.qweb,
          scss: result.scss,
          durationMs: Date.now() - start,
          success: true,
        };
      } catch (err) {
        if (!config.continueOnError) throw err;
        return {
          id: spec.id,
          qweb: "",
          scss: "",
          durationMs: Date.now() - start,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    config.concurrency,
  );

  const totalDurationMs = Date.now() - batchStart;
  const allResults = [...pageResults, ...snippetResults];
  const sumIndividualMs = allResults.reduce((s, r) => s + r.durationMs, 0);
  const successCount = allResults.filter((r) => r.success).length;
  const failureCount = allResults.length - successCount;

  return {
    pages: pageResults,
    snippets: snippetResults,
    totalDurationMs,
    sumIndividualMs,
    parallelismRatio: totalDurationMs > 0 ? sumIndividualMs / totalDurationMs : 1,
    successCount,
    failureCount,
    totalItems: allResults.length,
  };
}

/**
 * Runs batch generation using built-in template generators (sync, no AI call).
 */
export function runBatchSync(request: BatchRequest): BatchResult {
  const batchStart = Date.now();

  const pageResults: GeneratedPage[] = request.pages.map((spec) => {
    const start = Date.now();
    return {
      id: spec.id,
      qweb: generatePageTemplate(spec, request.brand),
      scss: generatePageScss(spec, request.brand),
      durationMs: Date.now() - start,
      success: true,
    };
  });

  const snippetResults: GeneratedSnippet[] = request.snippets.map((spec) => {
    const start = Date.now();
    return {
      id: spec.id,
      qweb: generateSnippetTemplate(spec, request.brand),
      scss: generateSnippetScss(spec, request.brand),
      durationMs: Date.now() - start,
      success: true,
    };
  });

  const totalDurationMs = Date.now() - batchStart;
  const allResults = [...pageResults, ...snippetResults];
  const sumIndividualMs = allResults.reduce((s, r) => s + r.durationMs, 0);

  return {
    pages: pageResults,
    snippets: snippetResults,
    totalDurationMs,
    sumIndividualMs,
    parallelismRatio: totalDurationMs > 0 ? sumIndividualMs / totalDurationMs : 1,
    successCount: allResults.length,
    failureCount: 0,
    totalItems: allResults.length,
  };
}
