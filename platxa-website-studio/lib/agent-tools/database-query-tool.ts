/**
 * DatabaseQueryTool
 *
 * Agent tool for querying and understanding Odoo data structures.
 * Enables exploration of models, fields, and sample data.
 *
 * Features:
 * - List and search Odoo models
 * - Get model field definitions
 * - Query sample data from models
 * - Explore relationships between models
 * - Execute safe read-only queries
 * - Field type introspection
 * - Access control awareness
 * - Query result formatting
 *
 * Feature #55: Agent Tool Expansion - DatabaseQueryTool
 */

// =============================================================================
// Types
// =============================================================================

/** Odoo field types */
export type OdooFieldType =
  | "char"
  | "text"
  | "html"
  | "integer"
  | "float"
  | "monetary"
  | "boolean"
  | "date"
  | "datetime"
  | "binary"
  | "selection"
  | "many2one"
  | "one2many"
  | "many2many"
  | "reference";

/** Field definition */
export interface OdooFieldDefinition {
  name: string;
  type: OdooFieldType;
  string: string; // Human-readable label
  help?: string;
  required: boolean;
  readonly: boolean;
  store: boolean;
  index: boolean;
  compute?: string; // Compute method name
  related?: string; // Related field path
  depends?: string[]; // Dependencies for compute
  selection?: Array<[string, string]>; // For selection fields
  relation?: string; // Related model for relational fields
  relationField?: string; // Inverse field name
  domain?: string; // Domain filter
  context?: Record<string, unknown>;
  default?: unknown;
  groups?: string[]; // Access groups
  deprecated?: boolean;
}

/** Model definition */
export interface OdooModelDefinition {
  name: string; // Technical name (e.g., "res.partner")
  description: string; // Human-readable name
  module: string; // Defining module
  isTransient: boolean;
  isAbstract: boolean;
  inherit?: string[]; // Inherited models
  inherits?: Record<string, string>; // Delegation inheritance
  fields: Record<string, OdooFieldDefinition>;
  sqlConstraints?: Array<{ name: string; definition: string; message: string }>;
  recordRules?: Array<{ name: string; domain: string; groups: string[] }>;
}

/** Query filter/domain */
export type OdooDomain = Array<string | [string, string, unknown]>;

/** Query options */
export interface QueryOptions {
  domain?: OdooDomain;
  fields?: string[];
  limit?: number;
  offset?: number;
  order?: string;
  context?: Record<string, unknown>;
}

/** Query result */
export interface QueryResult<T = Record<string, unknown>> {
  success: boolean;
  model: string;
  count: number;
  records: T[];
  error?: string;
  executionTimeMs?: number;
}

/** Model search result */
export interface ModelSearchResult {
  name: string;
  description: string;
  module: string;
  fieldCount: number;
  isTransient: boolean;
}

/** Relationship info */
export interface RelationshipInfo {
  field: string;
  type: "many2one" | "one2many" | "many2many";
  relatedModel: string;
  inverseField?: string;
  throughModel?: string; // For many2many
}

/** Tool configuration */
export interface DatabaseQueryToolConfig {
  /** Odoo server URL */
  serverUrl: string;
  /** Database name */
  database: string;
  /** User ID */
  uid?: number;
  /** API endpoint for JSON-RPC */
  apiEndpoint?: string;
  /** Maximum records per query */
  maxRecords?: number;
  /** Allowed models (whitelist) */
  allowedModels?: string[];
  /** Blocked models (blacklist) */
  blockedModels?: string[];
  /** Read-only mode (default: true) */
  readOnly?: boolean;
  /** Session ID or token for auth */
  sessionId?: string;
}

// =============================================================================
// Mock Data (for development/testing)
// =============================================================================

const MOCK_MODELS: Record<string, OdooModelDefinition> = {
  "res.partner": {
    name: "res.partner",
    description: "Contact",
    module: "base",
    isTransient: false,
    isAbstract: false,
    fields: {
      id: { name: "id", type: "integer", string: "ID", required: true, readonly: true, store: true, index: true },
      name: { name: "name", type: "char", string: "Name", required: true, readonly: false, store: true, index: true },
      email: { name: "email", type: "char", string: "Email", required: false, readonly: false, store: true, index: true },
      phone: { name: "phone", type: "char", string: "Phone", required: false, readonly: false, store: true, index: false },
      is_company: { name: "is_company", type: "boolean", string: "Is a Company", required: false, readonly: false, store: true, index: true },
      company_type: {
        name: "company_type",
        type: "selection",
        string: "Company Type",
        required: false,
        readonly: false,
        store: false,
        index: false,
        selection: [["person", "Individual"], ["company", "Company"]]
      },
      parent_id: { name: "parent_id", type: "many2one", string: "Related Company", required: false, readonly: false, store: true, index: true, relation: "res.partner" },
      child_ids: { name: "child_ids", type: "one2many", string: "Contacts", required: false, readonly: false, store: false, index: false, relation: "res.partner", relationField: "parent_id" },
      country_id: { name: "country_id", type: "many2one", string: "Country", required: false, readonly: false, store: true, index: true, relation: "res.country" },
      user_ids: { name: "user_ids", type: "one2many", string: "Users", required: false, readonly: false, store: false, index: false, relation: "res.users", relationField: "partner_id" },
      create_date: { name: "create_date", type: "datetime", string: "Created on", required: false, readonly: true, store: true, index: true },
      write_date: { name: "write_date", type: "datetime", string: "Last Modified on", required: false, readonly: true, store: true, index: false },
    },
  },
  "res.users": {
    name: "res.users",
    description: "Users",
    module: "base",
    isTransient: false,
    isAbstract: false,
    inherit: ["res.partner"],
    fields: {
      id: { name: "id", type: "integer", string: "ID", required: true, readonly: true, store: true, index: true },
      login: { name: "login", type: "char", string: "Login", required: true, readonly: false, store: true, index: true },
      partner_id: { name: "partner_id", type: "many2one", string: "Related Partner", required: true, readonly: false, store: true, index: true, relation: "res.partner" },
      groups_id: { name: "groups_id", type: "many2many", string: "Groups", required: false, readonly: false, store: true, index: false, relation: "res.groups" },
      company_id: { name: "company_id", type: "many2one", string: "Company", required: true, readonly: false, store: true, index: true, relation: "res.company" },
      active: { name: "active", type: "boolean", string: "Active", required: false, readonly: false, store: true, index: true },
    },
  },
  "sale.order": {
    name: "sale.order",
    description: "Sales Order",
    module: "sale",
    isTransient: false,
    isAbstract: false,
    fields: {
      id: { name: "id", type: "integer", string: "ID", required: true, readonly: true, store: true, index: true },
      name: { name: "name", type: "char", string: "Order Reference", required: true, readonly: true, store: true, index: true },
      partner_id: { name: "partner_id", type: "many2one", string: "Customer", required: true, readonly: false, store: true, index: true, relation: "res.partner" },
      order_line: { name: "order_line", type: "one2many", string: "Order Lines", required: false, readonly: false, store: false, index: false, relation: "sale.order.line", relationField: "order_id" },
      state: {
        name: "state",
        type: "selection",
        string: "Status",
        required: true,
        readonly: true,
        store: true,
        index: true,
        selection: [["draft", "Quotation"], ["sent", "Quotation Sent"], ["sale", "Sales Order"], ["done", "Locked"], ["cancel", "Cancelled"]]
      },
      amount_total: { name: "amount_total", type: "monetary", string: "Total", required: false, readonly: true, store: true, index: false, compute: "_compute_amounts" },
      date_order: { name: "date_order", type: "datetime", string: "Order Date", required: true, readonly: false, store: true, index: true },
      company_id: { name: "company_id", type: "many2one", string: "Company", required: true, readonly: false, store: true, index: true, relation: "res.company" },
    },
  },
  "product.product": {
    name: "product.product",
    description: "Product",
    module: "product",
    isTransient: false,
    isAbstract: false,
    inherit: ["product.template"],
    fields: {
      id: { name: "id", type: "integer", string: "ID", required: true, readonly: true, store: true, index: true },
      name: { name: "name", type: "char", string: "Name", required: true, readonly: false, store: true, index: true },
      default_code: { name: "default_code", type: "char", string: "Internal Reference", required: false, readonly: false, store: true, index: true },
      list_price: { name: "list_price", type: "float", string: "Sales Price", required: false, readonly: false, store: true, index: false },
      standard_price: { name: "standard_price", type: "float", string: "Cost", required: false, readonly: false, store: true, index: false },
      categ_id: { name: "categ_id", type: "many2one", string: "Product Category", required: true, readonly: false, store: true, index: true, relation: "product.category" },
      type: {
        name: "type",
        type: "selection",
        string: "Product Type",
        required: true,
        readonly: false,
        store: true,
        index: true,
        selection: [["consu", "Consumable"], ["service", "Service"], ["product", "Storable Product"]]
      },
      active: { name: "active", type: "boolean", string: "Active", required: false, readonly: false, store: true, index: true },
    },
  },
};

const MOCK_DATA: Record<string, Record<string, unknown>[]> = {
  "res.partner": [
    { id: 1, name: "Acme Corporation", email: "contact@acme.com", is_company: true, company_type: "company" },
    { id: 2, name: "John Smith", email: "john@acme.com", is_company: false, parent_id: 1, company_type: "person" },
    { id: 3, name: "Jane Doe", email: "jane@example.com", is_company: false, company_type: "person" },
  ],
  "sale.order": [
    { id: 1, name: "SO001", partner_id: 1, state: "sale", amount_total: 1500.00, date_order: "2024-01-15 10:00:00" },
    { id: 2, name: "SO002", partner_id: 3, state: "draft", amount_total: 750.00, date_order: "2024-01-20 14:30:00" },
  ],
  "product.product": [
    { id: 1, name: "Widget A", default_code: "WGT-A", list_price: 29.99, type: "product", active: true },
    { id: 2, name: "Consulting Service", default_code: "SRV-001", list_price: 150.00, type: "service", active: true },
  ],
};

// =============================================================================
// DatabaseQueryTool Class
// =============================================================================

/**
 * DatabaseQueryTool
 *
 * Agent tool for querying Odoo data structures
 */
export class DatabaseQueryTool {
  private config: DatabaseQueryToolConfig;
  private modelCache: Map<string, OdooModelDefinition> = new Map();

  constructor(config: DatabaseQueryToolConfig) {
    this.config = {
      ...config,
      maxRecords: config.maxRecords || 100,
      readOnly: config.readOnly ?? true,
      apiEndpoint: config.apiEndpoint || "/jsonrpc",
    };

    // Pre-populate cache with mock data for development
    Object.entries(MOCK_MODELS).forEach(([name, def]) => {
      this.modelCache.set(name, def);
    });
  }

  /**
   * Check if model is accessible
   */
  private isModelAccessible(modelName: string): boolean {
    // Check blocklist
    if (this.config.blockedModels?.includes(modelName)) {
      return false;
    }

    // Check whitelist if defined
    if (this.config.allowedModels && this.config.allowedModels.length > 0) {
      return this.config.allowedModels.includes(modelName);
    }

    return true;
  }

  /**
   * List all available models
   */
  async listModels(searchTerm?: string): Promise<ModelSearchResult[]> {
    const models = Array.from(this.modelCache.values());

    let results = models.map((m) => ({
      name: m.name,
      description: m.description,
      module: m.module,
      fieldCount: Object.keys(m.fields).length,
      isTransient: m.isTransient,
    }));

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(
        (m) =>
          m.name.toLowerCase().includes(term) ||
          m.description.toLowerCase().includes(term) ||
          m.module.toLowerCase().includes(term)
      );
    }

    // Filter by accessibility
    results = results.filter((m) => this.isModelAccessible(m.name));

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get model definition
   */
  async getModelDefinition(modelName: string): Promise<OdooModelDefinition | null> {
    if (!this.isModelAccessible(modelName)) {
      return null;
    }

    // Check cache
    if (this.modelCache.has(modelName)) {
      return this.modelCache.get(modelName)!;
    }

    // In production, this would fetch from Odoo API
    // For now, return null if not in cache
    return null;
  }

  /**
   * Get field definitions for a model
   */
  async getFields(modelName: string, fieldNames?: string[]): Promise<Record<string, OdooFieldDefinition> | null> {
    const model = await this.getModelDefinition(modelName);
    if (!model) return null;

    if (fieldNames && fieldNames.length > 0) {
      const filtered: Record<string, OdooFieldDefinition> = {};
      for (const name of fieldNames) {
        if (model.fields[name]) {
          filtered[name] = model.fields[name];
        }
      }
      return filtered;
    }

    return model.fields;
  }

  /**
   * Query records from a model
   */
  async query<T = Record<string, unknown>>(
    modelName: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = performance.now();

    if (!this.isModelAccessible(modelName)) {
      return {
        success: false,
        model: modelName,
        count: 0,
        records: [],
        error: `Model "${modelName}" is not accessible`,
      };
    }

    // Get mock data (in production, this would call Odoo JSON-RPC)
    let records = (MOCK_DATA[modelName] || []) as T[];

    // Apply domain filter (simplified)
    if (options.domain && options.domain.length > 0) {
      records = this.applyDomain(records as Record<string, unknown>[], options.domain) as T[];
    }

    // Select fields
    if (options.fields && options.fields.length > 0) {
      records = records.map((r) => {
        const filtered: Record<string, unknown> = { id: (r as Record<string, unknown>).id };
        for (const field of options.fields!) {
          if (field in (r as Record<string, unknown>)) {
            filtered[field] = (r as Record<string, unknown>)[field];
          }
        }
        return filtered as T;
      });
    }

    // Apply limit
    const limit = Math.min(options.limit || this.config.maxRecords!, this.config.maxRecords!);
    const offset = options.offset || 0;
    const totalCount = records.length;

    records = records.slice(offset, offset + limit);

    return {
      success: true,
      model: modelName,
      count: totalCount,
      records,
      executionTimeMs: performance.now() - startTime,
    };
  }

  /**
   * Apply domain filter to records (simplified implementation)
   */
  private applyDomain(records: Record<string, unknown>[], domain: OdooDomain): Record<string, unknown>[] {
    return records.filter((record) => {
      for (const condition of domain) {
        if (Array.isArray(condition) && condition.length === 3) {
          const [field, operator, value] = condition;
          const fieldValue = record[field as string];

          switch (operator) {
            case "=":
              if (fieldValue !== value) return false;
              break;
            case "!=":
              if (fieldValue === value) return false;
              break;
            case ">":
              if (!(fieldValue as number > (value as number))) return false;
              break;
            case "<":
              if (!(fieldValue as number < (value as number))) return false;
              break;
            case ">=":
              if (!(fieldValue as number >= (value as number))) return false;
              break;
            case "<=":
              if (!(fieldValue as number <= (value as number))) return false;
              break;
            case "like":
            case "ilike":
              if (!String(fieldValue).toLowerCase().includes(String(value).toLowerCase())) return false;
              break;
            case "in":
              if (!Array.isArray(value) || !value.includes(fieldValue)) return false;
              break;
            case "not in":
              if (Array.isArray(value) && value.includes(fieldValue)) return false;
              break;
          }
        }
      }
      return true;
    });
  }

  /**
   * Get relationships for a model
   */
  async getRelationships(modelName: string): Promise<RelationshipInfo[]> {
    const model = await this.getModelDefinition(modelName);
    if (!model) return [];

    const relationships: RelationshipInfo[] = [];

    for (const [fieldName, field] of Object.entries(model.fields)) {
      if (field.type === "many2one" || field.type === "one2many" || field.type === "many2many") {
        if (field.relation) {
          relationships.push({
            field: fieldName,
            type: field.type,
            relatedModel: field.relation,
            inverseField: field.relationField,
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Get sample data from a model
   */
  async getSampleData(modelName: string, count = 5): Promise<QueryResult> {
    return this.query(modelName, { limit: count });
  }

  /**
   * Search across multiple models
   */
  async searchGlobal(
    searchTerm: string,
    models?: string[]
  ): Promise<Array<{ model: string; count: number; sample: Record<string, unknown>[] }>> {
    const targetModels = models || Array.from(this.modelCache.keys());
    const results: Array<{ model: string; count: number; sample: Record<string, unknown>[] }> = [];

    for (const modelName of targetModels) {
      if (!this.isModelAccessible(modelName)) continue;

      const model = await this.getModelDefinition(modelName);
      if (!model) continue;

      // Find searchable char fields
      const searchFields = Object.entries(model.fields)
        .filter(([, f]) => f.type === "char" && f.store)
        .map(([name]) => name);

      if (searchFields.length === 0) continue;

      // Build domain with OR conditions
      const domain: OdooDomain = [];
      for (const field of searchFields) {
        if (domain.length > 0) domain.push("|");
        domain.push([field, "ilike", searchTerm]);
      }

      const result = await this.query(modelName, { domain, limit: 3 });
      if (result.count > 0) {
        results.push({
          model: modelName,
          count: result.count,
          sample: result.records as Record<string, unknown>[],
        });
      }
    }

    return results;
  }

  /**
   * Get field statistics
   */
  async getFieldStats(modelName: string): Promise<{
    total: number;
    byType: Record<string, number>;
    required: number;
    computed: number;
    relational: number;
  } | null> {
    const model = await this.getModelDefinition(modelName);
    if (!model) return null;

    const fields = Object.values(model.fields);
    const byType: Record<string, number> = {};

    for (const field of fields) {
      byType[field.type] = (byType[field.type] || 0) + 1;
    }

    return {
      total: fields.length,
      byType,
      required: fields.filter((f) => f.required).length,
      computed: fields.filter((f) => f.compute).length,
      relational: fields.filter((f) => ["many2one", "one2many", "many2many"].includes(f.type)).length,
    };
  }
}

// =============================================================================
// Factory & Agent Integration
// =============================================================================

/**
 * Create a DatabaseQueryTool instance
 */
export function createDatabaseQueryTool(config: DatabaseQueryToolConfig): DatabaseQueryTool {
  return new DatabaseQueryTool(config);
}

/**
 * Tool definition for agent integration
 */
export const databaseQueryToolDefinition = {
  name: "database_query",
  description:
    "Query Odoo database to explore models, field definitions, and sample data. Useful for understanding data structures and relationships.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["listModels", "getModel", "getFields", "query", "getRelationships", "getSample", "search"],
        description: "Action to perform",
      },
      model: {
        type: "string",
        description: "Model name (e.g., res.partner, sale.order)",
      },
      fields: {
        type: "array",
        items: { type: "string" },
        description: "Field names to retrieve",
      },
      domain: {
        type: "array",
        description: "Odoo domain filter",
      },
      limit: {
        type: "number",
        description: "Maximum records to return",
      },
      searchTerm: {
        type: "string",
        description: "Search term for listing or global search",
      },
    },
    required: ["action"],
  },
};

export default DatabaseQueryTool;
