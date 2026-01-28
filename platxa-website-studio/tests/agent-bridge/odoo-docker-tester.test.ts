import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_DOCKER_CONFIG,
  generateDockerCommands,
  runDockerThemeTest,
} from "@/lib/agent-bridge/odoo-docker-tester";
import type { CommandExecutor, HttpFetcher, DockerTestOptions } from "@/lib/agent-bridge/odoo-docker-tester";

const ok: CommandExecutor = async () => ({ stdout: "ok", stderr: "", exitCode: 0 });
const okFetch: HttpFetcher = async () => ({ status: 200, body: "<html><body class='o_website'>s_hero</body></html>" });

const makeOpts = (overrides?: Partial<DockerTestOptions>): DockerTestOptions => ({
  moduleName: "theme_flavor",
  themeHostPath: "/tmp/theme_flavor",
  exec: ok,
  fetch: okFetch,
  ...overrides,
});

describe("Odoo Docker Tester", () => {
  describe("DEFAULT_DOCKER_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_DOCKER_CONFIG.image).toBe("odoo:16.0");
      expect(DEFAULT_DOCKER_CONFIG.port).toBe(8069);
      expect(DEFAULT_DOCKER_CONFIG.database).toBe("test_theme");
    });
  });

  describe("generateDockerCommands", () => {
    it("generates setup, install, check, and teardown commands", () => {
      const cmds = generateDockerCommands(makeOpts());
      expect(cmds.setup.length).toBeGreaterThanOrEqual(3);
      expect(cmds.install).toContain("theme_flavor");
      expect(cmds.install).toContain("-i");
      expect(cmds.check).toContain("localhost");
      expect(cmds.teardown.length).toBeGreaterThanOrEqual(2);
    });

    it("includes theme mount path in setup", () => {
      const cmds = generateDockerCommands(makeOpts());
      const odooRun = cmds.setup.find((c) => c.includes("odoo:16.0"));
      expect(odooRun).toContain("/tmp/theme_flavor");
      expect(odooRun).toContain("/mnt/extra-addons");
    });

    it("uses custom port", () => {
      const cmds = generateDockerCommands(makeOpts({ config: { port: 9090 } }));
      expect(cmds.check).toContain("9090");
    });

    it("includes network creation and cleanup", () => {
      const cmds = generateDockerCommands(makeOpts());
      expect(cmds.setup[0]).toContain("network create");
      expect(cmds.teardown.some((c) => c.includes("network rm"))).toBe(true);
    });
  });

  describe("runDockerThemeTest", () => {
    it("succeeds when install and render pass", async () => {
      const result = await runDockerThemeTest(makeOpts());

      expect(result.success).toBe(true);
      expect(result.summary).toContain("successfully");
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("includes render checks for default URLs", async () => {
      const result = await runDockerThemeTest(makeOpts());

      expect(result.renderChecks.length).toBe(2);
      expect(result.renderChecks[0].url).toContain("/");
      expect(result.renderChecks[0].noErrors).toBe(true);
    });

    it("fails when installation fails", async () => {
      const failExec: CommandExecutor = async (cmd) => {
        if (cmd.includes("-i theme_flavor")) {
          return { stdout: "", stderr: "Module not found", exitCode: 1 };
        }
        return { stdout: "ok", stderr: "", exitCode: 0 };
      };

      const result = await runDockerThemeTest(makeOpts({ exec: failExec }));

      expect(result.success).toBe(false);
      expect(result.summary).toContain("failed");
    });

    it("fails when render has errors", async () => {
      const errorFetch: HttpFetcher = async () => ({
        status: 500,
        body: "Internal Server Error\nTraceback",
      });

      const result = await runDockerThemeTest(makeOpts({ fetch: errorFetch }));

      expect(result.success).toBe(false);
      expect(result.renderChecks[0].noErrors).toBe(false);
      expect(result.renderChecks[0].errors).toContain("Internal Server Error");
    });

    it("detects QWeb template errors", async () => {
      const qwebFetch: HttpFetcher = async () => ({
        status: 200,
        body: "<html>QWebException: template not found</html>",
      });

      const result = await runDockerThemeTest(makeOpts({ fetch: qwebFetch }));

      expect(result.success).toBe(false);
      expect(result.renderChecks[0].errors).toContain("QWeb template error");
    });

    it("calls onStep for each step", async () => {
      const onStep = vi.fn();
      await runDockerThemeTest(makeOpts({ onStep }));

      // setup(4) + install(1) + render(2) + teardown(3) = 10
      expect(onStep.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it("always runs teardown even on failure", async () => {
      const commands: string[] = [];
      const trackExec: CommandExecutor = async (cmd) => {
        commands.push(cmd);
        if (cmd.includes("-i theme_flavor")) {
          return { stdout: "", stderr: "fail", exitCode: 1 };
        }
        return { stdout: "ok", stderr: "", exitCode: 0 };
      };

      await runDockerThemeTest(makeOpts({ exec: trackExec }));

      expect(commands.some((c) => c.includes("docker stop"))).toBe(true);
      expect(commands.some((c) => c.includes("docker rm"))).toBe(true);
    });

    it("checks custom URLs", async () => {
      const result = await runDockerThemeTest(makeOpts({
        checkUrls: ["/shop", "/blog"],
      }));

      expect(result.renderChecks).toHaveLength(2);
      expect(result.renderChecks[0].url).toContain("/shop");
      expect(result.renderChecks[1].url).toContain("/blog");
    });

    it("reports all generated commands", async () => {
      const result = await runDockerThemeTest(makeOpts());
      expect(result.commands.length).toBeGreaterThanOrEqual(7);
    });

    it("detects theme elements in rendered page", async () => {
      const result = await runDockerThemeTest(makeOpts());
      expect(result.renderChecks[0].themeElementsFound).toBe(true);
    });
  });
});
