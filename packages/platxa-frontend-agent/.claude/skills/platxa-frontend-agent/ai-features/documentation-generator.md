# Component Documentation Generator

Automated generation of JSDoc comments, usage examples, and Storybook stories.

## Overview

The documentation generator produces:
1. JSDoc comments for components and props
2. Usage examples with common patterns
3. Storybook stories for visual documentation
4. Props tables in markdown format
5. Accessibility notes and keyboard interactions

## Documentation Types

```typescript
interface ComponentDocumentation {
  jsdoc: string;
  propsTable: string;
  usageExamples: UsageExample[];
  storybookStory: string;
  accessibilityNotes: string[];
  keyboardInteractions: KeyboardInteraction[];
}

interface UsageExample {
  title: string;
  description: string;
  code: string;
  preview?: boolean;
}

interface KeyboardInteraction {
  key: string;
  action: string;
}

interface PropDocumentation {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description: string;
}
```

## JSDoc Generator

```typescript
interface JSDocConfig {
  includeExamples: boolean;
  includeSince: boolean;
  version?: string;
}

function generateJSDoc(
  component: ParsedComponent,
  config: JSDocConfig = { includeExamples: true, includeSince: false }
): string {
  const lines: string[] = ['/**'];

  // Component description
  lines.push(` * ${component.description || generateDescription(component)}`);
  lines.push(' *');

  // Examples
  if (config.includeExamples) {
    lines.push(' * @example');
    lines.push(' * ```tsx');
    lines.push(` * <${component.name} ${generateExampleProps(component.props)} />`);
    lines.push(' * ```');
    lines.push(' *');
  }

  // Props documentation
  for (const prop of component.props) {
    const typeStr = formatTypeForJSDoc(prop.type);
    const defaultStr = prop.defaultValue ? ` - Default: \`${prop.defaultValue}\`` : '';
    const requiredStr = prop.required ? '' : ' (optional)';

    lines.push(` * @param {${typeStr}} props.${prop.name}${requiredStr} ${prop.description}${defaultStr}`);
  }

  // Return type
  lines.push(' *');
  lines.push(' * @returns {JSX.Element} The rendered component');

  // Version info
  if (config.includeSince && config.version) {
    lines.push(` * @since ${config.version}`);
  }

  lines.push(' */');

  return lines.join('\n');
}

function generateDescription(component: ParsedComponent): string {
  const patterns = [];

  if (component.hasForwardRef) patterns.push('forwarded ref support');
  if (component.usedHooks.includes('useState')) patterns.push('stateful');
  if (component.usedHooks.includes('useEffect')) patterns.push('side effects');

  const patternStr = patterns.length > 0 ? ` with ${patterns.join(', ')}` : '';

  return `A ${component.category || 'UI'} component${patternStr}.`;
}

function formatTypeForJSDoc(type: string): string {
  // Convert TypeScript types to JSDoc format
  return type
    .replace(/\|/g, ' | ')
    .replace(/React\.ReactNode/g, 'React.ReactNode')
    .replace(/React\.ComponentPropsWithoutRef<"(\w+)">/g, 'React.HTMLAttributes<HTML$1Element>');
}

function generateExampleProps(props: PropDocumentation[]): string {
  const exampleProps = props
    .filter(p => p.required || isCommonProp(p.name))
    .map(p => {
      const value = getExampleValue(p);
      return `${p.name}=${value}`;
    });

  return exampleProps.join(' ');
}

function getExampleValue(prop: PropDocumentation): string {
  const valueMap: Record<string, string> = {
    variant: '"default"',
    size: '"md"',
    disabled: '{false}',
    onClick: '{handleClick}',
    onChange: '{handleChange}',
    children: '"Button"',
    className: '"custom-class"',
    label: '"Label"',
    placeholder: '"Enter text..."',
    value: '{value}',
    href: '"/path"',
    src: '"/image.jpg"',
    alt: '"Description"',
  };

  if (valueMap[prop.name]) return valueMap[prop.name];
  if (prop.type === 'boolean') return '{true}';
  if (prop.type === 'string') return `"${prop.name}"`;
  if (prop.type === 'number') return '{0}';
  if (prop.type.includes('ReactNode')) return '{children}';

  return `{${prop.name}}`;
}

function isCommonProp(name: string): boolean {
  return ['variant', 'size', 'children', 'label'].includes(name);
}
```

## Props Table Generator

```typescript
function generatePropsTable(props: PropDocumentation[]): string {
  const lines: string[] = [
    '## Props',
    '',
    '| Prop | Type | Required | Default | Description |',
    '|------|------|----------|---------|-------------|',
  ];

  for (const prop of props) {
    const required = prop.required ? '✓' : '-';
    const defaultVal = prop.defaultValue || '-';
    const type = `\`${escapeMarkdown(prop.type)}\``;

    lines.push(`| ${prop.name} | ${type} | ${required} | ${defaultVal} | ${prop.description} |`);
  }

  return lines.join('\n');
}

function escapeMarkdown(str: string): string {
  return str.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Extended props table with categories
function generateCategorizedPropsTable(props: PropDocumentation[]): string {
  const categories = categorizeProps(props);
  const sections: string[] = ['## Props'];

  for (const [category, categoryProps] of Object.entries(categories)) {
    if (categoryProps.length === 0) continue;

    sections.push(`\n### ${category}\n`);
    sections.push('| Prop | Type | Default | Description |');
    sections.push('|------|------|---------|-------------|');

    for (const prop of categoryProps) {
      const defaultVal = prop.defaultValue || '-';
      const type = `\`${escapeMarkdown(prop.type)}\``;
      const required = prop.required ? ' *' : '';

      sections.push(`| ${prop.name}${required} | ${type} | ${defaultVal} | ${prop.description} |`);
    }
  }

  sections.push('\n*Required props are marked with asterisk');

  return sections.join('\n');
}

function categorizeProps(props: PropDocumentation[]): Record<string, PropDocumentation[]> {
  return {
    'Core': props.filter(p => ['children', 'className', 'style'].includes(p.name)),
    'Appearance': props.filter(p => ['variant', 'size', 'color', 'disabled'].includes(p.name)),
    'Behavior': props.filter(p => p.name.startsWith('on') || ['value', 'defaultValue', 'checked'].includes(p.name)),
    'Accessibility': props.filter(p => p.name.startsWith('aria') || ['role', 'tabIndex', 'id'].includes(p.name)),
    'Other': props.filter(p => !isInCategory(p.name)),
  };
}

function isInCategory(name: string): boolean {
  const allCategories = ['children', 'className', 'style', 'variant', 'size', 'color', 'disabled', 'value', 'defaultValue', 'checked', 'role', 'tabIndex', 'id'];
  return allCategories.includes(name) || name.startsWith('on') || name.startsWith('aria');
}
```

## Usage Examples Generator

```typescript
function generateUsageExamples(component: ParsedComponent): UsageExample[] {
  const examples: UsageExample[] = [];

  // Basic usage
  examples.push({
    title: 'Basic Usage',
    description: `Simple ${component.name} example`,
    code: generateBasicExample(component),
    preview: true,
  });

  // With variants (if component has variants)
  if (hasVariants(component)) {
    examples.push({
      title: 'Variants',
      description: 'Available style variants',
      code: generateVariantsExample(component),
      preview: true,
    });
  }

  // With sizes (if component has sizes)
  if (hasSizes(component)) {
    examples.push({
      title: 'Sizes',
      description: 'Available size options',
      code: generateSizesExample(component),
      preview: true,
    });
  }

  // Controlled usage (if applicable)
  if (isControllable(component)) {
    examples.push({
      title: 'Controlled',
      description: 'Controlled component with state',
      code: generateControlledExample(component),
      preview: false,
    });
  }

  // With custom styling
  examples.push({
    title: 'Custom Styling',
    description: 'Customizing with className',
    code: generateCustomStyleExample(component),
    preview: true,
  });

  return examples;
}

function generateBasicExample(component: ParsedComponent): string {
  const requiredProps = component.props.filter(p => p.required);
  const propsStr = requiredProps.map(p => `${p.name}=${getExampleValue(p)}`).join(' ');

  return `import { ${component.name} } from '@/components/ui/${kebabCase(component.name)}'

export default function Example() {
  return (
    <${component.name}${propsStr ? ' ' + propsStr : ''}>
      ${component.props.some(p => p.name === 'children') ? 'Content' : ''}
    </${component.name}>
  )
}`;
}

function generateVariantsExample(component: ParsedComponent): string {
  const variantProp = component.props.find(p => p.name === 'variant');
  if (!variantProp) return '';

  const variants = extractVariantValues(variantProp.type);

  return `import { ${component.name} } from '@/components/ui/${kebabCase(component.name)}'

export default function Example() {
  return (
    <div className="flex gap-4">
      ${variants.map(v => `<${component.name} variant="${v}">${v}</${component.name}>`).join('\n      ')}
    </div>
  )
}`;
}

function generateSizesExample(component: ParsedComponent): string {
  const sizeProp = component.props.find(p => p.name === 'size');
  if (!sizeProp) return '';

  const sizes = extractVariantValues(sizeProp.type);

  return `import { ${component.name} } from '@/components/ui/${kebabCase(component.name)}'

export default function Example() {
  return (
    <div className="flex items-center gap-4">
      ${sizes.map(s => `<${component.name} size="${s}">${s}</${component.name}>`).join('\n      ')}
    </div>
  )
}`;
}

function generateControlledExample(component: ParsedComponent): string {
  return `import { useState } from 'react'
import { ${component.name} } from '@/components/ui/${kebabCase(component.name)}'

export default function Example() {
  const [value, setValue] = useState('')

  return (
    <${component.name}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}`;
}

function generateCustomStyleExample(component: ParsedComponent): string {
  return `import { ${component.name} } from '@/components/ui/${kebabCase(component.name)}'

export default function Example() {
  return (
    <${component.name}
      className="custom-class"
    >
      Styled ${component.name}
    </${component.name}>
  )
}`;
}

function extractVariantValues(type: string): string[] {
  const match = type.match(/'([^']+)'/g);
  return match ? match.map(m => m.replace(/'/g, '')) : ['default'];
}

function hasVariants(component: ParsedComponent): boolean {
  return component.props.some(p => p.name === 'variant');
}

function hasSizes(component: ParsedComponent): boolean {
  return component.props.some(p => p.name === 'size');
}

function isControllable(component: ParsedComponent): boolean {
  return component.props.some(p => p.name === 'value' || p.name === 'checked');
}

function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
```

## Storybook Story Generator

```typescript
function generateStorybookStory(component: ParsedComponent): string {
  const componentName = component.name;
  const kebabName = kebabCase(componentName);

  return `import type { Meta, StoryObj } from '@storybook/react'
import { ${componentName} } from '@/components/ui/${kebabName}'

const meta: Meta<typeof ${componentName}> = {
  title: 'UI/${componentName}',
  component: ${componentName},
  tags: ['autodocs'],
  argTypes: {
${generateArgTypes(component.props)}
  },
}

export default meta
type Story = StoryObj<typeof ${componentName}>

export const Default: Story = {
  args: {
${generateDefaultArgs(component.props)}
  },
}

${generateVariantStories(component)}
${generateSizeStories(component)}
${generateStateStories(component)}
`;
}

function generateArgTypes(props: PropDocumentation[]): string {
  return props.map(prop => {
    const control = getStorybookControl(prop);
    return `    ${prop.name}: {
      description: '${prop.description}',
      control: ${control},
      ${prop.defaultValue ? `defaultValue: ${formatDefaultValue(prop.defaultValue)},` : ''}
    },`;
  }).join('\n');
}

function getStorybookControl(prop: PropDocumentation): string {
  if (prop.type === 'boolean') return '{ type: "boolean" }';
  if (prop.type === 'string') return '{ type: "text" }';
  if (prop.type === 'number') return '{ type: "number" }';
  if (prop.type.includes('|')) {
    const options = extractVariantValues(prop.type);
    return `{ type: "select", options: [${options.map(o => `"${o}"`).join(', ')}] }`;
  }
  return '{ type: "text" }';
}

function generateDefaultArgs(props: PropDocumentation[]): string {
  return props
    .filter(p => p.required || isCommonProp(p.name))
    .map(prop => {
      const value = prop.defaultValue || getDefaultArgValue(prop);
      return `    ${prop.name}: ${value},`;
    })
    .join('\n');
}

function getDefaultArgValue(prop: PropDocumentation): string {
  if (prop.type === 'boolean') return 'false';
  if (prop.type === 'string') return '""';
  if (prop.type === 'number') return '0';
  if (prop.name === 'children') return '"Button"';
  return 'undefined';
}

function formatDefaultValue(value: string): string {
  if (value === 'true' || value === 'false') return value;
  if (!isNaN(Number(value))) return value;
  return `"${value}"`;
}

function generateVariantStories(component: ParsedComponent): string {
  const variantProp = component.props.find(p => p.name === 'variant');
  if (!variantProp) return '';

  const variants = extractVariantValues(variantProp.type);

  return variants.map(variant => `
export const ${pascalCase(variant)}: Story = {
  args: {
    ...Default.args,
    variant: '${variant}',
  },
}`).join('\n');
}

function generateSizeStories(component: ParsedComponent): string {
  const sizeProp = component.props.find(p => p.name === 'size');
  if (!sizeProp) return '';

  const sizes = extractVariantValues(sizeProp.type);

  return `
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      ${sizes.map(s => `<${component.name} size="${s}">${s}</${component.name}>`).join('\n      ')}
    </div>
  ),
}`;
}

function generateStateStories(component: ParsedComponent): string {
  const hasDisabled = component.props.some(p => p.name === 'disabled');
  const hasLoading = component.props.some(p => p.name === 'loading');

  let stories = '';

  if (hasDisabled) {
    stories += `
export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
}`;
  }

  if (hasLoading) {
    stories += `
export const Loading: Story = {
  args: {
    ...Default.args,
    loading: true,
  },
}`;
  }

  return stories;
}

function pascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```

## Accessibility Documentation

```typescript
function generateAccessibilityNotes(component: ParsedComponent): string[] {
  const notes: string[] = [];

  // Check for aria props
  const ariaProps = component.props.filter(p => p.name.startsWith('aria'));
  if (ariaProps.length > 0) {
    notes.push(`Supports ARIA attributes: ${ariaProps.map(p => p.name).join(', ')}`);
  }

  // Check for role prop
  if (component.props.some(p => p.name === 'role')) {
    notes.push('Accepts custom role attribute for semantic markup');
  }

  // Check for keyboard handling
  if (component.usedHooks.includes('useKeyboard') || component.source.includes('onKeyDown')) {
    notes.push('Includes keyboard interaction support');
  }

  // Component-specific notes
  const componentNotes = getComponentSpecificNotes(component.name);
  notes.push(...componentNotes);

  return notes;
}

function getComponentSpecificNotes(name: string): string[] {
  const notesMap: Record<string, string[]> = {
    Button: [
      'Uses native button element for built-in accessibility',
      'Disabled state properly announced by screen readers',
      'Focus indicator visible by default',
    ],
    Input: [
      'Associate with label using id or wrap in label element',
      'Error states should use aria-invalid and aria-describedby',
      'Placeholder is not a substitute for labels',
    ],
    Dialog: [
      'Focus trapped within dialog when open',
      'Escape key closes the dialog',
      'Focus returns to trigger element on close',
    ],
    Select: [
      'Keyboard navigation with arrow keys',
      'Type-ahead search for quick selection',
      'Proper ARIA roles: combobox, listbox, option',
    ],
    Tabs: [
      'Arrow keys navigate between tabs',
      'Tab panels associated with tabs via aria-controls',
      'Only active tab in focus order',
    ],
  };

  return notesMap[name] || [];
}

function generateKeyboardInteractions(component: ParsedComponent): KeyboardInteraction[] {
  const interactions: KeyboardInteraction[] = [];

  const keyboardMap: Record<string, KeyboardInteraction[]> = {
    Button: [
      { key: 'Enter', action: 'Activates the button' },
      { key: 'Space', action: 'Activates the button' },
    ],
    Input: [
      { key: 'Tab', action: 'Moves focus to/from the input' },
    ],
    Dialog: [
      { key: 'Escape', action: 'Closes the dialog' },
      { key: 'Tab', action: 'Cycles focus within dialog' },
    ],
    Select: [
      { key: 'Enter/Space', action: 'Opens/closes the dropdown' },
      { key: 'ArrowDown/Up', action: 'Navigates options' },
      { key: 'Home/End', action: 'Jumps to first/last option' },
      { key: 'Escape', action: 'Closes the dropdown' },
    ],
    Tabs: [
      { key: 'ArrowLeft/Right', action: 'Switches between tabs' },
      { key: 'Home/End', action: 'Goes to first/last tab' },
    ],
    Accordion: [
      { key: 'Enter/Space', action: 'Toggles section' },
      { key: 'ArrowDown/Up', action: 'Moves to next/previous header' },
    ],
  };

  return keyboardMap[component.name] || interactions;
}
```

## Full Documentation Generator

```typescript
class ComponentDocumentationGenerator {
  generate(component: ParsedComponent): ComponentDocumentation {
    return {
      jsdoc: generateJSDoc(component),
      propsTable: generateCategorizedPropsTable(component.props),
      usageExamples: generateUsageExamples(component),
      storybookStory: generateStorybookStory(component),
      accessibilityNotes: generateAccessibilityNotes(component),
      keyboardInteractions: generateKeyboardInteractions(component),
    };
  }

  generateMarkdown(component: ParsedComponent): string {
    const doc = this.generate(component);

    return `# ${component.name}

${component.description || generateDescription(component)}

${doc.propsTable}

## Usage

${doc.usageExamples.map(ex => `
### ${ex.title}

${ex.description}

\`\`\`tsx
${ex.code}
\`\`\`
`).join('\n')}

## Accessibility

${doc.accessibilityNotes.map(note => `- ${note}`).join('\n')}

### Keyboard Interactions

| Key | Action |
|-----|--------|
${doc.keyboardInteractions.map(ki => `| \`${ki.key}\` | ${ki.action} |`).join('\n')}
`;
  }

  generateWithJSDoc(code: string, component: ParsedComponent): string {
    const jsdoc = generateJSDoc(component);

    // Find the component declaration and prepend JSDoc
    const patterns = [
      /export\s+(const|function)\s+\w+/,
      /const\s+\w+\s*=\s*React\.forwardRef/,
    ];

    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match && match.index !== undefined) {
        return (
          code.slice(0, match.index) +
          jsdoc +
          '\n' +
          code.slice(match.index)
        );
      }
    }

    return jsdoc + '\n' + code;
  }
}
```

## Integration with Agent

```typescript
// Post-generation documentation
async function addDocumentation(
  generatedCode: string,
  component: ParsedComponent
): Promise<{ code: string; docs: string; story: string }> {
  const generator = new ComponentDocumentationGenerator();
  const doc = generator.generate(component);

  // Add JSDoc to code
  const codeWithJSDoc = generator.generateWithJSDoc(generatedCode, component);

  // Generate markdown documentation
  const markdownDocs = generator.generateMarkdown(component);

  return {
    code: codeWithJSDoc,
    docs: markdownDocs,
    story: doc.storybookStory,
  };
}

// Usage in workflow
async function generateDocumentedComponent(
  request: ComponentRequest
): Promise<DocumentedComponent> {
  const component = await generateComponent(request);
  const parsed = parseComponent(component.code, component.filename);

  const { code, docs, story } = await addDocumentation(component.code, parsed);

  return {
    ...component,
    code,
    documentation: docs,
    storybookStory: story,
  };
}
```

## Key Takeaways

1. **JSDoc Generation**: Auto-generate comprehensive JSDoc comments
2. **Props Tables**: Categorized, markdown-formatted props documentation
3. **Usage Examples**: Basic, variants, sizes, controlled patterns
4. **Storybook Stories**: Ready-to-use story files with argTypes
5. **Accessibility Notes**: Component-specific a11y guidance
6. **Keyboard Interactions**: Document all keyboard shortcuts
7. **Full Markdown**: Complete component documentation in markdown
