import { NextResponse } from "next/server";

/**
 * Health Check API Endpoint
 *
 * Used by Docker, Kubernetes, and load balancers to verify application health.
 * Returns 200 OK when the application is healthy and ready to serve requests.
 */

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    name: string;
    status: "pass" | "fail";
    message?: string;
  }[];
}

// Track when the server started
const startTime = Date.now();

export async function GET() {
  const checks: HealthStatus["checks"] = [];

  // Check 1: Basic runtime
  checks.push({
    name: "runtime",
    status: "pass",
    message: "Node.js runtime operational",
  });

  // Check 2: Memory usage
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

  checks.push({
    name: "memory",
    status: memoryPercentage < 90 ? "pass" : "fail",
    message: `Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${memoryPercentage.toFixed(1)}%)`,
  });

  // Check 3: Environment
  const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OLLAMA_BASE_URL);
  checks.push({
    name: "ai-provider",
    status: hasApiKey ? "pass" : "fail",
    message: hasApiKey ? "AI provider configured" : "No AI provider configured",
  });

  // Determine overall status
  const failedChecks = checks.filter((c) => c.status === "fail");
  let status: HealthStatus["status"] = "healthy";

  if (failedChecks.length > 0) {
    // Memory and runtime are critical
    const criticalFailure = failedChecks.some(
      (c) => c.name === "runtime" || c.name === "memory"
    );
    status = criticalFailure ? "unhealthy" : "degraded";
  }

  const healthStatus: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  // Return appropriate HTTP status
  const httpStatus = status === "unhealthy" ? 503 : 200;

  return NextResponse.json(healthStatus, { status: httpStatus });
}

// Also support HEAD requests for simple health checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
