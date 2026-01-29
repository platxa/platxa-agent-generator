/**
 * Atomic Design Module
 *
 * Implements Atomic Design methodology for component organization:
 * - Classification: Automatically categorize components by complexity
 * - Templates: Generate code structure for each atomic level
 * - Folder Structure: Create organized directory hierarchy
 */

import type {
  AtomicLevel,
  AtomicClassification,
  ComponentMetadata,
  ComplexityIndicators,
  TemplateConfig,
  AtomicFolderStructure,
  AtomicGenerationOptions,
  AtomCategory,
  MoleculeCategory,
  OrganismCategory,
  PropDefinition,
} from "./types"

// ============================================================================
// Constants
// ============================================================================

/**
 * Known atom component patterns
 */
const ATOM_PATTERNS: Record<string, AtomCategory> = {
  button: "button",
  btn: "button",
  input: "input",
  textfield: "input",
  textarea: "input",
  text: "text",
  typography: "text",
  heading: "text",
  paragraph: "text",
  icon: "icon",
  svg: "icon",
  image: "image",
  img: "image",
  avatar: "avatar",
  badge: "badge",
  tag: "badge",
  chip: "badge",
  label: "label",
  link: "link",
  anchor: "link",
  divider: "divider",
  separator: "divider",
  spinner: "spinner",
  loader: "spinner",
  loading: "spinner",
  checkbox: "checkbox",
  radio: "radio",
  switch: "switch",
  toggle: "switch",
  slider: "slider",
  range: "slider",
  progress: "progress",
  progressbar: "progress",
}

/**
 * Known molecule component patterns
 */
const MOLECULE_PATTERNS: Record<string, MoleculeCategory> = {
  formfield: "form-field",
  inputfield: "form-field",
  searchbar: "search-bar",
  search: "search-bar",
  mediaobject: "media-object",
  cardheader: "card-header",
  navitem: "nav-item",
  navlink: "nav-item",
  buttongroup: "button-group",
  inputgroup: "input-group",
  stat: "stat-item",
  listitem: "list-item",
  breadcrumbitem: "breadcrumb-item",
  paginationitem: "pagination-item",
  menuitem: "menu-item",
  alert: "alert",
  notification: "alert",
  taggroup: "tag-group",
}

/**
 * Known organism component patterns
 */
const ORGANISM_PATTERNS: Record<string, OrganismCategory> = {
  header: "header",
  appheader: "header",
  navbar: "navigation",
  navigation: "navigation",
  nav: "navigation",
  footer: "footer",
  appfooter: "footer",
  sidebar: "sidebar",
  sidenav: "sidebar",
  hero: "hero",
  herosection: "hero",
  card: "card",
  productcard: "card",
  form: "form",
  loginform: "form",
  signupform: "form",
  table: "table",
  datatable: "data-grid",
  datagrid: "data-grid",
  modal: "modal",
  dialog: "modal",
  dropdown: "dropdown",
  menu: "dropdown",
  tabs: "tabs",
  tabpanel: "tabs",
  accordion: "accordion",
  collapsible: "accordion",
  carousel: "carousel",
  slider: "carousel",
  comments: "comment-section",
  pricing: "pricing-card",
  pricingcard: "pricing-card",
  features: "feature-section",
  featuresection: "feature-section",
  testimonial: "testimonial",
  testimonials: "testimonial",
}

/**
 * Default folder structure
 */
const DEFAULT_FOLDER_STRUCTURE: AtomicFolderStructure = {
  baseDir: "src/components",
  atoms: "atoms",
  molecules: "molecules",
  organisms: "organisms",
  templates: "templates",
  pages: "pages",
  shared: "shared",
}

// ============================================================================
// Classification Functions
// ============================================================================

/**
 * Classifies a component into an atomic design level
 */
export function classifyComponent(metadata: ComponentMetadata): AtomicClassification {
  const nameLower = metadata.name.toLowerCase().replace(/[-_\s]/g, "")
  const reasoning: string[] = []
  const alternatives: AtomicClassification["alternatives"] = []

  // Check for explicit pattern matches first
  if (ATOM_PATTERNS[nameLower]) {
    reasoning.push(`Name "${metadata.name}" matches atom pattern "${ATOM_PATTERNS[nameLower]}"`)
    return {
      level: "atom",
      confidence: 0.95,
      reasoning,
      suggestedPath: `atoms/${metadata.name}`,
    }
  }

  if (MOLECULE_PATTERNS[nameLower]) {
    reasoning.push(`Name "${metadata.name}" matches molecule pattern "${MOLECULE_PATTERNS[nameLower]}"`)
    return {
      level: "molecule",
      confidence: 0.95,
      reasoning,
      suggestedPath: `molecules/${metadata.name}`,
    }
  }

  if (ORGANISM_PATTERNS[nameLower]) {
    reasoning.push(`Name "${metadata.name}" matches organism pattern "${ORGANISM_PATTERNS[nameLower]}"`)
    return {
      level: "organism",
      confidence: 0.95,
      reasoning,
      suggestedPath: `organisms/${metadata.name}`,
    }
  }

  // Check for template/page patterns
  if (nameLower.includes("template") || nameLower.includes("layout")) {
    reasoning.push(`Name contains "template" or "layout"`)
    return {
      level: "template",
      confidence: 0.9,
      reasoning,
      suggestedPath: `templates/${metadata.name}`,
    }
  }

  if (nameLower.includes("page") || nameLower.includes("screen") || nameLower.includes("view")) {
    reasoning.push(`Name contains "page", "screen", or "view"`)
    return {
      level: "page",
      confidence: 0.9,
      reasoning,
      suggestedPath: `pages/${metadata.name}`,
    }
  }

  // Analyze complexity indicators
  const indicators = analyzeComplexity(metadata)
  const { level, confidence } = determineLevel(indicators, reasoning)

  // Check for alternative classifications
  if (confidence < 0.8) {
    const alternativeLevels = getAlternativeLevels(level)
    for (const altLevel of alternativeLevels) {
      alternatives.push({
        level: altLevel,
        confidence: confidence - 0.15,
        reason: `Could also be classified as ${altLevel} based on component structure`,
      })
    }
  }

  return {
    level,
    confidence,
    reasoning,
    suggestedPath: `${level}s/${metadata.name}`,
    alternatives: alternatives.length > 0 ? alternatives : undefined,
  }
}

/**
 * Analyzes component complexity
 */
export function analyzeComplexity(metadata: ComponentMetadata): ComplexityIndicators {
  const childCount = metadata.children?.length || 0
  const propCount = metadata.props?.length || 0
  const importCount = metadata.imports?.length || 0

  return {
    childCount,
    propCount,
    hasState: false, // Would need code analysis
    usesContext: false, // Would need code analysis
    eventHandlers: 0, // Would need code analysis
    composesComponents: importCount > 0 || childCount > 0,
    isLayout: metadata.isLayoutComponent || false,
    hasDataFetching: false, // Would need code analysis
  }
}

/**
 * Determines atomic level from complexity indicators
 */
function determineLevel(
  indicators: ComplexityIndicators,
  reasoning: string[]
): { level: AtomicLevel; confidence: number } {
  const { childCount, propCount, composesComponents, isLayout } = indicators

  // Template/Page indicators
  if (isLayout) {
    reasoning.push("Component is marked as layout component")
    return { level: "template", confidence: 0.85 }
  }

  // Atom indicators: simple, few props, no children components
  if (!composesComponents && propCount <= 5 && childCount === 0) {
    reasoning.push("Simple component with few props and no child components")
    return { level: "atom", confidence: 0.8 }
  }

  // Molecule indicators: composes 1-3 components, moderate props
  if (composesComponents && childCount <= 3 && propCount <= 10) {
    reasoning.push(`Composes ${childCount} child components with ${propCount} props`)
    return { level: "molecule", confidence: 0.75 }
  }

  // Organism indicators: composes many components, complex props
  if (childCount > 3 || propCount > 10) {
    reasoning.push(`Complex component with ${childCount} children and ${propCount} props`)
    return { level: "organism", confidence: 0.7 }
  }

  // Default to molecule for moderate complexity
  reasoning.push("Moderate complexity, defaulting to molecule")
  return { level: "molecule", confidence: 0.6 }
}

/**
 * Gets alternative levels for a given level
 */
function getAlternativeLevels(level: AtomicLevel): AtomicLevel[] {
  const adjacentLevels: Record<AtomicLevel, AtomicLevel[]> = {
    atom: ["molecule"],
    molecule: ["atom", "organism"],
    organism: ["molecule", "template"],
    template: ["organism", "page"],
    page: ["template"],
  }
  return adjacentLevels[level]
}

/**
 * Batch classify multiple components
 */
export function classifyComponents(
  components: ComponentMetadata[]
): Map<string, AtomicClassification> {
  const results = new Map<string, AtomicClassification>()

  for (const component of components) {
    results.set(component.name, classifyComponent(component))
  }

  return results
}

// ============================================================================
// Template Generators
// ============================================================================

/**
 * Generates an atom template
 */
export function generateAtomTemplate(
  name: string,
  category: AtomCategory,
  _options: AtomicGenerationOptions = {}
): string {
  const baseProps = getAtomBaseProps(category)
  const variants = getAtomVariants(category)
  const baseElement = getAtomBaseElement(category)
  const styles = getAtomStyles(category)

  const lines: string[] = []

  // Imports
  lines.push(`import * as React from "react"`)
  lines.push(`import { cva, type VariantProps } from "class-variance-authority"`)
  lines.push(`import { cn } from "@/lib/utils"`)
  lines.push("")

  // Variants
  lines.push(`const ${camelCase(name)}Variants = cva(`)
  lines.push(`  ${JSON.stringify(styles)},`)
  lines.push(`  {`)
  lines.push(`    variants: {`)
  for (const variant of variants) {
    lines.push(`      ${variant.name}: {`)
    for (const val of variant.values) {
      lines.push(`        ${val.value}: ${JSON.stringify(val.styles.join(" "))},`)
    }
    lines.push(`      },`)
  }
  lines.push(`    },`)
  lines.push(`    defaultVariants: {`)
  for (const variant of variants) {
    lines.push(`      ${variant.name}: "${variant.defaultValue}",`)
  }
  lines.push(`    },`)
  lines.push(`  }`)
  lines.push(`)`)
  lines.push("")

  // Interface
  const elementType = getElementType(baseElement)
  lines.push(`export interface ${name}Props`)
  lines.push(`  extends React.${elementType}Attributes<HTML${capitalize(baseElement)}Element>,`)
  lines.push(`    VariantProps<typeof ${camelCase(name)}Variants> {`)
  for (const prop of baseProps) {
    if (prop.required) {
      lines.push(`  /** ${prop.description || prop.name} */`)
      lines.push(`  ${prop.name}: ${prop.type}`)
    } else {
      lines.push(`  /** ${prop.description || prop.name} */`)
      lines.push(`  ${prop.name}?: ${prop.type}`)
    }
  }
  lines.push(`}`)
  lines.push("")

  // Component
  lines.push(`const ${name} = React.forwardRef<HTML${capitalize(baseElement)}Element, ${name}Props>(`)
  lines.push(`  ({ className, ${variants.map((v) => v.name).join(", ")}, ...props }, ref) => {`)
  lines.push(`    return (`)
  lines.push(`      <${baseElement}`)
  lines.push(`        className={cn(${camelCase(name)}Variants({ ${variants.map((v) => v.name).join(", ")} }), className)}`)
  lines.push(`        ref={ref}`)
  lines.push(`        {...props}`)
  lines.push(`      />`)
  lines.push(`    )`)
  lines.push(`  }`)
  lines.push(`)`)
  lines.push(`${name}.displayName = "${name}"`)
  lines.push("")
  lines.push(`export { ${name}, ${camelCase(name)}Variants }`)

  return lines.join("\n")
}

/**
 * Generates a molecule template
 */
export function generateMoleculeTemplate(
  name: string,
  category: MoleculeCategory,
  atoms: string[],
  _options: AtomicGenerationOptions = {}
): string {
  const lines: string[] = []

  // Imports
  lines.push(`import * as React from "react"`)
  lines.push(`import { cn } from "@/lib/utils"`)
  for (const atom of atoms) {
    lines.push(`import { ${atom} } from "@/components/atoms/${atom}"`)
  }
  lines.push("")

  // Interface
  lines.push(`export interface ${name}Props extends React.HTMLAttributes<HTMLDivElement> {`)
  const moleculeProps = getMoleculeProps(category)
  for (const prop of moleculeProps) {
    lines.push(`  /** ${prop.description || prop.name} */`)
    lines.push(`  ${prop.name}${prop.required ? "" : "?"}: ${prop.type}`)
  }
  lines.push(`}`)
  lines.push("")

  // Component
  lines.push(`const ${name} = React.forwardRef<HTMLDivElement, ${name}Props>(`)
  lines.push(`  ({ className, ${moleculeProps.map((p) => p.name).join(", ")}, ...props }, ref) => {`)
  lines.push(`    return (`)
  lines.push(`      <div`)
  lines.push(`        className={cn("flex items-center gap-2", className)}`)
  lines.push(`        ref={ref}`)
  lines.push(`        {...props}`)
  lines.push(`      >`)
  lines.push(`        {/* Compose atoms here */}`)
  for (const atom of atoms) {
    lines.push(`        <${atom} />`)
  }
  lines.push(`      </div>`)
  lines.push(`    )`)
  lines.push(`  }`)
  lines.push(`)`)
  lines.push(`${name}.displayName = "${name}"`)
  lines.push("")
  lines.push(`export { ${name} }`)

  return lines.join("\n")
}

/**
 * Generates an organism template
 */
export function generateOrganismTemplate(
  name: string,
  category: OrganismCategory,
  molecules: string[],
  atoms: string[] = [],
  _options: AtomicGenerationOptions = {}
): string {
  const lines: string[] = []

  // Imports
  lines.push(`import * as React from "react"`)
  lines.push(`import { cn } from "@/lib/utils"`)
  for (const molecule of molecules) {
    lines.push(`import { ${molecule} } from "@/components/molecules/${molecule}"`)
  }
  for (const atom of atoms) {
    lines.push(`import { ${atom} } from "@/components/atoms/${atom}"`)
  }
  lines.push("")

  // Interface
  lines.push(`export interface ${name}Props extends React.HTMLAttributes<HTMLElement> {`)
  const organismProps = getOrganismProps(category)
  for (const prop of organismProps) {
    lines.push(`  /** ${prop.description || prop.name} */`)
    lines.push(`  ${prop.name}${prop.required ? "" : "?"}: ${prop.type}`)
  }
  lines.push(`}`)
  lines.push("")

  // Component
  const semanticElement = getOrganismElement(category)
  lines.push(`const ${name} = React.forwardRef<HTML${capitalize(semanticElement)}Element, ${name}Props>(`)
  lines.push(`  ({ className, ${organismProps.map((p) => p.name).join(", ")}, ...props }, ref) => {`)
  lines.push(`    return (`)
  lines.push(`      <${semanticElement}`)
  lines.push(`        className={cn("${getOrganismBaseStyles(category)}", className)}`)
  lines.push(`        ref={ref}`)
  lines.push(`        {...props}`)
  lines.push(`      >`)
  lines.push(`        {/* Organism structure */}`)
  for (const molecule of molecules) {
    lines.push(`        <${molecule} />`)
  }
  lines.push(`      </${semanticElement}>`)
  lines.push(`    )`)
  lines.push(`  }`)
  lines.push(`)`)
  lines.push(`${name}.displayName = "${name}"`)
  lines.push("")
  lines.push(`export { ${name} }`)

  return lines.join("\n")
}

/**
 * Generates a template component
 */
export function generateTemplateComponent(
  name: string,
  config: Partial<TemplateConfig>,
  _options: AtomicGenerationOptions = {}
): string {
  const lines: string[] = []
  const organisms = config.organisms || []

  // Imports
  lines.push(`import * as React from "react"`)
  lines.push(`import { cn } from "@/lib/utils"`)
  for (const organism of organisms) {
    lines.push(`import { ${organism} } from "@/components/organisms/${organism}"`)
  }
  lines.push("")

  // Interface
  lines.push(`export interface ${name}Props {`)
  lines.push(`  /** Page content */`)
  lines.push(`  children: React.ReactNode`)
  lines.push(`  /** Additional class names */`)
  lines.push(`  className?: string`)
  const slots = config.slots || []
  for (const slot of slots) {
    lines.push(`  /** ${slot.description} */`)
    lines.push(`  ${slot.name}${slot.required ? "" : "?"}: React.ReactNode`)
  }
  lines.push(`}`)
  lines.push("")

  // Component
  lines.push(`export function ${name}({`)
  lines.push(`  children,`)
  lines.push(`  className,`)
  for (const slot of slots) {
    lines.push(`  ${slot.name},`)
  }
  lines.push(`}: ${name}Props) {`)
  lines.push(`  return (`)
  lines.push(`    <div className={cn("min-h-screen flex flex-col", className)}>`)

  const layout = config.layout
  if (layout?.hasHeader) {
    lines.push(`      {/* Header slot */}`)
    lines.push(`      <header className="sticky top-0 z-50">`)
    lines.push(`        {header}`)
    lines.push(`      </header>`)
  }

  lines.push(`      <main className="flex-1">`)
  if (layout?.hasSidebar) {
    lines.push(`        <div className="flex">`)
    if (layout.sidebarPosition === "left") {
      lines.push(`          <aside className="w-64 shrink-0">{sidebar}</aside>`)
      lines.push(`          <div className="flex-1">{children}</div>`)
    } else {
      lines.push(`          <div className="flex-1">{children}</div>`)
      lines.push(`          <aside className="w-64 shrink-0">{sidebar}</aside>`)
    }
    lines.push(`        </div>`)
  } else {
    lines.push(`        {children}`)
  }
  lines.push(`      </main>`)

  if (layout?.hasFooter) {
    lines.push(`      {/* Footer slot */}`)
    lines.push(`      <footer>`)
    lines.push(`        {footer}`)
    lines.push(`      </footer>`)
  }

  lines.push(`    </div>`)
  lines.push(`  )`)
  lines.push(`}`)

  return lines.join("\n")
}

// ============================================================================
// Folder Structure
// ============================================================================

/**
 * Generates folder structure commands/paths
 */
export function generateFolderStructure(
  options: AtomicGenerationOptions = {}
): AtomicFolderStructure {
  const structure = options.folderStructure || DEFAULT_FOLDER_STRUCTURE
  return structure
}

/**
 * Gets the full path for a component based on its classification
 */
export function getComponentPath(
  componentName: string,
  level: AtomicLevel,
  folderStructure: AtomicFolderStructure = DEFAULT_FOLDER_STRUCTURE
): string {
  const levelDir = {
    atom: folderStructure.atoms,
    molecule: folderStructure.molecules,
    organism: folderStructure.organisms,
    template: folderStructure.templates,
    page: folderStructure.pages,
  }[level]

  return `${folderStructure.baseDir}/${levelDir}/${componentName}`
}

/**
 * Generates index file for re-exports
 */
export function generateIndexFile(
  components: Array<{ name: string; level: AtomicLevel }>,
  level: AtomicLevel
): string {
  const filtered = components.filter((c) => c.level === level)
  const lines: string[] = []

  lines.push(`/**`)
  lines.push(` * ${capitalize(level)}s - Atomic Design ${capitalize(level)} Components`)
  lines.push(` */`)
  lines.push("")

  for (const component of filtered) {
    lines.push(`export { ${component.name} } from "./${component.name}"`)
  }

  return lines.join("\n")
}

// ============================================================================
// Helper Functions
// ============================================================================

function camelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function getAtomBaseProps(category: AtomCategory): PropDefinition[] {
  const commonProps: PropDefinition[] = [
    { name: "className", type: "string", required: false, description: "Additional CSS classes" },
  ]

  const categoryProps: Record<AtomCategory, PropDefinition[]> = {
    button: [
      { name: "disabled", type: "boolean", required: false, description: "Disable the button" },
      { name: "loading", type: "boolean", required: false, description: "Show loading state" },
    ],
    input: [
      { name: "placeholder", type: "string", required: false, description: "Placeholder text" },
      { name: "disabled", type: "boolean", required: false, description: "Disable the input" },
    ],
    text: [],
    icon: [
      { name: "size", type: "number", required: false, description: "Icon size in pixels" },
    ],
    image: [
      { name: "src", type: "string", required: true, description: "Image source URL" },
      { name: "alt", type: "string", required: true, description: "Alt text" },
    ],
    badge: [
      { name: "children", type: "React.ReactNode", required: true, description: "Badge content" },
    ],
    label: [
      { name: "htmlFor", type: "string", required: false, description: "Associated input ID" },
    ],
    link: [
      { name: "href", type: "string", required: true, description: "Link destination" },
    ],
    divider: [],
    spinner: [
      { name: "size", type: "'sm' | 'md' | 'lg'", required: false, description: "Spinner size" },
    ],
    avatar: [
      { name: "src", type: "string", required: false, description: "Avatar image URL" },
      { name: "fallback", type: "string", required: false, description: "Fallback initials" },
    ],
    checkbox: [
      { name: "checked", type: "boolean", required: false, description: "Checked state" },
      { name: "onCheckedChange", type: "(checked: boolean) => void", required: false, description: "Change handler" },
    ],
    radio: [
      { name: "value", type: "string", required: true, description: "Radio value" },
    ],
    switch: [
      { name: "checked", type: "boolean", required: false, description: "Switch state" },
      { name: "onCheckedChange", type: "(checked: boolean) => void", required: false, description: "Change handler" },
    ],
    slider: [
      { name: "value", type: "number[]", required: false, description: "Slider values" },
      { name: "onValueChange", type: "(value: number[]) => void", required: false, description: "Change handler" },
    ],
    progress: [
      { name: "value", type: "number", required: false, description: "Progress value (0-100)" },
    ],
  }

  return [...commonProps, ...(categoryProps[category] || [])]
}

function getAtomVariants(category: AtomCategory): Array<{ name: string; values: Array<{ value: string; styles: string[] }>; defaultValue: string }> {
  if (category === "button") {
    return [
      {
        name: "variant",
        values: [
          { value: "default", styles: ["bg-primary", "text-primary-foreground", "hover:bg-primary/90"] },
          { value: "secondary", styles: ["bg-secondary", "text-secondary-foreground", "hover:bg-secondary/80"] },
          { value: "outline", styles: ["border", "border-input", "bg-background", "hover:bg-accent"] },
          { value: "ghost", styles: ["hover:bg-accent", "hover:text-accent-foreground"] },
          { value: "destructive", styles: ["bg-destructive", "text-destructive-foreground", "hover:bg-destructive/90"] },
        ],
        defaultValue: "default",
      },
      {
        name: "size",
        values: [
          { value: "sm", styles: ["h-8", "px-3", "text-xs"] },
          { value: "md", styles: ["h-10", "px-4", "text-sm"] },
          { value: "lg", styles: ["h-12", "px-6", "text-base"] },
        ],
        defaultValue: "md",
      },
    ]
  }

  if (category === "badge") {
    return [
      {
        name: "variant",
        values: [
          { value: "default", styles: ["bg-primary", "text-primary-foreground"] },
          { value: "secondary", styles: ["bg-secondary", "text-secondary-foreground"] },
          { value: "outline", styles: ["border", "text-foreground"] },
        ],
        defaultValue: "default",
      },
    ]
  }

  return []
}

function getAtomBaseElement(category: AtomCategory): string {
  const elementMap: Record<AtomCategory, string> = {
    button: "button",
    input: "input",
    text: "span",
    icon: "svg",
    image: "img",
    badge: "span",
    label: "label",
    link: "a",
    divider: "hr",
    spinner: "div",
    avatar: "span",
    checkbox: "button",
    radio: "button",
    switch: "button",
    slider: "div",
    progress: "div",
  }
  return elementMap[category] || "div"
}

function getAtomStyles(category: AtomCategory): string[] {
  const styleMap: Record<AtomCategory, string[]> = {
    button: ["inline-flex", "items-center", "justify-center", "rounded-md", "font-medium", "transition-colors", "focus-visible:outline-none", "focus-visible:ring-2", "disabled:pointer-events-none", "disabled:opacity-50"],
    input: ["flex", "h-10", "w-full", "rounded-md", "border", "border-input", "bg-background", "px-3", "py-2", "text-sm", "placeholder:text-muted-foreground", "focus-visible:outline-none", "focus-visible:ring-2"],
    text: ["text-foreground"],
    icon: ["shrink-0"],
    image: ["max-w-full", "h-auto"],
    badge: ["inline-flex", "items-center", "rounded-full", "px-2.5", "py-0.5", "text-xs", "font-semibold"],
    label: ["text-sm", "font-medium", "leading-none"],
    link: ["text-primary", "underline-offset-4", "hover:underline"],
    divider: ["shrink-0", "bg-border", "h-px", "w-full"],
    spinner: ["animate-spin"],
    avatar: ["relative", "flex", "h-10", "w-10", "shrink-0", "overflow-hidden", "rounded-full"],
    checkbox: ["peer", "h-4", "w-4", "shrink-0", "rounded-sm", "border", "border-primary"],
    radio: ["aspect-square", "h-4", "w-4", "rounded-full", "border", "border-primary"],
    switch: ["peer", "inline-flex", "h-6", "w-11", "shrink-0", "cursor-pointer", "items-center", "rounded-full", "border-2", "border-transparent", "transition-colors"],
    slider: ["relative", "flex", "w-full", "touch-none", "select-none", "items-center"],
    progress: ["relative", "h-4", "w-full", "overflow-hidden", "rounded-full", "bg-secondary"],
  }
  return styleMap[category] || []
}

function getElementType(element: string): string {
  const typeMap: Record<string, string> = {
    button: "Button",
    input: "Input",
    a: "Anchor",
    img: "Image",
    svg: "SVG",
    label: "Label",
    hr: "HR",
  }
  return typeMap[element] || "HTML"
}

function getMoleculeProps(category: MoleculeCategory): PropDefinition[] {
  const propsMap: Record<MoleculeCategory, PropDefinition[]> = {
    "form-field": [
      { name: "label", type: "string", required: true, description: "Field label" },
      { name: "error", type: "string", required: false, description: "Error message" },
      { name: "hint", type: "string", required: false, description: "Help text" },
    ],
    "search-bar": [
      { name: "placeholder", type: "string", required: false, description: "Search placeholder" },
      { name: "onSearch", type: "(query: string) => void", required: false, description: "Search handler" },
    ],
    "media-object": [
      { name: "image", type: "string", required: true, description: "Image URL" },
      { name: "title", type: "string", required: true, description: "Title text" },
      { name: "description", type: "string", required: false, description: "Description" },
    ],
    "card-header": [
      { name: "title", type: "string", required: true, description: "Card title" },
      { name: "action", type: "React.ReactNode", required: false, description: "Header action" },
    ],
    "nav-item": [
      { name: "href", type: "string", required: true, description: "Navigation link" },
      { name: "active", type: "boolean", required: false, description: "Active state" },
    ],
    "button-group": [
      { name: "children", type: "React.ReactNode", required: true, description: "Button elements" },
    ],
    "input-group": [
      { name: "prefix", type: "React.ReactNode", required: false, description: "Input prefix" },
      { name: "suffix", type: "React.ReactNode", required: false, description: "Input suffix" },
    ],
    "stat-item": [
      { name: "label", type: "string", required: true, description: "Stat label" },
      { name: "value", type: "string | number", required: true, description: "Stat value" },
    ],
    "list-item": [
      { name: "children", type: "React.ReactNode", required: true, description: "Item content" },
    ],
    "breadcrumb-item": [
      { name: "href", type: "string", required: false, description: "Item link" },
      { name: "children", type: "React.ReactNode", required: true, description: "Item label" },
    ],
    "pagination-item": [
      { name: "page", type: "number", required: true, description: "Page number" },
      { name: "active", type: "boolean", required: false, description: "Active page" },
    ],
    "menu-item": [
      { name: "children", type: "React.ReactNode", required: true, description: "Menu item content" },
      { name: "disabled", type: "boolean", required: false, description: "Disabled state" },
    ],
    alert: [
      { name: "variant", type: "'info' | 'success' | 'warning' | 'error'", required: false, description: "Alert type" },
      { name: "children", type: "React.ReactNode", required: true, description: "Alert content" },
    ],
    "tag-group": [
      { name: "tags", type: "string[]", required: true, description: "Tag labels" },
    ],
  }
  return propsMap[category] || []
}

function getOrganismProps(category: OrganismCategory): PropDefinition[] {
  const propsMap: Record<OrganismCategory, PropDefinition[]> = {
    header: [
      { name: "logo", type: "React.ReactNode", required: false, description: "Logo element" },
      { name: "navigation", type: "React.ReactNode", required: false, description: "Navigation items" },
    ],
    footer: [
      { name: "columns", type: "React.ReactNode", required: false, description: "Footer columns" },
    ],
    sidebar: [
      { name: "collapsed", type: "boolean", required: false, description: "Collapsed state" },
      { name: "children", type: "React.ReactNode", required: true, description: "Sidebar content" },
    ],
    navigation: [
      { name: "items", type: "Array<{ label: string; href: string }>", required: true, description: "Nav items" },
    ],
    hero: [
      { name: "title", type: "string", required: true, description: "Hero title" },
      { name: "subtitle", type: "string", required: false, description: "Hero subtitle" },
      { name: "cta", type: "React.ReactNode", required: false, description: "Call to action" },
    ],
    card: [
      { name: "children", type: "React.ReactNode", required: true, description: "Card content" },
    ],
    form: [
      { name: "onSubmit", type: "(data: unknown) => void", required: true, description: "Submit handler" },
      { name: "children", type: "React.ReactNode", required: true, description: "Form fields" },
    ],
    table: [
      { name: "columns", type: "Array<{ key: string; header: string }>", required: true, description: "Table columns" },
      { name: "data", type: "Array<Record<string, unknown>>", required: true, description: "Table data" },
    ],
    modal: [
      { name: "open", type: "boolean", required: true, description: "Open state" },
      { name: "onClose", type: "() => void", required: true, description: "Close handler" },
      { name: "title", type: "string", required: false, description: "Modal title" },
    ],
    dropdown: [
      { name: "trigger", type: "React.ReactNode", required: true, description: "Dropdown trigger" },
      { name: "children", type: "React.ReactNode", required: true, description: "Dropdown content" },
    ],
    tabs: [
      { name: "tabs", type: "Array<{ label: string; content: React.ReactNode }>", required: true, description: "Tab items" },
    ],
    accordion: [
      { name: "items", type: "Array<{ title: string; content: React.ReactNode }>", required: true, description: "Accordion items" },
    ],
    carousel: [
      { name: "items", type: "React.ReactNode[]", required: true, description: "Carousel slides" },
    ],
    "data-grid": [
      { name: "columns", type: "unknown[]", required: true, description: "Grid columns" },
      { name: "data", type: "unknown[]", required: true, description: "Grid data" },
    ],
    "comment-section": [
      { name: "comments", type: "Array<{ author: string; content: string }>", required: true, description: "Comments" },
    ],
    "pricing-card": [
      { name: "title", type: "string", required: true, description: "Plan title" },
      { name: "price", type: "string", required: true, description: "Plan price" },
      { name: "features", type: "string[]", required: true, description: "Plan features" },
    ],
    "feature-section": [
      { name: "features", type: "Array<{ title: string; description: string }>", required: true, description: "Features" },
    ],
    testimonial: [
      { name: "quote", type: "string", required: true, description: "Testimonial quote" },
      { name: "author", type: "string", required: true, description: "Author name" },
    ],
  }
  return propsMap[category] || []
}

function getOrganismElement(category: OrganismCategory): string {
  const elementMap: Record<OrganismCategory, string> = {
    header: "header",
    footer: "footer",
    sidebar: "aside",
    navigation: "nav",
    hero: "section",
    card: "article",
    form: "form",
    table: "div",
    modal: "div",
    dropdown: "div",
    tabs: "div",
    accordion: "div",
    carousel: "div",
    "data-grid": "div",
    "comment-section": "section",
    "pricing-card": "article",
    "feature-section": "section",
    testimonial: "blockquote",
  }
  return elementMap[category] || "div"
}

function getOrganismBaseStyles(category: OrganismCategory): string {
  const stylesMap: Record<OrganismCategory, string> = {
    header: "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur",
    footer: "border-t bg-background",
    sidebar: "flex h-full w-64 flex-col border-r bg-background",
    navigation: "flex items-center space-x-4",
    hero: "py-20 px-4 text-center",
    card: "rounded-lg border bg-card p-6 shadow-sm",
    form: "space-y-4",
    table: "w-full caption-bottom text-sm",
    modal: "fixed inset-0 z-50 flex items-center justify-center",
    dropdown: "relative inline-block",
    tabs: "w-full",
    accordion: "w-full divide-y",
    carousel: "relative w-full overflow-hidden",
    "data-grid": "w-full overflow-auto",
    "comment-section": "space-y-4",
    "pricing-card": "rounded-xl border bg-card p-8 shadow-lg",
    "feature-section": "py-16 px-4",
    testimonial: "border-l-4 pl-4 italic",
  }
  return stylesMap[category] || ""
}
