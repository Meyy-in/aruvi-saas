/* ───────── Ask Meyy — the deterministic Q&A panel (6c; web/app/ask-aruvi/AskAruvi.jsx) ─────────
 *
 * A 1:1 port of the web's `.aa-*` panel. Two modes over one dataset — the question bank, which is
 * FETCHED once after sign-in and kept on the device (`@aruvi/shared/ask-aruvi/bank`), never
 * bundled:
 *
 *   • BROWSE (search empty): five collapsible categories. Opening one FREEZES its header so it can
 *     be collapsed again from anywhere while its questions scroll past underneath.
 *   • SEARCH (search has text): the categories disappear entirely — a ranked, de-duplicated list
 *     of matching pairs, best first, with a live count. No LLM: keyword + token ranking, run on
 *     the device (`@aruvi/shared/ask-aruvi/askAruviSearch`).
 *
 * ★ IT IS A PANEL, NOT A ROUTE, and that is the whole of the navigation decision. The web's is a
 * scrim over the app with the bottom nav left OUTSIDE it and live (founder, 2026-09-13: a screen
 * that takes the app's nav away leaves exactly one way out of itself). A pushed screen on the
 * phone would put Ask Meyy on the stack — a back gesture out of it would land on whatever she was
 * reading rather than dismissing the help, and the bar item could not TOGGLE. So it is an absolute
 * View mounted in the shell, drawn above the Stack and below `BottomNav`.
 *
 * ★ SO THE GEOMETRY IS MEASURED, NOT ASSUMED. The web pins the scrim between two custom
 * properties it measures at runtime (`--hdr-h`, `--bnav-h`). The phone's twin: `top` is the height
 * the shell's chrome actually laid out to — brand bar, and the Settings bar and notices when they
 * are up — reported by the layout's own `onLayout`; the bottom is `BNAV_H` plus the safe-area
 * inset, which is what the nav occupies. Nothing here carries a copy of a number owned elsewhere.
 *
 * ★ `accessibilityViewIsModal` IS FALSE, deliberately (the web's `aria-modal="false"`): the bar
 * stays operable, so claiming the rest of the app is inert would be a lie to a screen reader.
 *
 * ⚠️ NO AUTOFOCUS, on any phone (row I6). The web focuses the search box at ≥601px only, for the
 * founder's step-2 finding: a focused field raises the keyboard over half the screen. Every width
 * here is a phone width, so the rule resolves to "never". A teacher who wants to type taps the
 * box; a teacher who came to browse the five categories is not interrupted.
 */
import { useEffect, useMemo, useState } from "react";
import { BackHandler, Platform, Pressable, SectionList, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadBank, refreshBank } from "@aruvi/shared/ask-aruvi/bank";
import { search } from "@aruvi/shared/ask-aruvi/askAruviSearch";
import { Text, TextInput } from "./Text";
import { BNAV_H } from "./BottomNav";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";
import { useTourAnchor } from "../lib/tour";

/* ★ Q5/Q14 IS ANSWERED BY THE BANK ITSELF (2026-09-16, read from
   `data/cloud/content/ask_aruvi/qa_knowledge_base.json`): the five categories carry `accent`
   values `var(--sec-a)`, `var(--sec-b)`, `var(--sec-c)`, `var(--sec-d)` and `var(--ss-plum)` —
   CSS custom-property references, which is exactly what the map feared. The phone does NOT parse
   CSS: it maps the five stored strings to the five tokens they name, and anything unrecognised
   falls back to the pine the rest of the app uses for an accent it cannot place. A sixth category
   would paint pine rather than nothing, which is the failure the web already had once (before
   globals.css declared the palette on `.aa-panel`, four of five rails resolved to nothing and
   only cat_e showed). */
const ACCENTS = {
  "var(--sec-a)": "sec_a", "var(--sec-b)": "sec_b", "var(--sec-c)": "sec_c",
  "var(--sec-d)": "sec_d", "var(--ss-plum)": "ss_plum",
};
const accentOf = (t, accent) => t[ACCENTS[accent] || "pine"] || t.pine;

/* The stream-and-dot mark. Same path data as the bar's `AskIcon` and Support's `AskMark`.
   ⚠️ The dot is `#e8b4a0` HERE and `#c0392b` there — this one sits on the pine disc, where the
   red goes muddy and the clay reads (the web's own two values, row I4). */
function AskMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ffffff"
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 6.5c6 1 6 5 3.5 7.5S6 18 6 18" />
      <Path d="M10.5 14c3.5 0 5.5-1.8 6.5-4" />
      <Circle cx={17.3} cy={8.6} r={1.6} fill="#e8b4a0" stroke="none" />
    </Svg>
  );
}

/* ⚠️ DRAWN, NOT TYPED. The web's chevron is the character `⌄` (U+2304); iOS has no glyph for it in
   the app's faces and would draw tofu, which is the `⚙` lesson of 2026-09-16 over again
   (components/GearIcon.jsx). A path also rotates cleanly, which is what "up" means here. */
function Chev({ color, up }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: [{ rotate: up ? "180deg" : "0deg" }] }}>
      <Path d="M2 4.5 6 8.5 10 4.5" />
    </Svg>
  );
}

/* One answer row, shared by both modes. `tag` is passed only in SEARCH mode — in browse she is
   already standing inside the category, so the pill would name what the header above says. */
function Answer({ p, open, onToggle, tag, first, lead }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    /* `first` is the web's `.aa-results > .aa-item:first-child { border-top: none }` — in search
       mode the list opens straight under the count line and a hairline there would read as a rule
       under the search box. `lead` is `.aa-cat-list`'s 2px of top padding, which belongs to the
       first row rather than to the sticky header it must not travel with. */
    <View style={[ws.aa_item, { borderTopColor: t.line_soft },
                  first && { borderTopWidth: 0 }, lead && { marginTop: 2 }]}>
      <Pressable onPress={onToggle} style={ws.aa_item_q} accessibilityRole="button"
        accessibilityState={{ expanded: open }}>
        <Text style={[ws.aa_item_plus, { color: open ? t.clay : t.ink_soft }]}>{open ? "–" : "+"}</Text>
        <Text style={[ws.aa_item_qtext, { color: t.ink }]}>{p.question}</Text>
        {tag ? (
          <Text style={[ws.aa_item_tag, { color: t.ink_soft, borderColor: t.line }]}>{tag}</Text>
        ) : null}
      </Pressable>
      {/* The answers are plain text with newlines in them — RN's Text keeps those, which is the
          web's `white-space: pre-wrap` for free. */}
      {open ? <Text style={[ws.aa_item_a, { color: t.ink_soft }]}>{p.answer}</Text> : null}
    </View>
  );
}

export default function AskMeyy({ top = 0, onClose }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState("");
  const [openCat, setOpenCat] = useState(null);    // the frozen (expanded) category id
  const [openPair, setOpenPair] = useState(null);  // the expanded answer id

  /* `loadBank()` is SYNCHRONOUS by design, so opening this panel never waits on the network. It is
     empty only for a teacher whose first session lost signal between signing in and the priming
     fetch — sign-in primes it and the shell refreshes it on every load precisely to make that
     rare. When it IS empty we try once more here, because she has just asked for help. */
  const [kb, setKb] = useState(() => loadBank());
  useEffect(() => {
    if (kb) return;
    let live = true;
    refreshBank().then((b) => { if (live && b) setKb(b); }).catch(() => {});
    return () => { live = false; };
  }, [kb]);

  const cats = useMemo(() => (kb && kb.categories) || [], [kb]);
  const pairs = useMemo(() => (kb && kb.pairs) || [], [kb]);

  /* ONE MOVING MARKER, not one rail per category: it starts beside the first category and hops to
     whichever header is tapped — open OR collapse, because it marks "where you are" and so must
     never disappear. */
  const [markedCat, setMarkedCat] = useState(null);
  useEffect(() => {
    if (!markedCat && cats.length) setMarkedCat(cats[0].id);
  }, [cats, markedCat]);

  const result = useMemo(() => search(pairs, query), [pairs, query]);
  const searching = result !== null;

  const catMap = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c])), [cats]);
  const byCat = useMemo(() => {
    const m = {};
    pairs.forEach((p) => (m[p.category] = m[p.category] || []).push(p));
    return m;
  }, [pairs]);

  /* ★ ANDROID'S HARDWARE BACK CLOSES THE PANEL — the phone's answer to the web's Escape (row I16).
     Without it, back would pop the ROUTE underneath while the panel stayed up over whatever
     arrived: the help would outlive the screen it was opened from. */
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);

  const togglePair = (id) => setOpenPair((cur) => (cur === id ? null : id));

  /* ★ ONE LIST, BOTH MODES. Browse is five sections whose rows appear only when the section is
     open; search is a SINGLE headerless section of ranked rows. A `SectionList` gives the web's
     sticky category header natively — and stickiness is switched OFF while searching, where there
     is no header for it to freeze. */
  const sections = useMemo(() => {
    if (!kb) return [];
    if (searching) return [{ key: "results", cat: null, data: result.results }];
    return cats.map((c) => ({
      key: c.id, cat: c, all: byCat[c.id] || [],
      data: openCat === c.id ? (byCat[c.id] || []) : [],
    }));
  }, [kb, searching, result, cats, byCat, openCat]);

  const askRootRef = useTourAnchor("ask-aruvi-root");   // tour step 19 rings the whole panel

  return (
    /* The scrim. `pointerEvents` is left alone: it MUST swallow taps on the screen behind it — the
       panel fills it at every phone width, so nothing of the scrim is actually exposed. */
    <View
      style={[ws.aa_scrim, {
        position: "absolute", left: 0, right: 0, top,
        bottom: BNAV_H + insets.bottom,
      }]}
      accessibilityViewIsModal={false}
      accessibilityLabel="Ask Meyy">
      <View ref={askRootRef} style={[ws.aa_panel, { backgroundColor: t.paper }]}>

        {/* fixed title bar */}
        <View style={[ws.aa_top, { borderBottomColor: t.line, backgroundColor: t.paper }]}>
          <View style={ws.aa_title_row}>
            <View style={[ws.aa_q, { backgroundColor: t.pine }]}><AskMark /></View>
            <Text style={[ws.aa_title, { color: t.ink }]}>Ask Meyy</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close Ask Meyy"
            hitSlop={10}>
            <Text style={[ws.aa_close, { color: t.ink_soft }]}>✕</Text>
          </Pressable>
        </View>

        {/* the search row — the web's sticky bar, which on the phone is simply the row above the
            scroller */}
        <View style={[ws.aa_search, { borderBottomColor: t.line_soft, backgroundColor: t.paper }]}>
          <TextInput
            value={query}
            onChangeText={(v) => { setQuery(v); setOpenPair(null); }}
            placeholder="Search…"
            placeholderTextColor={t.ink_soft}
            accessibilityLabel="Search questions"
            /* iOS's own clear-x, the nearest thing to the web's `type="search"`. */
            clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
            autoCorrect={false} autoCapitalize="none" returnKeyType="search"
            style={[ws.aa_search_input, { color: t.ink, backgroundColor: t.paper_2, borderColor: t.line }]}
          />
          {searching ? (
            <Text style={[ws.aa_count, { color: t.ink_soft }]}>
              {result.count === 0
                ? "No matches — try fewer or different words"
                : `${result.count} ${result.count === 1 ? "result" : "results"}`}
            </Text>
          ) : null}
        </View>

        {!kb ? (
          /* ★ THE ONLY STATE WITH NO ANSWERS: a first session that lost signal between sign-in and
             the priming fetch. Say what is true and what fixes it — never a spinner, which would
             imply something is arriving, because offline nothing is. */
          <View style={ws.aa_empty}>
            <Text style={[ws.aa_empty_p, { color: t.ink_soft }]}>
              Ask Meyy needs to download its answers once before it can work offline.
            </Text>
            <Text style={[ws.aa_empty_p, { color: t.ink_soft }]}>
              Open it again when you next have a connection, and it will be ready from then on.
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(p) => p.id}
            stickySectionHeadersEnabled={!searching}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[ws.aa_body, searching && ws.aa_results]}
            renderSectionHeader={({ section }) => {
              if (!section.cat) return null;
              const c = section.cat;
              const isOpen = openCat === c.id;
              const accent = accentOf(t, c.accent);
              return (
                <Pressable
                  onPress={() => {
                    setOpenCat(isOpen ? null : c.id); setMarkedCat(c.id); setOpenPair(null);
                  }}
                  accessibilityRole="button" accessibilityState={{ expanded: isOpen }}
                  /* The paper fill is not decoration: it is what the rows pass UNDER while the
                     header is frozen. A transparent sticky header shows them through it. */
                  style={[ws.aa_cat_head, { backgroundColor: t.paper },
                          isOpen && { borderBottomWidth: 1, borderBottomColor: t.line_soft }]}>
                  <View style={[ws.aa_cat_bar,
                                { backgroundColor: markedCat === c.id ? accent : "transparent" }]} />
                  <View style={ws.aa_cat_text}>
                    <Text style={[ws.aa_cat_title, { color: t.ink }]}>{c.title}</Text>
                    <Text style={[ws.aa_cat_desc, { color: t.ink_soft }]}>{c.description}</Text>
                  </View>
                  <View style={ws.aa_cat_meta}>
                    <Text style={[ws.aa_cat_n, { color: accent }]}>{section.all.length}</Text>
                    <Chev color={t.ink_soft} up={isOpen} />
                  </View>
                </Pressable>
              );
            }}
            /* The category's bottom hairline belongs to the SECTION, not to a row — it is the
               web's `.aa-cat { border-bottom }`, and it has to sit under the open list as well as
               under a collapsed header. `.aa-cat-list`'s own 2/10 padding rides with it. */
            renderSectionFooter={({ section }) => (
              section.cat ? (
                <View style={[ws.aa_cat, { borderBottomColor: t.line_soft },
                              section.data.length ? { paddingBottom: ws.aa_cat_list.paddingBottom } : null]} />
              ) : null
            )}
            renderItem={({ item, index, section }) => (
              <Answer p={item} open={openPair === item.id} onToggle={() => togglePair(item.id)}
                /* In search mode the pill names which category the answer came from; in browse she
                   is standing inside that category and the pill would only repeat its header. */
                tag={section.cat ? undefined : (catMap[item.category] || {}).tag}
                first={!section.cat && index === 0}
                lead={!!section.cat && index === 0} />
            )}
          />
        )}
      </View>
    </View>
  );
}
