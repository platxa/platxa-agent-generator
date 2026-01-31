#!/usr/bin/env node
"use strict";Object.defineProperty(exports,Symbol.toStringTag,{value:"Module"});const P=require("node:fs"),C=require("node:path"),S=require("node:readline");var m=typeof document<"u"?document.currentScript:null;function y(e){const r=Object.create(null,{[Symbol.toStringTag]:{value:"Module"}});if(e){for(const t in e)if(t!=="default"){const n=Object.getOwnPropertyDescriptor(e,t);Object.defineProperty(r,t,n.get?n:{enumerable:!0,get:()=>e[t]})}}return r.default=e,Object.freeze(r)}const p=y(P),i=y(C),w=y(S),x=["default","blue","green","violet"],N=`import { defineFrontendConfig } from "@platxa/frontend-agent"

export default defineFrontendConfig({
  // Theme configuration
  theme: {
    preset: "{{PRESET}}",
  },
{{BRAND_CONFIG}}
})
`,B=`/** @type {import('@platxa/frontend-agent').FrontendConfig} */
module.exports = {
  // Theme configuration
  theme: {
    preset: "{{PRESET}}",
  },
{{BRAND_CONFIG}}
}
`,E=`
  // Brand kit (opt-in)
  brand: {
    package: "{{BRAND_PACKAGE}}",
  },
`;function h(){return w.createInterface({input:process.stdin,output:process.stdout})}function d(e,r){return new Promise(t=>{e.question(r,n=>{t(n.trim())})})}async function f(e,r,t=!0){const a=await d(e,`${r} ${t?"[Y/n]":"[y/N]"} `);return a===""?t:a.toLowerCase().startsWith("y")}async function j(e,r,t,n=0){console.log(r),t.forEach((o,c)=>{console.log(`  ${c===n?">":" "} ${c+1}. ${o}`)});const a=await d(e,`Choice [${n+1}]: `);if(a==="")return t[n];const s=parseInt(a,10)-1;return s>=0&&s<t.length?t[s]:t[n]}function _(e){let t=(e.typescript?N:B).replace("{{PRESET}}",e.preset);if(e.useBrandKit&&e.brandPackage){const n=E.replace("{{BRAND_PACKAGE}}",e.brandPackage);t=t.replace("{{BRAND_CONFIG}}",n)}else t=t.replace("{{BRAND_CONFIG}}","");return t}function T(e,r){const t=r?".ts":".js";return i.join(e,`frontend.config${t}`)}function $(e){return p.existsSync(i.join(e,"pnpm-lock.yaml"))?"pnpm":p.existsSync(i.join(e,"yarn.lock"))?"yarn":"npm"}function v(e,r){const t=r.join(" ");switch(e){case"pnpm":return`pnpm add ${t}`;case"yarn":return`yarn add ${t}`;default:return`npm install ${t}`}}async function A(){const e=h();console.log(`
🎨 Platxa Frontend Agent - Brand Configuration
`),console.log(`This will create a frontend.config file in your project.
`);try{const r=i.basename(process.cwd()),t=await d(e,`Project name [${r}]: `)||r,n=p.existsSync(i.join(process.cwd(),"tsconfig.json")),a=await f(e,"Use TypeScript config?",n),s=await j(e,`
Select a theme preset:`,x,0),o=await f(e,`
Use a custom brand kit package?`,!1);let c;o&&(c=await d(e,"Brand kit package name: "),c||console.log("No package specified, skipping brand kit."));const l=await f(e,`
Install dependencies automatically?`,!0);return e.close(),{projectName:t,useBrandKit:o&&!!c,brandPackage:c,preset:s,typescript:a,installDeps:l}}catch(r){throw e.close(),r}}async function b(e){const r=process.cwd(),t=[];try{const n=e!=null&&e.projectName?{projectName:e.projectName,useBrandKit:e.useBrandKit??!1,brandPackage:e.brandPackage,preset:e.preset??"default",typescript:e.typescript??!0,installDeps:e.installDeps??!1}:await A(),a=_(n),s=T(r,n.typescript);if(p.existsSync(s)){console.log(`
⚠️  Config file already exists: ${i.basename(s)}`);const u=h(),g=await f(u,"Overwrite?",!1);if(u.close(),!g)return{success:!1,error:"Config file already exists",nextSteps:[]}}p.writeFileSync(s,a,"utf-8"),console.log(`
✅ Created ${i.basename(s)}`);const o=["@platxa/frontend-agent"];n.useBrandKit&&n.brandPackage&&o.push(n.brandPackage);const c=$(r),l=v(c,o);return n.installDeps?(console.log(`
📦 Installing dependencies...`),console.log(`   $ ${l}`),t.push(`Run: ${l}`)):t.push(`Install dependencies: ${l}`),t.push("Import and use in your app:"),t.push('  import { BrandProvider } from "@platxa/frontend-agent"'),t.push("  <BrandProvider>...</BrandProvider>"),console.log(`
🎉 Brand configuration initialized!
`),console.log("Next steps:"),t.forEach((u,g)=>{console.log(`  ${g+1}. ${u}`)}),console.log(""),{success:!0,configPath:s,nextSteps:t}}catch(n){const a=n instanceof Error?n.message:String(n);return console.error(`
❌ Error: ${a}
`),{success:!1,error:a,nextSteps:[]}}}async function k(){const e=process.argv.slice(2);(e.includes("--help")||e.includes("-h"))&&(console.log(`
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
`),process.exit(0));const r={};for(let n=0;n<e.length;n++){const a=e[n];a==="--preset"&&e[n+1]?r.preset=e[++n]:a==="--brand"&&e[n+1]?(r.useBrandKit=!0,r.brandPackage=e[++n]):a==="--typescript"?r.typescript=!0:a==="--javascript"?r.typescript=!1:a==="--no-install"&&(r.installDeps=!1)}const t=await b(Object.keys(r).length>0?r:void 0);process.exit(t.success?0:1)}const O=typeof require<"u"?require.main===module:(typeof document>"u"?require("url").pathToFileURL(__filename).href:m&&m.tagName.toUpperCase()==="SCRIPT"&&m.src||new URL("cli/init.cjs",document.baseURI).href)===`file://${process.argv[1]}`;O&&k().catch(e=>{console.error("Error:",e instanceof Error?e.message:e),process.exit(1)});exports.initBrandConfig=b;exports.main=k;
