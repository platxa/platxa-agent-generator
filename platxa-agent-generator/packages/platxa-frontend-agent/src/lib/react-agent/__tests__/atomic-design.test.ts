/**
 * Atomic Design - Unit Tests
 *
 * Tests for component classification and template generation
 */

import { describe, it, expect } from "vitest"
import {
  classifyComponent,
  classifyComponents,
  analyzeComplexity,
  generateAtomTemplate,
  generateMoleculeTemplate,
  generateOrganismTemplate,
  generateTemplateComponent,
  generateFolderStructure,
  getComponentPath,
  generateIndexFile,
  type ComponentMetadata,
  type AtomicLevel,
} from "../atomic-design"

// ============================================================================
// Test Fixtures
// ============================================================================

const createMetadata = (overrides: Partial<ComponentMetadata> = {}): ComponentMetadata => ({
  name: "TestComponent",
  ...overrides,
})

// ============================================================================
// Classification Tests
// ============================================================================

describe("Component Classification", () => {
  describe("classifyComponent", () => {
    describe("atom classification", () => {
      it("classifies Button as atom", () => {
        const result = classifyComponent(createMetadata({ name: "Button" }))
        expect(result.level).toBe("atom")
        expect(result.confidence).toBeGreaterThanOrEqual(0.9)
      })

      it("classifies Input as atom", () => {
        const result = classifyComponent(createMetadata({ name: "Input" }))
        expect(result.level).toBe("atom")
      })

      it("classifies Icon as atom", () => {
        const result = classifyComponent(createMetadata({ name: "Icon" }))
        expect(result.level).toBe("atom")
      })

      it("classifies Badge as atom", () => {
        const result = classifyComponent(createMetadata({ name: "Badge" }))
        expect(result.level).toBe("atom")
      })

      it("classifies Label as atom", () => {
        const result = classifyComponent(createMetadata({ name: "Label" }))
        expect(result.level).toBe("atom")
      })

      it("classifies Spinner as atom", () => {
        const result = classifyComponent(createMetadata({ name: "Spinner" }))
        expect(result.level).toBe("atom")
      })

      it("classifies Checkbox as atom", () => {
        const result = classifyComponent(createMetadata({ name: "Checkbox" }))
        expect(result.level).toBe("atom")
      })

      it("classifies Switch as atom", () => {
        const result = classifyComponent(createMetadata({ name: "Switch" }))
        expect(result.level).toBe("atom")
      })

      it("classifies Progress as atom", () => {
        const result = classifyComponent(createMetadata({ name: "Progress" }))
        expect(result.level).toBe("atom")
      })

      it("classifies Avatar as atom", () => {
        const result = classifyComponent(createMetadata({ name: "Avatar" }))
        expect(result.level).toBe("atom")
      })
    })

    describe("molecule classification", () => {
      it("classifies FormField as molecule", () => {
        const result = classifyComponent(createMetadata({ name: "FormField" }))
        expect(result.level).toBe("molecule")
      })

      it("classifies SearchBar as molecule", () => {
        const result = classifyComponent(createMetadata({ name: "SearchBar" }))
        expect(result.level).toBe("molecule")
      })

      it("classifies Alert as molecule", () => {
        const result = classifyComponent(createMetadata({ name: "Alert" }))
        expect(result.level).toBe("molecule")
      })

      it("classifies NavItem as molecule", () => {
        const result = classifyComponent(createMetadata({ name: "NavItem" }))
        expect(result.level).toBe("molecule")
      })

      it("classifies ButtonGroup as molecule", () => {
        const result = classifyComponent(createMetadata({ name: "ButtonGroup" }))
        expect(result.level).toBe("molecule")
      })

      it("classifies MenuItem as molecule", () => {
        const result = classifyComponent(createMetadata({ name: "MenuItem" }))
        expect(result.level).toBe("molecule")
      })
    })

    describe("organism classification", () => {
      it("classifies Header as organism", () => {
        const result = classifyComponent(createMetadata({ name: "Header" }))
        expect(result.level).toBe("organism")
      })

      it("classifies Footer as organism", () => {
        const result = classifyComponent(createMetadata({ name: "Footer" }))
        expect(result.level).toBe("organism")
      })

      it("classifies Sidebar as organism", () => {
        const result = classifyComponent(createMetadata({ name: "Sidebar" }))
        expect(result.level).toBe("organism")
      })

      it("classifies Navigation as organism", () => {
        const result = classifyComponent(createMetadata({ name: "Navigation" }))
        expect(result.level).toBe("organism")
      })

      it("classifies Hero as organism", () => {
        const result = classifyComponent(createMetadata({ name: "Hero" }))
        expect(result.level).toBe("organism")
      })

      it("classifies Card as organism", () => {
        const result = classifyComponent(createMetadata({ name: "Card" }))
        expect(result.level).toBe("organism")
      })

      it("classifies Modal as organism", () => {
        const result = classifyComponent(createMetadata({ name: "Modal" }))
        expect(result.level).toBe("organism")
      })

      it("classifies Tabs as organism", () => {
        const result = classifyComponent(createMetadata({ name: "Tabs" }))
        expect(result.level).toBe("organism")
      })

      it("classifies Accordion as organism", () => {
        const result = classifyComponent(createMetadata({ name: "Accordion" }))
        expect(result.level).toBe("organism")
      })

      it("classifies DataTable as organism", () => {
        const result = classifyComponent(createMetadata({ name: "DataTable" }))
        expect(result.level).toBe("organism")
      })
    })

    describe("template classification", () => {
      it("classifies DashboardTemplate as template", () => {
        const result = classifyComponent(createMetadata({ name: "DashboardTemplate" }))
        expect(result.level).toBe("template")
      })

      it("classifies MainLayout as template", () => {
        const result = classifyComponent(createMetadata({ name: "MainLayout" }))
        expect(result.level).toBe("template")
      })

      it("classifies AuthTemplate as template", () => {
        const result = classifyComponent(createMetadata({ name: "AuthTemplate" }))
        expect(result.level).toBe("template")
      })
    })

    describe("page classification", () => {
      it("classifies HomePage as page", () => {
        const result = classifyComponent(createMetadata({ name: "HomePage" }))
        expect(result.level).toBe("page")
      })

      it("classifies DashboardScreen as page", () => {
        const result = classifyComponent(createMetadata({ name: "DashboardScreen" }))
        expect(result.level).toBe("page")
      })

      it("classifies SettingsView as page", () => {
        const result = classifyComponent(createMetadata({ name: "SettingsView" }))
        expect(result.level).toBe("page")
      })
    })

    describe("complexity-based classification", () => {
      it("classifies simple component as atom", () => {
        const result = classifyComponent(createMetadata({
          name: "SimpleText",
          props: ["text", "className"],
          children: [],
        }))
        expect(result.level).toBe("atom")
      })

      it("classifies component with few children as molecule", () => {
        const result = classifyComponent(createMetadata({
          name: "UserProfile",
          props: ["name", "avatar", "role"],
          children: ["Avatar", "Text"],
          imports: ["Avatar", "Text"],
        }))
        expect(result.level).toBe("molecule")
      })

      it("classifies complex component as organism", () => {
        const result = classifyComponent(createMetadata({
          name: "UserDashboard",
          props: Array(15).fill(null).map((_, i) => `prop${i}`),
          children: ["Header", "Sidebar", "Content", "Footer"],
          imports: ["Header", "Sidebar", "Content", "Footer"],
        }))
        expect(result.level).toBe("organism")
      })

      it("classifies layout component as template", () => {
        const result = classifyComponent(createMetadata({
          name: "AppShell",
          isLayoutComponent: true,
        }))
        expect(result.level).toBe("template")
      })
    })

    describe("classification metadata", () => {
      it("includes reasoning for classification", () => {
        const result = classifyComponent(createMetadata({ name: "Button" }))
        expect(result.reasoning).toBeDefined()
        expect(result.reasoning.length).toBeGreaterThan(0)
      })

      it("includes suggested path", () => {
        const result = classifyComponent(createMetadata({ name: "Button" }))
        expect(result.suggestedPath).toContain("atoms/Button")
      })

      it("includes alternatives for uncertain classifications", () => {
        const result = classifyComponent(createMetadata({
          name: "CustomComponent",
          props: ["a", "b", "c"],
          children: ["Child1"],
        }))
        // Low confidence should have alternatives
        if (result.confidence < 0.8) {
          expect(result.alternatives).toBeDefined()
        }
      })
    })
  })

  describe("classifyComponents", () => {
    it("classifies multiple components", () => {
      const components = [
        createMetadata({ name: "Button" }),
        createMetadata({ name: "Header" }),
        createMetadata({ name: "FormField" }),
      ]

      const results = classifyComponents(components)

      expect(results.size).toBe(3)
      expect(results.get("Button")?.level).toBe("atom")
      expect(results.get("Header")?.level).toBe("organism")
      expect(results.get("FormField")?.level).toBe("molecule")
    })

    it("returns Map with component names as keys", () => {
      const components = [
        createMetadata({ name: "Input" }),
        createMetadata({ name: "Modal" }),
      ]

      const results = classifyComponents(components)

      expect(results.has("Input")).toBe(true)
      expect(results.has("Modal")).toBe(true)
    })
  })

  describe("analyzeComplexity", () => {
    it("counts children", () => {
      const result = analyzeComplexity(createMetadata({
        children: ["A", "B", "C"],
      }))
      expect(result.childCount).toBe(3)
    })

    it("counts props", () => {
      const result = analyzeComplexity(createMetadata({
        props: ["a", "b", "c", "d"],
      }))
      expect(result.propCount).toBe(4)
    })

    it("detects component composition", () => {
      const result = analyzeComplexity(createMetadata({
        imports: ["Button", "Input"],
      }))
      expect(result.composesComponents).toBe(true)
    })

    it("detects layout component", () => {
      const result = analyzeComplexity(createMetadata({
        isLayoutComponent: true,
      }))
      expect(result.isLayout).toBe(true)
    })
  })
})

// ============================================================================
// Template Generation Tests
// ============================================================================

describe("Template Generation", () => {
  describe("generateAtomTemplate", () => {
    it("generates button template with variants", () => {
      const template = generateAtomTemplate("Button", "button")

      expect(template).toContain("import * as React")
      expect(template).toContain("cva")
      expect(template).toContain("buttonVariants")
      expect(template).toContain("variant")
      expect(template).toContain("size")
      expect(template).toContain("forwardRef")
      expect(template).toContain('displayName = "Button"')
    })

    it("generates input template", () => {
      const template = generateAtomTemplate("Input", "input")

      expect(template).toContain("inputVariants")
      expect(template).toContain("HTMLInputElement")
      expect(template).toContain("placeholder")
    })

    it("generates badge template", () => {
      const template = generateAtomTemplate("Badge", "badge")

      expect(template).toContain("badgeVariants")
      expect(template).toContain("variant")
    })

    it("generates spinner template", () => {
      const template = generateAtomTemplate("Spinner", "spinner")

      expect(template).toContain("spinnerVariants")
      expect(template).toContain("animate-spin")
    })

    it("includes accessibility for checkbox", () => {
      const template = generateAtomTemplate("Checkbox", "checkbox")

      expect(template).toContain("HTMLButtonElement")
    })

    it("exports component and variants", () => {
      const template = generateAtomTemplate("Switch", "switch")

      expect(template).toContain("export { Switch, switchVariants }")
    })
  })

  describe("generateMoleculeTemplate", () => {
    it("generates form field template", () => {
      const template = generateMoleculeTemplate("FormField", "form-field", ["Label", "Input"])

      expect(template).toContain("import * as React")
      expect(template).toContain('import { Label } from "@/components/atoms/Label"')
      expect(template).toContain('import { Input } from "@/components/atoms/Input"')
      expect(template).toContain("FormFieldProps")
      expect(template).toContain("label")
      expect(template).toContain("error")
    })

    it("generates search bar template", () => {
      const template = generateMoleculeTemplate("SearchBar", "search-bar", ["Input", "Button"])

      expect(template).toContain("SearchBarProps")
      expect(template).toContain("onSearch")
    })

    it("generates alert template", () => {
      const template = generateMoleculeTemplate("Alert", "alert", ["Icon", "Text"])

      expect(template).toContain("AlertProps")
      expect(template).toContain("variant")
    })

    it("includes atoms as imports", () => {
      const template = generateMoleculeTemplate("NavItem", "nav-item", ["Link", "Icon"])

      expect(template).toContain('import { Link } from "@/components/atoms/Link"')
      expect(template).toContain('import { Icon } from "@/components/atoms/Icon"')
    })

    it("uses forwardRef pattern", () => {
      const template = generateMoleculeTemplate("ButtonGroup", "button-group", ["Button"])

      expect(template).toContain("forwardRef")
      expect(template).toContain("HTMLDivElement")
    })
  })

  describe("generateOrganismTemplate", () => {
    it("generates header template", () => {
      const template = generateOrganismTemplate("Header", "header", ["NavItem"], ["Logo"])

      expect(template).toContain("import * as React")
      expect(template).toContain('import { NavItem } from "@/components/molecules/NavItem"')
      expect(template).toContain('import { Logo } from "@/components/atoms/Logo"')
      expect(template).toContain("HeaderProps")
      expect(template).toContain("<header")
    })

    it("generates footer template", () => {
      const template = generateOrganismTemplate("Footer", "footer", ["NavItem"])

      expect(template).toContain("<footer")
      expect(template).toContain("HTMLFooterElement")
    })

    it("generates sidebar template", () => {
      const template = generateOrganismTemplate("Sidebar", "sidebar", ["NavItem"])

      expect(template).toContain("<aside")
      expect(template).toContain("collapsed")
    })

    it("generates navigation template", () => {
      const template = generateOrganismTemplate("Navigation", "navigation", ["NavItem"])

      expect(template).toContain("<nav")
      expect(template).toContain("items")
    })

    it("generates hero template", () => {
      const template = generateOrganismTemplate("Hero", "hero", ["ButtonGroup"])

      expect(template).toContain("<section")
      expect(template).toContain("title")
      expect(template).toContain("subtitle")
      expect(template).toContain("cta")
    })

    it("generates modal template", () => {
      const template = generateOrganismTemplate("Modal", "modal", ["CardHeader"])

      expect(template).toContain("open")
      expect(template).toContain("onClose")
    })

    it("uses semantic HTML elements", () => {
      const headerTemplate = generateOrganismTemplate("Header", "header", [])
      const footerTemplate = generateOrganismTemplate("Footer", "footer", [])
      const navTemplate = generateOrganismTemplate("Nav", "navigation", [])

      expect(headerTemplate).toContain("<header")
      expect(footerTemplate).toContain("<footer")
      expect(navTemplate).toContain("<nav")
    })
  })

  describe("generateTemplateComponent", () => {
    it("generates basic template", () => {
      const template = generateTemplateComponent("DashboardTemplate", {
        organisms: ["Header", "Sidebar"],
      })

      expect(template).toContain("DashboardTemplateProps")
      expect(template).toContain("children")
      expect(template).toContain('import { Header } from "@/components/organisms/Header"')
    })

    it("generates template with header slot", () => {
      const template = generateTemplateComponent("MainLayout", {
        layout: {
          type: "sidebar",
          hasHeader: true,
          hasFooter: false,
          hasSidebar: false,
        },
      })

      expect(template).toContain("<header")
      expect(template).toContain("{header}")
    })

    it("generates template with footer slot", () => {
      const template = generateTemplateComponent("PageLayout", {
        layout: {
          type: "single-column",
          hasHeader: false,
          hasFooter: true,
          hasSidebar: false,
        },
      })

      expect(template).toContain("<footer")
      expect(template).toContain("{footer}")
    })

    it("generates template with sidebar", () => {
      const template = generateTemplateComponent("AdminLayout", {
        layout: {
          type: "sidebar",
          hasHeader: true,
          hasFooter: true,
          hasSidebar: true,
          sidebarPosition: "left",
        },
      })

      expect(template).toContain("<aside")
      expect(template).toContain("{sidebar}")
    })

    it("includes custom slots", () => {
      const template = generateTemplateComponent("CustomTemplate", {
        slots: [
          { name: "banner", description: "Top banner", required: false },
          { name: "sidebar", description: "Sidebar content", required: true },
        ],
      })

      expect(template).toContain("banner")
      expect(template).toContain("sidebar")
    })
  })
})

// ============================================================================
// Folder Structure Tests
// ============================================================================

describe("Folder Structure", () => {
  describe("generateFolderStructure", () => {
    it("returns default structure", () => {
      const structure = generateFolderStructure()

      expect(structure.baseDir).toBe("src/components")
      expect(structure.atoms).toBe("atoms")
      expect(structure.molecules).toBe("molecules")
      expect(structure.organisms).toBe("organisms")
      expect(structure.templates).toBe("templates")
      expect(structure.pages).toBe("pages")
    })

    it("uses custom structure when provided", () => {
      const structure = generateFolderStructure({
        folderStructure: {
          baseDir: "app/components",
          atoms: "ui/atoms",
          molecules: "ui/molecules",
          organisms: "ui/organisms",
          templates: "layouts",
          pages: "views",
        },
      })

      expect(structure.baseDir).toBe("app/components")
      expect(structure.atoms).toBe("ui/atoms")
    })
  })

  describe("getComponentPath", () => {
    it("returns correct atom path", () => {
      const path = getComponentPath("Button", "atom")
      expect(path).toBe("src/components/atoms/Button")
    })

    it("returns correct molecule path", () => {
      const path = getComponentPath("FormField", "molecule")
      expect(path).toBe("src/components/molecules/FormField")
    })

    it("returns correct organism path", () => {
      const path = getComponentPath("Header", "organism")
      expect(path).toBe("src/components/organisms/Header")
    })

    it("returns correct template path", () => {
      const path = getComponentPath("DashboardTemplate", "template")
      expect(path).toBe("src/components/templates/DashboardTemplate")
    })

    it("returns correct page path", () => {
      const path = getComponentPath("HomePage", "page")
      expect(path).toBe("src/components/pages/HomePage")
    })

    it("uses custom folder structure", () => {
      const path = getComponentPath("Button", "atom", {
        baseDir: "app/ui",
        atoms: "primitives",
        molecules: "molecules",
        organisms: "organisms",
        templates: "templates",
        pages: "pages",
      })
      expect(path).toBe("app/ui/primitives/Button")
    })
  })

  describe("generateIndexFile", () => {
    it("generates atom index file", () => {
      const components = [
        { name: "Button", level: "atom" as AtomicLevel },
        { name: "Input", level: "atom" as AtomicLevel },
        { name: "Header", level: "organism" as AtomicLevel },
      ]

      const indexFile = generateIndexFile(components, "atom")

      expect(indexFile).toContain("Atoms - Atomic Design Atom Components")
      expect(indexFile).toContain('export { Button } from "./Button"')
      expect(indexFile).toContain('export { Input } from "./Input"')
      expect(indexFile).not.toContain("Header")
    })

    it("generates molecule index file", () => {
      const components = [
        { name: "FormField", level: "molecule" as AtomicLevel },
        { name: "SearchBar", level: "molecule" as AtomicLevel },
      ]

      const indexFile = generateIndexFile(components, "molecule")

      expect(indexFile).toContain("Molecules")
      expect(indexFile).toContain('export { FormField } from "./FormField"')
      expect(indexFile).toContain('export { SearchBar } from "./SearchBar"')
    })

    it("generates organism index file", () => {
      const components = [
        { name: "Header", level: "organism" as AtomicLevel },
        { name: "Footer", level: "organism" as AtomicLevel },
      ]

      const indexFile = generateIndexFile(components, "organism")

      expect(indexFile).toContain("Organisms")
      expect(indexFile).toContain('export { Header } from "./Header"')
      expect(indexFile).toContain('export { Footer } from "./Footer"')
    })

    it("filters by level", () => {
      const components = [
        { name: "Button", level: "atom" as AtomicLevel },
        { name: "Header", level: "organism" as AtomicLevel },
      ]

      const atomIndex = generateIndexFile(components, "atom")
      const organismIndex = generateIndexFile(components, "organism")

      expect(atomIndex).toContain("Button")
      expect(atomIndex).not.toContain("Header")
      expect(organismIndex).toContain("Header")
      expect(organismIndex).not.toContain("Button")
    })
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration: Full Workflow", () => {
  it("classifies and generates template for button", () => {
    const metadata = createMetadata({ name: "PrimaryButton" })
    const classification = classifyComponent(metadata)

    // Should classify as atom due to "button" pattern
    expect(classification.level).toBe("atom")

    // Generate template
    const template = generateAtomTemplate("PrimaryButton", "button")

    expect(template).toContain("PrimaryButton")
    expect(template).toContain("forwardRef")
    expect(template).toContain("variant")
  })

  it("classifies and generates template for form", () => {
    const metadata = createMetadata({
      name: "LoginForm",
      children: ["FormField", "Button"],
      props: ["onSubmit", "initialValues"],
    })
    const classification = classifyComponent(metadata)

    expect(classification.level).toBe("organism")

    const template = generateOrganismTemplate("LoginForm", "form", ["FormField"], ["Button"])

    expect(template).toContain("LoginForm")
    expect(template).toContain("onSubmit")
    expect(template).toContain("<form")
  })

  it("generates consistent paths for classified components", () => {
    const components = [
      createMetadata({ name: "Button" }),
      createMetadata({ name: "FormField" }),
      createMetadata({ name: "Header" }),
    ]

    const classifications = classifyComponents(components)
    const structure = generateFolderStructure()

    for (const [name, classification] of classifications) {
      const path = getComponentPath(name, classification.level, structure)
      expect(path).toContain(name)
      expect(path).toContain(classification.level)
    }
  })

  it("generates complete component library structure", () => {
    const components = [
      { name: "Button", level: "atom" as AtomicLevel },
      { name: "Input", level: "atom" as AtomicLevel },
      { name: "FormField", level: "molecule" as AtomicLevel },
      { name: "Header", level: "organism" as AtomicLevel },
    ]

    const atomIndex = generateIndexFile(components, "atom")
    const moleculeIndex = generateIndexFile(components, "molecule")
    const organismIndex = generateIndexFile(components, "organism")

    expect(atomIndex).toContain("Button")
    expect(atomIndex).toContain("Input")
    expect(moleculeIndex).toContain("FormField")
    expect(organismIndex).toContain("Header")
  })
})
