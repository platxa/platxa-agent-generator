# Visual Regression Test Setup

Automated visual regression testing for React components using snapshot testing.

## Overview

Visual regression testing includes:
1. Component snapshot capture and comparison
2. Playwright visual testing integration
3. Storybook snapshot automation
4. Diff detection and threshold configuration
5. CI/CD pipeline integration

## Testing Stack

```typescript
// Recommended tools
interface VisualTestingStack {
  snapshotTesting: 'jest' | 'vitest';
  visualTesting: 'playwright' | 'cypress';
  storybookTesting: '@storybook/test-runner';
  diffEngine: 'pixelmatch' | 'playwright-builtin';
}

const recommendedStack: VisualTestingStack = {
  snapshotTesting: 'vitest',
  visualTesting: 'playwright',
  storybookTesting: '@storybook/test-runner',
  diffEngine: 'playwright-builtin',
};
```

## Jest/Vitest Snapshot Testing

### Setup Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

### Component Snapshot Test

```typescript
// Button.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders default variant correctly', () => {
    const { container } = render(<Button>Click me</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders all variants correctly', () => {
    const variants = [
      'default',
      'destructive',
      'outline',
      'secondary',
      'ghost',
      'link',
    ] as const;

    variants.forEach((variant) => {
      const { container } = render(
        <Button variant={variant}>{variant}</Button>
      );
      expect(container.firstChild).toMatchSnapshot(`variant-${variant}`);
    });
  });

  it('renders all sizes correctly', () => {
    const sizes = ['sm', 'default', 'lg', 'icon'] as const;

    sizes.forEach((size) => {
      const { container } = render(<Button size={size}>{size}</Button>);
      expect(container.firstChild).toMatchSnapshot(`size-${size}`);
    });
  });

  it('renders disabled state correctly', () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    expect(container.firstChild).toMatchSnapshot('disabled');
  });
});
```

### Inline Snapshot Testing

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders with correct classes', () => {
    const { container } = render(<Badge>New</Badge>);

    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80"
      >
        New
      </div>
    `);
  });
});
```

## Playwright Visual Testing

### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  snapshotDir: './tests/visual/__snapshots__',
  snapshotPathTemplate:
    '{snapshotDir}/{testFilePath}/{arg}-{projectName}{ext}',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
  ],

  use: {
    baseURL: 'http://localhost:6006', // Storybook
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: 'disabled',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'pnpm storybook',
    url: 'http://localhost:6006',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### Visual Test File

```typescript
// tests/visual/button.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Button Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/iframe.html?id=components-button--default');
  });

  test('default button matches snapshot', async ({ page }) => {
    const button = page.locator('button');
    await expect(button).toHaveScreenshot('button-default.png');
  });

  test('all variants match snapshots', async ({ page }) => {
    const variants = [
      'default',
      'destructive',
      'outline',
      'secondary',
      'ghost',
      'link',
    ];

    for (const variant of variants) {
      await page.goto(
        `/iframe.html?id=components-button--${variant.toLowerCase()}`
      );
      const button = page.locator('button');
      await expect(button).toHaveScreenshot(`button-${variant}.png`);
    }
  });

  test('hover state matches snapshot', async ({ page }) => {
    const button = page.locator('button');
    await button.hover();
    await expect(button).toHaveScreenshot('button-hover.png');
  });

  test('focus state matches snapshot', async ({ page }) => {
    const button = page.locator('button');
    await button.focus();
    await expect(button).toHaveScreenshot('button-focus.png');
  });

  test('disabled state matches snapshot', async ({ page }) => {
    await page.goto('/iframe.html?id=components-button--disabled');
    const button = page.locator('button');
    await expect(button).toHaveScreenshot('button-disabled.png');
  });
});
```

### Full Page Snapshots

```typescript
// tests/visual/pages.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Page Visual Tests', () => {
  test('landing page matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for animations to complete
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('landing-page.png', {
      fullPage: true,
    });
  });

  test('dashboard matches snapshot', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      mask: [page.locator('.timestamp')], // Mask dynamic content
    });
  });
});
```

## Storybook Test Runner

### Installation

```bash
pnpm add -D @storybook/test-runner playwright
```

### Configuration

```typescript
// .storybook/test-runner.ts
import type { TestRunnerConfig } from '@storybook/test-runner';
import { toMatchImageSnapshot } from 'jest-image-snapshot';

const config: TestRunnerConfig = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },

  async postVisit(page, context) {
    // Wait for animations
    await page.waitForTimeout(200);

    // Take screenshot
    const image = await page.screenshot();

    // Compare with snapshot
    expect(image).toMatchImageSnapshot({
      customSnapshotsDir: `__snapshots__/${context.id}`,
      customSnapshotIdentifier: context.name,
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    });
  },
};

export default config;
```

### Running Tests

```bash
# Run test runner
pnpm test-storybook

# Update snapshots
pnpm test-storybook --updateSnapshot

# Run specific stories
pnpm test-storybook --stories="**/Button.stories.*"
```

## Component Test Generator

```typescript
interface VisualTestConfig {
  component: string;
  variants?: string[];
  sizes?: string[];
  states?: string[];
  interactions?: InteractionTest[];
  viewports?: Viewport[];
}

interface InteractionTest {
  name: string;
  action: 'hover' | 'focus' | 'click' | 'type';
  selector?: string;
  value?: string;
}

interface Viewport {
  name: string;
  width: number;
  height: number;
}

function generateVisualTests(config: VisualTestConfig): string {
  const tests: string[] = [];

  // Default snapshot
  tests.push(`
  test('${config.component} default matches snapshot', async ({ page }) => {
    await page.goto('/iframe.html?id=components-${config.component.toLowerCase()}--default');
    const component = page.locator('[data-testid="${config.component.toLowerCase()}"]').first();
    await expect(component).toHaveScreenshot('${config.component.toLowerCase()}-default.png');
  });
`);

  // Variant tests
  if (config.variants) {
    for (const variant of config.variants) {
      tests.push(`
  test('${config.component} ${variant} matches snapshot', async ({ page }) => {
    await page.goto('/iframe.html?id=components-${config.component.toLowerCase()}--${variant}');
    const component = page.locator('[data-testid="${config.component.toLowerCase()}"]').first();
    await expect(component).toHaveScreenshot('${config.component.toLowerCase()}-${variant}.png');
  });
`);
    }
  }

  // Size tests
  if (config.sizes) {
    for (const size of config.sizes) {
      tests.push(`
  test('${config.component} size ${size} matches snapshot', async ({ page }) => {
    await page.goto('/iframe.html?id=components-${config.component.toLowerCase()}--${size}');
    const component = page.locator('[data-testid="${config.component.toLowerCase()}"]').first();
    await expect(component).toHaveScreenshot('${config.component.toLowerCase()}-size-${size}.png');
  });
`);
    }
  }

  // State tests
  if (config.states) {
    for (const state of config.states) {
      tests.push(`
  test('${config.component} ${state} state matches snapshot', async ({ page }) => {
    await page.goto('/iframe.html?id=components-${config.component.toLowerCase()}--${state}');
    const component = page.locator('[data-testid="${config.component.toLowerCase()}"]').first();
    await expect(component).toHaveScreenshot('${config.component.toLowerCase()}-${state}.png');
  });
`);
    }
  }

  // Interaction tests
  if (config.interactions) {
    for (const interaction of config.interactions) {
      tests.push(`
  test('${config.component} ${interaction.name} matches snapshot', async ({ page }) => {
    await page.goto('/iframe.html?id=components-${config.component.toLowerCase()}--default');
    const component = page.locator('[data-testid="${config.component.toLowerCase()}"]').first();
    ${generateInteractionCode(interaction)}
    await expect(component).toHaveScreenshot('${config.component.toLowerCase()}-${interaction.name}.png');
  });
`);
    }
  }

  // Viewport tests
  if (config.viewports) {
    for (const viewport of config.viewports) {
      tests.push(`
  test('${config.component} on ${viewport.name} matches snapshot', async ({ page }) => {
    await page.setViewportSize({ width: ${viewport.width}, height: ${viewport.height} });
    await page.goto('/iframe.html?id=components-${config.component.toLowerCase()}--default');
    const component = page.locator('[data-testid="${config.component.toLowerCase()}"]').first();
    await expect(component).toHaveScreenshot('${config.component.toLowerCase()}-${viewport.name}.png');
  });
`);
    }
  }

  return `
import { test, expect } from '@playwright/test';

test.describe('${config.component} Visual Tests', () => {
  ${tests.join('\n')}
});
`;
}

function generateInteractionCode(interaction: InteractionTest): string {
  const selector = interaction.selector || 'component';

  switch (interaction.action) {
    case 'hover':
      return `await ${selector}.hover();`;
    case 'focus':
      return `await ${selector}.focus();`;
    case 'click':
      return `await ${selector}.click();`;
    case 'type':
      return `await ${selector}.fill('${interaction.value || ''}');`;
    default:
      return '';
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/visual-tests.yml
name: Visual Regression Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Build Storybook
        run: pnpm build-storybook

      - name: Serve Storybook and run tests
        run: |
          npx http-server storybook-static --port 6006 &
          sleep 5
          pnpm test:visual

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: visual-test-results
          path: |
            playwright-report/
            test-results/
          retention-days: 30

      - name: Upload diff images
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: visual-diff-images
          path: tests/visual/__snapshots__/**/*-diff.png
          retention-days: 7
```

### Snapshot Update Workflow

```yaml
# .github/workflows/update-snapshots.yml
name: Update Visual Snapshots

on:
  workflow_dispatch:
  issue_comment:
    types: [created]

jobs:
  update-snapshots:
    if: >
      github.event_name == 'workflow_dispatch' ||
      (github.event.issue.pull_request && contains(github.event.comment.body, '/update-snapshots'))
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Update snapshots
        run: pnpm test:visual --update-snapshots

      - name: Commit updated snapshots
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add tests/visual/__snapshots__
          git commit -m "chore: update visual snapshots" || exit 0
          git push
```

## Snapshot Management

### Snapshot Utilities

```typescript
// tests/utils/snapshot-helpers.ts
import { Page, expect } from '@playwright/test';

interface SnapshotOptions {
  name: string;
  mask?: string[];
  threshold?: number;
  maxDiffPixels?: number;
  animations?: 'disabled' | 'allow';
}

export async function takeComponentSnapshot(
  page: Page,
  selector: string,
  options: SnapshotOptions
) {
  const element = page.locator(selector).first();

  // Wait for element to be visible
  await element.waitFor({ state: 'visible' });

  // Wait for any animations
  if (options.animations !== 'allow') {
    await page.evaluate(() => {
      document.body.style.setProperty('--animation-duration', '0s');
    });
    await page.waitForTimeout(100);
  }

  // Build mask locators
  const maskLocators = options.mask?.map((m) => page.locator(m)) || [];

  await expect(element).toHaveScreenshot(`${options.name}.png`, {
    mask: maskLocators,
    threshold: options.threshold ?? 0.2,
    maxDiffPixels: options.maxDiffPixels ?? 100,
    animations: options.animations ?? 'disabled',
  });
}

export async function takeFullPageSnapshot(
  page: Page,
  options: SnapshotOptions
) {
  await page.waitForLoadState('networkidle');

  // Mask dynamic content
  const maskLocators = options.mask?.map((m) => page.locator(m)) || [];

  await expect(page).toHaveScreenshot(`${options.name}.png`, {
    fullPage: true,
    mask: maskLocators,
    threshold: options.threshold ?? 0.2,
    maxDiffPixels: options.maxDiffPixels ?? 500,
    animations: 'disabled',
  });
}

export async function compareWithBaseline(
  page: Page,
  baselineUrl: string,
  currentSelector: string
) {
  // Navigate to baseline
  await page.goto(baselineUrl);
  const baselineScreenshot = await page.locator(currentSelector).screenshot();

  // Navigate to current
  await page.goBack();
  const currentScreenshot = await page.locator(currentSelector).screenshot();

  // Compare
  expect(currentScreenshot).toMatchSnapshot({
    name: 'comparison.png',
    threshold: 0.1,
  });
}
```

### Dynamic Content Handling

```typescript
// tests/utils/dynamic-content.ts
import { Page } from '@playwright/test';

export async function maskDynamicContent(page: Page) {
  // Hide timestamps
  await page.addStyleTag({
    content: `
      [data-testid="timestamp"],
      .timestamp,
      time {
        visibility: hidden !important;
      }
    `,
  });

  // Replace avatars with placeholder
  await page.evaluate(() => {
    document.querySelectorAll('img[data-testid="avatar"]').forEach((img) => {
      (img as HTMLImageElement).src = 'data:image/svg+xml,...';
    });
  });

  // Freeze animations
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `;
    document.head.appendChild(style);
  });
}

export async function waitForStableContent(page: Page, timeout = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const before = await page.screenshot();
    await page.waitForTimeout(100);
    const after = await page.screenshot();

    if (before.equals(after)) {
      return;
    }
  }

  throw new Error('Content did not stabilize within timeout');
}
```

## Theme Testing

```typescript
// tests/visual/themes.spec.ts
import { test, expect } from '@playwright/test';

const themes = ['light', 'dark'] as const;
const components = ['button', 'card', 'input', 'dialog'];

test.describe('Theme Visual Tests', () => {
  for (const theme of themes) {
    test.describe(`${theme} theme`, () => {
      test.beforeEach(async ({ page }) => {
        // Set theme
        await page.addInitScript((t) => {
          document.documentElement.classList.add(t);
        }, theme);
      });

      for (const component of components) {
        test(`${component} matches ${theme} snapshot`, async ({ page }) => {
          await page.goto(
            `/iframe.html?id=components-${component}--default&globals=theme:${theme}`
          );

          const element = page.locator(`[data-testid="${component}"]`).first();
          await expect(element).toHaveScreenshot(
            `${component}-${theme}.png`
          );
        });
      }
    });
  }
});
```

## Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:snapshot": "vitest --update",
    "test:visual": "playwright test",
    "test:visual:update": "playwright test --update-snapshots",
    "test:visual:ui": "playwright test --ui",
    "test:storybook": "test-storybook",
    "test:storybook:update": "test-storybook --updateSnapshot"
  }
}
```

## Key Takeaways

1. **Snapshot Testing**: Jest/Vitest for component DOM snapshots
2. **Visual Testing**: Playwright for pixel-perfect comparisons
3. **Storybook Integration**: Test runner for story-based testing
4. **Threshold Config**: Set appropriate diff tolerances
5. **Dynamic Content**: Mask timestamps, avatars, animations
6. **Theme Coverage**: Test both light and dark modes
7. **CI/CD Pipeline**: Automated testing and snapshot updates
8. **Viewport Testing**: Cover mobile and desktop breakpoints
