/* ───────── parity check — does the phone mirror the rule the BROWSER applies? ─────────
 *
 * Run:  node mobile/theme/check-parity.mjs          (from the repo root)
 *       node mobile/theme/check-parity.mjs --quiet  (findings only)
 *
 * ★ WHY THIS EXISTS (2026-09-14). In one afternoon the founder caught four separate parity
 * misses on the Expo prepare screen, each costing a round trip through him, and every one was
 * the same mechanical fault: `theme/web.js` mirrors a CSS class, but the value the BROWSER
 * applies to that element is not the one that class declares.
 *
 *   · `.mlp-allocate-btn prepare-cta` — the pine fill and cream label were measured off the
 *     base class; `prepare-cta` is layered on top and owns the colour, the weight, the glow
 *     and the ✦. The button is a clay→ochre gradient and was ported as a pine slab.
 *   · `.ap-kicker prep-scope` — `.prep-scope` (line 938) says `color: var(--ink)`, `.ap-kicker`
 *     (2703) says `var(--ochre)`. Same specificity, so SOURCE ORDER decides and the later one
 *     wins. `.prep-scope`'s colour has never once taken effect; the port read the rule named
 *     after the screen and produced ink.
 *   · `.mlp2-vtab` and friends had their ≤600px sizes in a block placed BEFORE the base rules,
 *     where they were dead — the title row rendered at desktop size on every phone for months.
 *
 * All three are the same question — "which rule wins?" — and a human answers it by reading, which
 * is why it keeps going wrong. This answers it mechanically.
 *
 * ⚠️ WHAT THIS IS NOT. It is not a renderer and it does not compute layout. It resolves the
 * cascade for the properties a port actually copies (face, size, tracking, case, colour) and
 * reports disagreement. A clean run does not mean the screens match — only that the values the
 * port claims to mirror are the values that win. The parity page is still the eye.
 *
 * TWO CHECKS:
 *   A · CASCADE LANDMINES. For every element in the web's JSX carrying MORE THAN ONE class, any
 *       property both classes declare is reported with its winner and loser. No mobile
 *       involvement — this is a list of places where reading the obvious rule gives the wrong
 *       answer, and it is a web smell list in its own right (a losing declaration is dead code).
 *   B · theme/web.js AGAINST THE WINNER. Each `ws.*` key whose name maps to a class is compared
 *       against the winning declarations for that class, phone-width media blocks included.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CSS = path.join(ROOT, "web", "app", "globals.css");
const WEBJS = path.join(ROOT, "mobile", "theme", "web.js");
const JSXDIR = path.join(ROOT, "web", "app");
const QUIET = process.argv.includes("--quiet");

/* The properties a port copies. Anything else (layout, transitions, shadows) is deliberately out
   of scope: this checks the values that get transcribed, not the ones that get rebuilt. */
const PROPS = new Set([
  "font-size", "line-height", "letter-spacing", "text-transform", "font-weight", "font-style",
  "color", "background-color", "background", "border-radius",
]);

/* ── strip comments, then walk the rules in SOURCE ORDER, carrying the at-rule context ──
   ⚠️ An at-rule is either a BLOCK (`@media … { … }`) or a STATEMENT (`@import …;`). The first
   cut pushed every `@` onto the condition stack, so the `@import` of the Google font at the top
   of globals.css became the "media context" of every rule in the file and the phone-width
   filtering was meaningless — which produced a page of confident false positives. Parse the two
   shapes apart, and pop the stack on the brace that actually closes each block. */
function parseCss(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  const stack = [];                       // open at-rule conditions, innermost last
  let i = 0, order = 0;
  while (i < src.length) {
    // skip whitespace, and close any blocks that end here
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] === "}") { stack.pop(); i++; continue; }
    if (i >= src.length) break;

    const brace = src.indexOf("{", i);
    const semi = src.indexOf(";", i);
    const close = src.indexOf("}", i);
    if (brace < 0) break;
    // a statement at-rule (@import, @charset) ends at its semicolon, before any brace
    if (semi >= 0 && semi < brace && src.slice(i, semi).trim().startsWith("@")) { i = semi + 1; continue; }
    // a stray declaration before the next brace (shouldn't happen at top level) — skip it
    if (close >= 0 && close < brace) { stack.pop(); i = close + 1; continue; }

    const head = src.slice(i, brace).trim();
    if (head.startsWith("@")) { stack.push(head); i = brace + 1; continue; }

    let depth = 1, j = brace + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    const decls = {};
    src.slice(brace + 1, j - 1).split(";").forEach((d) => {
      const c = d.indexOf(":");
      if (c < 0) return;
      const prop = d.slice(0, c).trim().toLowerCase();
      if (PROPS.has(prop)) decls[prop] = d.slice(c + 1).trim().replace(/\s*!important$/, "");
    });
    if (head && Object.keys(decls).length) {
      const media = stack.join(" ");
      head.split(",").forEach((sel) => rules.push({ sel: sel.trim(), decls, order: order++, media }));
    }
    i = j;
  }
  return rules;
}

/* Specificity as (ids, classes+attrs+pseudo-classes, elements). Good enough for a stylesheet
   that uses classes almost exclusively. */
function specificity(sel) {
  const s = sel.replace(/::[a-z-]+/g, "");           // pseudo-ELEMENTS count as elements
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const cls = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!not)[a-z-]+(\([^)]*\))?/g) || []).length;
  const els = (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return ids * 10000 + cls * 100 + els;
}

/* ★ EVERY BREAKPOINT THE REFERENCE WIDTH SATISFIES, NOT A HARD-CODED PAIR (2026-09-17).
   This was `/max-width:\s*(600|640)px/`, so a rule inside `@media (max-width: 400px)` was
   dropped by the filter below and the BASE rule was reported as the winner — which is wrong at
   every width the phone actually runs at. It cost two false disagreements (`tp_stat_n` 21 vs 19,
   `tp_stat_l` 8.5 vs 8) where the PHONE was right and the checker was not, and the map's step-8
   list had carried both as debt since 2026-09-15.
   ★ The reference width is 390 (CLAUDE.md §4: verify at 390, stress at 360), so a `max-width`
   breakpoint applies when it is >= 390. `min-width` still disqualifies a rule outright — those
   are desktop-up. ⚠️ If the reference width ever changes, change it HERE; it is the one number
   that decides which half of globals.css this checker is reading. */
/* ───────── NAMED DIVERGENCES — the checker's own blind spots, each with its reason ─────────
 *
 * ⚠️ THIS IS NOT A MUTE BUTTON. Every entry says WHY the checker is wrong about that key, and
 * "the phone looks fine to me" is not a reason. The bar is that the comparison itself is
 * ill-posed — the checker is reading a rule the phone does not render, or reading a box where
 * the phone keeps the type. If a key is merely UNMEASURED, fix the key; do not list it here.
 *
 * Three families, and each one is a fact about the two platforms rather than about a screen:
 *
 * ⓵ `.assess-flat` — assessment items sit FLAT on the unit's paper (CLAUDE.md §3, 2026-07-10),
 *    and globals.css re-palettes them at a HIGHER specificity: `.assess-flat .assess-prompt` is
 *    13.5px where the bare `.assess-prompt` is 14px. `targetsAlone()` deliberately only compares
 *    single-class rules, so it reads the bare one and reports the flat port as wrong. The phone
 *    renders the flat layout (`AssessPanel.jsx` → `ws.assess_flat`), so its values are RIGHT.
 *
 * ⓶ ONE WEB CLASS, TWO RN KEYS. CSS puts the box and its type on one class; a React Native
 *    `View` cannot carry a font, so the phone splits `x` (layout) from `x_t` (type). The checker
 *    maps `x` → `.x`, finds no font on the phone's box, and falls through to a sibling. Where the
 *    TEXT key is correct, the box key's report is noise.
 *
 * ⓷ THE 16px INPUT-ZOOM GUARD. `@media (max-width: 600px) { .dd-btn, .dd-opt { font-size: 16px } }`
 *    exists because iOS Safari ZOOMS THE PAGE when a control smaller than 16px takes focus. It is
 *    a browser workaround with no native counterpart — a Sheet does not zoom — so copying it onto
 *    the phone would make every dropdown two points larger than the design for no reason.
 */
const NAMED_DIVERGENCES = {
  "assess_prompt:font-size":      "the phone renders .assess-flat (13.5px), not the bare rule",
  "assess_look_k:font-size":      "the phone renders .assess-flat (10px), not the bare rule",
  "assess_look_k:letter-spacing": ".1em of the FLAT 10px = 1.0px; the checker computes it off 9px",
  "assess_look_t:font-size":      "the phone renders .assess-flat (13.5px), not the bare rule",
  "assess_scaf_row:font-size":    "the phone renders .assess-flat (13.5px), not the bare rule",
  "assess_corr_row:font-size":    "one key serves several rows; the checker sees the whole family",
  "assess_revrow:font-size":      "one key serves several rows; the checker sees the whole family",
  "lv_pvmid:font-size":           "the phone's preview nav splits box and label across two keys",
  "lv_pvmid:letter-spacing":      "as above — the label key carries the tracking",
  "dd_btn:font-size":             "16px is iOS Safari's input-zoom guard; a native Sheet cannot zoom",
  "dd_opt:font-size":             "16px is iOS Safari's input-zoom guard; a native Sheet cannot zoom",
};

const REF_WIDTH = 390;
const PHONE = {
  test(media) {
    const m = /max-width:\s*(\d+(?:\.\d+)?)px/.exec(media);
    return !!m && Number(m[1]) >= REF_WIDTH;
  },
};
/* Does this selector target exactly `.cls`, with no other class required? A rule like
   `.a .b` or `.a.b` is conditional on more than the class we are asking about. */
function targetsAlone(sel, cls) {
  const bare = sel.replace(/:(hover|focus|focus-visible|active|disabled|first-child|last-child)\b(\([^)]*\))?/g, "");
  return new RegExp(`(^|[\\s>+~])\\.${cls}$`).test(bare.trim());
}

/* The winning declaration for `prop` on an element carrying exactly `classes`, at phone width. */
function winner(rules, classes, prop) {
  let best = null;
  for (const r of rules) {
    if (r.media && !PHONE.test(r.media) && /max-width|min-width/.test(r.media)) continue;
    if (!(prop in r.decls)) continue;
    // every class the selector requires must be on the element
    const need = (r.sel.match(/\.[\w-]+/g) || []).map((c) => c.slice(1));
    if (!need.length || !need.every((c) => classes.includes(c))) continue;
    if (/:(hover|focus|active|disabled)/.test(r.sel)) continue;   // states, not the resting look
    if (/::/.test(r.sel)) continue;                               // ::placeholder / ::before are other boxes
    const spec = specificity(r.sel);
    if (!best || spec > best.spec || (spec === best.spec && r.order > best.order)) {
      best = { spec, order: r.order, value: r.decls[prop], sel: r.sel, media: r.media };
    }
  }
  return best;
}

const rules = parseCss(fs.readFileSync(CSS, "utf8"));

/* `--dump .some-class` prints every parsed rule touching that class, with its at-rule context,
   specificity and source order. The first thing to reach for when a finding looks wrong — and
   the thing that showed this checker's own parser was dropping rules. */
const dumpIdx = process.argv.indexOf("--dump");
if (dumpIdx > 0 && process.argv[dumpIdx + 1]) {
  const want = process.argv[dumpIdx + 1].replace(/^\./, "");
  console.log(`\nparsed ${rules.length} rules; those mentioning .${want}:\n`);
  rules.filter((r) => r.sel.includes("." + want)).forEach((r) => {
    console.log(`  [order ${r.order}, spec ${specificity(r.sel)}] ${r.sel}${r.media ? "   @" + r.media : ""}`);
    Object.entries(r.decls).forEach(([k, v]) => console.log(`        ${k}: ${v}`));
  });
  process.exit(0);
}
const lineOf = (() => {
  const raw = fs.readFileSync(CSS, "utf8").split("\n");
  return (sel) => {
    const re = new RegExp(`\\${sel}\\b[^{]*\\{`);
    const i = raw.findIndex((l) => re.test(l));
    return i >= 0 ? i + 1 : "?";
  };
})();

/* ══ A · cascade landmines ══════════════════════════════════════════════════════════════
   Every multi-class element in the web's JSX; any property two of its classes both declare. */
function jsxFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) jsxFiles(f, out);
    else if (/\.jsx$/.test(e.name)) out.push(f);
  }
  return out;
}

const combos = new Map();   // "a b" -> Set(files)
for (const f of jsxFiles(JSXDIR)) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/className=(?:"([^"]+)"|\{`([^`]*)`\})/g)) {
    const raw = (m[1] || m[2] || "")
      .replace(/\$\{[^}]*\}/g, " ")          // drop interpolations; keep the literal classes
      .trim();
    const cls = raw.split(/\s+/).filter((c) => /^[\w-]+$/.test(c));
    if (cls.length < 2) continue;
    const key = cls.slice().sort().join(" ");
    if (!combos.has(key)) combos.set(key, { classes: cls, files: new Set() });
    combos.get(key).files.add(path.relative(ROOT, f));
  }
}

const landmines = [];
for (const { classes, files } of combos.values()) {
  for (const prop of PROPS) {
    // which of THIS element's classes declare the property on their own?
    const declarers = [];
    for (const c of classes) {
      for (const r of rules) {
        if (!(prop in r.decls)) continue;
        if (!targetsAlone(r.sel, c)) continue;
        if (/:(hover|focus|active|disabled)/.test(r.sel)) continue;
        if (r.media && !PHONE.test(r.media) && /max-width|min-width/.test(r.media)) continue;
        declarers.push({ cls: c, value: r.decls[prop], sel: r.sel, order: r.order, spec: specificity(r.sel) });
      }
    }
    if (declarers.length < 2) continue;
    const byCls = new Set(declarers.map((d) => d.cls));
    if (byCls.size < 2) continue;                       // one class declaring it twice is fine
    const values = new Set(declarers.map((d) => d.value));
    if (values.size < 2) continue;                      // they agree — nothing to trip on
    const sorted = declarers.slice().sort((a, b) => (b.spec - a.spec) || (b.order - a.order));
    const win = sorted[0], lose = sorted.filter((d) => d.cls !== win.cls);
    landmines.push({
      classes: classes.join(" "), prop,
      win: `.${win.cls} (line ${lineOf("." + win.cls)}) → ${win.value}`,
      lose: lose.map((l) => `.${l.cls} (line ${lineOf("." + l.cls)}) → ${l.value}`),
      tie: lose.some((l) => l.spec === win.spec),
      files: [...files],
    });
  }
}

/* ══ B · theme/web.js against the winner ═══════════════════════════════════════════════ */
const webjs = fs.readFileSync(WEBJS, "utf8");
const bodyStart = webjs.indexOf("export function webStyles");
const body = webjs.slice(bodyStart);
const keys = new Map();
for (const m of body.matchAll(/^ {4}([a-z][A-Za-z0-9_]*): *\{([\s\S]*?)\},?$/gm)) {
  keys.set(m[1], m[2]);
}

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const emToPx = (v, fs_) => (/em$/.test(v) && fs_ != null ? parseFloat(v) * fs_ : num(v));

const mismatches = [];
const namedHits = [];
/* Every disagreement goes through here, so a future check cannot bypass the table by accident. */
function report(key, prop, line) {
  const reason = NAMED_DIVERGENCES[`${key}:${prop}`];
  if (reason) namedHits.push(`${key}  ${prop} — ${reason}`);
  else mismatches.push(line);
}
const named = [];
const unmapped = [];
for (const [key, decl] of keys) {
  const cls = key.replace(/_/g, "-");
  if (!rules.some((r) => targetsAlone(r.sel, cls))) { unmapped.push(key); continue; }

  /* ── what the BROWSER applies ──
     ⚠️ A class is rarely worn alone. `.lv-title` declares 17.5px and every element carrying it
     also carries `.lv-title-full`, which wins at 19.5 — so checking the class in isolation
     reports the port wrong when it is right. Take the winner for the class alone AND for every
     combination the JSX actually puts it in; a port matching any of them is correct. */
  const worn = [[cls], ...[...combos.values()]
    .filter((c) => c.classes.includes(cls)).map((c) => c.classes)];
  const cssOf = (prop) => worn.map((set) => winner(rules, set, prop)).filter(Boolean);

  /* ── what the PHONE has ──
     ⚠️ RN splits the container from its Text and CSS does not. One class carries both the box
     (padding, radius, fill) and the type (face, size, tracking, case); the port puts the box on
     a View under `foo` and the type on a Text under `foo_t`, or on a PEER like `mlp_allocate_t`
     beside `mlp_allocate_btn`. So read OWN-FIRST — if this key declares the property, that is
     the answer and nothing else is consulted — and only a key declaring none of it falls back to
     its children (`foo_*`) and then its peers (same stem).
     ⚠️ The fallback accepts a match on ANY family member, so a genuine miss on a key whose
     sibling happens to carry the right number is invisible. That is the deliberate trade: a
     noisy detector is one nobody runs. */
  const kids = [...keys.entries()].filter(([k]) => k.startsWith(key + "_")).map(([, v]) => v);
  const stem = key.includes("_") ? key.slice(0, key.lastIndexOf("_")) : key;
  const peers = [...keys.entries()]
    .filter(([k]) => k !== key && (k === stem || k.startsWith(stem + "_"))).map(([, v]) => v);
  const pick = (re) => {
    for (const pool of [[decl], kids, peers]) {
      const hits = pool.map((d) => (d.match(re) || [])[1]).filter((v) => v !== undefined)
        .map(num).filter((n) => n != null);
      if (hits.length) return hits;
    }
    return [];
  };
  const rnSizes = pick(/fontSize:\s*([\d.]+)/);
  const rnTracks = pick(/letterSpacing:\s*(-?[\d.]+)/);
  const upRe = /textTransform:\s*UP|textTransform:\s*"uppercase"/;
  const typeRe = /fontSize|letterSpacing|fontFamily|textTransform/;
  /* ⚠️ THE SAME OWN → KIDS → PEERS CASCADE `pick()` USES, and it must STOP at the first pool that
     declares type — it used to OR kids and peers together, which let a PEER overrule the key's own
     children. `ap_foot` is the case that exposed it: it declares no type itself, its children
     `ap_foot_t`/`ap_foot_go` are both lowercase and correct, and the peer `ap_kicker` is uppercase
     — so the union said "the phone uppercases" and a correct port was reported wrong. A peer is
     the LAST resort, consulted only when nothing closer has an answer. */
  const casePool = [[decl], kids, peers].find((pool) => pool.some((d) => typeRe.test(d))) || [];
  const rnCase = casePool.some((d) => upRe.test(d));

  // ── compare ──
  const cssSize = cssOf("font-size");
  const sizes = cssSize.map((w) => num(w.value)).filter((n) => n != null);
  if (sizes.length && rnSizes.length
      && !sizes.some((w) => rnSizes.some((r) => Math.abs(w - r) < 0.01))) {
    report(key, "font-size", `${key}  font-size: web says ${[...new Set(sizes)].join(" or ")}, `
      + `phone has ${[...new Set(rnSizes)].join(" or ")}   [${cssSize[0].sel}`
      + `${cssSize[0].media ? " @" + cssSize[0].media.replace(/^@/, "") : ""}]`);
  }
  /* ⚠️ AN `em` IS RESOLVED AGAINST THE FONT-SIZE OF THE SAME WORN SET, never against `sizes[0]`
     (2026-09-15). This was the checker's own version of the bug it exists to find: it took the
     winning letter-spacing for each set but divided it by whichever font-size happened to come
     first across ALL sets. `button.primary fr-cta` is the case that exposed it — `.fr-cta`
     declares font-size 16 and loses it to `button.primary`'s 12 on SPECIFICITY, so .08em is
     0.96px on screen and the checker was reporting 1.28 and calling a correct port wrong.
     A tool that resolves a relative unit against a losing declaration is making exactly the
     mistake it was built to catch, so the pairing is by INDEX and the sets stay aligned. */
  const cssTrack = worn.map((set) => winner(rules, set, "letter-spacing"));
  const setSizes = worn.map((set) => {
    const w = winner(rules, set, "font-size");
    return w ? num(w.value) : null;
  });
  const trackPairs = cssTrack
    .map((w, i) => (w ? { w, px: emToPx(w.value, setSizes[i] ?? rnSizes[0]) } : null))
    .filter((p) => p && p.px != null);
  if (trackPairs.length && rnTracks.length
      && !trackPairs.some((p) => rnTracks.some((r) => Math.abs(p.px - r) < 0.02))) {
    const p0 = trackPairs[0];
    report(key, "letter-spacing", `${key}  letter-spacing: web says ${p0.w.value} `
      + `(= ${p0.px.toFixed(2)}px), phone has ${rnTracks[0]}`);
  }
  const cssCase = cssOf("text-transform");
  if (cssCase.length && !cssCase.map((w) => /uppercase/.test(w.value)).some((u) => u === rnCase)) {
    report(key, "text-transform", `${key}  text-transform: web says ${cssCase[0].value}, `
      + `phone ${rnCase ? "uppercases" : "does not"}`);
  }
}

/* ══ report ══════════════════════════════════════════════════════════════════════════ */
const ties = landmines.filter((l) => l.tie);
const beaten = landmines.filter((l) => !l.tie);

console.log("\n══ A · CASCADE LANDMINES — elements whose classes fight over a property ══");
console.log("   These are where reading the obvious rule gives the wrong answer.\n");
if (!landmines.length) console.log("   none\n");
for (const l of [...ties, ...beaten]) {
  console.log(`   ${l.tie ? "⚠ TIE (source order decides)" : "  (specificity decides)"}  className="${l.classes}"  ·  ${l.prop}`);
  console.log(`       WINS   ${l.win}`);
  l.lose.forEach((x) => console.log(`       loses  ${x}${l.tie ? "   ← dead declaration" : ""}`));
  if (!QUIET) console.log(`       in     ${l.files.join(", ")}`);
  console.log("");
}

console.log("══ B · theme/web.js vs the rule that WINS ══\n");
if (!mismatches.length) console.log("   no disagreement on face size, tracking or case\n");
else mismatches.forEach((m) => console.log("   " + m));

/* ★ THE NAMED ONES ARE PRINTED, NOT SWALLOWED. A silent skip list rots: nobody notices when a
   reason stops being true. Shown every run, with the reason, so the cost of a bad entry is that
   somebody reads it. */
if (namedHits.length && !QUIET) {
  console.log(`\n══ C · NAMED DIVERGENCES (checked, and the checker is the one that is wrong) ══`);
  namedHits.forEach((m) => console.log("   " + m));
}

if (!QUIET) {
  console.log(`\n══ coverage ══`);
  console.log(`   ${keys.size - unmapped.length} of ${keys.size} theme keys map to a class of the same name`);
  console.log(`   ${unmapped.length} unmapped (a composite, a phone-only measure, or a renamed key):`);
  console.log("   " + unmapped.join(", ") + "\n");
}

/* ⚠️ **ONLY DISAGREEMENTS FAIL THIS CHECK.** The ties in section A are a report about the WEB's
   own cascade — dead declarations that a later same-specificity rule overrides — and they are
   worth reading before touching those classes, but they are not a phone-parity defect and there
   is nothing in `theme/web.js` to change for them. Failing on them meant the check could never
   go green, so "run it until it is clean" had no meaning; section B is the contract. */
const problems = mismatches.length;
console.log(`${problems ? "✗" : "✓"} ${mismatches.length} value disagreement(s)`
  + `   ·   ${namedHits.length} named divergence(s)`
  + `   ·   ${ties.length} web-CSS tie(s) to read, not to fix\n`);
process.exit(problems ? 1 : 0);
