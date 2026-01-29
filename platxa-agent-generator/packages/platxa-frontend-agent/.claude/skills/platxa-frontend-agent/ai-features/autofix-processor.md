# AutoFix Post-Processor

Automated code quality fixes for generated components.

## Overview

The AutoFix processor ensures generated code:
1. Passes ESLint rules with auto-fixable corrections
2. Has valid TypeScript types
3. Follows project formatting standards
4. Meets accessibility requirements

## AutoFix Pipeline

```typescript
interface AutoFixConfig {
  enableLint: boolean;
  enableTypeCheck: boolean;
  enableFormat: boolean;
  enableA11y: boolean;
  maxAttempts: number;
}

interface AutoFixResult {
  success: boolean;
  code: string;
  fixes: AppliedFix[];
  errors: RemainingError[];
  attempts: number;
}

interface AppliedFix {
  rule: string;
  message: string;
  line: number;
  fixed: boolean;
}

interface RemainingError {
  type: 'lint' | 'type' | 'a11y';
  rule: string;
  message: string;
  line: number;
  suggestion?: string;
}

const defaultConfig: AutoFixConfig = {
  enableLint: true,
  enableTypeCheck: true,
  enableFormat: true,
  enableA11y: true,
  maxAttempts: 3,
};
```

## AutoFix Processor Class

```typescript
import { ESLint } from 'eslint';
import * as ts from 'typescript';
import * as prettier from 'prettier';

class AutoFixProcessor {
  private config: AutoFixConfig;
  private eslint: ESLint;

  constructor(config: Partial<AutoFixConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.eslint = new ESLint({
      fix: true,
      useEslintrc: true,
    });
  }

  async process(code: string, filename: string): Promise<AutoFixResult> {
    let currentCode = code;
    const allFixes: AppliedFix[] = [];
    let attempts = 0;

    while (attempts < this.config.maxAttempts) {
      attempts++;
      let hasChanges = false;

      // Step 1: Format with Prettier
      if (this.config.enableFormat) {
        const formatted = await this.formatCode(currentCode, filename);
        if (formatted !== currentCode) {
          currentCode = formatted;
          hasChanges = true;
          allFixes.push({
            rule: 'prettier',
            message: 'Code formatted',
            line: 0,
            fixed: true,
          });
        }
      }

      // Step 2: ESLint auto-fix
      if (this.config.enableLint) {
        const { code: linted, fixes } = await this.lintFix(currentCode, filename);
        if (linted !== currentCode) {
          currentCode = linted;
          hasChanges = true;
          allFixes.push(...fixes);
        }
      }

      // Step 3: TypeScript fixes
      if (this.config.enableTypeCheck) {
        const { code: typed, fixes } = await this.typeCheck(currentCode, filename);
        if (typed !== currentCode) {
          currentCode = typed;
          hasChanges = true;
          allFixes.push(...fixes);
        }
      }

      // Step 4: Accessibility fixes
      if (this.config.enableA11y) {
        const { code: a11yFixed, fixes } = await this.accessibilityFix(currentCode);
        if (a11yFixed !== currentCode) {
          currentCode = a11yFixed;
          hasChanges = true;
          allFixes.push(...fixes);
        }
      }

      // If no changes made, we're done
      if (!hasChanges) break;
    }

    // Final validation
    const remainingErrors = await this.validate(currentCode, filename);

    return {
      success: remainingErrors.length === 0,
      code: currentCode,
      fixes: allFixes,
      errors: remainingErrors,
      attempts,
    };
  }

  private async formatCode(code: string, filename: string): Promise<string> {
    try {
      const options = await prettier.resolveConfig(filename);
      return prettier.format(code, {
        ...options,
        parser: 'typescript',
      });
    } catch {
      return code;
    }
  }

  private async lintFix(
    code: string,
    filename: string
  ): Promise<{ code: string; fixes: AppliedFix[] }> {
    const results = await this.eslint.lintText(code, { filePath: filename });
    const fixes: AppliedFix[] = [];

    if (results.length > 0 && results[0].output) {
      for (const message of results[0].messages) {
        if (message.fix) {
          fixes.push({
            rule: message.ruleId || 'eslint',
            message: message.message,
            line: message.line,
            fixed: true,
          });
        }
      }
      return { code: results[0].output, fixes };
    }

    return { code, fixes };
  }

  private async validate(code: string, filename: string): Promise<RemainingError[]> {
    const errors: RemainingError[] = [];

    // Lint errors
    const lintResults = await this.eslint.lintText(code, { filePath: filename });
    for (const result of lintResults) {
      for (const message of result.messages) {
        if (!message.fix) {
          errors.push({
            type: 'lint',
            rule: message.ruleId || 'eslint',
            message: message.message,
            line: message.line,
          });
        }
      }
    }

    // Type errors
    const typeErrors = this.getTypeErrors(code, filename);
    errors.push(...typeErrors);

    return errors;
  }

  private getTypeErrors(code: string, filename: string): RemainingError[] {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true,
    };

    const host = ts.createCompilerHost(compilerOptions);
    const originalGetSourceFile = host.getSourceFile;

    host.getSourceFile = (name, languageVersion) => {
      if (name === filename) {
        return ts.createSourceFile(name, code, languageVersion);
      }
      return originalGetSourceFile(name, languageVersion);
    };

    const program = ts.createProgram([filename], compilerOptions, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);

    return diagnostics.map((d) => ({
      type: 'type' as const,
      rule: `TS${d.code}`,
      message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      line: d.start
        ? ts.getLineAndCharacterOfPosition(
            program.getSourceFile(filename)!,
            d.start
          ).line + 1
        : 0,
    }));
  }
}
```

## ESLint Fix Rules

```typescript
const eslintFixableRules = {
  // Import ordering
  'import/order': {
    fix: true,
    description: 'Organize imports',
  },

  // Unused vars removal
  '@typescript-eslint/no-unused-vars': {
    fix: false,
    autoFix: removeUnusedImport,
  },

  // React hooks deps
  'react-hooks/exhaustive-deps': {
    fix: false,
    autoFix: addMissingDependency,
  },

  // Accessibility
  'jsx-a11y/alt-text': {
    fix: false,
    autoFix: addAltText,
  },

  // Prefer const
  'prefer-const': {
    fix: true,
    description: 'Use const for non-reassigned variables',
  },

  // No explicit any
  '@typescript-eslint/no-explicit-any': {
    fix: false,
    autoFix: inferType,
  },
};

// Custom fixers for unfixable rules
function removeUnusedImport(code: string, varName: string): string {
  const importRegex = new RegExp(
    `import\\s*{[^}]*\\b${varName}\\b[^}]*}\\s*from\\s*['"][^'"]+['"];?`,
    'g'
  );

  // Remove from named imports
  return code.replace(importRegex, (match) => {
    const cleaned = match.replace(new RegExp(`\\b${varName}\\b,?\\s*`), '');
    // If empty import, remove entire line
    if (/import\s*{\s*}\s*from/.test(cleaned)) {
      return '';
    }
    return cleaned;
  });
}

function addMissingDependency(code: string, hook: string, dependency: string): string {
  const hookRegex = new RegExp(`(${hook}\\([^)]*,\\s*\\[)([^\\]]*)\\]`);
  return code.replace(hookRegex, (match, start, deps) => {
    const newDeps = deps ? `${deps}, ${dependency}` : dependency;
    return `${start}${newDeps}]`;
  });
}

function addAltText(code: string, line: number): string {
  const lines = code.split('\n');
  const targetLine = lines[line - 1];

  if (targetLine.includes('<img') && !targetLine.includes('alt=')) {
    lines[line - 1] = targetLine.replace(/<img/, '<img alt=""');
  }

  return lines.join('\n');
}
```

## TypeScript Type Fixes

```typescript
interface TypeFix {
  pattern: RegExp;
  fix: (code: string, match: RegExpMatchArray) => string;
  description: string;
}

const typeFixes: TypeFix[] = [
  {
    // Add missing return type
    pattern: /function\s+(\w+)\s*\([^)]*\)\s*{/g,
    fix: (code, match) => {
      // Infer return type from function body
      return code;
    },
    description: 'Add explicit return type',
  },
  {
    // Fix implicit any in parameters
    pattern: /\((\w+)\)\s*=>/g,
    fix: (code, match) => {
      const paramName = match[1];
      // Try to infer type from usage
      return code.replace(match[0], `(${paramName}: unknown) =>`);
    },
    description: 'Add parameter type',
  },
  {
    // Add missing generic types
    pattern: /useState\(\)/g,
    fix: (code) => code.replace(/useState\(\)/g, 'useState<unknown>()'),
    description: 'Add useState generic type',
  },
];

async function applyTypeFixes(code: string): Promise<{ code: string; fixes: AppliedFix[] }> {
  let result = code;
  const fixes: AppliedFix[] = [];

  for (const typeFix of typeFixes) {
    const matches = result.matchAll(typeFix.pattern);
    for (const match of matches) {
      const before = result;
      result = typeFix.fix(result, match);
      if (result !== before) {
        fixes.push({
          rule: 'typescript',
          message: typeFix.description,
          line: getLineNumber(code, match.index!),
          fixed: true,
        });
      }
    }
  }

  return { code: result, fixes };
}
```

## Accessibility Auto-Fixes

```typescript
const a11yFixes = [
  {
    // Add aria-label to icon buttons
    pattern: /<button[^>]*>\s*<[A-Z]\w+Icon[^/]*\/>\s*<\/button>/g,
    check: (match: string) => !match.includes('aria-label'),
    fix: (match: string) => match.replace('<button', '<button aria-label="Button"'),
    message: 'Add aria-label to icon-only button',
  },
  {
    // Add role to clickable divs
    pattern: /<div[^>]*onClick/g,
    check: (match: string) => !match.includes('role='),
    fix: (match: string) => match.replace('<div', '<div role="button" tabIndex={0}'),
    message: 'Add role and tabIndex to clickable div',
  },
  {
    // Add type to buttons
    pattern: /<button(?![^>]*type=)/g,
    check: () => true,
    fix: (match: string) => match.replace('<button', '<button type="button"'),
    message: 'Add explicit type to button',
  },
  {
    // Add htmlFor to labels
    pattern: /<label(?![^>]*htmlFor)[^>]*>/g,
    check: () => true,
    fix: (match: string, context: { inputId?: string }) => {
      if (context.inputId) {
        return match.replace('<label', `<label htmlFor="${context.inputId}"`);
      }
      return match;
    },
    message: 'Add htmlFor to label',
  },
];

async function applyA11yFixes(code: string): Promise<{ code: string; fixes: AppliedFix[] }> {
  let result = code;
  const fixes: AppliedFix[] = [];

  for (const a11yFix of a11yFixes) {
    result = result.replace(a11yFix.pattern, (match) => {
      if (a11yFix.check(match)) {
        fixes.push({
          rule: 'jsx-a11y',
          message: a11yFix.message,
          line: 0,
          fixed: true,
        });
        return a11yFix.fix(match, {});
      }
      return match;
    });
  }

  return { code: result, fixes };
}
```

## Import Management

```typescript
function organizeImports(code: string): string {
  const importRegex = /^import\s+.*from\s+['"].*['"];?\s*$/gm;
  const imports: string[] = [];
  let restOfCode = code;

  // Extract all imports
  const matches = code.matchAll(importRegex);
  for (const match of matches) {
    imports.push(match[0]);
    restOfCode = restOfCode.replace(match[0], '');
  }

  // Sort imports by type
  const sortedImports = sortImports(imports);

  // Remove leading whitespace from rest
  restOfCode = restOfCode.replace(/^\s+/, '');

  return sortedImports.join('\n') + '\n\n' + restOfCode;
}

function sortImports(imports: string[]): string[] {
  const groups = {
    react: [] as string[],
    external: [] as string[],
    internal: [] as string[],
    relative: [] as string[],
    types: [] as string[],
  };

  for (const imp of imports) {
    if (imp.includes("from 'react'") || imp.includes('from "react"')) {
      groups.react.push(imp);
    } else if (imp.includes('import type')) {
      groups.types.push(imp);
    } else if (imp.includes("from '@/") || imp.includes('from "@/')) {
      groups.internal.push(imp);
    } else if (imp.includes("from './") || imp.includes("from '../")) {
      groups.relative.push(imp);
    } else {
      groups.external.push(imp);
    }
  }

  // Sort each group alphabetically
  Object.values(groups).forEach((group) => group.sort());

  return [
    ...groups.react,
    '',
    ...groups.external,
    '',
    ...groups.internal,
    '',
    ...groups.relative,
    '',
    ...groups.types,
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === ''));
}
```

## Integration with Agent

```typescript
// Post-process generated component
async function postProcessComponent(
  generatedCode: string,
  filename: string
): Promise<{ code: string; report: AutoFixReport }> {
  const processor = new AutoFixProcessor({
    enableLint: true,
    enableTypeCheck: true,
    enableFormat: true,
    enableA11y: true,
    maxAttempts: 3,
  });

  const result = await processor.process(generatedCode, filename);

  return {
    code: result.code,
    report: {
      success: result.success,
      fixesApplied: result.fixes.length,
      remainingErrors: result.errors.length,
      details: formatReport(result),
    },
  };
}

function formatReport(result: AutoFixResult): string {
  return `
## AutoFix Report

**Status**: ${result.success ? '✅ Passed' : '⚠️ Has Issues'}
**Attempts**: ${result.attempts}
**Fixes Applied**: ${result.fixes.length}

${result.fixes.length > 0 ? `
### Applied Fixes
${result.fixes.map(f => `- [${f.rule}] ${f.message}`).join('\n')}
` : ''}

${result.errors.length > 0 ? `
### Remaining Issues
${result.errors.map(e => `- [${e.type}:${e.rule}] Line ${e.line}: ${e.message}`).join('\n')}
` : ''}
  `.trim();
}
```

## Usage Example

```typescript
// In component generator workflow
const generatedCode = await generateComponent(request);

// Apply AutoFix
const { code: fixedCode, report } = await postProcessComponent(
  generatedCode,
  'MyComponent.tsx'
);

if (!report.success) {
  // Request LLM to fix remaining issues
  const fixedByLLM = await requestLLMFix(fixedCode, report.details);
  // Re-run AutoFix
  const finalResult = await postProcessComponent(fixedByLLM, 'MyComponent.tsx');
}

// Output final code
console.log(fixedCode);
console.log(report.details);
```

## Key Takeaways

1. **Multi-Stage Pipeline**: Format → Lint → Type → A11y
2. **Iterative Fixing**: Multiple attempts until stable
3. **ESLint Integration**: Auto-fix with custom fixers
4. **TypeScript Validation**: Catch type errors early
5. **Accessibility Fixes**: Auto-add ARIA, roles, types
6. **Import Organization**: Group and sort imports
7. **Detailed Reporting**: Track all applied fixes
