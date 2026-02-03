/**
 * POST /api/deploy - Deploy theme to Odoo instance
 * GET /api/deploy - Test Odoo connection
 *
 * Handles one-click deployment of generated themes to connected Odoo instances.
 */

import {
  deployToOdoo,
  authenticate,
  type OdooConnection,
  type DeployResult,
} from "@/lib/agent-bridge/odoo-xmlrpc-deploy";

// Simple XML-RPC implementation using fetch
async function xmlrpcCall(
  url: string,
  service: string,
  method: string,
  args: unknown[]
): Promise<unknown> {
  // Build XML-RPC request
  const xmlBody = buildXmlRpcRequest(method, args);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
    },
    body: xmlBody,
  });

  if (!response.ok) {
    throw new Error(`XML-RPC request failed: ${response.status}`);
  }

  const xmlResponse = await response.text();
  return parseXmlRpcResponse(xmlResponse);
}

// Build XML-RPC request body
function buildXmlRpcRequest(method: string, args: unknown[]): string {
  const params = args.map((arg) => `<param>${valueToXml(arg)}</param>`).join("");
  return `<?xml version="1.0"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>${params}</params>
</methodCall>`;
}

// Convert value to XML-RPC format
function valueToXml(value: unknown): string {
  if (value === null || value === undefined) {
    return "<value><nil/></value>";
  }
  if (typeof value === "boolean") {
    return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return `<value><int>${value}</int></value>`;
    }
    return `<value><double>${value}</double></value>`;
  }
  if (typeof value === "string") {
    return `<value><string>${escapeXml(value)}</string></value>`;
  }
  if (Array.isArray(value)) {
    const items = value.map((v) => valueToXml(v)).join("");
    return `<value><array><data>${items}</data></array></value>`;
  }
  if (typeof value === "object") {
    const members = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `<member><name>${k}</name>${valueToXml(v)}</member>`)
      .join("");
    return `<value><struct>${members}</struct></value>`;
  }
  return `<value><string>${String(value)}</string></value>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Parse XML-RPC response (simplified)
function parseXmlRpcResponse(xml: string): unknown {
  // Check for fault
  if (xml.includes("<fault>")) {
    const faultMatch = xml.match(/<string>([^<]+)<\/string>/);
    throw new Error(faultMatch ? faultMatch[1] : "XML-RPC fault");
  }

  // Extract value
  const intMatch = xml.match(/<int>(\d+)<\/int>/);
  if (intMatch) return parseInt(intMatch[1], 10);

  const boolMatch = xml.match(/<boolean>([01])<\/boolean>/);
  if (boolMatch) return boolMatch[1] === "1";

  const stringMatch = xml.match(/<string>([^<]*)<\/string>/);
  if (stringMatch) return stringMatch[1];

  // For complex responses, return the raw XML for now
  return xml;
}

// Simple file uploader (placeholder - Odoo web upload)
async function fileUploader(
  url: string,
  moduleName: string,
  archiveBase64: string,
  headers: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    const blob = new Blob([Buffer.from(archiveBase64, "base64")], {
      type: "application/zip",
    });
    formData.append("module_file", blob, `${moduleName}.zip`);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      return { success: false, error: `Upload failed: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * GET /api/deploy - Test Odoo connection
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const odooUrl = url.searchParams.get("url") || process.env.NEXT_PUBLIC_ODOO_URL;
  const database = url.searchParams.get("database") || "odoo";
  const username = url.searchParams.get("username") || "admin";

  if (!odooUrl) {
    return Response.json({
      connected: false,
      error: "No Odoo URL configured",
      help: "Set NEXT_PUBLIC_ODOO_URL in .env.local or pass ?url=<odoo-url>",
    });
  }

  try {
    // Test connection by calling version endpoint
    const versionResponse = await fetch(`${odooUrl}/web/webclient/version_info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(5000),
    });

    if (!versionResponse.ok) {
      return Response.json({
        connected: false,
        url: odooUrl,
        error: `Odoo returned ${versionResponse.status}`,
      });
    }

    const versionInfo = await versionResponse.json();

    return Response.json({
      connected: true,
      url: odooUrl,
      version: versionInfo.result?.server_version || "unknown",
      database,
      username,
      message: "Odoo connection successful",
    });
  } catch (error) {
    return Response.json({
      connected: false,
      url: odooUrl,
      error: error instanceof Error ? error.message : "Connection failed",
      help: "Make sure Odoo is running and accessible",
    });
  }
}

/**
 * POST /api/deploy - Deploy theme to Odoo
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      moduleName,
      moduleArchive,
      odooUrl,
      database,
      username,
      apiKey,
      activateTheme,
    } = body as {
      moduleName: string;
      moduleArchive: string;
      odooUrl?: string;
      database?: string;
      username?: string;
      apiKey?: string;
      activateTheme?: boolean;
    };

    // Validate required fields
    if (!moduleName) {
      return Response.json({ error: "moduleName is required" }, { status: 400 });
    }
    if (!moduleArchive) {
      return Response.json({ error: "moduleArchive (base64 ZIP) is required" }, { status: 400 });
    }

    // Build connection config
    const connection: OdooConnection = {
      url: odooUrl || process.env.NEXT_PUBLIC_ODOO_URL || "http://localhost:8069",
      database: database || process.env.ODOO_DATABASE || "odoo",
      username: username || process.env.ODOO_USERNAME || "admin",
      password: apiKey || process.env.ODOO_API_KEY || "",
      timeoutMs: 30000,
    };

    if (!connection.password) {
      return Response.json(
        { error: "Odoo API key required. Set ODOO_API_KEY in .env.local or pass apiKey in request body" },
        { status: 400 }
      );
    }

    // Deploy
    const result: DeployResult = await deployToOdoo({
      connection,
      moduleName,
      moduleArchive,
      xmlrpc: xmlrpcCall,
      upload: fileUploader,
      activateTheme: activateTheme ?? true,
      onStepUpdate: (step) => {
        console.log(`[Deploy] ${step.label}: ${step.status}`);
      },
    });

    return Response.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error("Deploy error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Deployment failed",
      },
      { status: 500 }
    );
  }
}
