/**
 * Platxa CLI — Unified Command Interface
 *
 * Provides generate, preview, deploy, test, and export operations
 * for the Platxa Odoo AI Website Generator.
 */

// =============================================================================
// Types
// =============================================================================

export interface CliCommand {
  /** Command name (e.g. "generate", "preview") */
  name: string;
  /** Short description */
  description: string;
  /** Positional arguments */
  args: ArgDef[];
  /** Named options */
  options: OptionDef[];
}

export interface ArgDef {
  name: string;
  description: string;
  required: boolean;
}

export interface OptionDef {
  /** Long flag (e.g. "--output") */
  long: string;
  /** Short flag (e.g. "-o") */
  short?: string;
  /** Description */
  description: string;
  /** Default value */
  defaultValue?: string;
  /** Whether it takes a value (vs boolean flag) */
  takesValue: boolean;
}

export interface ParsedArgs {
  /** The command name */
  command: string;
  /** Positional arguments */
  positional: string[];
  /** Named options (key→value or key→"true" for flags) */
  options: Record<string, string>;
  /** Whether help was requested */
  help: boolean;
  /** Parse errors */
  errors: string[];
}

export interface CommandResult {
  /** Exit code (0 = success) */
  exitCode: number;
  /** Output message */
  output: string;
  /** Error message (if any) */
  error?: string;
}

/** Handler function for a CLI command */
export type CommandHandler = (args: ParsedArgs) => CommandResult;

/** Full CLI configuration */
export interface CliConfig {
  /** CLI name */
  name: string;
  /** Version string */
  version: string;
  /** Registered commands */
  commands: Map<string, CliCommand>;
  /** Command handlers */
  handlers: Map<string, CommandHandler>;
}

// =============================================================================
// Command Definitions
// =============================================================================

export const GENERATE_CMD: CliCommand = {
  name: "generate",
  description: "Generate an Odoo website theme from a text prompt",
  args: [
    { name: "prompt", description: "Description of the website to generate", required: true },
  ],
  options: [
    { long: "--output", short: "-o", description: "Output directory", defaultValue: "./output", takesValue: true },
    { long: "--version", short: "-v", description: "Odoo version (16.0, 17.0, 18.0)", defaultValue: "17.0", takesValue: true },
    { long: "--palette", short: "-p", description: "Color palette preset", takesValue: true },
    { long: "--font", short: "-f", description: "Font preset", takesValue: true },
    { long: "--dry-run", description: "Show what would be generated without writing files", takesValue: false },
  ],
};

export const PREVIEW_CMD: CliCommand = {
  name: "preview",
  description: "Start a local preview server for a generated theme",
  args: [
    { name: "path", description: "Path to theme module directory", required: false },
  ],
  options: [
    { long: "--port", short: "-p", description: "Server port", defaultValue: "3000", takesValue: true },
    { long: "--open", description: "Open browser automatically", takesValue: false },
    { long: "--watch", short: "-w", description: "Watch for file changes", takesValue: false },
  ],
};

export const DEPLOY_CMD: CliCommand = {
  name: "deploy",
  description: "Deploy theme to an Odoo instance via XML-RPC",
  args: [
    { name: "path", description: "Path to theme module", required: true },
  ],
  options: [
    { long: "--url", short: "-u", description: "Odoo instance URL", takesValue: true },
    { long: "--db", short: "-d", description: "Database name", takesValue: true },
    { long: "--user", description: "Username", takesValue: true },
    { long: "--password", description: "Password (or use ODOO_PASSWORD env)", takesValue: true },
    { long: "--validate", description: "Run App Store validation before deploy", takesValue: false },
  ],
};

export const TEST_CMD: CliCommand = {
  name: "test",
  description: "Run theme tests in a Docker Odoo environment",
  args: [
    { name: "path", description: "Path to theme module", required: false },
  ],
  options: [
    { long: "--version", short: "-v", description: "Odoo version to test against", defaultValue: "17.0", takesValue: true },
    { long: "--keep", short: "-k", description: "Keep Docker container after tests", takesValue: false },
    { long: "--verbose", description: "Verbose test output", takesValue: false },
  ],
};

export const EXPORT_CMD: CliCommand = {
  name: "export",
  description: "Export theme as a distributable package (zip)",
  args: [
    { name: "path", description: "Path to theme module", required: true },
  ],
  options: [
    { long: "--output", short: "-o", description: "Output zip file path", takesValue: true },
    { long: "--format", short: "-f", description: "Export format (zip, tar.gz)", defaultValue: "zip", takesValue: true },
    { long: "--optimize", description: "Run asset optimization before export", takesValue: false },
    { long: "--all-versions", description: "Export for all supported Odoo versions", takesValue: false },
  ],
};

export const ALL_COMMANDS: CliCommand[] = [
  GENERATE_CMD,
  PREVIEW_CMD,
  DEPLOY_CMD,
  TEST_CMD,
  EXPORT_CMD,
];

// =============================================================================
// Argument Parser
// =============================================================================

/**
 * Parses raw CLI arguments into a structured ParsedArgs object.
 * argv should exclude the binary name (process.argv.slice(2) equivalent).
 */
export function parseArgs(argv: string[], commands: Map<string, CliCommand>): ParsedArgs {
  const result: ParsedArgs = {
    command: "",
    positional: [],
    options: {},
    help: false,
    errors: [],
  };

  if (argv.length === 0) {
    result.errors.push("No command specified");
    return result;
  }

  // Check for global help
  if (argv[0] === "--help" || argv[0] === "-h") {
    result.help = true;
    return result;
  }

  const cmdName = argv[0];
  result.command = cmdName;

  const cmd = commands.get(cmdName);
  if (!cmd) {
    result.errors.push(`Unknown command: ${cmdName}`);
    return result;
  }

  // Build option lookup
  const longToKey = new Map<string, string>();
  const shortToKey = new Map<string, string>();
  const takesValue = new Map<string, boolean>();
  const defaults = new Map<string, string>();

  for (const opt of cmd.options) {
    const key = opt.long.replace(/^--/, "");
    longToKey.set(opt.long, key);
    if (opt.short) shortToKey.set(opt.short, key);
    takesValue.set(key, opt.takesValue);
    if (opt.defaultValue != null) defaults.set(key, opt.defaultValue);
  }

  // Apply defaults
  for (const [key, val] of defaults) {
    result.options[key] = val;
  }

  // Parse remaining args
  let i = 1;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
      i++;
      continue;
    }

    if (arg.startsWith("--") || (arg.startsWith("-") && arg.length === 2)) {
      const key = longToKey.get(arg) ?? shortToKey.get(arg);
      if (!key) {
        result.errors.push(`Unknown option: ${arg}`);
        i++;
        continue;
      }

      if (takesValue.get(key)) {
        if (i + 1 >= argv.length) {
          result.errors.push(`Option ${arg} requires a value`);
          i++;
          continue;
        }
        result.options[key] = argv[i + 1];
        i += 2;
      } else {
        result.options[key] = "true";
        i++;
      }
    } else {
      result.positional.push(arg);
      i++;
    }
  }

  // Validate required args (skip if help requested)
  if (!result.help) {
    const requiredArgs = cmd.args.filter((a) => a.required);
    for (let j = 0; j < requiredArgs.length; j++) {
      if (j >= result.positional.length) {
        result.errors.push(`Missing required argument: ${requiredArgs[j].name}`);
      }
    }
  }

  return result;
}

// =============================================================================
// Help Text Generation
// =============================================================================

export function formatCommandHelp(cmd: CliCommand): string {
  const argsStr = cmd.args
    .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
    .join(" ");

  let help = `Usage: platxa ${cmd.name} ${argsStr}\n\n`;
  help += `  ${cmd.description}\n\n`;

  if (cmd.args.length > 0) {
    help += "Arguments:\n";
    for (const arg of cmd.args) {
      help += `  ${arg.name.padEnd(20)} ${arg.description}${arg.required ? " (required)" : ""}\n`;
    }
    help += "\n";
  }

  if (cmd.options.length > 0) {
    help += "Options:\n";
    for (const opt of cmd.options) {
      const flags = opt.short ? `${opt.short}, ${opt.long}` : `    ${opt.long}`;
      const def = opt.defaultValue ? ` [default: ${opt.defaultValue}]` : "";
      help += `  ${flags.padEnd(24)} ${opt.description}${def}\n`;
    }
  }

  return help;
}

export function formatGlobalHelp(version: string): string {
  let help = `Platxa CLI v${version}\n\n`;
  help += "Usage: platxa <command> [options]\n\n";
  help += "Commands:\n";
  for (const cmd of ALL_COMMANDS) {
    help += `  ${cmd.name.padEnd(16)} ${cmd.description}\n`;
  }
  help += "\nRun 'platxa <command> --help' for command-specific help.\n";
  return help;
}

// =============================================================================
// CLI Factory
// =============================================================================

/**
 * Creates a CLI configuration with all default commands registered.
 */
export function createCli(version: string = "1.0.0"): CliConfig {
  const commands = new Map<string, CliCommand>();
  for (const cmd of ALL_COMMANDS) {
    commands.set(cmd.name, cmd);
  }
  return {
    name: "platxa",
    version,
    commands,
    handlers: new Map(),
  };
}

/** Registers a handler for a command. */
export function registerHandler(
  cli: CliConfig,
  commandName: string,
  handler: CommandHandler,
): CliConfig {
  const handlers = new Map(cli.handlers);
  handlers.set(commandName, handler);
  return { ...cli, handlers };
}

/**
 * Runs the CLI with given argv. Returns the command result.
 */
export function runCli(cli: CliConfig, argv: string[]): CommandResult {
  const parsed = parseArgs(argv, cli.commands);

  if (parsed.help && !parsed.command) {
    return { exitCode: 0, output: formatGlobalHelp(cli.version) };
  }

  if (parsed.errors.length > 0) {
    return { exitCode: 1, output: "", error: parsed.errors.join("\n") };
  }

  if (parsed.help) {
    const cmd = cli.commands.get(parsed.command);
    if (cmd) {
      return { exitCode: 0, output: formatCommandHelp(cmd) };
    }
  }

  const handler = cli.handlers.get(parsed.command);
  if (!handler) {
    return {
      exitCode: 1,
      output: "",
      error: `No handler registered for command: ${parsed.command}`,
    };
  }

  return handler(parsed);
}
