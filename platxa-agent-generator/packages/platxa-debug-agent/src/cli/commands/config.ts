/**
 * Config command - Manage debug agent configuration
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ConfigOptions {
  list?: boolean;
  reset?: boolean;
}

const CONFIG_PATH = join(process.cwd(), '.platxa-debug', 'config.json');

export async function configCommand(
  key: string | undefined,
  value: string | undefined,
  options: Record<string, unknown>
): Promise<void> {
  const opts = options as ConfigOptions;

  if (opts.reset) {
    console.log(`Resetting configuration is not yet implemented.`);
    console.log(`Delete ${CONFIG_PATH} and run 'platxa-debug init' to recreate.`);
    return;
  }

  if (!existsSync(CONFIG_PATH)) {
    console.error(`No configuration found at ${CONFIG_PATH}`);
    console.error(`Run 'platxa-debug init' to create one.`);
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>;

  if (opts.list || (key === undefined && value === undefined)) {
    console.log(`\n=== Platxa Debug Configuration ===\n`);
    console.log(`Location: ${CONFIG_PATH}\n`);
    listConfig(config);
    return;
  }

  if (key !== undefined && value === undefined) {
    // Get a specific key
    const keyValue = getNestedValue(config, key);
    if (keyValue !== undefined) {
      console.log(`${key} = ${JSON.stringify(keyValue)}`);
    } else {
      console.error(`Configuration key not found: ${key}`);
      process.exit(1);
    }
    return;
  }

  if (key !== undefined && value !== undefined) {
    // Set a specific key
    setNestedValue(config, key, parseValue(value));
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`Set ${key} = ${value}`);
    return;
  }
}

function listConfig(config: Record<string, unknown>, prefix = ''): void {
  for (const [configKey, configValue] of Object.entries(config)) {
    const fullKey = prefix ? `${prefix}.${configKey}` : configKey;
    if (typeof configValue === 'object' && configValue !== null && !Array.isArray(configValue)) {
      listConfig(configValue as Record<string, unknown>, fullKey);
    } else {
      console.log(`  ${fullKey} = ${JSON.stringify(configValue)}`);
    }
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const pathKey of keys) {
    if (current !== null && typeof current === 'object' && pathKey in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[pathKey];
    } else {
      return undefined;
    }
  }

  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');

  if (keys.length === 0) {
    return;
  }

  let current = obj;

  // Navigate to the parent of the target key
  for (let i = 0; i < keys.length - 1; i++) {
    const pathKey = keys[i]!;
    if (!(pathKey in current) || typeof current[pathKey] !== 'object' || current[pathKey] === null) {
      current[pathKey] = {};
    }
    current = current[pathKey] as Record<string, unknown>;
  }

  // Set the final key
  const finalKey = keys[keys.length - 1]!;
  current[finalKey] = value;
}

function parseValue(value: string): unknown {
  // Try to parse as JSON first
  try {
    return JSON.parse(value);
  } catch {
    // Return as string if not valid JSON
    return value;
  }
}
