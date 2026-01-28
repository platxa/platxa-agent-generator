/**
 * Automated Theme Testing Against Odoo Docker Instance
 *
 * Orchestrates theme installation verification on an Odoo Docker container:
 * 1. Prepare container config with theme module mounted
 * 2. Install theme module via Odoo CLI
 * 3. Verify website renders without errors
 * 4. Collect results and cleanup
 */

// =============================================================================
// Types
// =============================================================================

/** Docker container configuration for Odoo testing */
export interface OdooDockerConfig {
  /** Odoo Docker image (default "odoo:16.0") */
  image: string;
  /** PostgreSQL image (default "postgres:15") */
  postgresImage: string;
  /** Container name prefix */
  containerPrefix: string;
  /** Port to expose Odoo on (default 8069) */
  port: number;
  /** Database name (default "test_theme") */
  database: string;
  /** Path to mount theme module */
  themeMountPath: string;
  /** Timeout for operations in ms (default 120000) */
  timeoutMs: number;
}

/** A single test step result */
export interface TestStep {
  /** Step name */
  name: string;
  /** Whether this step passed */
  passed: boolean;
  /** Duration in ms */
  durationMs: number;
  /** Output/log from this step */
  output: string;
  /** Error message if failed */
  error?: string;
}

/** Result of a page render check */
export interface RenderCheck {
  /** URL that was checked */
  url: string;
  /** HTTP status code */
  statusCode: number;
  /** Whether the page rendered without errors */
  noErrors: boolean;
  /** Any error messages found in the page */
  errors: string[];
  /** Whether key theme elements were found */
  themeElementsFound: boolean;
}

/** Complete test result */
export interface DockerTestResult {
  /** Whether the theme installed and rendered successfully */
  success: boolean;
  /** All test steps executed */
  steps: TestStep[];
  /** Render check results */
  renderChecks: RenderCheck[];
  /** Total duration in ms */
  totalDurationMs: number;
  /** Docker commands that were generated */
  commands: string[];
  /** Summary message */
  summary: string;
}

/** Function that executes a shell command and returns output */
export type CommandExecutor = (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

/** Function that fetches a URL and returns response info */
export type HttpFetcher = (url: string) => Promise<{ status: number; body: string }>;

/** Options for the test run */
export interface DockerTestOptions {
  /** Custom Docker config overrides */
  config?: Partial<OdooDockerConfig>;
  /** Theme module name */
  moduleName: string;
  /** Path to the packaged theme directory on host */
  themeHostPath: string;
  /** Shell command executor */
  exec: CommandExecutor;
  /** HTTP fetcher for render checks */
  fetch: HttpFetcher;
  /** URLs to check after installation (default: ["/", "/contactus"]) */
  checkUrls?: string[];
  /** Called after each step */
  onStep?: (step: TestStep) => void;
}

// =============================================================================
// Default Config
// =============================================================================

export const DEFAULT_DOCKER_CONFIG: OdooDockerConfig = {
  image: "odoo:16.0",
  postgresImage: "postgres:15",
  containerPrefix: "platxa_test",
  port: 8069,
  database: "test_theme",
  themeMountPath: "/mnt/extra-addons",
  timeoutMs: 120_000,
};

// =============================================================================
// Command Generation
// =============================================================================

/**
 * Generates Docker commands for the full test lifecycle.
 */
export function generateDockerCommands(
  options: DockerTestOptions,
): { setup: string[]; install: string; check: string; teardown: string[] } {
  const cfg = { ...DEFAULT_DOCKER_CONFIG, ...options.config };
  const pgName = `${cfg.containerPrefix}_pg`;
  const odooName = `${cfg.containerPrefix}_odoo`;
  const network = `${cfg.containerPrefix}_net`;

  const setup = [
    // Create network
    `docker network create ${network}`,
    // Start PostgreSQL
    `docker run -d --name ${pgName} --network ${network} -e POSTGRES_USER=odoo -e POSTGRES_PASSWORD=odoo -e POSTGRES_DB=postgres ${cfg.postgresImage}`,
    // Wait for PG ready
    `docker exec ${pgName} pg_isready -U odoo -t 30`,
    // Start Odoo with theme mounted
    `docker run -d --name ${odooName} --network ${network} -p ${cfg.port}:8069 -v ${options.themeHostPath}:${cfg.themeMountPath} -e HOST=${pgName} -e USER=odoo -e PASSWORD=odoo ${cfg.image} -- --addons-path=/mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons`,
  ];

  // Install theme module
  const install = `docker exec ${odooName} odoo -d ${cfg.database} -i ${options.moduleName} --stop-after-init --no-http`;

  // Health check
  const check = `curl -s -o /dev/null -w "%{http_code}" http://localhost:${cfg.port}/`;

  const teardown = [
    `docker stop ${odooName} ${pgName}`,
    `docker rm ${odooName} ${pgName}`,
    `docker network rm ${network}`,
  ];

  return { setup, install, check, teardown };
}

// =============================================================================
// Test Runner
// =============================================================================

/**
 * Runs the full Odoo Docker theme test:
 * 1. Start PostgreSQL + Odoo containers with theme mounted
 * 2. Install theme module
 * 3. Verify website renders without errors
 * 4. Cleanup containers
 */
export async function runDockerThemeTest(
  options: DockerTestOptions,
): Promise<DockerTestResult> {
  const cfg = { ...DEFAULT_DOCKER_CONFIG, ...options.config };
  const commands = generateDockerCommands(options);
  const allCommands = [...commands.setup, commands.install, commands.check, ...commands.teardown];
  const steps: TestStep[] = [];
  const renderChecks: RenderCheck[] = [];
  const totalStart = performance.now();
  let aborted = false;

  const runStep = async (name: string, fn: () => Promise<string>): Promise<TestStep> => {
    const start = performance.now();
    try {
      const output = await fn();
      const step: TestStep = {
        name,
        passed: true,
        durationMs: Math.round(performance.now() - start),
        output,
      };
      steps.push(step);
      options.onStep?.(step);
      return step;
    } catch (err) {
      const step: TestStep = {
        name,
        passed: false,
        durationMs: Math.round(performance.now() - start),
        output: "",
        error: err instanceof Error ? err.message : String(err),
      };
      steps.push(step);
      options.onStep?.(step);
      aborted = true;
      return step;
    }
  };

  // Step 1: Setup containers
  for (const cmd of commands.setup) {
    if (aborted) break;
    await runStep(`Setup: ${cmd.split(" ").slice(0, 3).join(" ")}...`, async () => {
      const result = await options.exec(cmd);
      if (result.exitCode !== 0) throw new Error(result.stderr || `Exit code ${result.exitCode}`);
      return result.stdout;
    });
  }

  // Step 2: Install theme
  if (!aborted) {
    await runStep("Install theme module", async () => {
      const result = await options.exec(commands.install);
      if (result.exitCode !== 0) throw new Error(result.stderr || "Installation failed");
      return result.stdout;
    });
  }

  // Step 3: Render checks
  if (!aborted) {
    const urls = options.checkUrls || ["/", "/contactus"];
    for (const path of urls) {
      await runStep(`Render check: ${path}`, async () => {
        const url = `http://localhost:${cfg.port}${path}`;
        const response = await options.fetch(url);
        const errors: string[] = [];

        // Check for Odoo error patterns
        if (response.body.includes("Internal Server Error")) errors.push("Internal Server Error");
        if (response.body.includes("Traceback")) errors.push("Python traceback detected");
        if (response.body.includes("QWebException")) errors.push("QWeb template error");
        if (response.body.includes("odoo.exceptions")) errors.push("Odoo exception detected");

        const themeElementsFound = response.body.includes(options.moduleName) ||
          response.body.includes("s_") ||
          response.body.includes("o_");

        const check: RenderCheck = {
          url,
          statusCode: response.status,
          noErrors: errors.length === 0 && response.status === 200,
          errors,
          themeElementsFound,
        };
        renderChecks.push(check);

        if (!check.noErrors) {
          throw new Error(`Render errors: ${errors.join(", ") || `HTTP ${response.status}`}`);
        }
        return `HTTP ${response.status} — no errors`;
      });
    }
  }

  // Step 4: Teardown (always run)
  for (const cmd of commands.teardown) {
    const start = performance.now();
    try {
      await options.exec(cmd);
    } catch {
      // Teardown failures are non-fatal
    }
    steps.push({
      name: `Teardown: ${cmd.split(" ").slice(0, 3).join(" ")}...`,
      passed: true,
      durationMs: Math.round(performance.now() - start),
      output: "",
    });
  }

  const totalDurationMs = Math.round(performance.now() - totalStart);
  const success = !aborted && renderChecks.every((r) => r.noErrors);

  const failedSteps = steps.filter((s) => !s.passed);
  const summary = success
    ? `Theme ${options.moduleName} installed and rendered successfully`
    : `Theme test failed: ${failedSteps.map((s) => s.error || s.name).join("; ")}`;

  return {
    success,
    steps,
    renderChecks,
    totalDurationMs,
    commands: allCommands,
    summary,
  };
}
