/**
 * Brand Token Injector
 *
 * Injects brand token context into an existing system prompt.
 * Keeps the injection under 500 tokens to fit within Ollama's 4096 context window.
 */

import type { BrandTokenContext } from "./types";

/**
 * Injects brand tokens into a system prompt.
 * Appends a compact brand section that enforces color consistency.
 *
 * @param systemPrompt - The base system prompt (from buildSystemPrompt)
 * @param tokens - Brand token context from pre-generation
 * @param promptFragment - Enhanced prompt fragment from design analysis
 * @returns Enhanced system prompt with brand tokens appended
 */
export function injectBrandTokens(
  systemPrompt: string,
  tokens: BrandTokenContext,
  promptFragment?: string,
): string {
  // If we have a pre-built fragment from pre-generation, use it directly
  if (promptFragment) {
    return `${systemPrompt}\n\n${promptFragment}`;
  }

  // Otherwise build a minimal injection
  const { colors } = tokens;
  const injection = [
    "\n## Brand Tokens",
    `Primary: ${colors.primary}`,
    `Secondary: ${colors.secondary}`,
    `Accent: ${colors.accent}`,
    `Background: ${colors.background}`,
    `Text: ${colors.text}`,
    `Semantic: error=${colors.error} warning=${colors.warning} success=${colors.success} info=${colors.info}`,
    "",
    "IMPORTANT: Use ONLY the colors listed above. Do not introduce new colors.",
  ].join("\n");

  return `${systemPrompt}\n${injection}`;
}
