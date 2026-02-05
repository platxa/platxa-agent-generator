/**
 * BrowserTestTool - Verify changes in the preview
 *
 * Provides browser testing capabilities for the agent to:
 * - Check if elements exist in the preview
 * - Verify element styles and attributes
 * - Test element interactions (click, hover, focus)
 * - Validate responsive layouts
 * - Check accessibility properties
 *
 * Feature #53: Agent Tool Expansion - BrowserTestTool
 */

// =============================================================================
// Types
// =============================================================================

/** Element selector types */
export type SelectorType = "css" | "xpath" | "id" | "class" | "tag" | "text";

/** Element query */
export interface ElementQuery {
  /** Selector string */
  selector: string;
  /** Selector type */
  type?: SelectorType;
  /** Wait timeout in ms */
  timeout?: number;
  /** Parent element query (for scoped searches) */
  parent?: ElementQuery;
}

/** Element state */
export interface ElementState {
  /** Element exists */
  exists: boolean;
  /** Element is visible */
  visible: boolean;
  /** Element is enabled */
  enabled: boolean;
  /** Element is focused */
  focused: boolean;
  /** Element is checked (for inputs) */
  checked?: boolean;
  /** Element text content */
  textContent: string;
  /** Element inner HTML */
  innerHTML: string;
  /** Element bounding rect */
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Element tag name */
  tagName: string;
  /** Element attributes */
  attributes: Record<string, string>;
}

/** Style check options */
export interface StyleCheckOptions {
  /** CSS property name */
  property: string;
  /** Expected value */
  expected: string;
  /** Use computed style */
  computed?: boolean;
  /** Tolerance for numeric values */
  tolerance?: number;
}

/** Interaction types */
export type InteractionType = "click" | "hover" | "focus" | "blur" | "scroll" | "type";

/** Interaction options */
export interface InteractionOptions {
  /** Interaction type */
  type: InteractionType;
  /** Value for type interaction */
  value?: string;
  /** Scroll position */
  scrollPosition?: { x?: number; y?: number };
  /** Wait after interaction in ms */
  waitAfter?: number;
}

/** Accessibility check result */
export interface AccessibilityCheck {
  /** Element has valid role */
  hasRole: boolean;
  /** Role value */
  role?: string;
  /** Element has aria-label or label */
  hasLabel: boolean;
  /** Label value */
  label?: string;
  /** Element is keyboard accessible */
  keyboardAccessible: boolean;
  /** Contrast ratio (if applicable) */
  contrastRatio?: number;
  /** WCAG compliance level */
  wcagLevel?: "A" | "AA" | "AAA" | "fail";
}

/** Viewport configuration */
export interface ViewportConfig {
  /** Viewport width */
  width: number;
  /** Viewport height */
  height: number;
  /** Device scale factor */
  deviceScaleFactor?: number;
  /** Is mobile viewport */
  isMobile?: boolean;
  /** Has touch support */
  hasTouch?: boolean;
}

/** Preset viewport sizes */
export type ViewportPreset = "mobile" | "tablet" | "desktop" | "wide";

/** Test assertion */
export interface TestAssertion {
  /** Assertion passed */
  passed: boolean;
  /** Assertion description */
  description: string;
  /** Expected value */
  expected?: unknown;
  /** Actual value */
  actual?: unknown;
  /** Error message if failed */
  error?: string;
}

/** Test result */
export interface TestResult {
  /** All assertions passed */
  success: boolean;
  /** Individual assertions */
  assertions: TestAssertion[];
  /** Total test duration in ms */
  duration: number;
  /** Screenshots taken */
  screenshots?: string[];
  /** Console logs captured */
  consoleLogs?: Array<{ level: string; message: string }>;
}

/** Tool schema for AI model */
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

/** Preview frame interface */
export interface PreviewFrame {
  /** Get document from frame */
  getDocument(): Document | null;
  /** Get window from frame */
  getWindow(): Window | null;
  /** Query selector in frame */
  querySelector(selector: string): Element | null;
  /** Query selector all in frame */
  querySelectorAll(selector: string): NodeListOf<Element>;
  /** Execute script in frame context */
  executeScript<T>(fn: () => T): T | null;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIMEOUT = 5000;

const VIEWPORT_PRESETS: Record<ViewportPreset, ViewportConfig> = {
  mobile: { width: 375, height: 667, isMobile: true, hasTouch: true },
  tablet: { width: 768, height: 1024, isMobile: true, hasTouch: true },
  desktop: { width: 1280, height: 800, isMobile: false, hasTouch: false },
  wide: { width: 1920, height: 1080, isMobile: false, hasTouch: false },
};

// =============================================================================
// BrowserTestTool Class
// =============================================================================

/**
 * BrowserTestTool provides preview testing capabilities for AI agents.
 *
 * @example
 * ```typescript
 * const testTool = new BrowserTestTool(previewFrame);
 *
 * // Check if element exists
 * const exists = await testTool.elementExists({ selector: ".hero-section" });
 *
 * // Verify styles
 * const styleCheck = await testTool.checkStyles(
 *   { selector: ".button" },
 *   [{ property: "background-color", expected: "rgb(59, 130, 246)" }]
 * );
 *
 * // Test interaction
 * const clicked = await testTool.interact(
 *   { selector: ".nav-toggle" },
 *   { type: "click" }
 * );
 * ```
 */
export class BrowserTestTool {
  private previewFrame: PreviewFrame | null = null;
  private currentViewport: ViewportConfig = VIEWPORT_PRESETS.desktop;
  private consoleLogs: Array<{ level: string; message: string }> = [];

  constructor(previewFrame?: PreviewFrame) {
    if (previewFrame) {
      this.setPreviewFrame(previewFrame);
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Get the tool schema for AI model integration
   */
  getSchema(): ToolSchema {
    return {
      name: "browser_test",
      description:
        "Test and verify elements in the preview. Use this to check if elements exist, " +
        "have correct styles, respond to interactions, and meet accessibility standards.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "exists",
              "getState",
              "checkStyles",
              "interact",
              "checkAccessibility",
              "setViewport",
              "runTest",
            ],
            description: "The test action to perform",
          },
          selector: {
            type: "string",
            description: "CSS selector for the target element",
          },
          styles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                property: { type: "string" },
                expected: { type: "string" },
              },
            },
            description: "Style checks to perform",
          },
          interaction: {
            type: "string",
            enum: ["click", "hover", "focus", "blur", "scroll", "type"],
            description: "Interaction type",
          },
          viewport: {
            type: "string",
            enum: ["mobile", "tablet", "desktop", "wide"],
            description: "Viewport preset",
          },
        },
        required: ["action"],
      },
    };
  }

  /**
   * Set the preview frame to test
   */
  setPreviewFrame(frame: PreviewFrame): void {
    this.previewFrame = frame;
    this.setupConsoleCapture();
  }

  /**
   * Check if an element exists
   */
  async elementExists(query: ElementQuery): Promise<boolean> {
    const element = await this.findElement(query);
    return element !== null;
  }

  /**
   * Get element state
   */
  async getElementState(query: ElementQuery): Promise<ElementState | null> {
    const element = await this.findElement(query);
    if (!element) return null;

    const doc = this.previewFrame?.getDocument();
    const rect = element.getBoundingClientRect();
    const computedStyle = doc?.defaultView?.getComputedStyle(element);

    return {
      exists: true,
      visible: this.isElementVisible(element, computedStyle),
      enabled: !(element as HTMLButtonElement).disabled,
      focused: doc?.activeElement === element,
      checked: (element as HTMLInputElement).checked,
      textContent: element.textContent || "",
      innerHTML: element.innerHTML,
      boundingRect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      tagName: element.tagName.toLowerCase(),
      attributes: this.getElementAttributes(element),
    };
  }

  /**
   * Check element styles
   */
  async checkStyles(
    query: ElementQuery,
    checks: StyleCheckOptions[]
  ): Promise<TestResult> {
    const startTime = Date.now();
    const assertions: TestAssertion[] = [];

    const element = await this.findElement(query);
    if (!element) {
      return {
        success: false,
        assertions: [
          {
            passed: false,
            description: "Element not found",
            error: `No element found for selector: ${query.selector}`,
          },
        ],
        duration: Date.now() - startTime,
      };
    }

    const doc = this.previewFrame?.getDocument();
    const computedStyle = doc?.defaultView?.getComputedStyle(element);

    for (const check of checks) {
      const actualValue = check.computed
        ? computedStyle?.getPropertyValue(check.property)
        : (element as HTMLElement).style.getPropertyValue(check.property);

      const passed = this.compareStyleValues(
        actualValue || "",
        check.expected,
        check.tolerance
      );

      assertions.push({
        passed,
        description: `Style ${check.property} should be ${check.expected}`,
        expected: check.expected,
        actual: actualValue,
        error: passed ? undefined : `Expected "${check.expected}", got "${actualValue}"`,
      });
    }

    return {
      success: assertions.every((a) => a.passed),
      assertions,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Interact with an element
   */
  async interact(
    query: ElementQuery,
    options: InteractionOptions
  ): Promise<TestResult> {
    const startTime = Date.now();
    const assertions: TestAssertion[] = [];

    const element = await this.findElement(query);
    if (!element) {
      return {
        success: false,
        assertions: [
          {
            passed: false,
            description: "Element not found for interaction",
            error: `No element found for selector: ${query.selector}`,
          },
        ],
        duration: Date.now() - startTime,
      };
    }

    try {
      switch (options.type) {
        case "click":
          (element as HTMLElement).click();
          assertions.push({
            passed: true,
            description: "Click interaction performed",
          });
          break;

        case "hover":
          element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
          element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
          assertions.push({
            passed: true,
            description: "Hover interaction performed",
          });
          break;

        case "focus":
          (element as HTMLElement).focus();
          assertions.push({
            passed: this.previewFrame?.getDocument()?.activeElement === element,
            description: "Focus interaction performed",
          });
          break;

        case "blur":
          (element as HTMLElement).blur();
          assertions.push({
            passed: true,
            description: "Blur interaction performed",
          });
          break;

        case "scroll":
          if (options.scrollPosition) {
            element.scrollTo({
              left: options.scrollPosition.x,
              top: options.scrollPosition.y,
              behavior: "smooth",
            });
          }
          assertions.push({
            passed: true,
            description: "Scroll interaction performed",
          });
          break;

        case "type":
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.value = options.value || "";
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            assertions.push({
              passed: element.value === options.value,
              description: "Type interaction performed",
              expected: options.value,
              actual: element.value,
            });
          } else {
            assertions.push({
              passed: false,
              description: "Type interaction failed",
              error: "Element is not an input or textarea",
            });
          }
          break;
      }

      // Wait after interaction if specified
      if (options.waitAfter) {
        await this.wait(options.waitAfter);
      }
    } catch (error) {
      assertions.push({
        passed: false,
        description: `Interaction ${options.type} failed`,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return {
      success: assertions.every((a) => a.passed),
      assertions,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check element accessibility
   */
  async checkAccessibility(query: ElementQuery): Promise<AccessibilityCheck> {
    const element = await this.findElement(query);
    if (!element) {
      return {
        hasRole: false,
        hasLabel: false,
        keyboardAccessible: false,
      };
    }

    const role = element.getAttribute("role") || this.getImplicitRole(element);
    const ariaLabel = element.getAttribute("aria-label");
    const ariaLabelledBy = element.getAttribute("aria-labelledby");
    const label = this.findAssociatedLabel(element);
    const tabIndex = element.getAttribute("tabindex");

    const hasLabel = !!(ariaLabel || ariaLabelledBy || label);
    const keyboardAccessible =
      this.isNativelyFocusable(element) || tabIndex !== null;

    return {
      hasRole: !!role,
      role: role || undefined,
      hasLabel,
      label: ariaLabel || label || undefined,
      keyboardAccessible,
    };
  }

  /**
   * Set viewport size
   */
  setViewport(preset: ViewportPreset | ViewportConfig): void {
    if (typeof preset === "string") {
      this.currentViewport = VIEWPORT_PRESETS[preset];
    } else {
      this.currentViewport = preset;
    }

    // Apply viewport to preview frame if possible
    const win = this.previewFrame?.getWindow();
    if (win && "resizeTo" in win) {
      // Note: This may not work in all contexts due to security restrictions
      try {
        win.resizeTo(this.currentViewport.width, this.currentViewport.height);
      } catch {
        // Ignore resize errors
      }
    }
  }

  /**
   * Get current viewport
   */
  getViewport(): ViewportConfig {
    return { ...this.currentViewport };
  }

  /**
   * Run a comprehensive test
   */
  async runTest(config: {
    selector: string;
    checkExists?: boolean;
    checkVisible?: boolean;
    checkStyles?: StyleCheckOptions[];
    checkAccessibility?: boolean;
    interaction?: InteractionOptions;
  }): Promise<TestResult> {
    const startTime = Date.now();
    const assertions: TestAssertion[] = [];
    const query: ElementQuery = { selector: config.selector };

    // Check exists
    if (config.checkExists !== false) {
      const exists = await this.elementExists(query);
      assertions.push({
        passed: exists,
        description: `Element "${config.selector}" exists`,
        error: exists ? undefined : "Element not found",
      });

      if (!exists) {
        return {
          success: false,
          assertions,
          duration: Date.now() - startTime,
          consoleLogs: this.consoleLogs,
        };
      }
    }

    // Check visible
    if (config.checkVisible) {
      const state = await this.getElementState(query);
      assertions.push({
        passed: state?.visible ?? false,
        description: `Element "${config.selector}" is visible`,
        error: state?.visible ? undefined : "Element is not visible",
      });
    }

    // Check styles
    if (config.checkStyles?.length) {
      const styleResult = await this.checkStyles(query, config.checkStyles);
      assertions.push(...styleResult.assertions);
    }

    // Check accessibility
    if (config.checkAccessibility) {
      const a11y = await this.checkAccessibility(query);
      assertions.push({
        passed: a11y.hasRole && a11y.hasLabel,
        description: `Element "${config.selector}" meets basic accessibility`,
        actual: { role: a11y.role, label: a11y.label },
        error:
          a11y.hasRole && a11y.hasLabel
            ? undefined
            : "Missing role or label for accessibility",
      });
    }

    // Perform interaction
    if (config.interaction) {
      const interactionResult = await this.interact(query, config.interaction);
      assertions.push(...interactionResult.assertions);
    }

    return {
      success: assertions.every((a) => a.passed),
      assertions,
      duration: Date.now() - startTime,
      consoleLogs: this.consoleLogs,
    };
  }

  /**
   * Invoke the tool (for AI agent integration)
   */
  async invoke(request: {
    action: string;
    selector?: string;
    styles?: StyleCheckOptions[];
    interaction?: InteractionType;
    viewport?: ViewportPreset;
    value?: string;
  }): Promise<TestResult | ElementState | AccessibilityCheck | boolean | null> {
    const query: ElementQuery = { selector: request.selector || "" };

    switch (request.action) {
      case "exists":
        return this.elementExists(query);

      case "getState":
        return this.getElementState(query);

      case "checkStyles":
        return this.checkStyles(query, request.styles || []);

      case "interact":
        return this.interact(query, {
          type: request.interaction || "click",
          value: request.value,
        });

      case "checkAccessibility":
        return this.checkAccessibility(query);

      case "setViewport":
        if (request.viewport) {
          this.setViewport(request.viewport);
        }
        return {
          success: true,
          assertions: [{ passed: true, description: "Viewport set" }],
          duration: 0,
        };

      case "runTest":
        return this.runTest({
          selector: request.selector || "",
          checkStyles: request.styles,
          interaction: request.interaction
            ? { type: request.interaction, value: request.value }
            : undefined,
        });

      default:
        return null;
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Find element by query
   */
  private async findElement(query: ElementQuery): Promise<Element | null> {
    const startTime = Date.now();
    const timeout = query.timeout || DEFAULT_TIMEOUT;

    while (Date.now() - startTime < timeout) {
      const element = this.queryElement(query);
      if (element) return element;
      await this.wait(100);
    }

    return null;
  }

  /**
   * Query element in frame
   */
  private queryElement(query: ElementQuery): Element | null {
    if (!this.previewFrame) return null;

    const parent = query.parent
      ? this.queryElement(query.parent)
      : this.previewFrame.getDocument();

    if (!parent) return null;

    switch (query.type) {
      case "xpath":
        const doc = this.previewFrame.getDocument();
        if (!doc) return null;
        const result = doc.evaluate(
          query.selector,
          parent,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return result.singleNodeValue as Element | null;

      case "id":
        return this.previewFrame.getDocument()?.getElementById(query.selector) || null;

      case "class":
        return parent.querySelector(`.${query.selector}`);

      case "tag":
        return parent.querySelector(query.selector);

      case "text":
        const elements = parent.querySelectorAll("*");
        for (const el of elements) {
          if (el.textContent?.includes(query.selector)) {
            return el;
          }
        }
        return null;

      case "css":
      default:
        return parent.querySelector(query.selector);
    }
  }

  /**
   * Check if element is visible
   */
  private isElementVisible(
    element: Element,
    computedStyle?: CSSStyleDeclaration
  ): boolean {
    if (!computedStyle) return false;

    const rect = element.getBoundingClientRect();
    return (
      computedStyle.display !== "none" &&
      computedStyle.visibility !== "hidden" &&
      parseFloat(computedStyle.opacity) > 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  /**
   * Get element attributes as object
   */
  private getElementAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of element.attributes) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  /**
   * Compare style values with optional tolerance
   */
  private compareStyleValues(
    actual: string,
    expected: string,
    tolerance?: number
  ): boolean {
    // Exact match
    if (actual === expected) return true;

    // Normalize values
    const normalizedActual = actual.toLowerCase().trim();
    const normalizedExpected = expected.toLowerCase().trim();
    if (normalizedActual === normalizedExpected) return true;

    // Numeric comparison with tolerance
    if (tolerance !== undefined) {
      const actualNum = parseFloat(actual);
      const expectedNum = parseFloat(expected);
      if (!isNaN(actualNum) && !isNaN(expectedNum)) {
        return Math.abs(actualNum - expectedNum) <= tolerance;
      }
    }

    return false;
  }

  /**
   * Get implicit ARIA role
   */
  private getImplicitRole(element: Element): string | null {
    const roleMap: Record<string, string> = {
      button: "button",
      a: "link",
      input: "textbox",
      img: "img",
      nav: "navigation",
      main: "main",
      header: "banner",
      footer: "contentinfo",
      article: "article",
      section: "region",
      form: "form",
      table: "table",
      ul: "list",
      ol: "list",
      li: "listitem",
    };

    return roleMap[element.tagName.toLowerCase()] || null;
  }

  /**
   * Find associated label for form element
   */
  private findAssociatedLabel(element: Element): string | null {
    const id = element.getAttribute("id");
    if (id) {
      const label = this.previewFrame
        ?.getDocument()
        ?.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent || null;
    }

    // Check for wrapping label
    const parentLabel = element.closest("label");
    if (parentLabel) return parentLabel.textContent || null;

    return null;
  }

  /**
   * Check if element is natively focusable
   */
  private isNativelyFocusable(element: Element): boolean {
    const focusableTags = ["a", "button", "input", "select", "textarea"];
    return (
      focusableTags.includes(element.tagName.toLowerCase()) &&
      !(element as HTMLButtonElement).disabled
    );
  }

  /**
   * Setup console log capture
   */
  private setupConsoleCapture(): void {
    this.consoleLogs = [];
    const win = this.previewFrame?.getWindow();
    if (!win) return;

    const originalConsole = win.console;
    const levels = ["log", "warn", "error", "info"] as const;

    for (const level of levels) {
      const original = originalConsole[level];
      (win.console as unknown as Record<string, unknown>)[level] = (
        ...args: unknown[]
      ) => {
        this.consoleLogs.push({
          level,
          message: args.map((a) => String(a)).join(" "),
        });
        original.apply(originalConsole, args);
      };
    }
  }

  /**
   * Wait for specified duration
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a BrowserTestTool instance
 */
export function createBrowserTestTool(previewFrame?: PreviewFrame): BrowserTestTool {
  return new BrowserTestTool(previewFrame);
}

export default BrowserTestTool;
