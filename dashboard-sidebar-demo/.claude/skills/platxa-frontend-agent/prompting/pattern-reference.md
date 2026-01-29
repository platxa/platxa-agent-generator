# Pattern Reference System

System for detecting and referencing existing project patterns to ensure generated code maintains consistency with the codebase.

## Overview

The Pattern Reference System enables the frontend agent to:
1. Analyze existing codebase patterns before generating code
2. Extract conventions for components, styling, and structure
3. Inject relevant patterns into generation prompts
4. Ensure new code matches existing project style

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PATTERN REFERENCE SYSTEM                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Scan    │───▶│  Extract │───▶│  Index   │───▶│  Inject  │  │
│  │ Codebase │    │ Patterns │    │ Patterns │    │  Prompts │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
│  Files:          Patterns:       Storage:        Output:        │
│  - components/   - Component     - Pattern DB    - Prompt       │
│  - lib/          - Styling       - Categories    - Context      │
│  - styles/       - Utilities     - Examples      - Examples     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Pattern Categories

### 1. Component Patterns

```typescript
interface ComponentPattern {
  category: "component"
  name: string
  description: string
  example: {
    code: string
    filePath: string
  }
  characteristics: {
    usesForwardRef: boolean
    hasDisplayName: boolean
    usesVariants: boolean
    variantLibrary?: "cva" | "tailwind-variants" | "none"
    propsInterface: boolean
    exportStyle: "named" | "default" | "both"
  }
}
```

### 2. Styling Patterns

```typescript
interface StylingPattern {
  category: "styling"
  name: string
  description: string
  example: {
    code: string
    filePath: string
  }
  characteristics: {
    methodology: "tailwind" | "css-modules" | "styled-components" | "emotion"
    variantSystem: "cva" | "tailwind-variants" | "cn-only"
    colorTokens: string[]
    spacingScale: string[]
    breakpoints: string[]
  }
}
```

### 3. Utility Patterns

```typescript
interface UtilityPattern {
  category: "utility"
  name: string
  description: string
  example: {
    code: string
    filePath: string
  }
  characteristics: {
    type: "helper" | "hook" | "context" | "type"
    dependencies: string[]
    exportStyle: "named" | "default"
  }
}
```

### 4. File Structure Patterns

```typescript
interface StructurePattern {
  category: "structure"
  name: string
  description: string
  example: {
    structure: string
    filePath: string
  }
  characteristics: {
    componentLocation: string
    utilityLocation: string
    styleLocation: string
    testLocation: string
    indexExports: boolean
  }
}
```

## Pattern Detection

### Scan Configuration

```typescript
interface PatternScanConfig {
  /**
   * Directories to scan for patterns
   */
  scanPaths: string[]

  /**
   * File extensions to include
   */
  extensions: string[]

  /**
   * Patterns to exclude (glob)
   */
  exclude: string[]

  /**
   * Minimum examples needed to establish pattern
   */
  minExamples: number

  /**
   * Categories to detect
   */
  categories: PatternCategory[]
}

const defaultConfig: PatternScanConfig = {
  scanPaths: [
    "src/components",
    "src/lib",
    "src/hooks",
    "src/styles"
  ],
  extensions: [".tsx", ".ts", ".css"],
  exclude: [
    "**/*.test.*",
    "**/*.spec.*",
    "**/node_modules/**"
  ],
  minExamples: 2,
  categories: ["component", "styling", "utility", "structure"]
}
```

### Detection Rules

```typescript
const componentDetectionRules = {
  // Detect forwardRef usage
  forwardRef: {
    pattern: /React\.forwardRef|forwardRef</,
    extract: (match: string) => ({ usesForwardRef: true })
  },

  // Detect displayName
  displayName: {
    pattern: /\.displayName\s*=\s*["'](\w+)["']/,
    extract: (match: string) => ({
      hasDisplayName: true,
      componentName: match[1]
    })
  },

  // Detect CVA variants
  cvaVariants: {
    pattern: /cva\(\s*\[/,
    extract: () => ({
      usesVariants: true,
      variantLibrary: "cva"
    })
  },

  // Detect props interface
  propsInterface: {
    pattern: /interface\s+(\w+Props)/,
    extract: (match: string) => ({
      propsInterface: true,
      propsName: match[1]
    })
  },

  // Detect export style
  exportStyle: {
    pattern: {
      named: /export\s+(const|function)\s+\w+/,
      default: /export\s+default/
    },
    extract: (code: string) => {
      const hasNamed = /export\s+(const|function)\s+\w+/.test(code)
      const hasDefault = /export\s+default/.test(code)
      return {
        exportStyle: hasNamed && hasDefault ? "both" : hasNamed ? "named" : "default"
      }
    }
  }
}
```

### Pattern Extraction

```typescript
const extractPatterns = async (
  config: PatternScanConfig
): Promise<PatternDatabase> => {
  const patterns: PatternDatabase = {
    components: [],
    styling: [],
    utilities: [],
    structure: []
  }

  // Scan each path
  for (const scanPath of config.scanPaths) {
    const files = await glob(`${scanPath}/**/*{${config.extensions.join(",")}}`, {
      ignore: config.exclude
    })

    for (const file of files) {
      const content = await readFile(file, "utf-8")
      const detectedPatterns = analyzeFile(content, file)

      // Categorize and store patterns
      for (const pattern of detectedPatterns) {
        patterns[pattern.category].push(pattern)
      }
    }
  }

  // Consolidate patterns (find common ones)
  return consolidatePatterns(patterns, config.minExamples)
}
```

## Pattern Database

### Schema

```typescript
interface PatternDatabase {
  metadata: {
    projectName: string
    scannedAt: string
    version: string
  }

  patterns: {
    components: ComponentPattern[]
    styling: StylingPattern[]
    utilities: UtilityPattern[]
    structure: StructurePattern[]
  }

  statistics: {
    totalFiles: number
    totalPatterns: number
    patternCounts: Record<string, number>
  }
}
```

### Storage Format

```json
{
  "metadata": {
    "projectName": "my-app",
    "scannedAt": "2024-01-10T12:00:00Z",
    "version": "1.0.0"
  },
  "patterns": {
    "components": [
      {
        "category": "component",
        "name": "ForwardRef Component",
        "description": "Component with forwardRef, displayName, and typed props",
        "example": {
          "code": "const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(...)",
          "filePath": "src/components/ui/button.tsx"
        },
        "characteristics": {
          "usesForwardRef": true,
          "hasDisplayName": true,
          "usesVariants": true,
          "variantLibrary": "cva",
          "propsInterface": true,
          "exportStyle": "named"
        }
      }
    ],
    "styling": [
      {
        "category": "styling",
        "name": "CVA Variant System",
        "description": "Class Variance Authority for component variants",
        "example": {
          "code": "const buttonVariants = cva([...], { variants: {...} })",
          "filePath": "src/components/ui/button.tsx"
        },
        "characteristics": {
          "methodology": "tailwind",
          "variantSystem": "cva",
          "colorTokens": ["primary", "secondary", "destructive"],
          "spacingScale": ["0", "1", "2", "4", "6", "8"],
          "breakpoints": ["sm", "md", "lg", "xl"]
        }
      }
    ]
  }
}
```

## Prompt Injection

### Pattern Context Template

```markdown
## Project Patterns

The following patterns have been detected in the existing codebase.
Generated code MUST follow these conventions:

### Component Structure
{{#each patterns.components}}
**{{name}}**: {{description}}
```tsx
{{example.code}}
```
{{/each}}

### Styling Conventions
{{#each patterns.styling}}
**{{name}}**: {{description}}
- Methodology: {{characteristics.methodology}}
- Variant System: {{characteristics.variantSystem}}
- Color Tokens: {{characteristics.colorTokens}}
```tsx
{{example.code}}
```
{{/each}}

### Utilities
{{#each patterns.utilities}}
**{{name}}**: {{description}}
```tsx
{{example.code}}
```
{{/each}}

### File Structure
{{#each patterns.structure}}
- Components: {{characteristics.componentLocation}}
- Utilities: {{characteristics.utilityLocation}}
- Styles: {{characteristics.styleLocation}}
{{/each}}
```

### Injection Points

```typescript
interface PromptInjection {
  /**
   * Where in the prompt to inject patterns
   */
  position: "system" | "context" | "instructions"

  /**
   * Which pattern categories to include
   */
  categories: PatternCategory[]

  /**
   * Maximum examples per category
   */
  maxExamples: number

  /**
   * Format for injection
   */
  format: "markdown" | "json" | "code"
}

const defaultInjection: PromptInjection = {
  position: "context",
  categories: ["component", "styling"],
  maxExamples: 3,
  format: "markdown"
}
```

### Context Builder

```typescript
const buildPatternContext = (
  database: PatternDatabase,
  request: GenerationRequest,
  config: PromptInjection
): string => {
  const relevantPatterns = selectRelevantPatterns(database, request)

  const context = `
## Existing Project Patterns

Follow these patterns from the existing codebase:

${formatPatterns(relevantPatterns, config.format)}

## Requirements
- Match the existing code style exactly
- Use the same variant system (${database.patterns.styling[0]?.characteristics.variantSystem})
- Follow the same export conventions
- Use established color tokens and spacing
`

  return context
}

const selectRelevantPatterns = (
  database: PatternDatabase,
  request: GenerationRequest
): Pattern[] => {
  const patterns: Pattern[] = []

  // Select component patterns based on request type
  if (request.type === "component") {
    patterns.push(...database.patterns.components.slice(0, 2))
  }

  // Always include styling patterns
  patterns.push(...database.patterns.styling.slice(0, 2))

  // Include relevant utilities
  const relevantUtils = database.patterns.utilities.filter(
    u => request.requirements.some(r => u.name.toLowerCase().includes(r.toLowerCase()))
  )
  patterns.push(...relevantUtils.slice(0, 2))

  return patterns
}
```

## Usage Examples

### Before Generation

```typescript
// 1. Load pattern database
const patterns = await loadPatternDatabase(".patterns/db.json")

// 2. Build context for generation
const context = buildPatternContext(patterns, {
  type: "component",
  name: "UserCard",
  requirements: ["avatar", "hover effect", "click handler"]
})

// 3. Inject into prompt
const prompt = `
${SYSTEM_PROMPT}

${context}

Generate a UserCard component following the patterns above.
`
```

### Example Output

Given these detected patterns:
- ForwardRef components with CVA
- Tailwind styling with semantic tokens
- Named exports

Generated code follows the same conventions:

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const userCardVariants = cva(
  [
    "rounded-lg border bg-card text-card-foreground",
    "transition-all duration-200"
  ],
  {
    variants: {
      size: {
        sm: "p-4",
        default: "p-6",
        lg: "p-8"
      },
      hover: {
        none: "",
        lift: "hover:shadow-lg hover:-translate-y-1",
        glow: "hover:shadow-lg hover:shadow-primary/10"
      }
    },
    defaultVariants: {
      size: "default",
      hover: "lift"
    }
  }
)

interface UserCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof userCardVariants> {
  user: {
    name: string
    email: string
    avatar?: string
  }
  onPress?: () => void
}

const UserCard = React.forwardRef<HTMLDivElement, UserCardProps>(
  ({ className, size, hover, user, onPress, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role={onPress ? "button" : undefined}
        tabIndex={onPress ? 0 : undefined}
        onClick={onPress}
        onKeyDown={(e) => {
          if (onPress && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault()
            onPress()
          }
        }}
        className={cn(
          userCardVariants({ size, hover }),
          onPress && "cursor-pointer",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="text-lg font-medium">
                {user.name.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>
    )
  }
)
UserCard.displayName = "UserCard"

export { UserCard, userCardVariants }
export type { UserCardProps }
```

## Pattern Refresh

```typescript
// Re-scan patterns when codebase changes
const refreshPatterns = async () => {
  const newPatterns = await extractPatterns(defaultConfig)
  await savePatternDatabase(newPatterns, ".patterns/db.json")
  console.log(`Patterns updated: ${newPatterns.statistics.totalPatterns} patterns found`)
}

// Schedule periodic refresh
const scheduleRefresh = (intervalMs: number = 3600000) => {
  setInterval(refreshPatterns, intervalMs)
}
```

## Integration

The Pattern Reference System integrates with:
- **Design Analyzer**: Provides styling patterns for analysis
- **Component Generator**: Injects patterns into generation prompts
- **Quality Scorer**: Validates generated code matches patterns

## Best Practices

| Do | Don't |
|----|-------|
| Scan existing code before generating | Generate without checking patterns |
| Include 2-3 examples per category | Overload prompts with too many examples |
| Update patterns when codebase evolves | Use stale pattern database |
| Match exact naming conventions | Deviate from established patterns |
| Use detected color tokens | Introduce new color values |
| Follow export style conventions | Mix export styles |

## Export

```typescript
export {
  extractPatterns,
  loadPatternDatabase,
  buildPatternContext,
  refreshPatterns
}
export type {
  PatternDatabase,
  ComponentPattern,
  StylingPattern,
  PatternScanConfig
}
```
