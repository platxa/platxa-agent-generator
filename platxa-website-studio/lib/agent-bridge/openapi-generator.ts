/**
 * OpenAPI Spec Generator
 *
 * Generates OpenAPI 3.1 specification for Platxa API endpoints.
 * Supports endpoint registration, schema definitions, and Swagger UI HTML.
 */

// =============================================================================
// Types
// =============================================================================

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export interface SchemaProperty {
  name: string;
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  required?: boolean;
  format?: string;
  items?: { type: string };
  enum?: string[];
}

export interface SchemaDefinition {
  name: string;
  description?: string;
  properties: SchemaProperty[];
}

export interface EndpointParam {
  name: string;
  in: "path" | "query" | "header";
  type: string;
  required: boolean;
  description?: string;
}

export interface EndpointResponse {
  statusCode: number;
  description: string;
  schemaRef?: string;
  isArray?: boolean;
}

export interface EndpointDef {
  path: string;
  method: HttpMethod;
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  parameters: EndpointParam[];
  requestBodyRef?: string;
  responses: EndpointResponse[];
}

export interface OpenApiInfo {
  title: string;
  version: string;
  description: string;
  contact?: { name: string; email?: string; url?: string };
  license?: { name: string; url?: string };
}

export interface OpenApiServer {
  url: string;
  description: string;
}

export interface OpenApiSpec {
  openapi: string;
  info: OpenApiInfo;
  servers: OpenApiServer[];
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
  tags: Array<{ name: string; description?: string }>;
}

export interface ApiDocState {
  info: OpenApiInfo;
  servers: OpenApiServer[];
  endpoints: EndpointDef[];
  schemas: SchemaDefinition[];
  tags: Array<{ name: string; description?: string }>;
}

// =============================================================================
// State
// =============================================================================

export function createApiDocState(info: OpenApiInfo): ApiDocState {
  return {
    info,
    servers: [],
    endpoints: [],
    schemas: [],
    tags: [],
  };
}

// =============================================================================
// Registration
// =============================================================================

export function addServer(state: ApiDocState, server: OpenApiServer): ApiDocState {
  return { ...state, servers: [...state.servers, server] };
}

export function addTag(state: ApiDocState, name: string, description?: string): ApiDocState {
  return { ...state, tags: [...state.tags, { name, description }] };
}

export function addSchema(state: ApiDocState, schema: SchemaDefinition): ApiDocState {
  return { ...state, schemas: [...state.schemas, schema] };
}

export function addEndpoint(state: ApiDocState, endpoint: EndpointDef): ApiDocState {
  return { ...state, endpoints: [...state.endpoints, endpoint] };
}

// =============================================================================
// Schema Conversion
// =============================================================================

function propertyToOpenApi(prop: SchemaProperty): Record<string, unknown> {
  const obj: Record<string, unknown> = { type: prop.type };
  if (prop.description) obj.description = prop.description;
  if (prop.format) obj.format = prop.format;
  if (prop.items) obj.items = prop.items;
  if (prop.enum) obj.enum = prop.enum;
  return obj;
}

function schemaToOpenApi(schema: SchemaDefinition): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const prop of schema.properties) {
    properties[prop.name] = propertyToOpenApi(prop);
    if (prop.required) required.push(prop.name);
  }

  const obj: Record<string, unknown> = {
    type: "object",
    properties,
  };
  if (schema.description) obj.description = schema.description;
  if (required.length > 0) obj.required = required;
  return obj;
}

// =============================================================================
// Endpoint Conversion
// =============================================================================

function paramToOpenApi(param: EndpointParam): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    name: param.name,
    in: param.in,
    required: param.required,
    schema: { type: param.type },
  };
  if (param.description) obj.description = param.description;
  return obj;
}

function responseToOpenApi(resp: EndpointResponse): Record<string, unknown> {
  const obj: Record<string, unknown> = { description: resp.description };
  if (resp.schemaRef) {
    const schemaObj = resp.isArray
      ? { type: "array", items: { $ref: `#/components/schemas/${resp.schemaRef}` } }
      : { $ref: `#/components/schemas/${resp.schemaRef}` };
    obj.content = { "application/json": { schema: schemaObj } };
  }
  return obj;
}

function endpointToOpenApi(endpoint: EndpointDef): Record<string, unknown> {
  const op: Record<string, unknown> = {
    operationId: endpoint.operationId,
    summary: endpoint.summary,
    tags: endpoint.tags,
    responses: {},
  };
  if (endpoint.description) op.description = endpoint.description;
  if (endpoint.parameters.length > 0) {
    op.parameters = endpoint.parameters.map(paramToOpenApi);
  }
  if (endpoint.requestBodyRef) {
    op.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: `#/components/schemas/${endpoint.requestBodyRef}` },
        },
      },
    };
  }

  const responses: Record<string, unknown> = {};
  for (const resp of endpoint.responses) {
    responses[String(resp.statusCode)] = responseToOpenApi(resp);
  }
  op.responses = responses;

  return op;
}

// =============================================================================
// Spec Generation
// =============================================================================

export function generateOpenApiSpec(state: ApiDocState): OpenApiSpec {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const ep of state.endpoints) {
    if (!paths[ep.path]) paths[ep.path] = {};
    paths[ep.path][ep.method] = endpointToOpenApi(ep);
  }

  const schemas: Record<string, unknown> = {};
  for (const s of state.schemas) {
    schemas[s.name] = schemaToOpenApi(s);
  }

  return {
    openapi: "3.1.0",
    info: state.info,
    servers: state.servers,
    paths,
    components: { schemas },
    tags: state.tags,
  };
}

export function generateOpenApiJson(state: ApiDocState): string {
  return JSON.stringify(generateOpenApiSpec(state), null, 2);
}

// =============================================================================
// Swagger UI HTML
// =============================================================================

export function generateSwaggerHtml(specUrl: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - API Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "${specUrl}",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis],
      layout: "BaseLayout",
    });
  </script>
</body>
</html>`;
}

// =============================================================================
// Queries
// =============================================================================

export function getEndpointsByTag(state: ApiDocState, tag: string): EndpointDef[] {
  return state.endpoints.filter((e) => e.tags.includes(tag));
}

export function getEndpointCount(state: ApiDocState): number {
  return state.endpoints.length;
}

export function getSchemaCount(state: ApiDocState): number {
  return state.schemas.length;
}

export function getAllTags(state: ApiDocState): string[] {
  return state.tags.map((t) => t.name);
}
