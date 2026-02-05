/**
 * OdooControllerGenerator
 *
 * Generates Odoo HTTP controllers for website routes.
 * Creates valid Python code for handling web requests.
 *
 * Features:
 * - Route definition generation
 * - HTTP method handling (GET, POST, PUT, DELETE)
 * - Authentication modes (public, user, none)
 * - JSON and HTTP response types
 * - Form handling
 * - File upload support
 * - CSRF protection
 * - Error handling
 * - Template rendering
 * - API endpoint generation
 *
 * Feature #101: Odoo Deep Integration - OdooControllerGenerator
 */

// =============================================================================
// Types
// =============================================================================

/** HTTP methods */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/** Authentication modes */
export type AuthMode = "public" | "user" | "none";

/** Response type */
export type ResponseType = "http" | "json";

/** Route parameter */
export interface RouteParameter {
  name: string;
  type: "int" | "string" | "float" | "path" | "model";
  required?: boolean;
  default?: string | number;
  description?: string;
  modelName?: string; // For model type
}

/** Query parameter */
export interface QueryParameter {
  name: string;
  type: "string" | "int" | "float" | "bool" | "list";
  required?: boolean;
  default?: string | number | boolean;
  description?: string;
}

/** Form field */
export interface FormField {
  name: string;
  type: "text" | "email" | "password" | "number" | "file" | "select" | "checkbox" | "textarea" | "hidden";
  required?: boolean;
  validation?: string;
  options?: Array<{ value: string; label: string }>; // For select
}

/** Route definition */
export interface RouteDefinition {
  path: string;
  methods: HttpMethod[];
  auth: AuthMode;
  type: ResponseType;
  csrf?: boolean;
  website?: boolean;
  sitemap?: boolean;
  multilang?: boolean;
}

/** Controller method */
export interface ControllerMethod {
  name: string;
  route: RouteDefinition;
  parameters?: RouteParameter[];
  queryParams?: QueryParameter[];
  formFields?: FormField[];
  description?: string;
  templateName?: string;
  responseModel?: string;
  errorHandling?: boolean;
  implementation?: string;
}

/** Controller definition */
export interface ControllerDefinition {
  name: string;
  inherit?: string;
  description?: string;
  methods: ControllerMethod[];
}

/** Generated output */
export interface GeneratedController {
  pythonCode: string;
  templateXml?: string;
  manifestUpdate?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function toPascalCase(str: string): string {
  return str
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function indent(code: string, spaces: number = 4): string {
  const prefix = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.trim() ? prefix + line : line))
    .join("\n");
}

function generateRouteDecorator(route: RouteDefinition): string {
  const parts: string[] = [];

  // Route path
  parts.push(`"${route.path}"`);

  // Type
  parts.push(`type="${route.type}"`);

  // Auth
  parts.push(`auth="${route.auth}"`);

  // Methods
  if (route.methods.length > 0) {
    const methods = route.methods.map((m) => `"${m}"`).join(", ");
    parts.push(`methods=[${methods}]`);
  }

  // Website
  if (route.website) {
    parts.push("website=True");
  }

  // CSRF
  if (route.csrf === false) {
    parts.push("csrf=False");
  }

  // Sitemap
  if (route.sitemap === false) {
    parts.push("sitemap=False");
  }

  // Multilang
  if (route.multilang === false) {
    parts.push("multilang=False");
  }

  return `@http.route(${parts.join(", ")})`;
}

function generateParameterType(param: RouteParameter): string {
  switch (param.type) {
    case "int":
      return "int";
    case "float":
      return "float";
    case "model":
      return param.modelName || "object";
    default:
      return "str";
  }
}

function generateMethodSignature(method: ControllerMethod): string {
  const params: string[] = ["self"];

  // Route parameters
  if (method.parameters) {
    for (const param of method.parameters) {
      let paramStr = param.name;
      if (param.default !== undefined) {
        paramStr += `=${JSON.stringify(param.default)}`;
      } else if (!param.required) {
        paramStr += "=None";
      }
      params.push(paramStr);
    }
  }

  // Query parameters (as **kw or explicit)
  if (method.queryParams && method.queryParams.length > 0) {
    params.push("**kw");
  } else if (method.formFields && method.formFields.length > 0) {
    params.push("**post");
  }

  return params.join(", ");
}

function generateMethodDocstring(method: ControllerMethod): string {
  const lines: string[] = [];

  if (method.description) {
    lines.push(method.description);
  }

  // Document parameters
  if (method.parameters && method.parameters.length > 0) {
    lines.push("");
    lines.push("Args:");
    for (const param of method.parameters) {
      const typeStr = generateParameterType(param);
      const desc = param.description || `The ${param.name}`;
      lines.push(`    ${param.name} (${typeStr}): ${desc}`);
    }
  }

  // Document query params
  if (method.queryParams && method.queryParams.length > 0) {
    if (lines.length > 0 && !lines[lines.length - 1].startsWith("Args:")) {
      lines.push("");
      lines.push("Query Parameters:");
    }
    for (const param of method.queryParams) {
      const desc = param.description || `The ${param.name}`;
      lines.push(`    ${param.name} (${param.type}): ${desc}`);
    }
  }

  // Document return
  lines.push("");
  if (method.route.type === "json") {
    lines.push("Returns:");
    lines.push("    dict: JSON response");
  } else {
    lines.push("Returns:");
    lines.push("    Response: HTTP response or rendered template");
  }

  return `"""${lines.join("\n        ")}"""`;
}

function generateFormValidation(fields: FormField[]): string {
  const lines: string[] = [];

  lines.push("# Validate form data");
  lines.push("errors = {}");

  for (const field of fields) {
    if (field.required) {
      lines.push(`if not post.get("${field.name}"):`);
      lines.push(`    errors["${field.name}"] = "${field.name.replace(/_/g, " ")} is required"`);
    }

    if (field.type === "email") {
      lines.push(`if post.get("${field.name}") and "@" not in post.get("${field.name}", ""):`);
      lines.push(`    errors["${field.name}"] = "Invalid email address"`);
    }

    if (field.validation) {
      lines.push(`# Custom validation for ${field.name}`);
      lines.push(field.validation);
    }
  }

  lines.push("");
  lines.push("if errors:");
  lines.push('    return {"success": False, "errors": errors}');

  return lines.join("\n        ");
}

function generateHttpMethodBody(method: ControllerMethod): string {
  const lines: string[] = [];

  // Error handling wrapper
  if (method.errorHandling) {
    lines.push("try:");
  }

  const bodyIndent = method.errorHandling ? "    " : "";

  // Form validation
  if (method.formFields && method.formFields.length > 0) {
    const validation = generateFormValidation(method.formFields);
    lines.push(indent(validation, method.errorHandling ? 4 : 0));
    lines.push("");
  }

  // Custom implementation
  if (method.implementation) {
    lines.push(bodyIndent + method.implementation);
  } else if (method.route.type === "json") {
    // Default JSON response
    lines.push(bodyIndent + "# TODO: Implement business logic");
    lines.push(bodyIndent + 'return {"success": True, "data": {}}');
  } else if (method.templateName) {
    // Template rendering
    lines.push(bodyIndent + "values = {");
    lines.push(bodyIndent + '    "page_name": "' + method.name + '",');
    lines.push(bodyIndent + "}");
    lines.push(bodyIndent + `return request.render("${method.templateName}", values)`);
  } else {
    // Default HTTP response
    lines.push(bodyIndent + "# TODO: Implement handler");
    lines.push(bodyIndent + 'return request.make_response("OK")');
  }

  // Error handling
  if (method.errorHandling) {
    lines.push("except Exception as e:");
    lines.push('    _logger.exception("Error in %s: %s", self.__class__.__name__, str(e))');
    if (method.route.type === "json") {
      lines.push('    return {"success": False, "error": str(e)}');
    } else {
      lines.push('    return request.make_response("Internal Server Error", status=500)');
    }
  }

  return lines.join("\n        ");
}

// =============================================================================
// Code Generation
// =============================================================================

function generateControllerCode(controller: ControllerDefinition): string {
  const lines: string[] = [];

  // File header
  lines.push("# -*- coding: utf-8 -*-");
  lines.push("import logging");
  lines.push("from odoo import http");
  lines.push("from odoo.http import request");
  lines.push("");
  lines.push("_logger = logging.getLogger(__name__)");
  lines.push("");
  lines.push("");

  // Class definition
  const className = toPascalCase(controller.name);
  const baseClass = controller.inherit || "http.Controller";

  lines.push(`class ${className}(${baseClass}):`);

  // Class docstring
  if (controller.description) {
    lines.push(`    """${controller.description}"""`);
    lines.push("");
  }

  // Methods
  for (const method of controller.methods) {
    // Route decorator
    lines.push("    " + generateRouteDecorator(method.route));

    // Method definition
    const signature = generateMethodSignature(method);
    lines.push(`    def ${method.name}(${signature}):`);

    // Docstring
    const docstring = generateMethodDocstring(method);
    lines.push("        " + docstring);

    // Method body
    const body = generateHttpMethodBody(method);
    lines.push("        " + body);

    lines.push("");
  }

  return lines.join("\n");
}

function generateTemplateXml(
  moduleName: string,
  controller: ControllerDefinition
): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push("<odoo>");

  for (const method of controller.methods) {
    if (method.templateName && method.route.type === "http") {
      const templateId = method.templateName.replace(/\./g, "_");

      lines.push("");
      lines.push(`    <!-- Template for ${method.name} -->`);
      lines.push(`    <template id="${templateId}" name="${method.description || method.name}">`);
      lines.push('        <t t-call="website.layout">');
      lines.push('            <div id="wrap" class="oe_structure">');
      lines.push('                <div class="container py-5">');
      lines.push(`                    <h1>${method.description || method.name}</h1>`);
      lines.push('                    <div class="row">');
      lines.push('                        <div class="col-12">');
      lines.push("                            <!-- Content goes here -->");

      // Generate form if method has form fields
      if (method.formFields && method.formFields.length > 0) {
        lines.push(`                            <form action="${method.route.path}" method="POST" class="mt-4">`);
        lines.push('                                <input type="hidden" name="csrf_token" t-att-value="request.csrf_token()"/>');

        for (const field of method.formFields) {
          lines.push('                                <div class="mb-3">');
          lines.push(`                                    <label class="form-label" for="${field.name}">${field.name.replace(/_/g, " ")}</label>`);

          if (field.type === "textarea") {
            lines.push(`                                    <textarea class="form-control" id="${field.name}" name="${field.name}"${field.required ? " required" : ""}></textarea>`);
          } else if (field.type === "select" && field.options) {
            lines.push(`                                    <select class="form-control" id="${field.name}" name="${field.name}"${field.required ? " required" : ""}>`);
            for (const opt of field.options) {
              lines.push(`                                        <option value="${opt.value}">${opt.label}</option>`);
            }
            lines.push("                                    </select>");
          } else if (field.type === "checkbox") {
            lines.push(`                                    <input type="checkbox" class="form-check-input" id="${field.name}" name="${field.name}"/>`);
          } else {
            lines.push(`                                    <input type="${field.type}" class="form-control" id="${field.name}" name="${field.name}"${field.required ? " required" : ""}/>`);
          }

          lines.push("                                </div>");
        }

        lines.push('                                <button type="submit" class="btn btn-primary">Submit</button>');
        lines.push("                            </form>");
      }

      lines.push("                        </div>");
      lines.push("                    </div>");
      lines.push("                </div>");
      lines.push("            </div>");
      lines.push("        </t>");
      lines.push("    </template>");
    }
  }

  lines.push("");
  lines.push("</odoo>");

  return lines.join("\n");
}

// =============================================================================
// Main Generator Class
// =============================================================================

export class OdooControllerGenerator {
  /**
   * Generate controller from definition
   */
  generate(controller: ControllerDefinition, moduleName: string): GeneratedController {
    const pythonCode = generateControllerCode(controller);

    // Generate template if any HTTP routes with templates
    const hasTemplates = controller.methods.some(
      (m) => m.templateName && m.route.type === "http"
    );

    const templateXml = hasTemplates
      ? generateTemplateXml(moduleName, controller)
      : undefined;

    // Generate manifest update hint
    const manifestUpdate = this.generateManifestUpdate(controller, moduleName);

    return {
      pythonCode,
      templateXml,
      manifestUpdate,
    };
  }

  /**
   * Generate a REST API controller
   */
  generateRestApi(
    resourceName: string,
    modelName: string,
    options: {
      auth?: AuthMode;
      basePath?: string;
      operations?: Array<"list" | "get" | "create" | "update" | "delete">;
    } = {}
  ): GeneratedController {
    const auth = options.auth || "user";
    const basePath = options.basePath || `/api/${toSnakeCase(resourceName)}`;
    const operations = options.operations || ["list", "get", "create", "update", "delete"];

    const methods: ControllerMethod[] = [];

    // List (GET /resource)
    if (operations.includes("list")) {
      methods.push({
        name: `${toSnakeCase(resourceName)}_list`,
        route: {
          path: basePath,
          methods: ["GET"],
          auth,
          type: "json",
          csrf: false,
        },
        queryParams: [
          { name: "limit", type: "int", default: 80, description: "Maximum records to return" },
          { name: "offset", type: "int", default: 0, description: "Number of records to skip" },
          { name: "order", type: "string", default: "id desc", description: "Sort order" },
        ],
        description: `List all ${resourceName} records`,
        errorHandling: true,
        implementation: `
            limit = int(kw.get("limit", 80))
            offset = int(kw.get("offset", 0))
            order = kw.get("order", "id desc")

            records = request.env["${modelName}"].search([], limit=limit, offset=offset, order=order)
            total = request.env["${modelName}"].search_count([])

            return {
                "success": True,
                "data": records.read(),
                "total": total,
                "limit": limit,
                "offset": offset
            }`.trim(),
      });
    }

    // Get (GET /resource/<id>)
    if (operations.includes("get")) {
      methods.push({
        name: `${toSnakeCase(resourceName)}_get`,
        route: {
          path: `${basePath}/<int:record_id>`,
          methods: ["GET"],
          auth,
          type: "json",
          csrf: false,
        },
        parameters: [
          { name: "record_id", type: "int", required: true, description: "Record ID" },
        ],
        description: `Get a single ${resourceName} record`,
        errorHandling: true,
        implementation: `
            record = request.env["${modelName}"].browse(record_id)
            if not record.exists():
                return {"success": False, "error": "Record not found"}

            return {"success": True, "data": record.read()[0]}`.trim(),
      });
    }

    // Create (POST /resource)
    if (operations.includes("create")) {
      methods.push({
        name: `${toSnakeCase(resourceName)}_create`,
        route: {
          path: basePath,
          methods: ["POST"],
          auth,
          type: "json",
          csrf: false,
        },
        description: `Create a new ${resourceName} record`,
        errorHandling: true,
        implementation: `
            data = request.jsonrequest
            record = request.env["${modelName}"].create(data)

            return {"success": True, "data": record.read()[0], "id": record.id}`.trim(),
      });
    }

    // Update (PUT /resource/<id>)
    if (operations.includes("update")) {
      methods.push({
        name: `${toSnakeCase(resourceName)}_update`,
        route: {
          path: `${basePath}/<int:record_id>`,
          methods: ["PUT"],
          auth,
          type: "json",
          csrf: false,
        },
        parameters: [
          { name: "record_id", type: "int", required: true, description: "Record ID" },
        ],
        description: `Update a ${resourceName} record`,
        errorHandling: true,
        implementation: `
            record = request.env["${modelName}"].browse(record_id)
            if not record.exists():
                return {"success": False, "error": "Record not found"}

            data = request.jsonrequest
            record.write(data)

            return {"success": True, "data": record.read()[0]}`.trim(),
      });
    }

    // Delete (DELETE /resource/<id>)
    if (operations.includes("delete")) {
      methods.push({
        name: `${toSnakeCase(resourceName)}_delete`,
        route: {
          path: `${basePath}/<int:record_id>`,
          methods: ["DELETE"],
          auth,
          type: "json",
          csrf: false,
        },
        parameters: [
          { name: "record_id", type: "int", required: true, description: "Record ID" },
        ],
        description: `Delete a ${resourceName} record`,
        errorHandling: true,
        implementation: `
            record = request.env["${modelName}"].browse(record_id)
            if not record.exists():
                return {"success": False, "error": "Record not found"}

            record.unlink()

            return {"success": True, "message": "Record deleted"}`.trim(),
      });
    }

    const controller: ControllerDefinition = {
      name: `${resourceName}_api`,
      description: `REST API controller for ${resourceName}`,
      methods,
    };

    return this.generate(controller, toSnakeCase(resourceName));
  }

  /**
   * Generate a website page controller
   */
  generateWebsitePage(
    pageName: string,
    options: {
      path?: string;
      templateName?: string;
      auth?: AuthMode;
      hasForm?: boolean;
      formFields?: FormField[];
    } = {}
  ): GeneratedController {
    const path = options.path || `/${toSnakeCase(pageName)}`;
    const templateName = options.templateName || `website.${toSnakeCase(pageName)}`;
    const auth = options.auth || "public";

    const methods: ControllerMethod[] = [];

    // GET - Display page
    methods.push({
      name: toSnakeCase(pageName),
      route: {
        path,
        methods: ["GET"],
        auth,
        type: "http",
        website: true,
      },
      description: `Display ${pageName} page`,
      templateName,
      implementation: `
        values = {
            "page_name": "${pageName}",
        }
        return request.render("${templateName}", values)`.trim(),
    });

    // POST - Handle form submission
    if (options.hasForm || (options.formFields && options.formFields.length > 0)) {
      methods.push({
        name: `${toSnakeCase(pageName)}_submit`,
        route: {
          path,
          methods: ["POST"],
          auth,
          type: "http",
          website: true,
        },
        formFields: options.formFields || [
          { name: "name", type: "text", required: true },
          { name: "email", type: "email", required: true },
          { name: "message", type: "textarea", required: true },
        ],
        description: `Handle ${pageName} form submission`,
        templateName,
        errorHandling: true,
        implementation: `
        # Process form data
        values = {
            "page_name": "${pageName}",
            "success": True,
            "message": "Form submitted successfully",
        }
        return request.render("${templateName}", values)`.trim(),
      });
    }

    const controller: ControllerDefinition = {
      name: `${pageName}_controller`,
      description: `Website controller for ${pageName}`,
      methods,
    };

    return this.generate(controller, toSnakeCase(pageName));
  }

  /**
   * Generate manifest update hint
   */
  private generateManifestUpdate(
    controller: ControllerDefinition,
    moduleName: string
  ): string {
    const controllerFile = `controllers/${toSnakeCase(controller.name)}.py`;
    const hasTemplates = controller.methods.some(
      (m) => m.templateName && m.route.type === "http"
    );

    const lines: string[] = [];
    lines.push("# Add to __manifest__.py:");
    lines.push(`# In 'data' list, add: 'views/${toSnakeCase(controller.name)}_templates.xml'`);
    lines.push("");
    lines.push("# Add to controllers/__init__.py:");
    lines.push(`# from . import ${toSnakeCase(controller.name)}`);

    if (hasTemplates) {
      lines.push("");
      lines.push("# Ensure 'website' is in depends list");
    }

    return lines.join("\n");
  }

  /**
   * Validate controller definition
   */
  validate(controller: ControllerDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!controller.name) {
      errors.push("Controller name is required");
    }

    if (!controller.methods || controller.methods.length === 0) {
      errors.push("Controller must have at least one method");
    }

    for (const method of controller.methods) {
      if (!method.name) {
        errors.push("Method name is required");
      }

      if (!method.route.path) {
        errors.push(`Method ${method.name}: Route path is required`);
      }

      if (!method.route.path.startsWith("/")) {
        errors.push(`Method ${method.name}: Route path must start with /`);
      }

      if (method.route.methods.length === 0) {
        errors.push(`Method ${method.name}: At least one HTTP method is required`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const odooControllerGenerator = new OdooControllerGenerator();

export default OdooControllerGenerator;
