"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Palette,
  Layout,
  Zap,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const features = [
  {
    icon: MessageSquare,
    title: "Natural Language",
    description: "Describe your website in plain English and watch it come to life",
  },
  {
    icon: Palette,
    title: "Beautiful Themes",
    description: "Industry-specific color palettes and typography that look professional",
  },
  {
    icon: Layout,
    title: "Odoo-Native",
    description: "Generates real Odoo themes with QWeb templates and snippets",
  },
  {
    icon: Zap,
    title: "Instant Preview",
    description: "See your changes in real-time with live Odoo preview",
  },
];

const examplePrompts = [
  "Create a modern tech startup website with a dark theme",
  "Build a restaurant website with warm colors and food gallery",
  "Design a professional law firm website with testimonials",
  "Make an e-commerce landing page with product showcase",
];

export default function HomePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    try {
      // Try to create project in database (requires auth)
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prompt.trim().slice(0, 100),
          description: prompt.trim(),
        }),
      });

      if (res.ok) {
        const { project } = await res.json();
        router.push(`/studio/${project.id}?prompt=${encodeURIComponent(prompt)}`);
        return;
      }
    } catch {
      // Auth not available or API error - fall through to demo mode
    }

    // Fallback: demo mode with local-only project
    const projectId = `project-${Date.now()}`;
    router.push(`/studio/${projectId}?prompt=${encodeURIComponent(prompt)}`);
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Platxa Studio</span>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" size="sm">
              Documentation
            </Button>
            <Button variant="ghost" size="sm">
              Examples
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Build Odoo Websites with{" "}
            <span className="text-primary">AI Magic</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10">
            Describe your dream website and watch it come to life. Generate
            complete Odoo themes, pages, and snippets with natural language.
          </p>

          {/* Main Input */}
          <div className="flex gap-3 max-w-2xl mx-auto mb-6">
            <Input
              placeholder="Describe your website..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              className="h-14 text-lg"
            />
            <Button
              onClick={handleStart}
              disabled={!prompt.trim() || isLoading}
              className="h-14 px-8"
            >
              {isLoading ? (
                "Creating..."
              ) : (
                <>
                  Start Building
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </div>

          {/* Example Prompts */}
          <div className="flex flex-wrap justify-center gap-2">
            {examplePrompts.map((example, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(example)}
                className="text-sm px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-24"
        >
          {features.map((feature, i) => (
            <div
              key={i}
              className="p-6 rounded-xl border bg-card hover:shadow-lg transition-shadow"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Demo Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-24"
        >
          <div className="rounded-xl border bg-card overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-sm text-muted-foreground ml-2">
                Platxa Website Studio
              </span>
            </div>
            <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
              <p className="text-muted-foreground">
                Interactive preview will appear here
              </p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-24">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Platxa Website Studio - AI-powered Odoo website generation
            </p>
            <p className="text-sm text-muted-foreground">
              Built for Odoo 18
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
