# Storybook Story Generator

Automatic generation of Storybook stories for React components.

## Overview

Storybook story generation includes:
1. Component analysis for props and variants
2. Story structure with proper typing
3. Args tables and controls
4. Interactive examples and states
5. Documentation integration

## Story Structure

```typescript
// Component story template
import type { Meta, StoryObj } from '@storybook/react';
import { Component } from './Component';

const meta: Meta<typeof Component> = {
  title: 'Category/Component',
  component: Component,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Component description here.',
      },
    },
  },
  argTypes: {
    // Control definitions
  },
};

export default meta;
type Story = StoryObj<typeof Component>;

export const Default: Story = {
  args: {
    // Default props
  },
};
```

## Story Generator

```typescript
interface StoryGeneratorConfig {
  componentPath: string;
  outputPath: string;
  category: string;
  includePlayground?: boolean;
  includeAccessibility?: boolean;
}

interface GeneratedStory {
  code: string;
  imports: string[];
  stories: StoryDefinition[];
}

interface StoryDefinition {
  name: string;
  description?: string;
  args: Record<string, unknown>;
  decorators?: string[];
  parameters?: Record<string, unknown>;
}

interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: unknown;
  description?: string;
  control?: ControlType;
}

type ControlType =
  | 'text'
  | 'boolean'
  | 'number'
  | 'range'
  | 'color'
  | 'date'
  | 'object'
  | 'select'
  | 'radio'
  | 'inline-radio'
  | 'check'
  | 'inline-check';

function generateStory(config: StoryGeneratorConfig): GeneratedStory {
  const component = analyzeComponent(config.componentPath);
  const stories = generateStories(component);
  const argTypes = generateArgTypes(component.props);

  return {
    code: buildStoryFile(component, stories, argTypes, config),
    imports: component.imports,
    stories,
  };
}
```

## Component Analysis

```typescript
interface ComponentAnalysis {
  name: string;
  displayName: string;
  props: PropDefinition[];
  variants: VariantDefinition[];
  imports: string[];
  hasForwardRef: boolean;
  defaultProps: Record<string, unknown>;
}

interface VariantDefinition {
  name: string;
  options: string[];
  defaultValue?: string;
}

function analyzeComponent(code: string): ComponentAnalysis {
  const analysis: ComponentAnalysis = {
    name: '',
    displayName: '',
    props: [],
    variants: [],
    imports: [],
    hasForwardRef: false,
    defaultProps: {},
  };

  // Extract component name
  const componentMatch = code.match(
    /(?:export\s+)?(?:const|function)\s+(\w+)/
  );
  if (componentMatch) {
    analysis.name = componentMatch[1];
    analysis.displayName = componentMatch[1];
  }

  // Check for forwardRef
  analysis.hasForwardRef = code.includes('forwardRef');

  // Extract props interface
  const propsMatch = code.match(
    /interface\s+(\w+Props)\s*\{([^}]+)\}/s
  );
  if (propsMatch) {
    analysis.props = parsePropsInterface(propsMatch[2]);
  }

  // Extract CVA variants
  const cvaMatch = code.match(
    /cva\s*\([^,]+,\s*\{[\s\S]*?variants:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/
  );
  if (cvaMatch) {
    analysis.variants = parseCVAVariants(cvaMatch[1]);
  }

  // Extract default props
  const defaultsMatch = code.match(
    /defaultVariants:\s*\{([^}]+)\}/
  );
  if (defaultsMatch) {
    analysis.defaultProps = parseDefaultVariants(defaultsMatch[1]);
  }

  return analysis;
}

function parsePropsInterface(propsCode: string): PropDefinition[] {
  const props: PropDefinition[] = [];
  const lines = propsCode.split('\n');

  for (const line of lines) {
    const match = line.match(
      /^\s*\/\*\*?\s*(.+?)\s*\*\/\s*$|^\s*(\w+)(\?)?:\s*(.+?);?\s*$/
    );
    if (match) {
      if (match[2]) {
        props.push({
          name: match[2],
          type: match[4].trim(),
          required: !match[3],
          control: inferControlType(match[4].trim()),
        });
      }
    }
  }

  return props;
}

function inferControlType(type: string): ControlType {
  if (type === 'boolean') return 'boolean';
  if (type === 'number') return 'number';
  if (type === 'string') return 'text';
  if (type.includes('|')) return 'select';
  if (type.startsWith('React.ReactNode')) return 'text';
  return 'object';
}
```

## ArgTypes Generation

```typescript
interface ArgTypeDefinition {
  control: { type: string; options?: string[] };
  description?: string;
  table?: {
    type?: { summary: string };
    defaultValue?: { summary: string };
    category?: string;
  };
}

function generateArgTypes(
  props: PropDefinition[],
  variants: VariantDefinition[]
): Record<string, ArgTypeDefinition> {
  const argTypes: Record<string, ArgTypeDefinition> = {};

  // Props-based argTypes
  for (const prop of props) {
    argTypes[prop.name] = {
      control: { type: prop.control || 'text' },
      description: prop.description,
      table: {
        type: { summary: prop.type },
        defaultValue: prop.defaultValue
          ? { summary: String(prop.defaultValue) }
          : undefined,
        category: 'Props',
      },
    };
  }

  // Variant-based argTypes
  for (const variant of variants) {
    argTypes[variant.name] = {
      control: { type: 'select', options: variant.options },
      description: `${variant.name} variant`,
      table: {
        type: { summary: variant.options.join(' | ') },
        defaultValue: variant.defaultValue
          ? { summary: variant.defaultValue }
          : undefined,
        category: 'Variants',
      },
    };
  }

  return argTypes;
}
```

## Story Templates

### Default Story

```typescript
const defaultStoryTemplate = (component: ComponentAnalysis): string => `
export const Default: Story = {
  args: {
    ${Object.entries(component.defaultProps)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(',\n    ')}
  },
};
`;
```

### Variant Stories

```typescript
function generateVariantStories(
  component: ComponentAnalysis
): StoryDefinition[] {
  const stories: StoryDefinition[] = [];

  for (const variant of component.variants) {
    for (const option of variant.options) {
      stories.push({
        name: capitalizeFirst(option),
        description: `${component.name} with ${variant.name}="${option}"`,
        args: {
          ...component.defaultProps,
          [variant.name]: option,
        },
      });
    }
  }

  return stories;
}

// Example output
const variantStoriesTemplate = `
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
};
`;
```

### Size Stories

```typescript
const sizeStoriesTemplate = `
export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small',
  },
};

export const Medium: Story = {
  args: {
    size: 'default',
    children: 'Medium',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large',
  },
};
`;
```

### State Stories

```typescript
const stateStoriesTemplate = `
export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <IconComponent className="mr-2 h-4 w-4" />
        With Icon
      </>
    ),
  },
};
`;
```

## Interactive Stories

### Play Functions

```typescript
import { within, userEvent, expect } from '@storybook/test';

const interactiveStoryTemplate = `
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find the button
    const button = canvas.getByRole('button');

    // Click it
    await userEvent.click(button);

    // Assert the result
    await expect(button).toHaveFocus();
  },
};
`;

const formInteractionTemplate = `
export const FormInteraction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill in form fields
    const emailInput = canvas.getByLabelText(/email/i);
    await userEvent.type(emailInput, 'user@example.com');

    const passwordInput = canvas.getByLabelText(/password/i);
    await userEvent.type(passwordInput, 'securepassword');

    // Submit form
    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Check for success state
    await expect(canvas.getByText(/success/i)).toBeInTheDocument();
  },
};
`;
```

### Keyboard Navigation

```typescript
const keyboardNavigationTemplate = `
export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Focus first item
    const firstItem = canvas.getAllByRole('menuitem')[0];
    firstItem.focus();

    // Navigate with arrow keys
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getAllByRole('menuitem')[1]).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getAllByRole('menuitem')[2]).toHaveFocus();

    // Select with Enter
    await userEvent.keyboard('{Enter}');
  },
};
`;
```

## Decorators

```typescript
// Theme decorator
const themeDecoratorTemplate = `
export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div className="dark bg-background p-8">
        <Story />
      </div>
    ),
  ],
};
`;

// Layout decorator
const layoutDecoratorTemplate = `
const meta: Meta<typeof Card> = {
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
};
`;

// Provider decorator
const providerDecoratorTemplate = `
const meta: Meta<typeof Component> = {
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="light">
        <Story />
      </ThemeProvider>
    ),
  ],
};
`;
```

## Complete Story File Generator

```typescript
function buildStoryFile(
  component: ComponentAnalysis,
  stories: StoryDefinition[],
  argTypes: Record<string, ArgTypeDefinition>,
  config: StoryGeneratorConfig
): string {
  const imports = [
    `import type { Meta, StoryObj } from '@storybook/react';`,
    `import { ${component.name} } from './${component.name}';`,
  ];

  if (config.includePlayground) {
    imports.push(`import { within, userEvent, expect } from '@storybook/test';`);
  }

  const meta = `
const meta: Meta<typeof ${component.name}> = {
  title: '${config.category}/${component.displayName}',
  component: ${component.name},
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '${component.displayName} component.',
      },
    },
  },
  argTypes: ${JSON.stringify(argTypes, null, 4)},
};

export default meta;
type Story = StoryObj<typeof ${component.name}>;
`;

  const storyCode = stories
    .map(
      (story) => `
export const ${story.name}: Story = {
  ${story.description ? `name: '${story.description}',` : ''}
  args: ${JSON.stringify(story.args, null, 4)},
  ${story.parameters ? `parameters: ${JSON.stringify(story.parameters, null, 4)},` : ''}
};
`
    )
    .join('\n');

  return `${imports.join('\n')}\n${meta}\n${storyCode}`;
}
```

## Button Example Output

```typescript
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A button component with multiple variants and sizes.',
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'The visual style variant',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'default' },
        category: 'Variants',
      },
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'default', 'lg', 'icon'],
      description: 'The size of the button',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'default' },
        category: 'Variants',
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'Props',
      },
    },
    asChild: {
      control: 'boolean',
      description: 'Render as child component',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'Props',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Default story
export const Default: Story = {
  args: {
    children: 'Button',
  },
};

// Variant stories
export const Primary: Story = {
  args: {
    variant: 'default',
    children: 'Primary',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link',
  },
};

// Size stories
export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large',
  },
};

// State stories
export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
  },
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

// All sizes showcase
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
```

## Card Example Output

```typescript
// Card.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './Card';
import { Button } from '../Button';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-[350px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content with any components.</p>
      </CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  ),
};

export const Simple: Story = {
  render: () => (
    <Card>
      <CardContent className="pt-6">
        <p>Simple card with just content.</p>
      </CardContent>
    </Card>
  ),
};

export const WithForm: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Enter your email below.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full gap-4">
          <div className="flex flex-col space-y-1.5">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              placeholder="Enter your email"
              className="rounded-md border px-3 py-2"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button>Submit</Button>
      </CardFooter>
    </Card>
  ),
};
```

## Integration with Agent

```typescript
// Generate stories for a component
async function generateComponentStories(
  componentPath: string,
  category: string
): Promise<void> {
  const code = await readFile(componentPath, 'utf-8');
  const component = analyzeComponent(code);

  const story = generateStory({
    componentPath,
    outputPath: componentPath.replace('.tsx', '.stories.tsx'),
    category,
    includePlayground: true,
    includeAccessibility: true,
  });

  await writeFile(
    componentPath.replace('.tsx', '.stories.tsx'),
    story.code
  );

  console.log(`Generated stories for ${component.name}:`);
  story.stories.forEach((s) => console.log(`  - ${s.name}`));
}

// Batch generate for component library
async function generateAllStories(
  componentsDir: string
): Promise<void> {
  const components = await glob(`${componentsDir}/**/*.tsx`);

  for (const componentPath of components) {
    // Skip existing stories
    if (componentPath.includes('.stories.')) continue;

    const category = inferCategory(componentPath);
    await generateComponentStories(componentPath, category);
  }
}

function inferCategory(path: string): string {
  if (path.includes('/ui/')) return 'Components';
  if (path.includes('/sections/')) return 'Sections';
  if (path.includes('/layouts/')) return 'Layouts';
  return 'Components';
}
```

## Key Takeaways

1. **Component Analysis**: Parse props, variants, and defaults from source
2. **Type Safety**: Generate typed Meta and StoryObj
3. **ArgTypes**: Auto-generate controls from prop types
4. **Variant Coverage**: Create stories for all variant combinations
5. **Interactive Testing**: Include play functions for interactions
6. **Decorators**: Wrap stories with themes and providers
7. **Documentation**: Auto-generate docs from component analysis
8. **Batch Generation**: Process entire component libraries
