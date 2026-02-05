/**
 * OdooSecurityGenerator
 *
 * Generates Odoo security records (ir.model.access and ir.rule).
 * Creates valid CSV and XML files for access control.
 *
 * Features:
 * - ir.model.access.csv generation
 * - ir.rule XML generation with domain filters
 * - Multi-company support
 * - User/group-based access patterns
 * - Common security templates (CRUD, readonly, owner-only)
 * - Record rule domain builder
 * - Security group hierarchy
 *
 * Feature #102: Odoo Deep Integration - OdooSecurityGenerator
 */

// =============================================================================
// Types
// =============================================================================

/** Permission flags */
export interface Permissions {
  read: boolean;
  write: boolean;
  create: boolean;
  unlink: boolean;
}

/** Access control entry (ir.model.access) */
export interface AccessControl {
  id: string;
  name: string;
  modelId: string;
  groupId?: string;
  permissions: Permissions;
}

/** Domain operator */
export type DomainOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "in"
  | "not in"
  | "like"
  | "ilike"
  | "=like"
  | "=ilike"
  | "child_of"
  | "parent_of";

/** Domain condition */
export interface DomainCondition {
  field: string;
  operator: DomainOperator;
  value: string | number | boolean | string[] | number[];
}

/** Domain logic operator */
export type DomainLogic = "&" | "|" | "!";

/** Domain expression (can be condition or logic) */
export type DomainExpression = DomainCondition | DomainLogic;

/** Record rule (ir.rule) */
export interface RecordRule {
  id: string;
  name: string;
  modelId: string;
  groupIds?: string[];
  domain: DomainExpression[];
  permissions: Permissions;
  global?: boolean;
}

/** Security group definition */
export interface SecurityGroup {
  id: string;
  name: string;
  categoryId?: string;
  impliedIds?: string[];
  comment?: string;
}

/** Model security configuration */
export interface ModelSecurityConfig {
  modelName: string;
  moduleName: string;
  accessControls: AccessControl[];
  recordRules?: RecordRule[];
  groups?: SecurityGroup[];
}

/** Generated security output */
export interface GeneratedSecurity {
  accessCsv: string;
  rulesXml?: string;
  groupsXml?: string;
}

/** Security template type */
export type SecurityTemplate =
  | "full_access"
  | "readonly"
  | "owner_only"
  | "company_only"
  | "team_based"
  | "hierarchy";

// =============================================================================
// Constants
// =============================================================================

const COMMON_GROUPS = {
  user: "base.group_user",
  manager: "base.group_system",
  admin: "base.group_erp_manager",
  portal: "base.group_portal",
  public: "base.group_public",
  multiCompany: "base.group_multi_company",
};

const PERMISSION_TEMPLATES: Record<string, Permissions> = {
  full: { read: true, write: true, create: true, unlink: true },
  readonly: { read: true, write: false, create: false, unlink: false },
  readwrite: { read: true, write: true, create: false, unlink: false },
  create_only: { read: true, write: false, create: true, unlink: false },
  no_delete: { read: true, write: true, create: true, unlink: false },
  none: { read: false, write: false, create: false, unlink: false },
};

// =============================================================================
// Helper Functions
// =============================================================================

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/\./g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function formatModelRef(modelName: string): string {
  return `model_${modelName.replace(/\./g, "_")}`;
}

function formatPermission(value: boolean): string {
  return value ? "1" : "0";
}

function formatDomainValue(value: string | number | boolean | string[] | number[]): string {
  if (Array.isArray(value)) {
    return `[${value.map((v) => (typeof v === "string" ? `'${v}'` : v)).join(", ")}]`;
  }
  if (typeof value === "string") {
    // Check if it's a dynamic reference like user.id
    if (value.startsWith("user.") || value.startsWith("company.")) {
      return value;
    }
    return `'${value}'`;
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  return String(value);
}

function buildDomainString(expressions: DomainExpression[]): string {
  if (expressions.length === 0) {
    return "[(1, '=', 1)]";
  }

  const parts: string[] = [];

  for (const expr of expressions) {
    if (typeof expr === "string") {
      // Logic operator
      parts.push(`'${expr}'`);
    } else {
      // Condition
      const { field, operator, value } = expr;
      parts.push(`('${field}', '${operator}', ${formatDomainValue(value)})`);
    }
  }

  return `[${parts.join(", ")}]`;
}

// =============================================================================
// CSV Generation
// =============================================================================

function generateAccessCsv(accessControls: AccessControl[]): string {
  const lines: string[] = [];

  // Header
  lines.push("id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink");

  // Access control entries
  for (const ac of accessControls) {
    const { id, name, modelId, groupId, permissions } = ac;
    const modelRef = formatModelRef(modelId);
    const groupRef = groupId || "";

    lines.push(
      [
        id,
        name,
        modelRef,
        groupRef,
        formatPermission(permissions.read),
        formatPermission(permissions.write),
        formatPermission(permissions.create),
        formatPermission(permissions.unlink),
      ].join(",")
    );
  }

  return lines.join("\n");
}

// =============================================================================
// XML Generation
// =============================================================================

function generateRulesXml(rules: RecordRule[], moduleName: string): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push("<odoo>");
  lines.push('    <data noupdate="1">');

  for (const rule of rules) {
    lines.push("");
    lines.push(`        <!-- Record Rule: ${rule.name} -->`);
    lines.push(`        <record id="${rule.id}" model="ir.rule">`);
    lines.push(`            <field name="name">${rule.name}</field>`);
    lines.push(`            <field name="model_id" ref="${formatModelRef(rule.modelId)}"/>`);

    // Groups (if not global)
    if (!rule.global && rule.groupIds && rule.groupIds.length > 0) {
      const groupRefs = rule.groupIds.map((g) => `ref('${g}')`).join("), (4, ");
      lines.push(`            <field name="groups" eval="[(4, ${groupRefs})]"/>`);
    }

    // Domain
    const domainStr = buildDomainString(rule.domain);
    lines.push(`            <field name="domain_force">${domainStr}</field>`);

    // Permissions
    lines.push(`            <field name="perm_read" eval="${rule.permissions.read ? "True" : "False"}"/>`);
    lines.push(`            <field name="perm_write" eval="${rule.permissions.write ? "True" : "False"}"/>`);
    lines.push(`            <field name="perm_create" eval="${rule.permissions.create ? "True" : "False"}"/>`);
    lines.push(`            <field name="perm_unlink" eval="${rule.permissions.unlink ? "True" : "False"}"/>`);

    lines.push("        </record>");
  }

  lines.push("");
  lines.push("    </data>");
  lines.push("</odoo>");

  return lines.join("\n");
}

function generateGroupsXml(groups: SecurityGroup[], moduleName: string): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push("<odoo>");
  lines.push("    <data>");

  // Category if needed
  const hasCategory = groups.some((g) => g.categoryId && g.categoryId.startsWith(moduleName));
  if (hasCategory) {
    lines.push("");
    lines.push(`        <!-- Security Category -->`);
    lines.push(`        <record id="${moduleName}_category" model="ir.module.category">`);
    lines.push(`            <field name="name">${moduleName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</field>`);
    lines.push(`            <field name="sequence">100</field>`);
    lines.push("        </record>");
  }

  // Groups
  for (const group of groups) {
    lines.push("");
    lines.push(`        <!-- Security Group: ${group.name} -->`);
    lines.push(`        <record id="${group.id}" model="res.groups">`);
    lines.push(`            <field name="name">${group.name}</field>`);

    if (group.categoryId) {
      lines.push(`            <field name="category_id" ref="${group.categoryId}"/>`);
    }

    if (group.impliedIds && group.impliedIds.length > 0) {
      const impliedRefs = group.impliedIds.map((g) => `ref('${g}')`).join("), (4, ");
      lines.push(`            <field name="implied_ids" eval="[(4, ${impliedRefs})]"/>`);
    }

    if (group.comment) {
      lines.push(`            <field name="comment">${group.comment}</field>`);
    }

    lines.push("        </record>");
  }

  lines.push("");
  lines.push("    </data>");
  lines.push("</odoo>");

  return lines.join("\n");
}

// =============================================================================
// Domain Builder
// =============================================================================

export class DomainBuilder {
  private expressions: DomainExpression[] = [];

  /**
   * Add an AND condition
   */
  and(): DomainBuilder {
    this.expressions.push("&");
    return this;
  }

  /**
   * Add an OR condition
   */
  or(): DomainBuilder {
    this.expressions.push("|");
    return this;
  }

  /**
   * Add a NOT condition
   */
  not(): DomainBuilder {
    this.expressions.push("!");
    return this;
  }

  /**
   * Add a condition
   */
  condition(
    field: string,
    operator: DomainOperator,
    value: string | number | boolean | string[] | number[]
  ): DomainBuilder {
    this.expressions.push({ field, operator, value });
    return this;
  }

  /**
   * Shorthand for equality
   */
  equals(field: string, value: string | number | boolean): DomainBuilder {
    return this.condition(field, "=", value);
  }

  /**
   * Shorthand for inequality
   */
  notEquals(field: string, value: string | number | boolean): DomainBuilder {
    return this.condition(field, "!=", value);
  }

  /**
   * Shorthand for 'in' operator
   */
  in(field: string, values: string[] | number[]): DomainBuilder {
    return this.condition(field, "in", values);
  }

  /**
   * Current user condition
   */
  currentUser(field: string = "user_id"): DomainBuilder {
    return this.condition(field, "=", "user.id");
  }

  /**
   * Current company condition
   */
  currentCompany(field: string = "company_id"): DomainBuilder {
    return this.condition(field, "in", "company_ids" as any);
  }

  /**
   * Active records only
   */
  activeOnly(): DomainBuilder {
    return this.condition("active", "=", true);
  }

  /**
   * Child of (hierarchy)
   */
  childOf(field: string, value: string): DomainBuilder {
    return this.condition(field, "child_of", value);
  }

  /**
   * Build the domain expressions
   */
  build(): DomainExpression[] {
    return [...this.expressions];
  }

  /**
   * Build as string
   */
  toString(): string {
    return buildDomainString(this.expressions);
  }

  /**
   * Reset builder
   */
  reset(): DomainBuilder {
    this.expressions = [];
    return this;
  }
}

// =============================================================================
// Main Generator Class
// =============================================================================

export class OdooSecurityGenerator {
  /**
   * Generate security files from configuration
   */
  generate(config: ModelSecurityConfig): GeneratedSecurity {
    const accessCsv = generateAccessCsv(config.accessControls);

    const rulesXml =
      config.recordRules && config.recordRules.length > 0
        ? generateRulesXml(config.recordRules, config.moduleName)
        : undefined;

    const groupsXml =
      config.groups && config.groups.length > 0
        ? generateGroupsXml(config.groups, config.moduleName)
        : undefined;

    return {
      accessCsv,
      rulesXml,
      groupsXml,
    };
  }

  /**
   * Generate security from template
   */
  generateFromTemplate(
    modelName: string,
    moduleName: string,
    template: SecurityTemplate,
    options: {
      userGroup?: string;
      managerGroup?: string;
      ownerField?: string;
      companyField?: string;
      teamField?: string;
    } = {}
  ): GeneratedSecurity {
    const modelRef = toSnakeCase(modelName);
    const userGroup = options.userGroup || `${moduleName}.group_${modelRef}_user`;
    const managerGroup = options.managerGroup || `${moduleName}.group_${modelRef}_manager`;
    const ownerField = options.ownerField || "user_id";
    const companyField = options.companyField || "company_id";

    const accessControls: AccessControl[] = [];
    const recordRules: RecordRule[] = [];
    const groups: SecurityGroup[] = [];

    switch (template) {
      case "full_access":
        // Full access for users, managers get delete
        accessControls.push(
          {
            id: `access_${modelRef}_user`,
            name: `${modelName} User Access`,
            modelId: modelName,
            groupId: COMMON_GROUPS.user,
            permissions: PERMISSION_TEMPLATES.no_delete,
          },
          {
            id: `access_${modelRef}_manager`,
            name: `${modelName} Manager Access`,
            modelId: modelName,
            groupId: COMMON_GROUPS.manager,
            permissions: PERMISSION_TEMPLATES.full,
          }
        );
        break;

      case "readonly":
        // Read-only for users, full for managers
        accessControls.push(
          {
            id: `access_${modelRef}_user`,
            name: `${modelName} User Readonly`,
            modelId: modelName,
            groupId: COMMON_GROUPS.user,
            permissions: PERMISSION_TEMPLATES.readonly,
          },
          {
            id: `access_${modelRef}_manager`,
            name: `${modelName} Manager Full Access`,
            modelId: modelName,
            groupId: COMMON_GROUPS.manager,
            permissions: PERMISSION_TEMPLATES.full,
          }
        );
        break;

      case "owner_only":
        // Users can only see/edit their own records
        accessControls.push(
          {
            id: `access_${modelRef}_user`,
            name: `${modelName} User Access`,
            modelId: modelName,
            groupId: COMMON_GROUPS.user,
            permissions: PERMISSION_TEMPLATES.full,
          },
          {
            id: `access_${modelRef}_manager`,
            name: `${modelName} Manager Access`,
            modelId: modelName,
            groupId: COMMON_GROUPS.manager,
            permissions: PERMISSION_TEMPLATES.full,
          }
        );

        // Record rule for owner-only
        const ownerDomain = new DomainBuilder().currentUser(ownerField).build();
        recordRules.push({
          id: `rule_${modelRef}_user_own`,
          name: `${modelName} User Own Records`,
          modelId: modelName,
          groupIds: [COMMON_GROUPS.user],
          domain: ownerDomain,
          permissions: PERMISSION_TEMPLATES.full,
        });
        break;

      case "company_only":
        // Multi-company restriction
        accessControls.push(
          {
            id: `access_${modelRef}_user`,
            name: `${modelName} User Access`,
            modelId: modelName,
            groupId: COMMON_GROUPS.user,
            permissions: PERMISSION_TEMPLATES.full,
          },
          {
            id: `access_${modelRef}_manager`,
            name: `${modelName} Manager Access`,
            modelId: modelName,
            groupId: COMMON_GROUPS.manager,
            permissions: PERMISSION_TEMPLATES.full,
          }
        );

        // Company record rule
        const companyDomain = new DomainBuilder()
          .or()
          .condition(companyField, "=", false)
          .condition(companyField, "in", "company_ids" as any)
          .build();

        recordRules.push({
          id: `rule_${modelRef}_company`,
          name: `${modelName} Multi-Company`,
          modelId: modelName,
          global: true,
          domain: companyDomain,
          permissions: PERMISSION_TEMPLATES.full,
        });
        break;

      case "team_based":
        // Custom groups with hierarchy
        groups.push(
          {
            id: `group_${modelRef}_user`,
            name: `${modelName} / User`,
            categoryId: `${moduleName}_category`,
            impliedIds: [COMMON_GROUPS.user],
            comment: `Basic user access for ${modelName}`,
          },
          {
            id: `group_${modelRef}_manager`,
            name: `${modelName} / Manager`,
            categoryId: `${moduleName}_category`,
            impliedIds: [`${moduleName}.group_${modelRef}_user`],
            comment: `Manager access for ${modelName}`,
          }
        );

        accessControls.push(
          {
            id: `access_${modelRef}_user`,
            name: `${modelName} User Access`,
            modelId: modelName,
            groupId: userGroup,
            permissions: PERMISSION_TEMPLATES.no_delete,
          },
          {
            id: `access_${modelRef}_manager`,
            name: `${modelName} Manager Access`,
            modelId: modelName,
            groupId: managerGroup,
            permissions: PERMISSION_TEMPLATES.full,
          }
        );
        break;

      case "hierarchy":
        // Hierarchical access with parent visibility
        groups.push(
          {
            id: `group_${modelRef}_user`,
            name: `${modelName} / User`,
            categoryId: `${moduleName}_category`,
            impliedIds: [COMMON_GROUPS.user],
          },
          {
            id: `group_${modelRef}_team_leader`,
            name: `${modelName} / Team Leader`,
            categoryId: `${moduleName}_category`,
            impliedIds: [`${moduleName}.group_${modelRef}_user`],
          },
          {
            id: `group_${modelRef}_manager`,
            name: `${modelName} / Manager`,
            categoryId: `${moduleName}_category`,
            impliedIds: [`${moduleName}.group_${modelRef}_team_leader`],
          }
        );

        accessControls.push(
          {
            id: `access_${modelRef}_user`,
            name: `${modelName} User Access`,
            modelId: modelName,
            groupId: `${moduleName}.group_${modelRef}_user`,
            permissions: PERMISSION_TEMPLATES.readwrite,
          },
          {
            id: `access_${modelRef}_team_leader`,
            name: `${modelName} Team Leader Access`,
            modelId: modelName,
            groupId: `${moduleName}.group_${modelRef}_team_leader`,
            permissions: PERMISSION_TEMPLATES.no_delete,
          },
          {
            id: `access_${modelRef}_manager`,
            name: `${modelName} Manager Access`,
            modelId: modelName,
            groupId: `${moduleName}.group_${modelRef}_manager`,
            permissions: PERMISSION_TEMPLATES.full,
          }
        );

        // User sees own records
        recordRules.push({
          id: `rule_${modelRef}_user_own`,
          name: `${modelName} User Own`,
          modelId: modelName,
          groupIds: [`${moduleName}.group_${modelRef}_user`],
          domain: new DomainBuilder().currentUser(ownerField).build(),
          permissions: PERMISSION_TEMPLATES.full,
        });

        // Team leader sees team records
        if (options.teamField) {
          recordRules.push({
            id: `rule_${modelRef}_team_leader`,
            name: `${modelName} Team Leader`,
            modelId: modelName,
            groupIds: [`${moduleName}.group_${modelRef}_team_leader`],
            domain: new DomainBuilder()
              .condition(options.teamField, "=", `user.${options.teamField}.id` as any)
              .build(),
            permissions: PERMISSION_TEMPLATES.full,
          });
        }
        break;
    }

    return this.generate({
      modelName,
      moduleName,
      accessControls,
      recordRules,
      groups,
    });
  }

  /**
   * Generate access control entries for a model
   */
  generateAccessControls(
    modelName: string,
    moduleName: string,
    configs: Array<{
      suffix: string;
      group?: string;
      permissions: Permissions | keyof typeof PERMISSION_TEMPLATES;
    }>
  ): AccessControl[] {
    const modelRef = toSnakeCase(modelName);

    return configs.map((config) => ({
      id: `access_${modelRef}_${config.suffix}`,
      name: `${modelName} ${config.suffix} Access`,
      modelId: modelName,
      groupId: config.group,
      permissions:
        typeof config.permissions === "string"
          ? PERMISSION_TEMPLATES[config.permissions]
          : config.permissions,
    }));
  }

  /**
   * Create a new domain builder
   */
  createDomainBuilder(): DomainBuilder {
    return new DomainBuilder();
  }

  /**
   * Get common group references
   */
  getCommonGroups(): typeof COMMON_GROUPS {
    return { ...COMMON_GROUPS };
  }

  /**
   * Get permission templates
   */
  getPermissionTemplates(): typeof PERMISSION_TEMPLATES {
    return { ...PERMISSION_TEMPLATES };
  }

  /**
   * Validate security configuration
   */
  validate(config: ModelSecurityConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.modelName) {
      errors.push("Model name is required");
    }

    if (!config.moduleName) {
      errors.push("Module name is required");
    }

    if (!config.accessControls || config.accessControls.length === 0) {
      errors.push("At least one access control entry is required");
    }

    for (const ac of config.accessControls) {
      if (!ac.id) {
        errors.push("Access control ID is required");
      }
      if (!ac.name) {
        errors.push("Access control name is required");
      }
      if (!ac.modelId) {
        errors.push("Access control model ID is required");
      }
    }

    if (config.recordRules) {
      for (const rule of config.recordRules) {
        if (!rule.id) {
          errors.push("Record rule ID is required");
        }
        if (!rule.modelId) {
          errors.push("Record rule model ID is required");
        }
        if (!rule.domain || rule.domain.length === 0) {
          errors.push(`Record rule ${rule.id}: Domain is required`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const odooSecurityGenerator = new OdooSecurityGenerator();

export default OdooSecurityGenerator;
