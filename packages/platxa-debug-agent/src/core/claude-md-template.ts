/**
 * CLAUDE.md Template Generator
 *
 * Generates CLAUDE.md templates for debugging configuration,
 * providing Claude Code with context about project debugging setup.
 *
 * @module claude-md-template
 */

import type { Language } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Debug tool configuration
 */
export interface DebugToolConfig {
  /** Tool name */
  name: string;
  /** Command to run the tool */
  command: string;
  /** Description of what the tool does */
  description: string;
  /** Whether the tool is required */
  required: boolean;
}

/**
 * Language-specific debugging configuration
 */
export interface LanguageDebugConfig {
  /** Language identifier */
  language: Language;
  /** Error parser commands */
  errorParsers: string[];
  /** Linting commands */
  linters: string[];
  /** Type checking commands */
  typeCheckers: string[];
  /** Test commands */
  testCommands: string[];
  /** Debug tools */
  debugTools: DebugToolConfig[];
}

/**
 * Project debugging configuration
 */
export interface ProjectDebugConfig {
  /** Project name */
  projectName: string;
  /** Project description */
  description: string;
  /** Languages used in the project */
  languages: Language[];
  /** Language-specific configurations */
  languageConfigs: LanguageDebugConfig[];
  /** Source directories to analyze */
  sourceDirectories: string[];
  /** Directories to exclude from analysis */
  excludeDirectories: string[];
  /** Custom error patterns */
  customErrorPatterns: ErrorPatternConfig[];
  /** Known issues and workarounds */
  knownIssues: KnownIssueConfig[];
  /** Debug preferences */
  preferences: DebugPreferences;
}

/**
 * Custom error pattern configuration
 */
export interface ErrorPatternConfig {
  /** Pattern name */
  name: string;
  /** Regex pattern to match */
  pattern: string;
  /** Error severity */
  severity: 'error' | 'warning' | 'info';
  /** Suggested fix template */
  suggestedFix: string;
}

/**
 * Known issue configuration
 */
export interface KnownIssueConfig {
  /** Issue identifier */
  id: string;
  /** Issue description */
  description: string;
  /** Workaround or fix */
  workaround: string;
  /** Whether this is a temporary workaround */
  temporary: boolean;
}

/**
 * Debug preferences
 */
export interface DebugPreferences {
  /** Verbosity level for explanations */
  verbosity: 'minimal' | 'normal' | 'detailed';
  /** Whether to show confidence scores */
  showConfidence: boolean;
  /** Whether to show alternative fixes */
  showAlternatives: boolean;
  /** Maximum number of alternatives to show */
  maxAlternatives: number;
  /** Auto-fix threshold (fixes with confidence above this are auto-applied) */
  autoFixThreshold: number;
  /** Whether to run tests after fixes */
  runTestsAfterFix: boolean;
}

/**
 * Template section
 */
export interface TemplateSection {
  /** Section title */
  title: string;
  /** Section content */
  content: string;
  /** Section priority (lower = higher priority) */
  priority: number;
}

/**
 * Generated template result
 */
export interface GeneratedTemplate {
  /** The generated CLAUDE.md content */
  content: string;
  /** Sections included in the template */
  sections: TemplateSection[];
  /** Warnings about missing configurations */
  warnings: string[];
  /** Suggestions for improving the configuration */
  suggestions: string[];
}

/**
 * Template generator configuration
 */
export interface ClaudeMdTemplateConfig {
  /** Include example configurations */
  includeExamples: boolean;
  /** Include tool installation instructions */
  includeInstallInstructions: boolean;
  /** Include troubleshooting section */
  includeTroubleshooting: boolean;
  /** Custom sections to add */
  customSections: TemplateSection[];
}

// =============================================================================
// Default Configurations
// =============================================================================

const DEFAULT_PYTHON_CONFIG: LanguageDebugConfig = {
  language: 'python',
  errorParsers: ['python -c "import traceback"'],
  linters: ['ruff check .', 'pylint'],
  typeCheckers: ['pyright .', 'mypy .'],
  testCommands: ['pytest', 'python -m unittest'],
  debugTools: [
    {
      name: 'pyright',
      command: 'pyright .',
      description: 'Static type checker for Python',
      required: true,
    },
    {
      name: 'ruff',
      command: 'ruff check .',
      description: 'Fast Python linter',
      required: true,
    },
    {
      name: 'pytest',
      command: 'pytest -v',
      description: 'Python test framework',
      required: false,
    },
  ],
};

const DEFAULT_JAVASCRIPT_CONFIG: LanguageDebugConfig = {
  language: 'javascript',
  errorParsers: ['node --enable-source-maps'],
  linters: ['eslint .'],
  typeCheckers: [],
  testCommands: ['npm test', 'jest', 'vitest'],
  debugTools: [
    {
      name: 'eslint',
      command: 'npx eslint .',
      description: 'JavaScript/TypeScript linter',
      required: true,
    },
    {
      name: 'jest',
      command: 'npx jest',
      description: 'JavaScript test framework',
      required: false,
    },
  ],
};

const DEFAULT_TYPESCRIPT_CONFIG: LanguageDebugConfig = {
  language: 'typescript',
  errorParsers: ['node --enable-source-maps'],
  linters: ['eslint .'],
  typeCheckers: ['tsc --noEmit'],
  testCommands: ['npm test', 'jest', 'vitest'],
  debugTools: [
    {
      name: 'tsc',
      command: 'tsc --noEmit',
      description: 'TypeScript compiler for type checking',
      required: true,
    },
    {
      name: 'eslint',
      command: 'npx eslint .',
      description: 'JavaScript/TypeScript linter',
      required: true,
    },
    {
      name: 'vitest',
      command: 'npx vitest run',
      description: 'Fast Vite-native test framework',
      required: false,
    },
  ],
};

const DEFAULT_CSS_CONFIG: LanguageDebugConfig = {
  language: 'css',
  errorParsers: [],
  linters: ['stylelint "**/*.css"'],
  typeCheckers: [],
  testCommands: [],
  debugTools: [
    {
      name: 'stylelint',
      command: 'npx stylelint "**/*.css"',
      description: 'CSS linter',
      required: true,
    },
  ],
};

const DEFAULT_SCSS_CONFIG: LanguageDebugConfig = {
  language: 'scss',
  errorParsers: [],
  linters: ['stylelint "**/*.scss"'],
  typeCheckers: [],
  testCommands: [],
  debugTools: [
    {
      name: 'stylelint',
      command: 'npx stylelint "**/*.scss"',
      description: 'SCSS linter',
      required: true,
    },
  ],
};

const DEFAULT_CONFIGS: Record<Language, LanguageDebugConfig> = {
  python: DEFAULT_PYTHON_CONFIG,
  javascript: DEFAULT_JAVASCRIPT_CONFIG,
  typescript: DEFAULT_TYPESCRIPT_CONFIG,
  css: DEFAULT_CSS_CONFIG,
  scss: DEFAULT_SCSS_CONFIG,
  tailwind: { ...DEFAULT_CSS_CONFIG, language: 'tailwind' },
  html: {
    language: 'html',
    errorParsers: [],
    linters: ['htmlhint'],
    typeCheckers: [],
    testCommands: [],
    debugTools: [],
  },
  json: {
    language: 'json',
    errorParsers: [],
    linters: [],
    typeCheckers: [],
    testCommands: [],
    debugTools: [],
  },
  yaml: {
    language: 'yaml',
    errorParsers: [],
    linters: ['yamllint'],
    typeCheckers: [],
    testCommands: [],
    debugTools: [],
  },
  markdown: {
    language: 'markdown',
    errorParsers: [],
    linters: ['markdownlint'],
    typeCheckers: [],
    testCommands: [],
    debugTools: [],
  },
  unknown: {
    language: 'unknown',
    errorParsers: [],
    linters: [],
    typeCheckers: [],
    testCommands: [],
    debugTools: [],
  },
};

const DEFAULT_PREFERENCES: DebugPreferences = {
  verbosity: 'normal',
  showConfidence: true,
  showAlternatives: true,
  maxAlternatives: 3,
  autoFixThreshold: 0.9,
  runTestsAfterFix: true,
};

// =============================================================================
// Template Generator Class
// =============================================================================

/**
 * CLAUDE.md Template Generator
 *
 * Generates customized CLAUDE.md files for debugging configuration.
 */
export class ClaudeMdTemplate {
  private config: ClaudeMdTemplateConfig;

  constructor(config: Partial<ClaudeMdTemplateConfig> = {}) {
    this.config = {
      includeExamples: config.includeExamples ?? true,
      includeInstallInstructions: config.includeInstallInstructions ?? true,
      includeTroubleshooting: config.includeTroubleshooting ?? true,
      customSections: config.customSections ?? [],
    };
  }

  /**
   * Generate a CLAUDE.md template for a project
   */
  generate(projectConfig: ProjectDebugConfig): GeneratedTemplate {
    const sections: TemplateSection[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Header section
    sections.push(this.generateHeader(projectConfig));

    // Debug commands section
    sections.push(this.generateDebugCommands(projectConfig, warnings));

    // Language configurations
    projectConfig.languageConfigs.forEach((langConfig, index) => {
      sections.push(this.generateLanguageSection(langConfig, index));
    });

    // Error patterns section
    if (projectConfig.customErrorPatterns.length > 0) {
      sections.push(this.generateErrorPatterns(projectConfig.customErrorPatterns));
    }

    // Known issues section
    if (projectConfig.knownIssues.length > 0) {
      sections.push(this.generateKnownIssues(projectConfig.knownIssues));
    }

    // Preferences section
    sections.push(this.generatePreferences(projectConfig.preferences));

    // Tool installation instructions
    if (this.config.includeInstallInstructions) {
      sections.push(this.generateInstallInstructions(projectConfig));
    }

    // Troubleshooting section
    if (this.config.includeTroubleshooting) {
      sections.push(this.generateTroubleshooting(projectConfig));
    }

    // Custom sections
    for (const customSection of this.config.customSections) {
      sections.push(customSection);
    }

    // Sort sections by priority
    sections.sort((a, b) => a.priority - b.priority);

    // Generate suggestions
    this.generateSuggestions(projectConfig, suggestions);

    // Combine all sections into final content
    const content = sections.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');

    const finalContent = `# CLAUDE.md - Debug Configuration\n\n${content}`;

    return {
      content: finalContent,
      sections,
      warnings,
      suggestions,
    };
  }

  /**
   * Generate default configuration for detected languages
   */
  generateDefaultConfig(languages: Language[]): ProjectDebugConfig {
    const languageConfigs = languages.map(
      (lang) =>
        DEFAULT_CONFIGS[lang] || {
          language: lang,
          errorParsers: [],
          linters: [],
          typeCheckers: [],
          testCommands: [],
          debugTools: [],
        }
    );

    return {
      projectName: 'Project',
      description: 'Auto-generated debug configuration',
      languages,
      languageConfigs,
      sourceDirectories: ['src', 'lib'],
      excludeDirectories: ['node_modules', '__pycache__', 'dist', 'build', '.git'],
      customErrorPatterns: [],
      knownIssues: [],
      preferences: { ...DEFAULT_PREFERENCES },
    };
  }

  /**
   * Get language-specific default configuration
   */
  getLanguageDefault(language: Language): LanguageDebugConfig {
    return (
      DEFAULT_CONFIGS[language] || {
        language,
        errorParsers: [],
        linters: [],
        typeCheckers: [],
        testCommands: [],
        debugTools: [],
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Section Generators
  // ---------------------------------------------------------------------------

  private generateHeader(config: ProjectDebugConfig): TemplateSection {
    const languageList = config.languages.join(', ');
    const content = `**Project:** ${config.projectName}

${config.description}

**Languages:** ${languageList}

**Source Directories:**
${config.sourceDirectories.map((d) => `- \`${d}\``).join('\n')}

**Excluded Directories:**
${config.excludeDirectories.map((d) => `- \`${d}\``).join('\n')}`;

    return {
      title: 'Project Overview',
      content,
      priority: 0,
    };
  }

  private generateDebugCommands(
    config: ProjectDebugConfig,
    warnings: string[]
  ): TemplateSection {
    const commands: string[] = [];

    for (const langConfig of config.languageConfigs) {
      // Type checkers
      for (const cmd of langConfig.typeCheckers) {
        commands.push(`- \`${cmd}\` - Type checking (${langConfig.language})`);
      }

      // Linters
      for (const cmd of langConfig.linters) {
        commands.push(`- \`${cmd}\` - Linting (${langConfig.language})`);
      }

      // Test commands
      for (const cmd of langConfig.testCommands) {
        commands.push(`- \`${cmd}\` - Tests (${langConfig.language})`);
      }

      // Check for missing required tools
      for (const tool of langConfig.debugTools) {
        if (tool.required) {
          warnings.push(`Required tool: ${tool.name} - ${tool.description}`);
        }
      }
    }

    const content =
      commands.length > 0
        ? `Run these commands for debugging:\n\n${commands.join('\n')}`
        : 'No debug commands configured.';

    return {
      title: 'Debug Commands',
      content,
      priority: 1,
    };
  }

  private generateLanguageSection(langConfig: LanguageDebugConfig, index: number): TemplateSection {
    const tools = langConfig.debugTools
      .map((t) => `| ${t.name} | \`${t.command}\` | ${t.description} | ${t.required ? 'Yes' : 'No'} |`)
      .join('\n');

    const content = `### ${langConfig.language.charAt(0).toUpperCase() + langConfig.language.slice(1)} Configuration

**Error Parsers:**
${langConfig.errorParsers.length > 0 ? langConfig.errorParsers.map((p) => `- \`${p}\``).join('\n') : '- None configured'}

**Type Checkers:**
${langConfig.typeCheckers.length > 0 ? langConfig.typeCheckers.map((c) => `- \`${c}\``).join('\n') : '- None configured'}

**Linters:**
${langConfig.linters.length > 0 ? langConfig.linters.map((l) => `- \`${l}\``).join('\n') : '- None configured'}

**Test Commands:**
${langConfig.testCommands.length > 0 ? langConfig.testCommands.map((t) => `- \`${t}\``).join('\n') : '- None configured'}

${
  langConfig.debugTools.length > 0
    ? `**Debug Tools:**

| Tool | Command | Description | Required |
|------|---------|-------------|----------|
${tools}`
    : ''
}`;

    return {
      title: `${langConfig.language.charAt(0).toUpperCase() + langConfig.language.slice(1)} Debugging`,
      content,
      priority: 10 + index,
    };
  }

  private generateErrorPatterns(patterns: ErrorPatternConfig[]): TemplateSection {
    const patternList = patterns
      .map(
        (p) => `### ${p.name}

- **Pattern:** \`${p.pattern}\`
- **Severity:** ${p.severity}
- **Suggested Fix:** ${p.suggestedFix}`
      )
      .join('\n\n');

    return {
      title: 'Custom Error Patterns',
      content: patternList,
      priority: 50,
    };
  }

  private generateKnownIssues(issues: KnownIssueConfig[]): TemplateSection {
    const issueList = issues
      .map(
        (i) => `### ${i.id}${i.temporary ? ' (Temporary)' : ''}

${i.description}

**Workaround:** ${i.workaround}`
      )
      .join('\n\n');

    return {
      title: 'Known Issues',
      content: issueList,
      priority: 60,
    };
  }

  private generatePreferences(prefs: DebugPreferences): TemplateSection {
    const content = `| Setting | Value |
|---------|-------|
| Verbosity | ${prefs.verbosity} |
| Show Confidence | ${prefs.showConfidence ? 'Yes' : 'No'} |
| Show Alternatives | ${prefs.showAlternatives ? 'Yes' : 'No'} |
| Max Alternatives | ${prefs.maxAlternatives} |
| Auto-fix Threshold | ${(prefs.autoFixThreshold * 100).toFixed(0)}% |
| Run Tests After Fix | ${prefs.runTestsAfterFix ? 'Yes' : 'No'} |`;

    return {
      title: 'Debug Preferences',
      content,
      priority: 70,
    };
  }

  private generateInstallInstructions(config: ProjectDebugConfig): TemplateSection {
    const instructions: string[] = [];

    for (const langConfig of config.languageConfigs) {
      for (const tool of langConfig.debugTools) {
        if (tool.required) {
          const installCmd = this.getInstallCommand(tool.name, langConfig.language);
          if (installCmd) {
            instructions.push(`- **${tool.name}:** \`${installCmd}\``);
          }
        }
      }
    }

    const content =
      instructions.length > 0
        ? `Install required tools:\n\n${instructions.join('\n')}`
        : 'All tools are optional or already available.';

    return {
      title: 'Tool Installation',
      content,
      priority: 80,
    };
  }

  private generateTroubleshooting(_config: ProjectDebugConfig): TemplateSection {
    const content = `### Common Issues

1. **Type checker not finding errors**
   - Ensure the tool is installed and in PATH
   - Check configuration file exists (tsconfig.json, pyrightconfig.json)
   - Verify source directories are correct

2. **Linter failing with config errors**
   - Create or update linter config file
   - Install required plugins
   - Check for conflicting rules

3. **Tests not running**
   - Verify test framework is installed
   - Check test file naming conventions
   - Ensure test configuration is correct

4. **Source maps not resolving**
   - Enable source map generation in build config
   - Check source map files exist alongside bundles
   - Verify source map URLs are correct`;

    return {
      title: 'Troubleshooting',
      content,
      priority: 90,
    };
  }

  private getInstallCommand(toolName: string, language: Language): string | null {
    const emptyLangs = {
      python: '',
      javascript: '',
      typescript: '',
      css: '',
      scss: '',
      tailwind: '',
      html: '',
      json: '',
      yaml: '',
      markdown: '',
      unknown: '',
    };

    const installCommands: Record<string, Record<Language, string>> = {
      pyright: { ...emptyLangs, python: 'pip install pyright' },
      ruff: { ...emptyLangs, python: 'pip install ruff' },
      eslint: {
        ...emptyLangs,
        javascript: 'npm install -D eslint',
        typescript: 'npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin',
      },
      tsc: { ...emptyLangs, typescript: 'npm install -D typescript' },
      stylelint: {
        ...emptyLangs,
        css: 'npm install -D stylelint stylelint-config-standard',
        scss: 'npm install -D stylelint stylelint-config-standard-scss',
        tailwind: 'npm install -D stylelint stylelint-config-standard',
      },
      vitest: {
        ...emptyLangs,
        javascript: 'npm install -D vitest',
        typescript: 'npm install -D vitest',
      },
      jest: {
        ...emptyLangs,
        javascript: 'npm install -D jest',
        typescript: 'npm install -D jest @types/jest ts-jest',
      },
      pytest: { ...emptyLangs, python: 'pip install pytest' },
    };

    return installCommands[toolName]?.[language] || null;
  }

  private generateSuggestions(config: ProjectDebugConfig, suggestions: string[]): void {
    // Check for missing type checkers
    for (const langConfig of config.languageConfigs) {
      if (langConfig.typeCheckers.length === 0) {
        if (langConfig.language === 'python') {
          suggestions.push('Consider adding Pyright for Python type checking');
        } else if (langConfig.language === 'typescript') {
          suggestions.push('Consider adding tsc --noEmit for TypeScript type checking');
        }
      }

      // Check for missing test commands
      if (langConfig.testCommands.length === 0) {
        suggestions.push(`Consider adding test commands for ${langConfig.language}`);
      }

      // Check for missing linters
      if (langConfig.linters.length === 0) {
        suggestions.push(`Consider adding a linter for ${langConfig.language}`);
      }
    }

    // Check preferences
    if (config.preferences.autoFixThreshold < 0.8) {
      suggestions.push(
        'Consider increasing auto-fix threshold to reduce false positives'
      );
    }

    // Check for known issues
    const temporaryIssues = config.knownIssues.filter((i) => i.temporary);
    if (temporaryIssues.length > 3) {
      suggestions.push(
        'Consider addressing some temporary workarounds to reduce technical debt'
      );
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a CLAUDE.md template generator
 */
export function createClaudeMdTemplate(
  config?: Partial<ClaudeMdTemplateConfig>
): ClaudeMdTemplate {
  return new ClaudeMdTemplate(config);
}
