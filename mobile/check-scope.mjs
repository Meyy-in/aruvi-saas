/* check-scope.mjs — the bug babel cannot see.
 *
 * `unitTabsTourRef` was declared in `LessonView` and used in `PreviewUnit`, a SIBLING function
 * defined above it. That parses clean, lints clean, and throws a ReferenceError the moment a unit
 * renders — the whole lesson screen, white. This script resolves every referenced identifier
 * against its real scope chain and reports the ones that resolve to nothing.
 *
 * Run: node check-scope.mjs $(find app components lib theme -name '*.jsx' -o -name '*.js')
 * Exit 0 = clean. It also fails on a parse error, so it subsumes a plain syntax check.
 *
 * ⚠️ IT MUST NOT USE `scope.hasGlobal`. Babel counts every unresolved reference in a file as a
 * "global", so consulting it waves through precisely the bug this exists to find. The first
 * version of this script did, and reported the LessonView bug as clean. Any change here gets
 * proved against a two-line file with a known stray reference before it is believed.
 */
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import { readFileSync } from "fs";
const traverse = _traverse.default || _traverse;
const GLOBALS = new Set(("require module exports __DEV__ process console global globalThis fetch "
  + "setTimeout clearTimeout setInterval clearInterval setImmediate queueMicrotask "
  + "Promise JSON Math Date Object Array String Number Boolean Error TypeError Map Set WeakMap "
  + "WeakSet RegExp Symbol Intl URL URLSearchParams FormData Blob File AbortController "
  + "requestAnimationFrame cancelAnimationFrame performance structuredClone TextEncoder "
  + "TextDecoder Infinity NaN undefined isNaN isFinite parseInt parseFloat encodeURIComponent "
  + "decodeURIComponent encodeURI decodeURI atob btoa Reflect Proxy BigInt ArrayBuffer Uint8Array "
  + "window document navigator localStorage sessionStorage alert location history "
  + "ResizeObserver IntersectionObserver MutationObserver matchMedia getComputedStyle "
  + "HTMLElement Node Event CustomEvent DOMParser Image Audio").split(" "));
let bad = 0;
for (const f of process.argv.slice(2)) {
  let ast;
  try {
    ast = parse(readFileSync(f, "utf8"), { sourceType: "module", plugins: ["jsx"] });
  } catch (e) { bad++; console.log(`PARSE FAIL ${f}\n           ${e.message.split("\n")[0]}`); continue; }
  traverse(ast, {
    ReferencedIdentifier(p) {
      const n = p.node.name;
      /* ⚠️ NOT `scope.hasGlobal` — babel counts every unresolved reference in the file as a
         "global", so asking it would wave through exactly the bug this script exists to find.
         A binding in an enclosing scope, or a name on this list, or it is a finding. */
      if (p.scope.hasBinding(n, true)) return;
      if (GLOBALS.has(n)) return;
      bad++;
      console.log(`UNRESOLVED ${f}:${p.node.loc.start.line}  ${n}`);
    },
  });
}
console.log(bad ? `${bad} finding(s)` : `\u2713 ${process.argv.length - 2} file(s) parse clean, no unresolved identifiers`);
process.exit(bad ? 1 : 0);
