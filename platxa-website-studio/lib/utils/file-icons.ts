import {
  File,
  FileCode,
  FileJson,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  Image,
  Palette,
  Settings,
  type LucideIcon,
} from "lucide-react";

type FileIconMap = Record<string, LucideIcon>;

const extensionIcons: FileIconMap = {
  // Python
  py: FileCode,

  // Web
  html: FileCode,
  htm: FileCode,
  xml: FileCode,

  // Styles
  css: Palette,
  scss: Palette,
  sass: Palette,
  less: Palette,

  // JavaScript/TypeScript
  js: FileCode,
  jsx: FileCode,
  ts: FileCode,
  tsx: FileCode,

  // Data
  json: FileJson,
  yaml: FileJson,
  yml: FileJson,

  // Images
  png: Image,
  jpg: Image,
  jpeg: Image,
  gif: Image,
  svg: Image,
  webp: Image,
  ico: Image,

  // Documents
  md: FileText,
  txt: FileText,
  rst: FileText,

  // Config
  toml: Settings,
  ini: Settings,
  cfg: Settings,
  conf: Settings,
};

const filenameIcons: FileIconMap = {
  "__manifest__.py": Settings,
  "__init__.py": FileCode,
  "package.json": FileJson,
  "tsconfig.json": Settings,
  ".gitignore": Settings,
  "README.md": FileText,
};

/**
 * Get the appropriate icon component for a file based on its name/extension
 */
export function getFileIcon(
  filename: string,
  isDirectory: boolean = false,
  isOpen: boolean = false
): LucideIcon {
  if (isDirectory) {
    return isOpen ? FolderOpen : Folder;
  }

  // Check for exact filename match first
  if (filenameIcons[filename]) {
    return filenameIcons[filename];
  }

  // Get extension
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && extensionIcons[ext]) {
    return extensionIcons[ext];
  }

  return File;
}

/**
 * Get Monaco editor language ID for a file
 */
export function getFileLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    py: "python",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    html: "html",
    htm: "html",
    xml: "xml",
    css: "css",
    scss: "scss",
    sass: "scss",
    less: "less",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    txt: "plaintext",
    sh: "shell",
    bash: "shell",
  };

  return languageMap[ext || ""] || "plaintext";
}
