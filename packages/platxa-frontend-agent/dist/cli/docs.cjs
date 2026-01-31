#!/usr/bin/env node
"use strict";Object.defineProperty(exports,Symbol.toStringTag,{value:"Module"});const y=require("node:fs"),$=require("node:path");var u=typeof document<"u"?document.currentScript:null;function l(s){const t=Object.create(null,{[Symbol.toStringTag]:{value:"Module"}});if(s){for(const e in s)if(e!=="default"){const r=Object.getOwnPropertyDescriptor(s,e);Object.defineProperty(t,e,r.get?r:{enumerable:!0,get:()=>s[e]})}}return t.default=s,Object.freeze(t)}const i=l(y),h=l($),x={meta:{name:"@platxa/frontend-agent",version:"1.0.0",description:"Built-in design tokens"},primitives:{primary:{50:"oklch(0.97 0.02 222)",100:"oklch(0.93 0.04 222)",200:"oklch(0.86 0.08 222)",300:"oklch(0.76 0.12 222)",400:"oklch(0.66 0.16 222)",500:"oklch(0.55 0.18 222)",600:"oklch(0.47 0.17 222)",700:"oklch(0.40 0.15 222)",800:"oklch(0.33 0.12 222)",900:"oklch(0.27 0.09 222)",950:"oklch(0.20 0.06 222)"},accent:{50:"oklch(0.97 0.02 262)",100:"oklch(0.93 0.04 262)",200:"oklch(0.86 0.08 262)",300:"oklch(0.76 0.12 262)",400:"oklch(0.66 0.16 262)",500:"oklch(0.55 0.18 262)",600:"oklch(0.47 0.17 262)",700:"oklch(0.40 0.15 262)",800:"oklch(0.33 0.12 262)",900:"oklch(0.27 0.09 262)",950:"oklch(0.20 0.06 262)"},neutral:{50:"oklch(0.98 0.005 222)",100:"oklch(0.95 0.005 222)",200:"oklch(0.90 0.005 222)",300:"oklch(0.82 0.005 222)",400:"oklch(0.70 0.01 222)",500:"oklch(0.55 0.01 222)",600:"oklch(0.45 0.01 222)",700:"oklch(0.37 0.01 222)",800:"oklch(0.27 0.01 222)",900:"oklch(0.20 0.01 222)",950:"oklch(0.14 0.01 222)"}},semantics:{light:{background:"oklch(0.99 0.002 222)",foreground:"oklch(0.15 0.01 222)",primary:"oklch(0.47 0.17 222)",primaryForeground:"oklch(0.99 0 0)",secondary:"oklch(0.95 0.005 222)",secondaryForeground:"oklch(0.20 0.01 222)",muted:"oklch(0.95 0.005 222)",mutedForeground:"oklch(0.55 0.01 222)",accent:"oklch(0.93 0.04 262)",accentForeground:"oklch(0.27 0.09 262)",destructive:"oklch(0.55 0.22 25)",destructiveForeground:"oklch(0.99 0 0)",border:"oklch(0.90 0.005 222)",input:"oklch(0.90 0.005 222)",ring:"oklch(0.55 0.18 222)"},dark:{background:"oklch(0.14 0.01 222)",foreground:"oklch(0.95 0.005 222)",primary:"oklch(0.55 0.18 222)",primaryForeground:"oklch(0.12 0.01 222)",secondary:"oklch(0.27 0.01 222)",secondaryForeground:"oklch(0.95 0.005 222)",muted:"oklch(0.27 0.01 222)",mutedForeground:"oklch(0.70 0.01 222)",accent:"oklch(0.33 0.12 262)",accentForeground:"oklch(0.93 0.04 262)",destructive:"oklch(0.60 0.20 25)",destructiveForeground:"oklch(0.99 0 0)",border:"oklch(0.27 0.01 222)",input:"oklch(0.27 0.01 222)",ring:"oklch(0.66 0.16 222)"}},typography:{fontFamily:{sans:["Inter","system-ui","sans-serif"],mono:["JetBrains Mono","Consolas","monospace"]},fontSize:{xs:"0.75rem",sm:"0.875rem",base:"1rem",lg:"1.125rem",xl:"1.25rem","2xl":"1.5rem","3xl":"1.875rem","4xl":"2.25rem"},fontWeight:{normal:"400",medium:"500",semibold:"600",bold:"700"},lineHeight:{tight:"1.25",normal:"1.5",relaxed:"1.75"}},spacing:{px:"1px",0:"0",.5:"0.125rem",1:"0.25rem",2:"0.5rem",3:"0.75rem",4:"1rem",5:"1.25rem",6:"1.5rem",8:"2rem",10:"2.5rem",12:"3rem",16:"4rem",20:"5rem",24:"6rem"},radius:{none:"0",sm:"0.125rem",default:"0.25rem",md:"0.375rem",lg:"0.5rem",xl:"0.75rem","2xl":"1rem",full:"9999px"},shadow:{sm:"0 1px 2px 0 rgb(0 0 0 / 0.05)",default:"0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",md:"0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",lg:"0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",xl:"0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",none:"none"}};function d(s,t){const e=[];e.push(`# ${s.meta.name} - Token Reference`),e.push(""),e.push(`> ${s.meta.description||"Design token documentation"}`),e.push(""),e.push(`**Version:** ${s.meta.version}`),e.push(""),e.push("---"),e.push(""),e.push("## Table of Contents"),e.push(""),e.push("- [Color Primitives](#color-primitives)"),e.push("  - [Primary](#primary)"),e.push("  - [Accent](#accent)"),e.push("  - [Neutral](#neutral)"),e.push("- [Semantic Colors](#semantic-colors)"),e.push("  - [Light Mode](#light-mode)"),e.push("  - [Dark Mode](#dark-mode)"),s.typography&&e.push("- [Typography](#typography)"),s.spacing&&e.push("- [Spacing](#spacing)"),s.radius&&e.push("- [Border Radius](#border-radius)"),s.shadow&&e.push("- [Shadows](#shadows)"),e.push("- [Usage Examples](#usage-examples)"),e.push(""),e.push("---"),e.push(""),e.push("## Color Primitives"),e.push("");for(const[r,a]of Object.entries(s.primitives)){e.push(`### ${r.charAt(0).toUpperCase()+r.slice(1)}`),e.push(""),e.push("| Step | Value | CSS Variable |"),e.push("|------|-------|--------------|");for(const[c,b]of Object.entries(a))e.push(`| \`${c}\` | \`${b}\` | \`var(--color-${r}-${c})\` |`);e.push("");const o=Object.entries(a),p=Math.floor(o.length/2),[n,f]=o[p]||["500",""];e.push("**Usage:**"),e.push(""),e.push("```tsx"),e.push("// Import"),e.push(`import { ${r} } from "${s.meta.name}"`),e.push(""),e.push("// Access"),e.push(`const color = ${r}[${n}] // "${f}"`),e.push("```"),e.push(""),e.push("```css"),e.push("/* CSS Variable */"),e.push(".element {"),e.push(`  background: var(--color-${r}-500);`),e.push("}"),e.push("```"),e.push("")}e.push("## Semantic Colors"),e.push(""),e.push("### Light Mode"),e.push(""),e.push("| Token | Value | CSS Variable |"),e.push("|-------|-------|--------------|");for(const[r,a]of Object.entries(s.semantics.light)){const o=r.replace(/([A-Z])/g,"-$1").toLowerCase();e.push(`| \`${r}\` | \`${a}\` | \`var(--${o})\` |`)}e.push(""),e.push("### Dark Mode"),e.push(""),e.push("| Token | Value | CSS Variable |"),e.push("|-------|-------|--------------|");for(const[r,a]of Object.entries(s.semantics.dark)){const o=r.replace(/([A-Z])/g,"-$1").toLowerCase();e.push(`| \`${r}\` | \`${a}\` | \`var(--${o})\` |`)}if(e.push(""),e.push("**Usage:**"),e.push(""),e.push("```tsx"),e.push(`import { semantics } from "${s.meta.name}"`),e.push(""),e.push("// Light mode"),e.push("const bg = semantics.light.background"),e.push("const fg = semantics.light.foreground"),e.push(""),e.push("// Dark mode"),e.push("const darkBg = semantics.dark.background"),e.push("```"),e.push(""),s.typography){if(e.push("## Typography"),e.push(""),s.typography.fontFamily){e.push("### Font Family"),e.push(""),e.push("| Name | Stack | CSS Variable |"),e.push("|------|-------|--------------|");for(const[r,a]of Object.entries(s.typography.fontFamily)){const o=Array.isArray(a)?a.join(", "):a;e.push(`| \`${r}\` | \`${o}\` | \`var(--font-${r})\` |`)}e.push("")}if(s.typography.fontSize){e.push("### Font Size"),e.push(""),e.push("| Name | Size | CSS Variable | Tailwind |"),e.push("|------|------|--------------|----------|");for(const[r,a]of Object.entries(s.typography.fontSize))e.push(`| \`${r}\` | \`${a}\` | \`var(--text-${r})\` | \`text-${r}\` |`);e.push("")}if(s.typography.fontWeight){e.push("### Font Weight"),e.push(""),e.push("| Name | Weight | CSS Variable | Tailwind |"),e.push("|------|--------|--------------|----------|");for(const[r,a]of Object.entries(s.typography.fontWeight))e.push(`| \`${r}\` | \`${a}\` | \`var(--font-${r})\` | \`font-${r}\` |`);e.push("")}e.push("**Usage:**"),e.push(""),e.push("```tsx"),e.push(`import { typography } from "${s.meta.name}"`),e.push(""),e.push('const fontFamily = typography.fontFamily.sans.join(", ")'),e.push('const fontSize = typography.fontSize.lg // "1.125rem"'),e.push("```"),e.push("")}if(s.spacing){e.push("## Spacing"),e.push(""),e.push("Based on an 4px/8px grid system."),e.push(""),e.push("| Token | Size | Pixels | CSS Variable | Tailwind |"),e.push("|-------|------|--------|--------------|----------|");for(const[r,a]of Object.entries(s.spacing)){const o=a==="0"?"0":a.includes("rem")?`${parseFloat(a)*16}px`:a;e.push(`| \`${r}\` | \`${a}\` | ${o} | \`var(--spacing-${r})\` | \`p-${r}\`, \`m-${r}\` |`)}e.push(""),e.push("**Usage:**"),e.push(""),e.push("```tsx"),e.push(`import { spacing } from "${s.meta.name}"`),e.push(""),e.push('const padding = spacing[4] // "1rem" (16px)'),e.push('const margin = spacing[8] // "2rem" (32px)'),e.push("```"),e.push(""),e.push("```css"),e.push(".element {"),e.push("  padding: var(--spacing-4);"),e.push("  margin: var(--spacing-8);"),e.push("}"),e.push("```"),e.push("")}if(s.radius){e.push("## Border Radius"),e.push(""),e.push("| Token | Size | CSS Variable | Tailwind |"),e.push("|-------|------|--------------|----------|");for(const[r,a]of Object.entries(s.radius)){const o=r==="default"?"rounded":`rounded-${r}`;e.push(`| \`${r}\` | \`${a}\` | \`var(--radius-${r})\` | \`${o}\` |`)}e.push(""),e.push("**Usage:**"),e.push(""),e.push("```tsx"),e.push(`import { radius } from "${s.meta.name}"`),e.push(""),e.push('const borderRadius = radius.lg // "0.5rem"'),e.push("```"),e.push(""),t&&(e.push("**Visual Examples:**"),e.push(""),e.push("```"),e.push("┌────────┐  ╭────────╮  ╭────────╮  ●"),e.push("│  none  │  │   sm   │  │   lg   │  full"),e.push("└────────┘  ╰────────╯  ╰────────╯"),e.push("```"),e.push(""))}if(s.shadow){e.push("## Shadows"),e.push(""),e.push("| Token | Value | CSS Variable | Tailwind |"),e.push("|-------|-------|--------------|----------|");for(const[r,a]of Object.entries(s.shadow)){const o=r==="default"?"shadow":`shadow-${r}`,p=a.length>50?a.slice(0,47)+"...":a;e.push(`| \`${r}\` | \`${p}\` | \`var(--shadow-${r})\` | \`${o}\` |`)}e.push(""),e.push("**Usage:**"),e.push(""),e.push("```tsx"),e.push(`import { shadow } from "${s.meta.name}"`),e.push(""),e.push("const boxShadow = shadow.md"),e.push("```"),e.push(""),e.push("```css"),e.push(".card {"),e.push("  box-shadow: var(--shadow-md);"),e.push("}"),e.push("```"),e.push("")}return e.push("## Usage Examples"),e.push(""),e.push("### With BrandProvider (React)"),e.push(""),e.push("```tsx"),e.push('import { BrandProvider } from "@platxa/frontend-agent"'),e.push(""),e.push("function App() {"),e.push("  return ("),e.push(`    <BrandProvider brandPackage="${s.meta.name}">`),e.push("      <YourApp />"),e.push("    </BrandProvider>"),e.push("  )"),e.push("}"),e.push("```"),e.push(""),e.push("### Direct Import"),e.push(""),e.push("```tsx"),e.push(`import brandKit from "${s.meta.name}"`),e.push(""),e.push("// Access all tokens"),e.push("console.log(brandKit.primitives.primary[500])"),e.push("console.log(brandKit.semantics.light.background)"),e.push("console.log(brandKit.typography?.fontSize.lg)"),e.push("```"),e.push(""),e.push("### With Tailwind CSS"),e.push(""),e.push("```javascript"),e.push("// tailwind.config.js"),e.push(`import brandKit from "${s.meta.name}"`),e.push(""),e.push("export default {"),e.push("  presets: [brandKit.tailwindPreset],"),e.push("}"),e.push("```"),e.push(""),e.push("### CSS Variables"),e.push(""),e.push("All tokens are available as CSS variables when using BrandProvider:"),e.push(""),e.push("```css"),e.push(".my-component {"),e.push("  /* Colors */"),e.push("  background: var(--background);"),e.push("  color: var(--foreground);"),e.push("  border-color: var(--border);"),e.push(""),e.push("  /* Primary scale */"),e.push("  --highlight: var(--color-primary-500);"),e.push(""),e.push("  /* Typography */"),e.push("  font-family: var(--font-sans);"),e.push("  font-size: var(--text-lg);"),e.push(""),e.push("  /* Spacing */"),e.push("  padding: var(--spacing-4);"),e.push("  margin: var(--spacing-8);"),e.push(""),e.push("  /* Radius & Shadow */"),e.push("  border-radius: var(--radius-lg);"),e.push("  box-shadow: var(--shadow-md);"),e.push("}"),e.push("```"),e.push(""),e.push("---"),e.push(""),e.push(`*Generated by @platxa/frontend-agent on ${new Date().toISOString().split("T")[0]}*`),e.push(""),e.join(`
`)}function v(s,t){const e=d(s,t);return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${s.meta.name} - Token Reference</title>
  <style>
    :root {
      --bg: #fafafa;
      --fg: #171717;
      --border: #e5e5e5;
      --code-bg: #f5f5f5;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #171717;
        --fg: #fafafa;
        --border: #404040;
        --code-bg: #262626;
      }
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      background: var(--bg);
      color: var(--fg);
    }
    h1, h2, h3 { margin-top: 2rem; }
    h1 { border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
    h2 { border-bottom: 1px solid var(--border); padding-bottom: 0.25rem; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 0.875rem;
    }
    th, td {
      padding: 0.5rem;
      text-align: left;
      border: 1px solid var(--border);
    }
    th { background: var(--code-bg); }
    code {
      background: var(--code-bg);
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      font-size: 0.875em;
    }
    pre {
      background: var(--code-bg);
      padding: 1rem;
      border-radius: 0.5rem;
      overflow-x: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      margin: 1rem 0;
      padding: 0.5rem 1rem;
      border-left: 4px solid var(--border);
      background: var(--code-bg);
    }
    a { color: #3b82f6; }
    hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
    ul { padding-left: 1.5rem; }
  </style>
</head>
<body>
${k(e)}
</body>
</html>`}function k(s){return s.replace(/^### (.*$)/gm,"<h3>$1</h3>").replace(/^## (.*$)/gm,"<h2>$1</h2>").replace(/^# (.*$)/gm,"<h1>$1</h1>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/```(\w+)?\n([\s\S]*?)```/g,"<pre><code>$2</code></pre>").replace(/`([^`]+)`/g,"<code>$1</code>").replace(/^> (.*$)/gm,"<blockquote>$1</blockquote>").replace(/^- (.*$)/gm,"<li>$1</li>").replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>').replace(/\|(.+)\|/g,t=>{const e=t.split("|").filter(Boolean).map(a=>a.trim());if(e.every(a=>/^-+$/.test(a)))return"";const r=t.includes("---")?"th":"td";return`<tr>${e.map(a=>`<${r}>${a}</${r}>`).join("")}</tr>`}).replace(/(<tr>.*<\/tr>\n?)+/g,"<table>$&</table>").replace(/(<li>.*<\/li>\n?)+/g,"<ul>$&</ul>").replace(/^---$/gm,"<hr>").replace(/^(?!<[hupltbo]|$)(.+)$/gm,"<p>$1</p>").replace(/<p><\/p>/g,"").replace(/\n{3,}/g,`

`)}function S(s){return JSON.stringify({$schema:"https://platxa.com/schemas/brand-kit.json",meta:s.meta,tokens:{colors:{primitives:s.primitives,semantics:s.semantics},typography:s.typography,spacing:s.spacing,radius:s.radius,shadow:s.shadow},cssVariables:w(s)},null,2)}function w(s){var e;const t={};for(const[r,a]of Object.entries(s.primitives))for(const[o,p]of Object.entries(a))t[`--color-${r}-${o}`]=p;for(const[r,a]of Object.entries(s.semantics.light)){const o=r.replace(/([A-Z])/g,"-$1").toLowerCase();t[`--${o}`]=a}if((e=s.typography)!=null&&e.fontSize)for(const[r,a]of Object.entries(s.typography.fontSize))t[`--text-${r}`]=a;if(s.spacing)for(const[r,a]of Object.entries(s.spacing))t[`--spacing-${r}`]=a;if(s.radius)for(const[r,a]of Object.entries(s.radius))t[`--radius-${r}`]=a;if(s.shadow)for(const[r,a]of Object.entries(s.shadow))t[`--shadow-${r}`]=a;return t}async function j(s){if(s==="builtin"||s==="default")return x;if(s.startsWith("./")||s.startsWith("/")||s.startsWith("../")){const e=h.resolve(process.cwd(),s),r=h.join(e,"package.json");if(i.existsSync(r)){const o=JSON.parse(i.readFileSync(r,"utf-8")).main||"index.js",p=h.join(e,o);if(i.existsSync(p)){const n=await import(p);return n.default||n}}for(const a of["index.js","index.mjs","dist/index.js"]){const o=h.join(e,a);if(i.existsSync(o)){const p=await import(o);return p.default||p}}throw new Error(`Could not find brand kit at: ${s}`)}try{const e=await import(s);return e.default||e}catch{throw new Error(`Could not load brand kit package: ${s}`)}}async function m(s){const t=await j(s.source);let e;switch(s.format){case"html":e=v(t,s.visual);break;case"json":e=S(t);break;default:e=d(t,s.visual)}if(s.output){const r=h.resolve(process.cwd(),s.output);i.writeFileSync(r,e,"utf-8"),console.log(`
✅ Documentation generated: ${r}
`)}else console.log(e);return e}async function g(){const s=process.argv.slice(2);(s.includes("--help")||s.includes("-h"))&&(console.log(`
Usage: platxa-docs [source] [options]

Generate token reference documentation from a brand kit.

Arguments:
  source                Package name, path, or 'builtin' (default: builtin)

Options:
  --output, -o <file>   Output file path (stdout if not specified)
  --format, -f <type>   Output format: markdown, html, json (default: markdown)
  --no-visual           Skip visual examples
  -h, --help            Show this help

Examples:
  platxa-docs
  platxa-docs --output docs/TOKENS.md
  platxa-docs @acme/brand-kit -o tokens.html -f html
  platxa-docs ./my-brand-kit --format json
`),process.exit(0));let t="builtin",e,r="markdown",a=!0;for(let o=0;o<s.length;o++){const p=s[o];if(p==="--output"||p==="-o")e=s[++o];else if(p==="--format"||p==="-f"){const n=s[++o];["markdown","html","json"].includes(n)&&(r=n)}else p==="--no-visual"?a=!1:p.startsWith("-")||(t=p)}try{await m({source:t,output:e,format:r,visual:a}),process.exit(0)}catch(o){const p=o instanceof Error?o.message:String(o);console.error(`
❌ Error: ${p}
`),process.exit(1)}}const C=typeof require<"u"?require.main===module:(typeof document>"u"?require("url").pathToFileURL(__filename).href:u&&u.tagName.toUpperCase()==="SCRIPT"&&u.src||new URL("cli/docs.cjs",document.baseURI).href)===`file://${process.argv[1]}`;C&&g().catch(console.error);exports.generateDocs=m;exports.main=g;
