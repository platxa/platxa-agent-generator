import * as P from "react";
import at, { forwardRef as Nt, createElement as Qe, createContext as Kt, useState as ut, useEffect as mt, useContext as lt } from "react";
import { Slot as Xt } from "@radix-ui/react-slot";
import { motion as V, AnimatePresence as Zt } from "framer-motion";
function Tt(t) {
  var r, e, o = "";
  if (typeof t == "string" || typeof t == "number") o += t;
  else if (typeof t == "object") if (Array.isArray(t)) {
    var n = t.length;
    for (r = 0; r < n; r++) t[r] && (e = Tt(t[r])) && (o && (o += " "), o += e);
  } else for (e in t) t[e] && (o && (o += " "), o += e);
  return o;
}
function At() {
  for (var t, r, e = 0, o = "", n = arguments.length; e < n; e++) (t = arguments[e]) && (r = Tt(t)) && (o && (o += " "), o += r);
  return o;
}
const ct = "-", Qt = (t) => {
  const r = tr(t), {
    conflictingClassGroups: e,
    conflictingClassGroupModifiers: o
  } = t;
  return {
    getClassGroupId: (i) => {
      const a = i.split(ct);
      return a[0] === "" && a.length !== 1 && a.shift(), zt(a, r) || er(i);
    },
    getConflictingClassGroupIds: (i, a) => {
      const m = e[i] || [];
      return a && o[i] ? [...m, ...o[i]] : m;
    }
  };
}, zt = (t, r) => {
  var i;
  if (t.length === 0)
    return r.classGroupId;
  const e = t[0], o = r.nextPart.get(e), n = o ? zt(t.slice(1), o) : void 0;
  if (n)
    return n;
  if (r.validators.length === 0)
    return;
  const s = t.join(ct);
  return (i = r.validators.find(({
    validator: a
  }) => a(s))) == null ? void 0 : i.classGroupId;
}, ft = /^\[(.+)\]$/, er = (t) => {
  if (ft.test(t)) {
    const r = ft.exec(t)[1], e = r == null ? void 0 : r.substring(0, r.indexOf(":"));
    if (e)
      return "arbitrary.." + e;
  }
}, tr = (t) => {
  const {
    theme: r,
    prefix: e
  } = t, o = {
    nextPart: /* @__PURE__ */ new Map(),
    validators: []
  };
  return or(Object.entries(t.classGroups), e).forEach(([s, i]) => {
    et(i, o, s, r);
  }), o;
}, et = (t, r, e, o) => {
  t.forEach((n) => {
    if (typeof n == "string") {
      const s = n === "" ? r : pt(r, n);
      s.classGroupId = e;
      return;
    }
    if (typeof n == "function") {
      if (rr(n)) {
        et(n(o), r, e, o);
        return;
      }
      r.validators.push({
        validator: n,
        classGroupId: e
      });
      return;
    }
    Object.entries(n).forEach(([s, i]) => {
      et(i, pt(r, s), e, o);
    });
  });
}, pt = (t, r) => {
  let e = t;
  return r.split(ct).forEach((o) => {
    e.nextPart.has(o) || e.nextPart.set(o, {
      nextPart: /* @__PURE__ */ new Map(),
      validators: []
    }), e = e.nextPart.get(o);
  }), e;
}, rr = (t) => t.isThemeGetter, or = (t, r) => r ? t.map(([e, o]) => {
  const n = o.map((s) => typeof s == "string" ? r + s : typeof s == "object" ? Object.fromEntries(Object.entries(s).map(([i, a]) => [r + i, a])) : s);
  return [e, n];
}) : t, nr = (t) => {
  if (t < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let r = 0, e = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map();
  const n = (s, i) => {
    e.set(s, i), r++, r > t && (r = 0, o = e, e = /* @__PURE__ */ new Map());
  };
  return {
    get(s) {
      let i = e.get(s);
      if (i !== void 0)
        return i;
      if ((i = o.get(s)) !== void 0)
        return n(s, i), i;
    },
    set(s, i) {
      e.has(s) ? e.set(s, i) : n(s, i);
    }
  };
}, Ft = "!", sr = (t) => {
  const {
    separator: r,
    experimentalParseClassName: e
  } = t, o = r.length === 1, n = r[0], s = r.length, i = (a) => {
    const m = [];
    let l = 0, u = 0, f;
    for (let b = 0; b < a.length; b++) {
      let x = a[b];
      if (l === 0) {
        if (x === n && (o || a.slice(b, b + s) === r)) {
          m.push(a.slice(u, b)), u = b + s;
          continue;
        }
        if (x === "/") {
          f = b;
          continue;
        }
      }
      x === "[" ? l++ : x === "]" && l--;
    }
    const d = m.length === 0 ? a : a.substring(u), g = d.startsWith(Ft), v = g ? d.substring(1) : d, h = f && f > u ? f - u : void 0;
    return {
      modifiers: m,
      hasImportantModifier: g,
      baseClassName: v,
      maybePostfixModifierPosition: h
    };
  };
  return e ? (a) => e({
    className: a,
    parseClassName: i
  }) : i;
}, ir = (t) => {
  if (t.length <= 1)
    return t;
  const r = [];
  let e = [];
  return t.forEach((o) => {
    o[0] === "[" ? (r.push(...e.sort(), o), e = []) : e.push(o);
  }), r.push(...e.sort()), r;
}, ar = (t) => ({
  cache: nr(t.cacheSize),
  parseClassName: sr(t),
  ...Qt(t)
}), lr = /\s+/, cr = (t, r) => {
  const {
    parseClassName: e,
    getClassGroupId: o,
    getConflictingClassGroupIds: n
  } = r, s = [], i = t.trim().split(lr);
  let a = "";
  for (let m = i.length - 1; m >= 0; m -= 1) {
    const l = i[m], {
      modifiers: u,
      hasImportantModifier: f,
      baseClassName: d,
      maybePostfixModifierPosition: g
    } = e(l);
    let v = !!g, h = o(v ? d.substring(0, g) : d);
    if (!h) {
      if (!v) {
        a = l + (a.length > 0 ? " " + a : a);
        continue;
      }
      if (h = o(d), !h) {
        a = l + (a.length > 0 ? " " + a : a);
        continue;
      }
      v = !1;
    }
    const b = ir(u).join(":"), x = f ? b + Ft : b, y = x + h;
    if (s.includes(y))
      continue;
    s.push(y);
    const S = n(h, v);
    for (let k = 0; k < S.length; ++k) {
      const j = S[k];
      s.push(x + j);
    }
    a = l + (a.length > 0 ? " " + a : a);
  }
  return a;
};
function dr() {
  let t = 0, r, e, o = "";
  for (; t < arguments.length; )
    (r = arguments[t++]) && (e = $t(r)) && (o && (o += " "), o += e);
  return o;
}
const $t = (t) => {
  if (typeof t == "string")
    return t;
  let r, e = "";
  for (let o = 0; o < t.length; o++)
    t[o] && (r = $t(t[o])) && (e && (e += " "), e += r);
  return e;
};
function ur(t, ...r) {
  let e, o, n, s = i;
  function i(m) {
    const l = r.reduce((u, f) => f(u), t());
    return e = ar(l), o = e.cache.get, n = e.cache.set, s = a, a(m);
  }
  function a(m) {
    const l = o(m);
    if (l)
      return l;
    const u = cr(m, e);
    return n(m, u), u;
  }
  return function() {
    return s(dr.apply(null, arguments));
  };
}
const z = (t) => {
  const r = (e) => e[t] || [];
  return r.isThemeGetter = !0, r;
}, Pt = /^\[(?:([a-z-]+):)?(.+)\]$/i, mr = /^\d+\/\d+$/, fr = /* @__PURE__ */ new Set(["px", "full", "screen"]), pr = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, hr = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, gr = /^(rgba?|hsla?|hwb|(ok)?(lab|lch))\(.+\)$/, br = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, vr = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Z = (t) => we(t) || fr.has(t) || mr.test(t), ee = (t) => ke(t, "length", Er), we = (t) => !!t && !Number.isNaN(Number(t)), Je = (t) => ke(t, "number", we), Se = (t) => !!t && Number.isInteger(Number(t)), yr = (t) => t.endsWith("%") && we(t.slice(0, -1)), C = (t) => Pt.test(t), te = (t) => pr.test(t), xr = /* @__PURE__ */ new Set(["length", "size", "percentage"]), wr = (t) => ke(t, xr, Mt), kr = (t) => ke(t, "position", Mt), Cr = /* @__PURE__ */ new Set(["image", "url"]), Sr = (t) => ke(t, Cr, Rr), jr = (t) => ke(t, "", _r), je = () => !0, ke = (t, r, e) => {
  const o = Pt.exec(t);
  return o ? o[1] ? typeof r == "string" ? o[1] === r : r.has(o[1]) : e(o[2]) : !1;
}, Er = (t) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  hr.test(t) && !gr.test(t)
), Mt = () => !1, _r = (t) => br.test(t), Rr = (t) => vr.test(t), Nr = () => {
  const t = z("colors"), r = z("spacing"), e = z("blur"), o = z("brightness"), n = z("borderColor"), s = z("borderRadius"), i = z("borderSpacing"), a = z("borderWidth"), m = z("contrast"), l = z("grayscale"), u = z("hueRotate"), f = z("invert"), d = z("gap"), g = z("gradientColorStops"), v = z("gradientColorStopPositions"), h = z("inset"), b = z("margin"), x = z("opacity"), y = z("padding"), S = z("saturate"), k = z("scale"), j = z("sepia"), _ = z("skew"), N = z("space"), $ = z("translate"), O = () => ["auto", "contain", "none"], M = () => ["auto", "hidden", "clip", "visible", "scroll"], oe = () => ["auto", C, r], E = () => [C, r], ne = () => ["", Z, ee], B = () => ["auto", we, C], L = () => ["bottom", "center", "left", "left-bottom", "left-top", "right", "right-bottom", "right-top", "top"], H = () => ["solid", "dashed", "dotted", "double", "none"], U = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], q = () => ["start", "end", "center", "between", "around", "evenly", "stretch"], G = () => ["", "0", C], D = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], c = () => [we, C];
  return {
    cacheSize: 500,
    separator: ":",
    theme: {
      colors: [je],
      spacing: [Z, ee],
      blur: ["none", "", te, C],
      brightness: c(),
      borderColor: [t],
      borderRadius: ["none", "", "full", te, C],
      borderSpacing: E(),
      borderWidth: ne(),
      contrast: c(),
      grayscale: G(),
      hueRotate: c(),
      invert: G(),
      gap: E(),
      gradientColorStops: [t],
      gradientColorStopPositions: [yr, ee],
      inset: oe(),
      margin: oe(),
      opacity: c(),
      padding: E(),
      saturate: c(),
      scale: c(),
      sepia: G(),
      skew: c(),
      space: E(),
      translate: E()
    },
    classGroups: {
      // Layout
      /**
       * Aspect Ratio
       * @see https://tailwindcss.com/docs/aspect-ratio
       */
      aspect: [{
        aspect: ["auto", "square", "video", C]
      }],
      /**
       * Container
       * @see https://tailwindcss.com/docs/container
       */
      container: ["container"],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [te]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": D()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": D()
      }],
      /**
       * Break Inside
       * @see https://tailwindcss.com/docs/break-inside
       */
      "break-inside": [{
        "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
      }],
      /**
       * Box Decoration Break
       * @see https://tailwindcss.com/docs/box-decoration-break
       */
      "box-decoration": [{
        "box-decoration": ["slice", "clone"]
      }],
      /**
       * Box Sizing
       * @see https://tailwindcss.com/docs/box-sizing
       */
      box: [{
        box: ["border", "content"]
      }],
      /**
       * Display
       * @see https://tailwindcss.com/docs/display
       */
      display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
      /**
       * Floats
       * @see https://tailwindcss.com/docs/float
       */
      float: [{
        float: ["right", "left", "none", "start", "end"]
      }],
      /**
       * Clear
       * @see https://tailwindcss.com/docs/clear
       */
      clear: [{
        clear: ["left", "right", "both", "none", "start", "end"]
      }],
      /**
       * Isolation
       * @see https://tailwindcss.com/docs/isolation
       */
      isolation: ["isolate", "isolation-auto"],
      /**
       * Object Fit
       * @see https://tailwindcss.com/docs/object-fit
       */
      "object-fit": [{
        object: ["contain", "cover", "fill", "none", "scale-down"]
      }],
      /**
       * Object Position
       * @see https://tailwindcss.com/docs/object-position
       */
      "object-position": [{
        object: [...L(), C]
      }],
      /**
       * Overflow
       * @see https://tailwindcss.com/docs/overflow
       */
      overflow: [{
        overflow: M()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": M()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": M()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: O()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": O()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": O()
      }],
      /**
       * Position
       * @see https://tailwindcss.com/docs/position
       */
      position: ["static", "fixed", "absolute", "relative", "sticky"],
      /**
       * Top / Right / Bottom / Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      inset: [{
        inset: [h]
      }],
      /**
       * Right / Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": [h]
      }],
      /**
       * Top / Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": [h]
      }],
      /**
       * Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      start: [{
        start: [h]
      }],
      /**
       * End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      end: [{
        end: [h]
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: [h]
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: [h]
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: [h]
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: [h]
      }],
      /**
       * Visibility
       * @see https://tailwindcss.com/docs/visibility
       */
      visibility: ["visible", "invisible", "collapse"],
      /**
       * Z-Index
       * @see https://tailwindcss.com/docs/z-index
       */
      z: [{
        z: ["auto", Se, C]
      }],
      // Flexbox and Grid
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: oe()
      }],
      /**
       * Flex Direction
       * @see https://tailwindcss.com/docs/flex-direction
       */
      "flex-direction": [{
        flex: ["row", "row-reverse", "col", "col-reverse"]
      }],
      /**
       * Flex Wrap
       * @see https://tailwindcss.com/docs/flex-wrap
       */
      "flex-wrap": [{
        flex: ["wrap", "wrap-reverse", "nowrap"]
      }],
      /**
       * Flex
       * @see https://tailwindcss.com/docs/flex
       */
      flex: [{
        flex: ["1", "auto", "initial", "none", C]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: G()
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: G()
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: ["first", "last", "none", Se, C]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": [je]
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: ["auto", {
          span: ["full", Se, C]
        }, C]
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": B()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": B()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": [je]
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: ["auto", {
          span: [Se, C]
        }, C]
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": B()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": B()
      }],
      /**
       * Grid Auto Flow
       * @see https://tailwindcss.com/docs/grid-auto-flow
       */
      "grid-flow": [{
        "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
      }],
      /**
       * Grid Auto Columns
       * @see https://tailwindcss.com/docs/grid-auto-columns
       */
      "auto-cols": [{
        "auto-cols": ["auto", "min", "max", "fr", C]
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": ["auto", "min", "max", "fr", C]
      }],
      /**
       * Gap
       * @see https://tailwindcss.com/docs/gap
       */
      gap: [{
        gap: [d]
      }],
      /**
       * Gap X
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-x": [{
        "gap-x": [d]
      }],
      /**
       * Gap Y
       * @see https://tailwindcss.com/docs/gap
       */
      "gap-y": [{
        "gap-y": [d]
      }],
      /**
       * Justify Content
       * @see https://tailwindcss.com/docs/justify-content
       */
      "justify-content": [{
        justify: ["normal", ...q()]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": ["start", "end", "center", "stretch"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", "start", "end", "center", "stretch"]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...q(), "baseline"]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: ["start", "end", "center", "baseline", "stretch"]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", "start", "end", "center", "stretch", "baseline"]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": [...q(), "baseline"]
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": ["start", "end", "center", "baseline", "stretch"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", "start", "end", "center", "stretch"]
      }],
      // Spacing
      /**
       * Padding
       * @see https://tailwindcss.com/docs/padding
       */
      p: [{
        p: [y]
      }],
      /**
       * Padding X
       * @see https://tailwindcss.com/docs/padding
       */
      px: [{
        px: [y]
      }],
      /**
       * Padding Y
       * @see https://tailwindcss.com/docs/padding
       */
      py: [{
        py: [y]
      }],
      /**
       * Padding Start
       * @see https://tailwindcss.com/docs/padding
       */
      ps: [{
        ps: [y]
      }],
      /**
       * Padding End
       * @see https://tailwindcss.com/docs/padding
       */
      pe: [{
        pe: [y]
      }],
      /**
       * Padding Top
       * @see https://tailwindcss.com/docs/padding
       */
      pt: [{
        pt: [y]
      }],
      /**
       * Padding Right
       * @see https://tailwindcss.com/docs/padding
       */
      pr: [{
        pr: [y]
      }],
      /**
       * Padding Bottom
       * @see https://tailwindcss.com/docs/padding
       */
      pb: [{
        pb: [y]
      }],
      /**
       * Padding Left
       * @see https://tailwindcss.com/docs/padding
       */
      pl: [{
        pl: [y]
      }],
      /**
       * Margin
       * @see https://tailwindcss.com/docs/margin
       */
      m: [{
        m: [b]
      }],
      /**
       * Margin X
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: [b]
      }],
      /**
       * Margin Y
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: [b]
      }],
      /**
       * Margin Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: [b]
      }],
      /**
       * Margin End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: [b]
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: [b]
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: [b]
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: [b]
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: [b]
      }],
      /**
       * Space Between X
       * @see https://tailwindcss.com/docs/space
       */
      "space-x": [{
        "space-x": [N]
      }],
      /**
       * Space Between X Reverse
       * @see https://tailwindcss.com/docs/space
       */
      "space-x-reverse": ["space-x-reverse"],
      /**
       * Space Between Y
       * @see https://tailwindcss.com/docs/space
       */
      "space-y": [{
        "space-y": [N]
      }],
      /**
       * Space Between Y Reverse
       * @see https://tailwindcss.com/docs/space
       */
      "space-y-reverse": ["space-y-reverse"],
      // Sizing
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: ["auto", "min", "max", "fit", "svw", "lvw", "dvw", C, r]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [C, r, "min", "max", "fit"]
      }],
      /**
       * Max-Width
       * @see https://tailwindcss.com/docs/max-width
       */
      "max-w": [{
        "max-w": [C, r, "none", "full", "min", "max", "fit", "prose", {
          screen: [te]
        }, te]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: [C, r, "auto", "min", "max", "fit", "svh", "lvh", "dvh"]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": [C, r, "min", "max", "fit", "svh", "lvh", "dvh"]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": [C, r, "min", "max", "fit", "svh", "lvh", "dvh"]
      }],
      /**
       * Size
       * @see https://tailwindcss.com/docs/size
       */
      size: [{
        size: [C, r, "auto", "min", "max", "fit"]
      }],
      // Typography
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", te, ee]
      }],
      /**
       * Font Smoothing
       * @see https://tailwindcss.com/docs/font-smoothing
       */
      "font-smoothing": ["antialiased", "subpixel-antialiased"],
      /**
       * Font Style
       * @see https://tailwindcss.com/docs/font-style
       */
      "font-style": ["italic", "not-italic"],
      /**
       * Font Weight
       * @see https://tailwindcss.com/docs/font-weight
       */
      "font-weight": [{
        font: ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black", Je]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [je]
      }],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-normal": ["normal-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-ordinal": ["ordinal"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-slashed-zero": ["slashed-zero"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-figure": ["lining-nums", "oldstyle-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-spacing": ["proportional-nums", "tabular-nums"],
      /**
       * Font Variant Numeric
       * @see https://tailwindcss.com/docs/font-variant-numeric
       */
      "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
      /**
       * Letter Spacing
       * @see https://tailwindcss.com/docs/letter-spacing
       */
      tracking: [{
        tracking: ["tighter", "tight", "normal", "wide", "wider", "widest", C]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": ["none", we, Je]
      }],
      /**
       * Line Height
       * @see https://tailwindcss.com/docs/line-height
       */
      leading: [{
        leading: ["none", "tight", "snug", "normal", "relaxed", "loose", Z, C]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", C]
      }],
      /**
       * List Style Type
       * @see https://tailwindcss.com/docs/list-style-type
       */
      "list-style-type": [{
        list: ["none", "disc", "decimal", C]
      }],
      /**
       * List Style Position
       * @see https://tailwindcss.com/docs/list-style-position
       */
      "list-style-position": [{
        list: ["inside", "outside"]
      }],
      /**
       * Placeholder Color
       * @deprecated since Tailwind CSS v3.0.0
       * @see https://tailwindcss.com/docs/placeholder-color
       */
      "placeholder-color": [{
        placeholder: [t]
      }],
      /**
       * Placeholder Opacity
       * @see https://tailwindcss.com/docs/placeholder-opacity
       */
      "placeholder-opacity": [{
        "placeholder-opacity": [x]
      }],
      /**
       * Text Alignment
       * @see https://tailwindcss.com/docs/text-align
       */
      "text-alignment": [{
        text: ["left", "center", "right", "justify", "start", "end"]
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: [t]
      }],
      /**
       * Text Opacity
       * @see https://tailwindcss.com/docs/text-opacity
       */
      "text-opacity": [{
        "text-opacity": [x]
      }],
      /**
       * Text Decoration
       * @see https://tailwindcss.com/docs/text-decoration
       */
      "text-decoration": ["underline", "overline", "line-through", "no-underline"],
      /**
       * Text Decoration Style
       * @see https://tailwindcss.com/docs/text-decoration-style
       */
      "text-decoration-style": [{
        decoration: [...H(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: ["auto", "from-font", Z, ee]
      }],
      /**
       * Text Underline Offset
       * @see https://tailwindcss.com/docs/text-underline-offset
       */
      "underline-offset": [{
        "underline-offset": ["auto", Z, C]
      }],
      /**
       * Text Decoration Color
       * @see https://tailwindcss.com/docs/text-decoration-color
       */
      "text-decoration-color": [{
        decoration: [t]
      }],
      /**
       * Text Transform
       * @see https://tailwindcss.com/docs/text-transform
       */
      "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
      /**
       * Text Overflow
       * @see https://tailwindcss.com/docs/text-overflow
       */
      "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
      /**
       * Text Wrap
       * @see https://tailwindcss.com/docs/text-wrap
       */
      "text-wrap": [{
        text: ["wrap", "nowrap", "balance", "pretty"]
      }],
      /**
       * Text Indent
       * @see https://tailwindcss.com/docs/text-indent
       */
      indent: [{
        indent: E()
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", C]
      }],
      /**
       * Whitespace
       * @see https://tailwindcss.com/docs/whitespace
       */
      whitespace: [{
        whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
      }],
      /**
       * Word Break
       * @see https://tailwindcss.com/docs/word-break
       */
      break: [{
        break: ["normal", "words", "all", "keep"]
      }],
      /**
       * Hyphens
       * @see https://tailwindcss.com/docs/hyphens
       */
      hyphens: [{
        hyphens: ["none", "manual", "auto"]
      }],
      /**
       * Content
       * @see https://tailwindcss.com/docs/content
       */
      content: [{
        content: ["none", C]
      }],
      // Backgrounds
      /**
       * Background Attachment
       * @see https://tailwindcss.com/docs/background-attachment
       */
      "bg-attachment": [{
        bg: ["fixed", "local", "scroll"]
      }],
      /**
       * Background Clip
       * @see https://tailwindcss.com/docs/background-clip
       */
      "bg-clip": [{
        "bg-clip": ["border", "padding", "content", "text"]
      }],
      /**
       * Background Opacity
       * @deprecated since Tailwind CSS v3.0.0
       * @see https://tailwindcss.com/docs/background-opacity
       */
      "bg-opacity": [{
        "bg-opacity": [x]
      }],
      /**
       * Background Origin
       * @see https://tailwindcss.com/docs/background-origin
       */
      "bg-origin": [{
        "bg-origin": ["border", "padding", "content"]
      }],
      /**
       * Background Position
       * @see https://tailwindcss.com/docs/background-position
       */
      "bg-position": [{
        bg: [...L(), kr]
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: ["no-repeat", {
          repeat: ["", "x", "y", "round", "space"]
        }]
      }],
      /**
       * Background Size
       * @see https://tailwindcss.com/docs/background-size
       */
      "bg-size": [{
        bg: ["auto", "cover", "contain", wr]
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          "gradient-to": ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
        }, Sr]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: [t]
      }],
      /**
       * Gradient Color Stops From Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from-pos": [{
        from: [v]
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: [v]
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: [v]
      }],
      /**
       * Gradient Color Stops From
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from": [{
        from: [g]
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: [g]
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: [g]
      }],
      // Borders
      /**
       * Border Radius
       * @see https://tailwindcss.com/docs/border-radius
       */
      rounded: [{
        rounded: [s]
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": [s]
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": [s]
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": [s]
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": [s]
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": [s]
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": [s]
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": [s]
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": [s]
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": [s]
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": [s]
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": [s]
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": [s]
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": [s]
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": [s]
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: [a]
      }],
      /**
       * Border Width X
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": [a]
      }],
      /**
       * Border Width Y
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": [a]
      }],
      /**
       * Border Width Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": [a]
      }],
      /**
       * Border Width End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": [a]
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": [a]
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": [a]
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": [a]
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": [a]
      }],
      /**
       * Border Opacity
       * @see https://tailwindcss.com/docs/border-opacity
       */
      "border-opacity": [{
        "border-opacity": [x]
      }],
      /**
       * Border Style
       * @see https://tailwindcss.com/docs/border-style
       */
      "border-style": [{
        border: [...H(), "hidden"]
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/divide-width
       */
      "divide-x": [{
        "divide-x": [a]
      }],
      /**
       * Divide Width X Reverse
       * @see https://tailwindcss.com/docs/divide-width
       */
      "divide-x-reverse": ["divide-x-reverse"],
      /**
       * Divide Width Y
       * @see https://tailwindcss.com/docs/divide-width
       */
      "divide-y": [{
        "divide-y": [a]
      }],
      /**
       * Divide Width Y Reverse
       * @see https://tailwindcss.com/docs/divide-width
       */
      "divide-y-reverse": ["divide-y-reverse"],
      /**
       * Divide Opacity
       * @see https://tailwindcss.com/docs/divide-opacity
       */
      "divide-opacity": [{
        "divide-opacity": [x]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/divide-style
       */
      "divide-style": [{
        divide: H()
      }],
      /**
       * Border Color
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color": [{
        border: [n]
      }],
      /**
       * Border Color X
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": [n]
      }],
      /**
       * Border Color Y
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": [n]
      }],
      /**
       * Border Color S
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": [n]
      }],
      /**
       * Border Color E
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": [n]
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": [n]
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": [n]
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": [n]
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": [n]
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: [n]
      }],
      /**
       * Outline Style
       * @see https://tailwindcss.com/docs/outline-style
       */
      "outline-style": [{
        outline: ["", ...H()]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [Z, C]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: [Z, ee]
      }],
      /**
       * Outline Color
       * @see https://tailwindcss.com/docs/outline-color
       */
      "outline-color": [{
        outline: [t]
      }],
      /**
       * Ring Width
       * @see https://tailwindcss.com/docs/ring-width
       */
      "ring-w": [{
        ring: ne()
      }],
      /**
       * Ring Width Inset
       * @see https://tailwindcss.com/docs/ring-width
       */
      "ring-w-inset": ["ring-inset"],
      /**
       * Ring Color
       * @see https://tailwindcss.com/docs/ring-color
       */
      "ring-color": [{
        ring: [t]
      }],
      /**
       * Ring Opacity
       * @see https://tailwindcss.com/docs/ring-opacity
       */
      "ring-opacity": [{
        "ring-opacity": [x]
      }],
      /**
       * Ring Offset Width
       * @see https://tailwindcss.com/docs/ring-offset-width
       */
      "ring-offset-w": [{
        "ring-offset": [Z, ee]
      }],
      /**
       * Ring Offset Color
       * @see https://tailwindcss.com/docs/ring-offset-color
       */
      "ring-offset-color": [{
        "ring-offset": [t]
      }],
      // Effects
      /**
       * Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow
       */
      shadow: [{
        shadow: ["", "inner", "none", te, jr]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow-color
       */
      "shadow-color": [{
        shadow: [je]
      }],
      /**
       * Opacity
       * @see https://tailwindcss.com/docs/opacity
       */
      opacity: [{
        opacity: [x]
      }],
      /**
       * Mix Blend Mode
       * @see https://tailwindcss.com/docs/mix-blend-mode
       */
      "mix-blend": [{
        "mix-blend": [...U(), "plus-lighter", "plus-darker"]
      }],
      /**
       * Background Blend Mode
       * @see https://tailwindcss.com/docs/background-blend-mode
       */
      "bg-blend": [{
        "bg-blend": U()
      }],
      // Filters
      /**
       * Filter
       * @deprecated since Tailwind CSS v3.0.0
       * @see https://tailwindcss.com/docs/filter
       */
      filter: [{
        filter: ["", "none"]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: [e]
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [o]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [m]
      }],
      /**
       * Drop Shadow
       * @see https://tailwindcss.com/docs/drop-shadow
       */
      "drop-shadow": [{
        "drop-shadow": ["", "none", te, C]
      }],
      /**
       * Grayscale
       * @see https://tailwindcss.com/docs/grayscale
       */
      grayscale: [{
        grayscale: [l]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [u]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: [f]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [S]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: [j]
      }],
      /**
       * Backdrop Filter
       * @deprecated since Tailwind CSS v3.0.0
       * @see https://tailwindcss.com/docs/backdrop-filter
       */
      "backdrop-filter": [{
        "backdrop-filter": ["", "none"]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": [e]
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [o]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [m]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": [l]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [u]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": [f]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [x]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [S]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": [j]
      }],
      // Tables
      /**
       * Border Collapse
       * @see https://tailwindcss.com/docs/border-collapse
       */
      "border-collapse": [{
        border: ["collapse", "separate"]
      }],
      /**
       * Border Spacing
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing": [{
        "border-spacing": [i]
      }],
      /**
       * Border Spacing X
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-x": [{
        "border-spacing-x": [i]
      }],
      /**
       * Border Spacing Y
       * @see https://tailwindcss.com/docs/border-spacing
       */
      "border-spacing-y": [{
        "border-spacing-y": [i]
      }],
      /**
       * Table Layout
       * @see https://tailwindcss.com/docs/table-layout
       */
      "table-layout": [{
        table: ["auto", "fixed"]
      }],
      /**
       * Caption Side
       * @see https://tailwindcss.com/docs/caption-side
       */
      caption: [{
        caption: ["top", "bottom"]
      }],
      // Transitions and Animation
      /**
       * Tranisition Property
       * @see https://tailwindcss.com/docs/transition-property
       */
      transition: [{
        transition: ["none", "all", "", "colors", "opacity", "shadow", "transform", C]
      }],
      /**
       * Transition Duration
       * @see https://tailwindcss.com/docs/transition-duration
       */
      duration: [{
        duration: c()
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "in", "out", "in-out", C]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: c()
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", "spin", "ping", "pulse", "bounce", C]
      }],
      // Transforms
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: ["", "gpu", "none"]
      }],
      /**
       * Scale
       * @see https://tailwindcss.com/docs/scale
       */
      scale: [{
        scale: [k]
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": [k]
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": [k]
      }],
      /**
       * Rotate
       * @see https://tailwindcss.com/docs/rotate
       */
      rotate: [{
        rotate: [Se, C]
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": [$]
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": [$]
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": [_]
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": [_]
      }],
      /**
       * Transform Origin
       * @see https://tailwindcss.com/docs/transform-origin
       */
      "transform-origin": [{
        origin: ["center", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left", "top-left", C]
      }],
      // Interactivity
      /**
       * Accent Color
       * @see https://tailwindcss.com/docs/accent-color
       */
      accent: [{
        accent: ["auto", t]
      }],
      /**
       * Appearance
       * @see https://tailwindcss.com/docs/appearance
       */
      appearance: [{
        appearance: ["none", "auto"]
      }],
      /**
       * Cursor
       * @see https://tailwindcss.com/docs/cursor
       */
      cursor: [{
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", C]
      }],
      /**
       * Caret Color
       * @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
       */
      "caret-color": [{
        caret: [t]
      }],
      /**
       * Pointer Events
       * @see https://tailwindcss.com/docs/pointer-events
       */
      "pointer-events": [{
        "pointer-events": ["none", "auto"]
      }],
      /**
       * Resize
       * @see https://tailwindcss.com/docs/resize
       */
      resize: [{
        resize: ["none", "y", "x", ""]
      }],
      /**
       * Scroll Behavior
       * @see https://tailwindcss.com/docs/scroll-behavior
       */
      "scroll-behavior": [{
        scroll: ["auto", "smooth"]
      }],
      /**
       * Scroll Margin
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-m": [{
        "scroll-m": E()
      }],
      /**
       * Scroll Margin X
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mx": [{
        "scroll-mx": E()
      }],
      /**
       * Scroll Margin Y
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-my": [{
        "scroll-my": E()
      }],
      /**
       * Scroll Margin Start
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ms": [{
        "scroll-ms": E()
      }],
      /**
       * Scroll Margin End
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-me": [{
        "scroll-me": E()
      }],
      /**
       * Scroll Margin Top
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mt": [{
        "scroll-mt": E()
      }],
      /**
       * Scroll Margin Right
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mr": [{
        "scroll-mr": E()
      }],
      /**
       * Scroll Margin Bottom
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-mb": [{
        "scroll-mb": E()
      }],
      /**
       * Scroll Margin Left
       * @see https://tailwindcss.com/docs/scroll-margin
       */
      "scroll-ml": [{
        "scroll-ml": E()
      }],
      /**
       * Scroll Padding
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-p": [{
        "scroll-p": E()
      }],
      /**
       * Scroll Padding X
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-px": [{
        "scroll-px": E()
      }],
      /**
       * Scroll Padding Y
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-py": [{
        "scroll-py": E()
      }],
      /**
       * Scroll Padding Start
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-ps": [{
        "scroll-ps": E()
      }],
      /**
       * Scroll Padding End
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pe": [{
        "scroll-pe": E()
      }],
      /**
       * Scroll Padding Top
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pt": [{
        "scroll-pt": E()
      }],
      /**
       * Scroll Padding Right
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pr": [{
        "scroll-pr": E()
      }],
      /**
       * Scroll Padding Bottom
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pb": [{
        "scroll-pb": E()
      }],
      /**
       * Scroll Padding Left
       * @see https://tailwindcss.com/docs/scroll-padding
       */
      "scroll-pl": [{
        "scroll-pl": E()
      }],
      /**
       * Scroll Snap Align
       * @see https://tailwindcss.com/docs/scroll-snap-align
       */
      "snap-align": [{
        snap: ["start", "end", "center", "align-none"]
      }],
      /**
       * Scroll Snap Stop
       * @see https://tailwindcss.com/docs/scroll-snap-stop
       */
      "snap-stop": [{
        snap: ["normal", "always"]
      }],
      /**
       * Scroll Snap Type
       * @see https://tailwindcss.com/docs/scroll-snap-type
       */
      "snap-type": [{
        snap: ["none", "x", "y", "both"]
      }],
      /**
       * Scroll Snap Type Strictness
       * @see https://tailwindcss.com/docs/scroll-snap-type
       */
      "snap-strictness": [{
        snap: ["mandatory", "proximity"]
      }],
      /**
       * Touch Action
       * @see https://tailwindcss.com/docs/touch-action
       */
      touch: [{
        touch: ["auto", "none", "manipulation"]
      }],
      /**
       * Touch Action X
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-x": [{
        "touch-pan": ["x", "left", "right"]
      }],
      /**
       * Touch Action Y
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-y": [{
        "touch-pan": ["y", "up", "down"]
      }],
      /**
       * Touch Action Pinch Zoom
       * @see https://tailwindcss.com/docs/touch-action
       */
      "touch-pz": ["touch-pinch-zoom"],
      /**
       * User Select
       * @see https://tailwindcss.com/docs/user-select
       */
      select: [{
        select: ["none", "text", "all", "auto"]
      }],
      /**
       * Will Change
       * @see https://tailwindcss.com/docs/will-change
       */
      "will-change": [{
        "will-change": ["auto", "scroll", "contents", "transform", C]
      }],
      // SVG
      /**
       * Fill
       * @see https://tailwindcss.com/docs/fill
       */
      fill: [{
        fill: [t, "none"]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [Z, ee, Je]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: [t, "none"]
      }],
      // Accessibility
      /**
       * Screen Readers
       * @see https://tailwindcss.com/docs/screen-readers
       */
      sr: ["sr-only", "not-sr-only"],
      /**
       * Forced Color Adjust
       * @see https://tailwindcss.com/docs/forced-color-adjust
       */
      "forced-color-adjust": [{
        "forced-color-adjust": ["auto", "none"]
      }]
    },
    conflictingClassGroups: {
      overflow: ["overflow-x", "overflow-y"],
      overscroll: ["overscroll-x", "overscroll-y"],
      inset: ["inset-x", "inset-y", "start", "end", "top", "right", "bottom", "left"],
      "inset-x": ["right", "left"],
      "inset-y": ["top", "bottom"],
      flex: ["basis", "grow", "shrink"],
      gap: ["gap-x", "gap-y"],
      p: ["px", "py", "ps", "pe", "pt", "pr", "pb", "pl"],
      px: ["pr", "pl"],
      py: ["pt", "pb"],
      m: ["mx", "my", "ms", "me", "mt", "mr", "mb", "ml"],
      mx: ["mr", "ml"],
      my: ["mt", "mb"],
      size: ["w", "h"],
      "font-size": ["leading"],
      "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
      "fvn-ordinal": ["fvn-normal"],
      "fvn-slashed-zero": ["fvn-normal"],
      "fvn-figure": ["fvn-normal"],
      "fvn-spacing": ["fvn-normal"],
      "fvn-fraction": ["fvn-normal"],
      "line-clamp": ["display", "overflow"],
      rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
      "rounded-s": ["rounded-ss", "rounded-es"],
      "rounded-e": ["rounded-se", "rounded-ee"],
      "rounded-t": ["rounded-tl", "rounded-tr"],
      "rounded-r": ["rounded-tr", "rounded-br"],
      "rounded-b": ["rounded-br", "rounded-bl"],
      "rounded-l": ["rounded-tl", "rounded-bl"],
      "border-spacing": ["border-spacing-x", "border-spacing-y"],
      "border-w": ["border-w-s", "border-w-e", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
      "border-w-x": ["border-w-r", "border-w-l"],
      "border-w-y": ["border-w-t", "border-w-b"],
      "border-color": ["border-color-s", "border-color-e", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
      "border-color-x": ["border-color-r", "border-color-l"],
      "border-color-y": ["border-color-t", "border-color-b"],
      "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
      "scroll-mx": ["scroll-mr", "scroll-ml"],
      "scroll-my": ["scroll-mt", "scroll-mb"],
      "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
      "scroll-px": ["scroll-pr", "scroll-pl"],
      "scroll-py": ["scroll-pt", "scroll-pb"],
      touch: ["touch-x", "touch-y", "touch-pz"],
      "touch-x": ["touch"],
      "touch-y": ["touch"],
      "touch-pz": ["touch"]
    },
    conflictingClassGroupModifiers: {
      "font-size": ["leading"]
    }
  };
}, Tr = /* @__PURE__ */ ur(Nr);
function I(...t) {
  return Tr(At(t));
}
function Jo(t) {
  return Intl.NumberFormat("en", {
    notation: "compact"
  }).format(t);
}
function Ko(t = "platxa") {
  return `${t}-${Math.random().toString(36).substr(2, 9)}`;
}
const Ar = typeof window < "u";
function Xo() {
  return Ar ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : !1;
}
function Zo(t) {
  return new Promise((r) => setTimeout(r, t));
}
var $e = { exports: {} }, Ee = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ht;
function zr() {
  if (ht) return Ee;
  ht = 1;
  var t = Symbol.for("react.transitional.element"), r = Symbol.for("react.fragment");
  function e(o, n, s) {
    var i = null;
    if (s !== void 0 && (i = "" + s), n.key !== void 0 && (i = "" + n.key), "key" in n) {
      s = {};
      for (var a in n)
        a !== "key" && (s[a] = n[a]);
    } else s = n;
    return n = s.ref, {
      $$typeof: t,
      type: o,
      key: i,
      ref: n !== void 0 ? n : null,
      props: s
    };
  }
  return Ee.Fragment = r, Ee.jsx = e, Ee.jsxs = e, Ee;
}
var _e = {};
/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var gt;
function Fr() {
  return gt || (gt = 1, process.env.NODE_ENV !== "production" && (function() {
    function t(c) {
      if (c == null) return null;
      if (typeof c == "function")
        return c.$$typeof === oe ? null : c.displayName || c.name || null;
      if (typeof c == "string") return c;
      switch (c) {
        case b:
          return "Fragment";
        case y:
          return "Profiler";
        case x:
          return "StrictMode";
        case _:
          return "Suspense";
        case N:
          return "SuspenseList";
        case M:
          return "Activity";
      }
      if (typeof c == "object")
        switch (typeof c.tag == "number" && console.error(
          "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
        ), c.$$typeof) {
          case h:
            return "Portal";
          case k:
            return c.displayName || "Context";
          case S:
            return (c._context.displayName || "Context") + ".Consumer";
          case j:
            var w = c.render;
            return c = c.displayName, c || (c = w.displayName || w.name || "", c = c !== "" ? "ForwardRef(" + c + ")" : "ForwardRef"), c;
          case $:
            return w = c.displayName || null, w !== null ? w : t(c.type) || "Memo";
          case O:
            w = c._payload, c = c._init;
            try {
              return t(c(w));
            } catch {
            }
        }
      return null;
    }
    function r(c) {
      return "" + c;
    }
    function e(c) {
      try {
        r(c);
        var w = !1;
      } catch {
        w = !0;
      }
      if (w) {
        w = console;
        var R = w.error, T = typeof Symbol == "function" && Symbol.toStringTag && c[Symbol.toStringTag] || c.constructor.name || "Object";
        return R.call(
          w,
          "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
          T
        ), r(c);
      }
    }
    function o(c) {
      if (c === b) return "<>";
      if (typeof c == "object" && c !== null && c.$$typeof === O)
        return "<...>";
      try {
        var w = t(c);
        return w ? "<" + w + ">" : "<...>";
      } catch {
        return "<...>";
      }
    }
    function n() {
      var c = E.A;
      return c === null ? null : c.getOwner();
    }
    function s() {
      return Error("react-stack-top-frame");
    }
    function i(c) {
      if (ne.call(c, "key")) {
        var w = Object.getOwnPropertyDescriptor(c, "key").get;
        if (w && w.isReactWarning) return !1;
      }
      return c.key !== void 0;
    }
    function a(c, w) {
      function R() {
        H || (H = !0, console.error(
          "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
          w
        ));
      }
      R.isReactWarning = !0, Object.defineProperty(c, "key", {
        get: R,
        configurable: !0
      });
    }
    function m() {
      var c = t(this.type);
      return U[c] || (U[c] = !0, console.error(
        "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
      )), c = this.props.ref, c !== void 0 ? c : null;
    }
    function l(c, w, R, T, Y, K) {
      var A = R.ref;
      return c = {
        $$typeof: v,
        type: c,
        key: w,
        props: R,
        _owner: T
      }, (A !== void 0 ? A : null) !== null ? Object.defineProperty(c, "ref", {
        enumerable: !1,
        get: m
      }) : Object.defineProperty(c, "ref", { enumerable: !1, value: null }), c._store = {}, Object.defineProperty(c._store, "validated", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: 0
      }), Object.defineProperty(c, "_debugInfo", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: null
      }), Object.defineProperty(c, "_debugStack", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: Y
      }), Object.defineProperty(c, "_debugTask", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: K
      }), Object.freeze && (Object.freeze(c.props), Object.freeze(c)), c;
    }
    function u(c, w, R, T, Y, K) {
      var A = w.children;
      if (A !== void 0)
        if (T)
          if (B(A)) {
            for (T = 0; T < A.length; T++)
              f(A[T]);
            Object.freeze && Object.freeze(A);
          } else
            console.error(
              "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
            );
        else f(A);
      if (ne.call(w, "key")) {
        A = t(c);
        var J = Object.keys(w).filter(function(ie) {
          return ie !== "key";
        });
        T = 0 < J.length ? "{key: someKey, " + J.join(": ..., ") + ": ...}" : "{key: someKey}", D[A + T] || (J = 0 < J.length ? "{" + J.join(": ..., ") + ": ...}" : "{}", console.error(
          `A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`,
          T,
          A,
          J,
          A
        ), D[A + T] = !0);
      }
      if (A = null, R !== void 0 && (e(R), A = "" + R), i(w) && (e(w.key), A = "" + w.key), "key" in w) {
        R = {};
        for (var se in w)
          se !== "key" && (R[se] = w[se]);
      } else R = w;
      return A && a(
        R,
        typeof c == "function" ? c.displayName || c.name || "Unknown" : c
      ), l(
        c,
        A,
        R,
        n(),
        Y,
        K
      );
    }
    function f(c) {
      d(c) ? c._store && (c._store.validated = 1) : typeof c == "object" && c !== null && c.$$typeof === O && (c._payload.status === "fulfilled" ? d(c._payload.value) && c._payload.value._store && (c._payload.value._store.validated = 1) : c._store && (c._store.validated = 1));
    }
    function d(c) {
      return typeof c == "object" && c !== null && c.$$typeof === v;
    }
    var g = at, v = Symbol.for("react.transitional.element"), h = Symbol.for("react.portal"), b = Symbol.for("react.fragment"), x = Symbol.for("react.strict_mode"), y = Symbol.for("react.profiler"), S = Symbol.for("react.consumer"), k = Symbol.for("react.context"), j = Symbol.for("react.forward_ref"), _ = Symbol.for("react.suspense"), N = Symbol.for("react.suspense_list"), $ = Symbol.for("react.memo"), O = Symbol.for("react.lazy"), M = Symbol.for("react.activity"), oe = Symbol.for("react.client.reference"), E = g.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, ne = Object.prototype.hasOwnProperty, B = Array.isArray, L = console.createTask ? console.createTask : function() {
      return null;
    };
    g = {
      react_stack_bottom_frame: function(c) {
        return c();
      }
    };
    var H, U = {}, q = g.react_stack_bottom_frame.bind(
      g,
      s
    )(), G = L(o(s)), D = {};
    _e.Fragment = b, _e.jsx = function(c, w, R) {
      var T = 1e4 > E.recentlyCreatedOwnerStacks++;
      return u(
        c,
        w,
        R,
        !1,
        T ? Error("react-stack-top-frame") : q,
        T ? L(o(c)) : G
      );
    }, _e.jsxs = function(c, w, R) {
      var T = 1e4 > E.recentlyCreatedOwnerStacks++;
      return u(
        c,
        w,
        R,
        !0,
        T ? Error("react-stack-top-frame") : q,
        T ? L(o(c)) : G
      );
    };
  })()), _e;
}
var bt;
function $r() {
  return bt || (bt = 1, process.env.NODE_ENV === "production" ? $e.exports = zr() : $e.exports = Fr()), $e.exports;
}
var p = $r(), Pe = { exports: {} }, Ke = {};
/**
 * @license React
 * react-compiler-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var vt;
function Pr() {
  if (vt) return Ke;
  vt = 1;
  var t = at.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  return Ke.c = function(r) {
    return t.H.useMemoCache(r);
  }, Ke;
}
var Xe = {};
/**
 * @license React
 * react-compiler-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var yt;
function Mr() {
  return yt || (yt = 1, process.env.NODE_ENV !== "production" && (function() {
    var t = at.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    Xe.c = function(r) {
      var e = t.H;
      return e === null && console.error(
        `Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.`
      ), e.useMemoCache(r);
    };
  })()), Xe;
}
var xt;
function Ir() {
  return xt || (xt = 1, process.env.NODE_ENV === "production" ? Pe.exports = Pr() : Pe.exports = Mr()), Pe.exports;
}
var W = Ir();
const wt = (t) => typeof t == "boolean" ? `${t}` : t === 0 ? "0" : t, kt = At, Be = (t, r) => (e) => {
  var o;
  if ((r == null ? void 0 : r.variants) == null) return kt(t, e == null ? void 0 : e.class, e == null ? void 0 : e.className);
  const { variants: n, defaultVariants: s } = r, i = Object.keys(n).map((l) => {
    const u = e == null ? void 0 : e[l], f = s == null ? void 0 : s[l];
    if (u === null) return null;
    const d = wt(u) || wt(f);
    return n[l][d];
  }), a = e && Object.entries(e).reduce((l, u) => {
    let [f, d] = u;
    return d === void 0 || (l[f] = d), l;
  }, {}), m = r == null || (o = r.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((l, u) => {
    let { class: f, className: d, ...g } = u;
    return Object.entries(g).every((v) => {
      let [h, b] = v;
      return Array.isArray(b) ? b.includes({
        ...s,
        ...a
      }[h]) : {
        ...s,
        ...a
      }[h] === b;
    }) ? [
      ...l,
      f,
      d
    ] : l;
  }, []);
  return kt(t, i, m, e == null ? void 0 : e.class, e == null ? void 0 : e.className);
}, It = Be([
  // Base styles
  "inline-flex items-center justify-center gap-2 whitespace-nowrap",
  "rounded-md text-sm font-medium",
  "transition-colors",
  // Focus ring (two-color pattern for WCAG 2.2)
  "focus-visible:outline-none",
  "focus-visible:ring-2 focus-visible:ring-ring",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  // Disabled state
  "disabled:pointer-events-none disabled:opacity-50",
  // Icon sizing
  "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
], {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
      destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
      outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline"
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10"
    }
  },
  defaultVariants: {
    variant: "default",
    size: "default"
  }
}), Ot = (t) => {
  const r = W.c(6), {
    className: e
  } = t;
  let o;
  r[0] !== e ? (o = I("h-4 w-4 animate-spin", e), r[0] = e, r[1] = o) : o = r[1];
  let n, s;
  r[2] === Symbol.for("react.memo_cache_sentinel") ? (n = /* @__PURE__ */ p.jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), s = /* @__PURE__ */ p.jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" }), r[2] = n, r[3] = s) : (n = r[2], s = r[3]);
  let i;
  return r[4] !== o ? (i = /* @__PURE__ */ p.jsxs("svg", { className: o, xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", "aria-hidden": "true", children: [
    n,
    s
  ] }), r[4] = o, r[5] = i) : i = r[5], i;
}, Or = P.forwardRef((t, r) => {
  const e = W.c(31);
  let o, n, s, i, a, m, l, u, f, d;
  e[0] !== t ? ({
    className: n,
    variant: d,
    size: l,
    asChild: u,
    isLoading: f,
    leftIcon: i,
    rightIcon: m,
    disabled: s,
    children: o,
    ...a
  } = t, e[0] = t, e[1] = o, e[2] = n, e[3] = s, e[4] = i, e[5] = a, e[6] = m, e[7] = l, e[8] = u, e[9] = f, e[10] = d) : (o = e[1], n = e[2], s = e[3], i = e[4], a = e[5], m = e[6], l = e[7], u = e[8], f = e[9], d = e[10]);
  const g = u === void 0 ? !1 : u, v = f === void 0 ? !1 : f, h = g ? Xt : "button";
  let b;
  e[11] !== g || e[12] !== o || e[13] !== v || e[14] !== i || e[15] !== m ? (b = () => g ? o : v ? /* @__PURE__ */ p.jsxs(p.Fragment, { children: [
    /* @__PURE__ */ p.jsx(Ot, { className: "mr-2" }),
    o
  ] }) : /* @__PURE__ */ p.jsxs(p.Fragment, { children: [
    i,
    o,
    m
  ] }), e[11] = g, e[12] = o, e[13] = v, e[14] = i, e[15] = m, e[16] = b) : b = e[16];
  const x = b;
  let y;
  e[17] !== n || e[18] !== l || e[19] !== d ? (y = I(It({
    variant: d,
    size: l,
    className: n
  })), e[17] = n, e[18] = l, e[19] = d, e[20] = y) : y = e[20];
  const S = s || v, k = v || void 0;
  let j;
  e[21] !== x ? (j = x(), e[21] = x, e[22] = j) : j = e[22];
  let _;
  return e[23] !== h || e[24] !== a || e[25] !== r || e[26] !== y || e[27] !== S || e[28] !== k || e[29] !== j ? (_ = /* @__PURE__ */ p.jsx(h, { className: y, ref: r, disabled: S, "aria-busy": k, ...a, children: j }), e[23] = h, e[24] = a, e[25] = r, e[26] = y, e[27] = S, e[28] = k, e[29] = j, e[30] = _) : _ = e[30], _;
});
Or.displayName = "Button";
const Bt = P.forwardRef((t, r) => {
  const e = W.c(33);
  let o, n, s, i, a, m, l, u, f;
  e[0] !== t ? ({
    className: n,
    variant: f,
    size: l,
    isLoading: u,
    leftIcon: i,
    rightIcon: m,
    disabled: s,
    children: o,
    ...a
  } = t, e[0] = t, e[1] = o, e[2] = n, e[3] = s, e[4] = i, e[5] = a, e[6] = m, e[7] = l, e[8] = u, e[9] = f) : (o = e[1], n = e[2], s = e[3], i = e[4], a = e[5], m = e[6], l = e[7], u = e[8], f = e[9]);
  const d = u === void 0 ? !1 : u, g = s || d;
  let v;
  e[10] !== n || e[11] !== l || e[12] !== f ? (v = I(It({
    variant: f,
    size: l,
    className: n
  })), e[10] = n, e[11] = l, e[12] = f, e[13] = v) : v = e[13];
  const h = d || void 0, b = g ? 1 : 1.02;
  let x;
  e[14] !== b ? (x = {
    scale: b
  }, e[14] = b, e[15] = x) : x = e[15];
  const y = g ? 1 : 0.98;
  let S;
  e[16] !== y ? (S = {
    scale: y
  }, e[16] = y, e[17] = S) : S = e[17];
  let k;
  e[18] === Symbol.for("react.memo_cache_sentinel") ? (k = {
    type: "spring",
    stiffness: 400,
    damping: 17
  }, e[18] = k) : k = e[18];
  let j;
  e[19] !== o || e[20] !== d || e[21] !== i || e[22] !== m ? (j = d ? /* @__PURE__ */ p.jsxs(p.Fragment, { children: [
    /* @__PURE__ */ p.jsx(Ot, { className: "mr-2" }),
    o
  ] }) : /* @__PURE__ */ p.jsxs(p.Fragment, { children: [
    i,
    o,
    m
  ] }), e[19] = o, e[20] = d, e[21] = i, e[22] = m, e[23] = j) : j = e[23];
  let _;
  return e[24] !== g || e[25] !== a || e[26] !== r || e[27] !== v || e[28] !== h || e[29] !== x || e[30] !== S || e[31] !== j ? (_ = /* @__PURE__ */ p.jsx(V.button, { ref: r, className: v, disabled: g, "aria-busy": h, whileHover: x, whileTap: S, transition: k, ...a, children: j }), e[24] = g, e[25] = a, e[26] = r, e[27] = v, e[28] = h, e[29] = x, e[30] = S, e[31] = j, e[32] = _) : _ = e[32], _;
});
Bt.displayName = "AnimatedButton";
const Ct = Be([
  // Base styles
  "flex w-full rounded-md border bg-transparent px-3 py-2",
  "text-base md:text-sm",
  "transition-colors",
  // Placeholder
  "placeholder:text-muted-foreground",
  // Focus styles (two-color pattern for WCAG 2.2)
  "focus-visible:outline-none",
  "focus-visible:ring-2 focus-visible:ring-ring",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  // Disabled state
  "disabled:cursor-not-allowed disabled:opacity-50",
  // File input styles
  "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
], {
  variants: {
    variant: {
      default: "border-input bg-background",
      error: "border-destructive focus-visible:ring-destructive"
    },
    inputSize: {
      default: "h-10",
      sm: "h-9 px-2 text-sm",
      lg: "h-12 px-4"
    }
  },
  defaultVariants: {
    variant: "default",
    inputSize: "default"
  }
}), tt = P.forwardRef((t, r) => {
  const e = W.c(45);
  let o, n, s, i, a, m, l, u, f, d;
  e[0] !== t ? ({
    className: s,
    type: f,
    variant: d,
    inputSize: a,
    error: i,
    leftElement: m,
    rightElement: u,
    "aria-invalid": n,
    "aria-describedby": o,
    ...l
  } = t, e[0] = t, e[1] = o, e[2] = n, e[3] = s, e[4] = i, e[5] = a, e[6] = m, e[7] = l, e[8] = u, e[9] = f, e[10] = d) : (o = e[1], n = e[2], s = e[3], i = e[4], a = e[5], m = e[6], l = e[7], u = e[8], f = e[9], d = e[10]);
  const g = !!i || n === !0 || n === "true";
  if (!m && !u) {
    let k;
    e[11] !== s || e[12] !== g || e[13] !== a || e[14] !== d ? (k = I(Ct({
      variant: g ? "error" : d,
      inputSize: a
    }), s), e[11] = s, e[12] = g, e[13] = a, e[14] = d, e[15] = k) : k = e[15];
    const j = g || void 0;
    let _;
    return e[16] !== o || e[17] !== l || e[18] !== r || e[19] !== k || e[20] !== j || e[21] !== f ? (_ = /* @__PURE__ */ p.jsx("input", { type: f, className: k, ref: r, "aria-invalid": j, "aria-describedby": o, ...l }), e[16] = o, e[17] = l, e[18] = r, e[19] = k, e[20] = j, e[21] = f, e[22] = _) : _ = e[22], _;
  }
  let v;
  e[23] !== m ? (v = m && /* @__PURE__ */ p.jsx("div", { className: "absolute left-3 flex items-center text-muted-foreground", children: m }), e[23] = m, e[24] = v) : v = e[24];
  let h;
  e[25] !== s || e[26] !== g || e[27] !== a || e[28] !== m || e[29] !== u || e[30] !== d ? (h = I(Ct({
    variant: g ? "error" : d,
    inputSize: a
  }), m && "pl-10", u && "pr-10", s), e[25] = s, e[26] = g, e[27] = a, e[28] = m, e[29] = u, e[30] = d, e[31] = h) : h = e[31];
  const b = g || void 0;
  let x;
  e[32] !== o || e[33] !== l || e[34] !== r || e[35] !== h || e[36] !== b || e[37] !== f ? (x = /* @__PURE__ */ p.jsx("input", { type: f, className: h, ref: r, "aria-invalid": b, "aria-describedby": o, ...l }), e[32] = o, e[33] = l, e[34] = r, e[35] = h, e[36] = b, e[37] = f, e[38] = x) : x = e[38];
  let y;
  e[39] !== u ? (y = u && /* @__PURE__ */ p.jsx("div", { className: "absolute right-3 flex items-center", children: u }), e[39] = u, e[40] = y) : y = e[40];
  let S;
  return e[41] !== v || e[42] !== x || e[43] !== y ? (S = /* @__PURE__ */ p.jsxs("div", { className: "relative flex items-center", children: [
    v,
    x,
    y
  ] }), e[41] = v, e[42] = x, e[43] = y, e[44] = S) : S = e[44], S;
});
tt.displayName = "Input";
const Br = Be(["text-sm font-medium leading-none", "peer-disabled:cursor-not-allowed peer-disabled:opacity-70"], {
  variants: {
    variant: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      error: "text-destructive"
    }
  },
  defaultVariants: {
    variant: "default"
  }
}), Me = P.forwardRef((t, r) => {
  const e = W.c(17);
  let o, n, s, i, a;
  e[0] !== t ? ({
    className: n,
    variant: a,
    required: i,
    children: o,
    ...s
  } = t, e[0] = t, e[1] = o, e[2] = n, e[3] = s, e[4] = i, e[5] = a) : (o = e[1], n = e[2], s = e[3], i = e[4], a = e[5]);
  let m;
  e[6] !== n || e[7] !== a ? (m = I(Br({
    variant: a
  }), n), e[6] = n, e[7] = a, e[8] = m) : m = e[8];
  let l;
  e[9] !== i ? (l = i && /* @__PURE__ */ p.jsx("span", { className: "ml-1 text-destructive", "aria-hidden": "true", children: "*" }), e[9] = i, e[10] = l) : l = e[10];
  let u;
  return e[11] !== o || e[12] !== s || e[13] !== r || e[14] !== m || e[15] !== l ? (u = /* @__PURE__ */ p.jsxs("label", { ref: r, className: m, ...s, children: [
    o,
    l
  ] }), e[11] = o, e[12] = s, e[13] = r, e[14] = m, e[15] = l, e[16] = u) : u = e[16], u;
});
Me.displayName = "Label";
/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Lr = (t) => t.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), Lt = (...t) => t.filter((r, e, o) => !!r && r.trim() !== "" && o.indexOf(r) === e).join(" ").trim();
/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var Vr = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Wr = Nt(
  ({
    color: t = "currentColor",
    size: r = 24,
    strokeWidth: e = 2,
    absoluteStrokeWidth: o,
    className: n = "",
    children: s,
    iconNode: i,
    ...a
  }, m) => Qe(
    "svg",
    {
      ref: m,
      ...Vr,
      width: r,
      height: r,
      stroke: t,
      strokeWidth: o ? Number(e) * 24 / Number(r) : e,
      className: Lt("lucide", n),
      ...a
    },
    [
      ...i.map(([l, u]) => Qe(l, u)),
      ...Array.isArray(s) ? s : [s]
    ]
  )
);
/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ce = (t, r) => {
  const e = Nt(
    ({ className: o, ...n }, s) => Qe(Wr, {
      ref: s,
      iconNode: r,
      className: Lt(`lucide-${Lr(t)}`, o),
      ...n
    })
  );
  return e.displayName = `${t}`, e;
};
/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Hr = Ce("Check", [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]);
/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Gr = Ce("CircleAlert", [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
  ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }]
]);
/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Dr = Ce("EyeOff", [
  [
    "path",
    {
      d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
      key: "ct8e1f"
    }
  ],
  ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242", key: "151rxh" }],
  [
    "path",
    {
      d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
      key: "13bj9a"
    }
  ],
  ["path", { d: "m2 2 20 20", key: "1ooewy" }]
]);
/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ur = Ce("Eye", [
  [
    "path",
    {
      d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
      key: "1nclc0"
    }
  ],
  ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
]);
/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const qr = Ce("Lock", [
  ["rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2", key: "1w4ew1" }],
  ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4", key: "fwvmzm" }]
]);
/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Yr = Ce("Mail", [
  ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" }],
  ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", key: "1ocrg3" }]
]), Jr = Be([
  // Base styles
  "peer shrink-0 rounded border",
  "transition-colors",
  // Focus styles (two-color pattern for WCAG 2.2)
  "focus-visible:outline-none",
  "focus-visible:ring-2 focus-visible:ring-ring",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  // Disabled state
  "disabled:cursor-not-allowed disabled:opacity-50",
  // Checked state
  "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
], {
  variants: {
    size: {
      default: "h-4 w-4",
      sm: "h-3.5 w-3.5",
      lg: "h-5 w-5"
    }
  },
  defaultVariants: {
    size: "default"
  }
}), Vt = P.forwardRef((t, r) => {
  const e = W.c(30);
  let o, n, s, i, a, m, l;
  e[0] !== t ? ({
    className: n,
    size: l,
    checked: o,
    defaultChecked: s,
    onCheckedChange: a,
    onChange: i,
    ...m
  } = t, e[0] = t, e[1] = o, e[2] = n, e[3] = s, e[4] = i, e[5] = a, e[6] = m, e[7] = l) : (o = e[1], n = e[2], s = e[3], i = e[4], a = e[5], m = e[6], l = e[7]);
  const [u, f] = P.useState(s ?? !1), d = o !== void 0, g = d ? o : u;
  let v;
  e[8] !== d || e[9] !== i || e[10] !== a ? (v = (_) => {
    const N = _.target.checked;
    d || f(N), a == null || a(N), i == null || i(_);
  }, e[8] = d, e[9] = i, e[10] = a, e[11] = v) : v = e[11];
  const h = v;
  let b;
  e[12] !== h || e[13] !== g || e[14] !== m || e[15] !== r ? (b = /* @__PURE__ */ p.jsx("input", { type: "checkbox", ref: r, checked: g, onChange: h, className: "sr-only peer", ...m }), e[12] = h, e[13] = g, e[14] = m, e[15] = r, e[16] = b) : b = e[16];
  const x = g ? "checked" : "unchecked";
  let y;
  e[17] !== n || e[18] !== l ? (y = I(Jr({
    size: l
  }), "border-input bg-background", "flex items-center justify-center", n), e[17] = n, e[18] = l, e[19] = y) : y = e[19];
  let S;
  e[20] !== g || e[21] !== l ? (S = g && /* @__PURE__ */ p.jsx(Hr, { className: I("text-current", l === "sm" && "h-2.5 w-2.5", l === "lg" && "h-4 w-4", (!l || l === "default") && "h-3 w-3"), strokeWidth: 3 }), e[20] = g, e[21] = l, e[22] = S) : S = e[22];
  let k;
  e[23] !== x || e[24] !== y || e[25] !== S ? (k = /* @__PURE__ */ p.jsx("div", { "data-state": x, className: y, "aria-hidden": "true", children: S }), e[23] = x, e[24] = y, e[25] = S, e[26] = k) : k = e[26];
  let j;
  return e[27] !== b || e[28] !== k ? (j = /* @__PURE__ */ p.jsxs("div", { className: "relative inline-flex items-center", children: [
    b,
    k
  ] }), e[27] = b, e[28] = k, e[29] = j) : j = e[29], j;
});
Vt.displayName = "Checkbox";
const Kr = {
  hidden: {
    opacity: 0,
    y: 20
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  }
}, Xr = {
  hidden: {
    opacity: 0
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
}, re = {
  hidden: {
    opacity: 0,
    y: 10
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  }
}, Zr = () => {
  const t = W.c(1);
  let r;
  return t[0] === Symbol.for("react.memo_cache_sentinel") ? (r = /* @__PURE__ */ p.jsxs("svg", { className: "h-5 w-5", viewBox: "0 0 24 24", "aria-hidden": "true", children: [
    /* @__PURE__ */ p.jsx("path", { d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z", fill: "#4285F4" }),
    /* @__PURE__ */ p.jsx("path", { d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z", fill: "#34A853" }),
    /* @__PURE__ */ p.jsx("path", { d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z", fill: "#FBBC05" }),
    /* @__PURE__ */ p.jsx("path", { d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z", fill: "#EA4335" })
  ] }), t[0] = r) : r = t[0], r;
}, Qr = () => {
  const t = W.c(1);
  let r;
  return t[0] === Symbol.for("react.memo_cache_sentinel") ? (r = /* @__PURE__ */ p.jsx("svg", { className: "h-5 w-5", fill: "currentColor", viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ p.jsx("path", { fillRule: "evenodd", d: "M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z", clipRule: "evenodd" }) }), t[0] = r) : r = t[0], r;
}, eo = () => {
  const t = W.c(1);
  let r;
  return t[0] === Symbol.for("react.memo_cache_sentinel") ? (r = /* @__PURE__ */ p.jsx("svg", { className: "h-5 w-5", fill: "currentColor", viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ p.jsx("path", { d: "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" }) }), t[0] = r) : r = t[0], r;
}, to = {
  google: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
  github: "bg-[#24292e] text-white hover:bg-[#1b1f23]",
  apple: "bg-black text-white hover:bg-gray-900"
}, ro = {
  google: "Continue with Google",
  github: "Continue with GitHub",
  apple: "Continue with Apple"
}, Wt = P.forwardRef((t, r) => {
  const e = W.c(17), {
    provider: o,
    onClick: n,
    disabled: s
  } = t;
  let i;
  e[0] === Symbol.for("react.memo_cache_sentinel") ? (i = {
    google: Zr,
    github: Qr,
    apple: eo
  }, e[0] = i) : i = e[0];
  const a = i[o], m = to[o];
  let l;
  e[1] !== m ? (l = I("inline-flex w-full items-center justify-center gap-3 rounded-md px-4 py-2.5", "text-sm font-medium", "transition-colors", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "focus-visible:ring-offset-2 focus-visible:ring-offset-background", "disabled:pointer-events-none disabled:opacity-50", m), e[1] = m, e[2] = l) : l = e[2];
  let u, f, d;
  e[3] === Symbol.for("react.memo_cache_sentinel") ? (u = {
    scale: 1.01,
    y: -1
  }, f = {
    scale: 0.99
  }, d = {
    type: "spring",
    stiffness: 400,
    damping: 17
  }, e[3] = u, e[4] = f, e[5] = d) : (u = e[3], f = e[4], d = e[5]);
  let g;
  e[6] !== a ? (g = /* @__PURE__ */ p.jsx(a, {}), e[6] = a, e[7] = g) : g = e[7];
  const v = ro[o];
  let h;
  e[8] !== v ? (h = /* @__PURE__ */ p.jsx("span", { children: v }), e[8] = v, e[9] = h) : h = e[9];
  let b;
  return e[10] !== s || e[11] !== n || e[12] !== r || e[13] !== l || e[14] !== g || e[15] !== h ? (b = /* @__PURE__ */ p.jsxs(V.button, { ref: r, type: "button", onClick: n, disabled: s, className: l, whileHover: u, whileTap: f, transition: d, children: [
    g,
    h
  ] }), e[10] = s, e[11] = n, e[12] = r, e[13] = l, e[14] = g, e[15] = h, e[16] = b) : b = e[16], b;
});
Wt.displayName = "SocialAuthButton";
const oo = (t) => {
  const r = W.c(3), {
    children: e
  } = t;
  let o;
  r[0] === Symbol.for("react.memo_cache_sentinel") ? (o = /* @__PURE__ */ p.jsx("div", { className: "absolute inset-0 flex items-center", children: /* @__PURE__ */ p.jsx("span", { className: "w-full border-t border-border" }) }), r[0] = o) : o = r[0];
  let n;
  return r[1] !== e ? (n = /* @__PURE__ */ p.jsxs("div", { className: "relative", children: [
    o,
    /* @__PURE__ */ p.jsx("div", { className: "relative flex justify-center text-xs uppercase", children: /* @__PURE__ */ p.jsx("span", { className: "bg-card px-2 text-muted-foreground", children: e }) })
  ] }), r[1] = e, r[2] = n) : n = r[2], n;
}, no = P.forwardRef((t, r) => {
  const e = W.c(94), {
    onSubmit: o,
    onSocialAuth: n,
    onForgotPassword: s,
    onSignUp: i,
    isLoading: a,
    error: m,
    showRememberMe: l,
    showSocialAuth: u,
    socialProviders: f,
    title: d,
    subtitle: g,
    className: v
  } = t, h = a === void 0 ? !1 : a, b = l === void 0 ? !0 : l, x = u === void 0 ? !0 : u;
  let y;
  e[0] !== f ? (y = f === void 0 ? ["google", "github", "apple"] : f, e[0] = f, e[1] = y) : y = e[1];
  const S = y, k = d === void 0 ? "Welcome back" : d, j = g === void 0 ? "Sign in to your account" : g, [_, N] = P.useState(""), [$, O] = P.useState(""), [M, oe] = P.useState(!1), [E, ne] = P.useState(!1), B = P.useId(), L = P.useId(), H = P.useId(), U = P.useId();
  let q;
  e[2] !== _ || e[3] !== o || e[4] !== $ || e[5] !== M ? (q = async (X) => {
    X.preventDefault(), await (o == null ? void 0 : o({
      email: _,
      password: $,
      rememberMe: M
    }));
  }, e[2] = _, e[3] = o, e[4] = $, e[5] = M, e[6] = q) : q = e[6];
  const G = q;
  let D;
  e[7] !== v ? (D = I("w-full max-w-md mx-auto", "rounded-xl border border-border bg-card p-6 sm:p-8", "shadow-lg", v), e[7] = v, e[8] = D) : D = e[8];
  let c;
  e[9] !== k ? (c = /* @__PURE__ */ p.jsx("h1", { className: "text-2xl font-semibold tracking-tight text-foreground", children: k }), e[9] = k, e[10] = c) : c = e[10];
  let w;
  e[11] !== j ? (w = /* @__PURE__ */ p.jsx("p", { className: "text-sm text-muted-foreground", children: j }), e[11] = j, e[12] = w) : w = e[12];
  let R;
  e[13] !== c || e[14] !== w ? (R = /* @__PURE__ */ p.jsxs(V.div, { className: "space-y-2 text-center", variants: re, children: [
    c,
    w
  ] }), e[13] = c, e[14] = w, e[15] = R) : R = e[15];
  let T;
  e[16] !== m || e[17] !== U ? (T = m && /* @__PURE__ */ p.jsxs(V.div, { initial: {
    opacity: 0,
    y: -10
  }, animate: {
    opacity: 1,
    y: 0
  }, exit: {
    opacity: 0,
    y: -10
  }, id: U, role: "alert", className: I("flex items-center gap-2 rounded-md p-3", "bg-destructive/10 text-destructive text-sm"), children: [
    /* @__PURE__ */ p.jsx(Gr, { className: "h-4 w-4 shrink-0" }),
    /* @__PURE__ */ p.jsx("span", { children: m })
  ] }), e[16] = m, e[17] = U, e[18] = T) : T = e[18];
  let Y;
  e[19] !== T ? (Y = /* @__PURE__ */ p.jsx(Zt, { mode: "wait", children: T }), e[19] = T, e[20] = Y) : Y = e[20];
  let K;
  e[21] !== h || e[22] !== n || e[23] !== x || e[24] !== S ? (K = x && S.length > 0 && /* @__PURE__ */ p.jsxs(p.Fragment, { children: [
    /* @__PURE__ */ p.jsx(V.div, { className: "space-y-3", variants: re, children: S.map((X) => /* @__PURE__ */ p.jsx(Wt, { provider: X, onClick: () => n == null ? void 0 : n(X), disabled: h }, X)) }),
    /* @__PURE__ */ p.jsx(V.div, { variants: re, children: /* @__PURE__ */ p.jsx(oo, { children: "or continue with email" }) })
  ] }), e[21] = h, e[22] = n, e[23] = x, e[24] = S, e[25] = K) : K = e[25];
  let A;
  e[26] !== B ? (A = /* @__PURE__ */ p.jsx(Me, { htmlFor: B, required: !0, children: "Email address" }), e[26] = B, e[27] = A) : A = e[27];
  let J;
  e[28] === Symbol.for("react.memo_cache_sentinel") ? (J = (X) => N(X.target.value), e[28] = J) : J = e[28];
  const se = m ? U : void 0;
  let ie;
  e[29] === Symbol.for("react.memo_cache_sentinel") ? (ie = /* @__PURE__ */ p.jsx(Yr, { className: "h-4 w-4" }), e[29] = ie) : ie = e[29];
  let ae;
  e[30] !== _ || e[31] !== B || e[32] !== h || e[33] !== se ? (ae = /* @__PURE__ */ p.jsx(tt, { id: B, type: "email", placeholder: "name@example.com", value: _, onChange: J, disabled: h, required: !0, autoComplete: "email", "aria-describedby": se, leftElement: ie }), e[30] = _, e[31] = B, e[32] = h, e[33] = se, e[34] = ae) : ae = e[34];
  let le;
  e[35] !== A || e[36] !== ae ? (le = /* @__PURE__ */ p.jsxs(V.div, { className: "space-y-2", variants: re, children: [
    A,
    ae
  ] }), e[35] = A, e[36] = ae, e[37] = le) : le = e[37];
  let ce;
  e[38] !== L ? (ce = /* @__PURE__ */ p.jsx(Me, { htmlFor: L, required: !0, children: "Password" }), e[38] = L, e[39] = ce) : ce = e[39];
  let de;
  e[40] !== h || e[41] !== s ? (de = s && /* @__PURE__ */ p.jsx("button", { type: "button", onClick: s, className: I("text-sm font-medium text-primary", "hover:text-primary/80 hover:underline", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "focus-visible:ring-offset-2 focus-visible:ring-offset-background", "rounded-sm"), tabIndex: h ? -1 : 0, children: "Forgot password?" }), e[40] = h, e[41] = s, e[42] = de) : de = e[42];
  let ue;
  e[43] !== ce || e[44] !== de ? (ue = /* @__PURE__ */ p.jsxs("div", { className: "flex items-center justify-between", children: [
    ce,
    de
  ] }), e[43] = ce, e[44] = de, e[45] = ue) : ue = e[45];
  const Ge = E ? "text" : "password";
  let Te;
  e[46] === Symbol.for("react.memo_cache_sentinel") ? (Te = (X) => O(X.target.value), e[46] = Te) : Te = e[46];
  const De = m ? U : void 0;
  let Ae;
  e[47] === Symbol.for("react.memo_cache_sentinel") ? (Ae = /* @__PURE__ */ p.jsx(qr, { className: "h-4 w-4" }), e[47] = Ae) : Ae = e[47];
  let me;
  e[48] !== E ? (me = () => ne(!E), e[48] = E, e[49] = me) : me = e[49];
  let ze;
  e[50] === Symbol.for("react.memo_cache_sentinel") ? (ze = I("text-muted-foreground hover:text-foreground", "focus-visible:outline-none focus-visible:text-foreground", "transition-colors"), e[50] = ze) : ze = e[50];
  const Ue = h ? -1 : 0, qe = E ? "Hide password" : "Show password";
  let fe;
  e[51] !== E ? (fe = E ? /* @__PURE__ */ p.jsx(Dr, { className: "h-4 w-4" }) : /* @__PURE__ */ p.jsx(Ur, { className: "h-4 w-4" }), e[51] = E, e[52] = fe) : fe = e[52];
  let pe;
  e[53] !== me || e[54] !== Ue || e[55] !== qe || e[56] !== fe ? (pe = /* @__PURE__ */ p.jsx("button", { type: "button", onClick: me, className: ze, tabIndex: Ue, "aria-label": qe, children: fe }), e[53] = me, e[54] = Ue, e[55] = qe, e[56] = fe, e[57] = pe) : pe = e[57];
  let he;
  e[58] !== h || e[59] !== $ || e[60] !== L || e[61] !== Ge || e[62] !== De || e[63] !== pe ? (he = /* @__PURE__ */ p.jsx(tt, { id: L, type: Ge, placeholder: "Enter your password", value: $, onChange: Te, disabled: h, required: !0, autoComplete: "current-password", "aria-describedby": De, leftElement: Ae, rightElement: pe }), e[58] = h, e[59] = $, e[60] = L, e[61] = Ge, e[62] = De, e[63] = pe, e[64] = he) : he = e[64];
  let ge;
  e[65] !== ue || e[66] !== he ? (ge = /* @__PURE__ */ p.jsxs(V.div, { className: "space-y-2", variants: re, children: [
    ue,
    he
  ] }), e[65] = ue, e[66] = he, e[67] = ge) : ge = e[67];
  let be;
  e[68] !== h || e[69] !== M || e[70] !== H || e[71] !== b ? (be = b && /* @__PURE__ */ p.jsxs(V.div, { className: "flex items-center gap-2", variants: re, children: [
    /* @__PURE__ */ p.jsx(Vt, { id: H, checked: M, onCheckedChange: oe, disabled: h }),
    /* @__PURE__ */ p.jsx(Me, { htmlFor: H, variant: "muted", className: "cursor-pointer font-normal", children: "Remember me for 30 days" })
  ] }), e[68] = h, e[69] = M, e[70] = H, e[71] = b, e[72] = be) : be = e[72];
  const Ye = h ? "Signing in..." : "Sign in";
  let ve;
  e[73] !== h || e[74] !== Ye ? (ve = /* @__PURE__ */ p.jsx(V.div, { variants: re, children: /* @__PURE__ */ p.jsx(Bt, { type: "submit", className: "w-full", isLoading: h, disabled: h, children: Ye }) }), e[73] = h, e[74] = Ye, e[75] = ve) : ve = e[75];
  let ye;
  e[76] !== h || e[77] !== i ? (ye = i && /* @__PURE__ */ p.jsxs(V.p, { className: "text-center text-sm text-muted-foreground", variants: re, children: [
    "Don't have an account?",
    " ",
    /* @__PURE__ */ p.jsx("button", { type: "button", onClick: i, className: I("font-medium text-primary", "hover:text-primary/80 hover:underline", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "focus-visible:ring-offset-2 focus-visible:ring-offset-background", "rounded-sm"), tabIndex: h ? -1 : 0, children: "Sign up" })
  ] }), e[76] = h, e[77] = i, e[78] = ye) : ye = e[78];
  let xe;
  e[79] !== G || e[80] !== h || e[81] !== r || e[82] !== R || e[83] !== Y || e[84] !== K || e[85] !== le || e[86] !== ge || e[87] !== be || e[88] !== ve || e[89] !== ye ? (xe = /* @__PURE__ */ p.jsxs(V.form, { ref: r, onSubmit: G, className: "space-y-6", variants: Xr, initial: "hidden", animate: "visible", "aria-busy": h, children: [
    R,
    Y,
    K,
    le,
    ge,
    be,
    ve,
    ye
  ] }), e[79] = G, e[80] = h, e[81] = r, e[82] = R, e[83] = Y, e[84] = K, e[85] = le, e[86] = ge, e[87] = be, e[88] = ve, e[89] = ye, e[90] = xe) : xe = e[90];
  let Fe;
  return e[91] !== xe || e[92] !== D ? (Fe = /* @__PURE__ */ p.jsx(V.div, { className: D, variants: Kr, initial: "hidden", animate: "visible", children: xe }), e[91] = xe, e[92] = D, e[93] = Fe) : Fe = e[93], Fe;
});
no.displayName = "LoginForm";
const Qo = {
  50: "hsl(210 40% 98%)",
  100: "hsl(210 40% 96%)",
  200: "hsl(214 32% 91%)",
  300: "hsl(213 27% 84%)",
  400: "hsl(215 20% 65%)",
  500: "hsl(215 16% 47%)",
  600: "hsl(215 19% 35%)",
  700: "hsl(215 25% 27%)",
  800: "hsl(217 33% 17%)",
  900: "hsl(222 47% 11%)",
  950: "hsl(229 84% 5%)"
}, en = {
  50: "hsl(0 0% 98%)",
  100: "hsl(240 5% 96%)",
  200: "hsl(240 6% 90%)",
  300: "hsl(240 5% 84%)",
  400: "hsl(240 5% 65%)",
  500: "hsl(240 4% 46%)",
  600: "hsl(240 5% 34%)",
  700: "hsl(240 5% 26%)",
  800: "hsl(240 4% 16%)",
  900: "hsl(240 6% 10%)",
  950: "hsl(240 10% 4%)"
}, tn = {
  50: "hsl(0 0% 98%)",
  100: "hsl(0 0% 96%)",
  200: "hsl(0 0% 90%)",
  300: "hsl(0 0% 83%)",
  400: "hsl(0 0% 64%)",
  500: "hsl(0 0% 45%)",
  600: "hsl(0 0% 32%)",
  700: "hsl(0 0% 25%)",
  800: "hsl(0 0% 15%)",
  900: "hsl(0 0% 9%)",
  950: "hsl(0 0% 4%)"
}, Le = {
  background: "hsl(0 0% 100%)",
  foreground: "hsl(222 47% 11%)",
  card: "hsl(0 0% 100%)",
  cardForeground: "hsl(222 47% 11%)",
  popover: "hsl(0 0% 100%)",
  popoverForeground: "hsl(222 47% 11%)",
  primary: "hsl(222 47% 11%)",
  primaryForeground: "hsl(210 40% 98%)",
  secondary: "hsl(210 40% 96%)",
  secondaryForeground: "hsl(222 47% 11%)",
  muted: "hsl(210 40% 96%)",
  mutedForeground: "hsl(215 16% 47%)",
  accent: "hsl(210 40% 96%)",
  accentForeground: "hsl(222 47% 11%)",
  destructive: "hsl(0 84% 60%)",
  destructiveForeground: "hsl(210 40% 98%)",
  border: "hsl(214 32% 91%)",
  input: "hsl(214 32% 91%)",
  ring: "hsl(222 47% 11%)"
}, Re = {
  background: "hsl(222 47% 11%)",
  foreground: "hsl(210 40% 98%)",
  card: "hsl(222 47% 11%)",
  cardForeground: "hsl(210 40% 98%)",
  popover: "hsl(222 47% 11%)",
  popoverForeground: "hsl(210 40% 98%)",
  primary: "hsl(210 40% 98%)",
  primaryForeground: "hsl(222 47% 11%)",
  secondary: "hsl(217 33% 17%)",
  secondaryForeground: "hsl(210 40% 98%)",
  muted: "hsl(217 33% 17%)",
  mutedForeground: "hsl(215 20% 65%)",
  accent: "hsl(217 33% 17%)",
  accentForeground: "hsl(210 40% 98%)",
  destructive: "hsl(0 62% 30%)",
  destructiveForeground: "hsl(210 40% 98%)",
  border: "hsl(217 33% 17%)",
  input: "hsl(217 33% 17%)",
  ring: "hsl(212 95% 68%)"
}, so = {
  ...Le,
  primary: "hsl(221 83% 53%)",
  primaryForeground: "hsl(0 0% 100%)",
  ring: "hsl(221 83% 53%)"
}, io = {
  ...Re,
  primary: "hsl(217 91% 60%)",
  primaryForeground: "hsl(222 47% 11%)",
  ring: "hsl(217 91% 60%)"
}, ao = {
  ...Le,
  primary: "hsl(142 71% 45%)",
  primaryForeground: "hsl(0 0% 100%)",
  ring: "hsl(142 71% 45%)"
}, lo = {
  ...Le,
  primary: "hsl(262 83% 58%)",
  primaryForeground: "hsl(0 0% 100%)",
  ring: "hsl(262 83% 58%)"
}, co = {
  px: "1px",
  0: "0px",
  0.5: "0.125rem",
  // 2px
  1: "0.25rem",
  // 4px
  1.5: "0.375rem",
  // 6px
  2: "0.5rem",
  // 8px
  2.5: "0.625rem",
  // 10px
  3: "0.75rem",
  // 12px
  3.5: "0.875rem",
  // 14px
  4: "1rem",
  // 16px
  5: "1.25rem",
  // 20px
  6: "1.5rem",
  // 24px
  7: "1.75rem",
  // 28px
  8: "2rem",
  // 32px
  9: "2.25rem",
  // 36px
  10: "2.5rem",
  // 40px
  11: "2.75rem",
  // 44px
  12: "3rem",
  // 48px
  14: "3.5rem",
  // 56px
  16: "4rem",
  // 64px
  20: "5rem",
  // 80px
  24: "6rem",
  // 96px
  28: "7rem",
  // 112px
  32: "8rem",
  // 128px
  36: "9rem",
  // 144px
  40: "10rem",
  // 160px
  44: "11rem",
  // 176px
  48: "12rem",
  // 192px
  52: "13rem",
  // 208px
  56: "14rem",
  // 224px
  60: "15rem",
  // 240px
  64: "16rem",
  // 256px
  72: "18rem",
  // 288px
  80: "20rem",
  // 320px
  96: "24rem"
  // 384px
}, uo = {
  xs: {
    fontSize: "0.75rem",
    lineHeight: "1rem"
  },
  sm: {
    fontSize: "0.875rem",
    lineHeight: "1.25rem"
  },
  base: {
    fontSize: "1rem",
    lineHeight: "1.5rem"
  },
  lg: {
    fontSize: "1.125rem",
    lineHeight: "1.75rem"
  },
  xl: {
    fontSize: "1.25rem",
    lineHeight: "1.75rem"
  },
  "2xl": {
    fontSize: "1.5rem",
    lineHeight: "2rem"
  },
  "3xl": {
    fontSize: "1.875rem",
    lineHeight: "2.25rem"
  },
  "4xl": {
    fontSize: "2.25rem",
    lineHeight: "2.5rem"
  },
  "5xl": {
    fontSize: "3rem",
    lineHeight: "1"
  },
  "6xl": {
    fontSize: "3.75rem",
    lineHeight: "1"
  },
  "7xl": {
    fontSize: "4.5rem",
    lineHeight: "1"
  },
  "8xl": {
    fontSize: "6rem",
    lineHeight: "1"
  },
  "9xl": {
    fontSize: "8rem",
    lineHeight: "1"
  }
}, mo = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900
}, fo = {
  none: "0px",
  sm: "0.125rem",
  // 2px
  default: "0.25rem",
  // 4px
  md: "0.375rem",
  // 6px
  lg: "0.5rem",
  // 8px
  xl: "0.75rem",
  // 12px
  "2xl": "1rem",
  // 16px
  "3xl": "1.5rem",
  // 24px
  full: "9999px"
}, po = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  default: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
  none: "0 0 #0000"
}, F = {
  colors: Le,
  spacing: co,
  typography: uo,
  fontWeight: mo,
  fontFamily: {
    sans: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  },
  radius: fo,
  shadow: po,
  duration: {
    75: "75ms",
    100: "100ms",
    150: "150ms",
    200: "200ms",
    300: "300ms",
    500: "500ms",
    700: "700ms",
    1e3: "1000ms"
  },
  easing: {
    linear: "linear",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)"
  },
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px"
  },
  zIndex: {
    0: 0,
    10: 10,
    20: 20,
    30: 30,
    40: 40,
    50: 50,
    auto: "auto"
  }
}, Ve = {
  name: "default",
  light: F,
  dark: Re,
  defaultMode: "system",
  darkModeClass: "dark",
  useColorScheme: !0
}, Ht = {
  name: "blue",
  light: {
    ...F,
    colors: so
  },
  dark: io,
  defaultMode: "system",
  darkModeClass: "dark",
  useColorScheme: !0
}, Gt = {
  name: "green",
  light: {
    ...F,
    colors: ao
  },
  dark: {
    ...Re,
    primary: "hsl(142 71% 45%)",
    primaryForeground: "hsl(0 0% 100%)",
    ring: "hsl(142 71% 45%)"
  },
  defaultMode: "system",
  darkModeClass: "dark",
  useColorScheme: !0
}, Dt = {
  name: "violet",
  light: {
    ...F,
    colors: lo
  },
  dark: {
    ...Re,
    primary: "hsl(263 70% 50%)",
    primaryForeground: "hsl(0 0% 100%)",
    ring: "hsl(263 70% 50%)"
  },
  defaultMode: "system",
  darkModeClass: "dark",
  useColorScheme: !0
};
function ho(t) {
  switch (t.toLowerCase()) {
    case "blue":
      return Ht;
    case "green":
      return Gt;
    case "violet":
    case "purple":
      return Dt;
    default:
      return Ve;
  }
}
function Ut() {
  return ["default", "blue", "green", "violet"];
}
const go = 1e4, rt = /* @__PURE__ */ new Map();
let Q = "idle", Ie = null, ot = null;
function bo() {
  return Q === "error" && ot !== null;
}
function vo() {
  return Q === "loading";
}
const nt = /* @__PURE__ */ new Set();
function Ze() {
  nt.forEach((t) => t());
}
function yo(t) {
  return nt.add(t), () => nt.delete(t);
}
function st() {
  const t = Ie;
  return {
    name: (t == null ? void 0 : t.meta.name) ?? null,
    version: (t == null ? void 0 : t.meta.version) ?? null,
    isLoaded: Q === "loaded" && t !== null,
    isLoading: Q === "loading",
    status: Q,
    brandKit: t
  };
}
({
  ...st()
});
async function St(t, r = {}) {
  const {
    timeout: e = go,
    throwOnError: o = !1
  } = r, n = rt.get(t);
  if (n)
    return {
      status: "loaded",
      brandKit: n.brandKit,
      tokens: it(n.brandKit),
      themeConfig: jt(n.brandKit)
    };
  Q = "loading", Ze();
  try {
    const s = new Promise((l, u) => {
      setTimeout(() => {
        u(new Error(`Brand kit loading timed out after ${e}ms`));
      }, e);
    }), i = xo(t), a = await Promise.race([i, s]), m = No(a);
    if (m)
      throw new Error(m);
    return rt.set(t, {
      brandKit: a,
      version: a.meta.version,
      cachedAt: Date.now()
    }), Q = "loaded", Ie = a, ot = null, Ze(), {
      status: "loaded",
      brandKit: a,
      tokens: it(a),
      themeConfig: jt(a)
    };
  } catch (s) {
    const i = s instanceof Error ? s.message : "Unknown error loading brand kit";
    if (Q = "error", Ie = null, ot = i, Ze(), o)
      throw s;
    return console.error(`[brand-loader] Failed to load brand kit: ${i}`), console.error("[brand-loader] Falling back to default theme"), {
      status: "error",
      brandKit: null,
      tokens: null,
      themeConfig: Ve,
      error: i
    };
  }
}
async function xo(t) {
  const r = await import(
    /* @vite-ignore */
    t
  );
  return r.default || r.brandKit || r;
}
function rn(t) {
  return !t || typeof t != "string" ? !1 : t.startsWith("./") || t.startsWith("../") || t.startsWith("/") ? !0 : t.startsWith("@") ? /^@[\w-]+\/[\w-]+/.test(t) : /^[\w-]+/.test(t);
}
function wo(t) {
  var r, e, o;
  return {
    // Colors from brand kit semantics (required field)
    colors: ko(t.semantics.light),
    // Spacing: use brand kit's or fall back to defaults
    spacing: Co(t.spacing),
    // Typography: extract fontSize from brand kit's typography
    typography: So((r = t.typography) == null ? void 0 : r.fontSize),
    // Font weights: extract from brand kit's typography
    fontWeight: jo((e = t.typography) == null ? void 0 : e.fontWeight),
    // Font families: extract from brand kit's typography
    fontFamily: Eo((o = t.typography) == null ? void 0 : o.fontFamily),
    // Border radius: use brand kit's or fall back to defaults
    radius: _o(t.radius),
    // Shadows: use brand kit's or fall back to defaults
    shadow: Ro(t.shadow),
    // Animation durations: always use platform defaults
    // (brand kits typically don't customize these)
    duration: F.duration,
    // Easing functions: always use platform defaults
    easing: F.easing,
    // Breakpoints: always use platform defaults
    // (responsive design should be consistent)
    breakpoints: F.breakpoints,
    // Z-index: always use platform defaults
    // (stacking context should be consistent)
    zIndex: F.zIndex
  };
}
function it(t) {
  return wo(t);
}
function ko(t) {
  const r = F.colors;
  return {
    primary: t.primary || r.primary,
    primaryForeground: t.primaryForeground || r.primaryForeground,
    secondary: t.secondary || r.secondary,
    secondaryForeground: t.secondaryForeground || r.secondaryForeground,
    muted: t.muted || r.muted,
    mutedForeground: t.mutedForeground || r.mutedForeground,
    accent: t.accent || r.accent,
    accentForeground: t.accentForeground || r.accentForeground,
    destructive: t.destructive || r.destructive,
    destructiveForeground: t.destructiveForeground || r.destructiveForeground,
    background: t.background || r.background,
    foreground: t.foreground || r.foreground,
    card: t.card || r.card,
    cardForeground: t.cardForeground || r.cardForeground,
    popover: t.popover || r.popover,
    popoverForeground: t.popoverForeground || r.popoverForeground,
    border: t.border || r.border,
    input: t.input || r.input,
    ring: t.ring || r.ring
  };
}
function Co(t) {
  return t ? {
    ...F.spacing,
    ...t
  } : F.spacing;
}
function So(t) {
  return t ? {
    ...F.typography,
    ...t
  } : F.typography;
}
function jo(t) {
  return t ? {
    ...F.fontWeight,
    ...t
  } : F.fontWeight;
}
function Eo(t) {
  return t ? {
    ...F.fontFamily,
    ...t
  } : F.fontFamily;
}
function _o(t) {
  return t ? {
    ...F.radius,
    ...t
  } : F.radius;
}
function Ro(t) {
  return t ? {
    ...F.shadow,
    ...t
  } : F.shadow;
}
function on(t, r) {
  return {
    colors: {
      ...t.colors,
      ...r.colors || {}
    },
    spacing: {
      ...t.spacing,
      ...r.spacing || {}
    },
    typography: {
      ...t.typography,
      ...r.typography || {}
    },
    fontWeight: {
      ...t.fontWeight,
      ...r.fontWeight || {}
    },
    fontFamily: {
      ...t.fontFamily,
      ...r.fontFamily || {}
    },
    radius: {
      ...t.radius,
      ...r.radius || {}
    },
    shadow: {
      ...t.shadow,
      ...r.shadow || {}
    },
    duration: {
      ...t.duration,
      ...r.duration || {}
    },
    easing: {
      ...t.easing,
      ...r.easing || {}
    },
    breakpoints: {
      ...t.breakpoints,
      ...r.breakpoints || {}
    },
    zIndex: {
      ...t.zIndex,
      ...r.zIndex || {}
    }
  };
}
function jt(t) {
  return {
    name: t.meta.name,
    light: it(t),
    dark: t.semantics.dark,
    defaultMode: "system",
    darkModeClass: "dark",
    useColorScheme: !0
  };
}
function No(t) {
  return To(t).errors[0];
}
function To(t) {
  const r = [], e = [], o = [], n = [];
  if (!t || typeof t != "object")
    return r.push("Brand kit must be an object"), {
      valid: !1,
      errors: r,
      warnings: e,
      missingRequired: o,
      missingOptional: n
    };
  const s = t;
  if (!s.meta || typeof s.meta != "object")
    r.push("Brand kit must export 'meta' object"), o.push("meta");
  else {
    const i = s.meta;
    (typeof i.name != "string" || !i.name) && (r.push("meta.name is required and must be a non-empty string"), o.push("meta.name")), typeof i.version != "string" || !i.version ? (r.push("meta.version is required and must be a non-empty string"), o.push("meta.version")) : /^\d+\.\d+\.\d+/.test(i.version) || e.push("meta.version should follow semver format (e.g., '1.0.0')"), i.description === void 0 && n.push("meta.description"), i.author === void 0 && n.push("meta.author");
  }
  if (!s.primitives || typeof s.primitives != "object")
    r.push("Brand kit must export 'primitives' object with color scales"), o.push("primitives");
  else {
    const i = s.primitives;
    for (const a of ["primary", "accent", "neutral"])
      if (!i[a] || typeof i[a] != "object")
        r.push(`primitives.${a} is required (12-step color scale)`), o.push(`primitives.${a}`);
      else {
        const m = i[a], l = Object.keys(m).map(Number).filter((u) => !isNaN(u));
        l.length < 12 && e.push(`primitives.${a} has ${l.length} steps (recommended: 12)`);
      }
  }
  if (!s.semantics || typeof s.semantics != "object")
    r.push("Brand kit must export 'semantics' object with light/dark colors"), o.push("semantics");
  else {
    const i = s.semantics;
    !i.light || typeof i.light != "object" ? (r.push("semantics.light is required"), o.push("semantics.light")) : Et(i.light, "light", e), !i.dark || typeof i.dark != "object" ? (r.push("semantics.dark is required"), o.push("semantics.dark")) : Et(i.dark, "dark", e);
  }
  return s.typography === void 0 && n.push("typography"), s.spacing === void 0 && n.push("spacing"), s.radius === void 0 && n.push("radius"), s.shadow === void 0 && n.push("shadow"), s.tailwindPreset === void 0 && n.push("tailwindPreset"), s.css === void 0 && n.push("css"), {
    valid: r.length === 0,
    errors: r,
    warnings: e,
    missingRequired: o,
    missingOptional: n
  };
}
function Et(t, r, e) {
  const o = ["background", "foreground", "primary", "primaryForeground", "secondary", "secondaryForeground", "muted", "mutedForeground", "accent", "accentForeground", "destructive", "destructiveForeground", "border", "input", "ring"];
  for (const n of o)
    if (t[n] === void 0)
      e.push(`semantics.${r}.${n} is recommended for full compatibility`);
    else if (typeof t[n] == "string") {
      const s = zo(t[n]);
      s.valid || e.push(`semantics.${r}.${n}: ${s.reason}`);
    }
}
const Ao = [/expression\s*\(/i, /javascript\s*:/i, /-moz-binding\s*:/i, /behavior\s*:/i, /\burl\s*\(\s*["']?\s*javascript:/i, /\burl\s*\(\s*["']?\s*data:\s*text\/html/i];
function zo(t) {
  if (typeof t != "string")
    return {
      valid: !1,
      reason: "CSS value must be a string"
    };
  for (const r of Ao)
    if (r.test(t))
      return {
        valid: !1,
        reason: "Potentially dangerous CSS pattern detected. CSS values cannot contain expressions, javascript:, or other executable content."
      };
  return {
    valid: !0
  };
}
function Fo() {
  rt.clear(), Q = "idle", Ie = null;
}
const We = Kt(null);
function $o(t) {
  const r = W.c(19), {
    children: e,
    brandPackage: o,
    loading: n,
    fallback: s,
    throwOnError: i
  } = t, a = i === void 0 ? !1 : i, [m, l] = ut(st), [u, f] = ut(null);
  let d, g;
  r[0] === Symbol.for("react.memo_cache_sentinel") ? (d = () => yo(() => {
    l(st());
  }), g = [], r[0] = d, r[1] = g) : (d = r[0], g = r[1]), mt(d, g);
  let v, h;
  r[2] !== o || r[3] !== a ? (v = () => {
    o && (f(null), St(o).catch((N) => {
      const $ = N instanceof Error ? N : new Error(String(N));
      if (f($), a)
        throw $;
    }));
  }, h = [o, a], r[2] = o, r[3] = a, r[4] = v, r[5] = h) : (v = r[4], h = r[5]), mt(v, h);
  let b;
  r[6] !== a ? (b = async (N) => {
    f(null);
    try {
      await St(N);
    } catch ($) {
      const O = $, M = O instanceof Error ? O : new Error(String(O));
      if (f(M), a)
        throw M;
    }
  }, r[6] = a, r[7] = b) : b = r[7];
  const x = b;
  let y;
  r[8] === Symbol.for("react.memo_cache_sentinel") ? (y = () => {
    Fo(), f(null);
  }, r[8] = y) : y = r[8];
  const S = y;
  let k;
  r[9] !== x || r[10] !== m ? (k = {
    ...m,
    loadBrand: x,
    clearBrand: S
  }, r[9] = x, r[10] = m, r[11] = k) : k = r[11];
  const j = k;
  if (vo() && n) {
    let N;
    return r[12] !== n ? (N = /* @__PURE__ */ p.jsx(p.Fragment, { children: n }), r[12] = n, r[13] = N) : N = r[13], N;
  }
  if ((bo() || u) && s) {
    let N;
    return r[14] !== s ? (N = /* @__PURE__ */ p.jsx(p.Fragment, { children: s }), r[14] = s, r[15] = N) : N = r[15], N;
  }
  let _;
  return r[16] !== e || r[17] !== j ? (_ = /* @__PURE__ */ p.jsx(We.Provider, { value: j, children: e }), r[16] = e, r[17] = j, r[18] = _) : _ = r[18], _;
}
$o.displayName = "BrandProvider";
function nn() {
  const t = lt(We);
  if (!t)
    throw new Error("useBrandContext must be used within a BrandProvider. Wrap your app with <BrandProvider> at the root level.");
  return t;
}
function sn() {
  return lt(We) !== null;
}
function an() {
  return lt(We) ?? void 0;
}
function He(t) {
  const r = t.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%(?:\s*\/\s*([\d.]+))?\)/);
  return r ? { h: parseInt(r[1], 10), s: parseInt(r[2], 10), l: parseInt(r[3], 10), alpha: r[4] ? parseFloat(r[4]) : void 0 } : null;
}
function Ne(t) {
  return t.alpha !== void 0 && t.alpha < 1 ? `hsl(${t.h} ${t.s}% ${t.l}% / ${t.alpha})` : `hsl(${t.h} ${t.s}% ${t.l}%)`;
}
function qt(t) {
  const r = t.l / 100, e = t.s / 100, o = r, n = e * Math.min(r, 1 - r) * 0.4, s = t.h;
  return { l: Math.round(o * 1e3) / 1e3, c: Math.round(n * 1e3) / 1e3, h: s, alpha: t.alpha };
}
function Yt(t) {
  return t.alpha !== void 0 && t.alpha < 1 ? `oklch(${t.l} ${t.c} ${t.h} / ${t.alpha})` : `oklch(${t.l} ${t.c} ${t.h})`;
}
function ln(t, r) {
  const e = He(t);
  if (!e) return t;
  const o = Math.min(100, e.l + r);
  return Ne({ ...e, l: o });
}
function cn(t, r) {
  const e = He(t);
  if (!e) return t;
  const o = Math.max(0, e.l - r);
  return Ne({ ...e, l: o });
}
function dn(t, r) {
  const e = He(t);
  if (!e) return t;
  const o = Math.min(100, Math.max(0, e.s + r));
  return Ne({ ...e, s: o });
}
function un(t) {
  const { baseColor: r, format: e = "hsl" } = t, o = typeof r == "string" ? He(r) : null;
  if (!o)
    return { 50: "hsl(0 0% 98%)", 100: "hsl(0 0% 96%)", 200: "hsl(0 0% 90%)", 300: "hsl(0 0% 83%)", 400: "hsl(0 0% 64%)", 500: "hsl(0 0% 45%)", 600: "hsl(0 0% 32%)", 700: "hsl(0 0% 25%)", 800: "hsl(0 0% 15%)", 900: "hsl(0 0% 9%)", 950: "hsl(0 0% 4%)" };
  const n = [[50, 97], [100, 94], [200, 86], [300, 77], [400, 66], [500, 50], [600, 40], [700, 32], [800, 24], [900, 15], [950, 8]], s = {};
  for (const [i, a] of n) {
    const m = { h: o.h, s: o.s, l: a };
    e === "oklch" ? s[i] = Yt(qt(m)) : s[i] = Ne(m);
  }
  return s;
}
function Po(t) {
  const { hue: r, saturation: e = "medium", useOklch: o = !1 } = t, s = { low: 30, medium: 50, high: 70 }[e], i = (a, m, l) => {
    const u = { h: a, s: m, l };
    return o ? Yt(qt(u)) : Ne(u);
  };
  return { background: i(0, 0, 100), foreground: i(r, s, 10), card: i(0, 0, 100), cardForeground: i(r, s, 10), popover: i(0, 0, 100), popoverForeground: i(r, s, 10), primary: i(r, s + 20, 50), primaryForeground: i(0, 0, 100), secondary: i(r, s - 20, 96), secondaryForeground: i(r, s, 10), muted: i(r, s - 30, 96), mutedForeground: i(r, s - 20, 45), accent: i(r, s - 20, 96), accentForeground: i(r, s, 10), destructive: i(0, 84, 60), destructiveForeground: i(0, 0, 100), border: i(r, s - 30, 90), input: i(r, s - 30, 90), ring: i(r, s + 20, 50) };
}
function Jt(t) {
  return t.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
function dt(t, r = "") {
  const e = {}, o = r ? `${r}-` : "";
  for (const [n, s] of Object.entries(t)) {
    const i = `--${o}${Jt(n)}`;
    e[i] = typeof s == "string" ? s : "";
  }
  return e;
}
function Mo(t, r = ":root") {
  const e = [];
  e.push(`${r} {`);
  const o = dt(t.colors);
  for (const [n, s] of Object.entries(o))
    e.push(`  ${n}: ${s};`);
  return t.radius.lg && e.push(`  --radius: ${t.radius.lg};`), e.push("}"), e.join(`
`);
}
function Io(t, r = ".dark") {
  const e = [];
  e.push(`${r} {`);
  for (const [o, n] of Object.entries(t))
    if (n) {
      const s = `--${Jt(o)}`;
      e.push(`  ${s}: ${typeof n == "string" ? n : ""};`);
    }
  return e.push("}"), e.join(`
`);
}
function Oo(t) {
  const r = [];
  r.push("@theme {"), r.push("  /* Semantic Colors */");
  const e = dt(t.colors);
  for (const [o, n] of Object.entries(e)) {
    const s = o.replace("--", "--color-");
    r.push(`  ${s}: ${n};`);
  }
  r.push(""), r.push("  /* Border Radius */");
  for (const [o, n] of Object.entries(t.radius))
    n && r.push(`  --radius-${o}: ${n};`);
  if (t.shadow) {
    r.push(""), r.push("  /* Shadows */");
    for (const [o, n] of Object.entries(t.shadow))
      if (n) {
        const s = o === "default" ? "DEFAULT" : o;
        r.push(`  --shadow-${s}: ${n};`);
      }
  }
  if (t.fontFamily) {
    r.push(""), r.push("  /* Font Families */");
    for (const [o, n] of Object.entries(t.fontFamily))
      n && r.push(`  --font-${o}: ${n};`);
  }
  return r.push("}"), r.join(`
`);
}
function Bo(t) {
  return `// Theme initialization script
(function() {
  const storageKey = 'theme-mode';
  const darkClass = '${t.darkModeClass || "dark"}';

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  function setTheme(theme) {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark');

    root.classList.toggle(darkClass, isDark);
    ${t.useColorScheme ? "root.style.colorScheme = isDark ? 'dark' : 'light';" : ""}
  }

  // Initialize
  const stored = getStoredTheme();
  const initial = stored || '${t.defaultMode || "system"}';
  setTheme(initial);

  // Listen for system changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!getStoredTheme() || getStoredTheme() === 'system') {
      setTheme('system');
    }
  });

  // Expose API
  window.setTheme = function(theme) {
    try {
      localStorage.setItem(storageKey, theme);
    } catch {}
    setTheme(theme);
  };
})();`;
}
function Lo(t) {
  const r = dt(t.light.colors), e = Mo(t.light), o = Oo(t.light);
  let n;
  t.dark && (n = Io(t.dark, `.${t.darkModeClass || "dark"}`));
  const s = Bo(t);
  return { css: e, tailwindTheme: o, cssVariables: r, darkModeCss: n, jsTheme: s };
}
function mn(t) {
  const r = ho(t);
  return Lo(r);
}
function fn(t, r = {}) {
  const { primaryHue: e = 220, saturation: o = "medium", useOklch: n = !1, darkMode: s = !0 } = r, i = Po({ hue: e, saturation: o, useOklch: n }), a = { name: t, light: { ...F, colors: i }, defaultMode: "system", darkModeClass: "dark", useColorScheme: !0 };
  return s && (a.dark = { ...Re }), a;
}
function pn(t) {
  var e;
  const r = [];
  if (t.name || r.push("Theme name is required"), !((e = t.light) != null && e.colors))
    r.push("Light mode colors are required");
  else {
    const o = ["background", "foreground", "primary", "primaryForeground"];
    for (const n of o)
      t.light.colors[n] || r.push(`Missing required color: ${n}`);
  }
  return { valid: r.length === 0, errors: r };
}
function Vo(t = {}) {
  const { maxEntries: r = 100, ttl: e = 300 * 1e3, trackAccess: o = !1 } = t, n = /* @__PURE__ */ new Map();
  let s = 0, i = 0;
  function a(l) {
    return typeof l == "string" ? l.length * 2 : typeof l == "number" ? 8 : typeof l == "boolean" ? 4 : l == null ? 0 : Array.isArray(l) ? l.reduce((u, f) => u + a(f), 0) : typeof l == "object" ? Object.entries(l).reduce((u, [f, d]) => u + f.length * 2 + a(d), 0) : 0;
  }
  function m() {
    const l = Date.now();
    for (const [u, f] of n.entries())
      l - f.lastAccessed > e && n.delete(u);
    if (n.size > r) {
      const u = Array.from(n.entries());
      u.sort((d, g) => d[1].lastAccessed - g[1].lastAccessed);
      const f = u.slice(0, n.size - r);
      for (const [d] of f)
        n.delete(d);
    }
  }
  return {
    /**
    * Gets a cached value or computes and caches it
    */
    getOrCompute(l, u) {
      const f = Date.now(), d = n.get(l);
      if (d && f - d.lastAccessed <= e)
        return s++, d.lastAccessed = f, o && d.accessCount++, d.value;
      i++;
      const g = u(), v = a(g);
      return n.set(l, { value: g, accessCount: 1, lastAccessed: f, size: v }), m(), g;
    },
    /**
    * Gets a cached value without computing
    */
    get(l) {
      const u = n.get(l);
      if (u && Date.now() - u.lastAccessed <= e)
        return s++, u.lastAccessed = Date.now(), u.value;
      i++;
    },
    /**
    * Sets a value directly in the cache
    */
    set(l, u) {
      n.set(l, { value: u, accessCount: 1, lastAccessed: Date.now(), size: a(u) }), m();
    },
    /**
    * Checks if a key exists and is not expired
    */
    has(l) {
      const u = n.get(l);
      return u !== void 0 && Date.now() - u.lastAccessed <= e;
    },
    /**
    * Removes a specific key from the cache
    */
    delete(l) {
      return n.delete(l);
    },
    /**
    * Clears all cached values
    */
    clear() {
      n.clear(), s = 0, i = 0;
    },
    /**
    * Invalidates entries matching a pattern
    */
    invalidatePattern(l) {
      const u = typeof l == "string" ? new RegExp(l) : l;
      let f = 0;
      for (const d of n.keys())
        u.test(d) && (n.delete(d), f++);
      return f;
    },
    /**
    * Gets cache statistics
    */
    getStats() {
      let l = 0;
      const u = [];
      for (const [f, d] of n.entries())
        l += d.size, o && u.push({ key: f, count: d.accessCount });
      return u.sort((f, d) => d.count - f.count), { hits: s, misses: i, entries: n.size, totalSize: l, hitRatio: s + i > 0 ? s / (s + i) : 0, topKeys: u.slice(0, 10).map((f) => f.key) };
    },
    /**
    * Gets the current cache size
    */
    get size() {
      return n.size;
    }
  };
}
Vo({
  maxEntries: 200,
  ttl: 600 * 1e3,
  // 10 minutes
  trackAccess: !0
});
var Rt;
typeof process < "u" && ((Rt = process.env) == null || Rt.NODE_ENV);
const Oe = Object.freeze(["default", "blue", "green", "violet"]), Wo = {
  theme: {
    preset: "default"
  }
  // brand is NOT specified by default - this is the key to opt-in behavior
};
function hn(t) {
  return t;
}
function gn(t) {
  return t;
}
function bn(t) {
  return Oe.includes(t);
}
function _t(t) {
  switch (t) {
    case "blue":
      return Ht;
    case "green":
      return Gt;
    case "violet":
    case "purple":
      return Dt;
    case "default":
    default:
      return Ve;
  }
}
function vn() {
  return Oe;
}
function yn() {
  return Ut();
}
function Ho() {
  var t;
  return typeof process < "u" && ((t = process.env) != null && t.NODE_ENV) ? process.env.NODE_ENV : "production";
}
function Go(t, r) {
  var e, o, n, s;
  return {
    theme: r.theme ? {
      ...t.theme,
      ...r.theme
    } : t.theme,
    brand: r.brand ? {
      ...t.brand,
      ...r.brand,
      // Deep merge overrides if both exist
      overrides: (e = t.brand) != null && e.overrides || (o = r.brand) != null && o.overrides ? {
        ...(n = t.brand) == null ? void 0 : n.overrides,
        ...(s = r.brand) == null ? void 0 : s.overrides
      } : void 0
    } : t.brand
    // Don't propagate environments to merged config
  };
}
function xn(t, r) {
  var i, a, m, l;
  let e = t ?? Wo;
  if (e.environments) {
    const u = (r == null ? void 0 : r.env) ?? Ho(), f = e.environments[u];
    f && (e = Go(e, f));
  }
  if (!!((i = e.brand) != null && i.package))
    return {
      mode: "brand",
      preset: "default",
      brandPackage: e.brand.package,
      brandOverrides: (a = e.brand) == null ? void 0 : a.overrides,
      themeConfig: Ve
    };
  const n = ((m = e.theme) == null ? void 0 : m.preset) ?? "default", s = (l = e.theme) == null ? void 0 : l.custom;
  return s ? {
    mode: "builtin",
    preset: n,
    custom: s,
    themeConfig: _t(n)
  } : {
    mode: "builtin",
    preset: n,
    themeConfig: _t(n)
  };
}
function wn(t) {
  var s, i, a, m, l, u, f;
  const r = [], e = [];
  if ((s = t.theme) != null && s.preset && ([...Oe, ...Ut()].includes(t.theme.preset) || r.push({
    field: "theme.preset",
    message: `Invalid preset "${t.theme.preset}"`,
    suggestion: `Use one of: ${Oe.join(", ")}`
  })), (i = t.theme) != null && i.custom) {
    const {
      primaryHue: d,
      saturation: g,
      useOklch: v
    } = t.theme.custom;
    d == null ? r.push({
      field: "theme.custom.primaryHue",
      message: "primaryHue is required when using custom theme",
      suggestion: "Add primaryHue: <number between 0-360>"
    }) : typeof d != "number" ? r.push({
      field: "theme.custom.primaryHue",
      message: `Expected number, got ${typeof d}`,
      suggestion: "primaryHue must be a number (e.g., 220 for blue)"
    }) : (d < 0 || d > 360) && r.push({
      field: "theme.custom.primaryHue",
      message: `Value ${d} is out of range`,
      suggestion: "primaryHue must be between 0 and 360 (color wheel degrees)"
    }), g && !["low", "medium", "high"].includes(g) && r.push({
      field: "theme.custom.saturation",
      message: `Invalid saturation "${g}"`,
      suggestion: 'Use "low", "medium", or "high"'
    }), v !== void 0 && typeof v != "boolean" && r.push({
      field: "theme.custom.useOklch",
      message: `Expected boolean, got ${typeof v}`,
      suggestion: "useOklch must be true or false"
    });
  }
  if ((a = t.brand) != null && a.package) {
    const d = t.brand.package;
    typeof d != "string" ? r.push({
      field: "brand.package",
      message: `Expected string, got ${typeof d}`,
      suggestion: 'Use a package name like "@acme/brand-kit" or path like "./my-brand"'
    }) : d.trim() === "" ? r.push({
      field: "brand.package",
      message: "Package name cannot be empty",
      suggestion: "Specify a valid package name or remove the brand.package field"
    }) : !d.startsWith("@") && !d.startsWith(".") && !d.startsWith("/") && d.includes(" ") && r.push({
      field: "brand.package",
      message: "Package name contains spaces",
      suggestion: "Remove spaces from the package name"
    });
  }
  if ((m = t.brand) != null && m.overrides && (typeof t.brand.overrides != "object" || Array.isArray(t.brand.overrides)) && r.push({
    field: "brand.overrides",
    message: "Overrides must be an object",
    suggestion: "Provide an object with token categories like { colors: {...}, spacing: {...} }"
  }), t.environments)
    if (typeof t.environments != "object" || Array.isArray(t.environments))
      r.push({
        field: "environments",
        message: "Environments must be an object",
        suggestion: "Use { development: {...}, staging: {...}, production: {...} }"
      });
    else
      for (const [d, g] of Object.entries(t.environments))
        (typeof g != "object" || g === null) && r.push({
          field: `environments.${d}`,
          message: "Environment config must be an object",
          suggestion: `Set environments.${d} to a partial FrontendConfig`
        }), g && "environments" in g && r.push({
          field: `environments.${d}.environments`,
          message: "Nested environments are not supported",
          suggestion: "Remove the environments field from the environment-specific config"
        });
  t.theme && ((l = t.brand) != null && l.package) && e.push({
    field: "theme + brand.package",
    message: "Both theme and brand.package specified. Brand kit tokens will override theme preset when loaded."
  }), (u = t.theme) != null && u.custom && ((f = t.brand) != null && f.package) && e.push({
    field: "theme.custom",
    message: "Custom theme options will be ignored when using a brand kit"
  });
  const o = r.map((d) => d.suggestion ? `${d.field}: ${d.message}. ${d.suggestion}` : `${d.field}: ${d.message}`), n = e.map((d) => `${d.field}: ${d.message}`);
  return {
    valid: r.length === 0,
    errors: o,
    warnings: n,
    details: r,
    warningDetails: e
  };
}
function Do(t) {
  var r;
  return !!((r = t == null ? void 0 : t.brand) != null && r.package);
}
function kn(t) {
  return !Do(t);
}
function Cn(t) {
  var r;
  return ((r = t == null ? void 0 : t.theme) == null ? void 0 : r.preset) ?? "default";
}
export {
  Bt as AnimatedButton,
  Oe as BUILTIN_PRESETS,
  We as BrandContext,
  $o as BrandProvider,
  Or as Button,
  Vt as Checkbox,
  Wo as DEFAULT_CONFIG,
  tt as Input,
  Me as Label,
  no as LoginForm,
  Wt as SocialAuthButton,
  io as blueDarkColors,
  so as blueLightColors,
  Ht as blueTheme,
  It as buttonVariants,
  Jr as checkboxVariants,
  I as cn,
  fn as createTheme,
  cn as darken,
  Re as defaultDarkColors,
  mo as defaultFontWeight,
  Le as defaultLightColors,
  fo as defaultRadius,
  po as defaultShadow,
  co as defaultSpacing,
  Ve as defaultTheme,
  F as defaultTokens,
  uo as defaultTypography,
  gn as defineBrandKit,
  hn as defineFrontendConfig,
  Zo as delay,
  Jo as formatCompact,
  dt as generateColorVariables,
  Mo as generateCss,
  Io as generateDarkModeCss,
  Ko as generateId,
  un as generatePalette,
  Po as generateSemanticColors,
  Oo as generateTailwindTheme,
  Lo as generateTheme,
  mn as generateThemeFromPreset,
  Bo as generateThemeScript,
  yn as getAllPresetNames,
  vn as getBuiltInPresetNames,
  _t as getBuiltInTheme,
  Cn as getEffectivePreset,
  ho as getThemePreset,
  Ut as getThemePresetNames,
  ao as greenLightColors,
  Gt as greenTheme,
  qt as hslToOklch,
  Ne as hslToString,
  Ct as inputVariants,
  Ar as isBrowser,
  bn as isBuiltInPreset,
  rn as isValidBrandPackageName,
  Br as labelVariants,
  ln as lighten,
  on as mergeDesignTokens,
  tn as neutralPalette,
  wo as normalizeBrandTokens,
  Yt as oklchToString,
  He as parseHsl,
  Xo as prefersReducedMotion,
  xn as resolveConfig,
  dn as saturate,
  Qo as slatePalette,
  nn as useBrandContext,
  an as useBrandContextSafe,
  sn as useHasBrandProvider,
  Do as usesBrandKit,
  kn as usesBuiltInTheme,
  To as validateBrandKit,
  wn as validateConfig,
  pn as validateTheme,
  lo as violetLightColors,
  Dt as violetTheme,
  en as zincPalette
};
