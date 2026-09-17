/* Every tour anchor must sit on an element that OCCUPIES SPACE.
 *
 * Twice in one day an anchor was put on a View wrapping an absolutely-positioned child. In React
 * Native that View contributes nothing to layout, so it measures as a zero box — which the tour
 * correctly treats as "not mounted" — and the ring silently has nothing to draw. It also steals
 * the absolute child's frame of reference and moves it on screen. Both were reported as UI bugs
 * four times before the cause was found, because nothing fails loudly.
 *
 * This finds the shape: a ref from `useTourAnchor` placed on a View whose only child is a
 * component, where that ref is NOT also passed down. It cannot prove the child is absolute, so it
 * reports candidates to look at rather than failures.
 */
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import { readFileSync } from "fs";
const traverse = _traverse.default || _traverse;
let flagged = 0;
for (const f of process.argv.slice(2)) {
  const ast = parse(readFileSync(f, "utf8"), { sourceType: "module", plugins: ["jsx"] });
  traverse(ast, {
    JSXOpeningElement(p) {
      const name = p.node.name && p.node.name.name;
      if (name !== "View") return;
      const ref = p.node.attributes.find((a) => a.name && a.name.name === "ref");
      if (!ref) return;
      const hasStyle = p.node.attributes.some((a) => a.name && a.name.name === "style");
      if (hasStyle) return;                       // a styled View has its own box
      const el = p.parentPath.node;
      const kids = (el.children || []).filter((c) =>
        c.type === "JSXElement" || (c.type === "JSXText" && c.value.trim()));
      if (kids.length !== 1 || kids[0].type !== "JSXElement") return;
      const child = kids[0].openingElement.name.name || "";
      if (!/^[A-Z]/.test(child)) return;          // only a COMPONENT can hide an absolute root
      flagged++;
      console.log(`${f}:${p.node.loc.start.line}  ref on a bare <View> wrapping <${child}> — `
        + `if ${child}'s root is absolute this measures as a zero box`);
    },
  });
}
console.log(flagged ? `${flagged} to look at` : "✓ no anchor sits on a bare wrapper");
process.exit(0);
