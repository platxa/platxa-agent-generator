#!/usr/bin/env node
import * as p from "node:fs";
import * as i from "node:path";
import * as y from "node:readline";
const h = ["default", "blue", "green", "violet"], k = `import { defineFrontendConfig } from "@platxa/frontend-agent"

export default defineFrontendConfig({
  // Theme configuration
  theme: {
    preset: "{{PRESET}}",
  },
{{BRAND_CONFIG}}
})
`, P = `/** @type {import('@platxa/frontend-agent').FrontendConfig} */
module.exports = {
  // Theme configuration
  theme: {
    preset: "{{PRESET}}",
  },
{{BRAND_CONFIG}}
}
`, b = `
  // Brand kit (opt-in)
  brand: {
    package: "{{BRAND_PACKAGE}}",
  },
`;
function m() {
  return y.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}
function u(e, a) {
  return new Promise((n) => {
    e.question(a, (t) => {
      n(t.trim());
    });
  });
}
async function d(e, a, n = !0) {
  const r = await u(e, `${a} ${n ? "[Y/n]" : "[y/N]"} `);
  return r === "" ? n : r.toLowerCase().startsWith("y");
}
async function w(e, a, n, t = 0) {
  console.log(a), n.forEach((c, o) => {
    console.log(`  ${o === t ? ">" : " "} ${o + 1}. ${c}`);
  });
  const r = await u(e, `Choice [${t + 1}]: `);
  if (r === "") return n[t];
  const s = parseInt(r, 10) - 1;
  return s >= 0 && s < n.length ? n[s] : n[t];
}
function x(e) {
  let n = (e.typescript ? k : P).replace("{{PRESET}}", e.preset);
  if (e.useBrandKit && e.brandPackage) {
    const t = b.replace("{{BRAND_PACKAGE}}", e.brandPackage);
    n = n.replace("{{BRAND_CONFIG}}", t);
  } else
    n = n.replace("{{BRAND_CONFIG}}", "");
  return n;
}
function C(e, a) {
  const n = a ? ".ts" : ".js";
  return i.join(e, `frontend.config${n}`);
}
function E(e) {
  return p.existsSync(i.join(e, "pnpm-lock.yaml")) ? "pnpm" : p.existsSync(i.join(e, "yarn.lock")) ? "yarn" : "npm";
}
function N(e, a) {
  const n = a.join(" ");
  switch (e) {
    case "pnpm":
      return `pnpm add ${n}`;
    case "yarn":
      return `yarn add ${n}`;
    default:
      return `npm install ${n}`;
  }
}
async function B() {
  const e = m();
  console.log(`
🎨 Platxa Frontend Agent - Brand Configuration
`), console.log(`This will create a frontend.config file in your project.
`);
  try {
    const a = i.basename(process.cwd()), n = await u(e, `Project name [${a}]: `) || a, t = p.existsSync(i.join(process.cwd(), "tsconfig.json")), r = await d(e, "Use TypeScript config?", t), s = await w(e, `
Select a theme preset:`, h, 0), c = await d(e, `
Use a custom brand kit package?`, !1);
    let o;
    c && (o = await u(e, "Brand kit package name: "), o || console.log("No package specified, skipping brand kit."));
    const l = await d(e, `
Install dependencies automatically?`, !0);
    return e.close(), {
      projectName: n,
      useBrandKit: c && !!o,
      brandPackage: o,
      preset: s,
      typescript: r,
      installDeps: l
    };
  } catch (a) {
    throw e.close(), a;
  }
}
async function S(e) {
  const a = process.cwd(), n = [];
  try {
    const t = e != null && e.projectName ? {
      projectName: e.projectName,
      useBrandKit: e.useBrandKit ?? !1,
      brandPackage: e.brandPackage,
      preset: e.preset ?? "default",
      typescript: e.typescript ?? !0,
      installDeps: e.installDeps ?? !1
    } : await B(), r = x(t), s = C(a, t.typescript);
    if (p.existsSync(s)) {
      console.log(`
⚠️  Config file already exists: ${i.basename(s)}`);
      const f = m(), g = await d(f, "Overwrite?", !1);
      if (f.close(), !g)
        return {
          success: !1,
          error: "Config file already exists",
          nextSteps: []
        };
    }
    p.writeFileSync(s, r, "utf-8"), console.log(`
✅ Created ${i.basename(s)}`);
    const c = ["@platxa/frontend-agent"];
    t.useBrandKit && t.brandPackage && c.push(t.brandPackage);
    const o = E(a), l = N(o, c);
    return t.installDeps ? (console.log(`
📦 Installing dependencies...`), console.log(`   $ ${l}`), n.push(`Run: ${l}`)) : n.push(`Install dependencies: ${l}`), n.push("Import and use in your app:"), n.push('  import { BrandProvider } from "@platxa/frontend-agent"'), n.push("  <BrandProvider>...</BrandProvider>"), console.log(`
🎉 Brand configuration initialized!
`), console.log("Next steps:"), n.forEach((f, g) => {
      console.log(`  ${g + 1}. ${f}`);
    }), console.log(""), {
      success: !0,
      configPath: s,
      nextSteps: n
    };
  } catch (t) {
    const r = t instanceof Error ? t.message : String(t);
    return console.error(`
❌ Error: ${r}
`), {
      success: !1,
      error: r,
      nextSteps: []
    };
  }
}
async function $() {
  const e = process.argv.slice(2);
  (e.includes("--help") || e.includes("-h")) && (console.log(`
Usage: platxa-init [options]

Initialize Platxa Frontend Agent brand configuration.

Options:
  --preset <name>    Use preset (default, blue, green, violet)
  --brand <package>  Use brand kit package
  --typescript       Generate TypeScript config (default: auto-detect)
  --javascript       Generate JavaScript config
  --no-install       Skip dependency installation
  -h, --help         Show this help message

Examples:
  platxa-init
  platxa-init --preset blue
  platxa-init --brand @acme/brand-kit
`), process.exit(0));
  const a = {};
  for (let t = 0; t < e.length; t++) {
    const r = e[t];
    r === "--preset" && e[t + 1] ? a.preset = e[++t] : r === "--brand" && e[t + 1] ? (a.useBrandKit = !0, a.brandPackage = e[++t]) : r === "--typescript" ? a.typescript = !0 : r === "--javascript" ? a.typescript = !1 : r === "--no-install" && (a.installDeps = !1);
  }
  const n = await S(Object.keys(a).length > 0 ? a : void 0);
  process.exit(n.success ? 0 : 1);
}
const T = typeof require < "u" ? require.main === module : import.meta.url === `file://${process.argv[1]}`;
T && $().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e), process.exit(1);
});
export {
  S as initBrandConfig,
  $ as main
};
