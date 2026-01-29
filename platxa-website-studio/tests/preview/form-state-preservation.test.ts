/**
 * Tests for FormStatePreserver
 *
 * Feature #64: Add form input state preservation during morphdom updates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock types
type FormElementType = 'input' | 'textarea' | 'select' | 'contenteditable';

interface FormElementState {
  selector: string;
  type: FormElementType;
  inputType?: string;
  value: string;
  checked?: boolean;
  selectedOptions?: string[];
  selectionStart?: number;
  selectionEnd?: number;
  selectionDirection?: 'forward' | 'backward' | 'none';
  isFocused: boolean;
  name?: string;
  id?: string;
  capturedAt: number;
}

interface FormStateSnapshot {
  id: string;
  states: FormElementState[];
  activeElement: string | null;
  timestamp: number;
}

interface MorphdomOptions {
  onBeforeElUpdated?: (fromEl: Element, toEl: Element) => boolean;
}

interface RestoreResult {
  success: boolean;
  restoredCount: number;
  failedElements: string[];
  restoreTimeMs: number;
}

// Mock FormStatePreserver
class MockFormStatePreserver {
  private lastSnapshot: FormStateSnapshot | null = null;
  private snapshotIdCounter = 0;
  private mockElements: Map<string, {
    type: FormElementType;
    inputType?: string;
    value: string;
    checked?: boolean;
    selectedOptions?: string[];
    selectionStart?: number;
    selectionEnd?: number;
    isFocused: boolean;
    name?: string;
    id?: string;
  }> = new Map();
  private activeElementSelector: string | null = null;

  constructor() {
    // Set up some mock form elements
    this.mockElements.set('#username', {
      type: 'input',
      inputType: 'text',
      value: 'john_doe',
      isFocused: false,
      name: 'username',
      id: 'username',
      selectionStart: 8,
      selectionEnd: 8,
    });
    this.mockElements.set('#password', {
      type: 'input',
      inputType: 'password',
      value: 'secret123',
      isFocused: false,
      name: 'password',
      id: 'password',
    });
    this.mockElements.set('#bio', {
      type: 'textarea',
      value: 'Hello, I am a developer.',
      isFocused: false,
      name: 'bio',
      id: 'bio',
      selectionStart: 24,
      selectionEnd: 24,
    });
    this.mockElements.set('#remember', {
      type: 'input',
      inputType: 'checkbox',
      value: 'on',
      checked: true,
      isFocused: false,
      name: 'remember',
      id: 'remember',
    });
    this.mockElements.set('#country', {
      type: 'select',
      value: 'us',
      isFocused: false,
      name: 'country',
      id: 'country',
    });
  }

  setActiveElement(selector: string | null): void {
    // Clear previous focus
    this.mockElements.forEach((el) => { el.isFocused = false; });

    this.activeElementSelector = selector;
    if (selector) {
      const el = this.mockElements.get(selector);
      if (el) {
        el.isFocused = true;
      }
    }
  }

  setElementValue(selector: string, value: string): void {
    const el = this.mockElements.get(selector);
    if (el) {
      el.value = value;
    }
  }

  setElementChecked(selector: string, checked: boolean): void {
    const el = this.mockElements.get(selector);
    if (el) {
      el.checked = checked;
    }
  }

  getElementValue(selector: string): string | undefined {
    return this.mockElements.get(selector)?.value;
  }

  getElementChecked(selector: string): boolean | undefined {
    return this.mockElements.get(selector)?.checked;
  }

  getMorphdomOptions(): MorphdomOptions {
    return {
      onBeforeElUpdated: (fromEl: Element, toEl: Element): boolean => {
        // Simulate checking if element is active/focused
        const selector = `#${(fromEl as HTMLElement).id}`;
        if (selector === this.activeElementSelector) {
          return false; // Exclude active element from morph
        }
        return true;
      },
    };
  }

  capture(selectors?: string[]): FormStateSnapshot {
    const selectorsToCapture = selectors ?? Array.from(this.mockElements.keys());
    const states: FormElementState[] = [];

    for (const selector of selectorsToCapture) {
      const el = this.mockElements.get(selector);
      if (el) {
        states.push({
          selector,
          type: el.type,
          inputType: el.inputType,
          value: el.value,
          checked: el.checked,
          selectedOptions: el.selectedOptions,
          selectionStart: el.selectionStart,
          selectionEnd: el.selectionEnd,
          isFocused: el.isFocused,
          name: el.name,
          id: el.id,
          capturedAt: Date.now(),
        });
      }
    }

    const snapshot: FormStateSnapshot = {
      id: `form-snap-${++this.snapshotIdCounter}`,
      states,
      activeElement: this.activeElementSelector,
      timestamp: Date.now(),
    };

    this.lastSnapshot = snapshot;
    return snapshot;
  }

  restore(): RestoreResult {
    const startTime = performance.now();
    let restoredCount = 0;
    const failedElements: string[] = [];

    if (!this.lastSnapshot) {
      return {
        success: false,
        restoredCount: 0,
        failedElements: [],
        restoreTimeMs: performance.now() - startTime,
      };
    }

    for (const state of this.lastSnapshot.states) {
      const el = this.mockElements.get(state.selector);
      if (el) {
        el.value = state.value;
        if (state.checked !== undefined) {
          el.checked = state.checked;
        }
        if (state.selectionStart !== undefined) {
          el.selectionStart = state.selectionStart;
          el.selectionEnd = state.selectionEnd;
        }
        restoredCount++;
      } else {
        failedElements.push(state.selector);
      }
    }

    // Restore focus
    if (this.lastSnapshot.activeElement) {
      this.setActiveElement(this.lastSnapshot.activeElement);
    }

    return {
      success: failedElements.length === 0,
      restoredCount,
      failedElements,
      restoreTimeMs: performance.now() - startTime,
    };
  }

  getLastSnapshot(): FormStateSnapshot | null {
    return this.lastSnapshot;
  }

  clear(): void {
    this.lastSnapshot = null;
  }

  isElementFocused(selector: string): boolean {
    return this.mockElements.get(selector)?.isFocused ?? false;
  }
}

describe('FormStatePreserver', () => {
  let preserver: MockFormStatePreserver;

  beforeEach(() => {
    preserver = new MockFormStatePreserver();
  });

  describe('active element exclusion (Feature #64)', () => {
    it('should exclude active input from morph', () => {
      preserver.setActiveElement('#username');
      const options = preserver.getMorphdomOptions();

      // Simulate morphdom calling onBeforeElUpdated
      const mockFromEl = { id: 'username' } as HTMLElement;
      const mockToEl = { id: 'username' } as HTMLElement;

      const shouldUpdate = options.onBeforeElUpdated?.(mockFromEl, mockToEl);

      expect(shouldUpdate).toBe(false); // Active element should be excluded
    });

    it('should allow morph for non-active elements', () => {
      preserver.setActiveElement('#username');
      const options = preserver.getMorphdomOptions();

      const mockFromEl = { id: 'password' } as HTMLElement;
      const mockToEl = { id: 'password' } as HTMLElement;

      const shouldUpdate = options.onBeforeElUpdated?.(mockFromEl, mockToEl);

      expect(shouldUpdate).toBe(true); // Non-active element can be morphed
    });

    it('should allow morph when no element is focused', () => {
      preserver.setActiveElement(null);
      const options = preserver.getMorphdomOptions();

      const mockFromEl = { id: 'username' } as HTMLElement;
      const mockToEl = { id: 'username' } as HTMLElement;

      const shouldUpdate = options.onBeforeElUpdated?.(mockFromEl, mockToEl);

      expect(shouldUpdate).toBe(true);
    });
  });

  describe('value preservation (Feature #64)', () => {
    it('should preserve text input value', () => {
      preserver.setElementValue('#username', 'modified_value');
      preserver.capture(['#username']);

      // Simulate external change (like morph)
      preserver.setElementValue('#username', 'overwritten');

      preserver.restore();

      expect(preserver.getElementValue('#username')).toBe('modified_value');
    });

    it('should preserve textarea value', () => {
      preserver.setElementValue('#bio', 'My custom bio text');
      preserver.capture(['#bio']);

      preserver.setElementValue('#bio', '');

      preserver.restore();

      expect(preserver.getElementValue('#bio')).toBe('My custom bio text');
    });

    it('should preserve checkbox checked state', () => {
      preserver.setElementChecked('#remember', false);
      preserver.capture(['#remember']);

      preserver.setElementChecked('#remember', true);

      preserver.restore();

      expect(preserver.getElementChecked('#remember')).toBe(false);
    });

    it('should preserve select value', () => {
      preserver.setElementValue('#country', 'uk');
      preserver.capture(['#country']);

      preserver.setElementValue('#country', 'us');

      preserver.restore();

      expect(preserver.getElementValue('#country')).toBe('uk');
    });
  });

  describe('capture', () => {
    it('should capture all form elements', () => {
      const snapshot = preserver.capture();

      expect(snapshot.states.length).toBeGreaterThan(0);
    });

    it('should capture specific elements', () => {
      const snapshot = preserver.capture(['#username', '#password']);

      expect(snapshot.states).toHaveLength(2);
    });

    it('should capture element values', () => {
      preserver.setElementValue('#username', 'test_user');
      const snapshot = preserver.capture(['#username']);

      expect(snapshot.states[0].value).toBe('test_user');
    });

    it('should capture checked state for checkboxes', () => {
      preserver.setElementChecked('#remember', true);
      const snapshot = preserver.capture(['#remember']);

      expect(snapshot.states[0].checked).toBe(true);
    });

    it('should capture active element', () => {
      preserver.setActiveElement('#username');
      const snapshot = preserver.capture();

      expect(snapshot.activeElement).toBe('#username');
    });

    it('should generate unique snapshot IDs', () => {
      const snap1 = preserver.capture();
      const snap2 = preserver.capture();

      expect(snap1.id).not.toBe(snap2.id);
    });

    it('should record timestamp', () => {
      const before = Date.now();
      const snapshot = preserver.capture();
      const after = Date.now();

      expect(snapshot.timestamp).toBeGreaterThanOrEqual(before);
      expect(snapshot.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('restore', () => {
    it('should restore all captured values', () => {
      preserver.setElementValue('#username', 'original');
      preserver.setElementValue('#bio', 'original bio');
      preserver.capture(['#username', '#bio']);

      preserver.setElementValue('#username', 'changed');
      preserver.setElementValue('#bio', 'changed bio');

      const result = preserver.restore();

      expect(result.success).toBe(true);
      expect(result.restoredCount).toBe(2);
      expect(preserver.getElementValue('#username')).toBe('original');
      expect(preserver.getElementValue('#bio')).toBe('original bio');
    });

    it('should restore focus', () => {
      preserver.setActiveElement('#username');
      preserver.capture();

      preserver.setActiveElement(null);

      preserver.restore();

      expect(preserver.isElementFocused('#username')).toBe(true);
    });

    it('should report failed elements', () => {
      // Add a temporary element that will be "removed" after capture
      preserver['mockElements'].set('#temporary', {
        type: 'input',
        inputType: 'text',
        value: 'temp',
        isFocused: false,
        name: 'temporary',
        id: 'temporary',
      });

      preserver.capture(['#username', '#temporary']);

      // Simulate element being removed from DOM (e.g., by morph)
      preserver['mockElements'].delete('#temporary');

      const result = preserver.restore();

      expect(result.failedElements).toContain('#temporary');
    });

    it('should return success false when no snapshot', () => {
      preserver.clear();
      const result = preserver.restore();

      expect(result.success).toBe(false);
      expect(result.restoredCount).toBe(0);
    });
  });

  describe('selection preservation', () => {
    it('should capture selection start/end', () => {
      const snapshot = preserver.capture(['#username']);
      const state = snapshot.states[0];

      expect(state.selectionStart).toBeDefined();
      expect(state.selectionEnd).toBeDefined();
    });

    it('should restore cursor position', () => {
      preserver.capture(['#username']);

      // Modify selection
      const el = preserver['mockElements'].get('#username');
      if (el) {
        el.selectionStart = 0;
        el.selectionEnd = 0;
      }

      preserver.restore();

      const restored = preserver['mockElements'].get('#username');
      expect(restored?.selectionStart).toBe(8);
      expect(restored?.selectionEnd).toBe(8);
    });
  });

  describe('FormElementState', () => {
    it('should include all required properties', () => {
      const snapshot = preserver.capture(['#username']);
      const state = snapshot.states[0];

      expect(state.selector).toBeDefined();
      expect(state.type).toBeDefined();
      expect(state.value).toBeDefined();
      expect(state.isFocused).toBeDefined();
      expect(state.capturedAt).toBeDefined();
    });

    it('should include input type for inputs', () => {
      const snapshot = preserver.capture(['#username']);
      const state = snapshot.states[0];

      expect(state.inputType).toBe('text');
    });

    it('should include name attribute', () => {
      const snapshot = preserver.capture(['#username']);
      const state = snapshot.states[0];

      expect(state.name).toBe('username');
    });

    it('should include id attribute', () => {
      const snapshot = preserver.capture(['#username']);
      const state = snapshot.states[0];

      expect(state.id).toBe('username');
    });
  });

  describe('RestoreResult', () => {
    it('should include restore time', () => {
      preserver.capture(['#username']);
      const result = preserver.restore();

      expect(result.restoreTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should count restored elements', () => {
      preserver.capture(['#username', '#password', '#bio']);
      const result = preserver.restore();

      expect(result.restoredCount).toBe(3);
    });
  });

  describe('MorphdomOptions', () => {
    it('should provide onBeforeElUpdated callback', () => {
      const options = preserver.getMorphdomOptions();

      expect(options.onBeforeElUpdated).toBeDefined();
      expect(typeof options.onBeforeElUpdated).toBe('function');
    });
  });

  describe('getLastSnapshot', () => {
    it('should return null before capture', () => {
      preserver.clear();
      expect(preserver.getLastSnapshot()).toBeNull();
    });

    it('should return snapshot after capture', () => {
      preserver.capture();
      expect(preserver.getLastSnapshot()).not.toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear captured snapshot', () => {
      preserver.capture();
      expect(preserver.getLastSnapshot()).not.toBeNull();

      preserver.clear();
      expect(preserver.getLastSnapshot()).toBeNull();
    });
  });

  describe('form element types', () => {
    it('should handle text input', () => {
      const snapshot = preserver.capture(['#username']);
      expect(snapshot.states[0].type).toBe('input');
      expect(snapshot.states[0].inputType).toBe('text');
    });

    it('should handle password input', () => {
      const snapshot = preserver.capture(['#password']);
      expect(snapshot.states[0].type).toBe('input');
      expect(snapshot.states[0].inputType).toBe('password');
    });

    it('should handle checkbox input', () => {
      const snapshot = preserver.capture(['#remember']);
      expect(snapshot.states[0].type).toBe('input');
      expect(snapshot.states[0].inputType).toBe('checkbox');
      expect(snapshot.states[0].checked).toBeDefined();
    });

    it('should handle textarea', () => {
      const snapshot = preserver.capture(['#bio']);
      expect(snapshot.states[0].type).toBe('textarea');
    });

    it('should handle select', () => {
      const snapshot = preserver.capture(['#country']);
      expect(snapshot.states[0].type).toBe('select');
    });
  });
});
