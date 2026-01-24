/**
 * Path utilities for file operations
 */

/**
 * Normalize a file path - remove leading/trailing slashes, handle ..
 */
export function normalizePath(path: string): string {
  // Remove leading and trailing slashes
  let normalized = path.replace(/^\/+|\/+$/g, "");

  // Split into parts and resolve . and ..
  const parts = normalized.split("/").filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== ".") {
      resolved.push(part);
    }
  }

  return resolved.join("/");
}

/**
 * Get the filename from a path
 */
export function getFileName(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || "";
}

/**
 * Get the file extension (without dot)
 */
export function getFileExtension(path: string): string {
  const filename = getFileName(path);
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0) {
    return "";
  }
  return filename.substring(lastDot + 1).toLowerCase();
}

/**
 * Get the parent directory path
 */
export function getParentPath(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  parts.pop();
  return parts.join("/");
}

/**
 * Join path segments
 */
export function joinPaths(...segments: string[]): string {
  return segments
    .map((s) => s.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

/**
 * Check if a path is inside another path
 */
export function isPathInside(childPath: string, parentPath: string): boolean {
  const normalizedChild = normalizePath(childPath);
  const normalizedParent = normalizePath(parentPath);

  if (normalizedParent === "") {
    return true;
  }

  return (
    normalizedChild === normalizedParent ||
    normalizedChild.startsWith(normalizedParent + "/")
  );
}

/**
 * Get relative path from one path to another
 */
export function getRelativePath(from: string, to: string): string {
  const fromParts = normalizePath(from).split("/").filter(Boolean);
  const toParts = normalizePath(to).split("/").filter(Boolean);

  // Find common prefix length
  let commonLength = 0;
  while (
    commonLength < fromParts.length &&
    commonLength < toParts.length &&
    fromParts[commonLength] === toParts[commonLength]
  ) {
    commonLength++;
  }

  // Build relative path
  const upCount = fromParts.length - commonLength;
  const relativeParts = [
    ...Array(upCount).fill(".."),
    ...toParts.slice(commonLength),
  ];

  return relativeParts.join("/") || ".";
}
