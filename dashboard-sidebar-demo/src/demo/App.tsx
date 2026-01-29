import { DashboardSidebar } from "@/components/sidebar"

export function App() {
  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />

      {/* Main Content Area */}
      <main className="flex-1 bg-background p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-2 text-3xl font-bold text-foreground">
            Dashboard Sidebar Demo
          </h1>
          <p className="mb-8 text-muted-foreground">
            Built with Platxa Brand Kit, React 19, Tailwind CSS v4, and Framer Motion
          </p>

          {/* Feature Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="Brand Kit Integration"
              description="Uses @platxa/brand-kit with OKLCH colors, semantic tokens, and 12-step color scales."
              color="purple"
            />
            <FeatureCard
              title="Collapsible Sidebar"
              description="Smooth animations powered by Framer Motion for expanding and collapsing."
              color="teal"
            />
            <FeatureCard
              title="Accessible"
              description="Proper ARIA labels, keyboard navigation, and focus management."
              color="purple"
            />
            <FeatureCard
              title="Badge Support"
              description="Navigation items can display notification badges with count."
              color="teal"
            />
            <FeatureCard
              title="Reduced Motion"
              description="Respects prefers-reduced-motion for users who prefer less animation."
              color="purple"
            />
            <FeatureCard
              title="TypeScript"
              description="Fully typed components with exported prop interfaces."
              color="teal"
            />
          </div>

          {/* Color Palette Display */}
          <div className="mt-12">
            <h2 className="mb-4 text-xl font-semibold">Brand Kit Colors</h2>
            <div className="flex flex-wrap gap-4">
              <ColorSwatch name="Purple 9" className="bg-purple-9" />
              <ColorSwatch name="Purple 10" className="bg-purple-10" />
              <ColorSwatch name="Purple 11" className="bg-purple-11" />
              <ColorSwatch name="Teal 9" className="bg-teal-9" />
              <ColorSwatch name="Sidebar" className="bg-sidebar" textDark />
              <ColorSwatch name="Accent" className="bg-sidebar-accent" textDark />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

interface FeatureCardProps {
  title: string
  description: string
  color: "purple" | "teal"
}

function FeatureCard({ title, description, color }: FeatureCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div
        className={`mb-3 inline-block rounded-md px-2 py-1 text-xs font-medium ${
          color === "purple"
            ? "bg-purple-3 text-purple-11"
            : "bg-teal-3 text-teal-9"
        }`}
      >
        {color === "purple" ? "Primary" : "Accent"}
      </div>
      <h3 className="mb-2 font-semibold text-card-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

interface ColorSwatchProps {
  name: string
  className: string
  textDark?: boolean
}

function ColorSwatch({ name, className, textDark }: ColorSwatchProps) {
  return (
    <div className="text-center">
      <div
        className={`h-12 w-12 rounded-lg border border-border ${className}`}
      />
      <span className={`mt-1 block text-xs ${textDark ? "text-foreground" : "text-muted-foreground"}`}>
        {name}
      </span>
    </div>
  )
}
