import { describe, it, expect } from "vitest";
import {
  createApiDocState,
  addServer,
  addTag,
  addSchema,
  addEndpoint,
  generateOpenApiSpec,
  generateOpenApiJson,
  generateSwaggerHtml,
  getEndpointsByTag,
  getEndpointCount,
  getSchemaCount,
  getAllTags,
} from "@/lib/agent-bridge/openapi-generator";
import type { EndpointDef, SchemaDefinition, ApiDocState } from "@/lib/agent-bridge/openapi-generator";

const INFO = {
  title: "Platxa API",
  version: "1.0.0",
  description: "AI Website Generator API",
};

function makeState(): ApiDocState {
  let state = createApiDocState(INFO);
  state = addServer(state, { url: "https://api.platxa.com", description: "Production" });
  state = addTag(state, "generation", "Website generation endpoints");
  state = addSchema(state, {
    name: "GenerateRequest",
    description: "Request to generate a page",
    properties: [
      { name: "prompt", type: "string", required: true, description: "User prompt" },
      { name: "templateId", type: "string", required: true },
      { name: "quality", type: "integer", format: "int32" },
    ],
  });
  state = addSchema(state, {
    name: "GenerateResponse",
    properties: [
      { name: "id", type: "string", required: true },
      { name: "html", type: "string", required: true },
      { name: "score", type: "number" },
    ],
  });
  state = addEndpoint(state, {
    path: "/api/generate",
    method: "post",
    operationId: "generatePage",
    summary: "Generate a website page",
    tags: ["generation"],
    parameters: [],
    requestBodyRef: "GenerateRequest",
    responses: [
      { statusCode: 200, description: "Generated page", schemaRef: "GenerateResponse" },
      { statusCode: 400, description: "Invalid request" },
    ],
  });
  state = addEndpoint(state, {
    path: "/api/templates",
    method: "get",
    operationId: "listTemplates",
    summary: "List available templates",
    tags: ["templates"],
    parameters: [
      { name: "category", in: "query", type: "string", required: false, description: "Filter by category" },
    ],
    responses: [
      { statusCode: 200, description: "Template list", schemaRef: "GenerateResponse", isArray: true },
    ],
  });
  return state;
}

describe("OpenAPI Generator", () => {
  describe("createApiDocState", () => {
    it("creates state with info", () => {
      const state = createApiDocState(INFO);
      expect(state.info.title).toBe("Platxa API");
      expect(state.endpoints).toHaveLength(0);
    });
  });

  describe("addServer", () => {
    it("adds a server", () => {
      let state = createApiDocState(INFO);
      state = addServer(state, { url: "http://localhost:3000", description: "Dev" });
      expect(state.servers).toHaveLength(1);
    });

    it("does not mutate input", () => {
      const original = createApiDocState(INFO);
      addServer(original, { url: "http://localhost", description: "Dev" });
      expect(original.servers).toHaveLength(0);
    });
  });

  describe("addTag", () => {
    it("adds a tag", () => {
      let state = createApiDocState(INFO);
      state = addTag(state, "gen", "Generation");
      expect(state.tags).toHaveLength(1);
      expect(state.tags[0].name).toBe("gen");
    });
  });

  describe("addSchema", () => {
    it("adds a schema", () => {
      let state = createApiDocState(INFO);
      state = addSchema(state, { name: "Foo", properties: [] });
      expect(getSchemaCount(state)).toBe(1);
    });
  });

  describe("addEndpoint", () => {
    it("adds an endpoint", () => {
      const state = makeState();
      expect(getEndpointCount(state)).toBe(2);
    });
  });

  describe("generateOpenApiSpec", () => {
    it("sets openapi version to 3.1.0", () => {
      const spec = generateOpenApiSpec(makeState());
      expect(spec.openapi).toBe("3.1.0");
    });

    it("includes info", () => {
      const spec = generateOpenApiSpec(makeState());
      expect(spec.info.title).toBe("Platxa API");
      expect(spec.info.version).toBe("1.0.0");
    });

    it("includes servers", () => {
      const spec = generateOpenApiSpec(makeState());
      expect(spec.servers).toHaveLength(1);
      expect(spec.servers[0].url).toBe("https://api.platxa.com");
    });

    it("includes paths", () => {
      const spec = generateOpenApiSpec(makeState());
      expect(spec.paths["/api/generate"]).toBeDefined();
      expect(spec.paths["/api/generate"]["post"]).toBeDefined();
      expect(spec.paths["/api/templates"]).toBeDefined();
    });

    it("includes operationId and summary", () => {
      const spec = generateOpenApiSpec(makeState());
      const post = spec.paths["/api/generate"]["post"] as Record<string, unknown>;
      expect(post.operationId).toBe("generatePage");
      expect(post.summary).toBe("Generate a website page");
    });

    it("includes request body ref", () => {
      const spec = generateOpenApiSpec(makeState());
      const post = spec.paths["/api/generate"]["post"] as Record<string, unknown>;
      const body = post.requestBody as Record<string, unknown>;
      expect(body.required).toBe(true);
      const content = body.content as Record<string, unknown>;
      const json = content["application/json"] as Record<string, unknown>;
      const schema = json.schema as Record<string, string>;
      expect(schema.$ref).toContain("GenerateRequest");
    });

    it("includes responses", () => {
      const spec = generateOpenApiSpec(makeState());
      const post = spec.paths["/api/generate"]["post"] as Record<string, unknown>;
      const responses = post.responses as Record<string, Record<string, unknown>>;
      expect(responses["200"].description).toBe("Generated page");
      expect(responses["400"].description).toBe("Invalid request");
    });

    it("includes array responses", () => {
      const spec = generateOpenApiSpec(makeState());
      const get = spec.paths["/api/templates"]["get"] as Record<string, unknown>;
      const responses = get.responses as Record<string, Record<string, unknown>>;
      const content = responses["200"].content as Record<string, unknown>;
      const json = content["application/json"] as Record<string, unknown>;
      const schema = json.schema as Record<string, unknown>;
      expect(schema.type).toBe("array");
    });

    it("includes query parameters", () => {
      const spec = generateOpenApiSpec(makeState());
      const get = spec.paths["/api/templates"]["get"] as Record<string, unknown>;
      const params = get.parameters as Array<Record<string, unknown>>;
      expect(params).toHaveLength(1);
      expect(params[0].name).toBe("category");
      expect(params[0].in).toBe("query");
    });

    it("includes component schemas with required fields", () => {
      const spec = generateOpenApiSpec(makeState());
      const req = spec.components.schemas["GenerateRequest"] as Record<string, unknown>;
      expect(req.type).toBe("object");
      const required = req.required as string[];
      expect(required).toContain("prompt");
      expect(required).toContain("templateId");
    });

    it("includes schema property format", () => {
      const spec = generateOpenApiSpec(makeState());
      const req = spec.components.schemas["GenerateRequest"] as Record<string, unknown>;
      const props = req.properties as Record<string, Record<string, unknown>>;
      expect(props.quality.format).toBe("int32");
    });

    it("includes tags", () => {
      const spec = generateOpenApiSpec(makeState());
      expect(spec.tags).toHaveLength(1);
      expect(spec.tags[0].name).toBe("generation");
    });
  });

  describe("generateOpenApiJson", () => {
    it("returns valid JSON string", () => {
      const json = generateOpenApiJson(makeState());
      const parsed = JSON.parse(json);
      expect(parsed.openapi).toBe("3.1.0");
    });
  });

  describe("generateSwaggerHtml", () => {
    it("includes swagger-ui div", () => {
      const html = generateSwaggerHtml("/api/openapi.json", "Platxa");
      expect(html).toContain('id="swagger-ui"');
    });

    it("includes spec URL", () => {
      const html = generateSwaggerHtml("/api/openapi.json", "Platxa");
      expect(html).toContain("/api/openapi.json");
    });

    it("includes title", () => {
      const html = generateSwaggerHtml("/api/openapi.json", "Platxa");
      expect(html).toContain("Platxa - API Docs");
    });

    it("includes swagger-ui CSS and JS", () => {
      const html = generateSwaggerHtml("/api/openapi.json", "Platxa");
      expect(html).toContain("swagger-ui.css");
      expect(html).toContain("swagger-ui-bundle.js");
    });
  });

  describe("queries", () => {
    it("getEndpointsByTag filters", () => {
      const state = makeState();
      expect(getEndpointsByTag(state, "generation")).toHaveLength(1);
      expect(getEndpointsByTag(state, "templates")).toHaveLength(1);
      expect(getEndpointsByTag(state, "unknown")).toHaveLength(0);
    });

    it("getAllTags returns tag names", () => {
      expect(getAllTags(makeState())).toEqual(["generation"]);
    });

    it("getEndpointCount returns count", () => {
      expect(getEndpointCount(makeState())).toBe(2);
    });

    it("getSchemaCount returns count", () => {
      expect(getSchemaCount(makeState())).toBe(2);
    });
  });
});
