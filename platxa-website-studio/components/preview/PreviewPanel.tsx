"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  RefreshCw,
  ExternalLink,
  Smartphone,
  Tablet,
  Monitor,
  Loader2,
  AlertCircle,
  Code,
  Globe,
  MousePointer2,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSyncStore, useProjectStore, useEditorStore, useEditorStoreHydration, useChatStore } from "@/lib/stores";
import { useStreamingPreviewSafe, QWebRuntime, detectSnippets, replaceImagesWithPlaceholders } from "@/lib/preview/client";
import { usePreviewHotReload } from "@/lib/hooks";
import { cn } from "@/lib/utils/cn";
import {
  DeviceFrame,
  DeviceSelector,
  DEVICE_SPECS,
  DEVICE_MODELS,
  getDeviceById,
  getDefaultDevice,
  type DeviceType,
  type DeviceOrientation,
} from "./DeviceFrame";
import { BreakpointIndicator } from "./BreakpointIndicator";
import { PreviewErrorBoundary } from "./PreviewErrorBoundary";
import { StreamingOverlay } from "./StreamingOverlay";
import { HotReloadIndicator } from "./HotReloadIndicator";
import { ElementInspector, useElementInspector } from "./ElementInspector";
import { ZoomControls, ZoomIndicator, useZoom } from "./ZoomControls";
import { SnippetSelector, SNIPPET_SELECT_SCRIPT } from "./SnippetSelector";
import { SnippetContextMenu, SNIPPET_CONTEXT_SCRIPT } from "./SnippetContextMenu";

type PreviewMode = "standalone" | "odoo";

/**
 * Sanitize JavaScript content for safe preview embedding
 * Strips ES module imports/exports which can't be used inside inline scripts
 * Also removes Odoo-specific JS that requires the Odoo runtime
 * Also removes problematic patterns that could break the preview
 */
function sanitizeJsForPreview(js: string): string {
  if (!js || !js.trim()) return "";

  let sanitized = js;

  // ==========================================================================
  // ODOO-SPECIFIC JS REMOVAL (these require Odoo runtime which doesn't exist in preview)
  // ==========================================================================

  // Check if this is Odoo-specific JS - if so, return empty or stub
  const isOdooJs = /\bodoo\.define\b|\bpublicWidget\b|\brequire\s*\(\s*['"]web\.|@odoo\//.test(sanitized);

  if (isOdooJs) {
    // Return a stub comment - Odoo JS won't work in preview anyway
    return "// [Odoo JS removed - requires Odoo runtime for preview]";
  }

  // Remove odoo.define() blocks entirely
  sanitized = sanitized.replace(/odoo\.define\s*\([^)]*,\s*function\s*\([^)]*\)\s*\{[\s\S]*?\}\s*\);?/g, "// [odoo.define removed]");

  // Remove require() calls for Odoo modules (web.*, @odoo/*)
  sanitized = sanitized.replace(/\brequire\s*\(\s*['"](?:web\.|@odoo\/)[^'"]*['"]\s*\)/g, "null /* Odoo require removed */");

  // ==========================================================================
  // ES MODULE REMOVAL
  // ==========================================================================

  // Remove ES module import statements (they can't be used in inline scripts)
  // Handles: import x from 'y', import { x } from 'y', import * as x from 'y', import 'y'
  sanitized = sanitized.replace(/^\s*import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"][^'"]+['"]\s*;?\s*$/gm, "// [import removed for preview]");

  // Remove ES module export statements
  // Handles: export default, export { }, export const/let/var/function/class
  sanitized = sanitized.replace(/^\s*export\s+(?:default\s+)?(?:\{[^}]*\}|const|let|var|function|class)/gm, "// [export removed] ");

  // Remove dynamic imports: await import('...')
  sanitized = sanitized.replace(/\bawait\s+import\s*\([^)]+\)/g, "null /* dynamic import removed */");

  // Remove require() calls that reference node modules (not relative paths)
  sanitized = sanitized.replace(/\brequire\s*\(\s*['"][^./][^'"]*['"]\s*\)/g, "null /* require removed */");

  // Strip any remaining standalone import/export keywords at line start that might cause issues
  sanitized = sanitized.replace(/^(import|export)\s/gm, "// $1 ");

  // ==========================================================================
  // TYPESCRIPT/JSX REMOVAL
  // ==========================================================================

  // Remove TypeScript/JSX that browsers can't handle
  sanitized = sanitized.replace(/<[A-Z]\w*[^>]*\/>/g, "/* JSX removed */"); // Self-closing JSX
  sanitized = sanitized.replace(/<[A-Z]\w*[^>]*>[\s\S]*?<\/[A-Z]\w*>/g, "/* JSX removed */"); // JSX blocks

  // Remove type annotations (TypeScript)
  sanitized = sanitized.replace(/:\s*\w+(\[\])?(?=\s*[=;,)])/g, ""); // : Type
  sanitized = sanitized.replace(/<\w+>/g, ""); // Generic types like <T>

  return sanitized.trim();
}

/**
 * Convert SCSS variables to CSS custom properties
 */
function convertScssVariables(scss: string): { css: string; variables: string } {
  const variables: Record<string, string> = {};

  // Extract SCSS variables ($var: value;)
  const varRegex = /\$([\w-]+):\s*([^;]+);/g;
  let match;
  while ((match = varRegex.exec(scss)) !== null) {
    variables[match[1]] = match[2].trim();
  }

  // Convert to CSS custom properties
  let cssVariables = ":root {\n";
  for (const [name, value] of Object.entries(variables)) {
    // Replace $var references with var(--var)
    let resolvedValue = value;
    for (const [vName] of Object.entries(variables)) {
      resolvedValue = resolvedValue.replace(new RegExp(`\\$${vName}`, "g"), `var(--${vName})`);
    }
    cssVariables += `  --${name}: ${resolvedValue};\n`;
  }
  cssVariables += "}\n";

  // Convert remaining SCSS to CSS (basic conversion)
  let css = scss
    .replace(/\$[\w-]+:\s*[^;]+;/g, "") // Remove variable declarations
    .replace(/\$([\w-]+)/g, "var(--$1)") // Replace variable usage
    .replace(/&:hover/g, ":hover")
    .replace(/&:focus/g, ":focus")
    .replace(/&:active/g, ":active");

  return { css, variables: cssVariables };
}

/**
 * Create a shared QWebRuntime instance for preview
 */
const qwebRuntime = new QWebRuntime({
  website: {
    name: "Preview Website",
    company_id: {
      name: "Your Company",
      phone: "+1 (555) 123-4567",
      email: "info@example.com",
    },
  },
});

/**
 * Strip Odoo-specific XML tags that browsers can't render
 * This is the core sanitization step for preview rendering
 * PRODUCTION-GRADE: Handles partial/incomplete tags from streaming
 */
function stripOdooTags(content: string): string {
  return content
    // CRITICAL: Strip any preamble text before the first XML/HTML tag
    // AI sometimes outputs "Here is..." or explanatory text before the actual code
    .replace(/^[\s\S]*?(?=<\?xml|<odoo|<template|<section|<div|<header|<footer|<nav|<main|<!DOCTYPE|<!--|<html)/i, "")
    // Remove XML declarations
    .replace(/<\?xml[^>]*\?>/gi, "")
    // Remove odoo wrapper (complete and partial)
    .replace(/<\/?odoo[^>]*>/gi, "")
    // Remove xpath wrappers - KEEP CONTENT INSIDE (critical fix)
    // Only remove the opening and closing tags, preserve inner content
    .replace(/<xpath[^>]*\/>/gi, "")  // Self-closing xpath (no content)
    .replace(/<xpath[^>]*>/gi, "")    // Opening xpath tag only
    .replace(/<\/xpath>/gi, "")       // Closing xpath tag only
    // Remove partial xpath at start of content (streaming artifact)
    .replace(/^[^<]*<\/xpath>/gi, "")
    // Remove data elements
    .replace(/<\/?data[^>]*>/gi, "")
    // Remove record elements
    .replace(/<record[^>]*>[\s\S]*?<\/record>/gi, "")
    // Remove field elements (Odoo model fields)
    .replace(/<field[^>]*\/>/gi, "")
    .replace(/<field[^>]*>[\s\S]*?<\/field>/gi, "")
    // Remove t-call to website.layout
    .replace(/<t\s+t-call=["']website\.layout["'][^>]*>/g, "")
    .replace(/<\/t>/g, "")
    // Remove empty template wrappers
    .replace(/<template[^>]*>\s*<\/template>/gi, "")
    // Remove template opening/closing (we just want content)
    .replace(/<template[^>]*>/gi, "")
    .replace(/<\/template>/gi, "")
    // Clean up Odoo-specific attributes that might remain
    .replace(/\s+t-(?:if|else|elif|foreach|as|esc|raw|att\w*)="[^"]*"/gi, "")
    // CRITICAL: Remove script tags that might contain ES module imports
    // These would cause "Cannot use import statement outside a module" errors
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "<!-- script removed for preview -->")
    // Clean up multiple whitespace/newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract content from sections (fallback when template extraction fails)
 */
function extractSections(content: string): string {
  const sections: string[] = [];

  // Match <section> elements
  const sectionRegex = /<section[^>]*>[\s\S]*?<\/section>/gi;
  let sectionMatch: RegExpExecArray | null;
  while ((sectionMatch = sectionRegex.exec(content)) !== null) {
    sections.push(sectionMatch[0]);
  }

  // Match common container divs
  const containerPatterns = [
    /<div[^>]*class="[^"]*container[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<div[^>]*class="[^"]*hero[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<div[^>]*class="[^"]*banner[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<header[^>]*>[\s\S]*?<\/header>/gi,
    /<footer[^>]*>[\s\S]*?<\/footer>/gi,
    /<nav[^>]*>[\s\S]*?<\/nav>/gi,
    /<main[^>]*>[\s\S]*?<\/main>/gi,
  ];

  for (const pattern of containerPatterns) {
    let containerMatch: RegExpExecArray | null;
    while ((containerMatch = pattern.exec(content)) !== null) {
      // Avoid duplicates
      if (!sections.some(s => s.includes(containerMatch![0].substring(0, 50)))) {
        sections.push(containerMatch[0]);
      }
    }
  }

  return sections.join("\n\n");
}

/**
 * Strip conversational preamble and streaming artifacts from AI content
 */
function cleanAIContent(content: string): string {
  let cleaned = content;

  // Remove repeated preamble patterns (streaming artifacts)
  // Pattern: "Here is an example...<?xml" repeated with growing content
  const streamingArtifactPattern = /(?:Here (?:is|are)[^<]*)+(?=<\?xml|<odoo|<template|<section)/gi;
  cleaned = cleaned.replace(streamingArtifactPattern, "");

  // Remove standalone conversational text before XML/HTML
  cleaned = cleaned.replace(/^(?:Here (?:is|are)[^\n]*\n*)+/gim, "");
  cleaned = cleaned.replace(/^(?:I(?:'ll| will)[^\n]*\n*)+/gim, "");
  cleaned = cleaned.replace(/^(?:Below (?:is|are)[^\n]*\n*)+/gim, "");
  cleaned = cleaned.replace(/^(?:This (?:is|creates)[^\n]*\n*)+/gim, "");

  // Find the first XML/HTML marker and strip everything before it
  const xmlStart = cleaned.search(/<\?xml|<odoo|<template|<section|<div|<header|<footer/i);
  if (xmlStart > 0 && xmlStart < 1000) {
    cleaned = cleaned.substring(xmlStart);
  }

  return cleaned.trim();
}

/**
 * Extract and render QWeb template content for preview using QWebRuntime
 * Production-grade extraction with multiple fallback strategies
 */
function extractQwebContent(xml: string): { html: string; snippets: string[] } {
  // First, clean the input of conversational preamble and streaming artifacts
  const cleanedXml = cleanAIContent(xml);

  console.log("[extractQwebContent] Input length:", xml.length, "Cleaned length:", cleanedXml.length);
  console.log("[extractQwebContent] Cleaned preview:", cleanedXml.substring(0, 300));

  let html = "";

  // Strategy 1: Extract content from <template> tags
  const templateRegex = /<template[^>]*>([\s\S]*?)<\/template>/g;
  let match;
  while ((match = templateRegex.exec(cleanedXml)) !== null) {
    console.log("[extractQwebContent] Found template, content length:", match[1].length);
    html += match[1];
  }

  // Strategy 2: If no templates found, try extracting from <odoo> wrapper
  if (!html) {
    const odooMatch = cleanedXml.match(/<odoo[^>]*>([\s\S]*?)<\/odoo>/i);
    if (odooMatch) {
      console.log("[extractQwebContent] Found odoo wrapper, extracting content");
      html = odooMatch[1];
    }
  }

  // Strategy 3: If still no content, try direct section extraction
  if (!html && cleanedXml.includes("<")) {
    console.log("[extractQwebContent] Trying direct section extraction");
    html = extractSections(cleanedXml);
  }

  // Strategy 4: Last resort - use entire content if it looks like HTML
  if (!html && (cleanedXml.includes("<section") || cleanedXml.includes("<div"))) {
    console.log("[extractQwebContent] Using raw content as fallback");
    html = cleanedXml;
  }

  // Strip all Odoo-specific tags
  html = stripOdooTags(html);

  // Log extraction result
  if (html.trim()) {
    console.log("[extractQwebContent] SUCCESS - Extracted HTML length:", html.length);
    console.log("[extractQwebContent] First 300 chars:", html.substring(0, 300));
  } else {
    console.warn("[extractQwebContent] FAILED - No HTML content extracted");
    console.warn("[extractQwebContent] Original content sample:", xml.substring(0, 500));
  }

  // Detect snippets used in the template
  const detectedSnippets = detectSnippets(html);

  // Use QWebRuntime for full template rendering (handles t-* directives)
  try {
    const renderedHtml = qwebRuntime.render(html);
    console.log("[extractQwebContent] QWebRuntime rendered successfully, length:", renderedHtml.length);
    html = renderedHtml;
  } catch (error) {
    console.warn("[extractQwebContent] QWebRuntime error, using basic cleanup:", error);
    // Fallback to basic cleanup if runtime fails
    html = html
      // Remove t-if/else/elif attributes
      .replace(/\s*t-if="[^"]*"/g, "")
      .replace(/\s*t-else(?:="[^"]*")?/g, "")
      .replace(/\s*t-elif="[^"]*"/g, "")
      // Convert t-esc to visible placeholders
      .replace(/<t\s+t-esc="([^"]+)"[^/]*\/>/g, '<span class="preview-value">[$1]</span>')
      .replace(/<t\s+t-raw="([^"]+)"[^/]*\/>/g, '<span class="preview-value preview-html">[$1]</span>')
      // Remove t-att* attributes
      .replace(/\s*t-attf?-[\w-]+="[^"]*"/g, "")
      // Remove t-foreach
      .replace(/\s*t-foreach="[^"]*"/g, "")
      .replace(/\s*t-as="[^"]*"/g, "")
      // Remove remaining <t> tags
      .replace(/<t[^>]*>/g, "")
      .replace(/<\/t>/g, "");
  }

  // Replace Odoo image URLs with SVG placeholders
  html = replaceImagesWithPlaceholders(html);

  return { html, snippets: detectedSnippets };
}

/**
 * Generate a loading state HTML document
 * Shown during store hydration to avoid blank preview
 */
function generateLoadingHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loading Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .loader-container {
      text-align: center;
      color: white;
    }
    .loader {
      width: 48px;
      height: 48px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    p { opacity: 0.8; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="loader-container">
    <div class="loader"></div>
    <h2>Loading Preview</h2>
    <p>Preparing your workspace...</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate a complete HTML document from generated Odoo files
 */
function generatePreviewHtml(fileContents: Record<string, string>): string {
  let htmlContent = "";
  let cssContent = "";
  let cssVariables = "";
  let jsContent = "";
  const allSnippets: string[] = [];

  console.log("[generatePreviewHtml] Processing", Object.keys(fileContents).length, "files");

  for (const [path, content] of Object.entries(fileContents)) {
    const ext = path.split(".").pop()?.toLowerCase();
    const fileName = path.split("/").pop()?.toLowerCase() || "";

    console.log(`[generatePreviewHtml] Processing: ${path} (${ext}, ${content.length} chars)`);

    if (ext === "xml") {
      // Odoo QWeb templates - use QWebRuntime
      const { html, snippets } = extractQwebContent(content);
      console.log(`[generatePreviewHtml] Extracted ${html.length} chars HTML from XML`);
      htmlContent += html;
      allSnippets.push(...snippets);
    } else if (ext === "html") {
      htmlContent += content;
    } else if (ext === "scss") {
      const { css, variables } = convertScssVariables(content);
      cssContent += css;
      cssVariables += variables;
    } else if (ext === "css") {
      cssContent += content;
    } else if (ext === "js") {
      // Sanitize JS to remove ES module imports/exports that break inline scripts
      const sanitizedJs = sanitizeJsForPreview(content);
      if (sanitizedJs) {
        jsContent += sanitizedJs + "\n";
      }
    } else if (ext === "py" && fileName === "__manifest__.py") {
      // Show manifest info in a comment (useful for debugging)
      console.log("Odoo manifest detected:", path);
    }
  }

  // Strip external stylesheet links that reference local paths (we inline CSS instead)
  // This prevents 404 errors for paths like /static/src/scss/theme.scss
  htmlContent = htmlContent
    // Remove <link> tags referencing local SCSS/CSS files
    .replace(/<link[^>]*href=["'][^"']*\/static\/[^"']*\.s?css["'][^>]*\/?>/gi, "")
    .replace(/<link[^>]*href=["'](?!https?:\/\/)[^"']*\.s?css["'][^>]*\/?>/gi, "")
    // Remove t-call-assets directives (we handle CSS inline)
    .replace(/<t\s+t-call-assets=["'][^"']*["'][^>]*\/?>/gi, "<!-- assets loaded inline -->")
    // Remove @import statements for local files
    .replace(/@import\s+["'](?!https?:\/\/)[^"']+["']\s*;/gi, "");

  // Summary logging
  console.log("[generatePreviewHtml] ===== SUMMARY =====");
  console.log("[generatePreviewHtml] HTML content length:", htmlContent.length);
  console.log("[generatePreviewHtml] CSS content length:", cssContent.length);
  console.log("[generatePreviewHtml] CSS variables length:", cssVariables.length);
  console.log("[generatePreviewHtml] JS content length:", jsContent.length);
  if (htmlContent.trim()) {
    console.log("[generatePreviewHtml] HTML preview (first 500 chars):", htmlContent.substring(0, 500));
  }

  // If no HTML found, create a premium placeholder
  if (!htmlContent.trim()) {
    htmlContent = `
      <!-- Premium Welcome Screen -->
      <section style="min-height: 100vh; background: linear-gradient(135deg, #0f0f1a 0%, #1a1a3e 50%, #0f0f1a 100%); position: relative; overflow: hidden;">
        <!-- Mesh gradient overlay -->
        <div style="position: absolute; inset: 0; background: radial-gradient(at 20% 30%, rgba(139,92,246,0.3) 0%, transparent 50%), radial-gradient(at 80% 20%, rgba(236,72,153,0.2) 0%, transparent 50%), radial-gradient(at 40% 80%, rgba(59,130,246,0.2) 0%, transparent 50%);"></div>

        <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; text-align: center;">
          <!-- Icon -->
          <div style="width: 80px; height: 80px; border-radius: 24px; background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.2)); display: flex; align-items: center; justify-content: center; margin-bottom: 2rem; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="url(#gradient)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#8b5cf6"/>
                  <stop offset="100%" style="stop-color:#ec4899"/>
                </linearGradient>
              </defs>
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>

          <!-- Title -->
          <h1 style="font-family: system-ui, -apple-system, sans-serif; font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; color: white; margin: 0 0 1rem; letter-spacing: -0.03em; line-height: 1.1;">
            Platxa
            <span style="display: block; background: linear-gradient(135deg, #8b5cf6, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Website Studio</span>
          </h1>

          <p style="font-family: system-ui; font-size: 1.125rem; color: rgba(255,255,255,0.7); margin: 0 0 2rem; max-width: 400px; line-height: 1.6;">
            Describe your website and watch it come to life with AI-powered generation
          </p>

          <!-- Example prompts -->
          <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; max-width: 500px;">
            <span style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 9999px; font-size: 0.875rem; color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.1);">🏠 Modern homepage</span>
            <span style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 9999px; font-size: 0.875rem; color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.1);">☕ Coffee shop</span>
            <span style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 9999px; font-size: 0.875rem; color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.1);">🍕 Restaurant</span>
            <span style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 9999px; font-size: 0.875rem; color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.1);">💼 Business site</span>
          </div>

          <!-- Trust indicators -->
          <div style="display: flex; gap: 3rem; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: 700; color: white;">Odoo 18</div>
              <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">Compatible</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: 700; color: white;">Premium</div>
              <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">Design Quality</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: 700; color: white;">Local AI</div>
              <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">Private & Fast</div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // Bootstrap 5 CDN (same as Odoo 18 uses)
  const bootstrapCss = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css";
  const bootstrapJs = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js";
  const fontAwesomeCss = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";
  // jQuery for legacy JS compatibility (Odoo themes may use $)
  const jQueryJs = "https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js";

  // Log detected snippets for debugging
  if (allSnippets.length > 0) {
    console.log("Detected Odoo snippets:", allSnippets);
  }

  // Odoo color classes simulation + preview enhancements
  const odooColorClasses = `
    /* CSS Custom Properties for theming */
    :root {
      --primary: #0d6efd;
      --primary-dark: #0a58ca;
      --secondary: #6c757d;
      --accent: #6f42c1;
      --bg-light: #f8f9fa;
      --bg-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      --shadow-soft: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
      --shadow-medium: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
      --shadow-large: 0 25px 50px -12px rgba(0,0,0,0.25);
      --radius-sm: 0.375rem;
      --radius-md: 0.5rem;
      --radius-lg: 1rem;
      --radius-xl: 1.5rem;
    }

    /* Odoo color classes */
    .o_cc { background-color: var(--o-cc-bg, #fff); color: var(--o-cc-text, #212529); }
    .o_cc1 { --o-cc-bg: #f8f9fa; --o-cc-text: #212529; }
    .o_cc2 { --o-cc-bg: #e9ecef; --o-cc-text: #212529; }
    .o_cc3 { --o-cc-bg: #dee2e6; --o-cc-text: #212529; }
    .o_cc4 { --o-cc-bg: #343a40; --o-cc-text: #fff; }
    .o_cc5 { --o-cc-bg: #212529; --o-cc-text: #fff; }
    .o_colored_level { padding: 2rem; }
    .oe_structure { min-height: 100px; }
    #wrap { min-height: 100vh; }

    /* Enhanced default styling for better visual appearance */
    body {
      line-height: 1.7;
      color: #374151;
      -webkit-font-smoothing: antialiased;
    }

    /* Modern section styling */
    section {
      padding: 4rem 0;
    }

    section:nth-child(even) {
      background-color: var(--bg-light);
    }

    /* Enhanced headings */
    h1, h2, h3, h4, h5, h6 {
      font-weight: 700;
      color: #1f2937;
      line-height: 1.2;
    }

    h1 { font-size: 3rem; margin-bottom: 1.5rem; }
    h2 { font-size: 2.25rem; margin-bottom: 1.25rem; }
    h3 { font-size: 1.75rem; margin-bottom: 1rem; }

    /* Better paragraph styling */
    p {
      color: #6b7280;
      font-size: 1.1rem;
    }

    /* Enhanced card styling */
    .card {
      border: none !important;
      border-radius: var(--radius-lg) !important;
      box-shadow: var(--shadow-soft) !important;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-medium) !important;
    }

    /* Modern button styling */
    .btn {
      font-weight: 600;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius-md);
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: var(--bg-gradient);
      border: none;
      box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.39);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px 0 rgba(102, 126, 234, 0.5);
    }

    .btn-outline-primary {
      border-width: 2px;
    }

    /* Hero section enhancements */
    .hero-section, section:first-child {
      background: var(--bg-gradient);
      color: white;
      padding: 6rem 0;
      min-height: 60vh;
      display: flex;
      align-items: center;
    }

    .hero-section h1, section:first-child h1,
    .hero-section h2, section:first-child h2 {
      color: white;
    }

    .hero-section p, section:first-child p {
      color: rgba(255,255,255,0.9);
    }

    /* Feature icons */
    .feature-icon, .icon-box {
      width: 64px;
      height: 64px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
      border-radius: var(--radius-lg);
      margin-bottom: 1rem;
    }

    .feature-icon i, .icon-box i {
      font-size: 1.5rem;
      color: #667eea;
    }

    /* Image placeholders */
    img:not([src]), img[src=""], img[src^="/web/image"] {
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
      min-height: 200px;
      display: block;
      border-radius: var(--radius-lg);
    }

    /* Link styling */
    a:not(.btn) {
      color: var(--primary);
      text-decoration: none;
      transition: color 0.2s ease;
    }

    a:not(.btn):hover {
      color: var(--primary-dark);
    }

    /* Footer styling */
    footer {
      background: #1f2937 !important;
      color: white;
      padding: 4rem 0 2rem;
    }

    footer h5, footer h6 {
      color: white;
      font-weight: 600;
    }

    footer p, footer a {
      color: rgba(255,255,255,0.7);
    }

    footer a:hover {
      color: white;
    }

    /* Testimonial styling */
    .testimonial, blockquote {
      font-style: italic;
      border-left: 4px solid var(--primary);
      padding-left: 1.5rem;
      margin: 1.5rem 0;
    }

    /* Badge styling */
    .badge {
      font-weight: 500;
      padding: 0.5em 1em;
      border-radius: 9999px;
    }

    /* Odoo spacing utilities */
    .pt16 { padding-top: 1rem; }
    .pt32 { padding-top: 2rem; }
    .pt48 { padding-top: 3rem; }
    .pt64 { padding-top: 4rem; }
    .pt96 { padding-top: 6rem; }
    .pt160 { padding-top: 10rem; }
    .pb16 { padding-bottom: 1rem; }
    .pb32 { padding-bottom: 2rem; }
    .pb48 { padding-bottom: 3rem; }
    .pb64 { padding-bottom: 4rem; }
    .pb96 { padding-bottom: 6rem; }
    .pb160 { padding-bottom: 10rem; }

    /* Preview value placeholders */
    .preview-value {
      display: inline-block;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-family: ui-monospace, monospace;
      font-size: 0.75rem;
      color: #92400e;
      border: 1px dashed #f59e0b;
    }
    .preview-value.preview-html {
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      color: #1e40af;
      border-color: #3b82f6;
    }
    .preview-field {
      background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
      color: #065f46;
      border: 1px dashed #10b981;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
    }

    /* Template call placeholders */
    .preview-template-call {
      border: 2px dashed #d1d5db;
      padding: 1rem;
      margin: 0.5rem 0;
      border-radius: 0.5rem;
      background: #f9fafb;
    }
    .preview-template-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 0.75rem;
      color: #6b7280;
    }
    .preview-template-name {
      font-family: ui-monospace, monospace;
      background: #e5e7eb;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
    }
    .preview-template-compact {
      display: inline-flex;
      padding: 0.25rem 0.5rem;
      gap: 0.25rem;
    }
    .preview-template-empty {
      color: #9ca3af;
      font-style: italic;
    }

    /* Conditional preview indicators */
    [data-preview-if], [data-preview-elif] {
      position: relative;
      outline: 1px dashed #8b5cf6;
      outline-offset: 2px;
    }
    [data-preview-if]::before, [data-preview-elif]::before {
      content: "if: " attr(data-preview-if) attr(data-preview-elif);
      position: absolute;
      top: -0.75rem;
      left: 0.5rem;
      font-size: 0.625rem;
      background: #8b5cf6;
      color: white;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-family: ui-monospace, monospace;
      opacity: 0.8;
      z-index: 10;
      white-space: nowrap;
    }
    [data-preview-else] {
      position: relative;
      outline: 1px dashed #ec4899;
      outline-offset: 2px;
    }
    [data-preview-else]::before {
      content: "else";
      position: absolute;
      top: -0.75rem;
      left: 0.5rem;
      font-size: 0.625rem;
      background: #ec4899;
      color: white;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-family: ui-monospace, monospace;
      opacity: 0.8;
    }

    /* Loop item indicators */
    [data-preview-loop-item] {
      position: relative;
    }
    [data-preview-loop-item]::after {
      content: "#" attr(data-preview-loop-item);
      position: absolute;
      top: 0.25rem;
      right: 0.25rem;
      font-size: 0.625rem;
      background: #10b981;
      color: white;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-family: ui-monospace, monospace;
      opacity: 0.6;
    }

    /* Editable text indicator */
    .o_default_snippet_text {
      border-bottom: 1px dotted #9ca3af;
    }

    /* Placeholder images */
    img[src^="/web/image"] {
      background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
      min-height: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img[src^="/web/image"]::before {
      content: "Image Placeholder";
      color: #6366f1;
      font-size: 0.875rem;
    }

    /* ========================================
       PREMIUM CSS UTILITIES
       ======================================== */

    /* Glassmorphism utilities */
    .glass {
      background: rgba(255, 255, 255, 0.1) !important;
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .glass-light {
      background: rgba(255, 255, 255, 0.7) !important;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    .glass-dark {
      background: rgba(0, 0, 0, 0.3) !important;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    @supports not (backdrop-filter: blur(10px)) {
      .glass { background: rgba(255, 255, 255, 0.9) !important; }
      .glass-light { background: rgba(255, 255, 255, 0.95) !important; }
      .glass-dark { background: rgba(0, 0, 0, 0.85) !important; }
    }

    /* Gradient text utility */
    .gradient-text {
      background: linear-gradient(135deg, var(--primary, #667eea), var(--accent, #764ba2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Premium layered shadows */
    .shadow-premium {
      box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.06),
        0 2px 4px rgba(0, 0, 0, 0.06),
        0 4px 8px rgba(0, 0, 0, 0.06),
        0 8px 16px rgba(0, 0, 0, 0.06) !important;
    }
    .shadow-premium-lg {
      box-shadow:
        0 4px 8px rgba(0, 0, 0, 0.04),
        0 8px 16px rgba(0, 0, 0, 0.04),
        0 16px 32px rgba(0, 0, 0, 0.04),
        0 32px 64px rgba(0, 0, 0, 0.04) !important;
    }
    .shadow-glow {
      box-shadow: 0 0 40px rgba(102, 126, 234, 0.4) !important;
    }

    /* Premium animations */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fadeInUp { animation: fadeInUp 0.6s ease-out both; }
    .animate-fadeIn { animation: fadeIn 0.4s ease-out both; }
    .animate-scaleIn { animation: scaleIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) both; }

    /* Staggered animation delays */
    .delay-100 { animation-delay: 100ms; }
    .delay-200 { animation-delay: 200ms; }
    .delay-300 { animation-delay: 300ms; }
    .delay-400 { animation-delay: 400ms; }
    .delay-500 { animation-delay: 500ms; }

    /* Premium hover effects */
    .hover-lift {
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease !important;
    }
    .hover-lift:hover {
      transform: translateY(-6px) !important;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15) !important;
    }

    /* Responsive typography */
    .display-fluid {
      font-size: clamp(2.5rem, 5vw + 1rem, 4.5rem);
      letter-spacing: -0.03em;
      line-height: 1.1;
    }
    .lead-fluid {
      font-size: clamp(1rem, 2vw + 0.5rem, 1.25rem);
      line-height: 1.7;
    }

    /* Premium border radius */
    .rounded-2xl { border-radius: 1rem !important; }
    .rounded-3xl { border-radius: 1.5rem !important; }
    .rounded-4xl { border-radius: 2rem !important; }

    /* Mesh gradient backgrounds */
    .bg-mesh {
      background:
        radial-gradient(at 20% 30%, rgba(139, 92, 246, 0.3) 0%, transparent 50%),
        radial-gradient(at 80% 20%, rgba(236, 72, 153, 0.2) 0%, transparent 50%),
        radial-gradient(at 40% 80%, rgba(59, 130, 246, 0.2) 0%, transparent 50%);
    }

    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Odoo Theme Preview</title>
  <link href="${bootstrapCss}" rel="stylesheet">
  <link href="${fontAwesomeCss}" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    ${odooColorClasses}
    ${cssVariables}
    ${cssContent}
  </style>
</head>
<body>
  <div id="wrapwrap">
    <div id="wrap" class="oe_structure">
      ${htmlContent}
    </div>
  </div>
  <script src="${jQueryJs}"></script>
  <script src="${bootstrapJs}"></script>
  ${jsContent ? `<script>
(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', function() {
    try {
      ${jsContent}
    } catch (e) {
      console.warn('[Preview] JS execution error:', e.message);
    }
  });
})();
</script>` : ""}
  ${SNIPPET_SELECT_SCRIPT}
  ${SNIPPET_CONTEXT_SCRIPT}
</body>
</html>
  `.trim();
}

export function PreviewPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [orientation, setOrientation] = useState<DeviceOrientation>("portrait");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("standalone");
  const [currentPath, setCurrentPath] = useState("/");
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [iframeWidth, setIframeWidth] = useState(0);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);

  // Ensure store is hydrated before accessing persisted state
  const isHydrated = useEditorStoreHydration();

  // CRITICAL: Use explicit selectors for proper Zustand reactivity
  // Using destructuring pattern can cause stale closures with useMemo
  const selectedSnippetId = useEditorStore((s) => s.selectedSnippetId);
  const fileContents = useEditorStore((s) => s.fileContents);
  const openTabs = useEditorStore((s) => s.openTabs);
  const lastFileUpdate = useEditorStore((s) => s.lastFileUpdate);

  const setInputValue = useChatStore((s) => s.setInputValue);
  const { previewUrl, previewStatus, setPreviewStatus, isDeploying } = useSyncStore();
  const { odooUrl, odooStatus } = useProjectStore();
  const streamingPreview = useStreamingPreviewSafe();

  // Track file count for reactive updates
  const fileCount = Object.keys(fileContents).length;
  const fileKeys = Object.keys(fileContents).join(',');

  // CRITICAL: Generate content hash for iframe key to force re-render on ANY content change
  // This is production-grade: ensures React replaces iframe when content changes
  const contentHash = useMemo(() => {
    const contentStr = Object.entries(fileContents)
      .map(([path, content]) => `${path}:${content.length}:${content.slice(0, 50)}`)
      .join('|');
    // Simple hash function for reliable change detection
    let hash = 0;
    for (let i = 0; i < contentStr.length; i++) {
      const char = contentStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }, [fileContents]);

  // Debug: Log when fileContents changes
  useEffect(() => {
    console.log("[PreviewPanel] fileContents changed - count:", fileCount, "keys:", fileKeys, "lastUpdate:", lastFileUpdate, "hash:", contentHash);
  }, [fileCount, fileKeys, lastFileUpdate, contentHash]);

  // Hot reload integration
  const [hotReloadKey, setHotReloadKey] = useState(0);
  const { state: hotReloadState, triggerReload } = usePreviewHotReload({
    debounceMs: 300,
    enabled: previewMode === "standalone" && !streamingPreview?.isStreaming,
    onBeforeReload: () => {
      setIsLoading(true);
    },
    onReload: (changedFiles) => {
      console.log("Hot reload triggered for:", changedFiles);
      setHotReloadKey((prev) => prev + 1);
    },
    onAfterReload: () => {
      setTimeout(() => setIsLoading(false), 150);
    },
  });

  // Zoom controls
  const { zoom, setZoom } = useZoom(100);

  // Element inspector
  const { isEnabled: inspectorEnabled, toggle: toggleInspector, disable: disableInspector } = useElementInspector();

  // Get current device model for orientation support check
  const currentDeviceModel = deviceId ? getDeviceById(deviceId) : getDefaultDevice(device);
  const supportsOrientation = currentDeviceModel?.supportsLandscape && device !== "desktop";

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Handle device change from selector
  const handleDeviceChange = (type: DeviceType, id?: string) => {
    setDevice(type);
    setDeviceId(id);
    // Reset orientation when switching to desktop
    if (type === "desktop") {
      setOrientation("portrait");
    }
  };

  // Use odooUrl or default localhost
  const baseUrl = odooUrl || previewUrl || "http://localhost:8069";

  // Check if Odoo is available
  const isOdooAvailable = odooStatus === "connected";

  // Generate standalone preview HTML (with streaming support)
  // CRITICAL: Include fileCount and fileKeys as dependencies for robust reactivity
  const standaloneHtml = useMemo(() => {
    if (previewMode !== "standalone") return "";

    // Show loading state during hydration (don't return empty string)
    if (!isHydrated) {
      console.log("[PreviewPanel] Waiting for hydration...");
      return generateLoadingHtml();
    }

    console.log("[PreviewPanel] ===== Generating preview HTML =====");
    console.log("[PreviewPanel] fileCount:", fileCount, "fileKeys:", fileKeys);
    console.log("[PreviewPanel] fileContents object keys:", Object.keys(fileContents));

    // If streaming, use partial content for preview
    if (streamingPreview?.isStreaming && streamingPreview.partialHtml) {
      const streamingFiles: Record<string, string> = {
        "streaming/preview.xml": streamingPreview.partialHtml,
      };
      if (streamingPreview.partialCss) {
        streamingFiles["streaming/preview.scss"] = streamingPreview.partialCss;
      }
      console.log("[PreviewPanel] Using streaming files for preview");
      return generatePreviewHtml({ ...fileContents, ...streamingFiles });
    }

    const html = generatePreviewHtml(fileContents);
    console.log("[PreviewPanel] Generated HTML length:", html.length);
    console.log("[PreviewPanel] HTML contains sections:", html.includes("<section"));
    return html;
  }, [isHydrated, fileContents, fileCount, fileKeys, lastFileUpdate, contentHash, previewMode, streamingPreview?.isStreaming, streamingPreview?.partialHtml, streamingPreview?.partialCss]);

  // Create blob URL for standalone preview
  const previewBlobUrl = useMemo(() => {
    if (!standaloneHtml) return null;
    const blob = new Blob([standaloneHtml], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [standaloneHtml]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  // Refresh preview
  const refreshPreview = useCallback(() => {
    setIsLoading(true);
    setHasError(false);

    if (previewMode === "odoo" && iframeRef.current) {
      const timestamp = Date.now();
      iframeRef.current.src = `${baseUrl}${currentPath}?_t=${timestamp}`;
    } else {
      // For standalone, just trigger re-render
      setTimeout(() => setIsLoading(false), 300);
    }
  }, [previewMode, baseUrl, currentPath]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
    setPreviewStatus("ready");
  };

  // Handle iframe error
  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
    setPreviewStatus("error");
  };

  // Auto-refresh after deploy
  useEffect(() => {
    if (!isDeploying && previewStatus === "loading" && previewMode === "odoo") {
      const timeout = setTimeout(refreshPreview, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isDeploying, previewStatus, previewMode, refreshPreview]);

  // Update standalone preview when files change
  useEffect(() => {
    if (previewMode === "standalone" && Object.keys(fileContents).length > 0) {
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 200);
    }
  }, [fileContents, previewMode]);

  // Track iframe width for breakpoint indicator
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setIframeWidth(width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update preview when streaming content changes
  useEffect(() => {
    if (streamingPreview?.isStreaming && previewMode === "standalone") {
      // Force re-render on streaming updates
      setIsLoading(false);
    }
  }, [streamingPreview?.partialHtml, streamingPreview?.isStreaming, previewMode]);

  // Open in new tab
  const openExternal = () => {
    if (previewMode === "standalone" && previewBlobUrl) {
      window.open(previewBlobUrl, "_blank");
    } else {
      window.open(`${baseUrl}${currentPath}`, "_blank");
    }
  };

  // Handle snippet context menu actions
  const handleSnippetAction = useCallback(
    (action: string, snippetId: string) => {
      const prompts: Record<string, string> = {
        regenerate: `Regenerate only the ${snippetId} section with a fresh design, keeping all other sections unchanged.`,
        restyle: `Restyle the ${snippetId} section with different colors and spacing, keeping the same content structure.`,
        duplicate: `Duplicate the ${snippetId} section with a variation below the original.`,
        remove: `Remove the ${snippetId} section from the page.`,
      };
      const prompt = prompts[action];
      if (prompt) {
        setInputValue(prompt);
      }
    },
    [setInputValue],
  );

  const hasGeneratedFiles = Object.keys(fileContents).length > 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-muted/30">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-background">
          {/* Preview Mode Toggle */}
          <div className="flex items-center border rounded-md">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={previewMode === "standalone" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-none first:rounded-l-md"
                  onClick={() => setPreviewMode("standalone")}
                >
                  <Code className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Standalone Preview</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={previewMode === "odoo" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-none last:rounded-r-md"
                  onClick={() => setPreviewMode("odoo")}
                  disabled={!isOdooAvailable}
                >
                  <Globe className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isOdooAvailable ? "Odoo Preview" : "Odoo not connected"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Device toggles */}
          <div className="flex items-center border rounded-md">
            {(["mobile", "tablet", "desktop"] as DeviceType[]).map((d) => {
              const Icon = d === "mobile" ? Smartphone : d === "tablet" ? Tablet : Monitor;
              return (
                <Tooltip key={d}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={device === d ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8 rounded-none first:rounded-l-md last:rounded-r-md"
                      onClick={() => handleDeviceChange(d)}
                    >
                      <Icon className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{d.charAt(0).toUpperCase() + d.slice(1)}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Device Model Selector */}
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => setShowDeviceSelector(!showDeviceSelector)}
                >
                  <span className="max-w-[100px] truncate">
                    {currentDeviceModel?.name || "Device"}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Select specific device</TooltipContent>
            </Tooltip>
            {showDeviceSelector && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-md shadow-lg p-2 min-w-[200px]">
                <DeviceSelector
                  deviceType={device}
                  deviceId={deviceId}
                  orientation={orientation}
                  onDeviceChange={(type, id) => {
                    handleDeviceChange(type, id);
                    setShowDeviceSelector(false);
                  }}
                  onOrientationChange={setOrientation}
                />
              </div>
            )}
          </div>

          {/* Orientation toggle */}
          {supportsOrientation && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setOrientation(orientation === "portrait" ? "landscape" : "portrait")}
                >
                  <RotateCcw className={cn("w-4 h-4", orientation === "landscape" && "rotate-90")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {orientation === "portrait" ? "Switch to Landscape" : "Switch to Portrait"}
              </TooltipContent>
            </Tooltip>
          )}

          {/* URL input (only for Odoo mode) */}
          {previewMode === "odoo" && (
            <div className="flex-1 flex items-center gap-2">
              <Input
                value={currentPath}
                onChange={(e) => setCurrentPath(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && refreshPreview()}
                placeholder="/"
                className="h-8 text-sm font-mono"
              />
            </div>
          )}

          {/* File count for standalone mode */}
          {previewMode === "standalone" && (
            <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {streamingPreview?.isStreaming
                  ? "Streaming preview..."
                  : hasGeneratedFiles
                  ? `Previewing ${Object.keys(fileContents).length} generated file(s)`
                  : "No files generated yet"}
              </span>
            </div>
          )}

          {/* Breakpoint indicator */}
          {iframeWidth > 0 && (
            <BreakpointIndicator width={iframeWidth} />
          )}

          {/* Hot reload indicator */}
          {previewMode === "standalone" && (
            <HotReloadIndicator state={hotReloadState} />
          )}

          {/* Zoom Controls */}
          {previewMode === "standalone" && (
            <ZoomControls zoom={zoom} onZoomChange={setZoom} />
          )}

          {/* Inspector Toggle */}
          {previewMode === "standalone" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={inspectorEnabled ? "secondary" : "ghost"}
                  size="icon"
                  className={cn("h-8 w-8", inspectorEnabled && "inspector-toggle-active")}
                  onClick={toggleInspector}
                >
                  <MousePointer2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {inspectorEnabled ? "Disable Inspector" : "Element Inspector"}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Actions */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={refreshPreview}
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={openExternal}
                disabled={previewMode === "standalone" && !previewBlobUrl}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in new tab</TooltipContent>
          </Tooltip>

          {/* Fullscreen toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</TooltipContent>
          </Tooltip>
        </div>

        {/* Preview Area */}
        <div ref={containerRef} className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <PreviewErrorBoundary onRetry={refreshPreview}>
            <DeviceFrame device={device} deviceId={deviceId} orientation={orientation}>
              {/* Streaming overlay */}
              {streamingPreview?.isStreaming && (
                <StreamingOverlay
                  isStreaming={streamingPreview.isStreaming}
                  progress={streamingPreview.streamProgress}
                  templateCount={streamingPreview.completedTemplates}
                />
              )}

              {/* Loading overlay */}
              {isLoading && !streamingPreview?.isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {isDeploying ? "Deploying changes..." : "Loading preview..."}
                    </span>
                  </div>
                </div>
              )}

            {/* Error state (only for Odoo mode) */}
            {hasError && !isLoading && previewMode === "odoo" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10">
                <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                <p className="text-sm font-medium mb-2">Unable to load preview</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Make sure Odoo is running at {baseUrl}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPreviewMode("standalone")}>
                    <Code className="w-4 h-4 mr-2" />
                    Use Standalone
                  </Button>
                  <Button size="sm" onClick={refreshPreview}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Preview iframe */}
            {previewMode === "standalone" ? (
              <div
                className={cn(
                  "preview-iframe-container w-full h-full preview-zoom-container",
                  hotReloadState.isReloading && "reloading",
                  inspectorEnabled && "inspector-mode"
                )}
                style={{ transform: `scale(${zoom / 100})` }}
              >
                <iframe
                  key={`preview-${contentHash}-${hotReloadKey}-${lastFileUpdate}`}
                  ref={iframeRef}
                  data-testid="preview-iframe"
                  srcDoc={standaloneHtml}
                  className={cn(
                    "w-full h-full border-0 bg-white",
                    hotReloadState.reloadCount > 0 && "hot-reload-fade-in"
                  )}
                  sandbox="allow-scripts allow-same-origin"
                  title="Standalone Preview"
                  onLoad={handleIframeLoad}
                />
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                data-testid="preview-iframe"
                src={`${baseUrl}${currentPath}`}
                className="w-full h-full border-0"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                title="Website Preview"
              />
            )}

            {/* Element Inspector */}
            {previewMode === "standalone" && (
              <ElementInspector
                iframeRef={iframeRef}
                enabled={inspectorEnabled}
                onClose={disableInspector}
              />
            )}

            {/* Snippet click-to-select bridge */}
            {previewMode === "standalone" && (
              <SnippetSelector
                iframeRef={iframeRef}
                enabled={!inspectorEnabled}
              />
            )}
            </DeviceFrame>
          </PreviewErrorBoundary>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1 border-t bg-background text-xs text-muted-foreground">
          <span>
            {previewMode === "standalone"
              ? streamingPreview?.isStreaming
                ? `Streaming • ${streamingPreview.completedTemplates} templates`
                : `Standalone Preview • ${Object.keys(fileContents).length} files`
              : baseUrl}
          </span>
          <div className="flex items-center gap-2">
            {/* Zoom indicator */}
            {previewMode === "standalone" && zoom !== 100 && (
              <ZoomIndicator zoom={zoom} />
            )}
            {/* Inspector indicator */}
            {previewMode === "standalone" && inspectorEnabled && (
              <span className="text-blue-500 text-xs">Inspector</span>
            )}
            {/* Selected snippet indicator */}
            {previewMode === "standalone" && selectedSnippetId && (
              <span className="text-purple-500 text-xs font-mono">
                {selectedSnippetId}
              </span>
            )}
            {/* Hot reload count */}
            {previewMode === "standalone" && hotReloadState.reloadCount > 0 && (
              <span className="text-muted-foreground/60">
                {hotReloadState.reloadCount} reload{hotReloadState.reloadCount !== 1 ? "s" : ""}
              </span>
            )}
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                hasError && previewMode === "odoo"
                  ? "bg-red-500"
                  : streamingPreview?.isStreaming
                  ? "bg-purple-500 animate-pulse"
                  : hotReloadState.isPending
                  ? "bg-amber-500 animate-pulse"
                  : hotReloadState.isReloading
                  ? "bg-blue-500 animate-pulse"
                  : isLoading
                  ? "bg-yellow-500"
                  : "bg-green-500"
              )}
            />
            <span>
              {previewMode === "standalone"
                ? streamingPreview?.isStreaming
                  ? `Streaming ${Math.round(streamingPreview.streamProgress)}%`
                  : hotReloadState.isPending
                  ? "Changes pending..."
                  : hotReloadState.isReloading
                  ? "Updating..."
                  : hasGeneratedFiles
                  ? "Ready"
                  : "Waiting for code"
                : hasError
                ? "Error"
                : isLoading
                ? "Loading"
                : "Connected"}
            </span>
          </div>
        </div>
      </div>

      {/* Snippet right-click context menu */}
      {previewMode === "standalone" && (
        <SnippetContextMenu onAction={handleSnippetAction} />
      )}
    </TooltipProvider>
  );
}
