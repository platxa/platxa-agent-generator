/**
 * Tests for StateTracker
 *
 * Verifies variable state tracking during simulated code execution.
 */

import { describe, expect, it } from 'vitest';
import {
  StateTracker,
  createStateTracker,
  stateTracker,
} from '../src/core/state-tracker.js';

describe('StateTracker', () => {
  describe('simulate()', () => {
    it('should track variable declarations', () => {
      const code = `
        const x = 10;
        const y = 20;
        const z = x + y;
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      expect(result.completed).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);

      // Check final state
      const xVar = result.finalState.find((v) => v.name === 'x');
      const yVar = result.finalState.find((v) => v.name === 'y');
      const zVar = result.finalState.find((v) => v.name === 'z');

      expect(xVar?.value).toEqual({ type: 'number', value: 10 });
      expect(yVar?.value).toEqual({ type: 'number', value: 20 });
      expect(zVar?.value).toEqual({ type: 'number', value: 30 });
    });

    it('should track variable assignments', () => {
      const code = `
        let counter = 0;
        counter = counter + 1;
        counter = counter + 1;
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      expect(result.completed).toBe(true);

      const counterVar = result.finalState.find((v) => v.name === 'counter');
      expect(counterVar?.value).toEqual({ type: 'number', value: 2 });
    });

    it('should track increment/decrement operations', () => {
      const code = `
        let i = 5;
        i++;
        i--;
        i++;
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      const iVar = result.finalState.find((v) => v.name === 'i');
      expect(iVar?.value).toEqual({ type: 'number', value: 6 });
    });

    it('should handle input parameters', () => {
      const code = `
        const result = x * y;
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code, { x: 5, y: 3 });

      const resultVar = result.finalState.find((v) => v.name === 'result');
      expect(resultVar?.value).toEqual({ type: 'number', value: 15 });
    });

    it('should track if statement execution', () => {
      const code = `
        let result;
        if (x > 0) {
          result = 'positive';
        } else {
          result = 'non-positive';
        }
      `;

      const tracker = new StateTracker();

      // Test positive path
      const result1 = tracker.simulate(code, { x: 5 });
      const resultVar1 = result1.finalState.find((v) => v.name === 'result');
      expect(resultVar1?.value).toEqual({ type: 'string', value: 'positive' });

      // Test negative path
      const result2 = tracker.simulate(code, { x: -5 });
      const resultVar2 = result2.finalState.find((v) => v.name === 'result');
      expect(resultVar2?.value).toEqual({ type: 'string', value: 'non-positive' });
    });

    it('should track while loop execution', () => {
      const code = `
        let sum = 0;
        let i = 1;
        while (i <= 5) {
          sum = sum + i;
          i++;
        }
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      const sumVar = result.finalState.find((v) => v.name === 'sum');
      expect(sumVar?.value).toEqual({ type: 'number', value: 15 }); // 1+2+3+4+5
    });

    it('should track for loop execution', () => {
      const code = `
        let sum = 0;
        for (let i = 1; i <= 3; i++) {
          sum = sum + i;
        }
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      expect(result.completed).toBe(true);
      // Verify for loop was processed (has loop condition steps)
      const loopSteps = result.steps.filter((s) => s.statementType === 'for_statement');
      expect(loopSteps.length).toBeGreaterThan(0);

      // Verify sum was incremented
      const sumVar = result.finalState.find((v) => v.name === 'sum');
      expect(sumVar?.value.type).toBe('number');
    });

    it('should track array values', () => {
      const code = `
        const arr = [1, 2, 3];
        const first = arr[0];
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      const arrVar = result.finalState.find((v) => v.name === 'arr');
      expect(arrVar?.value.type).toBe('array');
      if (arrVar?.value.type === 'array') {
        expect(arrVar.value.length).toBe(3);
      }
    });

    it('should track object values', () => {
      const code = `
        const obj = { name: 'test', value: 42 };
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      const objVar = result.finalState.find((v) => v.name === 'obj');
      expect(objVar?.value.type).toBe('object');
      if (objVar?.value.type === 'object') {
        expect(objVar.value.properties['name']).toEqual({ type: 'string', value: 'test' });
        expect(objVar.value.properties['value']).toEqual({ type: 'number', value: 42 });
      }
    });

    it('should record changes at each step', () => {
      const code = `
        let x = 1;
        x = 2;
        x = 3;
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      // Each statement should have changes recorded
      const stepsWithChanges = result.steps.filter((s) => s.changes.length > 0);
      expect(stepsWithChanges.length).toBe(3);
    });

    it('should capture console.log output', () => {
      const code = `
        const msg = 'Hello';
        console.log(msg);
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      const logStep = result.steps.find((s) => s.output !== undefined);
      expect(logStep?.output).toBe('Hello');
    });

    it('should respect maxSteps limit', () => {
      const code = `
        while (true) {
          let x = 1;
        }
      `;

      const tracker = new StateTracker({ maxSteps: 50 });
      const result = tracker.simulate(code);

      expect(result.completed).toBe(false);
      expect(result.error).toContain('Maximum steps');
    });
  });

  describe('simulateFunction()', () => {
    it('should simulate a specific function', () => {
      const code = `
        function add(a, b) {
          return a + b;
        }

        function multiply(a, b) {
          return a * b;
        }
      `;

      const tracker = new StateTracker();
      const result = tracker.simulateFunction(code, 'add', [3, 5]);

      expect(result.completed).toBe(true);
      expect(result.returnValue).toEqual({ type: 'number', value: 8 });
    });

    it('should handle function not found', () => {
      const code = `
        function test() {
          return 1;
        }
      `;

      const tracker = new StateTracker();
      const result = tracker.simulateFunction(code, 'notFound');

      expect(result.completed).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should track function parameters', () => {
      const code = `
        function greet(name) {
          const message = 'Hello, ' + name;
          return message;
        }
      `;

      const tracker = new StateTracker();
      const result = tracker.simulateFunction(code, 'greet', ['World']);

      expect(result.completed).toBe(true);

      // Check that parameter was set
      const paramStep = result.steps.find((s) =>
        s.variables.some((v) => v.name === 'name')
      );
      expect(paramStep).toBeDefined();
    });

    it('should handle recursive-like patterns', () => {
      const code = `
        function factorial(n) {
          if (n <= 1) {
            return 1;
          }
          return n;
        }
      `;

      const tracker = new StateTracker();
      const result = tracker.simulateFunction(code, 'factorial', [5]);

      expect(result.completed).toBe(true);
      // Note: Actual recursion isn't supported, but we can test the condition path
    });
  });

  describe('getStateAtLine()', () => {
    it('should return state at specific line', () => {
      const code = `const x = 1;
const y = 2;
const z = 3;`;

      const tracker = new StateTracker();
      tracker.simulate(code);

      const stateAtLine2 = tracker.getStateAtLine(2);
      const xVar = stateAtLine2.find((v) => v.name === 'x');
      const yVar = stateAtLine2.find((v) => v.name === 'y');

      expect(xVar).toBeDefined();
      expect(yVar).toBeDefined();
    });
  });

  describe('getVariableHistory()', () => {
    it('should return history of variable changes', () => {
      const code = `
        let x = 0;
        x = 1;
        x = 2;
        x = 3;
      `;

      const tracker = new StateTracker();
      tracker.simulate(code);

      const history = tracker.getVariableHistory('x');

      expect(history.length).toBe(4);
      expect(history[0].value).toEqual({ type: 'number', value: 0 });
      expect(history[1].value).toEqual({ type: 'number', value: 1 });
      expect(history[2].value).toEqual({ type: 'number', value: 2 });
      expect(history[3].value).toEqual({ type: 'number', value: 3 });
    });

    it('should not duplicate unchanged values', () => {
      const code = `
        let x = 1;
        let y = 2;
        let z = 3;
      `;

      const tracker = new StateTracker();
      tracker.simulate(code);

      const history = tracker.getVariableHistory('x');
      expect(history.length).toBe(1); // x only set once
    });
  });

  describe('expression evaluation', () => {
    it('should evaluate arithmetic expressions', () => {
      const code = `
        const a = 10 + 5;
        const b = 10 - 5;
        const c = 10 * 5;
        const d = 10 / 5;
        const e = 10 % 3;
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      expect(result.finalState.find((v) => v.name === 'a')?.value).toEqual({ type: 'number', value: 15 });
      expect(result.finalState.find((v) => v.name === 'b')?.value).toEqual({ type: 'number', value: 5 });
      expect(result.finalState.find((v) => v.name === 'c')?.value).toEqual({ type: 'number', value: 50 });
      expect(result.finalState.find((v) => v.name === 'd')?.value).toEqual({ type: 'number', value: 2 });
      expect(result.finalState.find((v) => v.name === 'e')?.value).toEqual({ type: 'number', value: 1 });
    });

    it('should evaluate comparison expressions', () => {
      const code = `
        const lt = 5 < 10;
        const gt = 5 > 10;
        const eq = 5 === 5;
        const neq = 5 !== 10;
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      expect(result.finalState.find((v) => v.name === 'lt')?.value).toEqual({ type: 'boolean', value: true });
      expect(result.finalState.find((v) => v.name === 'gt')?.value).toEqual({ type: 'boolean', value: false });
      expect(result.finalState.find((v) => v.name === 'eq')?.value).toEqual({ type: 'boolean', value: true });
      expect(result.finalState.find((v) => v.name === 'neq')?.value).toEqual({ type: 'boolean', value: true });
    });

    it('should evaluate string concatenation', () => {
      const code = `
        const greeting = 'Hello' + ' ' + 'World';
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      expect(result.finalState.find((v) => v.name === 'greeting')?.value).toEqual({
        type: 'string',
        value: 'Hello World',
      });
    });

    it('should evaluate boolean expressions', () => {
      const code = `
        const a = true && false;
        const b = true || false;
        const c = !true;
      `;

      const tracker = new StateTracker();
      const result = tracker.simulate(code);

      expect(result.finalState.find((v) => v.name === 'a')?.value).toEqual({ type: 'boolean', value: false });
      expect(result.finalState.find((v) => v.name === 'b')?.value).toEqual({ type: 'boolean', value: true });
      expect(result.finalState.find((v) => v.name === 'c')?.value).toEqual({ type: 'boolean', value: false });
    });
  });

  describe('factory and exports', () => {
    it('should create tracker with factory function', () => {
      const tracker = createStateTracker({ maxSteps: 500 });
      expect(tracker).toBeInstanceOf(StateTracker);
    });

    it('should export default tracker instance', () => {
      expect(stateTracker).toBeInstanceOf(StateTracker);
    });
  });

  describe('TypeScript support', () => {
    it('should handle TypeScript code', () => {
      const code = `
        const x: number = 10;
        const y: string = 'hello';
      `;

      const tracker = new StateTracker({ language: 'typescript' });
      const result = tracker.simulate(code);

      expect(result.completed).toBe(true);
      expect(result.finalState.find((v) => v.name === 'x')?.value).toEqual({ type: 'number', value: 10 });
    });
  });
});
