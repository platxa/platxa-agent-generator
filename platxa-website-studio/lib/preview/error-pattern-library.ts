/**
 * Error Pattern Library
 *
 * Contains 50+ common error patterns for Odoo, QWeb, and SCSS with
 * regex matching, categorization, and fix templates for self-debugging.
 */

// =============================================================================
// Types
// =============================================================================

/** Error pattern categories */
export type ErrorCategory =
  | "qweb-directive"
  | "qweb-syntax"
  | "qweb-template"
  | "qweb-expression"
  | "scss-variable"
  | "scss-syntax"
  | "scss-mixin"
  | "scss-import"
  | "scss-function"
  | "odoo-field"
  | "odoo-model"
  | "odoo-view"
  | "odoo-asset"
  | "odoo-security"
  | "python-import"
  | "python-syntax"
  | "javascript"
  | "xml-syntax"
  | "general";

/** Severity level of the error */
export type ErrorSeverity = "error" | "warning" | "info";

/** A single error pattern definition */
export interface ErrorPattern {
  /** Unique identifier for the pattern */
  id: string;
  /** Human-readable name */
  name: string;
  /** Category for grouping */
  category: ErrorCategory;
  /** Regex to match the error message */
  pattern: RegExp;
  /** Description of what causes this error */
  description: string;
  /** Template for suggested fix (supports $1, $2, etc. for captured groups) */
  fixTemplate: string;
  /** Example error message */
  example: string;
  /** Severity level */
  severity: ErrorSeverity;
  /** Tags for filtering */
  tags: string[];
}

/** Result of pattern matching */
export interface PatternMatch {
  /** The matched pattern */
  pattern: ErrorPattern;
  /** Captured groups from regex */
  captures: string[];
  /** Generated fix suggestion */
  suggestedFix: string;
  /** Confidence score (0-1) */
  confidence: number;
}

/** Options for pattern matching */
export interface PatternMatchOptions {
  /** Filter by category */
  categories?: ErrorCategory[];
  /** Filter by tags */
  tags?: string[];
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Maximum number of matches to return */
  maxMatches?: number;
}

// =============================================================================
// Error Patterns Library (50+ patterns)
// =============================================================================

export const ERROR_PATTERNS: ErrorPattern[] = [
  // =========================================================================
  // QWeb Directive Errors (15 patterns)
  // =========================================================================
  {
    id: "qweb-missing-t-as",
    name: "Missing t-as directive",
    category: "qweb-directive",
    pattern: /t-foreach.*without.*t-as|Missing.*t-as|requires.*t-as/i,
    description: "t-foreach directive requires a corresponding t-as to name the loop variable",
    fixTemplate: 'Add t-as="item" attribute to the element with t-foreach',
    example: "t-foreach without t-as on element",
    severity: "error",
    tags: ["loop", "foreach", "iteration"],
  },
  {
    id: "qweb-missing-t-foreach",
    name: "Missing t-foreach directive",
    category: "qweb-directive",
    pattern: /t-as.*without.*t-foreach|Missing.*t-foreach|orphan.*t-as/i,
    description: "t-as directive requires a corresponding t-foreach",
    fixTemplate: 'Add t-foreach="collection" attribute to the element with t-as',
    example: "t-as without t-foreach on element",
    severity: "error",
    tags: ["loop", "foreach", "iteration"],
  },
  {
    id: "qweb-orphan-elif",
    name: "Orphan t-elif directive",
    category: "qweb-directive",
    pattern: /orphan.*t-elif|t-elif.*must follow.*t-if|t-elif.*without.*t-if/i,
    description: "t-elif must follow a t-if or another t-elif on a sibling element",
    fixTemplate: "Add a t-if directive on the preceding sibling element",
    example: "t-elif must follow a t-if or another t-elif",
    severity: "error",
    tags: ["conditional", "elif", "if"],
  },
  {
    id: "qweb-orphan-else",
    name: "Orphan t-else directive",
    category: "qweb-directive",
    pattern: /orphan.*t-else|t-else.*must follow.*t-if|t-else.*without.*t-if/i,
    description: "t-else must follow a t-if or t-elif on a sibling element",
    fixTemplate: "Add a t-if directive on the preceding sibling element",
    example: "t-else must follow a t-if or t-elif",
    severity: "error",
    tags: ["conditional", "else", "if"],
  },
  {
    id: "qweb-invalid-directive",
    name: "Invalid QWeb directive",
    category: "qweb-directive",
    pattern: /unknown.*directive.*t-(\w+)|invalid.*directive.*t-(\w+)|unrecognized.*t-(\w+)/i,
    description: "The directive is not a valid QWeb directive",
    fixTemplate: "Check spelling or use a valid directive: t-if, t-foreach, t-esc, t-out, t-call, etc.",
    example: "Unknown QWeb directive: t-invalid",
    severity: "error",
    tags: ["directive", "typo", "invalid"],
  },
  {
    id: "qweb-deprecated-t-raw",
    name: "Deprecated t-raw directive",
    category: "qweb-directive",
    pattern: /deprecated.*t-raw|t-raw.*deprecated|use.*t-out.*instead.*t-raw/i,
    description: "t-raw is deprecated in Odoo 15+, use t-out instead",
    fixTemplate: 'Replace t-raw with t-out and add t-options="{\'widget\': \'html\'}" if needed',
    example: "Deprecated directive 't-raw'. Use t-out instead.",
    severity: "warning",
    tags: ["deprecated", "raw", "out", "html"],
  },
  {
    id: "qweb-missing-t-name",
    name: "Missing t-name attribute",
    category: "qweb-directive",
    pattern: /template.*without.*t-name|missing.*t-name|t-name.*required/i,
    description: "Template element requires a t-name attribute for identification",
    fixTemplate: 'Add t-name="module.template_name" to the template element',
    example: "Template without t-name attribute",
    severity: "error",
    tags: ["template", "name", "identifier"],
  },
  {
    id: "qweb-duplicate-t-name",
    name: "Duplicate template name",
    category: "qweb-directive",
    pattern: /duplicate.*template.*name|template.*already.*defined|t-name.*already.*exists/i,
    description: "A template with this name already exists",
    fixTemplate: "Use a unique t-name or use t-inherit to extend the existing template",
    example: "Template 'website.layout' already defined",
    severity: "error",
    tags: ["template", "duplicate", "name"],
  },
  {
    id: "qweb-t-call-not-found",
    name: "Template not found for t-call",
    category: "qweb-directive",
    pattern: /template.*not found.*t-call|t-call.*template.*missing|cannot.*find.*template/i,
    description: "The template referenced in t-call does not exist",
    fixTemplate: "Check the template name spelling or ensure the template is defined",
    example: "Cannot find template 'website.missing_template'",
    severity: "error",
    tags: ["template", "call", "missing"],
  },
  {
    id: "qweb-t-set-without-value",
    name: "t-set without value",
    category: "qweb-directive",
    pattern: /t-set.*without.*value|t-set.*requires.*t-value|missing.*t-value/i,
    description: "t-set requires either t-value attribute or body content",
    fixTemplate: 'Add t-value="expression" or provide content inside the element',
    example: "t-set 'variable' without value",
    severity: "error",
    tags: ["variable", "set", "value"],
  },
  {
    id: "qweb-t-field-invalid",
    name: "Invalid t-field usage",
    category: "qweb-directive",
    pattern: /t-field.*invalid|invalid.*field.*expression|t-field.*requires.*record/i,
    description: "t-field requires a valid record.field_name expression",
    fixTemplate: 'Use format t-field="record.field_name" with a valid record object',
    example: "Invalid t-field expression",
    severity: "error",
    tags: ["field", "record", "expression"],
  },
  {
    id: "qweb-t-options-invalid",
    name: "Invalid t-options format",
    category: "qweb-directive",
    pattern: /invalid.*t-options|t-options.*syntax|t-options.*must.*dict/i,
    description: "t-options must be a valid Python dict expression",
    fixTemplate: "Use proper dict syntax: t-options=\"{'key': 'value'}\"",
    example: "Invalid t-options: must be a dictionary",
    severity: "error",
    tags: ["options", "dict", "syntax"],
  },
  {
    id: "qweb-t-att-invalid",
    name: "Invalid dynamic attribute",
    category: "qweb-directive",
    pattern: /invalid.*t-att|t-att.*expression.*error|dynamic.*attribute.*invalid/i,
    description: "t-att-* or t-attf-* expression is invalid",
    fixTemplate: "Check the expression syntax for t-att-attribute or t-attf-attribute",
    example: "Invalid expression in t-att-class",
    severity: "error",
    tags: ["attribute", "dynamic", "expression"],
  },
  {
    id: "qweb-t-esc-undefined",
    name: "Undefined variable in t-esc",
    category: "qweb-directive",
    pattern: /undefined.*variable.*t-esc|t-esc.*undefined|variable.*not.*defined.*t-esc/i,
    description: "The variable used in t-esc is not defined in the context",
    fixTemplate: "Ensure the variable is passed to the template context or defined with t-set",
    example: "Undefined variable 'user_name' in t-esc",
    severity: "error",
    tags: ["variable", "undefined", "esc"],
  },
  {
    id: "qweb-t-out-xss",
    name: "Potential XSS in t-out",
    category: "qweb-directive",
    pattern: /xss.*t-out|t-out.*unsafe|unsanitized.*html.*t-out/i,
    description: "t-out with user input may cause XSS vulnerabilities",
    fixTemplate: "Use t-esc for user input or sanitize the HTML content",
    example: "Potential XSS: t-out with user-provided content",
    severity: "warning",
    tags: ["security", "xss", "html"],
  },
  // Additional t-if, t-foreach, t-call, t-set patterns (Feature #139)
  {
    id: "qweb-t-if-always-true",
    name: "t-if always evaluates true",
    category: "qweb-directive",
    pattern: /t-if.*always.*true|t-if.*constant.*true|redundant.*t-if/i,
    description: "t-if condition always evaluates to true, making it redundant",
    fixTemplate: "Remove the t-if directive or fix the condition logic",
    example: "t-if always evaluates to true: t-if=\"True\"",
    severity: "warning",
    tags: ["conditional", "if", "redundant"],
  },
  {
    id: "qweb-t-if-comparison",
    name: "Invalid comparison in t-if",
    category: "qweb-directive",
    pattern: /t-if.*invalid.*comparison|comparison.*error.*t-if|t-if.*type.*mismatch|invalid.*comparison.*t-if/i,
    description: "t-if contains an invalid comparison between incompatible types",
    fixTemplate: "Ensure both sides of the comparison have compatible types",
    example: "Invalid comparison in t-if: type mismatch",
    severity: "error",
    tags: ["conditional", "if", "comparison"],
  },
  {
    id: "qweb-t-foreach-not-iterable",
    name: "t-foreach value not iterable",
    category: "qweb-directive",
    pattern: /t-foreach.*not.*iterable|cannot.*iterate|t-foreach.*expects.*iterable/i,
    description: "t-foreach requires an iterable value (list, tuple, dict, recordset)",
    fixTemplate: "Ensure the t-foreach value is a list, tuple, dict, or recordset",
    example: "t-foreach value is not iterable: expected list, got integer",
    severity: "error",
    tags: ["loop", "foreach", "iterable"],
  },
  {
    id: "qweb-t-foreach-index",
    name: "Invalid loop index access",
    category: "qweb-directive",
    pattern: /loop.*index.*invalid|_index.*undefined|_first.*_last.*error/i,
    description: "Invalid use of loop index variables (_index, _first, _last, _size)",
    fixTemplate: "Loop variables are: varname_index, varname_first, varname_last, varname_size",
    example: "Undefined loop index: item_index is undefined",
    severity: "error",
    tags: ["loop", "foreach", "index"],
  },
  {
    id: "qweb-t-call-circular",
    name: "Circular template call",
    category: "qweb-directive",
    pattern: /circular.*t-call|t-call.*recursive.*loop|infinite.*template.*call/i,
    description: "t-call creates a circular/recursive template call chain",
    fixTemplate: "Add a base case condition or restructure templates to avoid recursion",
    example: "Circular t-call detected: template A calls B which calls A",
    severity: "error",
    tags: ["template", "call", "circular"],
  },
  {
    id: "qweb-t-call-assets",
    name: "Invalid t-call-assets usage",
    category: "qweb-directive",
    pattern: /t-call-assets.*invalid|invalid.*asset.*bundle|t-call-assets.*not.*found/i,
    description: "t-call-assets references an invalid or missing asset bundle",
    fixTemplate: "Use a valid asset bundle name defined in __manifest__.py",
    example: "t-call-assets invalid: bundle 'web.invalid_bundle' not found",
    severity: "error",
    tags: ["template", "call", "assets"],
  },
  {
    id: "qweb-t-set-reserved",
    name: "t-set overwriting reserved variable",
    category: "qweb-directive",
    pattern: /t-set.*reserved|overwriting.*built-?in|t-set.*protected.*variable/i,
    description: "t-set is overwriting a reserved or built-in variable name",
    fixTemplate: "Use a different variable name that doesn't conflict with built-ins",
    example: "t-set overwriting reserved variable: 'request' is protected",
    severity: "warning",
    tags: ["variable", "set", "reserved"],
  },
  {
    id: "qweb-t-set-scope",
    name: "t-set scope issue",
    category: "qweb-directive",
    pattern: /t-set.*scope|variable.*scope.*t-set|t-set.*not.*visible/i,
    description: "Variable set with t-set is not visible in the expected scope",
    fixTemplate: "Move t-set outside the conditional/loop or use a different approach",
    example: "t-set scope issue: variable set inside t-if not visible outside",
    severity: "warning",
    tags: ["variable", "set", "scope"],
  },

  // =========================================================================
  // QWeb Syntax Errors (10 patterns)
  // =========================================================================
  {
    id: "qweb-unclosed-tag",
    name: "Unclosed XML tag",
    category: "qweb-syntax",
    pattern: /unclosed.*tag|tag.*not.*closed|missing.*closing.*tag|<(\w+).*not.*closed/i,
    description: "An XML/HTML tag was not properly closed",
    fixTemplate: "Add the closing tag </$1> or use self-closing syntax <$1 />",
    example: "Unclosed tag: <div>",
    severity: "error",
    tags: ["xml", "tag", "unclosed"],
  },
  {
    id: "qweb-mismatched-tags",
    name: "Mismatched closing tag",
    category: "qweb-syntax",
    pattern: /mismatched.*tag|expected.*<\/(\w+)>.*found.*<\/(\w+)>|closing.*tag.*mismatch/i,
    description: "The closing tag does not match the opening tag",
    fixTemplate: "Change </$2> to </$1> to match the opening tag",
    example: "Mismatched: expected </div>, found </span>",
    severity: "error",
    tags: ["xml", "tag", "mismatch"],
  },
  {
    id: "qweb-invalid-xml",
    name: "Invalid XML syntax",
    category: "qweb-syntax",
    pattern: /invalid.*xml|xml.*parse.*error|not.*well-?formed/i,
    description: "The XML is not well-formed",
    fixTemplate: "Check for special characters (use &amp; &lt; &gt;) and proper tag nesting",
    example: "XML parse error: not well-formed",
    severity: "error",
    tags: ["xml", "parse", "syntax"],
  },
  {
    id: "qweb-unescaped-ampersand",
    name: "Unescaped ampersand",
    category: "qweb-syntax",
    pattern: /unescaped.*&|&.*not.*escaped|invalid.*entity.*&/i,
    description: "Ampersand must be escaped as &amp; in XML",
    fixTemplate: "Replace & with &amp;",
    example: "Unescaped '&' in attribute value",
    severity: "error",
    tags: ["xml", "escape", "ampersand"],
  },
  {
    id: "qweb-invalid-attribute",
    name: "Invalid attribute syntax",
    category: "qweb-syntax",
    pattern: /invalid.*attribute|attribute.*syntax.*error|malformed.*attribute/i,
    description: "Attribute syntax is invalid",
    fixTemplate: 'Use proper attribute syntax: attribute="value"',
    example: "Invalid attribute syntax",
    severity: "error",
    tags: ["xml", "attribute", "syntax"],
  },
  {
    id: "qweb-duplicate-attribute",
    name: "Duplicate attribute",
    category: "qweb-syntax",
    pattern: /duplicate.*attribute|attribute.*already.*defined|repeated.*attribute/i,
    description: "The same attribute is defined multiple times on an element",
    fixTemplate: "Remove the duplicate attribute or merge the values",
    example: "Duplicate attribute 'class' on element",
    severity: "error",
    tags: ["xml", "attribute", "duplicate"],
  },
  {
    id: "qweb-empty-expression",
    name: "Empty expression",
    category: "qweb-syntax",
    pattern: /empty.*expression|expression.*empty|t-\w+=""/i,
    description: "The directive expression is empty",
    fixTemplate: "Provide a valid expression value for the directive",
    example: 't-if="" - empty expression',
    severity: "error",
    tags: ["expression", "empty", "directive"],
  },
  {
    id: "qweb-invalid-python-expr",
    name: "Invalid Python expression",
    category: "qweb-expression",
    pattern: /invalid.*python.*expression|syntax.*error.*expression|expression.*parse.*error/i,
    description: "The Python expression in the directive is invalid",
    fixTemplate: "Check Python syntax: parentheses, operators, and string quotes",
    example: "Invalid Python expression: unclosed parenthesis",
    severity: "error",
    tags: ["python", "expression", "syntax"],
  },
  {
    id: "qweb-unbalanced-brackets",
    name: "Unbalanced brackets",
    category: "qweb-expression",
    pattern: /unbalanced.*bracket|unclosed.*\[|missing.*\]|bracket.*mismatch/i,
    description: "Square brackets are not balanced in the expression",
    fixTemplate: "Ensure all [ have matching ]",
    example: "Unbalanced brackets in expression: items[0",
    severity: "error",
    tags: ["expression", "brackets", "syntax"],
  },
  {
    id: "qweb-unbalanced-parens",
    name: "Unbalanced parentheses",
    category: "qweb-expression",
    pattern: /unbalanced.*parenthes|unclosed.*\(|missing.*\)|paren.*mismatch/i,
    description: "Parentheses are not balanced in the expression",
    fixTemplate: "Ensure all ( have matching )",
    example: "Unbalanced parentheses in expression: func(a, b",
    severity: "error",
    tags: ["expression", "parentheses", "syntax"],
  },

  // =========================================================================
  // SCSS Variable Errors (10 patterns)
  // NOTE: More specific patterns (Bootstrap, Odoo) must come BEFORE generic patterns
  // =========================================================================
  {
    id: "scss-bootstrap-variable-missing",
    name: "Missing Bootstrap variable",
    category: "scss-variable",
    pattern: /undefined.*\$(primary|secondary|success|danger|warning|info|light|dark)\b/i,
    description: "Bootstrap theme variable is not defined",
    fixTemplate: "Import Bootstrap variables or define: $$1: #hexvalue;",
    example: "Undefined variable: $primary",
    severity: "error",
    tags: ["bootstrap", "theme", "variable"],
  },
  {
    id: "scss-odoo-color-undefined",
    name: "Undefined Odoo color variable",
    category: "scss-variable",
    pattern: /undefined.*\$o-color-(\d+)|o-color-(\d+).*not.*defined/i,
    description: "Odoo color palette variable is not defined",
    fixTemplate: "Define the color in your theme: $o-color-$1: #hexvalue;",
    example: "Undefined variable: $o-color-1",
    severity: "error",
    tags: ["odoo", "color", "palette", "variable"],
  },
  {
    id: "scss-undefined-variable",
    name: "Undefined SCSS variable",
    category: "scss-variable",
    pattern: /undefined.*variable.*\$(\w+)|variable.*\$(\w+).*not.*defined|\$(\w+).*undefined/i,
    description: "The SCSS variable is not defined",
    fixTemplate: "Define the variable: $$1: value; or import the file containing it",
    example: "Undefined variable: $primary-color",
    severity: "error",
    tags: ["variable", "undefined", "scss"],
  },
  {
    id: "scss-invalid-variable-name",
    name: "Invalid variable name",
    category: "scss-variable",
    pattern: /invalid.*variable.*name|variable.*name.*invalid|\$.*invalid.*identifier/i,
    description: "Variable names must start with $ and contain only alphanumeric/hyphens/underscores",
    fixTemplate: "Use valid variable name: $my-variable or $my_variable",
    example: "Invalid variable name: $123invalid",
    severity: "error",
    tags: ["variable", "name", "scss"],
  },
  {
    id: "scss-variable-type-error",
    name: "Variable type error",
    category: "scss-variable",
    pattern: /expected.*(\w+).*got.*(\w+)|type.*error.*variable|incompatible.*type/i,
    description: "Variable is of wrong type for the operation",
    fixTemplate: "Check variable type: use number for math, color for color functions",
    example: "Expected number, got string",
    severity: "error",
    tags: ["variable", "type", "scss"],
  },
  {
    id: "scss-circular-reference",
    name: "Circular variable reference",
    category: "scss-variable",
    pattern: /circular.*reference|variable.*references.*itself|infinite.*loop.*variable/i,
    description: "Variable references itself directly or indirectly",
    fixTemplate: "Break the circular reference by using a different variable",
    example: "Circular reference: $a references $b which references $a",
    severity: "error",
    tags: ["variable", "circular", "reference"],
  },
  {
    id: "scss-null-variable",
    name: "Null variable usage",
    category: "scss-variable",
    pattern: /null.*value|variable.*is.*null|cannot.*use.*null/i,
    description: "Variable has null value which cannot be used",
    fixTemplate: "Provide a default value: $var: value !default; or check for null",
    example: "Cannot use null value in calculation",
    severity: "error",
    tags: ["variable", "null", "scss"],
  },
  {
    id: "scss-default-override",
    name: "Default variable not overriding",
    category: "scss-variable",
    pattern: /!default.*not.*working|variable.*not.*overridden|default.*ignored/i,
    description: "!default variable is not being overridden as expected",
    fixTemplate: "Ensure your variable definition comes BEFORE the !default declaration",
    example: "Variable with !default not being overridden",
    severity: "warning",
    tags: ["variable", "default", "override"],
  },
  {
    id: "scss-map-key-missing",
    name: "Map key not found",
    category: "scss-variable",
    pattern: /key.*not.*found.*map|map.*missing.*key|undefined.*map.*key/i,
    description: "The key does not exist in the SCSS map",
    fixTemplate: "Check available keys with map-keys($map) or add the key to the map",
    example: "Key 'primary' not found in map $colors",
    severity: "error",
    tags: ["map", "key", "scss"],
  },
  {
    id: "scss-list-index-error",
    name: "List index out of bounds",
    category: "scss-variable",
    pattern: /list.*index.*out|index.*(\d+).*out.*bounds|invalid.*list.*index/i,
    description: "List index is out of bounds (SCSS lists are 1-indexed)",
    fixTemplate: "Check list length with length($list) and use 1-based index",
    example: "List index 5 out of bounds for list of length 3",
    severity: "error",
    tags: ["list", "index", "scss"],
  },

  // =========================================================================
  // SCSS Syntax Errors (8 patterns)
  // =========================================================================
  {
    id: "scss-missing-semicolon",
    name: "Missing semicolon",
    category: "scss-syntax",
    pattern: /expected.*;|missing.*semicolon|semicolon.*expected/i,
    description: "Statement is missing a semicolon",
    fixTemplate: "Add ; at the end of the statement",
    example: "Expected ';' after property value",
    severity: "error",
    tags: ["syntax", "semicolon", "scss"],
  },
  {
    id: "scss-missing-brace",
    name: "Missing curly brace",
    category: "scss-syntax",
    pattern: /expected.*\{|expected.*\}|unclosed.*block|missing.*brace/i,
    description: "Curly brace is missing",
    fixTemplate: "Add the missing { or } to close the block",
    example: "Expected '{' after selector",
    severity: "error",
    tags: ["syntax", "brace", "scss"],
  },
  {
    id: "scss-unclosed-bracket",
    name: "Unclosed square bracket",
    category: "scss-syntax",
    pattern: /unclosed.*bracket|missing.*\]|expected.*\]|unmatched.*\[/i,
    description: "Square bracket is not closed in expression or selector",
    fixTemplate: "Add the missing ] to close the bracket",
    example: "Unclosed bracket in attribute selector [data-value",
    severity: "error",
    tags: ["syntax", "bracket", "scss"],
  },
  {
    id: "scss-invalid-selector",
    name: "Invalid CSS selector",
    category: "scss-syntax",
    pattern: /invalid.*selector|selector.*syntax|unrecognized.*selector/i,
    description: "The CSS selector syntax is invalid",
    fixTemplate: "Check selector syntax: .class, #id, element, [attr], :pseudo",
    example: "Invalid selector: ..double-dot",
    severity: "error",
    tags: ["selector", "syntax", "scss"],
  },
  {
    id: "scss-invalid-property",
    name: "Invalid CSS property",
    category: "scss-syntax",
    pattern: /invalid.*property|unknown.*property|property.*not.*recognized/i,
    description: "The CSS property is not recognized",
    fixTemplate: "Check property name spelling or use a valid CSS property",
    example: "Unknown property: colr (did you mean color?)",
    severity: "error",
    tags: ["property", "invalid", "scss"],
  },
  {
    id: "scss-invalid-value",
    name: "Invalid property value",
    category: "scss-syntax",
    pattern: /invalid.*value|value.*not.*allowed|expected.*got/i,
    description: "The property value is invalid",
    fixTemplate: "Use a valid value for the property",
    example: "Invalid value 'abc' for property 'width'",
    severity: "error",
    tags: ["value", "invalid", "scss"],
  },
  {
    id: "scss-nesting-too-deep",
    name: "Excessive nesting depth",
    category: "scss-syntax",
    pattern: /nesting.*too.*deep|excessive.*nesting|max.*nesting.*exceeded/i,
    description: "Selector nesting is too deep, affecting performance and specificity",
    fixTemplate: "Flatten the nesting to maximum 3-4 levels",
    example: "Selector nesting is too deep (5 levels)",
    severity: "warning",
    tags: ["nesting", "performance", "scss"],
  },
  {
    id: "scss-invalid-interpolation",
    name: "Invalid interpolation syntax",
    category: "scss-syntax",
    pattern: /invalid.*#\{|interpolation.*error|unclosed.*#\{/i,
    description: "String interpolation syntax is invalid",
    fixTemplate: "Use proper interpolation: #{$variable} or #{expression}",
    example: "Invalid syntax in #{$var - unclosed interpolation",
    severity: "error",
    tags: ["interpolation", "syntax", "scss"],
  },
  {
    id: "scss-invalid-at-rule",
    name: "Invalid at-rule",
    category: "scss-syntax",
    pattern: /invalid.*@|unknown.*@|unrecognized.*at-rule/i,
    description: "The @-rule is not recognized",
    fixTemplate: "Use valid at-rules: @import, @mixin, @include, @extend, @media, etc.",
    example: "Unknown at-rule: @invalid",
    severity: "error",
    tags: ["at-rule", "syntax", "scss"],
  },

  // =========================================================================
  // SCSS Mixin/Function Errors (7 patterns)
  // =========================================================================
  {
    id: "scss-undefined-mixin",
    name: "Undefined mixin",
    category: "scss-mixin",
    pattern: /undefined.*mixin|mixin.*not.*defined|no.*mixin.*named/i,
    description: "The mixin has not been defined",
    fixTemplate: "Define the mixin with @mixin name { } or import the file containing it",
    example: "Undefined mixin: button-style",
    severity: "error",
    tags: ["mixin", "undefined", "scss"],
  },
  {
    id: "scss-mixin-arg-count",
    name: "Wrong mixin argument count",
    category: "scss-mixin",
    pattern: /wrong.*number.*argument|mixin.*expects.*(\d+).*argument|too.*(?:few|many).*argument/i,
    description: "Mixin called with wrong number of arguments",
    fixTemplate: "Check mixin signature and provide correct number of arguments",
    example: "Mixin 'gradient' expects 2 arguments, got 1",
    severity: "error",
    tags: ["mixin", "arguments", "scss"],
  },
  {
    id: "scss-undefined-function",
    name: "Undefined function",
    category: "scss-function",
    pattern: /undefined.*function|function.*not.*defined|no.*function.*named/i,
    description: "The SCSS function has not been defined",
    fixTemplate: "Define the function with @function name() { @return value; }",
    example: "Undefined function: custom-calc",
    severity: "error",
    tags: ["function", "undefined", "scss"],
  },
  {
    id: "scss-function-arg-count",
    name: "Wrong function argument count",
    category: "scss-function",
    pattern: /function.*wrong.*argument|function.*expects.*(\d+)|too.*(?:few|many).*arg.*function/i,
    description: "Function called with wrong number of arguments",
    fixTemplate: "Check function signature and provide correct arguments",
    example: "Function 'lighten' expects 2 arguments",
    severity: "error",
    tags: ["function", "arguments", "scss"],
  },
  {
    id: "scss-extend-not-found",
    name: "Extend target not found",
    category: "scss-mixin",
    pattern: /@extend.*not.*found|cannot.*extend|extend.*target.*missing/i,
    description: "The selector to extend was not found",
    fixTemplate: "Ensure the selector exists or use @extend %placeholder !optional",
    example: "@extend .missing-class - selector not found",
    severity: "error",
    tags: ["extend", "selector", "scss"],
  },
  {
    id: "scss-function-no-return",
    name: "Function missing return",
    category: "scss-function",
    pattern: /function.*no.*return|missing.*@return|function.*must.*return/i,
    description: "SCSS function must have a @return statement",
    fixTemplate: "Add @return value; to the function",
    example: "Function 'calc-size' must return a value",
    severity: "error",
    tags: ["function", "return", "scss"],
  },
  {
    id: "scss-import-not-found",
    name: "Import file not found",
    category: "scss-import",
    pattern: /@import.*not.*found|cannot.*find.*import|file.*to.*import.*not.*found/i,
    description: "The imported SCSS file was not found",
    fixTemplate: "Check the file path and ensure the file exists",
    example: "File to import not found: _variables.scss",
    severity: "error",
    tags: ["import", "file", "scss"],
  },

  // =========================================================================
  // Odoo-specific Errors (10 patterns)
  // =========================================================================
  {
    id: "odoo-field-not-found",
    name: "Field not found on model",
    category: "odoo-field",
    pattern: /field.*not.*found|no.*field.*(\w+).*model|model.*has.*no.*field/i,
    description: "The field does not exist on the Odoo model",
    fixTemplate: "Check field name spelling or ensure the field is defined on the model",
    example: "Field 'user_name' not found on model 'res.partner'",
    severity: "error",
    tags: ["odoo", "field", "model"],
  },
  {
    id: "odoo-model-not-found",
    name: "Model not found",
    category: "odoo-model",
    pattern: /model.*not.*found|unknown.*model|no.*model.*named/i,
    description: "The Odoo model does not exist",
    fixTemplate: "Check model name (format: module.model_name) or install the module",
    example: "Model 'custom.model' not found",
    severity: "error",
    tags: ["odoo", "model", "registry"],
  },
  {
    id: "odoo-view-not-found",
    name: "View not found",
    category: "odoo-view",
    pattern: /view.*not.*found|no.*view.*named|cannot.*find.*view/i,
    description: "The Odoo view does not exist",
    fixTemplate: "Check view XML ID or ensure the view is defined",
    example: "View 'website.custom_page' not found",
    severity: "error",
    tags: ["odoo", "view", "xml"],
  },
  {
    id: "odoo-inherit-not-found",
    name: "Inherit target not found",
    category: "odoo-view",
    pattern: /inherit.*not.*found|cannot.*inherit|parent.*view.*missing/i,
    description: "The view to inherit from was not found",
    fixTemplate: "Check t-inherit attribute value and ensure parent view exists",
    example: "Cannot inherit from 'website.layout' - view not found",
    severity: "error",
    tags: ["odoo", "inherit", "view"],
  },
  {
    id: "odoo-asset-not-found",
    name: "Asset bundle not found",
    category: "odoo-asset",
    pattern: /asset.*not.*found|bundle.*not.*found|no.*asset.*named/i,
    description: "The asset bundle does not exist",
    fixTemplate: "Check asset bundle name or define it in __manifest__.py",
    example: "Asset bundle 'web.assets_frontend' not found",
    severity: "error",
    tags: ["odoo", "asset", "bundle"],
  },
  {
    id: "odoo-xpath-invalid",
    name: "Invalid XPath expression",
    category: "odoo-view",
    pattern: /invalid.*xpath|xpath.*syntax|xpath.*expression.*error/i,
    description: "The XPath expression for view inheritance is invalid",
    fixTemplate: "Check XPath syntax: //element[@attr='value'], //element[position()]",
    example: "Invalid XPath: //div[@class='container'",
    severity: "error",
    tags: ["odoo", "xpath", "inherit"],
  },
  {
    id: "odoo-access-denied",
    name: "Access denied",
    category: "odoo-security",
    pattern: /access.*denied|permission.*denied|security.*restriction/i,
    description: "User does not have permission for this operation",
    fixTemplate: "Check ir.model.access.csv or ir.rule security rules",
    example: "Access Denied: res.partner",
    severity: "error",
    tags: ["odoo", "security", "access"],
  },
  {
    id: "odoo-record-not-found",
    name: "Record not found",
    category: "odoo-model",
    pattern: /record.*not.*found|no.*record.*id|missing.*record/i,
    description: "The database record does not exist",
    fixTemplate: "Check record ID or handle the MissingError exception",
    example: "Record res.partner(999,) not found",
    severity: "error",
    tags: ["odoo", "record", "database"],
  },
  {
    id: "odoo-constraint-error",
    name: "Constraint violation",
    category: "odoo-model",
    pattern: /constraint.*violation|unique.*constraint|check.*constraint.*failed/i,
    description: "Database constraint was violated",
    fixTemplate: "Check unique constraints and data validation rules",
    example: "Unique constraint violation on field 'email'",
    severity: "error",
    tags: ["odoo", "constraint", "database"],
  },
  {
    id: "odoo-website-page-404",
    name: "Website page not found",
    category: "odoo-view",
    pattern: /page.*not.*found|404.*website|website.*page.*missing/i,
    description: "The website page or route does not exist",
    fixTemplate: "Check URL route or create the page in Website Builder",
    example: "Page '/custom-page' not found (404)",
    severity: "error",
    tags: ["odoo", "website", "404", "route"],
  },
];

// =============================================================================
// ErrorPatternLibrary Class
// =============================================================================

/**
 * Library for matching errors against known patterns with fix suggestions.
 *
 * @example
 * ```typescript
 * const library = new ErrorPatternLibrary();
 *
 * const match = library.match("Undefined variable: $primary-color");
 * if (match) {
 *   console.log(match.pattern.name);        // "Undefined SCSS variable"
 *   console.log(match.suggestedFix);        // "Define the variable: $primary-color: value;"
 * }
 * ```
 */
export class ErrorPatternLibrary {
  private patterns: ErrorPattern[];

  constructor(patterns: ErrorPattern[] = ERROR_PATTERNS) {
    this.patterns = patterns;
  }

  /**
   * Find the best matching pattern for an error message.
   */
  match(errorMessage: string, options: PatternMatchOptions = {}): PatternMatch | null {
    const matches = this.matchAll(errorMessage, options);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Find all matching patterns for an error message.
   */
  matchAll(errorMessage: string, options: PatternMatchOptions = {}): PatternMatch[] {
    const {
      categories,
      tags,
      minConfidence = 0,
      maxMatches = 10,
    } = options;

    const matches: PatternMatch[] = [];

    for (const pattern of this.patterns) {
      // Filter by category
      if (categories && categories.length > 0 && !categories.includes(pattern.category)) {
        continue;
      }

      // Filter by tags
      if (tags && tags.length > 0 && !tags.some((t) => pattern.tags.includes(t))) {
        continue;
      }

      const regexMatch = errorMessage.match(pattern.pattern);
      if (regexMatch) {
        const captures = regexMatch.slice(1);
        const suggestedFix = this.generateFix(pattern.fixTemplate, captures);
        const confidence = this.calculateConfidence(pattern, regexMatch, errorMessage);

        if (confidence >= minConfidence) {
          matches.push({
            pattern,
            captures,
            suggestedFix,
            confidence,
          });
        }
      }
    }

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);

    return matches.slice(0, maxMatches);
  }

  /**
   * Get a pattern by ID.
   */
  getPattern(id: string): ErrorPattern | undefined {
    return this.patterns.find((p) => p.id === id);
  }

  /**
   * Get all patterns in a category.
   */
  getPatternsByCategory(category: ErrorCategory): ErrorPattern[] {
    return this.patterns.filter((p) => p.category === category);
  }

  /**
   * Get all patterns with a specific tag.
   */
  getPatternsByTag(tag: string): ErrorPattern[] {
    return this.patterns.filter((p) => p.tags.includes(tag));
  }

  /**
   * Get all available categories.
   */
  getCategories(): ErrorCategory[] {
    const categories = new Set<ErrorCategory>();
    for (const pattern of this.patterns) {
      categories.add(pattern.category);
    }
    return Array.from(categories);
  }

  /**
   * Get all available tags.
   */
  getTags(): string[] {
    const tags = new Set<string>();
    for (const pattern of this.patterns) {
      for (const tag of pattern.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }

  /**
   * Get total pattern count.
   */
  get count(): number {
    return this.patterns.length;
  }

  /**
   * Generate fix suggestion from template and captures.
   */
  private generateFix(template: string, captures: string[]): string {
    let fix = template;
    for (let i = 0; i < captures.length; i++) {
      if (captures[i]) {
        fix = fix.replace(new RegExp(`\\$${i + 1}`, "g"), captures[i]);
      }
    }
    return fix;
  }

  /**
   * Calculate confidence score for a match.
   */
  private calculateConfidence(
    pattern: ErrorPattern,
    match: RegExpMatchArray,
    errorMessage: string
  ): number {
    // Base confidence from pattern severity
    let confidence = pattern.severity === "error" ? 0.8 : pattern.severity === "warning" ? 0.6 : 0.4;

    // Boost for longer matches (more specific)
    const matchRatio = match[0].length / errorMessage.length;
    confidence += matchRatio * 0.15;

    // Boost for captured groups (more context)
    const captureCount = match.slice(1).filter(Boolean).length;
    confidence += Math.min(captureCount * 0.05, 0.15);

    return Math.min(confidence, 1.0);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an ErrorPatternLibrary instance.
 */
export function createErrorPatternLibrary(): ErrorPatternLibrary {
  return new ErrorPatternLibrary();
}

/**
 * Quick match against the default pattern library.
 */
export function matchErrorPattern(
  errorMessage: string,
  options?: PatternMatchOptions
): PatternMatch | null {
  const library = new ErrorPatternLibrary();
  return library.match(errorMessage, options);
}

/**
 * Find all matching patterns for an error.
 */
export function matchAllErrorPatterns(
  errorMessage: string,
  options?: PatternMatchOptions
): PatternMatch[] {
  const library = new ErrorPatternLibrary();
  return library.matchAll(errorMessage, options);
}

/**
 * Get pattern count in the library.
 */
export function getPatternCount(): number {
  return ERROR_PATTERNS.length;
}
