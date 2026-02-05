/**
 * OdooModelGenerator
 *
 * Generates Odoo models from natural language descriptions.
 * Produces valid Python code for Odoo model definitions.
 *
 * Features:
 * - Natural language to Odoo model conversion
 * - Field type inference and mapping
 * - Relationship detection (Many2one, One2many, Many2many)
 * - Constraint generation
 * - Compute field support
 * - Inheritance handling (_inherit, _inherits)
 * - Security rules generation
 * - View scaffolding
 *
 * Feature #100: Odoo Deep Integration - OdooModelGenerator
 */

// =============================================================================
// Types
// =============================================================================

/** Odoo field types */
export type OdooFieldType =
  | "Char"
  | "Text"
  | "Html"
  | "Integer"
  | "Float"
  | "Monetary"
  | "Boolean"
  | "Date"
  | "Datetime"
  | "Binary"
  | "Selection"
  | "Many2one"
  | "One2many"
  | "Many2many"
  | "Reference";

/** Field definition */
export interface OdooField {
  name: string;
  type: OdooFieldType;
  string?: string;
  help?: string;
  required?: boolean;
  readonly?: boolean;
  index?: boolean;
  default?: string | number | boolean;
  compute?: string;
  inverse?: string;
  store?: boolean;
  related?: string;
  comodel?: string; // For relational fields
  inverseName?: string; // For One2many
  domain?: string;
  selectionOptions?: Array<[string, string]>;
  digits?: [number, number]; // For Float/Monetary
  size?: number; // For Char
  tracking?: boolean;
  copy?: boolean;
  groups?: string;
}

/** Constraint definition */
export interface OdooConstraint {
  name: string;
  type: "sql" | "python";
  definition: string;
  message: string;
}

/** Model inheritance */
export interface OdooInheritance {
  type: "_inherit" | "_inherits";
  model: string;
  delegateField?: string; // For _inherits
}

/** Method definition */
export interface OdooMethod {
  name: string;
  decorator?: string;
  parameters?: string[];
  body: string;
  docstring?: string;
}

/** Odoo model definition */
export interface OdooModel {
  name: string;
  technicalName: string;
  description?: string;
  inherit?: OdooInheritance[];
  fields: OdooField[];
  constraints?: OdooConstraint[];
  methods?: OdooMethod[];
  order?: string;
  recName?: string;
  autoCreate?: boolean;
}

/** Security access rule */
export interface OdooAccessRule {
  id: string;
  name: string;
  modelId: string;
  groupId?: string;
  permRead: boolean;
  permWrite: boolean;
  permCreate: boolean;
  permUnlink: boolean;
}

/** Record rule */
export interface OdooRecordRule {
  id: string;
  name: string;
  modelId: string;
  groupIds?: string[];
  domain: string;
  permRead: boolean;
  permWrite: boolean;
  permCreate: boolean;
  permUnlink: boolean;
}

/** Generated output */
export interface GeneratedOdooModel {
  pythonCode: string;
  securityCsv?: string;
  recordRulesXml?: string;
  viewsXml?: string;
  menuXml?: string;
}

/** Field hint from natural language */
export interface FieldHint {
  name: string;
  description: string;
  inferredType?: OdooFieldType;
  isRequired?: boolean;
  isRelational?: boolean;
  relatedModel?: string;
}

/** Natural language input */
export interface NaturalLanguageInput {
  description: string;
  modelName?: string;
  fields?: FieldHint[];
  relationships?: string[];
  constraints?: string[];
  features?: string[];
}

// =============================================================================
// Constants
// =============================================================================

const FIELD_TYPE_KEYWORDS: Record<string, OdooFieldType> = {
  // String types
  name: "Char",
  title: "Char",
  code: "Char",
  reference: "Char",
  email: "Char",
  phone: "Char",
  url: "Char",
  // Text types
  description: "Text",
  notes: "Text",
  comment: "Text",
  content: "Html",
  body: "Html",
  // Numeric
  quantity: "Float",
  qty: "Float",
  amount: "Monetary",
  price: "Monetary",
  cost: "Monetary",
  total: "Monetary",
  count: "Integer",
  number: "Integer",
  sequence: "Integer",
  age: "Integer",
  // Boolean
  active: "Boolean",
  done: "Boolean",
  is_: "Boolean",
  has_: "Boolean",
  // Date/Time
  date: "Date",
  deadline: "Date",
  datetime: "Datetime",
  created: "Datetime",
  updated: "Datetime",
  timestamp: "Datetime",
  // Binary
  image: "Binary",
  file: "Binary",
  attachment: "Binary",
  document: "Binary",
};

const RELATIONSHIP_KEYWORDS = [
  "belongs to",
  "has many",
  "has one",
  "related to",
  "linked to",
  "references",
  "parent",
  "children",
  "owner",
  "members",
];

// =============================================================================
// Helper Functions
// =============================================================================

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function toPascalCase(str: string): string {
  return str
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function inferFieldType(fieldName: string, description?: string): OdooFieldType {
  const lowerName = fieldName.toLowerCase();
  const lowerDesc = (description || "").toLowerCase();

  // Check for exact matches first
  for (const [keyword, type] of Object.entries(FIELD_TYPE_KEYWORDS)) {
    if (lowerName === keyword || lowerName.endsWith(`_${keyword}`)) {
      return type;
    }
  }

  // Check for prefix matches
  if (lowerName.startsWith("is_") || lowerName.startsWith("has_")) {
    return "Boolean";
  }

  // Check description for hints
  if (lowerDesc.includes("amount") || lowerDesc.includes("price") || lowerDesc.includes("cost")) {
    return "Monetary";
  }
  if (lowerDesc.includes("date")) {
    return lowerDesc.includes("time") ? "Datetime" : "Date";
  }
  if (lowerDesc.includes("number") || lowerDesc.includes("count")) {
    return "Integer";
  }
  if (lowerDesc.includes("yes/no") || lowerDesc.includes("true/false")) {
    return "Boolean";
  }
  if (lowerDesc.includes("long text") || lowerDesc.includes("multiline")) {
    return "Text";
  }
  if (lowerDesc.includes("html") || lowerDesc.includes("rich text")) {
    return "Html";
  }

  // Default to Char
  return "Char";
}

function detectRelationship(description: string): { type: OdooFieldType; comodel: string } | null {
  const lowerDesc = description.toLowerCase();

  for (const keyword of RELATIONSHIP_KEYWORDS) {
    if (lowerDesc.includes(keyword)) {
      // Extract model name from description
      const modelMatch = description.match(/(?:to|from|with)\s+(\w+)/i);
      const comodel = modelMatch ? toSnakeCase(modelMatch[1]) : "";

      if (keyword === "has many" || keyword === "children" || keyword === "members") {
        return { type: "One2many", comodel };
      }
      if (keyword === "belongs to" || keyword === "parent" || keyword === "owner") {
        return { type: "Many2one", comodel };
      }
      return { type: "Many2many", comodel };
    }
  }

  return null;
}

function generateFieldString(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// =============================================================================
// Code Generation Functions
// =============================================================================

function generateFieldCode(field: OdooField): string {
  const attrs: string[] = [];

  // String label
  if (field.string) {
    attrs.push(`string="${field.string}"`);
  }

  // Help text
  if (field.help) {
    attrs.push(`help="${field.help}"`);
  }

  // Required
  if (field.required) {
    attrs.push("required=True");
  }

  // Readonly
  if (field.readonly) {
    attrs.push("readonly=True");
  }

  // Index
  if (field.index) {
    attrs.push("index=True");
  }

  // Default value
  if (field.default !== undefined) {
    if (typeof field.default === "string") {
      attrs.push(`default="${field.default}"`);
    } else if (typeof field.default === "boolean") {
      attrs.push(`default=${field.default ? "True" : "False"}`);
    } else {
      attrs.push(`default=${field.default}`);
    }
  }

  // Compute
  if (field.compute) {
    attrs.push(`compute="${field.compute}"`);
    if (field.store !== undefined) {
      attrs.push(`store=${field.store ? "True" : "False"}`);
    }
  }

  // Inverse
  if (field.inverse) {
    attrs.push(`inverse="${field.inverse}"`);
  }

  // Related
  if (field.related) {
    attrs.push(`related="${field.related}"`);
  }

  // Relational field attributes
  if (field.comodel) {
    attrs.push(`comodel_name="${field.comodel}"`);
  }

  if (field.inverseName) {
    attrs.push(`inverse_name="${field.inverseName}"`);
  }

  if (field.domain) {
    attrs.push(`domain="${field.domain}"`);
  }

  // Selection options
  if (field.selectionOptions) {
    const options = field.selectionOptions
      .map(([value, label]) => `("${value}", "${label}")`)
      .join(", ");
    attrs.push(`selection=[${options}]`);
  }

  // Digits for Float/Monetary
  if (field.digits) {
    attrs.push(`digits=(${field.digits[0]}, ${field.digits[1]})`);
  }

  // Size for Char
  if (field.size) {
    attrs.push(`size=${field.size}`);
  }

  // Tracking
  if (field.tracking) {
    attrs.push("tracking=True");
  }

  // Copy
  if (field.copy === false) {
    attrs.push("copy=False");
  }

  // Groups
  if (field.groups) {
    attrs.push(`groups="${field.groups}"`);
  }

  const attrString = attrs.length > 0 ? attrs.join(", ") : "";
  return `    ${field.name} = fields.${field.type}(${attrString})`;
}

function generateConstraintCode(constraint: OdooConstraint): string {
  if (constraint.type === "sql") {
    return `        ("${constraint.name}", "${constraint.definition}", "${constraint.message}"),`;
  }
  // Python constraint
  return `
    @api.constrains(${constraint.definition})
    def _check_${constraint.name}(self):
        for record in self:
            if not (${constraint.definition}):
                raise ValidationError("${constraint.message}")
`;
}

function generateMethodCode(method: OdooMethod): string {
  const decorator = method.decorator ? `    @${method.decorator}\n` : "";
  const params = method.parameters ? ["self", ...method.parameters].join(", ") : "self";
  const docstring = method.docstring ? `        """${method.docstring}"""\n` : "";

  return `${decorator}    def ${method.name}(${params}):
${docstring}        ${method.body}
`;
}

function generatePythonCode(model: OdooModel): string {
  const lines: string[] = [];

  // Imports
  lines.push("# -*- coding: utf-8 -*-");
  lines.push("from odoo import models, fields, api");
  lines.push("from odoo.exceptions import ValidationError");
  lines.push("");
  lines.push("");

  // Class definition
  lines.push(`class ${toPascalCase(model.name)}(models.Model):`);

  // Model attributes
  lines.push(`    _name = "${model.technicalName}"`);

  if (model.description) {
    lines.push(`    _description = "${model.description}"`);
  }

  // Inheritance
  if (model.inherit && model.inherit.length > 0) {
    for (const inh of model.inherit) {
      if (inh.type === "_inherit") {
        lines.push(`    _inherit = "${inh.model}"`);
      } else if (inh.type === "_inherits" && inh.delegateField) {
        lines.push(`    _inherits = {"${inh.model}": "${inh.delegateField}"}`);
      }
    }
  }

  if (model.order) {
    lines.push(`    _order = "${model.order}"`);
  }

  if (model.recName) {
    lines.push(`    _rec_name = "${model.recName}"`);
  }

  lines.push("");

  // Fields
  for (const field of model.fields) {
    lines.push(generateFieldCode(field));
  }

  // SQL Constraints
  const sqlConstraints = model.constraints?.filter((c) => c.type === "sql") || [];
  if (sqlConstraints.length > 0) {
    lines.push("");
    lines.push("    _sql_constraints = [");
    for (const constraint of sqlConstraints) {
      lines.push(generateConstraintCode(constraint));
    }
    lines.push("    ]");
  }

  // Python Constraints and Methods
  const pythonConstraints = model.constraints?.filter((c) => c.type === "python") || [];
  for (const constraint of pythonConstraints) {
    lines.push(generateConstraintCode(constraint));
  }

  if (model.methods && model.methods.length > 0) {
    lines.push("");
    for (const method of model.methods) {
      lines.push(generateMethodCode(method));
    }
  }

  return lines.join("\n");
}

function generateSecurityCsv(model: OdooModel, accessRules: OdooAccessRule[]): string {
  const lines: string[] = [];
  lines.push("id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink");

  for (const rule of accessRules) {
    const groupId = rule.groupId || "";
    const read = rule.permRead ? "1" : "0";
    const write = rule.permWrite ? "1" : "0";
    const create = rule.permCreate ? "1" : "0";
    const unlink = rule.permUnlink ? "1" : "0";
    lines.push(`${rule.id},${rule.name},model_${model.technicalName.replace(/\./g, "_")},${groupId},${read},${write},${create},${unlink}`);
  }

  return lines.join("\n");
}

function generateRecordRulesXml(rules: OdooRecordRule[]): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push("<odoo>");
  lines.push("    <data noupdate=\"1\">");

  for (const rule of rules) {
    lines.push(`        <record id="${rule.id}" model="ir.rule">`);
    lines.push(`            <field name="name">${rule.name}</field>`);
    lines.push(`            <field name="model_id" ref="${rule.modelId}"/>`);
    if (rule.groupIds && rule.groupIds.length > 0) {
      lines.push(`            <field name="groups" eval="[(4, ref('${rule.groupIds.join("')), (4, ref('")}"))]"/>`);
    }
    lines.push(`            <field name="domain_force">${rule.domain}</field>`);
    lines.push(`            <field name="perm_read" eval="${rule.permRead ? "True" : "False"}"/>`);
    lines.push(`            <field name="perm_write" eval="${rule.permWrite ? "True" : "False"}"/>`);
    lines.push(`            <field name="perm_create" eval="${rule.permCreate ? "True" : "False"}"/>`);
    lines.push(`            <field name="perm_unlink" eval="${rule.permUnlink ? "True" : "False"}"/>`);
    lines.push("        </record>");
  }

  lines.push("    </data>");
  lines.push("</odoo>");

  return lines.join("\n");
}

function generateBasicViews(model: OdooModel): string {
  const modelRef = model.technicalName.replace(/\./g, "_");
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push("<odoo>");

  // Tree view
  lines.push(`    <record id="${modelRef}_view_tree" model="ir.ui.view">`);
  lines.push(`        <field name="name">${model.technicalName}.tree</field>`);
  lines.push(`        <field name="model">${model.technicalName}</field>`);
  lines.push('        <field name="arch" type="xml">');
  lines.push("            <tree>");
  for (const field of model.fields.slice(0, 5)) {
    lines.push(`                <field name="${field.name}"/>`);
  }
  lines.push("            </tree>");
  lines.push("        </field>");
  lines.push("    </record>");
  lines.push("");

  // Form view
  lines.push(`    <record id="${modelRef}_view_form" model="ir.ui.view">`);
  lines.push(`        <field name="name">${model.technicalName}.form</field>`);
  lines.push(`        <field name="model">${model.technicalName}</field>`);
  lines.push('        <field name="arch" type="xml">');
  lines.push('            <form string="' + (model.description || model.name) + '">');
  lines.push('                <sheet>');
  lines.push('                    <group>');
  lines.push('                        <group>');
  const halfFields = Math.ceil(model.fields.length / 2);
  for (const field of model.fields.slice(0, halfFields)) {
    lines.push(`                            <field name="${field.name}"/>`);
  }
  lines.push('                        </group>');
  lines.push('                        <group>');
  for (const field of model.fields.slice(halfFields)) {
    lines.push(`                            <field name="${field.name}"/>`);
  }
  lines.push('                        </group>');
  lines.push('                    </group>');
  lines.push('                </sheet>');
  lines.push("            </form>");
  lines.push("        </field>");
  lines.push("    </record>");
  lines.push("");

  // Search view
  lines.push(`    <record id="${modelRef}_view_search" model="ir.ui.view">`);
  lines.push(`        <field name="name">${model.technicalName}.search</field>`);
  lines.push(`        <field name="model">${model.technicalName}</field>`);
  lines.push('        <field name="arch" type="xml">');
  lines.push("            <search>");
  for (const field of model.fields.filter(f => f.type === "Char" || f.type === "Text").slice(0, 3)) {
    lines.push(`                <field name="${field.name}"/>`);
  }
  lines.push("            </search>");
  lines.push("        </field>");
  lines.push("    </record>");
  lines.push("");

  // Action
  lines.push(`    <record id="${modelRef}_action" model="ir.actions.act_window">`);
  lines.push(`        <field name="name">${model.description || model.name}</field>`);
  lines.push(`        <field name="res_model">${model.technicalName}</field>`);
  lines.push('        <field name="view_mode">tree,form</field>');
  lines.push("    </record>");

  lines.push("</odoo>");

  return lines.join("\n");
}

// =============================================================================
// Main Generator Class
// =============================================================================

export class OdooModelGenerator {
  /**
   * Parse natural language input to extract model information
   */
  parseNaturalLanguage(input: NaturalLanguageInput): OdooModel {
    const description = input.description;

    // Extract or generate model name
    const modelName = input.modelName || this.extractModelName(description);
    const technicalName = toSnakeCase(modelName);

    // Parse fields from description and hints
    const fields = this.parseFields(input);

    // Detect constraints
    const constraints = this.parseConstraints(input);

    // Generate compute methods if needed
    const methods = this.parseMethods(input, fields);

    return {
      name: modelName,
      technicalName,
      description: description.split(".")[0].trim(),
      fields,
      constraints,
      methods,
      order: fields.find(f => f.name === "sequence") ? "sequence, id" : "id",
    };
  }

  /**
   * Extract model name from description
   */
  private extractModelName(description: string): string {
    // Try to find "a/an <ModelName>" pattern
    const match = description.match(/(?:a|an)\s+(\w+)/i);
    if (match) {
      return match[1];
    }

    // Try to find "model for <something>"
    const modelMatch = description.match(/model\s+(?:for|to\s+manage)\s+(\w+)/i);
    if (modelMatch) {
      return modelMatch[1];
    }

    // Default to generic name
    return "CustomModel";
  }

  /**
   * Parse fields from input
   */
  private parseFields(input: NaturalLanguageInput): OdooField[] {
    const fields: OdooField[] = [];

    // Add standard fields
    fields.push({
      name: "name",
      type: "Char",
      string: "Name",
      required: true,
      tracking: true,
    });

    // Process field hints
    if (input.fields) {
      for (const hint of input.fields) {
        const fieldName = toSnakeCase(hint.name);

        // Skip if already added
        if (fields.find(f => f.name === fieldName)) continue;

        // Check for relationship
        const relationship = hint.isRelational
          ? { type: hint.inferredType || "Many2one" as OdooFieldType, comodel: hint.relatedModel || "" }
          : detectRelationship(hint.description);

        if (relationship) {
          fields.push({
            name: fieldName,
            type: relationship.type,
            string: generateFieldString(fieldName),
            comodel: relationship.comodel,
            required: hint.isRequired,
          });
        } else {
          const fieldType = hint.inferredType || inferFieldType(fieldName, hint.description);
          fields.push({
            name: fieldName,
            type: fieldType,
            string: generateFieldString(fieldName),
            required: hint.isRequired,
            help: hint.description,
          });
        }
      }
    }

    // Parse additional fields from description
    const descriptionFields = this.extractFieldsFromDescription(input.description);
    for (const field of descriptionFields) {
      if (!fields.find(f => f.name === field.name)) {
        fields.push(field);
      }
    }

    // Add active field if not present
    if (!fields.find(f => f.name === "active")) {
      fields.push({
        name: "active",
        type: "Boolean",
        string: "Active",
        default: true,
      });
    }

    return fields;
  }

  /**
   * Extract fields from natural language description
   */
  private extractFieldsFromDescription(description: string): OdooField[] {
    const fields: OdooField[] = [];

    // Look for "with <field>, <field>, and <field>" patterns
    const withMatch = description.match(/with\s+(.+?)(?:\.|$)/i);
    if (withMatch) {
      const fieldList = withMatch[1].split(/,\s*(?:and\s+)?/);
      for (const fieldName of fieldList) {
        const cleanName = fieldName.trim().toLowerCase().replace(/\s+/g, "_");
        if (cleanName && cleanName.length > 1) {
          const fieldType = inferFieldType(cleanName);
          fields.push({
            name: cleanName,
            type: fieldType,
            string: generateFieldString(cleanName),
          });
        }
      }
    }

    // Look for "including <field>" patterns
    const includingMatch = description.match(/including\s+(.+?)(?:\.|$)/i);
    if (includingMatch) {
      const fieldList = includingMatch[1].split(/,\s*(?:and\s+)?/);
      for (const fieldName of fieldList) {
        const cleanName = fieldName.trim().toLowerCase().replace(/\s+/g, "_");
        if (cleanName && cleanName.length > 1 && !fields.find(f => f.name === cleanName)) {
          const fieldType = inferFieldType(cleanName);
          fields.push({
            name: cleanName,
            type: fieldType,
            string: generateFieldString(cleanName),
          });
        }
      }
    }

    return fields;
  }

  /**
   * Parse constraints from input
   */
  private parseConstraints(input: NaturalLanguageInput): OdooConstraint[] {
    const constraints: OdooConstraint[] = [];

    if (input.constraints) {
      for (const constraintDesc of input.constraints) {
        const lowerDesc = constraintDesc.toLowerCase();

        // Unique constraints
        if (lowerDesc.includes("unique")) {
          const fieldMatch = constraintDesc.match(/unique\s+(\w+)/i);
          if (fieldMatch) {
            const fieldName = toSnakeCase(fieldMatch[1]);
            constraints.push({
              name: `unique_${fieldName}`,
              type: "sql",
              definition: `UNIQUE(${fieldName})`,
              message: `${generateFieldString(fieldName)} must be unique`,
            });
          }
        }

        // Positive value constraints
        if (lowerDesc.includes("positive") || lowerDesc.includes("greater than")) {
          const fieldMatch = constraintDesc.match(/(?:positive|greater\s+than\s+\d+)\s+(\w+)/i);
          if (fieldMatch) {
            const fieldName = toSnakeCase(fieldMatch[1]);
            constraints.push({
              name: `positive_${fieldName}`,
              type: "sql",
              definition: `CHECK(${fieldName} >= 0)`,
              message: `${generateFieldString(fieldName)} must be positive`,
            });
          }
        }
      }
    }

    return constraints;
  }

  /**
   * Parse methods from input
   */
  private parseMethods(input: NaturalLanguageInput, fields: OdooField[]): OdooMethod[] {
    const methods: OdooMethod[] = [];

    // Add compute methods for computed fields
    for (const field of fields) {
      if (field.compute) {
        methods.push({
          name: field.compute,
          decorator: `api.depends('${field.related || ""}')`,
          body: `self.${field.name} = 0  # TODO: Implement computation`,
          docstring: `Compute ${field.string || field.name}`,
        });
      }
    }

    // Add name_get if custom rec_name
    const recNameField = fields.find(f => f.name !== "name" && f.type === "Char");
    if (recNameField) {
      methods.push({
        name: "name_get",
        body: `return [(record.id, record.${recNameField.name}) for record in self]`,
        docstring: "Return display name",
      });
    }

    return methods;
  }

  /**
   * Generate complete Odoo model output
   */
  generate(input: NaturalLanguageInput): GeneratedOdooModel {
    const model = this.parseNaturalLanguage(input);
    const modelRef = model.technicalName.replace(/\./g, "_");

    // Generate default access rules
    const accessRules: OdooAccessRule[] = [
      {
        id: `access_${modelRef}_user`,
        name: `${model.name} User Access`,
        modelId: `model_${modelRef}`,
        groupId: "base.group_user",
        permRead: true,
        permWrite: true,
        permCreate: true,
        permUnlink: false,
      },
      {
        id: `access_${modelRef}_manager`,
        name: `${model.name} Manager Access`,
        modelId: `model_${modelRef}`,
        groupId: "base.group_system",
        permRead: true,
        permWrite: true,
        permCreate: true,
        permUnlink: true,
      },
    ];

    return {
      pythonCode: generatePythonCode(model),
      securityCsv: generateSecurityCsv(model, accessRules),
      viewsXml: generateBasicViews(model),
    };
  }

  /**
   * Generate only Python model code
   */
  generatePythonOnly(input: NaturalLanguageInput): string {
    const model = this.parseNaturalLanguage(input);
    return generatePythonCode(model);
  }

  /**
   * Validate generated model
   */
  validate(model: OdooModel): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check model name
    if (!model.technicalName.match(/^[a-z][a-z0-9_.]*$/)) {
      errors.push("Technical name must start with lowercase letter and contain only lowercase letters, numbers, underscores, and dots");
    }

    // Check fields
    for (const field of model.fields) {
      if (!field.name.match(/^[a-z][a-z0-9_]*$/)) {
        errors.push(`Field "${field.name}" has invalid name format`);
      }

      // Check relational fields have comodel
      if (["Many2one", "One2many", "Many2many"].includes(field.type) && !field.comodel) {
        errors.push(`Relational field "${field.name}" requires comodel_name`);
      }

      // Check One2many has inverse_name
      if (field.type === "One2many" && !field.inverseName) {
        errors.push(`One2many field "${field.name}" requires inverse_name`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const odooModelGenerator = new OdooModelGenerator();

export default OdooModelGenerator;
