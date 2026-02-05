/**
 * OdooFormGenerator
 *
 * Generates website forms with Odoo validation and submission handling.
 * Creates QWeb templates with proper form structure and backend controllers.
 *
 * Features:
 * - QWeb form template generation
 * - Field type mapping to HTML inputs
 * - Client-side validation
 * - Server-side validation
 * - CSRF protection
 * - File upload handling
 * - Multi-step form wizard
 * - Conditional field visibility
 * - Custom validation rules
 * - Success/error handling
 *
 * Feature #104: Odoo Deep Integration - OdooFormGenerator
 */

// =============================================================================
// Types
// =============================================================================

/** Form field types */
export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "datetime"
  | "time"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "file"
  | "hidden"
  | "many2one"
  | "many2many";

/** Validation rule */
export interface ValidationRule {
  type: "required" | "email" | "min" | "max" | "minLength" | "maxLength" | "pattern" | "custom";
  value?: string | number;
  message: string;
}

/** Select/radio option */
export interface FieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Conditional visibility rule */
export interface ConditionalRule {
  field: string;
  operator: "equals" | "notEquals" | "in" | "notIn" | "empty" | "notEmpty";
  value?: string | string[];
}

/** Form field definition */
export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string | number | boolean;
  options?: FieldOption[];
  validation?: ValidationRule[];
  conditionalShow?: ConditionalRule;
  cssClass?: string;
  attributes?: Record<string, string>;
  // For relational fields
  comodel?: string;
  domain?: string;
  // For file uploads
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean;
  // Layout
  colSpan?: number; // 1-12 for grid
}

/** Form section/fieldset */
export interface FormSection {
  id: string;
  title?: string;
  description?: string;
  fields: FormField[];
  collapsible?: boolean;
  collapsed?: boolean;
}

/** Form step (for wizard) */
export interface FormStep {
  id: string;
  title: string;
  description?: string;
  sections: FormSection[];
  validation?: string; // Python method name for step validation
}

/** Form submission config */
export interface SubmissionConfig {
  action: string;
  method: "POST" | "GET";
  model?: string;
  createRecord?: boolean;
  updateRecord?: boolean;
  successRedirect?: string;
  successMessage?: string;
  errorMessage?: string;
  sendEmail?: {
    template: string;
    recipients?: string[];
  };
}

/** Form configuration */
export interface FormConfig {
  id: string;
  name: string;
  description?: string;
  sections?: FormSection[];
  steps?: FormStep[]; // For wizard forms
  submission: SubmissionConfig;
  cssClass?: string;
  showLabels?: boolean;
  labelPosition?: "top" | "left" | "floating";
  submitButtonText?: string;
  resetButtonText?: string;
  showReset?: boolean;
}

/** Generated form output */
export interface GeneratedForm {
  templateXml: string;
  controllerPython: string;
  validationJs?: string;
  stylesCss?: string;
}

// =============================================================================
// Constants
// =============================================================================

const FIELD_TYPE_INPUT_MAP: Record<FormFieldType, string> = {
  text: "text",
  email: "email",
  tel: "tel",
  number: "number",
  date: "date",
  datetime: "datetime-local",
  time: "time",
  textarea: "textarea",
  select: "select",
  radio: "radio",
  checkbox: "checkbox",
  file: "file",
  hidden: "hidden",
  many2one: "select",
  many2many: "select",
};

// =============================================================================
// Helper Functions
// =============================================================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/\s+/g, "_");
}

function toPascalCase(str: string): string {
  return str
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function generateValidationAttributes(rules: ValidationRule[]): string {
  const attrs: string[] = [];

  for (const rule of rules) {
    switch (rule.type) {
      case "required":
        attrs.push('required="required"');
        break;
      case "email":
        // Already handled by type="email"
        break;
      case "min":
        attrs.push(`min="${rule.value}"`);
        break;
      case "max":
        attrs.push(`max="${rule.value}"`);
        break;
      case "minLength":
        attrs.push(`minlength="${rule.value}"`);
        break;
      case "maxLength":
        attrs.push(`maxlength="${rule.value}"`);
        break;
      case "pattern":
        attrs.push(`pattern="${rule.value}"`);
        break;
    }
  }

  return attrs.join(" ");
}

function generateConditionalAttribute(rule: ConditionalRule): string {
  const conditions: Record<string, string> = {
    equals: `${rule.field} == '${rule.value}'`,
    notEquals: `${rule.field} != '${rule.value}'`,
    in: `${rule.field} in ${JSON.stringify(rule.value)}`,
    notIn: `${rule.field} not in ${JSON.stringify(rule.value)}`,
    empty: `not ${rule.field}`,
    notEmpty: `${rule.field}`,
  };

  return conditions[rule.operator] || "True";
}

// =============================================================================
// Template Generation
// =============================================================================

function generateFieldHtml(field: FormField, indent: string = ""): string {
  const lines: string[] = [];
  const inputType = FIELD_TYPE_INPUT_MAP[field.type];
  const validationAttrs = field.validation ? generateValidationAttributes(field.validation) : "";
  const colClass = field.colSpan ? `col-md-${field.colSpan}` : "col-12";

  // Conditional wrapper
  if (field.conditionalShow) {
    const condition = generateConditionalAttribute(field.conditionalShow);
    lines.push(`${indent}<div t-if="${condition}" class="mb-3 ${colClass} ${field.cssClass || ""}">`);
  } else {
    lines.push(`${indent}<div class="mb-3 ${colClass} ${field.cssClass || ""}">`);
  }

  // Label (except for hidden and checkbox)
  if (field.type !== "hidden" && field.type !== "checkbox") {
    lines.push(`${indent}    <label for="${field.name}" class="form-label">${escapeXml(field.label)}</label>`);
  }

  // Generate input based on type
  switch (field.type) {
    case "textarea":
      lines.push(`${indent}    <textarea name="${field.name}" id="${field.name}" class="form-control"`);
      lines.push(`${indent}        placeholder="${escapeXml(field.placeholder || "")}" ${validationAttrs}>`);
      if (field.defaultValue) {
        lines.push(`${indent}        ${escapeXml(String(field.defaultValue))}`);
      }
      lines.push(`${indent}    </textarea>`);
      break;

    case "select":
    case "many2one":
      lines.push(`${indent}    <select name="${field.name}" id="${field.name}" class="form-select" ${validationAttrs}>`);
      if (field.placeholder) {
        lines.push(`${indent}        <option value="">${escapeXml(field.placeholder)}</option>`);
      }
      if (field.options) {
        for (const opt of field.options) {
          const selected = field.defaultValue === opt.value ? ' selected="selected"' : "";
          const disabled = opt.disabled ? ' disabled="disabled"' : "";
          lines.push(`${indent}        <option value="${escapeXml(opt.value)}"${selected}${disabled}>${escapeXml(opt.label)}</option>`);
        }
      }
      // For many2one with dynamic options
      if (field.comodel) {
        lines.push(`${indent}        <t t-foreach="${field.name}_options" t-as="opt">`);
        lines.push(`${indent}            <option t-att-value="opt['id']" t-esc="opt['display_name']"/>`);
        lines.push(`${indent}        </t>`);
      }
      lines.push(`${indent}    </select>`);
      break;

    case "many2many":
      lines.push(`${indent}    <select name="${field.name}" id="${field.name}" class="form-select" multiple="multiple" ${validationAttrs}>`);
      if (field.comodel) {
        lines.push(`${indent}        <t t-foreach="${field.name}_options" t-as="opt">`);
        lines.push(`${indent}            <option t-att-value="opt['id']" t-esc="opt['display_name']"/>`);
        lines.push(`${indent}        </t>`);
      }
      lines.push(`${indent}    </select>`);
      break;

    case "radio":
      if (field.options) {
        for (const opt of field.options) {
          const checked = field.defaultValue === opt.value ? ' checked="checked"' : "";
          lines.push(`${indent}    <div class="form-check">`);
          lines.push(`${indent}        <input type="radio" name="${field.name}" id="${field.name}_${opt.value}" value="${escapeXml(opt.value)}" class="form-check-input"${checked}/>`);
          lines.push(`${indent}        <label class="form-check-label" for="${field.name}_${opt.value}">${escapeXml(opt.label)}</label>`);
          lines.push(`${indent}    </div>`);
        }
      }
      break;

    case "checkbox":
      const checked = field.defaultValue ? ' checked="checked"' : "";
      lines.push(`${indent}    <div class="form-check">`);
      lines.push(`${indent}        <input type="checkbox" name="${field.name}" id="${field.name}" value="1" class="form-check-input"${checked} ${validationAttrs}/>`);
      lines.push(`${indent}        <label class="form-check-label" for="${field.name}">${escapeXml(field.label)}</label>`);
      lines.push(`${indent}    </div>`);
      break;

    case "file":
      const accept = field.accept ? ` accept="${field.accept}"` : "";
      const multiple = field.multiple ? ' multiple="multiple"' : "";
      lines.push(`${indent}    <input type="file" name="${field.name}" id="${field.name}" class="form-control"${accept}${multiple} ${validationAttrs}/>`);
      break;

    case "hidden":
      lines.push(`${indent}    <input type="hidden" name="${field.name}" id="${field.name}" t-att-value="${field.name}_value or '${field.defaultValue || ""}'"/>`);
      break;

    default:
      // Standard input types
      const defaultVal = field.defaultValue !== undefined ? ` value="${escapeXml(String(field.defaultValue))}"` : "";
      const extraAttrs = field.attributes
        ? Object.entries(field.attributes)
            .map(([k, v]) => `${k}="${escapeXml(v)}"`)
            .join(" ")
        : "";
      lines.push(`${indent}    <input type="${inputType}" name="${field.name}" id="${field.name}" class="form-control"`);
      lines.push(`${indent}        placeholder="${escapeXml(field.placeholder || "")}"${defaultVal} ${validationAttrs} ${extraAttrs}/>`);
  }

  // Help text
  if (field.helpText) {
    lines.push(`${indent}    <div class="form-text text-muted">${escapeXml(field.helpText)}</div>`);
  }

  lines.push(`${indent}</div>`);

  return lines.join("\n");
}

function generateSectionHtml(section: FormSection, indent: string = ""): string {
  const lines: string[] = [];

  if (section.collapsible) {
    lines.push(`${indent}<div class="card mb-4">`);
    lines.push(`${indent}    <div class="card-header" data-bs-toggle="collapse" data-bs-target="#section_${section.id}">`);
    lines.push(`${indent}        <h5 class="mb-0">${escapeXml(section.title || "")}</h5>`);
    lines.push(`${indent}    </div>`);
    lines.push(`${indent}    <div id="section_${section.id}" class="collapse${section.collapsed ? "" : " show"}">`);
    lines.push(`${indent}        <div class="card-body">`);
    if (section.description) {
      lines.push(`${indent}            <p class="text-muted">${escapeXml(section.description)}</p>`);
    }
    lines.push(`${indent}            <div class="row">`);
    for (const field of section.fields) {
      lines.push(generateFieldHtml(field, `${indent}                `));
    }
    lines.push(`${indent}            </div>`);
    lines.push(`${indent}        </div>`);
    lines.push(`${indent}    </div>`);
    lines.push(`${indent}</div>`);
  } else {
    if (section.title) {
      lines.push(`${indent}<fieldset class="mb-4">`);
      lines.push(`${indent}    <legend>${escapeXml(section.title)}</legend>`);
      if (section.description) {
        lines.push(`${indent}    <p class="text-muted">${escapeXml(section.description)}</p>`);
      }
    }
    lines.push(`${indent}<div class="row">`);
    for (const field of section.fields) {
      lines.push(generateFieldHtml(field, `${indent}    `));
    }
    lines.push(`${indent}</div>`);
    if (section.title) {
      lines.push(`${indent}</fieldset>`);
    }
  }

  return lines.join("\n");
}

function generateFormTemplate(config: FormConfig, moduleName: string): string {
  const lines: string[] = [];
  const templateId = `${moduleName}.${config.id}_form`;

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push("<odoo>");
  lines.push("");
  lines.push(`    <!-- Form Template: ${config.name} -->`);
  lines.push(`    <template id="${config.id}_form" name="${escapeXml(config.name)}">`);
  lines.push('        <t t-call="website.layout">');
  lines.push('            <div id="wrap" class="oe_structure">');
  lines.push('                <div class="container py-5">');

  // Form header
  lines.push(`                    <h1>${escapeXml(config.name)}</h1>`);
  if (config.description) {
    lines.push(`                    <p class="lead">${escapeXml(config.description)}</p>`);
  }

  // Error/success messages
  lines.push('                    <div t-if="error" class="alert alert-danger" role="alert">');
  lines.push("                        <t t-esc=\"error\"/>");
  lines.push("                    </div>");
  lines.push('                    <div t-if="success" class="alert alert-success" role="alert">');
  lines.push("                        <t t-esc=\"success\"/>");
  lines.push("                    </div>");
  lines.push("");

  // Form element
  const formClass = config.cssClass || "";
  const enctype = hasFileFields(config) ? ' enctype="multipart/form-data"' : "";
  lines.push(`                    <form action="${config.submission.action}" method="${config.submission.method}" class="${formClass}"${enctype} id="${config.id}_form">`);
  lines.push('                        <input type="hidden" name="csrf_token" t-att-value="request.csrf_token()"/>');
  lines.push("");

  // Generate form content
  if (config.steps && config.steps.length > 0) {
    // Wizard form
    lines.push(generateWizardHtml(config.steps, "                        "));
  } else if (config.sections) {
    // Regular form with sections
    for (const section of config.sections) {
      lines.push(generateSectionHtml(section, "                        "));
    }
  }

  // Submit buttons
  lines.push('                        <div class="mt-4">');
  lines.push(`                            <button type="submit" class="btn btn-primary">${escapeXml(config.submitButtonText || "Submit")}</button>`);
  if (config.showReset) {
    lines.push(`                            <button type="reset" class="btn btn-secondary ms-2">${escapeXml(config.resetButtonText || "Reset")}</button>`);
  }
  lines.push("                        </div>");

  lines.push("                    </form>");
  lines.push("                </div>");
  lines.push("            </div>");
  lines.push("        </t>");
  lines.push("    </template>");
  lines.push("");
  lines.push("</odoo>");

  return lines.join("\n");
}

function generateWizardHtml(steps: FormStep[], indent: string): string {
  const lines: string[] = [];

  // Progress indicator
  lines.push(`${indent}<div class="wizard-progress mb-4">`);
  lines.push(`${indent}    <ul class="nav nav-pills nav-justified">`);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const active = i === 0 ? " active" : "";
    lines.push(`${indent}        <li class="nav-item">`);
    lines.push(`${indent}            <a class="nav-link${active}" data-step="${i + 1}">${i + 1}. ${escapeXml(step.title)}</a>`);
    lines.push(`${indent}        </li>`);
  }
  lines.push(`${indent}    </ul>`);
  lines.push(`${indent}</div>`);
  lines.push("");

  // Step content
  lines.push(`${indent}<div class="wizard-steps">`);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const display = i === 0 ? "" : ' style="display: none;"';
    lines.push(`${indent}    <div class="wizard-step" data-step="${i + 1}"${display}>`);
    if (step.description) {
      lines.push(`${indent}        <p class="text-muted mb-3">${escapeXml(step.description)}</p>`);
    }
    for (const section of step.sections) {
      lines.push(generateSectionHtml(section, `${indent}        `));
    }

    // Step navigation
    lines.push(`${indent}        <div class="wizard-nav mt-4">`);
    if (i > 0) {
      lines.push(`${indent}            <button type="button" class="btn btn-secondary wizard-prev">Previous</button>`);
    }
    if (i < steps.length - 1) {
      lines.push(`${indent}            <button type="button" class="btn btn-primary wizard-next float-end">Next</button>`);
    }
    lines.push(`${indent}        </div>`);
    lines.push(`${indent}    </div>`);
  }
  lines.push(`${indent}</div>`);

  return lines.join("\n");
}

function hasFileFields(config: FormConfig): boolean {
  const checkFields = (fields: FormField[]): boolean => {
    return fields.some((f) => f.type === "file");
  };

  if (config.sections) {
    return config.sections.some((s) => checkFields(s.fields));
  }
  if (config.steps) {
    return config.steps.some((step) => step.sections.some((s) => checkFields(s.fields)));
  }
  return false;
}

// =============================================================================
// Controller Generation
// =============================================================================

function generateFormController(config: FormConfig, moduleName: string): string {
  const lines: string[] = [];
  const className = toPascalCase(config.id) + "Controller";
  const routePath = config.submission.action;

  lines.push("# -*- coding: utf-8 -*-");
  lines.push("import logging");
  lines.push("import base64");
  lines.push("from odoo import http, _");
  lines.push("from odoo.http import request");
  lines.push("from odoo.exceptions import ValidationError");
  lines.push("");
  lines.push("_logger = logging.getLogger(__name__)");
  lines.push("");
  lines.push("");
  lines.push(`class ${className}(http.Controller):`);
  lines.push(`    """Controller for ${config.name} form"""`);
  lines.push("");

  // GET route - display form
  lines.push(`    @http.route('${routePath}', type='http', auth='public', website=True)`);
  lines.push(`    def ${toSnakeCase(config.id)}_form(self, **kw):`);
  lines.push(`        """Display the ${config.name} form"""`);
  lines.push("        values = {");
  lines.push("            'error': kw.get('error'),");
  lines.push("            'success': kw.get('success'),");
  lines.push("        }");
  lines.push("");

  // Load options for relational fields
  const relationalFields = getAllRelationalFields(config);
  for (const field of relationalFields) {
    if (field.comodel) {
      const domain = field.domain || "[]";
      lines.push(`        # Load options for ${field.name}`);
      lines.push(`        values['${field.name}_options'] = request.env['${field.comodel}'].sudo().search_read(${domain}, ['id', 'display_name'])`);
    }
  }

  lines.push("");
  lines.push(`        return request.render('${moduleName}.${config.id}_form', values)`);
  lines.push("");

  // POST route - handle submission
  lines.push(`    @http.route('${routePath}', type='http', auth='public', website=True, methods=['POST'])`);
  lines.push(`    def ${toSnakeCase(config.id)}_submit(self, **post):`);
  lines.push(`        """Handle ${config.name} form submission"""`);
  lines.push("        try:");
  lines.push("            # Validate form data");
  lines.push(`            self._validate_${toSnakeCase(config.id)}(post)`);
  lines.push("");

  if (config.submission.model && config.submission.createRecord) {
    lines.push("            # Prepare record values");
    lines.push(`            values = self._prepare_${toSnakeCase(config.id)}_values(post)`);
    lines.push("");
    lines.push("            # Create record");
    lines.push(`            record = request.env['${config.submission.model}'].sudo().create(values)`);
    lines.push("            _logger.info('Created %s record %s', record._name, record.id)");
    lines.push("");
  }

  if (config.submission.sendEmail) {
    lines.push("            # Send notification email");
    lines.push(`            template = request.env.ref('${config.submission.sendEmail.template}')`);
    lines.push("            template.sudo().send_mail(record.id, force_send=True)");
    lines.push("");
  }

  const successRedirect = config.submission.successRedirect || routePath;
  const successMsg = config.submission.successMessage || "Form submitted successfully!";
  lines.push(`            return request.redirect('${successRedirect}?success=${encodeURIComponent(successMsg)}')`);
  lines.push("");
  lines.push("        except ValidationError as e:");
  lines.push("            _logger.warning('Form validation failed: %s', str(e))");
  lines.push(`            return request.redirect('${routePath}?error=' + str(e))`);
  lines.push("        except Exception as e:");
  lines.push("            _logger.exception('Form submission error')");
  const errorMsg = config.submission.errorMessage || "An error occurred. Please try again.";
  lines.push(`            return request.redirect('${routePath}?error=${encodeURIComponent(errorMsg)}')`);
  lines.push("");

  // Validation method
  lines.push(`    def _validate_${toSnakeCase(config.id)}(self, post):`);
  lines.push(`        """Validate ${config.name} form data"""`);
  lines.push("        errors = []");
  lines.push("");

  const allFields = getAllFields(config);
  for (const field of allFields) {
    if (field.validation) {
      for (const rule of field.validation) {
        if (rule.type === "required") {
          lines.push(`        if not post.get('${field.name}'):`);
          lines.push(`            errors.append('${rule.message}')`);
        }
        if (rule.type === "email") {
          lines.push(`        if post.get('${field.name}') and '@' not in post.get('${field.name}', ''):`);
          lines.push(`            errors.append('${rule.message}')`);
        }
        if (rule.type === "minLength") {
          lines.push(`        if post.get('${field.name}') and len(post.get('${field.name}', '')) < ${rule.value}:`);
          lines.push(`            errors.append('${rule.message}')`);
        }
      }
    }
  }

  lines.push("");
  lines.push("        if errors:");
  lines.push("            raise ValidationError(', '.join(errors))");
  lines.push("");

  // Value preparation method
  lines.push(`    def _prepare_${toSnakeCase(config.id)}_values(self, post):`);
  lines.push(`        """Prepare values for record creation"""`);
  lines.push("        values = {}");
  lines.push("");

  for (const field of allFields) {
    if (field.type === "file") {
      lines.push(`        # Handle file upload for ${field.name}`);
      lines.push(`        if post.get('${field.name}'):`);
      lines.push(`            values['${field.name}'] = base64.b64encode(post['${field.name}'].read())`);
    } else if (field.type === "checkbox") {
      lines.push(`        values['${field.name}'] = bool(post.get('${field.name}'))`);
    } else if (field.type === "many2many") {
      lines.push(`        if post.get('${field.name}'):`);
      lines.push(`            ids = [int(x) for x in post.getlist('${field.name}')]`);
      lines.push(`            values['${field.name}'] = [(6, 0, ids)]`);
    } else if (field.type === "many2one" || field.type === "number") {
      lines.push(`        if post.get('${field.name}'):`);
      lines.push(`            values['${field.name}'] = int(post.get('${field.name}'))`);
    } else if (field.type !== "hidden") {
      lines.push(`        values['${field.name}'] = post.get('${field.name}')`);
    }
  }

  lines.push("");
  lines.push("        return values");
  lines.push("");

  return lines.join("\n");
}

function getAllFields(config: FormConfig): FormField[] {
  const fields: FormField[] = [];

  if (config.sections) {
    for (const section of config.sections) {
      fields.push(...section.fields);
    }
  }

  if (config.steps) {
    for (const step of config.steps) {
      for (const section of step.sections) {
        fields.push(...section.fields);
      }
    }
  }

  return fields;
}

function getAllRelationalFields(config: FormConfig): FormField[] {
  return getAllFields(config).filter((f) => f.type === "many2one" || f.type === "many2many");
}

// =============================================================================
// JavaScript Generation
// =============================================================================

function generateFormValidationJs(config: FormConfig, moduleName: string): string {
  const lines: string[] = [];

  lines.push(`/* Form validation for ${config.name} */`);
  lines.push(`odoo.define('${moduleName}.${config.id}_form', function (require) {`);
  lines.push("    'use strict';");
  lines.push("");
  lines.push("    var publicWidget = require('web.public.widget');");
  lines.push("");
  lines.push(`    publicWidget.registry.${toPascalCase(config.id)}Form = publicWidget.Widget.extend({`);
  lines.push(`        selector: '#${config.id}_form',`);
  lines.push("        events: {");
  lines.push("            'submit': '_onSubmit',");
  if (config.steps) {
    lines.push("            'click .wizard-next': '_onWizardNext',");
    lines.push("            'click .wizard-prev': '_onWizardPrev',");
  }
  lines.push("        },");
  lines.push("");
  lines.push("        _onSubmit: function (ev) {");
  lines.push("            var self = this;");
  lines.push("            var $form = this.$el;");
  lines.push("            var isValid = this._validateForm($form);");
  lines.push("");
  lines.push("            if (!isValid) {");
  lines.push("                ev.preventDefault();");
  lines.push("                return false;");
  lines.push("            }");
  lines.push("");
  lines.push("            // Disable submit button");
  lines.push("            $form.find('button[type=\"submit\"]').prop('disabled', true).html('Submitting...');");
  lines.push("        },");
  lines.push("");
  lines.push("        _validateForm: function ($form) {");
  lines.push("            var isValid = true;");
  lines.push("            $form.find('.is-invalid').removeClass('is-invalid');");
  lines.push("            $form.find('.invalid-feedback').remove();");
  lines.push("");

  // Add field validations
  const allFields = getAllFields(config);
  for (const field of allFields) {
    if (field.validation) {
      for (const rule of field.validation) {
        if (rule.type === "custom" && rule.value) {
          lines.push(`            // Custom validation for ${field.name}`);
          lines.push(`            var $${field.name} = $form.find('[name="${field.name}"]');`);
          lines.push(`            if (${rule.value}) {`);
          lines.push(`                this._showError($${field.name}, '${rule.message}');`);
          lines.push("                isValid = false;");
          lines.push("            }");
        }
      }
    }
  }

  lines.push("");
  lines.push("            return isValid && $form[0].checkValidity();");
  lines.push("        },");
  lines.push("");
  lines.push("        _showError: function ($el, message) {");
  lines.push("            $el.addClass('is-invalid');");
  lines.push("            $el.after('<div class=\"invalid-feedback\">' + message + '</div>');");
  lines.push("        },");

  // Wizard navigation (if applicable)
  if (config.steps) {
    lines.push("");
    lines.push("        _onWizardNext: function (ev) {");
    lines.push("            var $currentStep = $(ev.currentTarget).closest('.wizard-step');");
    lines.push("            var stepNum = parseInt($currentStep.data('step'));");
    lines.push("");
    lines.push("            // Validate current step");
    lines.push("            if (!this._validateStep($currentStep)) {");
    lines.push("                return;");
    lines.push("            }");
    lines.push("");
    lines.push("            // Go to next step");
    lines.push("            $currentStep.hide();");
    lines.push("            this.$('.wizard-step[data-step=\"' + (stepNum + 1) + '\"]').show();");
    lines.push("            this._updateProgressIndicator(stepNum + 1);");
    lines.push("        },");
    lines.push("");
    lines.push("        _onWizardPrev: function (ev) {");
    lines.push("            var $currentStep = $(ev.currentTarget).closest('.wizard-step');");
    lines.push("            var stepNum = parseInt($currentStep.data('step'));");
    lines.push("");
    lines.push("            $currentStep.hide();");
    lines.push("            this.$('.wizard-step[data-step=\"' + (stepNum - 1) + '\"]').show();");
    lines.push("            this._updateProgressIndicator(stepNum - 1);");
    lines.push("        },");
    lines.push("");
    lines.push("        _validateStep: function ($step) {");
    lines.push("            var isValid = true;");
    lines.push("            $step.find('input, select, textarea').each(function () {");
    lines.push("                if (!this.checkValidity()) {");
    lines.push("                    isValid = false;");
    lines.push("                    $(this).addClass('is-invalid');");
    lines.push("                }");
    lines.push("            });");
    lines.push("            return isValid;");
    lines.push("        },");
    lines.push("");
    lines.push("        _updateProgressIndicator: function (stepNum) {");
    lines.push("            this.$('.wizard-progress .nav-link').removeClass('active');");
    lines.push("            this.$('.wizard-progress .nav-link[data-step=\"' + stepNum + '\"]').addClass('active');");
    lines.push("        },");
  }

  lines.push("    });");
  lines.push("");
  lines.push("    return publicWidget.registry." + toPascalCase(config.id) + "Form;");
  lines.push("});");

  return lines.join("\n");
}

// =============================================================================
// CSS Generation
// =============================================================================

function generateFormCss(config: FormConfig, moduleName: string): string {
  return `
/* Styles for ${config.name} form */

#${config.id}_form {
  max-width: 800px;
  margin: 0 auto;
}

#${config.id}_form .form-label {
  font-weight: 500;
}

#${config.id}_form .form-text {
  font-size: 0.875rem;
}

/* Wizard styles */
.wizard-progress .nav-link {
  color: #6c757d;
  background-color: #e9ecef;
  border-radius: 0;
}

.wizard-progress .nav-link.active {
  color: #fff;
  background-color: #714B67;
}

.wizard-progress .nav-link.completed {
  color: #fff;
  background-color: #28a745;
}

/* Collapsible sections */
.card-header[data-bs-toggle="collapse"] {
  cursor: pointer;
}

.card-header[data-bs-toggle="collapse"]:hover {
  background-color: #f8f9fa;
}

/* Validation styles */
.was-validated .form-control:invalid,
.form-control.is-invalid {
  border-color: #dc3545;
}

.invalid-feedback {
  display: block;
  color: #dc3545;
  font-size: 0.875rem;
}
`.trim();
}

// =============================================================================
// Main Generator Class
// =============================================================================

export class OdooFormGenerator {
  /**
   * Generate form from configuration
   */
  generate(config: FormConfig, moduleName: string): GeneratedForm {
    return {
      templateXml: generateFormTemplate(config, moduleName),
      controllerPython: generateFormController(config, moduleName),
      validationJs: generateFormValidationJs(config, moduleName),
      stylesCss: generateFormCss(config, moduleName),
    };
  }

  /**
   * Generate a simple contact form
   */
  generateContactForm(moduleName: string, options: {
    includePhone?: boolean;
    includeCompany?: boolean;
    customFields?: FormField[];
  } = {}): GeneratedForm {
    const fields: FormField[] = [
      {
        name: "name",
        label: "Your Name",
        type: "text",
        placeholder: "Enter your name",
        validation: [{ type: "required", message: "Name is required" }],
        colSpan: 6,
      },
      {
        name: "email",
        label: "Email Address",
        type: "email",
        placeholder: "Enter your email",
        validation: [
          { type: "required", message: "Email is required" },
          { type: "email", message: "Please enter a valid email" },
        ],
        colSpan: 6,
      },
    ];

    if (options.includePhone) {
      fields.push({
        name: "phone",
        label: "Phone Number",
        type: "tel",
        placeholder: "Enter your phone number",
        colSpan: 6,
      });
    }

    if (options.includeCompany) {
      fields.push({
        name: "company",
        label: "Company",
        type: "text",
        placeholder: "Your company name",
        colSpan: 6,
      });
    }

    fields.push(
      {
        name: "subject",
        label: "Subject",
        type: "text",
        placeholder: "What is this about?",
        validation: [{ type: "required", message: "Subject is required" }],
      },
      {
        name: "message",
        label: "Message",
        type: "textarea",
        placeholder: "Your message...",
        validation: [
          { type: "required", message: "Message is required" },
          { type: "minLength", value: 10, message: "Message must be at least 10 characters" },
        ],
      }
    );

    if (options.customFields) {
      fields.push(...options.customFields);
    }

    const config: FormConfig = {
      id: "contact",
      name: "Contact Us",
      description: "We'd love to hear from you. Send us a message and we'll respond as soon as possible.",
      sections: [{ id: "main", fields }],
      submission: {
        action: "/contact",
        method: "POST",
        model: "crm.lead",
        createRecord: true,
        successMessage: "Thank you for your message! We'll be in touch soon.",
      },
      submitButtonText: "Send Message",
    };

    return this.generate(config, moduleName);
  }

  /**
   * Validate form configuration
   */
  validate(config: FormConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.id) {
      errors.push("Form ID is required");
    }

    if (!config.name) {
      errors.push("Form name is required");
    }

    if (!config.submission || !config.submission.action) {
      errors.push("Form submission action is required");
    }

    const allFields = getAllFields(config);
    if (allFields.length === 0) {
      errors.push("Form must have at least one field");
    }

    // Check for duplicate field names
    const fieldNames = new Set<string>();
    for (const field of allFields) {
      if (fieldNames.has(field.name)) {
        errors.push(`Duplicate field name: ${field.name}`);
      }
      fieldNames.add(field.name);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const odooFormGenerator = new OdooFormGenerator();

export default OdooFormGenerator;
