#!/usr/bin/env node
import * as g from "node:fs";
import * as m from "node:path";
function p(e, a, s) {
  if (!e || typeof e != "object") return;
  const t = e, r = ["background", "foreground", "primary", "primaryForeground", "secondary", "secondaryForeground", "muted", "mutedForeground", "accent", "accentForeground", "destructive", "destructiveForeground", "border", "input", "ring"];
  for (const n of r)
    t[n] === void 0 && s.push(`semantics.${a}.${n} is recommended`);
}
function k(e) {
  const a = [], s = [], t = [], r = [];
  if (!e || typeof e != "object")
    return a.push("Brand kit must be an object"), {
      valid: !1,
      errors: a,
      warnings: s,
      missingRequired: t,
      missingOptional: r
    };
  const n = e;
  if (!n.meta || typeof n.meta != "object")
    a.push("Brand kit must export 'meta' object"), t.push("meta");
  else {
    const o = n.meta;
    (typeof o.name != "string" || !o.name) && (a.push("meta.name is required and must be a non-empty string"), t.push("meta.name")), typeof o.version != "string" || !o.version ? (a.push("meta.version is required and must be a non-empty string"), t.push("meta.version")) : /^\d+\.\d+\.\d+/.test(o.version) || s.push("meta.version should follow semver format (e.g., '1.0.0')"), o.description === void 0 && r.push("meta.description"), o.author === void 0 && r.push("meta.author");
  }
  if (!n.primitives || typeof n.primitives != "object")
    a.push("Brand kit must export 'primitives' object with color scales"), t.push("primitives");
  else {
    const o = n.primitives;
    for (const i of ["primary", "accent", "neutral"])
      if (!o[i] || typeof o[i] != "object")
        a.push(`primitives.${i} is required (12-step color scale)`), t.push(`primitives.${i}`);
      else {
        const c = o[i], d = Object.keys(c).map(Number).filter((u) => !isNaN(u));
        d.length < 12 && s.push(`primitives.${i} has ${d.length} steps (recommended: 12)`);
      }
  }
  if (!n.semantics || typeof n.semantics != "object")
    a.push("Brand kit must export 'semantics' object with light/dark colors"), t.push("semantics");
  else {
    const o = n.semantics;
    !o.light || typeof o.light != "object" ? (a.push("semantics.light is required"), t.push("semantics.light")) : p(o.light, "light", s), !o.dark || typeof o.dark != "object" ? (a.push("semantics.dark is required"), t.push("semantics.dark")) : p(o.dark, "dark", s);
  }
  return n.typography === void 0 && r.push("typography"), n.spacing === void 0 && r.push("spacing"), n.radius === void 0 && r.push("radius"), n.shadow === void 0 && r.push("shadow"), n.tailwindPreset === void 0 && r.push("tailwindPreset"), n.css === void 0 && r.push("css"), {
    valid: a.length === 0,
    errors: a,
    warnings: s,
    missingRequired: t,
    missingOptional: r
  };
}
function h(e) {
  const a = e.match(/^#([0-9a-f]{6})$/i);
  if (a) {
    const n = a[1];
    return {
      r: parseInt(n.slice(0, 2), 16),
      g: parseInt(n.slice(2, 4), 16),
      b: parseInt(n.slice(4, 6), 16)
    };
  }
  const s = e.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (s)
    return {
      r: parseInt(s[1], 10),
      g: parseInt(s[2], 10),
      b: parseInt(s[3], 10)
    };
  const t = e.match(/^hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%/);
  if (t) {
    const n = parseInt(t[1], 10) / 360, o = parseFloat(t[2]) / 100, i = parseFloat(t[3]) / 100;
    return b(n, o, i);
  }
  const r = e.match(/^oklch\(([\d.]+)(?:%?)\s+([\d.]+)\s+([\d.]+)/);
  if (r) {
    const n = parseFloat(r[1]), o = n > 1 ? n / 100 : n, i = Math.round(o * 255);
    return {
      r: i,
      g: i,
      b: i
    };
  }
  return null;
}
function b(e, a, s) {
  let t, r, n;
  if (a === 0)
    t = r = n = s;
  else {
    const o = (d, u, l) => (l < 0 && (l += 1), l > 1 && (l -= 1), l < 0.16666666666666666 ? d + (u - d) * 6 * l : l < 0.5 ? u : l < 0.6666666666666666 ? d + (u - d) * (0.6666666666666666 - l) * 6 : d), i = s < 0.5 ? s * (1 + a) : s + a - s * a, c = 2 * s - i;
    t = o(c, i, e + 1 / 3), r = o(c, i, e), n = o(c, i, e - 1 / 3);
  }
  return {
    r: Math.round(t * 255),
    g: Math.round(r * 255),
    b: Math.round(n * 255)
  };
}
function A(e) {
  const [a, s, t] = [e.r, e.g, e.b].map((r) => {
    const n = r / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a + 0.7152 * s + 0.0722 * t;
}
function M(e, a) {
  const s = h(e), t = h(a);
  if (!s || !t) return null;
  const r = A(s), n = A(t), o = Math.max(r, n), i = Math.min(r, n);
  return (o + 0.05) / (i + 0.05);
}
const f = {
  AA_NORMAL: 4.5,
  AAA_NORMAL: 7
};
function v(e) {
  const a = [{
    name: "foreground/background",
    fg: "foreground",
    bg: "background"
  }, {
    name: "primary/primaryForeground",
    fg: "primaryForeground",
    bg: "primary"
  }, {
    name: "secondary/secondaryForeground",
    fg: "secondaryForeground",
    bg: "secondary"
  }, {
    name: "muted/mutedForeground",
    fg: "mutedForeground",
    bg: "muted"
  }, {
    name: "accent/accentForeground",
    fg: "accentForeground",
    bg: "accent"
  }, {
    name: "destructive/destructiveForeground",
    fg: "destructiveForeground",
    bg: "destructive"
  }], s = [];
  for (const {
    name: t,
    fg: r,
    bg: n
  } of a) {
    const o = e[r], i = e[n];
    if (!o || !i) continue;
    const c = M(o, i);
    if (c === null) {
      s.push({
        pair: t,
        ratio: 0,
        passesAA: !1,
        passesAAA: !1,
        recommendation: `Could not parse colors: ${r}=${o}, ${n}=${i}`
      });
      continue;
    }
    const d = c >= f.AA_NORMAL, u = c >= f.AAA_NORMAL, l = {
      pair: t,
      ratio: Math.round(c * 100) / 100,
      passesAA: d,
      passesAAA: u
    };
    d ? u || (l.recommendation = `Consider increasing to ${f.AAA_NORMAL}:1 for WCAG AAA`) : l.recommendation = `Increase contrast to at least ${f.AA_NORMAL}:1 for WCAG AA`, s.push(l);
  }
  return s;
}
async function $(e) {
  if (e.startsWith("./") || e.startsWith("/") || e.startsWith("../")) {
    const s = m.resolve(process.cwd(), e), t = m.join(s, "package.json");
    if (g.existsSync(t)) {
      const n = JSON.parse(g.readFileSync(t, "utf-8")).main || "index.js", o = m.join(s, n);
      if (g.existsSync(o))
        try {
          const i = await import(o);
          return i.default || i;
        } catch {
          const i = g.readFileSync(o, "utf-8");
          return JSON.parse(i);
        }
    }
    for (const r of ["index.js", "index.mjs", "brand-kit.json", "brand.json"]) {
      const n = m.join(s, r);
      if (g.existsSync(n))
        if (r.endsWith(".json")) {
          const o = g.readFileSync(n, "utf-8");
          return JSON.parse(o);
        } else {
          const o = await import(n);
          return o.default || o;
        }
    }
    if (g.existsSync(s))
      if (s.endsWith(".json")) {
        const r = g.readFileSync(s, "utf-8");
        return JSON.parse(r);
      } else {
        const r = await import(s);
        return r.default || r;
      }
    return null;
  }
  try {
    const s = await import(e);
    return s.default || s;
  } catch {
    return null;
  }
}
function j(e, a, s) {
  var r, n;
  const t = {
    source: e,
    valid: s.valid,
    schema: s,
    contrast: {
      lightMode: [],
      darkMode: [],
      passesAA: !0,
      passesAAA: !0
    },
    summary: {
      errorCount: s.errors.length,
      warningCount: s.warnings.length,
      contrastIssues: 0
    }
  };
  if ((r = a == null ? void 0 : a.semantics) != null && r.light) {
    t.contrast.lightMode = v(a.semantics.light);
    const o = t.contrast.lightMode.filter((c) => !c.passesAA);
    t.summary.contrastIssues += o.length, o.length > 0 && (t.contrast.passesAA = !1), t.contrast.lightMode.filter((c) => !c.passesAAA).length > 0 && (t.contrast.passesAAA = !1);
  }
  if ((n = a == null ? void 0 : a.semantics) != null && n.dark) {
    t.contrast.darkMode = v(a.semantics.dark);
    const o = t.contrast.darkMode.filter((c) => !c.passesAA);
    t.summary.contrastIssues += o.length, o.length > 0 && (t.contrast.passesAA = !1), t.contrast.darkMode.filter((c) => !c.passesAAA).length > 0 && (t.contrast.passesAAA = !1);
  }
  return t.valid = s.valid && t.contrast.passesAA, t;
}
function y(e, a) {
  if (console.log(`
` + "=".repeat(60)), console.log("Brand Kit Validation Report"), console.log("=".repeat(60)), console.log(`
Source: ${e.source}`), console.log(`Status: ${e.valid ? "✅ VALID" : "❌ INVALID"}`), console.log(`
--- Schema Validation ---`), e.schema.errors.length > 0 && (console.log(`
❌ Errors:`), e.schema.errors.forEach((s) => console.log(`   • ${s}`))), e.schema.warnings.length > 0 && (console.log(`
⚠️  Warnings:`), e.schema.warnings.forEach((s) => console.log(`   • ${s}`))), e.schema.missingRequired.length > 0 && (console.log(`
🔴 Missing Required Fields:`), e.schema.missingRequired.forEach((s) => console.log(`   • ${s}`))), a && e.schema.missingOptional.length > 0 && (console.log(`
🔵 Missing Optional Fields:`), e.schema.missingOptional.forEach((s) => console.log(`   • ${s}`))), console.log(`
--- Color Contrast (WCAG 2.1) ---`), console.log(`AA Compliance: ${e.contrast.passesAA ? "✅ Pass" : "❌ Fail"}`), console.log(`AAA Compliance: ${e.contrast.passesAAA ? "✅ Pass" : "⚠️  Fail"}`), e.contrast.lightMode.length > 0) {
    console.log(`
  Light Mode:`);
    for (const s of e.contrast.lightMode) {
      const t = s.passesAA ? "✅" : "❌";
      console.log(`    ${t} ${s.pair}: ${s.ratio}:1`), s.recommendation && (a || !s.passesAA) && console.log(`       → ${s.recommendation}`);
    }
  }
  if (e.contrast.darkMode.length > 0) {
    console.log(`
  Dark Mode:`);
    for (const s of e.contrast.darkMode) {
      const t = s.passesAA ? "✅" : "❌";
      console.log(`    ${t} ${s.pair}: ${s.ratio}:1`), s.recommendation && (a || !s.passesAA) && console.log(`       → ${s.recommendation}`);
    }
  }
  console.log(`
--- Summary ---`), console.log(`Errors: ${e.summary.errorCount}`), console.log(`Warnings: ${e.summary.warningCount}`), console.log(`Contrast Issues: ${e.summary.contrastIssues}`), console.log(`
` + "=".repeat(60) + `
`);
}
async function S(e, a = {}) {
  const {
    verbose: s = !1,
    json: t = !1
  } = a, r = await $(e);
  if (!r) {
    const i = {
      source: e,
      valid: !1,
      schema: {
        valid: !1,
        errors: [`Could not load brand kit from: ${e}`],
        warnings: [],
        missingRequired: [],
        missingOptional: []
      },
      contrast: {
        lightMode: [],
        darkMode: [],
        passesAA: !1,
        passesAAA: !1
      },
      summary: {
        errorCount: 1,
        warningCount: 0,
        contrastIssues: 0
      }
    };
    return t ? console.log(JSON.stringify(i, null, 2)) : y(i, s), i;
  }
  const n = k(r), o = j(e, r, n);
  return t ? console.log(JSON.stringify(o, null, 2)) : y(o, s), o;
}
async function F() {
  const e = process.argv.slice(2);
  (e.includes("--help") || e.includes("-h") || e.length === 0) && (console.log(`
Usage: platxa-validate <source> [options]

Validate a brand kit against the Platxa schema.

Arguments:
  source               Package name or path to brand kit

Options:
  --verbose, -v        Show all details including optional fields
  --json               Output as JSON
  -h, --help           Show this help message

Examples:
  platxa-validate @acme/brand-kit
  platxa-validate ./my-brand-kit
  platxa-validate ./brand-kit.json --json
  platxa-validate @acme/brand-kit --verbose
`), process.exit(e.length === 0 ? 1 : 0));
  const a = e.includes("--verbose") || e.includes("-v"), s = e.includes("--json"), t = e.find((n) => !n.startsWith("-"));
  t || (console.error("Error: No source specified"), process.exit(1));
  const r = await S(t, {
    verbose: a,
    json: s
  });
  process.exit(r.valid ? 0 : 1);
}
const w = typeof require < "u" ? require.main === module : import.meta.url === `file://${process.argv[1]}`;
w && F().catch((e) => {
  console.error("Error:", e.message), process.exit(1);
});
export {
  F as main,
  S as validateBrandKit
};
