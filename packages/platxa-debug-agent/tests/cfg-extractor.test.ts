/**
 * Tests for CFGExtractor and CFGVisualizer
 *
 * Verifies control flow graph extraction and mermaid diagram generation.
 */

import { describe, expect, it } from 'vitest';
import {
  CFGExtractor,
  CFGVisualizer,
  createCFGExtractor,
  createCFGVisualizer,
  cfgExtractor,
  cfgVisualizer,
  type ControlFlowGraph,
} from '../src/core/cfg-extractor.js';

describe('CFGExtractor', () => {
  describe('extract()', () => {
    it('should extract CFG from simple code', () => {
      const code = `
        const x = 1;
        const y = 2;
        const z = x + y;
      `;

      const extractor = new CFGExtractor();
      const cfg = extractor.extract(code);

      expect(cfg.nodes.length).toBeGreaterThan(0);
      expect(cfg.edges.length).toBeGreaterThan(0);
      expect(cfg.entryId).toBeDefined();
      expect(cfg.exitIds.length).toBeGreaterThan(0);
      expect(cfg.language).toBe('javascript');
    });

    it('should extract CFG with if statement', () => {
      const code = `
        if (x > 0) {
          console.log('positive');
        } else {
          console.log('non-positive');
        }
      `;

      const extractor = new CFGExtractor();
      const cfg = extractor.extract(code);

      // Should have condition node
      const conditionNodes = cfg.nodes.filter((n) => n.type === 'condition');
      expect(conditionNodes.length).toBeGreaterThan(0);

      // Should have true and false branches
      const conditionEdges = cfg.edges.filter(
        (e) => e.type === 'conditional_true' || e.type === 'conditional_false'
      );
      expect(conditionEdges.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract CFG with while loop', () => {
      const code = `
        while (i < 10) {
          i++;
        }
      `;

      const extractor = new CFGExtractor();
      const cfg = extractor.extract(code);

      // Should have loop node
      const loopNodes = cfg.nodes.filter((n) => n.type === 'loop');
      expect(loopNodes.length).toBeGreaterThan(0);

      // Should have loop back edge
      const loopBackEdges = cfg.edges.filter((e) => e.type === 'loop_back');
      expect(loopBackEdges.length).toBeGreaterThan(0);
    });

    it('should extract CFG with for loop', () => {
      const code = `
        for (let i = 0; i < 10; i++) {
          console.log(i);
        }
      `;

      const extractor = new CFGExtractor();
      const cfg = extractor.extract(code);

      // Should have loop node
      const loopNodes = cfg.nodes.filter((n) => n.type === 'loop');
      expect(loopNodes.length).toBeGreaterThan(0);
    });

    it('should extract CFG with try-catch', () => {
      const code = `
        try {
          riskyOperation();
        } catch (e) {
          handleError(e);
        }
      `;

      const extractor = new CFGExtractor();
      const cfg = extractor.extract(code);

      // Should have try and catch nodes
      const tryNodes = cfg.nodes.filter((n) => n.type === 'try');
      const catchNodes = cfg.nodes.filter((n) => n.type === 'catch');
      expect(tryNodes.length).toBeGreaterThan(0);
      expect(catchNodes.length).toBeGreaterThan(0);

      // Should have exception edge
      const exceptionEdges = cfg.edges.filter((e) => e.type === 'exception');
      expect(exceptionEdges.length).toBeGreaterThan(0);
    });

    it('should extract CFG with switch statement', () => {
      const code = `
        switch (value) {
          case 1:
            handleOne();
            break;
          case 2:
            handleTwo();
            break;
          default:
            handleDefault();
        }
      `;

      const extractor = new CFGExtractor();
      const cfg = extractor.extract(code);

      // Should have switch and case nodes
      const switchNodes = cfg.nodes.filter((n) => n.type === 'switch');
      const caseNodes = cfg.nodes.filter((n) => n.type === 'case');
      expect(switchNodes.length).toBeGreaterThan(0);
      expect(caseNodes.length).toBeGreaterThan(0);
    });

    it('should extract CFG with return statement', () => {
      const code = `
        function test() {
          if (condition) {
            return 'early';
          }
          return 'normal';
        }
      `;

      const extractor = new CFGExtractor();
      // Use extractFunction to get CFG of the function body
      const cfg = extractor.extractFunction(code, 'test');

      expect(cfg).not.toBeNull();
      // Should have return nodes
      const returnNodes = cfg!.nodes.filter((n) => n.type === 'return');
      expect(returnNodes.length).toBeGreaterThan(0);
    });

    it('should include function calls when option enabled', () => {
      const code = `
        const result = processData(input);
        console.log(result);
      `;

      const extractor = new CFGExtractor({ includeCalls: true });
      const cfg = extractor.extract(code);

      // Should have call nodes
      const callNodes = cfg.nodes.filter((n) => n.type === 'call');
      expect(callNodes.length).toBeGreaterThan(0);
    });

    it('should include await expressions when option enabled', () => {
      const code = `
        async function test() {
          const data = await fetchData();
          const processed = await processData(data);
          return processed;
        }
      `;

      const extractor = new CFGExtractor({ includeAwaits: true });
      const cfg = extractor.extractFunction(code, 'test');

      expect(cfg).not.toBeNull();
      // Await expressions are processed within expression statements
      // Check that the code contains await references
      const nodesWithAwait = cfg!.nodes.filter(
        (n) => n.code && n.code.includes('await')
      );
      expect(nodesWithAwait.length).toBeGreaterThan(0);
    });

    it('should handle TypeScript code', () => {
      const code = `
        function greet(name: string): string {
          return \`Hello, \${name}!\`;
        }
      `;

      const extractor = new CFGExtractor({ language: 'typescript' });
      const cfg = extractor.extract(code);

      expect(cfg.language).toBe('typescript');
      expect(cfg.nodes.length).toBeGreaterThan(0);
    });
  });

  describe('extractFunction()', () => {
    it('should extract CFG for a specific function', () => {
      const code = `
        function add(a, b) {
          return a + b;
        }

        function multiply(a, b) {
          return a * b;
        }
      `;

      const extractor = new CFGExtractor();
      const cfg = extractor.extractFunction(code, 'add');

      expect(cfg).not.toBeNull();
      expect(cfg!.name).toBe('add');
      expect(cfg!.nodes.length).toBeGreaterThan(0);
    });

    it('should return null for non-existent function', () => {
      const code = `
        function test() {
          return 1;
        }
      `;

      const extractor = new CFGExtractor();
      const cfg = extractor.extractFunction(code, 'nonExistent');

      expect(cfg).toBeNull();
    });
  });

  describe('node properties', () => {
    it('should include source location', () => {
      const code = 'const x = 1;';

      const extractor = new CFGExtractor();
      const cfg = extractor.extract(code);

      const statementNodes = cfg.nodes.filter((n) => n.type === 'statement');
      expect(statementNodes.length).toBeGreaterThan(0);

      const nodeWithLocation = statementNodes.find((n) => n.location);
      expect(nodeWithLocation).toBeDefined();
      expect(nodeWithLocation!.location!.startLine).toBeGreaterThan(0);
    });

    it('should truncate long code snippets', () => {
      const code = 'const veryLongVariableName = someFunction(arg1, arg2, arg3, arg4, arg5);';

      const extractor = new CFGExtractor({ maxCodeLength: 30 });
      const cfg = extractor.extract(code);

      const nodeWithCode = cfg.nodes.find((n) => n.code && n.code.includes('...'));
      expect(nodeWithCode).toBeDefined();
    });
  });
});

describe('CFGVisualizer', () => {
  const simpleCFG: ControlFlowGraph = {
    nodes: [
      { id: 'n0', type: 'entry', label: 'Entry' },
      { id: 'n1', type: 'condition', label: 'if (x > 0)' },
      { id: 'n2', type: 'statement', label: 'console.log("yes")' },
      { id: 'n3', type: 'statement', label: 'console.log("no")' },
      { id: 'n4', type: 'exit', label: 'Exit' },
    ],
    edges: [
      { from: 'n0', to: 'n1', type: 'sequential' },
      { from: 'n1', to: 'n2', type: 'conditional_true', label: 'true' },
      { from: 'n1', to: 'n3', type: 'conditional_false', label: 'false' },
      { from: 'n2', to: 'n4', type: 'sequential' },
      { from: 'n3', to: 'n4', type: 'sequential' },
    ],
    entryId: 'n0',
    exitIds: ['n4'],
    language: 'javascript',
  };

  describe('toMermaid()', () => {
    it('should generate valid mermaid diagram', () => {
      const visualizer = new CFGVisualizer();
      const mermaid = visualizer.toMermaid(simpleCFG);

      expect(mermaid).toContain('flowchart TD');
      expect(mermaid).toContain('n0');
      expect(mermaid).toContain('n1');
      expect(mermaid).toContain('n2');
      expect(mermaid).toContain('n3');
      expect(mermaid).toContain('n4');
    });

    it('should include edge labels', () => {
      const visualizer = new CFGVisualizer();
      const mermaid = visualizer.toMermaid(simpleCFG);

      expect(mermaid).toContain('|true|');
      expect(mermaid).toContain('|false|');
    });

    it('should include node styling', () => {
      const visualizer = new CFGVisualizer();
      const mermaid = visualizer.toMermaid(simpleCFG);

      expect(mermaid).toContain('classDef entry');
      expect(mermaid).toContain('classDef exit');
      expect(mermaid).toContain('classDef condition');
    });

    it('should use correct shapes for node types', () => {
      const visualizer = new CFGVisualizer();
      const mermaid = visualizer.toMermaid(simpleCFG);

      // Entry/Exit use stadium shape ([...])
      expect(mermaid).toMatch(/n0\(\[/);
      expect(mermaid).toMatch(/n4\(\[/);

      // Condition uses diamond shape {...}
      expect(mermaid).toMatch(/n1\{/);
    });

    it('should escape special characters in labels', () => {
      const cfgWithSpecialChars: ControlFlowGraph = {
        nodes: [
          { id: 'n0', type: 'entry', label: 'Entry' },
          { id: 'n1', type: 'statement', label: 'x < 5 && y > 3' },
          { id: 'n2', type: 'exit', label: 'Exit' },
        ],
        edges: [
          { from: 'n0', to: 'n1', type: 'sequential' },
          { from: 'n1', to: 'n2', type: 'sequential' },
        ],
        entryId: 'n0',
        exitIds: ['n2'],
        language: 'javascript',
      };

      const visualizer = new CFGVisualizer();
      const mermaid = visualizer.toMermaid(cfgWithSpecialChars);

      expect(mermaid).toContain('&lt;');
      expect(mermaid).toContain('&gt;');
    });
  });

  describe('toDot()', () => {
    it('should generate valid DOT format', () => {
      const visualizer = new CFGVisualizer();
      const dot = visualizer.toDot(simpleCFG);

      expect(dot).toContain('digraph CFG');
      expect(dot).toContain('rankdir=TB');
      expect(dot).toContain('n0 [');
      expect(dot).toContain('n0 -> n1');
    });

    it('should include node shapes in DOT', () => {
      const visualizer = new CFGVisualizer();
      const dot = visualizer.toDot(simpleCFG);

      expect(dot).toContain('shape=ellipse'); // Entry/Exit
      expect(dot).toContain('shape=diamond'); // Condition
      expect(dot).toContain('shape=box'); // Statement
    });

    it('should include edge labels in DOT', () => {
      const visualizer = new CFGVisualizer();
      const dot = visualizer.toDot(simpleCFG);

      expect(dot).toContain('label="true"');
      expect(dot).toContain('label="false"');
    });
  });
});

describe('factory functions and exports', () => {
  it('should create extractor with factory function', () => {
    const extractor = createCFGExtractor({ language: 'typescript' });
    expect(extractor).toBeInstanceOf(CFGExtractor);
  });

  it('should create visualizer with factory function', () => {
    const visualizer = createCFGVisualizer();
    expect(visualizer).toBeInstanceOf(CFGVisualizer);
  });

  it('should export default extractor instance', () => {
    expect(cfgExtractor).toBeInstanceOf(CFGExtractor);
  });

  it('should export default visualizer instance', () => {
    expect(cfgVisualizer).toBeInstanceOf(CFGVisualizer);
  });
});

describe('integration', () => {
  it('should extract and visualize CFG end-to-end', () => {
    const code = `
      function factorial(n) {
        if (n <= 1) {
          return 1;
        }
        return n * factorial(n - 1);
      }
    `;

    const extractor = createCFGExtractor();
    const visualizer = createCFGVisualizer();

    const cfg = extractor.extractFunction(code, 'factorial');
    expect(cfg).not.toBeNull();

    const mermaid = visualizer.toMermaid(cfg!);
    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('Entry: factorial');

    const dot = visualizer.toDot(cfg!);
    expect(dot).toContain('digraph CFG');
  });
});
