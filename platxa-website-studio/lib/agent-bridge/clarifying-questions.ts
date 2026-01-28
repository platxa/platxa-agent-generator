/**
 * Clarifying Question Generator
 *
 * Detects ambiguous or underspecified requests and generates targeted
 * clarifying questions instead of blindly generating output.
 * Prevents wasted generation cycles by gathering intent upfront.
 */

// =============================================================================
// Types
// =============================================================================

/** A dimension of ambiguity detected in a request */
export type AmbiguityDimension =
  | "target"       // What to change is unclear
  | "scope"        // How much to change is unclear
  | "style"        // Visual direction is unclear
  | "content"      // Content/copy is unclear
  | "behavior"     // Interaction behavior is unclear
  | "constraint";  // Technical constraints are unclear

/** A generated clarifying question */
export interface ClarifyingQuestion {
  /** The question text */
  question: string;
  /** Which ambiguity dimension this addresses */
  dimension: AmbiguityDimension;
  /** Suggested answer options (if applicable) */
  options?: string[];
  /** Priority (1 = most important to clarify) */
  priority: number;
}

/** Result of analyzing a request for ambiguity */
export interface AmbiguityAnalysis {
  /** The original request */
  request: string;
  /** Whether the request is ambiguous enough to need clarification */
  needsClarification: boolean;
  /** Ambiguity score (0 = perfectly clear, 1 = completely ambiguous) */
  ambiguityScore: number;
  /** Detected ambiguity dimensions */
  dimensions: AmbiguityDimension[];
  /** Generated clarifying questions, ordered by priority */
  questions: ClarifyingQuestion[];
}

// =============================================================================
// Ambiguity Detection Patterns
// =============================================================================

interface AmbiguityPattern {
  /** Regex or keyword test */
  test: (text: string) => boolean;
  /** Which dimension this pattern indicates */
  dimension: AmbiguityDimension;
  /** Weight contribution to ambiguity score */
  weight: number;
  /** Question to ask when this pattern matches */
  question: string;
  /** Optional answer choices */
  options?: string[];
}

const AMBIGUITY_PATTERNS: AmbiguityPattern[] = [
  // Vague improvement requests
  {
    test: (t) => /\b(make it|make this)\s+(better|nicer|good|great|cool|awesome|prettier)\b/i.test(t),
    dimension: "scope",
    weight: 0.4,
    question: "What specific aspect would you like improved?",
    options: ["Visual design", "Content/copy", "Layout/spacing", "Colors", "Typography", "Performance"],
  },
  {
    test: (t) => /\b(improve|enhance|upgrade|fix)\b/i.test(t) && t.split(/\s+/).length < 6,
    dimension: "scope",
    weight: 0.3,
    question: "Could you describe what specifically needs improvement?",
  },
  // Missing target
  {
    test: (t) => /\b(change|update|modify|edit)\b/i.test(t) && !/\b(header|footer|hero|section|nav|button|form|page|color|font|image)\b/i.test(t),
    dimension: "target",
    weight: 0.35,
    question: "Which section or element should be changed?",
    options: ["Header/Navigation", "Hero section", "Content sections", "Footer", "Entire page"],
  },
  // Vague style direction
  {
    test: (t) => /\b(modern|clean|professional|elegant|minimal|bold|sleek)\b/i.test(t) && !/\b(color|font|spacing|layout)\b/i.test(t),
    dimension: "style",
    weight: 0.35,
    question: "What visual style are you envisioning?",
    options: ["Corporate/professional", "Creative/artistic", "Minimalist/clean", "Bold/vibrant", "Warm/friendly"],
  },
  // Missing content details
  {
    test: (t) => /\b(add|create|build|generate)\s+(a |an |the )?(section|page|block)\b/i.test(t) && t.split(/\s+/).length < 8,
    dimension: "content",
    weight: 0.3,
    question: "What content should this section include?",
    options: ["Text with heading", "Image gallery", "Feature list", "Testimonials", "Call to action", "Contact form"],
  },
  // Ambiguous color requests
  {
    test: (t) => /\b(change|update|new)\s+(the\s+)?color/i.test(t) && !/#[0-9a-f]{3,8}\b/i.test(t) && !/\b(red|blue|green|yellow|purple|orange|pink|black|white|gray|grey)\b/i.test(t),
    dimension: "style",
    weight: 0.2,
    question: "Which color would you like to use?",
    options: ["Warm tones (red/orange/yellow)", "Cool tones (blue/green/purple)", "Neutral (gray/black/white)", "Brand colors"],
  },
  // Missing behavioral details
  {
    test: (t) => /\b(interactive|animation|hover|click|scroll)\b/i.test(t) && t.split(/\s+/).length < 8,
    dimension: "behavior",
    weight: 0.25,
    question: "What interaction behavior do you want?",
    options: ["Hover effects", "Scroll animations", "Click actions", "Page transitions", "Loading states"],
  },
  // Completely vague
  {
    test: (t) => t.split(/\s+/).length <= 3,
    dimension: "scope",
    weight: 0.5,
    question: "Could you provide more details about what you'd like?",
  },
  // Missing technical constraints
  {
    test: (t) => /\b(responsive|mobile|tablet|desktop)\b/i.test(t) && /\b(only|just|specific)\b/i.test(t),
    dimension: "constraint",
    weight: 0.2,
    question: "Which device sizes should be targeted?",
    options: ["Mobile only (<768px)", "Tablet and below (<1024px)", "Desktop only (>1024px)", "All devices"],
  },
];

// =============================================================================
// Analysis
// =============================================================================

/**
 * Analyzes a request for ambiguity and generates clarifying questions.
 * Returns an analysis with ambiguity score and prioritized questions.
 *
 * Ambiguous prompts like "make it better" will trigger clarification
 * instead of blind generation.
 */
export function analyzeAmbiguity(request: string): AmbiguityAnalysis {
  const trimmed = request.trim();

  if (!trimmed) {
    return {
      request: trimmed,
      needsClarification: true,
      ambiguityScore: 1,
      dimensions: ["scope"],
      questions: [{
        question: "What would you like to create or modify?",
        dimension: "scope",
        priority: 1,
      }],
    };
  }

  const matchedPatterns: AmbiguityPattern[] = [];

  for (const pattern of AMBIGUITY_PATTERNS) {
    if (pattern.test(trimmed)) {
      matchedPatterns.push(pattern);
    }
  }

  if (matchedPatterns.length === 0) {
    return {
      request: trimmed,
      needsClarification: false,
      ambiguityScore: 0,
      dimensions: [],
      questions: [],
    };
  }

  // Calculate ambiguity score (capped at 1)
  const rawScore = matchedPatterns.reduce((sum, p) => sum + p.weight, 0);
  const ambiguityScore = Math.min(1, Math.round(rawScore * 100) / 100);

  // Deduplicate dimensions
  const dimensions = [...new Set(matchedPatterns.map((p) => p.dimension))];

  // Build questions sorted by priority (weight descending)
  const questions: ClarifyingQuestion[] = matchedPatterns
    .sort((a, b) => b.weight - a.weight)
    .map((p, i) => ({
      question: p.question,
      dimension: p.dimension,
      options: p.options,
      priority: i + 1,
    }));

  // Deduplicate questions by text
  const seen = new Set<string>();
  const uniqueQuestions = questions.filter((q) => {
    if (seen.has(q.question)) return false;
    seen.add(q.question);
    return true;
  });

  // Threshold: need clarification if score >= 0.3
  const needsClarification = ambiguityScore >= 0.3;

  return {
    request: trimmed,
    needsClarification,
    ambiguityScore,
    dimensions,
    questions: uniqueQuestions,
  };
}

/**
 * Quick check: returns true if the request needs clarification.
 */
export function needsClarification(request: string): boolean {
  return analyzeAmbiguity(request).needsClarification;
}

/**
 * Returns the top N clarifying questions for an ambiguous request.
 * Returns empty array if the request is clear enough.
 */
export function getClarifyingQuestions(
  request: string,
  maxQuestions = 3,
): ClarifyingQuestion[] {
  const analysis = analyzeAmbiguity(request);
  if (!analysis.needsClarification) return [];
  return analysis.questions.slice(0, maxQuestions);
}
