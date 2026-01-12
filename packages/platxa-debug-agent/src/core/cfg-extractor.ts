/**
 * Control Flow Graph Extractor
 *
 * Extracts control flow graphs from JavaScript/TypeScript code
 * using Tree-sitter AST parsing for debugging and analysis.
 *
 * @module core/cfg-extractor
 */

import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';

// =============================================================================
// Types - Basic Block (Feature #7-12)
// =============================================================================

/**
 * Basic Block in a Control Flow Graph
 *
 * Feature #7: Represents a sequence of statements with single entry/exit.
 * Used for fine-grained debugging and variable state tracking.
 */
export interface BasicBlock {
  /** Unique identifier for this block */
  id: string;
  /** Statements in this block (in execution order) */
  statements: BasicBlockStatement[];
  /** Variables and their values at block entry */
  entryVariables: Map<string, unknown>;
  /** Variables and their values at block exit */
  exitVariables: Map<string, unknown>;
  /** Block type (entry, exit, branch, loop, etc.) */
  type: BasicBlockType;
  /** Start line number in source code (1-based) */
  startLine: number;
  /** End line number in source code (1-based) */
  endLine: number;
  /** Predecessor block IDs */
  predecessors: string[];
  /** Successor block IDs */
  successors: string[];
  /** Condition for conditional blocks (if any) */
  condition?: string;
}

/**
 * Types of basic blocks
 */
export type BasicBlockType =
  | 'entry'       // Function/method entry point
  | 'exit'        // Function/method exit point
  | 'sequential'  // Sequential statements
  | 'branch'      // Conditional branch (if/switch)
  | 'loop_header' // Loop condition check
  | 'loop_body'   // Loop body
  | 'loop_exit'   // Loop exit
  | 'try'         // Try block start
  | 'catch'       // Catch block
  | 'finally'     // Finally block
  | 'throw';      // Exception throw

/**
 * Statement in a basic block
 */
export interface BasicBlockStatement {
  /** Line number in source code (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Original source code */
  code: string;
  /** Statement type */
  type: BasicBlockStatementType;
  /** Variables read by this statement */
  reads: string[];
  /** Variables written by this statement */
  writes: string[];
  /** Function calls made by this statement */
  calls: string[];
}

/**
 * Types of statements in basic blocks
 */
export type BasicBlockStatementType =
  | 'assignment'
  | 'declaration'
  | 'expression'
  | 'return'
  | 'break'
  | 'continue'
  | 'throw'
  | 'call'
  | 'import'
  | 'export'
  | 'other';

/**
 * Execution trace through basic blocks
 *
 * Feature #9: Tracks block execution order and variable snapshots
 */
export interface ExecutionTrace {
  /** Sequence of executed block IDs */
  blockSequence: string[];
  /** Variable snapshots at each step */
  variableSnapshots: VariableSnapshot[];
  /** Total execution time in milliseconds */
  executionTime: number;
  /** Whether execution completed successfully */
  completed: boolean;
  /** Error if execution failed */
  error?: TraceError;
}

/**
 * Variable snapshot at a point in execution
 */
export interface VariableSnapshot {
  /** Block ID where snapshot was taken */
  blockId: string;
  /** Statement index within block (0-based) */
  statementIndex: number;
  /** Variable values at this point */
  variables: Map<string, unknown>;
  /** Timestamp of snapshot */
  timestamp: number;
}

/**
 * Error encountered during tracing
 */
export interface TraceError {
  /** Error message */
  message: string;
  /** Error type */
  type: string;
  /** Block where error occurred */
  blockId: string;
  /** Statement index where error occurred */
  statementIndex: number;
  /** Stack trace */
  stackTrace?: string;
}

/**
 * Variable state diff between entry and exit
 *
 * Feature #12: Shows variable changes within a block
 */
export interface VariableStateDiff {
  /** Block ID */
  blockId: string;
  /** Variables that were added */
  added: Map<string, unknown>;
  /** Variables that were modified */
  modified: Map<string, { before: unknown; after: unknown }>;
  /** Variables that were removed */
  removed: Map<string, unknown>;
}

// =============================================================================
// Types - CFG Nodes and Edges
// =============================================================================

/**
 * Node in the control flow graph
 */
export interface CFGNode {
  /** Unique node identifier */
  id: string;
  /** Node type */
  type: CFGNodeType;
  /** Human-readable label */
  label: string;
  /** Source code snippet */
  code?: string;
  /** Source location */
  location?: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
  /** AST node type from parser */
  astType?: string;
}

/**
 * Types of CFG nodes
 */
export type CFGNodeType =
  | 'entry'
  | 'exit'
  | 'statement'
  | 'condition'
  | 'loop'
  | 'return'
  | 'throw'
  | 'try'
  | 'catch'
  | 'finally'
  | 'switch'
  | 'case'
  | 'break'
  | 'continue'
  | 'call'
  | 'await';

/**
 * Edge in the control flow graph
 */
export interface CFGEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Edge type */
  type: CFGEdgeType;
  /** Edge label (e.g., 'true', 'false', 'exception') */
  label?: string;
}

/**
 * Types of CFG edges
 */
export type CFGEdgeType =
  | 'sequential'
  | 'conditional_true'
  | 'conditional_false'
  | 'loop_back'
  | 'loop_exit'
  | 'exception'
  | 'return'
  | 'break'
  | 'continue';

/**
 * Complete control flow graph
 */
export interface ControlFlowGraph {
  /** Graph nodes */
  nodes: CFGNode[];
  /** Graph edges */
  edges: CFGEdge[];
  /** Entry node ID */
  entryId: string;
  /** Exit node IDs */
  exitIds: string[];
  /** Function/method name if applicable */
  name?: string;
  /** Language of the source code */
  language: 'javascript' | 'typescript';
}

/**
 * Options for CFG extraction
 */
export interface CFGExtractorOptions {
  /** Include function calls as separate nodes */
  includeCalls?: boolean;
  /** Include await expressions as separate nodes */
  includeAwaits?: boolean;
  /** Maximum code snippet length */
  maxCodeLength?: number;
  /** Language to parse */
  language?: 'javascript' | 'typescript';
}

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_OPTIONS: Required<CFGExtractorOptions> = {
  includeCalls: true,
  includeAwaits: true,
  maxCodeLength: 50,
  language: 'javascript',
};

// =============================================================================
// CFG Extractor Class
// =============================================================================

/**
 * Extracts control flow graphs from source code
 */
export class CFGExtractor {
  private parser: Parser;
  private options: Required<CFGExtractorOptions>;
  private nodeCounter: number = 0;
  private nodes: Map<string, CFGNode> = new Map();
  private edges: CFGEdge[] = [];
  private sourceCode: string = '';

  constructor(options: CFGExtractorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.parser = new Parser();

    if (this.options.language === 'typescript') {
      this.parser.setLanguage(TypeScript.typescript);
    } else {
      this.parser.setLanguage(JavaScript);
    }
  }

  /**
   * Extract control flow graph from source code
   */
  extract(code: string): ControlFlowGraph {
    this.reset();
    this.sourceCode = code;

    const tree = this.parser.parse(code);
    const rootNode = tree.rootNode;

    // Create entry node
    const entryId = this.createNode('entry', 'Entry', 'ENTRY');

    // Process the AST
    const exitIds = this.processNode(rootNode, entryId);

    // Create exit node if needed
    let finalExitIds = exitIds;
    if (exitIds.length === 0 || !exitIds.some((id) => this.nodes.get(id)?.type === 'exit')) {
      const exitId = this.createNode('exit', 'Exit', 'EXIT');
      for (const id of exitIds) {
        this.addEdge(id, exitId, 'sequential');
      }
      finalExitIds = [exitId];
    }

    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      entryId,
      exitIds: finalExitIds,
      language: this.options.language,
    };
  }

  /**
   * Extract CFG for a specific function
   */
  extractFunction(code: string, functionName: string): ControlFlowGraph | null {
    this.reset();
    this.sourceCode = code;

    const tree = this.parser.parse(code);
    const funcNode = this.findFunction(tree.rootNode, functionName);

    if (!funcNode) {
      return null;
    }

    const entryId = this.createNode('entry', `Entry: ${functionName}`, 'ENTRY');
    const bodyNode = funcNode.childForFieldName('body');

    if (!bodyNode) {
      const exitId = this.createNode('exit', 'Exit', 'EXIT');
      this.addEdge(entryId, exitId, 'sequential');
      return {
        nodes: Array.from(this.nodes.values()),
        edges: this.edges,
        entryId,
        exitIds: [exitId],
        name: functionName,
        language: this.options.language,
      };
    }

    const exitIds = this.processNode(bodyNode, entryId);
    const exitId = this.createNode('exit', 'Exit', 'EXIT');

    for (const id of exitIds) {
      const node = this.nodes.get(id);
      if (node && node.type !== 'return' && node.type !== 'throw') {
        this.addEdge(id, exitId, 'sequential');
      }
    }

    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      entryId,
      exitIds: [exitId],
      name: functionName,
      language: this.options.language,
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private reset(): void {
    this.nodeCounter = 0;
    this.nodes = new Map();
    this.edges = [];
    this.sourceCode = '';
  }

  private createNode(
    type: CFGNodeType,
    label: string,
    code?: string,
    astNode?: Parser.SyntaxNode
  ): string {
    const id = `n${this.nodeCounter++}`;
    const node: CFGNode = {
      id,
      type,
      label,
    };

    if (code) {
      node.code = this.truncateCode(code);
    }

    if (astNode) {
      node.location = {
        startLine: astNode.startPosition.row + 1,
        endLine: astNode.endPosition.row + 1,
        startColumn: astNode.startPosition.column + 1,
        endColumn: astNode.endPosition.column + 1,
      };
      node.astType = astNode.type;
    }

    this.nodes.set(id, node);
    return id;
  }

  private addEdge(from: string, to: string, type: CFGEdgeType, label?: string): void {
    const edge: CFGEdge = { from, to, type };
    if (label) {
      edge.label = label;
    }
    this.edges.push(edge);
  }

  private truncateCode(code: string): string {
    const singleLine = code.replace(/\s+/g, ' ').trim();
    if (singleLine.length <= this.options.maxCodeLength) {
      return singleLine;
    }
    return singleLine.substring(0, this.options.maxCodeLength - 3) + '...';
  }

  private getNodeCode(node: Parser.SyntaxNode): string {
    return this.sourceCode.substring(node.startIndex, node.endIndex);
  }

  private processNode(node: Parser.SyntaxNode, prevId: string): string[] {
    switch (node.type) {
      case 'program':
      case 'statement_block':
        return this.processBlock(node, prevId);

      case 'if_statement':
        return this.processIfStatement(node, prevId);

      case 'while_statement':
      case 'do_statement':
        return this.processWhileLoop(node, prevId);

      case 'for_statement':
      case 'for_in_statement':
        return this.processForLoop(node, prevId);

      case 'try_statement':
        return this.processTryStatement(node, prevId);

      case 'switch_statement':
        return this.processSwitchStatement(node, prevId);

      case 'return_statement':
        return this.processReturnStatement(node, prevId);

      case 'throw_statement':
        return this.processThrowStatement(node, prevId);

      case 'break_statement':
        return this.processBreakStatement(node, prevId);

      case 'continue_statement':
        return this.processContinueStatement(node, prevId);

      case 'expression_statement':
        return this.processExpressionStatement(node, prevId);

      case 'variable_declaration':
      case 'lexical_declaration':
        return this.processDeclaration(node, prevId);

      case 'function_declaration':
      case 'arrow_function':
      case 'function_expression':
        // Skip nested function definitions
        return [prevId];

      default:
        // For other nodes, create a generic statement node
        if (node.childCount > 0) {
          return this.processBlock(node, prevId);
        }
        return [prevId];
    }
  }

  private processBlock(node: Parser.SyntaxNode, prevId: string): string[] {
    let currentIds = [prevId];

    for (const child of node.children) {
      if (child.type === '{' || child.type === '}' || child.type === ';') {
        continue;
      }

      const newIds: string[] = [];
      for (const id of currentIds) {
        const resultIds = this.processNode(child, id);
        newIds.push(...resultIds);
      }
      currentIds = newIds;
    }

    return currentIds;
  }

  private processIfStatement(node: Parser.SyntaxNode, prevId: string): string[] {
    const conditionNode = node.childForFieldName('condition');
    const consequenceNode = node.childForFieldName('consequence');
    const alternativeNode = node.childForFieldName('alternative');

    const conditionCode = conditionNode ? this.getNodeCode(conditionNode) : 'condition';
    const conditionId = this.createNode('condition', `if (${conditionCode})`, conditionCode, node);
    this.addEdge(prevId, conditionId, 'sequential');

    const exitIds: string[] = [];

    // True branch
    if (consequenceNode) {
      const trueIds = this.processNode(consequenceNode, conditionId);
      this.addEdge(conditionId, trueIds[0] || conditionId, 'conditional_true', 'true');
      exitIds.push(...trueIds);
    } else {
      exitIds.push(conditionId);
    }

    // False branch
    if (alternativeNode) {
      // Handle else-if
      if (alternativeNode.type === 'else_clause') {
        const elseBody = alternativeNode.namedChildren[0];
        if (elseBody) {
          const falseIds = this.processNode(elseBody, conditionId);
          this.addEdge(conditionId, falseIds[0] || conditionId, 'conditional_false', 'false');
          exitIds.push(...falseIds);
        }
      } else {
        const falseIds = this.processNode(alternativeNode, conditionId);
        this.addEdge(conditionId, falseIds[0] || conditionId, 'conditional_false', 'false');
        exitIds.push(...falseIds);
      }
    } else {
      exitIds.push(conditionId);
    }

    return exitIds;
  }

  private processWhileLoop(node: Parser.SyntaxNode, prevId: string): string[] {
    const conditionNode = node.childForFieldName('condition');
    const bodyNode = node.childForFieldName('body');

    const conditionCode = conditionNode ? this.getNodeCode(conditionNode) : 'condition';
    const loopId = this.createNode('loop', `while (${conditionCode})`, conditionCode, node);
    this.addEdge(prevId, loopId, 'sequential');

    if (bodyNode) {
      const bodyIds = this.processNode(bodyNode, loopId);
      this.addEdge(loopId, bodyIds[0] || loopId, 'conditional_true', 'true');

      // Loop back edge
      for (const id of bodyIds) {
        this.addEdge(id, loopId, 'loop_back');
      }
    }

    // Exit edge (false condition)
    return [loopId];
  }

  private processForLoop(node: Parser.SyntaxNode, prevId: string): string[] {
    const initNode = node.childForFieldName('initializer');
    const conditionNode = node.childForFieldName('condition');
    const bodyNode = node.childForFieldName('body');

    let currentId = prevId;

    // Initializer
    if (initNode) {
      const initCode = this.getNodeCode(initNode);
      const initId = this.createNode('statement', `init: ${initCode}`, initCode, initNode);
      this.addEdge(currentId, initId, 'sequential');
      currentId = initId;
    }

    // Condition
    const conditionCode = conditionNode ? this.getNodeCode(conditionNode) : 'true';
    const loopId = this.createNode('loop', `for (${conditionCode})`, conditionCode, node);
    this.addEdge(currentId, loopId, 'sequential');

    // Body
    if (bodyNode) {
      const bodyIds = this.processNode(bodyNode, loopId);
      this.addEdge(loopId, bodyIds[0] || loopId, 'conditional_true', 'true');

      // Loop back
      for (const id of bodyIds) {
        this.addEdge(id, loopId, 'loop_back');
      }
    }

    return [loopId];
  }

  private processTryStatement(node: Parser.SyntaxNode, prevId: string): string[] {
    const bodyNode = node.childForFieldName('body');
    const handlerNode = node.childForFieldName('handler');
    const finalizerNode = node.childForFieldName('finalizer');

    const tryId = this.createNode('try', 'try', 'try', node);
    this.addEdge(prevId, tryId, 'sequential');

    const exitIds: string[] = [];

    // Try body
    if (bodyNode) {
      const bodyIds = this.processNode(bodyNode, tryId);
      exitIds.push(...bodyIds);
    }

    // Catch handler
    if (handlerNode) {
      const catchId = this.createNode('catch', 'catch', 'catch', handlerNode);
      this.addEdge(tryId, catchId, 'exception', 'exception');

      const catchBody = handlerNode.childForFieldName('body');
      if (catchBody) {
        const catchIds = this.processNode(catchBody, catchId);
        exitIds.push(...catchIds);
      } else {
        exitIds.push(catchId);
      }
    }

    // Finally
    if (finalizerNode) {
      const finallyId = this.createNode('finally', 'finally', 'finally', finalizerNode);

      // All paths go through finally
      for (const id of exitIds) {
        this.addEdge(id, finallyId, 'sequential');
      }

      const finallyBody = finalizerNode.namedChildren[0];
      if (finallyBody) {
        return this.processNode(finallyBody, finallyId);
      }
      return [finallyId];
    }

    return exitIds;
  }

  private processSwitchStatement(node: Parser.SyntaxNode, prevId: string): string[] {
    const valueNode = node.childForFieldName('value');
    const bodyNode = node.childForFieldName('body');

    const valueCode = valueNode ? this.getNodeCode(valueNode) : 'value';
    const switchId = this.createNode('switch', `switch (${valueCode})`, valueCode, node);
    this.addEdge(prevId, switchId, 'sequential');

    const exitIds: string[] = [];

    if (bodyNode) {
      for (const caseNode of bodyNode.namedChildren) {
        if (caseNode.type === 'switch_case' || caseNode.type === 'switch_default') {
          const caseLabel = caseNode.type === 'switch_default' ? 'default' : 'case';
          const caseId = this.createNode('case', caseLabel, caseLabel, caseNode);
          this.addEdge(switchId, caseId, 'sequential', caseLabel);

          let lastIds = [caseId];
          for (const child of caseNode.namedChildren) {
            if (child.type !== 'case') {
              const newIds: string[] = [];
              for (const id of lastIds) {
                newIds.push(...this.processNode(child, id));
              }
              lastIds = newIds;
            }
          }
          exitIds.push(...lastIds);
        }
      }
    }

    return exitIds.length > 0 ? exitIds : [switchId];
  }

  private processReturnStatement(node: Parser.SyntaxNode, prevId: string): string[] {
    const code = this.getNodeCode(node);
    const returnId = this.createNode('return', code, code, node);
    this.addEdge(prevId, returnId, 'sequential');

    // Find or create exit node and connect
    let exitNode = Array.from(this.nodes.values()).find((n) => n.type === 'exit');
    if (!exitNode) {
      const exitId = this.createNode('exit', 'Exit', 'EXIT');
      this.addEdge(returnId, exitId, 'return');
      return [exitId];
    }
    this.addEdge(returnId, exitNode.id, 'return');
    return [exitNode.id];
  }

  private processThrowStatement(node: Parser.SyntaxNode, prevId: string): string[] {
    const code = this.getNodeCode(node);
    const throwId = this.createNode('throw', code, code, node);
    this.addEdge(prevId, throwId, 'sequential');
    return [throwId];
  }

  private processBreakStatement(node: Parser.SyntaxNode, prevId: string): string[] {
    const breakId = this.createNode('break', 'break', 'break', node);
    this.addEdge(prevId, breakId, 'sequential');
    return [breakId];
  }

  private processContinueStatement(node: Parser.SyntaxNode, prevId: string): string[] {
    const continueId = this.createNode('continue', 'continue', 'continue', node);
    this.addEdge(prevId, continueId, 'sequential');
    return [continueId];
  }

  private processExpressionStatement(node: Parser.SyntaxNode, prevId: string): string[] {
    const expr = node.namedChildren[0];
    if (!expr) return [prevId];

    // Check for await expressions
    if (this.options.includeAwaits && expr.type === 'await_expression') {
      const code = this.getNodeCode(expr);
      const awaitId = this.createNode('await', code, code, expr);
      this.addEdge(prevId, awaitId, 'sequential');
      return [awaitId];
    }

    // Check for function calls
    if (this.options.includeCalls && expr.type === 'call_expression') {
      const code = this.getNodeCode(expr);
      const callId = this.createNode('call', code, code, expr);
      this.addEdge(prevId, callId, 'sequential');
      return [callId];
    }

    const code = this.getNodeCode(node);
    const stmtId = this.createNode('statement', code, code, node);
    this.addEdge(prevId, stmtId, 'sequential');
    return [stmtId];
  }

  private processDeclaration(node: Parser.SyntaxNode, prevId: string): string[] {
    const code = this.getNodeCode(node);
    const declId = this.createNode('statement', code, code, node);
    this.addEdge(prevId, declId, 'sequential');
    return [declId];
  }

  private findFunction(
    node: Parser.SyntaxNode,
    name: string
  ): Parser.SyntaxNode | null {
    if (
      node.type === 'function_declaration' ||
      node.type === 'method_definition'
    ) {
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
// CFG Visualizer Class
// =============================================================================

/**
 * Visualizes control flow graphs as Mermaid diagrams
 */
export class CFGVisualizer {
  /**
   * Generate a Mermaid diagram from a CFG
   */
  toMermaid(cfg: ControlFlowGraph): string {
    const lines: string[] = [];
    lines.push('flowchart TD');

    // Add nodes
    for (const node of cfg.nodes) {
      const shape = this.getNodeShape(node.type);
      const label = this.escapeLabel(node.label);
      lines.push(`    ${node.id}${shape.open}"${label}"${shape.close}`);
    }

    // Add edges
    for (const edge of cfg.edges) {
      const arrow = this.getEdgeArrow(edge.type);
      if (edge.label) {
        lines.push(`    ${edge.from} ${arrow}|${edge.label}| ${edge.to}`);
      } else {
        lines.push(`    ${edge.from} ${arrow} ${edge.to}`);
      }
    }

    // Style nodes
    lines.push('');
    lines.push('    classDef entry fill:#90EE90,stroke:#228B22');
    lines.push('    classDef exit fill:#FFB6C1,stroke:#DC143C');
    lines.push('    classDef condition fill:#87CEEB,stroke:#4169E1');
    lines.push('    classDef loop fill:#DDA0DD,stroke:#8B008B');
    lines.push('    classDef error fill:#FFA07A,stroke:#FF4500');

    const entryNodes = cfg.nodes.filter((n) => n.type === 'entry').map((n) => n.id);
    const exitNodes = cfg.nodes.filter((n) => n.type === 'exit').map((n) => n.id);
    const conditionNodes = cfg.nodes.filter((n) => n.type === 'condition').map((n) => n.id);
    const loopNodes = cfg.nodes.filter((n) => n.type === 'loop').map((n) => n.id);
    const errorNodes = cfg.nodes.filter((n) => n.type === 'throw' || n.type === 'catch').map((n) => n.id);

    if (entryNodes.length > 0) lines.push(`    class ${entryNodes.join(',')} entry`);
    if (exitNodes.length > 0) lines.push(`    class ${exitNodes.join(',')} exit`);
    if (conditionNodes.length > 0) lines.push(`    class ${conditionNodes.join(',')} condition`);
    if (loopNodes.length > 0) lines.push(`    class ${loopNodes.join(',')} loop`);
    if (errorNodes.length > 0) lines.push(`    class ${errorNodes.join(',')} error`);

    return lines.join('\n');
  }

  /**
   * Generate DOT format for Graphviz
   */
  toDot(cfg: ControlFlowGraph): string {
    const lines: string[] = [];
    lines.push('digraph CFG {');
    lines.push('    rankdir=TB;');
    lines.push('    node [fontname="Arial", fontsize=10];');
    lines.push('    edge [fontname="Arial", fontsize=9];');

    // Add nodes
    for (const node of cfg.nodes) {
      const shape = this.getDotShape(node.type);
      const color = this.getDotColor(node.type);
      const label = this.escapeLabel(node.label);
      lines.push(`    ${node.id} [label="${label}", shape=${shape}, style=filled, fillcolor="${color}"];`);
    }

    // Add edges
    for (const edge of cfg.edges) {
      const style = this.getDotEdgeStyle(edge.type);
      const label = edge.label ? `, label="${edge.label}"` : '';
      lines.push(`    ${edge.from} -> ${edge.to} [${style}${label}];`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  private getNodeShape(type: CFGNodeType): { open: string; close: string } {
    switch (type) {
      case 'entry':
      case 'exit':
        return { open: '([', close: '])' }; // Stadium shape
      case 'condition':
      case 'switch':
        return { open: '{', close: '}' }; // Diamond
      case 'loop':
        return { open: '{{', close: '}}' }; // Hexagon
      case 'try':
      case 'catch':
      case 'finally':
        return { open: '[/', close: '/]' }; // Parallelogram
      default:
        return { open: '[', close: ']' }; // Rectangle
    }
  }

  private getEdgeArrow(type: CFGEdgeType): string {
    switch (type) {
      case 'conditional_true':
      case 'conditional_false':
        return '-->';
      case 'loop_back':
        return '-..->';
      case 'exception':
        return '==>';
      default:
        return '-->';
    }
  }

  private getDotShape(type: CFGNodeType): string {
    switch (type) {
      case 'entry':
      case 'exit':
        return 'ellipse';
      case 'condition':
      case 'switch':
        return 'diamond';
      case 'loop':
        return 'hexagon';
      default:
        return 'box';
    }
  }

  private getDotColor(type: CFGNodeType): string {
    switch (type) {
      case 'entry':
        return '#90EE90';
      case 'exit':
        return '#FFB6C1';
      case 'condition':
        return '#87CEEB';
      case 'loop':
        return '#DDA0DD';
      case 'throw':
      case 'catch':
        return '#FFA07A';
      default:
        return '#FFFFFF';
    }
  }

  private getDotEdgeStyle(type: CFGEdgeType): string {
    switch (type) {
      case 'loop_back':
        return 'style=dashed';
      case 'exception':
        return 'style=bold, color=red';
      default:
        return '';
    }
  }

  private escapeLabel(label: string): string {
    return label
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new CFGExtractor instance
 */
export function createCFGExtractor(options?: CFGExtractorOptions): CFGExtractor {
  return new CFGExtractor(options);
}

/**
 * Create a new CFGVisualizer instance
 */
export function createCFGVisualizer(): CFGVisualizer {
  return new CFGVisualizer();
}

// =============================================================================
// Default Instances
// =============================================================================

/** Default extractor instance */
export const cfgExtractor = new CFGExtractor();

/** Default visualizer instance */
export const cfgVisualizer = new CFGVisualizer();
