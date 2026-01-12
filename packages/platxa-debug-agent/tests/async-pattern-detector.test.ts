/**
 * Tests for AsyncPatternDetector
 *
 * Verifies detection of async/await error patterns:
 * - Missing await on async function calls
 * - Unhandled promise rejections
 * - Floating promises
 * - Async operations in loops
 */

import { describe, expect, it } from 'vitest';
import {
  AsyncPatternDetector,
  createAsyncPatternDetector,
  detectAsyncPatterns,
} from '../src/patterns/async-pattern-detector.js';

describe('AsyncPatternDetector', () => {
  describe('detectMissingAwait', () => {
    it('should detect missing await on declared async function', async () => {
      const code = `
        async function fetchData() {
          return { data: 'test' };
        }

        async function main() {
          fetchData();  // Missing await
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const missingAwaits = result.issues.filter((i) => i.type === 'missing-await');
      expect(missingAwaits.length).toBeGreaterThan(0);
      expect(missingAwaits[0]?.message).toContain('fetchData');
    });

    it('should not flag awaited calls', async () => {
      const code = `
        async function fetchData() {
          return { data: 'test' };
        }

        async function main() {
          await fetchData();  // Correctly awaited
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const missingAwaits = result.issues.filter((i) => i.type === 'missing-await');
      expect(missingAwaits.length).toBe(0);
    });

    it('should not flag promise chains', async () => {
      const code = `
        async function fetchData() {
          return { data: 'test' };
        }

        function main() {
          fetchData().then(data => console.log(data));
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const missingAwaits = result.issues.filter((i) => i.type === 'missing-await');
      expect(missingAwaits.length).toBe(0);
    });

    it('should not flag returned promises', async () => {
      const code = `
        async function fetchData() {
          return { data: 'test' };
        }

        function main() {
          return fetchData();  // Returned, caller will handle
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const missingAwaits = result.issues.filter((i) => i.type === 'missing-await');
      expect(missingAwaits.length).toBe(0);
    });

    it('should detect missing await on fetch calls', async () => {
      const code = `
        async function loadUser() {
          fetch('/api/user');  // Missing await
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const missingAwaits = result.issues.filter((i) => i.type === 'missing-await');
      expect(missingAwaits.length).toBeGreaterThan(0);
      expect(missingAwaits[0]?.message).toContain('fetch');
    });

    it('should use known async functions from config', async () => {
      const code = `
        async function main() {
          customAsyncOp();  // Missing await
        }
      `;

      const detector = createAsyncPatternDetector({
        knownAsyncFunctions: ['customAsyncOp'],
      });
      const result = await detector.detect(code, 'test.js', 'javascript');

      const missingAwaits = result.issues.filter((i) => i.type === 'missing-await');
      expect(missingAwaits.length).toBeGreaterThan(0);
      expect(missingAwaits[0]?.message).toContain('customAsyncOp');
    });
  });

  describe('detectUnhandledRejections', () => {
    it('should detect Promise.reject without handling', async () => {
      const code = `
        function fail() {
          Promise.reject(new Error('Failed'));
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const unhandled = result.issues.filter((i) => i.type === 'unhandled-rejection');
      expect(unhandled.length).toBeGreaterThan(0);
    });

    it('should not flag Promise.reject in promise chain', async () => {
      const code = `
        function fail() {
          return Promise.reject(new Error('Failed')).catch(e => console.error(e));
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const unhandled = result.issues.filter((i) => i.type === 'unhandled-rejection');
      expect(unhandled.length).toBe(0);
    });

    it('should detect throw in async function without try-catch', async () => {
      const code = `
        async function validate(input) {
          if (!input) {
            throw new Error('Invalid input');
          }
          return true;
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const unhandled = result.issues.filter((i) => i.type === 'unhandled-rejection');
      expect(unhandled.length).toBeGreaterThan(0);
    });
  });

  describe('detectFloatingPromises', () => {
    it('should detect floating promise as expression statement', async () => {
      const code = `
        async function fetchData() {
          return { data: 'test' };
        }

        function main() {
          fetchData();  // Floating promise
          console.log('done');
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const floating = result.issues.filter((i) => i.type === 'floating-promise');
      expect(floating.length).toBeGreaterThan(0);
      expect(floating[0]?.suggestion).toContain('await');
    });

    it('should not flag assigned promises', async () => {
      const code = `
        async function fetchData() {
          return { data: 'test' };
        }

        function main() {
          const promise = fetchData();  // Assigned, not floating
          promise.then(console.log);
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const floating = result.issues.filter((i) => i.type === 'floating-promise');
      // Should not flag because it's an assignment, not expression statement
      expect(floating.length).toBe(0);
    });
  });

  describe('detectAsyncInLoops', () => {
    it('should detect await in for-of loop', async () => {
      const code = `
        async function processItems(items) {
          for (const item of items) {
            await processItem(item);  // Sequential execution
          }
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const asyncInLoop = result.issues.filter((i) => i.type === 'async-in-loop');
      expect(asyncInLoop.length).toBeGreaterThan(0);
      expect(asyncInLoop[0]?.suggestion).toContain('Promise.all');
    });

    it('should detect await in for loop', async () => {
      const code = `
        async function fetchAll(urls) {
          for (let i = 0; i < urls.length; i++) {
            await fetch(urls[i]);
          }
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const asyncInLoop = result.issues.filter((i) => i.type === 'async-in-loop');
      expect(asyncInLoop.length).toBeGreaterThan(0);
    });

    it('should detect await in while loop', async () => {
      const code = `
        async function pollUntilDone() {
          let done = false;
          while (!done) {
            const result = await checkStatus();
            done = result.complete;
          }
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const asyncInLoop = result.issues.filter((i) => i.type === 'async-in-loop');
      // This should be flagged but with lower confidence since polling is intentionally sequential
      expect(asyncInLoop.length).toBeGreaterThan(0);
    });
  });

  describe('configuration', () => {
    it('should respect minConfidence threshold', async () => {
      const code = `
        async function fetchData() {
          return { data: 'test' };
        }

        function main() {
          fetchData();
        }
      `;

      const highThreshold = createAsyncPatternDetector({ minConfidence: 0.99 });
      const lowThreshold = createAsyncPatternDetector({ minConfidence: 0.1 });

      const highResult = await highThreshold.detect(code, 'test.js', 'javascript');
      const lowResult = await lowThreshold.detect(code, 'test.js', 'javascript');

      expect(lowResult.issues.length).toBeGreaterThanOrEqual(highResult.issues.length);
    });

    it('should allow disabling specific detections', async () => {
      const code = `
        async function main() {
          for (const item of items) {
            await process(item);
          }
          fetchData();
        }
      `;

      const noAsyncInLoops = createAsyncPatternDetector({ detectAsyncInLoops: false });
      const result = await noAsyncInLoops.detect(code, 'test.js', 'javascript');

      const asyncInLoop = result.issues.filter((i) => i.type === 'async-in-loop');
      expect(asyncInLoop.length).toBe(0);
    });
  });

  describe('factory functions', () => {
    it('createAsyncPatternDetector should create detector', () => {
      const detector = createAsyncPatternDetector();
      expect(detector).toBeInstanceOf(AsyncPatternDetector);
    });

    it('detectAsyncPatterns should return issues', async () => {
      const code = `
        async function fetchData() {
          return { data: 'test' };
        }

        function main() {
          fetchData();
        }
      `;

      const issues = await detectAsyncPatterns(code, 'test.js', 'javascript');
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty code', async () => {
      const detector = createAsyncPatternDetector();
      const result = await detector.detect('', 'test.js', 'javascript');

      expect(result.issues).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle syntax errors gracefully', async () => {
      const code = `
        async function broken( {
          await something;
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      // Should not throw, may have parse errors
      expect(result).toBeDefined();
    });

    it('should work with TypeScript', async () => {
      const code = `
        async function fetchData(): Promise<Data> {
          return { data: 'test' };
        }

        async function main(): Promise<void> {
          fetchData();  // Missing await
        }
      `;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.ts', 'typescript');

      const missingAwaits = result.issues.filter((i) => i.type === 'missing-await');
      expect(missingAwaits.length).toBeGreaterThan(0);
    });

    it('should include location information', async () => {
      const code = `async function fetchData() {
  return { data: 'test' };
}

function main() {
  fetchData();
}`;

      const detector = createAsyncPatternDetector();
      const result = await detector.detect(code, 'test.js', 'javascript');

      const issue = result.issues[0];
      expect(issue?.location).toBeDefined();
      expect(issue?.location.file).toBe('test.js');
      expect(issue?.location.line).toBeGreaterThan(0);
    });
  });
});
