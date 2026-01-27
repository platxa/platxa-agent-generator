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
 * When `tokens.designTokens` is available, serializes a richer (but still compact)
 * block including typography, spacing, and border-radius tokens.
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

  // When DTCG tokens are available, build an enriched (but compact) injection
  if (tokens.designTokens) {
    return `${systemPrompt}\n${buildDtcgInjection(tokens)}`;
  }

  // Otherwise build a minimal injection (legacy path)
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

/**
 * Builds an enriched brand token injection from a full DTCG token set.
 * Includes typography, spacing, and border-radius while staying under ~450 tokens.
 *
 * Format is compact: abbreviated keys, no redundant labels.
 */
function buildDtcgInjection(tokens: BrandTokenContext): string {
  const dt = tokens.designTokens!;
  const lines: string[] = ["\n## Brand Design Tokens"];

  // Colors — base palette + 500-step hex
  lines.push(`Primary: ${dt.color.primary["500"].$value.hex}`);
  lines.push(`Secondary: ${dt.color.secondary["500"].$value.hex}`);
  lines.push(`Accent: ${dt.color.accent["500"].$value.hex}`);
  lines.push(`Bg: ${dt.color.background.$value.hex} | Text: ${dt.color.text.$value.hex}`);
  lines.push(`Err: ${dt.color.error["500"].$value.hex} Warn: ${dt.color.warning["500"].$value.hex} Ok: ${dt.color.success["500"].$value.hex} Info: ${dt.color.info["500"].$value.hex}`);

  // OKLCH hint for the primary (so LLM can derive shades)
  const p = tokens.colors.primaryOklch;
  lines.push(`Primary OKLCH: L=${p.l} C=${p.c} H=${p.h}`);

  // Typography
  if (dt.typography?.fontFamily) {
    lines.push(`Headings: "${dt.typography.fontFamily.heading.$value}"`);
    lines.push(`Body: "${dt.typography.fontFamily.body.$value}"`);
  }
  if (dt.typography?.fontSize?.base) {
    const baseSize = dt.typography.fontSize.base.$value;
    if (typeof baseSize === "object" && "clamp" in baseSize) {
      lines.push(`Base font: ${baseSize.clamp}`);
    }
  }

  // Spacing (abbreviated — just the base unit)
  if (dt.spacing?.["4"]) {
    const base = (dt.spacing["4"] as { $value: string }).$value;
    lines.push(`Spacing base: ${base} (4px grid)`);
  }

  // Border radius
  if (dt.borderRadius?.md) {
    lines.push(`Radius: ${dt.borderRadius.md.$value}`);
  }

  // Enforcement
  lines.push("");
  lines.push("IMPORTANT: Use ONLY the colors, fonts, and spacing listed above. Do not introduce new colors.");

  return lines.join("\n");
}
