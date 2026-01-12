/**
 * Init command - Initialize debug configuration for the project
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface InitOptions {
  force?: boolean;
  template?: 'minimal' | 'standard' | 'comprehensive';
}

export async function initCommand(
  options: Record<string, unknown>
): Promise<void> {
  const opts = options as InitOptions;
  const template = opts.template ?? 'standard';

  const configDir = join(process.cwd(), '.platxa-debug');
  const configFile = join(configDir, 'config.json');

  if (existsSync(configFile) && !opts.force) {
    console.error(`Configuration already exists at ${configFile}`);
    console.error(`Use --force to overwrite.`);
    process.exit(1);
  }

  // Create config directory
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Generate config based on template
  const config = generateConfig(template);

  writeFileSync(configFile, JSON.stringify(config, null, 2));
  console.log(`\n=== Platxa Debug Agent Initialized ===\n`);
  console.log(`Template: ${template}`);
  console.log(`Config: ${configFile}`);
  console.log(`\nConfiguration options:`);
  console.log(`  - Languages: ${config.languages.join(', ')}`);
  console.log(`  - Log patterns: ${config.logPatterns.length} patterns`);
  console.log(`  - Auto-fix: ${config.autoFix ? 'enabled' : 'disabled'}`);
  console.log(`\nYou can customize the configuration by editing:`);
  console.log(`  ${configFile}`);
}

interface DebugConfig {
  version: string;
  template: string;
  languages: string[];
  logPatterns: string[];
  autoFix: boolean;
  cicd: {
    enabled: boolean;
    failOnError: boolean;
    reportFormat: string;
  };
  vscode: {
    enabled: boolean;
    realTimeDiagnostics: boolean;
  };
}

function generateConfig(template: string): DebugConfig {
  const baseConfig: DebugConfig = {
    version: '1.0',
    template,
    languages: ['python', 'javascript', 'typescript'],
    logPatterns: ['**/*.log', '**/logs/**'],
    autoFix: false,
    cicd: {
      enabled: false,
      failOnError: false,
      reportFormat: 'sarif',
    },
    vscode: {
      enabled: true,
      realTimeDiagnostics: true,
    },
  };

  if (template === 'minimal') {
    baseConfig.languages = ['javascript', 'typescript'];
    baseConfig.logPatterns = [];
    baseConfig.vscode.enabled = false;
  } else if (template === 'comprehensive') {
    baseConfig.languages = ['python', 'javascript', 'typescript', 'css', 'html'];
    baseConfig.logPatterns = ['**/*.log', '**/logs/**', '**/error*.txt'];
    baseConfig.cicd.enabled = true;
    baseConfig.cicd.failOnError = true;
  }

  return baseConfig;
}
