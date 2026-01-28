import { describe, it, expect } from "vitest";
import {
  GENERATE_CMD,
  PREVIEW_CMD,
  DEPLOY_CMD,
  TEST_CMD,
  EXPORT_CMD,
  ALL_COMMANDS,
  parseArgs,
  formatCommandHelp,
  formatGlobalHelp,
  createCli,
  registerHandler,
  runCli,
} from "@/lib/agent-bridge/platxa-cli";

function cmdMap() {
  const m = new Map();
  for (const cmd of ALL_COMMANDS) m.set(cmd.name, cmd);
  return m;
}

describe("Platxa CLI", () => {
  describe("ALL_COMMANDS", () => {
    it("has 5 commands", () => {
      expect(ALL_COMMANDS).toHaveLength(5);
    });

    it("includes generate, preview, deploy, test, export", () => {
      const names = ALL_COMMANDS.map((c) => c.name);
      expect(names).toContain("generate");
      expect(names).toContain("preview");
      expect(names).toContain("deploy");
      expect(names).toContain("test");
      expect(names).toContain("export");
    });
  });

  describe("parseArgs", () => {
    const commands = cmdMap();

    it("parses command with positional arg", () => {
      const parsed = parseArgs(["generate", "Build a pizza website"], commands);
      expect(parsed.command).toBe("generate");
      expect(parsed.positional[0]).toBe("Build a pizza website");
      expect(parsed.errors).toHaveLength(0);
    });

    it("parses long options with values", () => {
      const parsed = parseArgs(["generate", "prompt", "--output", "/tmp/out"], commands);
      expect(parsed.options["output"]).toBe("/tmp/out");
    });

    it("parses short options", () => {
      const parsed = parseArgs(["generate", "prompt", "-o", "/tmp/out"], commands);
      expect(parsed.options["output"]).toBe("/tmp/out");
    });

    it("parses boolean flags", () => {
      const parsed = parseArgs(["generate", "prompt", "--dry-run"], commands);
      expect(parsed.options["dry-run"]).toBe("true");
    });

    it("applies default values", () => {
      const parsed = parseArgs(["generate", "prompt"], commands);
      expect(parsed.options["output"]).toBe("./output");
      expect(parsed.options["version"]).toBe("17.0");
    });

    it("overrides defaults with explicit values", () => {
      const parsed = parseArgs(["generate", "prompt", "-v", "18.0"], commands);
      expect(parsed.options["version"]).toBe("18.0");
    });

    it("errors for unknown command", () => {
      const parsed = parseArgs(["unknown"], commands);
      expect(parsed.errors[0]).toContain("Unknown command");
    });

    it("errors for empty argv", () => {
      const parsed = parseArgs([], commands);
      expect(parsed.errors[0]).toContain("No command");
    });

    it("errors for missing required arg", () => {
      const parsed = parseArgs(["generate"], commands);
      expect(parsed.errors.some((e) => e.includes("Missing required"))).toBe(true);
    });

    it("does not error for missing optional arg", () => {
      const parsed = parseArgs(["preview"], commands);
      expect(parsed.errors).toHaveLength(0);
    });

    it("errors for unknown option", () => {
      const parsed = parseArgs(["generate", "prompt", "--unknown"], commands);
      expect(parsed.errors.some((e) => e.includes("Unknown option"))).toBe(true);
    });

    it("errors for option missing value", () => {
      const parsed = parseArgs(["generate", "prompt", "--output"], commands);
      expect(parsed.errors.some((e) => e.includes("requires a value"))).toBe(true);
    });

    it("detects --help flag", () => {
      const parsed = parseArgs(["generate", "--help"], commands);
      expect(parsed.help).toBe(true);
    });

    it("detects global --help", () => {
      const parsed = parseArgs(["--help"], commands);
      expect(parsed.help).toBe(true);
    });
  });

  describe("formatCommandHelp", () => {
    it("includes command name", () => {
      expect(formatCommandHelp(GENERATE_CMD)).toContain("generate");
    });

    it("includes description", () => {
      expect(formatCommandHelp(GENERATE_CMD)).toContain("Generate an Odoo website theme");
    });

    it("shows required args in angle brackets", () => {
      expect(formatCommandHelp(GENERATE_CMD)).toContain("<prompt>");
    });

    it("shows optional args in square brackets", () => {
      expect(formatCommandHelp(PREVIEW_CMD)).toContain("[path]");
    });

    it("lists options with flags", () => {
      const help = formatCommandHelp(DEPLOY_CMD);
      expect(help).toContain("--url");
      expect(help).toContain("-u");
    });

    it("shows default values", () => {
      expect(formatCommandHelp(GENERATE_CMD)).toContain("[default: ./output]");
    });
  });

  describe("formatGlobalHelp", () => {
    it("includes version", () => {
      expect(formatGlobalHelp("2.0.0")).toContain("v2.0.0");
    });

    it("lists all commands", () => {
      const help = formatGlobalHelp("1.0.0");
      expect(help).toContain("generate");
      expect(help).toContain("preview");
      expect(help).toContain("deploy");
      expect(help).toContain("test");
      expect(help).toContain("export");
    });
  });

  describe("createCli / registerHandler / runCli", () => {
    it("creates CLI with all commands", () => {
      const cli = createCli("1.0.0");
      expect(cli.commands.size).toBe(5);
      expect(cli.version).toBe("1.0.0");
    });

    it("registers and runs a handler", () => {
      let cli = createCli();
      cli = registerHandler(cli, "generate", (args) => ({
        exitCode: 0,
        output: `Generated: ${args.positional[0]}`,
      }));
      const result = runCli(cli, ["generate", "A law firm website"]);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("Generated: A law firm website");
    });

    it("returns global help for --help", () => {
      const cli = createCli("1.0.0");
      const result = runCli(cli, ["--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("Platxa CLI");
    });

    it("returns command help for command --help", () => {
      const cli = createCli();
      const result = runCli(cli, ["generate", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("generate");
    });

    it("returns error for unknown command", () => {
      const cli = createCli();
      const result = runCli(cli, ["bad"]);
      expect(result.exitCode).toBe(1);
      expect(result.error).toContain("Unknown command");
    });

    it("returns error for unregistered handler", () => {
      const cli = createCli();
      const result = runCli(cli, ["generate", "prompt"]);
      expect(result.exitCode).toBe(1);
      expect(result.error).toContain("No handler");
    });

    it("does not mutate cli on registerHandler", () => {
      const cli = createCli();
      const cli2 = registerHandler(cli, "test", () => ({ exitCode: 0, output: "" }));
      expect(cli.handlers.size).toBe(0);
      expect(cli2.handlers.size).toBe(1);
    });

    it("passes options to handler", () => {
      let cli = createCli();
      cli = registerHandler(cli, "preview", (args) => ({
        exitCode: 0,
        output: `port=${args.options["port"]}`,
      }));
      const result = runCli(cli, ["preview", "--port", "8080"]);
      expect(result.output).toBe("port=8080");
    });
  });

  describe("command definitions", () => {
    it("GENERATE_CMD requires prompt arg", () => {
      expect(GENERATE_CMD.args[0].required).toBe(true);
    });

    it("PREVIEW_CMD has optional path arg", () => {
      expect(PREVIEW_CMD.args[0].required).toBe(false);
    });

    it("DEPLOY_CMD has --validate flag", () => {
      expect(DEPLOY_CMD.options.some((o) => o.long === "--validate")).toBe(true);
    });

    it("TEST_CMD has --keep flag", () => {
      expect(TEST_CMD.options.some((o) => o.long === "--keep")).toBe(true);
    });

    it("EXPORT_CMD has --all-versions flag", () => {
      expect(EXPORT_CMD.options.some((o) => o.long === "--all-versions")).toBe(true);
    });
  });
});
