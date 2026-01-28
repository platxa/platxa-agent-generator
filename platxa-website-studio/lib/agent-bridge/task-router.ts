/**
 * Task Router — Intelligent Task Classification and Worker Routing
 *
 * Routes generation tasks to specialized workers based on task type
 * classification (layout, content, style, interaction).
 */

// =============================================================================
// Types
// =============================================================================

/** Worker specialization categories */
export type WorkerType = "layout" | "content" | "style" | "interaction" | "general";

/** A routable task */
export interface RoutableTask {
  /** Task ID */
  id: string;
  /** Task description or prompt */
  description: string;
  /** Section type hint (e.g. "hero", "features", "footer") */
  sectionType?: string;
  /** Explicit worker override */
  workerOverride?: WorkerType;
  /** Additional context tags */
  tags?: string[];
}

/** Routing decision */
export interface RoutingDecision {
  /** Task ID */
  taskId: string;
  /** Assigned worker type */
  worker: WorkerType;
  /** Confidence of the routing decision 0-1 */
  confidence: number;
  /** Reason for the routing */
  reason: string;
  /** Whether an override was applied */
  wasOverridden: boolean;
}

/** Worker definition */
export interface WorkerDefinition {
  /** Worker type */
  type: WorkerType;
  /** Keywords that trigger this worker */
  keywords: string[];
  /** Section types this worker handles */
  sectionTypes: string[];
  /** Description */
  description: string;
}

/** Router configuration */
export interface RouterConfig {
  /** Worker definitions */
  workers: WorkerDefinition[];
  /** Default worker when no match */
  defaultWorker: WorkerType;
  /** Minimum confidence to route (below this → default) */
  minConfidence: number;
}

/** Batch routing result */
export interface BatchRoutingResult {
  /** All routing decisions */
  decisions: RoutingDecision[];
  /** Tasks grouped by worker */
  groups: Map<WorkerType, RoutableTask[]>;
  /** Worker distribution summary */
  distribution: Record<WorkerType, number>;
}

// =============================================================================
// Default Workers
// =============================================================================

export const LAYOUT_WORKER: WorkerDefinition = {
  type: "layout",
  keywords: [
    "layout", "grid", "flex", "column", "row", "position", "align",
    "spacing", "margin", "padding", "width", "height", "responsive",
    "breakpoint", "container", "section", "sidebar", "header", "footer",
    "navbar", "navigation", "structure", "arrange", "reorder",
  ],
  sectionTypes: [
    "hero", "header", "footer", "navbar", "sidebar",
    "grid", "masonry", "split", "columns",
  ],
  description: "Handles layout, positioning, and structural tasks",
};

export const CONTENT_WORKER: WorkerDefinition = {
  type: "content",
  keywords: [
    "text", "heading", "paragraph", "title", "copy", "description",
    "content", "write", "blog", "article", "testimonial", "review",
    "faq", "about", "team", "bio", "story", "feature", "benefit",
    "list", "bullet", "card", "pricing", "plan", "cta", "call to action",
  ],
  sectionTypes: [
    "features", "testimonials", "faq", "about", "team",
    "blog", "pricing", "cta", "content", "cards",
  ],
  description: "Handles text content, copywriting, and information tasks",
};

export const STYLE_WORKER: WorkerDefinition = {
  type: "style",
  keywords: [
    "color", "font", "typography", "theme", "brand", "palette",
    "gradient", "shadow", "border", "radius", "opacity", "dark mode",
    "light mode", "accent", "primary", "secondary", "background",
    "foreground", "contrast", "scss", "css", "style", "design token",
  ],
  sectionTypes: [],
  description: "Handles visual styling, theming, and design token tasks",
};

export const INTERACTION_WORKER: WorkerDefinition = {
  type: "interaction",
  keywords: [
    "animation", "transition", "hover", "click", "scroll", "parallax",
    "carousel", "slider", "modal", "dropdown", "accordion", "tab",
    "toggle", "form", "input", "button", "interactive", "drag",
    "swipe", "gesture",
  ],
  sectionTypes: [
    "carousel", "slider", "accordion", "tabs", "modal", "form",
    "contact", "newsletter", "search",
  ],
  description: "Handles interactive elements, animations, and user interactions",
};

export const DEFAULT_WORKERS: WorkerDefinition[] = [
  LAYOUT_WORKER,
  CONTENT_WORKER,
  STYLE_WORKER,
  INTERACTION_WORKER,
];

export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  workers: DEFAULT_WORKERS,
  defaultWorker: "general",
  minConfidence: 0.3,
};

// =============================================================================
// Routing Logic
// =============================================================================

/**
 * Scores a task against a worker definition.
 * Returns a confidence score 0-1.
 */
export function scoreWorker(task: RoutableTask, worker: WorkerDefinition): number {
  let score = 0;
  let maxPossible = 0;

  const desc = task.description.toLowerCase();
  const tags = (task.tags ?? []).map((t) => t.toLowerCase());

  // Keyword matching (up to 0.6)
  maxPossible += 0.6;
  const keywordMatches = worker.keywords.filter(
    (kw) => desc.includes(kw) || tags.some((t) => t.includes(kw)),
  ).length;
  if (keywordMatches > 0) {
    score += Math.min(0.6, keywordMatches * 0.15);
  }

  // Section type matching (up to 0.4)
  maxPossible += 0.4;
  if (task.sectionType && worker.sectionTypes.includes(task.sectionType.toLowerCase())) {
    score += 0.4;
  }

  return maxPossible > 0 ? Math.min(1, score) : 0;
}

/**
 * Routes a single task to the best worker.
 */
export function routeTask(
  task: RoutableTask,
  config: RouterConfig = DEFAULT_ROUTER_CONFIG,
): RoutingDecision {
  // Check for explicit override
  if (task.workerOverride) {
    return {
      taskId: task.id,
      worker: task.workerOverride,
      confidence: 1,
      reason: `Explicit override to ${task.workerOverride} worker`,
      wasOverridden: true,
    };
  }

  // Score each worker
  let bestWorker: WorkerType = config.defaultWorker;
  let bestScore = 0;
  let bestReason = "No matching worker found; using default";

  for (const worker of config.workers) {
    const s = scoreWorker(task, worker);
    if (s > bestScore) {
      bestScore = s;
      bestWorker = worker.type;
      bestReason = `Matched ${worker.type} worker (${worker.description})`;
    }
  }

  if (bestScore < config.minConfidence) {
    return {
      taskId: task.id,
      worker: config.defaultWorker,
      confidence: bestScore,
      reason: `Low confidence (${bestScore.toFixed(2)}); routing to default`,
      wasOverridden: false,
    };
  }

  return {
    taskId: task.id,
    worker: bestWorker,
    confidence: bestScore,
    reason: bestReason,
    wasOverridden: false,
  };
}

/**
 * Routes multiple tasks and groups them by worker.
 */
export function routeBatch(
  tasks: RoutableTask[],
  config: RouterConfig = DEFAULT_ROUTER_CONFIG,
): BatchRoutingResult {
  const decisions = tasks.map((t) => routeTask(t, config));
  const groups = new Map<WorkerType, RoutableTask[]>();
  const distribution: Record<string, number> = {};

  for (let i = 0; i < tasks.length; i++) {
    const worker = decisions[i].worker;
    if (!groups.has(worker)) groups.set(worker, []);
    groups.get(worker)!.push(tasks[i]);
    distribution[worker] = (distribution[worker] ?? 0) + 1;
  }

  return {
    decisions,
    groups,
    distribution: distribution as Record<WorkerType, number>,
  };
}
