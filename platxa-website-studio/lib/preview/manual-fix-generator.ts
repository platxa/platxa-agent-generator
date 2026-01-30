/**
 * Manual Fix Suggestion Generator for Complex Errors
 *
 * Feature #155: Implement manual fix suggestion generation for complex errors
 * Verification: LLM generates step-by-step manual fix instructions
 *
 * Generates step-by-step manual fix instructions for complex errors that
 * cannot be automatically fixed. Provides clear, actionable guidance.
 */

// ============================================================================
// Types
// ============================================================================

/** Complexity level determining if manual intervention is needed */
export type ComplexityLevel = "simple" | "moderate" | "complex" | "expert";

/** Manual fix step priority */
export type StepPriority = "required" | "recommended" | "optional";

/** Fix step category */
export type StepCategory =
  | "diagnosis"
  | "preparation"
  | "implementation"
  | "verification"
  | "cleanup";

/** Individual step in manual fix process */
export interface ManualFixStep {
  /** Step number (1-based) */
  stepNumber: number;
  /** Step title */
  title: string;
  /** Detailed instruction */
  instruction: string;
  /** Code example if applicable */
  codeExample?: string;
  /** Expected outcome after this step */
  expectedOutcome?: string;
  /** Warning or caution for this step */
  warning?: string;
  /** Priority of this step */
  priority: StepPriority;
  /** Category of this step */
  category: StepCategory;
  /** Estimated time in minutes */
  estimatedMinutes?: number;
}

/** Pre-requisites before starting fix */
export interface FixPrerequisite {
  /** Description of prerequisite */
  description: string;
  /** How to check if prerequisite is met */
  checkCommand?: string;
  /** What to do if prerequisite is not met */
  fallback?: string;
}

/** Manual fix suggestion for a complex error */
export interface ManualFixSuggestion {
  /** Unique ID */
  id: string;
  /** Error pattern this fixes */
  errorPattern: string;
  /** Short title for the fix */
  title: string;
  /** Brief description of the fix approach */
  summary: string;
  /** Complexity level */
  complexity: ComplexityLevel;
  /** Prerequisites before starting */
  prerequisites: FixPrerequisite[];
  /** Step-by-step instructions */
  steps: ManualFixStep[];
  /** Estimated total time in minutes */
  estimatedTotalMinutes: number;
  /** Skills required */
  requiredSkills: string[];
  /** Related documentation links */
  docLinks: string[];
  /** Common pitfalls to avoid */
  pitfalls: string[];
  /** How to verify the fix worked */
  verification: string[];
  /** Timestamp */
  timestamp: number;
}

/** Error requiring manual fix */
export interface ComplexError {
  /** Error message */
  message: string;
  /** Error type */
  type?: string;
  /** Error code */
  code?: string;
  /** File path */
  file?: string;
  /** Line number */
  line?: number;
  /** Code snippet */
  snippet?: string;
  /** Stack trace */
  stack?: string;
  /** Why auto-fix is not possible */
  autoFixBlocker?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/** Generator configuration */
export interface ManualFixGeneratorConfig {
  /** Include code examples */
  includeCodeExamples?: boolean;
  /** Include time estimates */
  includeTimeEstimates?: boolean;
  /** Include verification steps */
  includeVerification?: boolean;
  /** Max steps per suggestion */
  maxSteps?: number;
  /** Verbosity level */
  verbosity?: "minimal" | "standard" | "detailed";
}

// ============================================================================
// Constants
// ============================================================================

/** Default configuration */
export const DEFAULT_CONFIG: Required<ManualFixGeneratorConfig> = {
  includeCodeExamples: true,
  includeTimeEstimates: true,
  includeVerification: true,
  maxSteps: 10,
  verbosity: "standard",
};

/** Complexity thresholds */
export const COMPLEXITY_THRESHOLDS = {
  simple: { maxSteps: 3, maxMinutes: 10 },
  moderate: { maxSteps: 5, maxMinutes: 30 },
  complex: { maxSteps: 8, maxMinutes: 60 },
  expert: { maxSteps: 15, maxMinutes: 120 },
} as const;

// ============================================================================
// Fix Templates
// ============================================================================

/** Template for generating manual fix instructions */
export interface FixTemplate {
  /** Template ID */
  id: string;
  /** Error patterns this template matches */
  patterns: RegExp[];
  /** Complexity level */
  complexity: ComplexityLevel;
  /** Required skills */
  skills: string[];
  /** Generate fix suggestion from error */
  generate: (error: ComplexError, captures: RegExpMatchArray | null) => Partial<ManualFixSuggestion>;
}

/** Built-in fix templates for common complex errors */
export const FIX_TEMPLATES: FixTemplate[] = [
  // Circular dependency errors
  {
    id: "circular-dependency",
    patterns: [
      /circular dependency|cyclic import|circular import/i,
      /dependency cycle detected/i,
    ],
    complexity: "complex",
    skills: ["Module architecture", "Dependency management"],
    generate: (error, _captures) => ({
      title: "Resolve Circular Dependency",
      summary: "Break the circular import cycle by restructuring module dependencies",
      prerequisites: [
        {
          description: "Identify all modules involved in the cycle",
          checkCommand: "Check build output for full dependency chain",
        },
      ],
      steps: [
        {
          stepNumber: 1,
          title: "Map the dependency cycle",
          instruction: "Draw or list the import chain: A → B → C → A. Identify which import creates the cycle.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 2,
          title: "Identify shared interfaces",
          instruction: "Look for shared types or interfaces that both modules need. These should be extracted.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 3,
          title: "Create a shared types module",
          instruction: "Create a new file (e.g., 'types.ts' or 'shared.ts') to hold interfaces and types used by multiple modules.",
          codeExample: `// shared/types.ts
export interface SharedInterface {
  // Move shared type definitions here
}`,
          category: "preparation",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 4,
          title: "Extract shared dependencies",
          instruction: "Move the types/interfaces causing the cycle to the shared module.",
          category: "implementation",
          priority: "required",
          estimatedMinutes: 15,
        },
        {
          stepNumber: 5,
          title: "Update imports in both modules",
          instruction: "Change imports in both modules to use the new shared module instead of importing from each other.",
          category: "implementation",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 6,
          title: "Consider dependency injection",
          instruction: "If the cycle is due to runtime dependencies, consider using dependency injection or lazy imports.",
          codeExample: `// Instead of direct import at top:
// import { Service } from './service';

// Use lazy import:
const getService = () => import('./service').then(m => m.Service);`,
          category: "implementation",
          priority: "recommended",
          estimatedMinutes: 10,
        },
      ],
      pitfalls: [
        "Don't just suppress the warning - fix the underlying architecture",
        "Avoid creating a 'god module' that everything depends on",
        "Watch out for barrel exports (index.ts) that can hide cycles",
      ],
      verification: [
        "Build completes without circular dependency warnings",
        "All imports resolve correctly",
        "Module tests still pass",
      ],
      docLinks: [
        "https://nodejs.org/api/modules.html#modules_cycles",
      ],
    }),
  },

  // Memory leak errors
  {
    id: "memory-leak",
    patterns: [
      /memory leak|heap out of memory|JavaScript heap/i,
      /detached.*DOM|orphan.*listener/i,
    ],
    complexity: "expert",
    skills: ["Memory profiling", "Browser DevTools", "React hooks"],
    generate: (error, _captures) => ({
      title: "Fix Memory Leak",
      summary: "Identify and fix memory leak by cleaning up resources and event listeners",
      prerequisites: [
        {
          description: "Chrome DevTools or equivalent memory profiling tools",
          checkCommand: "Open DevTools → Memory tab",
        },
        {
          description: "Reproducible scenario that causes memory growth",
        },
      ],
      steps: [
        {
          stepNumber: 1,
          title: "Take heap snapshots",
          instruction: "Open Chrome DevTools Memory tab. Take a heap snapshot, perform the action that leaks, take another snapshot.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 10,
          expectedOutcome: "Two snapshots showing memory difference",
        },
        {
          stepNumber: 2,
          title: "Compare snapshots",
          instruction: "Select the second snapshot and use 'Comparison' view to see objects allocated between snapshots.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 3,
          title: "Identify leaked objects",
          instruction: "Look for objects with high counts that shouldn't persist. Common culprits: detached DOM nodes, closures, event listeners.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 15,
        },
        {
          stepNumber: 4,
          title: "Check useEffect cleanup",
          instruction: "Ensure all useEffect hooks that subscribe to events or create resources return cleanup functions.",
          codeExample: `useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('resize', handler);

  // REQUIRED: Return cleanup function
  return () => {
    window.removeEventListener('resize', handler);
  };
}, []);`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 20,
        },
        {
          stepNumber: 5,
          title: "Clear intervals and timeouts",
          instruction: "Store interval/timeout IDs and clear them on unmount.",
          codeExample: `useEffect(() => {
  const intervalId = setInterval(update, 1000);
  return () => clearInterval(intervalId);
}, []);`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 6,
          title: "Abort pending requests",
          instruction: "Use AbortController to cancel fetch requests on unmount.",
          codeExample: `useEffect(() => {
  const controller = new AbortController();
  fetch(url, { signal: controller.signal });
  return () => controller.abort();
}, [url]);`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 15,
        },
        {
          stepNumber: 7,
          title: "Verify fix",
          instruction: "Repeat the heap snapshot comparison to confirm memory is now released.",
          category: "verification",
          priority: "required",
          estimatedMinutes: 10,
        },
      ],
      pitfalls: [
        "Don't rely only on component unmounting - some leaks persist",
        "Check for closures that capture large objects",
        "Watch for global state that grows unbounded",
        "Be careful with memoization that caches too much",
      ],
      verification: [
        "Heap size returns to baseline after component unmount",
        "No 'Detached' DOM nodes in heap snapshot",
        "Event listener count doesn't grow over time",
      ],
      docLinks: [
        "https://developer.chrome.com/docs/devtools/memory-problems/",
      ],
    }),
  },

  // Race condition errors
  {
    id: "race-condition",
    patterns: [
      /race condition|concurrent.*update|stale.*state/i,
      /state update on.*unmounted/i,
    ],
    complexity: "complex",
    skills: ["Async programming", "React state management"],
    generate: (error, _captures) => ({
      title: "Fix Race Condition",
      summary: "Prevent race conditions by properly handling async operations and state updates",
      prerequisites: [
        {
          description: "Understanding of async/await and Promise behavior",
        },
      ],
      steps: [
        {
          stepNumber: 1,
          title: "Identify the race",
          instruction: "Determine which async operations are racing. Common cases: multiple fetches, rapid user input, component unmount during fetch.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 2,
          title: "Add mounted check",
          instruction: "For React components, track mounted state and check before updating.",
          codeExample: `useEffect(() => {
  let isMounted = true;

  async function fetchData() {
    const data = await api.getData();
    if (isMounted) {
      setData(data);
    }
  }

  fetchData();
  return () => { isMounted = false; };
}, []);`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 3,
          title: "Use AbortController for fetch",
          instruction: "Cancel previous requests when a new one starts.",
          codeExample: `useEffect(() => {
  const controller = new AbortController();

  fetch(url, { signal: controller.signal })
    .then(res => res.json())
    .then(setData)
    .catch(err => {
      if (err.name !== 'AbortError') throw err;
    });

  return () => controller.abort();
}, [url]);`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 15,
        },
        {
          stepNumber: 4,
          title: "Implement request deduplication",
          instruction: "For rapid requests (e.g., search), debounce or use latest-only pattern.",
          codeExample: `// Latest-only pattern
let latestRequestId = 0;

async function search(query) {
  const requestId = ++latestRequestId;
  const results = await api.search(query);

  // Only use results if this is still the latest request
  if (requestId === latestRequestId) {
    setResults(results);
  }
}`,
          category: "implementation",
          priority: "recommended",
          estimatedMinutes: 15,
        },
        {
          stepNumber: 5,
          title: "Consider using React Query or SWR",
          instruction: "These libraries handle race conditions, caching, and deduplication automatically.",
          category: "implementation",
          priority: "optional",
          estimatedMinutes: 30,
        },
      ],
      pitfalls: [
        "Don't just ignore the error - it can cause data corruption",
        "Be aware that cleanup runs after the new effect starts",
        "State updates in cleanup functions don't work as expected",
      ],
      verification: [
        "No console warnings about state updates on unmounted components",
        "Rapid actions don't cause data inconsistency",
        "Component displays correct data after navigation",
      ],
      docLinks: [
        "https://react.dev/learn/you-might-not-need-an-effect",
      ],
    }),
  },

  // Type mismatch in complex generics
  {
    id: "complex-generics",
    patterns: [
      /type.*is not assignable.*generic/i,
      /infer.*type parameter|constraint.*not satisfied/i,
    ],
    complexity: "complex",
    skills: ["TypeScript generics", "Type inference"],
    generate: (error, _captures) => ({
      title: "Fix Complex Generic Type Mismatch",
      summary: "Resolve generic type constraints and inference issues",
      prerequisites: [
        {
          description: "Understanding of TypeScript generics and constraints",
        },
      ],
      steps: [
        {
          stepNumber: 1,
          title: "Understand the expected type",
          instruction: "Read the error carefully. Note the expected type and the actual type provided.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 2,
          title: "Check type parameter constraints",
          instruction: "Look at the generic function/type definition. Understand what constraints (extends clauses) are required.",
          codeExample: `// If the function is:
function process<T extends { id: string }>(item: T): T

// Your type must have 'id: string'`,
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 3,
          title: "Provide explicit type arguments",
          instruction: "If TypeScript can't infer the type, provide it explicitly.",
          codeExample: `// Instead of:
const result = process(item);

// Explicitly specify:
const result = process<MyType>(item);`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 4,
          title: "Add type assertions if needed",
          instruction: "Use 'as' assertion when you know more than TypeScript about the type.",
          codeExample: `// When you're sure of the type:
const result = data as ExpectedType;

// Or use satisfies for validation:
const config = { ... } satisfies ConfigType;`,
          category: "implementation",
          priority: "recommended",
          estimatedMinutes: 10,
          warning: "Use assertions sparingly - they bypass type checking",
        },
        {
          stepNumber: 5,
          title: "Consider redesigning the types",
          instruction: "Sometimes the type system is telling you the design is problematic. Consider if the types can be simplified.",
          category: "implementation",
          priority: "optional",
          estimatedMinutes: 20,
        },
      ],
      pitfalls: [
        "Don't use 'any' to silence the error - it hides bugs",
        "Be careful with type assertions - they can hide real issues",
        "Complex generics might indicate over-engineering",
      ],
      verification: [
        "No type errors in the affected code",
        "Types provide meaningful autocomplete",
        "Related code still type-checks correctly",
      ],
      docLinks: [
        "https://www.typescriptlang.org/docs/handbook/2/generics.html",
      ],
    }),
  },

  // Build configuration errors
  {
    id: "build-config",
    patterns: [
      /webpack|vite|rollup|esbuild.*config/i,
      /module not found.*resolve|cannot find module/i,
      /loader.*not found|plugin.*error/i,
    ],
    complexity: "moderate",
    skills: ["Build tools", "Module resolution"],
    generate: (error, _captures) => ({
      title: "Fix Build Configuration",
      summary: "Resolve build tool configuration issues for proper module resolution",
      prerequisites: [
        {
          description: "Access to project build configuration files",
        },
      ],
      steps: [
        {
          stepNumber: 1,
          title: "Check the module path",
          instruction: "Verify the import path is correct. Check for typos, wrong extension, or incorrect relative path.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 2,
          title: "Verify the file exists",
          instruction: "Confirm the file exists at the expected location. Check for case-sensitivity issues on different OS.",
          checkCommand: "ls -la path/to/file",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 3,
          title: "Check path aliases",
          instruction: "If using path aliases (@/components), verify they're configured in both tsconfig.json and vite.config.ts.",
          codeExample: `// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// vite.config.ts
export default {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
}`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 4,
          title: "Check file extensions",
          instruction: "Ensure the build tool knows how to handle the file extension. Add appropriate loaders/plugins if needed.",
          category: "implementation",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 5,
          title: "Clear build cache",
          instruction: "Sometimes stale cache causes issues. Clear and rebuild.",
          codeExample: `# Delete cache directories
rm -rf node_modules/.vite
rm -rf .cache
npm run build`,
          category: "cleanup",
          priority: "recommended",
          estimatedMinutes: 5,
        },
      ],
      pitfalls: [
        "Remember that build tool config changes may require restart",
        "Path aliases must match between tsconfig and build tool",
        "Case sensitivity differs between OS (Linux is case-sensitive)",
      ],
      verification: [
        "Build completes without module resolution errors",
        "Dev server starts correctly",
        "IDE recognizes the imports",
      ],
      docLinks: [
        "https://vitejs.dev/config/shared-options.html#resolve-alias",
      ],
    }),
  },

  // Database/ORM errors
  {
    id: "database-migration",
    patterns: [
      /migration.*failed|schema.*mismatch/i,
      /foreign key.*constraint|duplicate.*key/i,
    ],
    complexity: "expert",
    skills: ["Database management", "SQL", "ORM"],
    generate: (error, _captures) => ({
      title: "Fix Database Migration Issue",
      summary: "Resolve database schema migration conflicts and constraints",
      prerequisites: [
        {
          description: "Database backup available",
          checkCommand: "Ensure you have a recent backup before proceeding",
        },
        {
          description: "Access to database admin tools",
        },
      ],
      steps: [
        {
          stepNumber: 1,
          title: "Backup current state",
          instruction: "Before any changes, backup the database. This is critical for recovery.",
          codeExample: `# PostgreSQL
pg_dump dbname > backup.sql

# MySQL
mysqldump -u user -p dbname > backup.sql`,
          category: "preparation",
          priority: "required",
          estimatedMinutes: 5,
          warning: "Do not skip this step - data loss is possible",
        },
        {
          stepNumber: 2,
          title: "Check migration status",
          instruction: "Review which migrations have run and which are pending.",
          codeExample: `# Prisma
npx prisma migrate status

# Drizzle
npx drizzle-kit status`,
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 3,
          title: "Identify the conflict",
          instruction: "Determine if the issue is: missing migration, failed migration, or schema drift.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 4,
          title: "Handle constraint violations",
          instruction: "For foreign key or unique constraint errors, you may need to clean up data before migrating.",
          codeExample: `-- Find orphan records
SELECT * FROM child_table
WHERE parent_id NOT IN (SELECT id FROM parent_table);

-- Remove orphans (carefully!)
DELETE FROM child_table
WHERE parent_id NOT IN (SELECT id FROM parent_table);`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 20,
          warning: "Verify you won't lose important data",
        },
        {
          stepNumber: 5,
          title: "Apply pending migrations",
          instruction: "Run migrations in order once conflicts are resolved.",
          codeExample: `# Prisma
npx prisma migrate deploy

# Or reset in development
npx prisma migrate reset`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 6,
          title: "Verify schema integrity",
          instruction: "Confirm the schema matches the expected state.",
          category: "verification",
          priority: "required",
          estimatedMinutes: 5,
        },
      ],
      pitfalls: [
        "Never run 'reset' on production databases",
        "Don't delete migration history files",
        "Be careful with cascade deletes",
        "Test migrations on a copy first",
      ],
      verification: [
        "All migrations show as applied",
        "Application can read/write to affected tables",
        "No constraint violation errors",
      ],
      docLinks: [
        "https://www.prisma.io/docs/concepts/components/prisma-migrate",
      ],
    }),
  },

  // Authentication/Authorization errors
  {
    id: "auth-error",
    patterns: [
      /unauthorized|forbidden|401|403/i,
      /token.*expired|invalid.*token|jwt/i,
      /permission denied|access denied/i,
    ],
    complexity: "moderate",
    skills: ["Authentication", "Security"],
    generate: (error, _captures) => ({
      title: "Fix Authentication/Authorization Error",
      summary: "Resolve authentication token or permission issues",
      prerequisites: [
        {
          description: "Access to authentication system configuration",
        },
      ],
      steps: [
        {
          stepNumber: 1,
          title: "Check token validity",
          instruction: "Inspect the token to see if it's expired, malformed, or missing claims.",
          codeExample: `// Decode JWT (don't verify, just inspect)
// Use jwt.io or:
const [header, payload] = token.split('.').slice(0, 2);
console.log(JSON.parse(atob(payload)));`,
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 2,
          title: "Verify token is being sent",
          instruction: "Check network requests to confirm the Authorization header is present.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 3,
          title: "Check token format",
          instruction: "Ensure the token is sent with correct prefix (Bearer, Basic, etc.)",
          codeExample: `// Correct format:
headers: {
  'Authorization': 'Bearer eyJhbG...'
}

// NOT just the token:
// 'Authorization': 'eyJhbG...'  ❌`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 4,
          title: "Implement token refresh",
          instruction: "If token is expired, implement automatic refresh before requests.",
          codeExample: `async function fetchWithAuth(url) {
  let token = getToken();

  if (isTokenExpired(token)) {
    token = await refreshToken();
  }

  return fetch(url, {
    headers: { Authorization: \`Bearer \${token}\` }
  });
}`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 20,
        },
        {
          stepNumber: 5,
          title: "Check user permissions",
          instruction: "For 403 errors, verify the user has the required role/permission for the resource.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 10,
        },
      ],
      pitfalls: [
        "Never log full tokens in production",
        "Don't store tokens in localStorage if possible (use httpOnly cookies)",
        "Remember tokens can be revoked server-side",
      ],
      verification: [
        "Requests return 200/2xx status",
        "Token is present in request headers",
        "User can access expected resources",
      ],
      docLinks: [
        "https://jwt.io/introduction",
      ],
    }),
  },

  // SSR/Hydration errors
  {
    id: "ssr-hydration",
    patterns: [
      /hydration.*mismatch|server.*client.*differ/i,
      /text content does not match|expected server html/i,
      /window is not defined|document is not defined/i,
    ],
    complexity: "complex",
    skills: ["SSR", "React hydration", "Next.js/Nuxt"],
    generate: (error, _captures) => ({
      title: "Fix SSR Hydration Mismatch",
      summary: "Resolve server-side rendering and client hydration inconsistencies",
      prerequisites: [
        {
          description: "Understanding of SSR and hydration process",
        },
      ],
      steps: [
        {
          stepNumber: 1,
          title: "Identify the mismatched content",
          instruction: "Look at the error message to find what differs between server and client render.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 2,
          title: "Check for browser-only APIs",
          instruction: "Wrap browser API usage (window, document, localStorage) in client-side checks.",
          codeExample: `// ❌ Wrong - crashes on server
const width = window.innerWidth;

// ✅ Correct - check for client
const width = typeof window !== 'undefined'
  ? window.innerWidth
  : 0;

// Or use useEffect (runs only on client)
useEffect(() => {
  setWidth(window.innerWidth);
}, []);`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 3,
          title: "Handle dynamic content",
          instruction: "For content that must differ (timestamps, random IDs), use suppressHydrationWarning or client-only rendering.",
          codeExample: `// For unavoidable differences:
<time suppressHydrationWarning>
  {new Date().toISOString()}
</time>

// Or render only on client:
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);

if (!mounted) return null; // or skeleton
return <DynamicContent />;`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 15,
        },
        {
          stepNumber: 4,
          title: "Use dynamic imports for client-only components",
          instruction: "Import components that use browser APIs dynamically with SSR disabled.",
          codeExample: `// Next.js
import dynamic from 'next/dynamic';

const MapComponent = dynamic(
  () => import('./Map'),
  { ssr: false }
);`,
          category: "implementation",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 5,
          title: "Check for non-deterministic rendering",
          instruction: "Ensure Math.random(), Date.now(), or UUIDs aren't used during initial render.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 10,
        },
      ],
      pitfalls: [
        "Don't use suppressHydrationWarning carelessly - it hides real bugs",
        "Remember useEffect doesn't run on server",
        "Check that all data is identical between server and client",
      ],
      verification: [
        "No hydration mismatch warnings in console",
        "Page renders correctly on both server and client",
        "Interactive elements work after hydration",
      ],
      docLinks: [
        "https://react.dev/reference/react-dom/hydrate#suppressing-unavoidable-hydration-mismatch-errors",
      ],
    }),
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Detect complexity level of an error
 */
export function detectComplexity(error: ComplexError): ComplexityLevel {
  const message = error.message.toLowerCase();

  // Expert level indicators
  if (
    message.includes("memory") ||
    message.includes("heap") ||
    message.includes("migration") ||
    message.includes("deadlock") ||
    message.includes("race condition")
  ) {
    return "expert";
  }

  // Complex level indicators
  if (
    message.includes("circular") ||
    message.includes("hydration") ||
    message.includes("generic") ||
    message.includes("async") ||
    (error.stack && error.stack.split("\n").length > 10)
  ) {
    return "complex";
  }

  // Moderate level indicators
  if (
    message.includes("config") ||
    message.includes("module not found") ||
    message.includes("401") ||
    message.includes("403")
  ) {
    return "moderate";
  }

  return "simple";
}

/**
 * Find matching template for error
 */
export function findMatchingTemplate(error: ComplexError): { template: FixTemplate; captures: RegExpMatchArray | null } | null {
  for (const template of FIX_TEMPLATES) {
    for (const pattern of template.patterns) {
      const match = error.message.match(pattern);
      if (match) {
        return { template, captures: match };
      }
    }
  }
  return null;
}

/**
 * Calculate total estimated time from steps
 */
export function calculateTotalTime(steps: ManualFixStep[]): number {
  return steps.reduce((total, step) => total + (step.estimatedMinutes || 5), 0);
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `mfx-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// ManualFixGenerator Class
// ============================================================================

/**
 * Generator for manual fix suggestions
 */
export class ManualFixGenerator {
  private config: Required<ManualFixGeneratorConfig>;
  private templates: FixTemplate[];
  private disposed = false;

  constructor(config: ManualFixGeneratorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.templates = [...FIX_TEMPLATES];
  }

  /**
   * Find matching template from instance templates (not global)
   */
  private findTemplate(error: ComplexError): { template: FixTemplate; captures: RegExpMatchArray | null } | null {
    for (const template of this.templates) {
      for (const pattern of template.patterns) {
        const match = error.message.match(pattern);
        if (match) {
          return { template, captures: match };
        }
      }
    }
    return null;
  }

  /**
   * Generate manual fix suggestion for a complex error
   */
  generate(error: ComplexError): ManualFixSuggestion | null {
    if (this.disposed) {
      throw new Error("ManualFixGenerator is disposed");
    }

    // Find matching template from instance templates (supports custom templates)
    const match = this.findTemplate(error);

    if (!match) {
      return this.generateGenericSuggestion(error);
    }

    const { template, captures } = match;
    const templateSuggestion = template.generate(error, captures);

    // Build full suggestion from template
    const suggestion: ManualFixSuggestion = {
      id: generateId(),
      errorPattern: error.message.substring(0, 100),
      title: templateSuggestion.title || "Fix Error",
      summary: templateSuggestion.summary || "Follow these steps to resolve the error",
      complexity: template.complexity,
      prerequisites: templateSuggestion.prerequisites || [],
      steps: this.filterSteps(templateSuggestion.steps || []),
      estimatedTotalMinutes: calculateTotalTime(templateSuggestion.steps || []),
      requiredSkills: template.skills,
      docLinks: templateSuggestion.docLinks || [],
      pitfalls: templateSuggestion.pitfalls || [],
      verification: templateSuggestion.verification || [],
      timestamp: Date.now(),
    };

    return this.applyConfig(suggestion);
  }

  /**
   * Generate generic suggestion when no template matches
   */
  private generateGenericSuggestion(error: ComplexError): ManualFixSuggestion {
    const complexity = detectComplexity(error);

    return {
      id: generateId(),
      errorPattern: error.message.substring(0, 100),
      title: "Debug and Fix Error",
      summary: "No specific fix template available. Follow general debugging steps.",
      complexity,
      prerequisites: [],
      steps: [
        {
          stepNumber: 1,
          title: "Read the error message carefully",
          instruction: `The error says: "${error.message}". Identify the key terms and what component/file is affected.`,
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 2,
          title: "Check the stack trace",
          instruction: "Look at the stack trace to find where the error originates in your code (not library code).",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 5,
        },
        {
          stepNumber: 3,
          title: "Search for the error",
          instruction: "Search the error message online. Check Stack Overflow, GitHub issues, and official documentation.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 10,
        },
        {
          stepNumber: 4,
          title: "Isolate the issue",
          instruction: "Try to create a minimal reproduction. Comment out code until the error disappears, then add back to find the cause.",
          category: "diagnosis",
          priority: "required",
          estimatedMinutes: 15,
        },
        {
          stepNumber: 5,
          title: "Apply the fix",
          instruction: "Based on your research, implement the appropriate fix.",
          category: "implementation",
          priority: "required",
          estimatedMinutes: 15,
        },
        {
          stepNumber: 6,
          title: "Verify the fix",
          instruction: "Confirm the error is resolved and no new issues were introduced.",
          category: "verification",
          priority: "required",
          estimatedMinutes: 5,
        },
      ],
      estimatedTotalMinutes: 55,
      requiredSkills: ["Debugging", "Research"],
      docLinks: [],
      pitfalls: [
        "Don't just copy solutions without understanding them",
        "Make sure the fix addresses the root cause, not just symptoms",
      ],
      verification: [
        "Error no longer appears",
        "Application functions correctly",
        "No new errors introduced",
      ],
      timestamp: Date.now(),
    };
  }

  /**
   * Filter steps based on config
   */
  private filterSteps(steps: ManualFixStep[]): ManualFixStep[] {
    let filtered = steps;

    // Limit number of steps
    if (filtered.length > this.config.maxSteps) {
      // Keep required steps, then recommended, then optional
      const required = filtered.filter(s => s.priority === "required");
      const recommended = filtered.filter(s => s.priority === "recommended");
      const optional = filtered.filter(s => s.priority === "optional");

      filtered = [...required, ...recommended, ...optional].slice(0, this.config.maxSteps);
    }

    return filtered;
  }

  /**
   * Apply configuration to suggestion
   */
  private applyConfig(suggestion: ManualFixSuggestion): ManualFixSuggestion {
    const result = { ...suggestion };

    // Remove code examples if not wanted
    if (!this.config.includeCodeExamples) {
      result.steps = result.steps.map(step => {
        const { codeExample: _, ...rest } = step;
        return rest as ManualFixStep;
      });
    }

    // Remove time estimates if not wanted
    if (!this.config.includeTimeEstimates) {
      result.estimatedTotalMinutes = 0;
      result.steps = result.steps.map(step => {
        const { estimatedMinutes: _, ...rest } = step;
        return rest as ManualFixStep;
      });
    }

    // Remove verification if not wanted
    if (!this.config.includeVerification) {
      result.verification = [];
      result.steps = result.steps.filter(s => s.category !== "verification");
    }

    // Adjust verbosity
    if (this.config.verbosity === "minimal") {
      result.pitfalls = [];
      result.docLinks = [];
      result.steps = result.steps.map(step => ({
        ...step,
        expectedOutcome: undefined,
        warning: undefined,
      }));
    }

    return result;
  }

  /**
   * Add custom template
   */
  addTemplate(template: FixTemplate): void {
    this.templates.unshift(template); // Add to front for priority
  }

  /**
   * Get all template IDs
   */
  getTemplateIds(): string[] {
    return this.templates.map(t => t.id);
  }

  /**
   * Check if error requires manual fix
   */
  requiresManualFix(error: ComplexError): boolean {
    const complexity = detectComplexity(error);
    return complexity === "complex" || complexity === "expert" || !!error.autoFixBlocker;
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.templates = [];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ManualFixGenerator instance
 */
export function createManualFixGenerator(
  config?: ManualFixGeneratorConfig
): ManualFixGenerator {
  return new ManualFixGenerator(config);
}

/**
 * Quick generate helper
 */
export function generateManualFix(error: ComplexError): ManualFixSuggestion | null {
  const generator = createManualFixGenerator();
  const result = generator.generate(error);
  generator.dispose();
  return result;
}

/**
 * Check if error needs manual intervention
 */
export function needsManualFix(error: ComplexError): boolean {
  return detectComplexity(error) !== "simple" || !!error.autoFixBlocker;
}
