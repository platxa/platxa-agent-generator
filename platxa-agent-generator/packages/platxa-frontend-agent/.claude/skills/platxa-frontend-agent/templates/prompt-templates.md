# Six-Element Prompt Template System

Structured prompt templates for generating high-quality React components. Research shows structured prompts yield 3x better code quality than unstructured requests.

## The Six Elements

Every component generation prompt should include these six elements:

| # | Element | Purpose | Example |
|---|---------|---------|---------|
| 1 | **Framework** | Technology stack context | React 18, TypeScript, Tailwind |
| 2 | **Purpose** | What the component does | "A button that submits forms" |
| 3 | **Props** | Expected interface | variant, size, disabled, onClick |
| 4 | **Styling** | Visual requirements | Colors, spacing, effects |
| 5 | **Accessibility** | A11y requirements | ARIA, keyboard, focus |
| 6 | **Edge Cases** | Error states, boundaries | Loading, empty, error states |

## Template Structure

```xml
<component_request>
  <framework>
    <library>React 18</library>
    <language>TypeScript (strict mode)</language>
    <styling>Tailwind CSS v4</styling>
    <patterns>shadcn/ui, CVA, Radix UI</patterns>
  </framework>

  <purpose>
    <name>{ComponentName}</name>
    <description>{What it does}</description>
    <use_cases>
      <case>{Primary use case}</case>
      <case>{Secondary use case}</case>
    </use_cases>
  </purpose>

  <props>
    <prop name="{name}" type="{type}" required="{true|false}">
      {Description}
    </prop>
    <!-- Additional props -->
  </props>

  <styling>
    <colors>{Color requirements}</colors>
    <typography>{Text styling}</typography>
    <spacing>{Padding, margins, gaps}</spacing>
    <effects>{Shadows, borders, animations}</effects>
    <responsive>{Breakpoint behavior}</responsive>
  </styling>

  <accessibility>
    <role>{ARIA role if needed}</role>
    <keyboard>{Required keyboard interactions}</keyboard>
    <labels>{ARIA labels needed}</labels>
    <focus>{Focus management requirements}</focus>
    <announcements>{Screen reader announcements}</announcements>
  </accessibility>

  <edge_cases>
    <case name="{case_name}">
      <condition>{When this occurs}</condition>
      <behavior>{Expected behavior}</behavior>
    </case>
    <!-- Additional edge cases -->
  </edge_cases>
</component_request>
```

## Element 1: Framework

Establishes the technical context for code generation.

### Standard Framework Block

```xml
<framework>
  <library>React 18</library>
  <language>TypeScript</language>
  <type_strictness>strict (no any types)</type_strictness>
  <styling>Tailwind CSS v4 with @theme</styling>
  <component_pattern>shadcn/ui</component_pattern>
  <variant_system>CVA (class-variance-authority)</variant_system>
  <primitives>Radix UI (when needed)</primitives>
  <animations>Framer Motion</animations>
  <utilities>cn() from @/lib/utils</utilities>
</framework>
```

### Framework Variations

**Minimal (atoms):**
```xml
<framework>
  <library>React 18</library>
  <language>TypeScript strict</language>
  <styling>Tailwind CSS v4</styling>
  <pattern>shadcn/ui + CVA</pattern>
</framework>
```

**Complex (organisms):**
```xml
<framework>
  <library>React 18</library>
  <language>TypeScript strict</language>
  <styling>Tailwind CSS v4</styling>
  <pattern>shadcn/ui + CVA</pattern>
  <primitives>Radix UI Dialog/Dropdown/etc.</primitives>
  <animations>Framer Motion AnimatePresence</animations>
  <forms>react-hook-form + zod</forms>
</framework>
```

## Element 2: Purpose

Defines what the component does and when to use it.

### Purpose Template

```xml
<purpose>
  <name>Button</name>
  <category>atom</category>
  <description>
    Interactive element that triggers actions when clicked.
    Supports multiple visual variants and sizes.
  </description>
  <use_cases>
    <primary>Form submission</primary>
    <secondary>Navigation actions</secondary>
    <secondary>Triggering dialogs</secondary>
  </use_cases>
  <not_for>
    <case>Navigation links (use Link component)</case>
    <case>Toggle states (use Toggle component)</case>
  </not_for>
</purpose>
```

### Component Categories

| Category | Description | Examples |
|----------|-------------|----------|
| atom | Single-purpose, no children | Button, Badge, Avatar |
| molecule | Composed of atoms | Input + Label, Card |
| organism | Complex, multiple molecules | Form, Navigation, Modal |
| template | Page structure | Dashboard Layout |
| page | Full page | Login Page |

## Element 3: Props

Specifies the component's TypeScript interface.

### Props Template

```xml
<props>
  <prop name="variant" type="'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'" required="false" default="'default'">
    Visual style variant
  </prop>
  <prop name="size" type="'sm' | 'default' | 'lg' | 'icon'" required="false" default="'default'">
    Size variant
  </prop>
  <prop name="disabled" type="boolean" required="false" default="false">
    Disables interaction
  </prop>
  <prop name="isLoading" type="boolean" required="false" default="false">
    Shows loading spinner and disables interaction
  </prop>
  <prop name="asChild" type="boolean" required="false" default="false">
    Renders as Radix Slot for composition
  </prop>
  <prop name="className" type="string" required="false">
    Additional CSS classes
  </prop>
  <extends>React.ButtonHTMLAttributes&lt;HTMLButtonElement&gt;</extends>
  <extends>VariantProps&lt;typeof buttonVariants&gt;</extends>
</props>
```

### Prop Types Quick Reference

| Type | Usage |
|------|-------|
| `string` | Text content, IDs |
| `number` | Counts, indices |
| `boolean` | Flags, toggles |
| `ReactNode` | Children, icons |
| `() => void` | Event handlers (no args) |
| `(value: T) => void` | Value change handlers |
| `'a' \| 'b' \| 'c'` | Constrained strings (variants) |

## Element 4: Styling

Defines visual appearance requirements.

### Styling Template

```xml
<styling>
  <colors>
    <primary>bg-primary text-primary-foreground</primary>
    <secondary>bg-secondary text-secondary-foreground</secondary>
    <hover>hover:bg-primary/90</hover>
    <focus>focus-visible:ring-2 focus-visible:ring-ring</focus>
  </colors>

  <typography>
    <size>text-sm</size>
    <weight>font-medium</weight>
    <tracking>normal</tracking>
  </typography>

  <spacing>
    <padding>px-4 py-2</padding>
    <gap>gap-2 (with icons)</gap>
  </spacing>

  <effects>
    <border>rounded-md</border>
    <shadow>shadow-sm</shadow>
    <transition>transition-colors</transition>
  </effects>

  <responsive>
    <mobile>Full width on mobile (optional)</mobile>
    <desktop>Inline with auto width</desktop>
  </responsive>
</styling>
```

### Styling Presets

**Elevated:**
```xml
<styling preset="elevated">
  <shadow>shadow-lg hover:shadow-xl</shadow>
  <transform>hover:-translate-y-1</transform>
  <border>rounded-xl</border>
</styling>
```

**Flat:**
```xml
<styling preset="flat">
  <shadow>none</shadow>
  <border>border rounded-lg</border>
  <hover>hover:border-primary/50</hover>
</styling>
```

**Glass:**
```xml
<styling preset="glass">
  <background>bg-white/80 backdrop-blur-sm</background>
  <border>border border-white/20</border>
</styling>
```

## Element 5: Accessibility

Specifies WCAG 2.2 requirements.

### Accessibility Template

```xml
<accessibility level="AA">
  <semantic_element>button</semantic_element>

  <keyboard>
    <interaction key="Enter">Activates button</interaction>
    <interaction key="Space">Activates button</interaction>
    <tabindex>0 (implicit for button)</tabindex>
  </keyboard>

  <aria>
    <label condition="icon-only">Required aria-label</label>
    <busy condition="isLoading">aria-busy="true"</busy>
    <disabled condition="disabled">aria-disabled via native</disabled>
  </aria>

  <focus>
    <indicator>focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2</indicator>
    <visible>Must be visible on all backgrounds</visible>
  </focus>

  <contrast>
    <text>4.5:1 against background</text>
    <ui>3:1 for borders and focus rings</ui>
  </contrast>

  <motion>
    <reduced_motion>Disable animations when prefers-reduced-motion</reduced_motion>
  </motion>
</accessibility>
```

### A11y Requirements by Component

| Component | Key Requirements |
|-----------|-----------------|
| Button | Native element, focus ring |
| IconButton | aria-label required |
| Link | href required, focus visible |
| Input | label association, error announcements |
| Modal | Focus trap, Escape to close, aria-labelledby |
| Dropdown | Arrow key navigation, Escape to close |
| Tabs | Arrow keys, aria-selected |
| Toast | aria-live, auto-dismiss timing |

## Element 6: Edge Cases

Defines behavior for non-happy-path scenarios.

### Edge Cases Template

```xml
<edge_cases>
  <case name="loading">
    <condition>isLoading prop is true</condition>
    <behavior>
      - Show spinner icon
      - Disable click interactions
      - Set aria-busy="true"
      - Preserve button width (no layout shift)
    </behavior>
  </case>

  <case name="disabled">
    <condition>disabled prop is true</condition>
    <behavior>
      - Reduce opacity to 50%
      - Remove pointer events
      - Still focusable for screen readers
    </behavior>
  </case>

  <case name="long_text">
    <condition>Children text exceeds expected length</condition>
    <behavior>
      - Truncate with ellipsis OR
      - Allow natural wrapping
      - Never break mid-word
    </behavior>
  </case>

  <case name="no_children">
    <condition>No children provided (icon-only)</condition>
    <behavior>
      - Require aria-label prop
      - Use icon size variant
      - Maintain square aspect ratio
    </behavior>
  </case>

  <case name="form_context">
    <condition>Button inside form</condition>
    <behavior>
      - Default type="button" (not submit)
      - Explicit type="submit" for form submission
    </behavior>
  </case>
</edge_cases>
```

### Common Edge Cases

| Case | Components | Handling |
|------|------------|----------|
| Loading | Button, Form, Card | Spinner, disabled, aria-busy |
| Empty | List, Table, Select | Empty state message |
| Error | Input, Form, API | Error message, styling |
| Overflow | Text, List | Truncate or scroll |
| Long content | Card, Modal | Scroll or expand |
| Missing data | Image, Avatar | Fallback content |
| Slow network | Image, Async | Loading placeholder |

## Complete Example: Button

```xml
<component_request>
  <framework>
    <library>React 18</library>
    <language>TypeScript strict</language>
    <styling>Tailwind CSS v4</styling>
    <patterns>shadcn/ui, CVA</patterns>
    <utilities>cn() from @/lib/utils</utilities>
  </framework>

  <purpose>
    <name>Button</name>
    <category>atom</category>
    <description>
      Interactive button component with multiple variants and sizes.
      Supports loading states and can render as child element.
    </description>
    <use_cases>
      <primary>Form submission</primary>
      <secondary>Dialog triggers</secondary>
      <secondary>Action buttons</secondary>
    </use_cases>
  </purpose>

  <props>
    <prop name="variant" type="'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'" default="'default'">
      Visual style variant
    </prop>
    <prop name="size" type="'default' | 'sm' | 'lg' | 'icon'" default="'default'">
      Size variant
    </prop>
    <prop name="isLoading" type="boolean" default="false">
      Shows loading spinner
    </prop>
    <prop name="asChild" type="boolean" default="false">
      Render as Radix Slot
    </prop>
    <extends>React.ButtonHTMLAttributes</extends>
    <extends>VariantProps&lt;typeof buttonVariants&gt;</extends>
  </props>

  <styling>
    <base>
      inline-flex items-center justify-center whitespace-nowrap
      rounded-md text-sm font-medium transition-colors
    </base>
    <variants>
      <default>bg-primary text-primary-foreground hover:bg-primary/90</default>
      <destructive>bg-destructive text-destructive-foreground hover:bg-destructive/90</destructive>
      <outline>border border-input bg-background hover:bg-accent</outline>
      <secondary>bg-secondary text-secondary-foreground hover:bg-secondary/80</secondary>
      <ghost>hover:bg-accent hover:text-accent-foreground</ghost>
      <link>text-primary underline-offset-4 hover:underline</link>
    </variants>
    <sizes>
      <default>h-10 px-4 py-2</default>
      <sm>h-9 rounded-md px-3</sm>
      <lg>h-11 rounded-md px-8</lg>
      <icon>h-10 w-10</icon>
    </sizes>
  </styling>

  <accessibility level="AA">
    <element>button (native)</element>
    <keyboard>Enter and Space activate</keyboard>
    <focus>focus-visible:ring-2 ring-offset-2</focus>
    <aria>
      <loading>aria-busy="true" when isLoading</loading>
      <icon_only>aria-label required for size="icon"</icon_only>
    </aria>
    <contrast>4.5:1 for all variants</contrast>
  </accessibility>

  <edge_cases>
    <case name="loading">
      Show Loader2 spinner, disable interactions, aria-busy
    </case>
    <case name="disabled">
      pointer-events-none, opacity-50
    </case>
    <case name="as_link">
      Use asChild with Link component for navigation
    </case>
    <case name="icon_only">
      Require aria-label, use size="icon" variant
    </case>
  </edge_cases>
</component_request>
```

## Usage in Agents

### Orchestrator Usage

```typescript
const promptTemplate = buildPromptTemplate({
  framework: getFrameworkConfig(),
  purpose: analyzePurpose(userRequest),
  props: inferProps(componentType),
  styling: designAnalyzer.getSpecs(),
  accessibility: getA11yRequirements(componentType),
  edgeCases: identifyEdgeCases(componentType)
});

Task({
  subagent_type: "component-generator",
  prompt: promptTemplate,
  description: `Generate ${componentName} component`
});
```

### Template Builder Function

```typescript
interface PromptElements {
  framework: FrameworkConfig;
  purpose: PurposeSpec;
  props: PropSpec[];
  styling: StylingSpec;
  accessibility: A11ySpec;
  edgeCases: EdgeCase[];
}

function buildComponentPrompt(elements: PromptElements): string {
  return `
<component_request>
  ${renderFramework(elements.framework)}
  ${renderPurpose(elements.purpose)}
  ${renderProps(elements.props)}
  ${renderStyling(elements.styling)}
  ${renderAccessibility(elements.accessibility)}
  ${renderEdgeCases(elements.edgeCases)}
</component_request>
  `.trim();
}
```

## Quality Checklist

Before sending a prompt, verify:

- [ ] Framework specifies exact versions and patterns
- [ ] Purpose clearly describes the component's job
- [ ] Props include types, defaults, and descriptions
- [ ] Styling covers all visual states (hover, focus, active)
- [ ] Accessibility addresses keyboard, ARIA, and contrast
- [ ] Edge cases cover loading, empty, error, and overflow
