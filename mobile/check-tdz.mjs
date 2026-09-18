/* check-tdz.mjs — a `const` read before its own line runs (2026-09-18).
 *
 * Twice now: `tourNow` in My Classes (2026-09-17) and `purchasing` in Subscription & billing
 * (2026-09-18) were READ during render above the line that declares them. That parses, lints and
 * scope-checks clean — the binding exists, it simply is not initialised yet — and throws a
 * ReferenceError on first paint: a white screen. `check-scope` cannot see it by construction.
 *
 * Rule: a reference to a `const`/`let` that appears BEFORE the declaration and is evaluated in the
 * SAME function (no function boundary between them) is reported. A reference inside a nested
 * function — a handler, an effect callback — runs later and is fine. A `useEffect` DEPS array is
 * evaluated at render, so it is caught, which is exactly the `tourNow` case.
 * Run: node check-tdz.mjs $(find app components lib -name '*.jsx' -o -name '*.js')
 * Proved against a two-line file with a known early read before it was believed. */
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import { readFileSync } from "fs";
const traverse = _traverse.default || _traverse;
let bad = 0;
for (const f of process.argv.slice(2)) {
  let ast;
  try { ast = parse(readFileSync(f, "utf8"), { sourceType: "module", plugins: ["jsx"] }); }
  catch (e) { bad++; console.log(`PARSE FAIL ${f}`); continue; }
  traverse(ast, {
    ReferencedIdentifier(p) {
      const b = p.scope.getBinding(p.node.name);
      if (!b || (b.kind !== "const" && b.kind !== "let")) return;
      const decl = b.path.node;
      if (p.node.start >= decl.start) return;
      const refFn = p.getFunctionParent();
      const declFn = b.path.getFunctionParent();
      const same = (refFn && declFn) ? refFn.node === declFn.node : (!refFn && !declFn);
      if (!same) return;
      bad++;
      const line = p.node.loc.start.line, dl = decl.loc.start.line;
      console.log(`${f}:${line}  \`${p.node.name}\` read before its declaration on line ${dl}`);
    },
  });
}
if (bad) { console.log(`${bad} finding(s)`); process.exit(1); }
console.log(`✓ ${process.argv.length - 2} file(s): no const/let read before its declaration`);
