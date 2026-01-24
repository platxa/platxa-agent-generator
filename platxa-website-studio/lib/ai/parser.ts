/**
 * Production-grade parser for AI-generated code responses
 * Handles multiple output formats from different LLMs
 */

export interface ParsedFile {
  path: string;
  content: string;
  language: string;
  action: "create" | "update";
}

/**
 * Language to file extension mapping
 */
const LANG_TO_EXT: Record<string, string> = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  xml: "xml",
  html: "html",
  scss: "scss",
  css: "css",
  json: "json",
  yaml: "yml",
};

/**
 * Extension to language mapping
 */
const EXT_TO_LANG: Record<string, string> = {
  py: "python",
  xml: "xml",
  html: "html",
  scss: "scss",
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
 * Infer file path from context (language + content analysis)
 */
function inferFilePath(language: string, content: string, index: number): string {
  const ext = LANG_TO_EXT[language] || "txt";

  // Try to infer from content
  if (language === "python" && content.includes("'name':")) {
    return `theme_generated/__manifest__.py`;
  }
  if (language === "xml" && content.includes("<template")) {
    return `theme_generated/views/templates.xml`;
  }
  if (language === "xml" && content.includes("data-snippet")) {
    return `theme_generated/views/snippets.xml`;
  }
  if (language === "scss" && content.includes("$o-")) {
    return `theme_generated/static/src/scss/primary_variables.scss`;
  }
  if (language === "scss" || language === "css") {
    return `theme_generated/static/src/scss/theme.scss`;
  }
  if (language === "javascript" || language === "js") {
    return `theme_generated/static/src/js/theme.js`;
  }

  // Fallback with index
  return `theme_generated/file_${index + 1}.${ext}`;
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
    .replace(/:$/g, "");           // Remove trailing colon
}

/**
 * Extract filename from various header formats
 */
function extractFilenameFromHeader(header: string): string | null {
  // **filename.ext** or **path/filename.ext**
  const boldMatch = header.match(/\*\*([^*]+\.[a-z]+)\*\*/i);
  if (boldMatch) return normalizePath(boldMatch[1]);

  // ### filename.ext or ### path/filename.ext
  const headingMatch = header.match(/#+\s*([^\n]+\.[a-z]+)/i);
  if (headingMatch) return normalizePath(headingMatch[1]);

  // `filename.ext` or `path/filename.ext`
  const codeMatch = header.match(/`([^`]+\.[a-z]+)`/i);
  if (codeMatch) return normalizePath(codeMatch[1]);

  // filename.ext: or path/filename.ext:
  const colonMatch = header.match(/([a-z_/]+\.[a-z]+):/i);
  if (colonMatch) return normalizePath(colonMatch[1]);

  return null;
}

/**
 * Main parser - handles multiple AI output formats
 */
export function parseGeneratedFiles(response: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const seenPaths = new Set<string>();

  // Strategy 1: Preferred format - ```file:path/file.ext
  const fileBlockRegex = /```(?:(\w+)\s+)?file:([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = fileBlockRegex.exec(response)) !== null) {
    const [, explicitLang, filePath, content] = match;
    const path = normalizePath(filePath);

    if (path && content.trim() && !seenPaths.has(path)) {
      seenPaths.add(path);
      files.push({
        path,
        content: content.trim(),
        language: explicitLang || detectLanguage(path),
        action: "create",
      });
    }
  }

  // Strategy 2: Comment-based - ```python\n# file: path/file.py
  const commentFileRegex = /```(\w+)\n(?:#|\/\/)\s*file:\s*([^\n]+)\n([\s\S]*?)```/g;

  while ((match = commentFileRegex.exec(response)) !== null) {
    const [, language, filePath, content] = match;
    const path = normalizePath(filePath);

    if (path && content.trim() && !seenPaths.has(path)) {
      seenPaths.add(path);
      // Remove the file comment from content
      const cleanContent = content.replace(/^(?:#|\/\/)\s*file:[^\n]*\n/, "").trim();
      files.push({
        path,
        content: cleanContent,
        language,
        action: "create",
      });
    }
  }

  // Strategy 3: Header-based - **filename:**\n```language or ### filename\n```language
  // This handles the format local LLMs often produce
  const headerBlockRegex = /(?:\*\*([^*\n]+)\*\*:?|###?\s+([^\n]+))\s*\n```(\w+)\n([\s\S]*?)```/g;

  while ((match = headerBlockRegex.exec(response)) !== null) {
    const [, boldHeader, hashHeader, language, content] = match;
    const header = boldHeader || hashHeader || "";
    const extractedPath = extractFilenameFromHeader(header);

    if (extractedPath && content.trim() && !seenPaths.has(extractedPath)) {
      // Build full path if it's just a filename
      let path = extractedPath;
      if (!path.includes("/")) {
        // Infer directory structure based on file type
        if (path === "__manifest__.py" || path.endsWith("manifest.py")) {
          path = `theme_generated/${path.replace("manifest.py", "__manifest__.py")}`;
        } else if (path.endsWith(".xml")) {
          path = `theme_generated/views/${path}`;
        } else if (path.endsWith(".scss") || path.endsWith(".css")) {
          path = `theme_generated/static/src/scss/${path}`;
        } else if (path.endsWith(".js")) {
          path = `theme_generated/static/src/js/${path}`;
        } else {
          path = `theme_generated/${path}`;
        }
      }

      seenPaths.add(path);
      files.push({
        path,
        content: content.trim(),
        language,
        action: "create",
      });
    }
  }

  // Strategy 4: Plain code blocks with language - infer paths from content
  // Only if we haven't found any files yet
  if (files.length === 0) {
    const plainBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
    let blockIndex = 0;

    while ((match = plainBlockRegex.exec(response)) !== null) {
      const [, language, content] = match;

      if (content.trim() && language !== "file") {
        const path = inferFilePath(language, content, blockIndex);

        if (!seenPaths.has(path)) {
          seenPaths.add(path);
          files.push({
            path,
            content: content.trim(),
            language,
            action: "create",
          });
          blockIndex++;
        }
      }
    }
  }

  // Validate and clean up files
  return files.filter(file => {
    // Must have valid path and content
    if (!file.path || !file.content) return false;

    // Path must have an extension
    if (!file.path.includes(".")) return false;

    // Content must be substantial (more than just whitespace or short strings)
    if (file.content.length < 10) return false;

    return true;
  });
}

/**
 * Extract text content (non-file) from AI response
 */
export function extractTextContent(response: string): string {
  let text = response;

  // Remove all code blocks
  text = text.replace(/```[\s\S]*?```/g, "");

  // Clean up markdown headers that were file names
  text = text.replace(/\*\*[^*]+\.[a-z]+\*\*:?\s*/gi, "");
  text = text.replace(/###?\s+[^\n]+\.[a-z]+\s*\n/gi, "");

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

/**
 * Check if the response contains parseable file blocks
 */
export function hasFileBlocks(response: string): boolean {
  // Check for any code block
  if (!response.includes("```")) return false;

  // Try to parse and see if we get files
  const files = parseGeneratedFiles(response);
  return files.length > 0;
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
} {
  const paths = files.map(f => f.path);
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check for manifest
  const hasManifest = paths.some(p => p.includes("__manifest__.py"));
  if (!hasManifest) {
    missing.push("__manifest__.py");
  }

  // Check for at least one template
  const hasTemplate = paths.some(p => p.endsWith(".xml"));
  if (!hasTemplate) {
    missing.push("views/templates.xml");
  }

  // Warnings for optional but recommended files
  const hasScss = paths.some(p => p.endsWith(".scss"));
  if (!hasScss) {
    warnings.push("No SCSS files - theme may lack custom styling");
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}
