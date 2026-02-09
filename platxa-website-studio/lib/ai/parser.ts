/**
 * Production-grade parser for AI-generated code responses
 * Handles multiple output formats from different LLMs (GPT, Claude, Llama, Mistral, etc.)
 *
 * Supported formats:
 * 1. ```lang file:path/to/file.ext - Explicit file path in code fence
 * 2. ```lang\n# file: path/to/file.ext - Comment-based file path
 * 3. **filename.ext:**\n```lang - Header-based file naming
 * 4. Plain code blocks - Content-based inference for Odoo themes
 */

export interface ParsedFile {
  path: string;
  content: string;
  language: string;
  action: "create" | "update";
}

/**
 * Language to file extension mapping (comprehensive)
 */
const LANG_TO_EXT: Record<string, string> = {
  python: "py",
  py: "py",
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  xml: "xml",
  html: "html",
  htm: "html",
  scss: "scss",
  sass: "scss",
  css: "css",
  json: "json",
  yaml: "yml",
  yml: "yml",
  markdown: "md",
  md: "md",
  qweb: "xml",
  jinja: "xml",
  jinja2: "xml",
};

/**
 * Extension to language mapping
 */
const EXT_TO_LANG: Record<string, string> = {
  py: "python",
  xml: "xml",
  html: "html",
  htm: "html",
  scss: "scss",
  sass: "scss",
  css: "css",
  js: "javascript",
  ts: "typescript",
  tsx: "typescriptreact",
  jsx: "javascriptreact",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
};

/**
 * Detect language from file path
 */
function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_LANG[ext] || "plaintext";
}

/**
 * Normalize language identifier to standard form
 */
function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  // Map common variations
  const langMap: Record<string, string> = {
    "py": "python",
    "js": "javascript",
    "ts": "typescript",
    "htm": "html",
    "sass": "scss",
    "qweb": "xml",
    "jinja": "xml",
    "jinja2": "xml",
  };
  return langMap[normalized] || normalized;
}

/**
 * Content-based file type detection for Odoo themes
 * Analyzes content patterns to determine the most appropriate file path
 */
function inferFilePathFromContent(language: string, content: string, index: number): string {
  const normalizedLang = normalizeLanguage(language);
  const ext = LANG_TO_EXT[normalizedLang] || "txt";
  const contentLower = content.toLowerCase();

  // Python file detection
  if (normalizedLang === "python") {
    if (content.includes("'name':") || content.includes('"name":')) {
      if (content.includes("'version':") || content.includes('"version":')) {
        return "theme_generated/__manifest__.py";
      }
    }
    if (content.includes("from odoo") || content.includes("import odoo")) {
      return `theme_generated/models/theme_${index + 1}.py`;
    }
    return `theme_generated/__manifest__.py`;
  }

  // XML/QWeb template detection
  if (normalizedLang === "xml" || normalizedLang === "html") {
    // Odoo-specific patterns
    if (content.includes("<odoo>") || content.includes("<odoo ")) {
      if (content.includes("data-snippet") || content.includes("t-snippet")) {
        return "theme_generated/views/snippets/snippets.xml";
      }
      if (content.includes("<template") && content.includes("inherit_id")) {
        return "theme_generated/views/templates.xml";
      }
      if (content.includes("<template")) {
        return "theme_generated/views/pages.xml";
      }
      return "theme_generated/views/templates.xml";
    }

    // Standalone template detection
    if (content.includes("<template")) {
      if (contentLower.includes("hero") || contentLower.includes("banner")) {
        return "theme_generated/views/snippets/s_hero.xml";
      }
      if (contentLower.includes("footer")) {
        return "theme_generated/views/snippets/s_footer.xml";
      }
      if (contentLower.includes("header") || contentLower.includes("navbar")) {
        return "theme_generated/views/snippets/s_header.xml";
      }
      if (contentLower.includes("feature") || contentLower.includes("service")) {
        return "theme_generated/views/snippets/s_features.xml";
      }
      if (contentLower.includes("testimonial") || contentLower.includes("review")) {
        return "theme_generated/views/snippets/s_testimonials.xml";
      }
      if (contentLower.includes("contact") || contentLower.includes("form")) {
        return "theme_generated/views/snippets/s_contact.xml";
      }
      if (contentLower.includes("about")) {
        return "theme_generated/views/snippets/s_about.xml";
      }
      if (contentLower.includes("pricing") || contentLower.includes("plan")) {
        return "theme_generated/views/snippets/s_pricing.xml";
      }
      return "theme_generated/views/templates.xml";
    }

    // HTML section detection (common LLM output)
    if (content.includes("<section") || content.includes("<div")) {
      if (contentLower.includes("hero") || contentLower.includes("banner") || contentLower.includes("jumbotron")) {
        return "theme_generated/views/snippets/s_hero.xml";
      }
      if (contentLower.includes("footer")) {
        return "theme_generated/views/snippets/s_footer.xml";
      }
      if (contentLower.includes("header") || contentLower.includes("nav")) {
        return "theme_generated/views/snippets/s_header.xml";
      }
      if (contentLower.includes("feature") || contentLower.includes("service") || contentLower.includes("card")) {
        return "theme_generated/views/snippets/s_features.xml";
      }
      // Generic section
      return `theme_generated/views/snippets/s_section_${index + 1}.xml`;
    }

    // Default XML
    return `theme_generated/views/template_${index + 1}.xml`;
  }

  // SCSS/CSS detection
  if (normalizedLang === "scss" || normalizedLang === "css" || normalizedLang === "sass") {
    if (content.includes("$o-") || content.includes("--o-")) {
      return "theme_generated/static/src/scss/primary_variables.scss";
    }
    if (contentLower.includes(":root") || content.includes("--")) {
      return "theme_generated/static/src/scss/variables.scss";
    }
    if (contentLower.includes("@import") || contentLower.includes("@use")) {
      return "theme_generated/static/src/scss/theme.scss";
    }
    if (contentLower.includes("hero") || contentLower.includes("banner")) {
      return "theme_generated/static/src/scss/snippets/_hero.scss";
    }
    return "theme_generated/static/src/scss/theme.scss";
  }

  // JavaScript detection
  if (normalizedLang === "javascript" || normalizedLang === "js") {
    if (content.includes("odoo.define") || content.includes("@odoo/")) {
      return "theme_generated/static/src/js/theme.js";
    }
    if (content.includes("publicWidget") || content.includes("PublicWidget")) {
      return "theme_generated/static/src/js/snippets.js";
    }
    return "theme_generated/static/src/js/theme.js";
  }

  // JSON detection
  if (normalizedLang === "json") {
    return "theme_generated/data/config.json";
  }

  // Fallback with meaningful name
  return `theme_generated/files/file_${index + 1}.${ext}`;
}

/**
 * Normalize file path (clean up and standardize)
 */
function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/^\/+/, "")           // Remove leading slashes
    .replace(/\s+/g, "_")          // Replace spaces with underscores
    .replace(/['"]/g, "")          // Remove quotes
    .replace(/\*\*/g, "")          // Remove markdown bold
    .replace(/:$/g, "")            // Remove trailing colon
    .replace(/^\.\//, "");         // Remove leading ./
}

/**
 * Extract filename from various header formats
 */
function extractFilenameFromHeader(header: string): string | null {
  if (!header) return null;

  // **filename.ext** or **path/filename.ext**
  const boldMatch = header.match(/\*\*([^*]+\.[a-z0-9]+)\*\*/i);
  if (boldMatch) return normalizePath(boldMatch[1]);

  // ### filename.ext or ### path/filename.ext
  const headingMatch = header.match(/#+\s*([^\n]+\.[a-z0-9]+)/i);
  if (headingMatch) return normalizePath(headingMatch[1]);

  // `filename.ext` or `path/filename.ext`
  const codeMatch = header.match(/`([^`]+\.[a-z0-9]+)`/i);
  if (codeMatch) return normalizePath(codeMatch[1]);

  // filename.ext: or path/filename.ext:
  const colonMatch = header.match(/([a-z0-9_\-./]+\.[a-z0-9]+):/i);
  if (colonMatch) return normalizePath(colonMatch[1]);

  // Just a path with extension
  const pathMatch = header.match(/([a-z0-9_\-./]+\.[a-z0-9]+)/i);
  if (pathMatch) return normalizePath(pathMatch[1]);

  return null;
}

/**
 * Build full Odoo theme path from a simple filename
 */
function buildFullPath(filename: string): string {
  if (filename.includes("/")) {
    // Already has path structure
    if (!filename.startsWith("theme_generated/") && !filename.startsWith("theme_")) {
      return `theme_generated/${filename}`;
    }
    return filename;
  }

  // Infer directory structure based on file type
  if (filename === "__manifest__.py" || filename.endsWith("manifest.py")) {
    return `theme_generated/${filename.replace("manifest.py", "__manifest__.py")}`;
  }
  if (filename.endsWith(".xml")) {
    return `theme_generated/views/${filename}`;
  }
  if (filename.endsWith(".scss") || filename.endsWith(".css") || filename.endsWith(".sass")) {
    return `theme_generated/static/src/scss/${filename}`;
  }
  if (filename.endsWith(".js")) {
    return `theme_generated/static/src/js/${filename}`;
  }
  if (filename.endsWith(".py")) {
    return `theme_generated/models/${filename}`;
  }

  return `theme_generated/${filename}`;
}

/**
 * Sanitize content by removing invalid HTML document structure
 * Returns cleaned content or null if completely invalid
 */
function sanitizeOdooContent(content: string): string | null {
  let cleaned = content;

  // Check for full HTML document structure (INVALID for Odoo)
  const hasDoctype = content.includes('<!DOCTYPE');
  const hasHtmlTag = /<html[\s>]/i.test(content);
  const hasHeadTag = /<head[\s>]/i.test(content);
  const hasBodyTag = /<body[\s>]/i.test(content);

  if (hasDoctype || hasHtmlTag || hasHeadTag || hasBodyTag) {
    // Try to extract just the useful section content
    // Look for content inside <body> or standalone sections

    // Extract body content if present
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      cleaned = bodyMatch[1].trim();
    }

    // Extract sections from the cleaned content
    const sections: string[] = [];
    const sectionRegex = /<section[^>]*>[\s\S]*?<\/section>/gi;
    let sectionMatch: RegExpExecArray | null;
    while ((sectionMatch = sectionRegex.exec(cleaned)) !== null) {
      sections.push(sectionMatch[0]);
    }

    // Also extract divs with common classes
    const divRegex = /<div[^>]*class="[^"]*(?:hero|banner|features?|about|contact|footer|header)[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
    let divMatch: RegExpExecArray | null;
    while ((divMatch = divRegex.exec(cleaned)) !== null) {
      // Avoid duplicates
      if (!sections.some(s => s.includes(divMatch![0]))) {
        sections.push(divMatch[0]);
      }
    }

    if (sections.length > 0) {
      cleaned = sections.join('\n\n');
    } else {
      // No valid sections found - this content is unusable
      console.warn('[Parser] Rejecting content with HTML document structure - no valid sections found');
      return null;
    }
  }

  // Remove any remaining invalid tags
  cleaned = cleaned
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[\s\S]*?<\/style>/gi, '')   // Remove style tags (should be in SCSS)
    .trim();

  return cleaned.length > 20 ? cleaned : null;
}

/**
 * Wrap HTML/section content in Odoo template structure
 */
function wrapInOdooTemplate(content: string, templateId: string): string {
  // First, sanitize the content
  const sanitized = sanitizeOdooContent(content);
  if (!sanitized) {
    // Return empty template if content is invalid
    return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <!-- Invalid content was removed -->
</odoo>`;
  }

  // Check if already wrapped
  if (sanitized.includes("<odoo>") || sanitized.includes("<template")) {
    return sanitized;
  }

  // Clean template ID
  const cleanId = templateId.replace(/[^a-z0-9_]/gi, "_").toLowerCase();

  return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="${cleanId}" name="${cleanId.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}">
    ${sanitized}
  </template>
</odoo>`;
}

/**
 * Strip conversational preamble text from AI responses
 * Removes phrases like "Here is...", "I'll create...", explanatory text before code blocks
 */
function stripConversationalPreamble(response: string): string {
  // Common preamble patterns to remove
  const preamblePatterns = [
    /^(?:Here (?:is|are) (?:an? )?(?:example|the|my|your|a).*?:?\s*\n*)+/gim,
    /^(?:I(?:'ll| will) (?:create|generate|build|make|write).*?:?\s*\n*)+/gim,
    /^(?:Below (?:is|are).*?:?\s*\n*)+/gim,
    /^(?:The following.*?:?\s*\n*)+/gim,
    /^(?:This (?:is|creates|generates).*?:?\s*\n*)+/gim,
    /^(?:Let me (?:create|generate|show).*?:?\s*\n*)+/gim,
  ];

  let cleaned = response;

  // Apply each pattern
  for (const pattern of preamblePatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Also strip any text before the first code block or XML declaration
  const firstCodeBlock = cleaned.search(/```|\<\?xml|\<odoo|\<template/i);
  if (firstCodeBlock > 0 && firstCodeBlock < 500) {
    // Check if the text before is conversational (doesn't look like code)
    const textBefore = cleaned.substring(0, firstCodeBlock);
    if (!/[\{\}\[\]<>]/.test(textBefore) || textBefore.includes("Here is")) {
      cleaned = cleaned.substring(firstCodeBlock);
    }
  }

  return cleaned.trim();
}

/**
 * Main parser - handles multiple AI output formats
 * Production-grade with comprehensive format support
 */
export function parseGeneratedFiles(response: string): ParsedFile[] {
  // Preprocess: strip conversational preamble
  const cleanedResponse = stripConversationalPreamble(response);

  const files: ParsedFile[] = [];
  const seenPaths = new Set<string>();
  const seenContents = new Set<string>(); // Dedupe by content hash

  const addFile = (path: string, content: string, language: string): boolean => {
    const normalizedPath = normalizePath(path);
    const contentHash = content.trim().substring(0, 100); // Simple hash

    if (!normalizedPath || !content.trim()) return false;
    if (seenPaths.has(normalizedPath)) return false;
    if (seenContents.has(contentHash)) return false;
    if (content.trim().length < 10) return false;
    if (!normalizedPath.includes(".")) return false;

    seenPaths.add(normalizedPath);
    seenContents.add(contentHash);

    files.push({
      path: normalizedPath,
      content: content.trim(),
      language: normalizeLanguage(language) || detectLanguage(normalizedPath),
      action: "create",
    });
    return true;
  };

  // Strategy 1: Explicit file path format - ```lang file:path/to/file.ext
  const fileBlockRegex = /```(\w+)?\s*file:\s*([^\n]+)\n([\s\S]*?)```/gi;
  let match;

  while ((match = fileBlockRegex.exec(cleanedResponse)) !== null) {
    const [, lang, filePath, content] = match;
    const path = buildFullPath(normalizePath(filePath));
    addFile(path, content, lang || detectLanguage(path));
  }

  // Strategy 2: Comment-based file path - ```lang\n# file: path or // file: path
  const commentFileRegex = /```(\w+)\n\s*(?:#|\/\/|<!--)\s*file:\s*([^\n>]+)(?:-->)?\n([\s\S]*?)```/gi;

  while ((match = commentFileRegex.exec(cleanedResponse)) !== null) {
    const [, language, filePath, content] = match;
    const path = buildFullPath(normalizePath(filePath));
    // Remove the file comment from content
    const cleanContent = content.replace(/^\s*(?:#|\/\/|<!--)\s*file:[^\n]*\n?/i, "").trim();
    addFile(path, cleanContent, language);
  }

  // Strategy 3: Header-based format - **filename:**\n```lang or ### filename\n```lang
  const headerBlockRegex = /(?:\*\*([^*\n]+)\*\*:?|#{1,4}\s+([^\n]+))\s*\n+```(\w+)\n([\s\S]*?)```/gi;

  while ((match = headerBlockRegex.exec(cleanedResponse)) !== null) {
    const [, boldHeader, hashHeader, language, content] = match;
    const header = boldHeader || hashHeader || "";
    const extractedPath = extractFilenameFromHeader(header);

    if (extractedPath) {
      const path = buildFullPath(extractedPath);
      addFile(path, content, language);
    }
  }

  // Strategy 4: Inline file marker - File: path/to/file.ext or Filename: file.ext
  const inlineFileRegex = /(?:file(?:name)?|path):\s*([^\n]+\.[a-z0-9]+)\s*\n+```(\w+)\n([\s\S]*?)```/gi;

  while ((match = inlineFileRegex.exec(cleanedResponse)) !== null) {
    const [, filePath, language, content] = match;
    const path = buildFullPath(normalizePath(filePath));
    addFile(path, content, language);
  }

  // Strategy 5: Plain code blocks - content-based inference (ALWAYS try this)
  // This is critical for LLMs that don't follow formatting instructions
  const plainBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
  let blockIndex = 0;

  while ((match = plainBlockRegex.exec(cleanedResponse)) !== null) {
    const [fullMatch, language, content] = match;

    // Skip if this block was already captured by other strategies
    const contentTrimmed = content.trim();
    if (seenContents.has(contentTrimmed.substring(0, 100))) continue;

    // Skip non-code languages
    const normalizedLang = normalizeLanguage(language);
    if (["text", "plaintext", "console", "bash", "shell", "sh", "terminal", "output"].includes(normalizedLang)) {
      continue;
    }

    // Infer path from content
    const path = inferFilePathFromContent(normalizedLang, contentTrimmed, blockIndex);

    // For HTML sections, wrap in Odoo template structure
    let finalContent = contentTrimmed;
    if ((normalizedLang === "html" || normalizedLang === "xml") &&
        !contentTrimmed.includes("<odoo>") &&
        !contentTrimmed.includes("<template")) {
      const templateId = `snippet_${blockIndex + 1}`;
      finalContent = wrapInOdooTemplate(contentTrimmed, templateId);
    }

    if (addFile(path, finalContent, normalizedLang)) {
      blockIndex++;
    }
  }

  // Strategy 5b: Code blocks WITHOUT language specifier (common with small models)
  // Matches ``` followed by newline and content (no language word)
  const noLangBlockRegex = /```\n([\s\S]*?)```/g;

  while ((match = noLangBlockRegex.exec(cleanedResponse)) !== null) {
    const [, content] = match;
    const contentTrimmed = content.trim();

    // Skip if already captured
    if (seenContents.has(contentTrimmed.substring(0, 100))) continue;
    if (contentTrimmed.length < 20) continue;

    // Detect language from content
    let detectedLang = "plaintext";
    if (contentTrimmed.includes("<odoo>") || contentTrimmed.includes("<template")) {
      detectedLang = "xml";
    } else if (contentTrimmed.startsWith("<") && contentTrimmed.includes(">")) {
      detectedLang = "html";
    } else if (contentTrimmed.includes("'name':") || contentTrimmed.includes("def ")) {
      detectedLang = "python";
    } else if (contentTrimmed.includes("{") && contentTrimmed.includes(":")) {
      if (contentTrimmed.includes("$") || contentTrimmed.includes("@import")) {
        detectedLang = "scss";
      } else {
        detectedLang = "css";
      }
    }

    if (detectedLang === "plaintext") continue;

    const path = inferFilePathFromContent(detectedLang, contentTrimmed, blockIndex);

    // For HTML/XML without Odoo wrapper, wrap it
    let finalContent = contentTrimmed;
    if ((detectedLang === "html" || detectedLang === "xml") &&
        !contentTrimmed.includes("<odoo>") &&
        !contentTrimmed.includes("<template")) {
      const templateId = `snippet_${blockIndex + 1}`;
      finalContent = wrapInOdooTemplate(contentTrimmed, templateId);
    }

    if (addFile(path, finalContent, detectedLang)) {
      blockIndex++;
    }
  }

  // Strategy 6: Loose XML/HTML detection (no code fence)
  // Some LLMs output raw XML without proper fencing
  if (files.length === 0) {
    // Look for <odoo> blocks
    const odooBlockRegex = /<odoo[^>]*>[\s\S]*?<\/odoo>/gi;
    let odooIndex = 0;

    while ((match = odooBlockRegex.exec(cleanedResponse)) !== null) {
      const content = match[0];
      const path = `theme_generated/views/template_${odooIndex + 1}.xml`;
      if (addFile(path, content, "xml")) {
        odooIndex++;
      }
    }

    // Look for standalone <template> blocks
    if (files.length === 0) {
      const templateBlockRegex = /<template[^>]*>[\s\S]*?<\/template>/gi;
      let templateIndex = 0;

      while ((match = templateBlockRegex.exec(cleanedResponse)) !== null) {
        const content = match[0];
        const wrappedContent = `<?xml version="1.0" encoding="utf-8"?>\n<odoo>\n  ${content}\n</odoo>`;
        const path = `theme_generated/views/template_${templateIndex + 1}.xml`;
        if (addFile(path, wrappedContent, "xml")) {
          templateIndex++;
        }
      }
    }

    // Strategy 7: Raw HTML sections (common with small models like llama3.2:1b)
    // Look for <section>, <div class="hero">, <header>, <footer> etc.
    if (files.length === 0) {
      const htmlSectionRegex = /<(section|header|footer|nav|main|article|div\s+class=["'][^"']*(?:hero|banner|feature|service|about|contact|testimonial)[^"']*["'])[^>]*>[\s\S]*?<\/\1>/gi;
      let sectionIndex = 0;

      while ((match = htmlSectionRegex.exec(cleanedResponse)) !== null) {
        const content = match[0];
        const tagType = match[1].toLowerCase();
        const sectionName = tagType.includes("hero") ? "hero" :
                           tagType.includes("banner") ? "banner" :
                           tagType.includes("feature") ? "features" :
                           tagType.includes("header") ? "header" :
                           tagType.includes("footer") ? "footer" :
                           `section_${sectionIndex + 1}`;

        const wrappedContent = wrapInOdooTemplate(content, `s_${sectionName}`);
        const path = `theme_generated/views/snippets/s_${sectionName}.xml`;
        if (addFile(path, wrappedContent, "xml")) {
          sectionIndex++;
        }
      }
    }
  }

  // Sort files by type (manifest first, then views, then assets)
  return files.sort((a, b) => {
    const order = (path: string): number => {
      if (path.includes("__manifest__")) return 0;
      if (path.includes("/views/")) return 1;
      if (path.includes("/static/")) return 2;
      if (path.includes("/models/")) return 3;
      return 4;
    };
    return order(a.path) - order(b.path);
  });
}

/**
 * Extract text content (non-file) from AI response
 */
export function extractTextContent(response: string): string {
  let text = response;

  // Remove all code blocks
  text = text.replace(/```[\s\S]*?```/g, "");

  // Remove raw XML blocks
  text = text.replace(/<odoo[\s\S]*?<\/odoo>/gi, "");
  text = text.replace(/<template[\s\S]*?<\/template>/gi, "");

  // Clean up markdown headers that were file names
  text = text.replace(/\*\*[^*]+\.[a-z0-9]+\*\*:?\s*/gi, "");
  text = text.replace(/#{1,4}\s+[^\n]+\.[a-z0-9]+\s*\n/gi, "");

  // Clean up file markers
  text = text.replace(/(?:file(?:name)?|path):\s*[^\n]+\.[a-z0-9]+\s*\n/gi, "");

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

/**
 * Check if the response contains parseable file blocks
 */
export function hasFileBlocks(response: string): boolean {
  // Quick checks
  if (response.includes("```")) return true;
  if (response.includes("<odoo>")) return true;
  if (response.includes("<template")) return true;

  return false;
}

/**
 * Format files for display in chat
 */
export function formatFilesForDisplay(files: ParsedFile[]): string {
  if (files.length === 0) return "";

  const fileList = files.map((f) => `- ${f.path} (${f.language})`).join("\n");
  return `Generated ${files.length} file(s):\n${fileList}`;
}

/**
 * Validate parsed files for Odoo theme structure
 */
export function validateOdooTheme(files: ParsedFile[]): {
  isValid: boolean;
  missing: string[];
  warnings: string[];
  suggestions: string[];
} {
  const paths = files.map(f => f.path);
  const missing: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check for manifest (required)
  const hasManifest = paths.some(p => p.includes("__manifest__.py"));
  if (!hasManifest) {
    missing.push("__manifest__.py - Required for Odoo module");
  }

  // Check for at least one template/view
  const hasTemplate = paths.some(p => p.endsWith(".xml"));
  if (!hasTemplate) {
    missing.push("views/*.xml - At least one template required");
  }

  // Warnings for recommended files
  const hasScss = paths.some(p => p.endsWith(".scss") || p.endsWith(".css"));
  if (!hasScss) {
    warnings.push("No SCSS/CSS files - theme may lack custom styling");
    suggestions.push("Add static/src/scss/theme.scss for custom styles");
  }

  // Check for proper Odoo structure
  const hasProperStructure = paths.some(p => p.startsWith("theme_"));
  if (!hasProperStructure) {
    warnings.push("Files not in theme_* directory - may need restructuring");
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
    suggestions,
  };
}

/**
 * Generate a default __init__.py (required for every Odoo module)
 */
export function generateInitPy(): string {
  return `# -*- coding: utf-8 -*-
# Odoo theme module - no Python code needed for themes
`;
}

/**
 * Ensure all required Odoo module files exist AND are valid
 * PRODUCTION-GRADE: Validates and fixes ALL files before export
 */
export function ensureRequiredFiles(files: ParsedFile[], themeName: string = "Theme Generated"): ParsedFile[] {
  const result: ParsedFile[] = [];
  const paths = files.map(f => f.path);

  // Derive module name from theme name
  // PRODUCTION-CRITICAL: Preserve underscores in module names!
  // theme_custom -> theme_custom (not theme_themecustom)
  const moduleName = themeName
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, '')  // Keep underscores!
    .replace(/\s+/g, '_');
  const finalModuleName = moduleName.startsWith('theme_') ? moduleName : `theme_${moduleName}`;

  // STEP 1: Validate and fix ALL XML files first
  const validatedFiles: ParsedFile[] = [];
  for (const file of files) {
    if (file.path.endsWith(".xml")) {
      // CRITICAL: Ensure valid Odoo XML structure
      const fixedContent = ensureValidOdooXml(file.content, file.path);
      validatedFiles.push({
        ...file,
        content: fixedContent,
      });
    } else {
      validatedFiles.push(file);
    }
  }

  // STEP 2: Check for __manifest__.py - PRODUCTION-CRITICAL validation
  // ROOT CAUSE: AI-generated manifests often lack assets section or have incomplete data arrays
  const manifestIdx = validatedFiles.findIndex(f => f.path.includes("__manifest__.py"));

  // Count XML files that should be in data array
  const xmlFilesCount = validatedFiles.filter(f => f.path.endsWith(".xml")).length;
  // Count CSS/SCSS/JS files that should be in assets section
  const assetFilesCount = validatedFiles.filter(f =>
    f.path.endsWith(".scss") || f.path.endsWith(".css") || f.path.endsWith(".js")
  ).length;

  // Validate manifest has ALL required components
  let hasValidManifest = false;
  if (manifestIdx >= 0) {
    const manifestContent = validatedFiles[manifestIdx].content;

    // Basic required fields
    const hasVersion = manifestContent.includes("'version'");
    const hasDepends = manifestContent.includes("'depends'");
    const hasLicense = manifestContent.includes("'license'");

    // CRITICAL: Check if data array has roughly correct number of XML files
    const dataArrayMatch = manifestContent.match(/'data'\s*:\s*\[([\s\S]*?)\]/);
    const dataArrayContent = dataArrayMatch ? dataArrayMatch[1] : "";
    const dataEntriesCount = (dataArrayContent.match(/\.xml/g) || []).length;

    // CRITICAL: Check if assets section exists when asset files exist
    const hasAssetsSection = manifestContent.includes("'assets':");
    const needsAssets = assetFilesCount > 0;

    // Manifest is invalid if:
    // 1. Missing basic fields
    // 2. Data array is significantly incomplete (missing > 30% of XML files)
    // 3. Missing assets section when CSS/SCSS/JS files exist
    const dataIsComplete = dataEntriesCount >= Math.floor(xmlFilesCount * 0.7);
    const assetsIsValid = !needsAssets || hasAssetsSection;

    hasValidManifest = hasVersion && hasDepends && hasLicense && dataIsComplete && assetsIsValid;

    if (!hasValidManifest) {
      console.log(`[Parser] Manifest validation failed:`,
        `version=${hasVersion}, depends=${hasDepends}, license=${hasLicense}`,
        `dataComplete=${dataIsComplete} (${dataEntriesCount}/${xmlFilesCount})`,
        `assetsValid=${assetsIsValid} (hasSection=${hasAssetsSection}, needs=${needsAssets})`
      );
    }
  }

  if (!hasValidManifest) {
    // Generate proper manifest with correct module name for asset paths
    const manifestContent = generateManifest(themeName, validatedFiles, finalModuleName);
    result.push({
      path: "theme_generated/__manifest__.py",
      content: manifestContent,
      language: "python",
      action: "create",
    });
  }

  // STEP 3: Add all validated files (except old invalid manifest)
  for (const file of validatedFiles) {
    if (file.path.includes("__manifest__.py") && !hasValidManifest) {
      continue; // Skip invalid manifest, we added a new one
    }
    result.push(file);
  }

  // STEP 4: Check for ROOT __init__.py (REQUIRED for Odoo modules)
  // PRODUCTION-CRITICAL: Must check for ROOT init, not just any __init__.py
  // ROOT CAUSE FIX: models/__init__.py was matching, but root __init__.py was missing
  const hasRootInit = result.some(f =>
    f.path === "theme_generated/__init__.py" ||
    f.path.match(/^theme_[a-z0-9_]+\/__init__\.py$/i) ||
    f.path === "__init__.py"
  );
  if (!hasRootInit) {
    result.push({
      path: "theme_generated/__init__.py",
      content: generateInitPy(),
      language: "python",
      action: "create",
    });
  }

  // STEP 5: Ensure models/__init__.py exists if models/ directory has files
  const hasModelsDir = result.some(f => f.path.includes("/models/") && !f.path.endsWith("__init__.py"));
  const hasModelsInit = result.some(f => f.path.includes("models/__init__.py"));
  if (hasModelsDir && !hasModelsInit) {
    result.push({
      path: "theme_generated/models/__init__.py",
      content: generateInitPy(),
      language: "python",
      action: "create",
    });
  }

  return result;
}

/**
 * Generate a default __manifest__.py if missing
 * Follows Odoo 18 theme structure requirements
 * PRODUCTION-GRADE: Correct asset paths with module prefix
 */
export function generateManifest(themeName: string, files: ParsedFile[], moduleName: string = "theme_generated"): string {
  // PRODUCTION-CRITICAL: Include ALL XML files in 'data' section
  // This includes views/, views/snippets/, views/pages/, data/, etc.
  // ROOT CAUSE FIX: Previous filter only matched views/ not views/snippets/
  const xmlFiles = files
    .filter(f => f.path.endsWith(".xml"))
    .map(f => {
      // Normalize path: remove theme_generated/ or any theme_* prefix
      let relativePath = f.path
        .replace(/^theme_generated\//, "")
        .replace(/^theme_[a-z0-9_]+\//i, "");
      return `        '${relativePath}',`;
    })
    // Remove duplicates
    .filter((path, index, self) => self.indexOf(path) === index);

  // SCSS/CSS/JS go in 'assets' section - MUST include module name prefix
  // PRODUCTION-CRITICAL: Asset paths must be moduleName/static/src/...
  const scssFiles = files
    .filter(f => f.path.endsWith(".scss") || f.path.endsWith(".css"))
    .map(f => {
      // Remove theme_generated/ or any theme_* prefix, keep static/src/...
      const relativePath = f.path
        .replace(/^theme_generated\//, "")
        .replace(/^theme_[a-z0-9_]+\//i, "");
      return `${moduleName}/${relativePath}`;
    })
    .filter((path, index, self) => self.indexOf(path) === index); // Dedupe

  const jsFiles = files
    .filter(f => f.path.endsWith(".js"))
    .map(f => {
      // Remove theme_generated/ or any theme_* prefix, keep static/src/...
      const relativePath = f.path
        .replace(/^theme_generated\//, "")
        .replace(/^theme_[a-z0-9_]+\//i, "");
      return `${moduleName}/${relativePath}`;
    })
    .filter((path, index, self) => self.indexOf(path) === index); // Dedupe

  let assets = "";
  if (scssFiles.length > 0 || jsFiles.length > 0) {
    const assetLines: string[] = [];
    scssFiles.forEach(f => assetLines.push(`            '${f}',`));
    jsFiles.forEach(f => assetLines.push(`            '${f}',`));
    assets = `
    'assets': {
        'web.assets_frontend': [
${assetLines.join("\n")}
        ],
    },`;
  }

  return `# -*- coding: utf-8 -*-
{
    'name': '${themeName}',
    'version': '18.0.1.0.0',
    'category': 'Theme/Creative',
    'summary': 'AI-generated Odoo website theme',
    'description': '''
        Custom website theme generated by Platxa Website Studio.
        Built for Odoo 18.
    ''',
    'author': 'Platxa Studio',
    'website': 'https://platxa.com',
    'license': 'LGPL-3',
    'depends': ['website'],
    'data': [
${xmlFiles.join("\n")}
    ],${assets}
    'images': [
        'static/description/banner.png',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
`;
}

/**
 * Detect and repair corrupted XML attributes
 * ROOT CAUSE: Previous duplicate fixer corrupted attributes by replacing text inside quotes
 * Pattern: attribute="value"GARBAGE"anothervalue" -> attribute="value"
 */
export function repairCorruptedXmlAttributes(content: string): { content: string; fixed: boolean } {
  let fixed = content;
  let wasFixed = false;

  // Pattern: attribute="value" followed by unquoted text then another "value"
  // Example: t-esc="product.description"Exceptional service!"display-6 fw-bold mb-3">
  // Should become: t-esc="product.description"/>
  const corruptedAttrPattern = /(<[^>]*\s+[a-z-]+="[^"]*)"[^"<>]*"[^"]*"([^>]*>)/gi;

  let iterations = 0;
  while (corruptedAttrPattern.test(fixed) && iterations < 10) {
    corruptedAttrPattern.lastIndex = 0; // Reset regex state
    fixed = fixed.replace(corruptedAttrPattern, (match, before, after) => {
      wasFixed = true;
      return `${before}"${after}`;
    });
    iterations++;
  }

  // Also fix: ="value"text"value"> pattern more aggressively
  // Matches: ="something"GARBAGE"othertext" and replaces with ="something"
  const attrGarbagePattern = /="([^"]{1,100})"[^"<>=\s]{1,100}"[^"<>=]*"/g;
  if (attrGarbagePattern.test(fixed)) {
    attrGarbagePattern.lastIndex = 0;
    fixed = fixed.replace(attrGarbagePattern, (match, validValue) => {
      wasFixed = true;
      return `="${validValue}"`;
    });
  }

  // Fix broken t-esc with garbage: <t t-esc="var"garbage> -> <t t-esc="var"/>
  fixed = fixed.replace(/<t\s+t-esc="([^"]+)"[^/>\s][^>]*>/g, (match, varName) => {
    wasFixed = true;
    return `<t t-esc="${varName}"/>`;
  });

  return { content: fixed, fixed: wasFixed };
}

/**
 * PRODUCTION-GRADE: Ensure ALL XML files have proper Odoo structure
 * This is the FINAL validation before export
 */
export function ensureValidOdooXml(content: string, filePath: string): string {
  let fixed = content.trim();

  // STEP 0: Repair any corrupted XML attributes from previous bad auto-fixes
  const repairResult = repairCorruptedXmlAttributes(fixed);
  if (repairResult.fixed) {
    console.log(`[Parser] Repaired corrupted XML attributes in ${filePath}`);
    fixed = repairResult.content;
  }

  // Skip if already properly wrapped
  if (fixed.includes("<odoo>") || fixed.includes("<odoo ")) {
    // Ensure XML declaration exists
    if (!fixed.startsWith("<?xml")) {
      fixed = `<?xml version="1.0" encoding="utf-8"?>\n${fixed}`;
    }
    return fixed;
  }

  // Remove any existing XML declarations (will re-add)
  fixed = fixed.replace(/<\?xml[^?]*\?>\s*/g, '').trim();

  // Remove HTML comments at the start that might interfere
  fixed = fixed.replace(/^<!--[^>]*-->\s*/g, '').trim();

  // Check if it's a raw template without odoo wrapper
  if (fixed.includes("<template")) {
    return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
${fixed}
</odoo>`;
  }

  // Check if it's raw HTML/sections that need full wrapping
  if (fixed.includes("<section") || fixed.includes("<div") || fixed.includes("<header") || fixed.includes("<footer")) {
    const templateId = filePath
      .replace(/^.*\//, '')
      .replace(/\.xml$/, '')
      .replace(/[^a-z0-9_]/gi, '_')
      .toLowerCase();

    return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="${templateId}" name="${templateId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}">
    ${fixed}
  </template>
</odoo>`;
  }

  // Default: wrap in odoo tags
  return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
${fixed}
</odoo>`;
}
