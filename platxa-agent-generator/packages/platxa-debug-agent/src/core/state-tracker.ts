/**
 * Variable State Tracker
 *
 * Simulates code execution and tracks variable values at each statement
 * for debugging and analysis purposes.
 *
 * @module core/state-tracker
 */

import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';

// =============================================================================
// Types
// =============================================================================

/**
 * Value types that can be tracked
 */
export type TrackedValue =
  | { type: 'undefined' }
  | { type: 'null' }
  | { type: 'boolean'; value: boolean }
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'array'; value: TrackedValue[]; length: number }
  | { type: 'object'; properties: Record<string, TrackedValue> }
  | { type: 'function'; name: string }
  | { type: 'unknown'; description: string };

/**
 * Variable state at a specific point
 */
export interface VariableState {
  /** Variable name */
  name: string;
  /** Current value */
  value: TrackedValue;
  /** Scope where defined */
  scope: string;
  /** Declaration type (var, let, const, param) */
  declarationType: 'var' | 'let' | 'const' | 'param' | 'implicit';
}

/**
 * Execution step with state snapshot
 */
export interface ExecutionStep {
  /** Step number (1-based) */
  step: number;
  /** Statement type */
  statementType: string;
  /** Source code of the statement */
  code: string;
  /** Source location */
  location: {
    line: number;
    column: number;
  };
  /** Variables state after this step */
  variables: VariableState[];
  /** Changes made in this step */
  changes: VariableChange[];
  /** Any output produced */
  output?: string;
  /** Condition result if applicable */
  conditionResult?: boolean;
}

/**
 * Change to a variable
 */
export interface VariableChange {
  /** Variable name */
  name: string;
  /** Previous value */
  previousValue: TrackedValue;
  /** New value */
  newValue: TrackedValue;
  /** Type of change */
  changeType: 'declaration' | 'assignment' | 'mutation';
}

/**
 * Simulation result
 */
export interface SimulationResult {
  /** Execution steps */
  steps: ExecutionStep[];
  /** Final variable state */
  finalState: VariableState[];
  /** Total steps executed */
  totalSteps: number;
  /** Whether simulation completed normally */
  completed: boolean;
  /** Error if simulation failed */
  error?: string;
  /** Return value if any */
  returnValue?: TrackedValue;
}

/**
 * Simulation options
 */
export interface StateTrackerOptions {
  /** Maximum steps to execute (prevent infinite loops) */
  maxSteps?: number;
  /** Language to parse */
  language?: 'javascript' | 'typescript';
  /** Track function calls */
  trackCalls?: boolean;
  /** Include built-in globals */
  includeGlobals?: boolean;
}

/**
 * Input values for simulation
 */
export type SimulationInputs = Record<string, unknown>;

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_OPTIONS: Required<StateTrackerOptions> = {
  maxSteps: 1000,
  language: 'javascript',
  trackCalls: true,
  includeGlobals: false,
};

// =============================================================================
// State Tracker Class
// =============================================================================

/**
 * Tracks variable state during simulated code execution
 */
export class StateTracker {
  private parser: Parser;
  private options: Required<StateTrackerOptions>;
  private variables: Map<string, VariableState> = new Map();
  private steps: ExecutionStep[] = [];
  private stepCounter: number = 0;
  private sourceCode: string = '';
  private currentScope: string = 'global';
  private scopeStack: string[] = ['global'];

  constructor(options: StateTrackerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.parser = new Parser();

    if (this.options.language === 'typescript') {
      this.parser.setLanguage(TypeScript.typescript);
    } else {
      this.parser.setLanguage(JavaScript);
    }
  }

  /**
   * Simulate code execution and track variable state
   */
  simulate(code: string, inputs: SimulationInputs = {}): SimulationResult {
    this.reset();
    this.sourceCode = code;

    // Initialize input variables
    for (const [name, value] of Object.entries(inputs)) {
      this.setVariable(name, this.valueToTracked(value), 'param');
    }

    const tree = this.parser.parse(code);

    try {
      this.executeNode(tree.rootNode);

      return {
        steps: this.steps,
        finalState: Array.from(this.variables.values()),
        totalSteps: this.stepCounter,
        completed: true,
      };
    } catch (error) {
      return {
        steps: this.steps,
        finalState: Array.from(this.variables.values()),
        totalSteps: this.stepCounter,
        completed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Simulate a specific function with given arguments
   */
  simulateFunction(
    code: string,
    functionName: string,
    args: unknown[] = []
  ): SimulationResult {
    this.reset();
    this.sourceCode = code;

    const tree = this.parser.parse(code);
    const funcNode = this.findFunction(tree.rootNode, functionName);

    if (!funcNode) {
      return {
        steps: [],
        finalState: [],
        totalSteps: 0,
        completed: false,
        error: `Function '${functionName}' not found`,
      };
    }

    // Get parameter names
    const paramsNode = funcNode.childForFieldName('parameters');
    const paramNames: string[] = [];
    if (paramsNode) {
      for (const param of paramsNode.namedChildren) {
        if (param.type === 'identifier') {
          paramNames.push(param.text);
        } else if (param.type === 'assignment_pattern') {
          const left = param.childForFieldName('left');
          if (left) {
            paramNames.push(left.text);
          }
        }
      }
    }

    // Initialize parameters
    this.enterScope(functionName);
    for (let i = 0; i < paramNames.length; i++) {
      const paramName = paramNames[i];
      if (paramName) {
        const value = i < args.length ? args[i] : undefined;
        this.setVariable(paramName, this.valueToTracked(value), 'param');
      }
    }

    const bodyNode = funcNode.childForFieldName('body');

    try {
      let returnValue: TrackedValue | undefined;
      if (bodyNode) {
        returnValue = this.executeNode(bodyNode);
      }

      this.exitScope();

      const result: SimulationResult = {
        steps: this.steps,
        finalState: Array.from(this.variables.values()),
        totalSteps: this.stepCounter,
        completed: true,
      };

      if (returnValue) {
        result.returnValue = returnValue;
      }

      return result;
    } catch (error) {
      this.exitScope();

      return {
        steps: this.steps,
        finalState: Array.from(this.variables.values()),
        totalSteps: this.stepCounter,
        completed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get state at a specific line
   */
  getStateAtLine(line: number): VariableState[] {
    // Find the last step at or before this line
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const step = this.steps[i];
      if (step && step.location.line <= line) {
        return step.variables;
      }
    }
    return [];
  }

  /**
   * Get variable history through execution
   */
  getVariableHistory(name: string): Array<{ step: number; value: TrackedValue }> {
    const history: Array<{ step: number; value: TrackedValue }> = [];

    for (const step of this.steps) {
      const variable = step.variables.find((v) => v.name === name);
      if (variable) {
        const lastEntry = history[history.length - 1];
        if (!lastEntry || !this.valuesEqual(lastEntry.value, variable.value)) {
          history.push({ step: step.step, value: variable.value });
        }
      }
    }

    return history;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private reset(): void {
    this.variables = new Map();
    this.steps = [];
    this.stepCounter = 0;
    this.sourceCode = '';
    this.currentScope = 'global';
    this.scopeStack = ['global'];
  }

  private enterScope(name: string): void {
    this.currentScope = `${this.currentScope}.${name}`;
    this.scopeStack.push(this.currentScope);
  }

  private exitScope(): void {
    // Remove variables from current scope
    const currentPrefix = this.currentScope + '.';
    for (const [key, state] of this.variables) {
      if (state.scope === this.currentScope || state.scope.startsWith(currentPrefix)) {
        this.variables.delete(key);
      }
    }

    this.scopeStack.pop();
    this.currentScope = this.scopeStack[this.scopeStack.length - 1] || 'global';
  }

  private setVariable(
    name: string,
    value: TrackedValue,
    declarationType: VariableState['declarationType']
  ): VariableChange | undefined {
    const existing = this.variables.get(name);
    const previousValue = existing?.value ?? { type: 'undefined' };

    const state: VariableState = {
      name,
      value,
      scope: this.currentScope,
      declarationType: existing?.declarationType ?? declarationType,
    };

    this.variables.set(name, state);

    if (existing) {
      return {
        name,
        previousValue,
        newValue: value,
        changeType: 'assignment',
      };
    } else {
      return {
        name,
        previousValue: { type: 'undefined' },
        newValue: value,
        changeType: 'declaration',
      };
    }
  }

  private getVariable(name: string): TrackedValue {
    const state = this.variables.get(name);
    return state?.value ?? { type: 'undefined' };
  }

  private recordStep(
    node: Parser.SyntaxNode,
    changes: VariableChange[],
    output?: string,
    conditionResult?: boolean
  ): void {
    if (this.stepCounter >= this.options.maxSteps) {
      throw new Error(`Maximum steps (${this.options.maxSteps}) exceeded`);
    }

    this.stepCounter++;

    const step: ExecutionStep = {
      step: this.stepCounter,
      statementType: node.type,
      code: this.getNodeCode(node),
      location: {
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
      },
      variables: Array.from(this.variables.values()).map((v) => ({ ...v })),
      changes,
    };

    if (output !== undefined) {
      step.output = output;
    }

    if (conditionResult !== undefined) {
      step.conditionResult = conditionResult;
    }

    this.steps.push(step);
  }

  private getNodeCode(node: Parser.SyntaxNode): string {
    const code = this.sourceCode.substring(node.startIndex, node.endIndex);
    const singleLine = code.replace(/\s+/g, ' ').trim();
    return singleLine.length > 80 ? singleLine.substring(0, 77) + '...' : singleLine;
  }

  private executeNode(node: Parser.SyntaxNode): TrackedValue | undefined {
    switch (node.type) {
      case 'program':
      case 'statement_block':
        return this.executeBlock(node);

      case 'variable_declaration':
      case 'lexical_declaration':
        return this.executeDeclaration(node);

      case 'expression_statement':
        return this.executeExpressionStatement(node);

      case 'if_statement':
        return this.executeIfStatement(node);

      case 'while_statement':
        return this.executeWhileStatement(node);

      case 'for_statement':
        return this.executeForStatement(node);

      case 'return_statement':
        return this.executeReturnStatement(node);

      case 'function_declaration':
        return this.executeFunctionDeclaration(node);

      default:
        return undefined;
    }
  }

  private executeBlock(node: Parser.SyntaxNode): TrackedValue | undefined {
    for (const child of node.namedChildren) {
      const result = this.executeNode(child);
      // Check for early return
      if (child.type === 'return_statement') {
        return result;
      }
    }
    return undefined;
  }

  private executeDeclaration(node: Parser.SyntaxNode): undefined {
    const kind = node.children[0]?.text as 'var' | 'let' | 'const';
    const changes: VariableChange[] = [];

    for (const declarator of node.namedChildren) {
      if (declarator.type === 'variable_declarator') {
        const nameNode = declarator.childForFieldName('name');
        const valueNode = declarator.childForFieldName('value');

        if (nameNode) {
          const name = nameNode.text;
          const value = valueNode
            ? this.evaluateExpression(valueNode)
            : { type: 'undefined' as const };

          const change = this.setVariable(name, value, kind);
          if (change) changes.push(change);
        }
      }
    }

    this.recordStep(node, changes);
    return undefined;
  }

  private executeExpressionStatement(node: Parser.SyntaxNode): undefined {
    const expr = node.namedChildren[0];
    if (!expr) return undefined;

    const changes: VariableChange[] = [];
    let output: string | undefined;

    if (expr.type === 'assignment_expression') {
      const left = expr.childForFieldName('left');
      const right = expr.childForFieldName('right');

      if (left && right && left.type === 'identifier') {
        const name = left.text;
        const value = this.evaluateExpression(right);
        const change = this.setVariable(name, value, 'implicit');
        if (change) changes.push(change);
      }
    } else if (expr.type === 'update_expression') {
      const arg = expr.namedChildren[0];
      if (arg && arg.type === 'identifier') {
        const name = arg.text;
        const currentValue = this.getVariable(name);
        const operator = expr.text.includes('++') ? '++' : '--';

        if (currentValue.type === 'number') {
          const newValue: TrackedValue = {
            type: 'number',
            value: operator === '++' ? currentValue.value + 1 : currentValue.value - 1,
          };
          const change = this.setVariable(name, newValue, 'implicit');
          if (change) changes.push(change);
        }
      }
    } else if (expr.type === 'call_expression') {
      const funcNode = expr.childForFieldName('function');
      if (funcNode) {
        const funcText = funcNode.text;
        if (funcText === 'console.log' || funcText.endsWith('.log')) {
          const argsNode = expr.childForFieldName('arguments');
          if (argsNode) {
            const args = argsNode.namedChildren.map((a) => this.evaluateExpression(a));
            output = args.map((a) => this.trackedToString(a)).join(' ');
          }
        }
      }
    }

    this.recordStep(node, changes, output);
    return undefined;
  }

  private executeIfStatement(node: Parser.SyntaxNode): TrackedValue | undefined {
    const conditionNode = node.childForFieldName('condition');
    const consequenceNode = node.childForFieldName('consequence');
    const alternativeNode = node.childForFieldName('alternative');

    const conditionValue = conditionNode
      ? this.evaluateExpression(conditionNode)
      : { type: 'undefined' as const };

    const conditionResult = this.isTruthy(conditionValue);
    this.recordStep(node, [], undefined, conditionResult);

    if (conditionResult) {
      if (consequenceNode) {
        return this.executeNode(consequenceNode);
      }
    } else {
      if (alternativeNode) {
        // Handle else-if and else
        if (alternativeNode.type === 'else_clause') {
          const elseBody = alternativeNode.namedChildren[0];
          if (elseBody) {
            return this.executeNode(elseBody);
          }
        } else {
          return this.executeNode(alternativeNode);
        }
      }
    }

    return undefined;
  }

  private executeWhileStatement(node: Parser.SyntaxNode): undefined {
    const conditionNode = node.childForFieldName('condition');
    const bodyNode = node.childForFieldName('body');

    let iterations = 0;
    const maxIterations = Math.min(100, this.options.maxSteps - this.stepCounter);

    while (iterations < maxIterations) {
      const conditionValue = conditionNode
        ? this.evaluateExpression(conditionNode)
        : { type: 'undefined' as const };

      const conditionResult = this.isTruthy(conditionValue);
      this.recordStep(node, [], undefined, conditionResult);

      if (!conditionResult) break;

      if (bodyNode) {
        this.executeNode(bodyNode);
      }

      iterations++;
    }

    return undefined;
  }

  private executeForStatement(node: Parser.SyntaxNode): undefined {
    const initNode = node.childForFieldName('initializer');
    const conditionNode = node.childForFieldName('condition');
    const updateNode = node.childForFieldName('increment');
    const bodyNode = node.childForFieldName('body');

    // Execute initializer
    if (initNode) {
      this.executeNode(initNode);
    }

    let iterations = 0;
    const maxIterations = Math.min(100, this.options.maxSteps - this.stepCounter);

    while (iterations < maxIterations) {
      // Check condition
      const conditionValue = conditionNode
        ? this.evaluateExpression(conditionNode)
        : { type: 'boolean' as const, value: true };

      const conditionResult = this.isTruthy(conditionValue);
      this.recordStep(node, [], undefined, conditionResult);

      if (!conditionResult) break;

      // Execute body
      if (bodyNode) {
        this.executeNode(bodyNode);
      }

      // Execute update
      if (updateNode) {
        this.evaluateExpression(updateNode);
        // Record update changes
        const updateChanges: VariableChange[] = [];
        if (updateNode.type === 'update_expression') {
          const arg = updateNode.namedChildren[0];
          if (arg && arg.type === 'identifier') {
            const name = arg.text;
            const currentValue = this.getVariable(name);
            const operator = updateNode.text.includes('++') ? '++' : '--';

            if (currentValue.type === 'number') {
              const newValue: TrackedValue = {
                type: 'number',
                value: operator === '++' ? currentValue.value + 1 : currentValue.value - 1,
              };
              const change = this.setVariable(name, newValue, 'implicit');
              if (change) updateChanges.push(change);
            }
          }
        }
        if (updateChanges.length > 0) {
          this.recordStep(updateNode, updateChanges);
        }
      }

      iterations++;
    }

    return undefined;
  }

  private executeReturnStatement(node: Parser.SyntaxNode): TrackedValue {
    const valueNode = node.namedChildren[0];
    const value = valueNode
      ? this.evaluateExpression(valueNode)
      : { type: 'undefined' as const };

    this.recordStep(node, []);
    return value;
  }

  private executeFunctionDeclaration(node: Parser.SyntaxNode): undefined {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      const name = nameNode.text;
      this.setVariable(name, { type: 'function', name }, 'const');
    }
    // Don't execute function body until called
    return undefined;
  }

  private evaluateExpression(node: Parser.SyntaxNode): TrackedValue {
    switch (node.type) {
      case 'number':
        return { type: 'number', value: parseFloat(node.text) };

      case 'string':
      case 'template_string':
        // Remove quotes
        const str = node.text.slice(1, -1);
        return { type: 'string', value: str };

      case 'true':
        return { type: 'boolean', value: true };

      case 'false':
        return { type: 'boolean', value: false };

      case 'null':
        return { type: 'null' };

      case 'undefined':
        return { type: 'undefined' };

      case 'identifier':
        return this.getVariable(node.text);

      case 'array':
        const elements = node.namedChildren.map((c) => this.evaluateExpression(c));
        return { type: 'array', value: elements, length: elements.length };

      case 'object':
        const properties: Record<string, TrackedValue> = {};
        for (const prop of node.namedChildren) {
          if (prop.type === 'pair') {
            const keyNode = prop.childForFieldName('key');
            const valueNode = prop.childForFieldName('value');
            if (keyNode && valueNode) {
              const key = keyNode.text.replace(/['"]/g, '');
              properties[key] = this.evaluateExpression(valueNode);
            }
          }
        }
        return { type: 'object', properties };

      case 'binary_expression':
        return this.evaluateBinaryExpression(node);

      case 'unary_expression':
        return this.evaluateUnaryExpression(node);

      case 'parenthesized_expression':
        const inner = node.namedChildren[0];
        return inner ? this.evaluateExpression(inner) : { type: 'undefined' };

      case 'assignment_expression':
        const assignRight = node.childForFieldName('right');
        return assignRight ? this.evaluateExpression(assignRight) : { type: 'undefined' };

      case 'update_expression':
        const updateArg = node.namedChildren[0];
        if (updateArg && updateArg.type === 'identifier') {
          return this.getVariable(updateArg.text);
        }
        return { type: 'undefined' };

      case 'call_expression':
        return { type: 'unknown', description: `call: ${node.text}` };

      case 'member_expression':
        const obj = node.childForFieldName('object');
        const prop = node.childForFieldName('property');
        if (obj && prop) {
          const objValue = this.evaluateExpression(obj);
          if (objValue.type === 'object' && prop.type === 'property_identifier') {
            return objValue.properties[prop.text] ?? { type: 'undefined' };
          }
          if (objValue.type === 'array' && prop.type === 'number') {
            const idx = parseInt(prop.text);
            return objValue.value[idx] ?? { type: 'undefined' };
          }
        }
        return { type: 'unknown', description: `member: ${node.text}` };

      default:
        return { type: 'unknown', description: node.type };
    }
  }

  private evaluateBinaryExpression(node: Parser.SyntaxNode): TrackedValue {
    const leftNode = node.childForFieldName('left');
    const rightNode = node.childForFieldName('right');
    const operatorNode = node.children.find((c) => !c.isNamed);

    if (!leftNode || !rightNode || !operatorNode) {
      return { type: 'unknown', description: 'invalid binary' };
    }

    const left = this.evaluateExpression(leftNode);
    const right = this.evaluateExpression(rightNode);
    const op = operatorNode.text;

    // Arithmetic operations
    if (left.type === 'number' && right.type === 'number') {
      switch (op) {
        case '+':
          return { type: 'number', value: left.value + right.value };
        case '-':
          return { type: 'number', value: left.value - right.value };
        case '*':
          return { type: 'number', value: left.value * right.value };
        case '/':
          return { type: 'number', value: left.value / right.value };
        case '%':
          return { type: 'number', value: left.value % right.value };
        case '<':
          return { type: 'boolean', value: left.value < right.value };
        case '>':
          return { type: 'boolean', value: left.value > right.value };
        case '<=':
          return { type: 'boolean', value: left.value <= right.value };
        case '>=':
          return { type: 'boolean', value: left.value >= right.value };
        case '==':
        case '===':
          return { type: 'boolean', value: left.value === right.value };
        case '!=':
        case '!==':
          return { type: 'boolean', value: left.value !== right.value };
      }
    }

    // String concatenation
    if (op === '+' && (left.type === 'string' || right.type === 'string')) {
      const leftStr = this.trackedToString(left);
      const rightStr = this.trackedToString(right);
      return { type: 'string', value: leftStr + rightStr };
    }

    // Boolean operations
    if (op === '&&') {
      return this.isTruthy(left) ? right : left;
    }
    if (op === '||') {
      return this.isTruthy(left) ? left : right;
    }

    return { type: 'unknown', description: `${op} operation` };
  }

  private evaluateUnaryExpression(node: Parser.SyntaxNode): TrackedValue {
    const operatorNode = node.children.find((c) => !c.isNamed);
    const argNode = node.namedChildren[0];

    if (!operatorNode || !argNode) {
      return { type: 'unknown', description: 'invalid unary' };
    }

    const arg = this.evaluateExpression(argNode);
    const op = operatorNode.text;

    switch (op) {
      case '!':
        return { type: 'boolean', value: !this.isTruthy(arg) };
      case '-':
        if (arg.type === 'number') {
          return { type: 'number', value: -arg.value };
        }
        break;
      case '+':
        if (arg.type === 'number') {
          return arg;
        }
        break;
      case 'typeof':
        return { type: 'string', value: arg.type };
    }

    return { type: 'unknown', description: `${op} operation` };
  }

  private isTruthy(value: TrackedValue): boolean {
    switch (value.type) {
      case 'undefined':
      case 'null':
        return false;
      case 'boolean':
        return value.value;
      case 'number':
        return value.value !== 0 && !isNaN(value.value);
      case 'string':
        return value.value.length > 0;
      case 'array':
      case 'object':
      case 'function':
        return true;
      case 'unknown':
        return true; // Assume truthy for unknown
    }
  }

  private valuesEqual(a: TrackedValue, b: TrackedValue): boolean {
    if (a.type !== b.type) return false;

    switch (a.type) {
      case 'undefined':
      case 'null':
        return true;
      case 'boolean':
      case 'number':
      case 'string':
        return a.value === (b as typeof a).value;
      default:
        return false;
    }
  }

  private valueToTracked(value: unknown): TrackedValue {
    if (value === undefined) return { type: 'undefined' };
    if (value === null) return { type: 'null' };
    if (typeof value === 'boolean') return { type: 'boolean', value };
    if (typeof value === 'number') return { type: 'number', value };
    if (typeof value === 'string') return { type: 'string', value };
    if (Array.isArray(value)) {
      const items = value.map((v) => this.valueToTracked(v));
      return { type: 'array', value: items, length: items.length };
    }
    if (typeof value === 'object') {
      const props: Record<string, TrackedValue> = {};
      for (const [k, v] of Object.entries(value)) {
        props[k] = this.valueToTracked(v);
      }
      return { type: 'object', properties: props };
    }
    if (typeof value === 'function') {
      return { type: 'function', name: value.name || 'anonymous' };
    }
    return { type: 'unknown', description: String(value) };
  }

  private trackedToString(value: TrackedValue): string {
    switch (value.type) {
      case 'undefined':
        return 'undefined';
      case 'null':
        return 'null';
      case 'boolean':
        return String(value.value);
      case 'number':
        return String(value.value);
      case 'string':
        return value.value;
      case 'array':
        return `[${value.value.map((v) => this.trackedToString(v)).join(', ')}]`;
      case 'object':
        const pairs = Object.entries(value.properties)
          .map(([k, v]) => `${k}: ${this.trackedToString(v)}`)
          .join(', ');
        return `{ ${pairs} }`;
      case 'function':
        return `[Function: ${value.name}]`;
      case 'unknown':
        return `[unknown: ${value.description}]`;
    }
  }

  private findFunction(
    node: Parser.SyntaxNode,
    name: string
  ): Parser.SyntaxNode | null {
    if (node.type === 'function_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode && nameNode.text === name) {
        return node;
      }
    }

    for (const child of node.children) {
      const found = this.findFunction(child, name);
      if (found) return found;
    }

    return null;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new StateTracker instance
 */
export function createStateTracker(options?: StateTrackerOptions): StateTracker {
  return new StateTracker(options);
}

// =============================================================================
// Default Instance
// =============================================================================

/** Default tracker instance */
export const stateTracker = new StateTracker();
