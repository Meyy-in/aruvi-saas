/* ───────── The web's styles, measured (2026-09-13) ─────────
 *
 * CLAUDE.md §4: the phone matches the web. This is the mechanism for the SKIN: every style
 * below is keyed by the web's own CSS class name and carries the values READ FROM THE LIVE
 * WEB at phone width (Chrome, iPhone 12 Pro emulation, 390×844, getComputedStyle — font
 * family/size/line-height/weight/style/letter-spacing/transform, colours, padding, borders).
 * Colours are mapped to the theme tokens they resolve to, so dark mode follows for free.
 *
 * Rules: (1) a component uses the web class it corresponds to — `ws.uv_tab`, `ws.kicker` —
 * never a made-up scale; (2) when the web's CSS changes, re-measure and update HERE, not in
 * the component; (3) RN needs explicit lineHeight and picks fonts by NAME, so the weight →
 * family mapping is done once below. Web measurements kept as comments where the mapping is
 * not obvious. Numbers are CSS px at 390 wide, which is what RN's dp is on an iPhone. */
import { useMemo } from "react";
import { useTheme } from "./ThemeContext";

const F = {
  display: (w, italic) => italic ? (w >= 600 ? "Fraunces_600SemiBold_Italic" : "Fraunces_400Regular_Italic")
                                  : (w >= 600 ? "Fraunces_600SemiBold" : w >= 500 ? "Fraunces_500Medium" : "Fraunces_400Regular"),
  body: (w, italic) => italic ? "Newsreader_400Regular_Italic" : (w >= 600 ? "Newsreader_600SemiBold" : w >= 500 ? "Newsreader_500Medium" : "Newsreader_400Regular"),
  mono: (w) => (w >= 700 ? "IBMPlexMono_700Bold" : w >= 600 ? "IBMPlexMono_600SemiBold" : w >= 500 ? "IBMPlexMono_500Medium" : "IBMPlexMono_400Regular"),
};
const UP = "uppercase";

export function webStyles(t, scheme = "light") {
  const cream = "#f3efe6";                 // --bar-ink / cream on pine (both themes)
  /* A few of the web's colours are literal hex INSIDE a rule rather than custom properties on
     :root, so `gen-tokens.py` never saw them and tokens.js has no name for them — and tokens.js
     is generated and must not be hand-edited. They are resolved here instead, per theme, from
     the rule that owns them. Each one cites its line in globals.css so a palette change has a
     place to land.
       peek wheel   .fr-wheel-shell.peek  + its dark override            (globals.css 4628, 4633)
       year plan    --yp-card, scoped to .yp rather than :root           (globals.css 4686, 4687) */
  const dk = scheme === "dark";
  const wheelBg = dk ? "#1f2c26" : "#ffffff";
  const wheelEdge = dk ? "#2f4139" : "#c7d9cf";
  const ypCard = dk ? "#1f2c26" : "#ffffff";
  return {
    /* ── page + shell ── */
    body:            { fontFamily: F.body(400), fontSize: 17, lineHeight: 26.35, color: t.ink },
    main:            { paddingHorizontal: 18, paddingTop: 26, paddingBottom: 72 },
    hdr_brand_tag:   { fontFamily: F.mono(400), fontSize: 10, lineHeight: 11, letterSpacing: 1.8, textTransform: UP, color: t.bar_ink_soft, marginTop: 2 },
    /* ── the bar's own row (.hdr) and what sits at its ends — measured 2026-09-13, 390×844 ──
       The bar is 64 tall because the STACKED brand lockup is 35 and the row centres it in 29 of
       padding. The mark and "lesson studio" are a COLUMN (.brand): side by side they read as a
       different product. At the right end, the gear then the identity block, which stacks the
       mobile number over its own Log out, right-aligned. */
    hdr:             { flexDirection: "row", alignItems: "center", columnGap: 18,
                       paddingHorizontal: 18, width: "100%", maxWidth: 860, alignSelf: "center" },
    hdr_brand:       { flexDirection: "column" },
    hdr_user:        { flexDirection: "row", alignItems: "center", columnGap: 14, marginLeft: "auto" },
    hdr_gear:        { fontSize: 18, lineHeight: 22, padding: 4, color: t.bar_ink_soft },
    hdr_user_id:     { flexDirection: "column", alignItems: "flex-end", rowGap: 2 },
    hdr_user_name:   { fontFamily: F.mono(400), fontSize: 11, lineHeight: 17.05, letterSpacing: 0.33, color: t.bar_ink },
    hdr_user_logout: { fontFamily: F.mono(400), fontSize: 10, lineHeight: 13, letterSpacing: 0.6,
                       textTransform: UP, color: t.bar_ink_soft },

    /* ── My Classes' header (.dash-hd) and its card list (.sc-list) ──
       The time-of-day greeting is the screen's opening line. The sub-line appears only once at
       least one section is bound — before that the welcome copy speaks instead. */
    dash_hd:         { paddingTop: 6, paddingBottom: 10, marginBottom: 2 },
    dash_title:      { fontFamily: F.display(500), fontSize: 20, lineHeight: 31, marginTop: 2, color: t.ink },
    dash_sub:        { fontFamily: F.body(400), fontSize: 13, lineHeight: 20.15, marginTop: 2, color: t.ink_soft },
    dash_welcome_title: { fontFamily: F.display(500), fontSize: 20, lineHeight: 31, color: t.ink },
    dash_welcome_sub:   { fontFamily: F.body(400), fontSize: 13, lineHeight: 20.15, marginTop: 2, color: t.ink_soft },
    sc_list:         { rowGap: 9, marginTop: 4 },
    main_tab:        { fontFamily: F.mono(400), fontSize: 14, letterSpacing: 1.12, textTransform: UP, color: t.pine_d, paddingVertical: 13, paddingHorizontal: 1, borderBottomWidth: 3, borderBottomColor: "transparent" },
    main_tab_on:     { borderBottomColor: t.clay },
    kicker:          { fontFamily: F.mono(500), fontSize: 10.5, lineHeight: 16.275, letterSpacing: 1.89, textTransform: UP, color: t.pine },
    empty:           { fontFamily: F.body(400), fontSize: 14, lineHeight: 21, color: t.ink_soft },

    /* ── bottom nav (.bnav / .bnav-in / .bnav-item) — measured 2026-09-13, 390×844, light ──
       Bar 56.85 tall over the safe-area inset; a 1 px --edge top rule; contents capped to
       --shell-w (860) and centred, so on a Mac the four items sit over the content column.
       Label line-height is the CSS `normal` for 10.5 px IBM Plex Mono, measured at 13.75.
       Colours are applied by the component from the theme (paper_sunk / edge / ink_soft /
       clay) so dark mode follows for free. */
    bnav:            { borderTopWidth: 1, width: "100%" },
    bnav_in:         { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end",
                       width: "100%", maxWidth: 860, alignSelf: "center",
                       paddingTop: 7, paddingHorizontal: 4, paddingBottom: 4 },
    bnav_item:       { flexDirection: "column", alignItems: "center", width: 84, rowGap: 3 },
    bnav_label:      { fontFamily: F.mono(400), fontSize: 10.5, lineHeight: 13.75, letterSpacing: 1.05,
                       textTransform: UP, color: t.ink_soft },
    bnav_rule:       { width: 22, height: 2.5, borderRadius: 2, marginTop: 1, backgroundColor: "transparent" },

    /* ── the legal documents (.lgl-*) — measured 2026-09-16, 390×844, light ─────────────
       Founder: "privacy notice of expo/iphone to match font of web app". The phone's legal
       screens were the one family still drawing from `theme/type`, whose `body` is 17px — the
       whole notice rendered a third larger than the web's 13px prose, and a bold run inside a
       paragraph jumped to 17 with it, because `type.bodyStrong` states a SIZE as well as a face.
       ⚠️ So `lgl_b`/`lgl_i` carry a FACE AND NOTHING ELSE. A nested Text that names a size stops
       inheriting the paragraph it sits in, which is what made emphasis grow mid-sentence.
       ⚠️ `.ob-title` computes at weight 700 and the bundled Fraunces stops at 600 — the semibold
       cut is the heaviest we ship. */
    lgl_title:       { fontFamily: F.display(600), fontSize: 18, lineHeight: 27.9, color: t.ink,
                       marginBottom: 2 },                       // .lgl-frame .lgl-head .ob-title
    lgl_h2:          { fontFamily: F.display(600), fontSize: 15.5, lineHeight: 24.025, color: t.ink,
                       marginTop: 20, marginBottom: 8 },
    lgl_h3:          { fontFamily: F.mono(400), fontSize: 11, lineHeight: 17.05, letterSpacing: 0.88,
                       textTransform: UP, color: t.ink_soft, marginTop: 16, marginBottom: 6 },
    lgl_p:           { fontFamily: F.body(400), fontSize: 13, lineHeight: 22.1, color: t.ink,
                       marginBottom: 10 },
    lgl_b:           { fontFamily: F.body(600) },
    lgl_i:           { fontFamily: F.body(400, true) },
    lgl_ul:          { marginBottom: 12, paddingLeft: 18 },
    lgl_li:          { fontFamily: F.body(400), fontSize: 13, lineHeight: 22.1, color: t.ink,
                       marginBottom: 6 },
    lgl_hr:          { borderTopWidth: 1, marginTop: 18, marginBottom: 18 },   // colour: t.line
    /* Tables STACK below 600 on the web, each row a card with its column heading above every
       cell — the phone's only rule, and now the same measures. */
    lgl_tablewrap:   { marginTop: 6, marginBottom: 14 },
    lgl_tr:          { borderWidth: 1, borderRadius: 10, paddingTop: 8, paddingRight: 12,
                       paddingBottom: 6, paddingLeft: 12, marginBottom: 8 },  // bg card_bg, border line
    lgl_td:          { paddingTop: 4, paddingBottom: 8 },
    lgl_th:          { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15.5, letterSpacing: 0.8,
                       textTransform: UP, color: t.pine_d, marginBottom: 2 },
    lgl_td_t:        { fontFamily: F.body(400), fontSize: 13, lineHeight: 20.15, color: t.ink },
    /* ── Settings › Legal (6b·G) — the two-document switch, and READ mode's own pieces
       (`.lgl-switch*` 5252-5259, `.lgl-accepted` 5083-5087, `.lgl-hint` 5079, `.lgl-intro`
       5088-5089, `.lgl-acks` 5102-5112, `.lgl-agreement` 5123). Measured 2026-09-16.
       ★ The unselected pill is `ink`, NOT `ink_soft` (founder, 2026-09-04: "grey is too light")
       — it carries the OTHER document's name, and a name must be readable, not a hint.
       ⚠️ NEW KEYS: invisible to Fast Refresh until a real app start. */
    lgl_switch:      { flexDirection: "row", columnGap: 6, marginBottom: 14 },
    lgl_switch_btn:  { borderWidth: 1, borderRadius: 999, paddingVertical: 6,
                       paddingHorizontal: 12 },
    lgl_switch_t:    { fontFamily: F.mono(400), fontSize: 11, letterSpacing: 0.66,
                       textTransform: UP },
    /* READ mode leads with the fact she came for: did I accept this, and when. */
    lgl_accepted:    { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
                       marginBottom: 16 },
    lgl_accepted_t:  { fontFamily: F.body(400), fontSize: 13, lineHeight: 20.8 },
    lgl_tick:        { fontFamily: F.body(600) },
    lgl_stale:       { fontFamily: F.body(400, true) },
    lgl_hint:        { fontFamily: F.body(400), fontSize: 13, lineHeight: 20.8,
                       marginBottom: 14 },
    lgl_intro:       { marginBottom: 4 },
    lgl_acks:        { marginTop: 14 },
    lgl_ack:         { borderWidth: 1, borderRadius: 12, paddingVertical: 14,
                       paddingHorizontal: 15, marginBottom: 12 },
    lgl_ack_head:    { flexDirection: "row", alignItems: "baseline", columnGap: 10,
                       marginBottom: 8 },
    lgl_ack_n:       { fontFamily: F.mono(400), fontSize: 12, lineHeight: 19.575 },
    lgl_ack_title:   { flex: 1, minWidth: 0, fontFamily: F.display(600), fontSize: 14.5,
                       lineHeight: 19.575 },
    lgl_agreement:   { marginTop: 20, paddingTop: 16, borderTopWidth: 1 },
    /* The pinned band's heading — `.ob-title`, 21px display. ⚠️ The web computes it at weight
       700 and the bundled Fraunces stops at 600; the semibold cut is the heaviest we ship. */
    ob_title:        { fontFamily: F.display(600), fontSize: 21, lineHeight: 27.3 },
    /* `.set-plan-txt` — About Meyy's one card, and the Support confirmation's paragraph.
       ⚠️ CORRECTED 2026-09-16: it read 13/20.8, which is 13×1.6 and matches no rule in
       globals.css. The rule is `font-size: 12.5px; line-height: 1.45` and has NO padding — the
       card's inset is About's own and now lives in `set_card_inset`. One key, one rule. */
    set_plan_txt:    { fontFamily: F.body(400), fontSize: 12.5, lineHeight: 18.125 },

    lgl_version:     { fontFamily: F.mono(400), fontSize: 10.5, lineHeight: 16.8, letterSpacing: 0.42,
                       color: t.ink_soft, marginTop: 16 },
    lgl_fail:        { fontFamily: F.body(400), fontSize: 13.5, lineHeight: 21.6, color: t.danger },

    /* ── the front door (.ob-* · .login-* · .fr-secure) — measured 2026-09-16, 390×844, light ──
       The login and OTP screens predate `web.js` and still draw their primitives from
       `components/ui.jsx`; these are the keys the 5e parity pass needed, measured off the running
       web at 390 (an iframe at that width, because the extension could not resize the window and
       the ≤600px rules are the ones that matter).
       ⚠️ `.ob-headline` computes at weight 700 and `.ob-tick` at 700; the bundled Fraunces and
       Newsreader cuts stop at 600, so both take the semibold face — the heaviest we ship. */
    ob_headline:     { fontFamily: F.display(600), fontSize: 24, lineHeight: 30, color: t.ink,
                       marginTop: 4, marginBottom: 14 },
    ob_benefits:     { fontFamily: F.body(400), fontSize: 12.5, lineHeight: 22.5, color: t.ink },
    ob_tick:         { fontFamily: F.body(600), fontSize: 12.5, color: t.pine },
    ob_rule:         { borderTopWidth: 1, marginTop: 18, marginBottom: 14 },   // colour: t.line
    login_kicker:    { fontFamily: F.mono(500), fontSize: 10.5, lineHeight: 16.275, letterSpacing: 1.89,
                       textTransform: UP, color: t.pine, marginBottom: 8 },
    login_q:         { fontFamily: F.display(600), fontSize: 23, lineHeight: 26.45, color: t.ink,
                       marginBottom: 10 },
    fr_secure:       { fontFamily: F.body(400), fontSize: 12, lineHeight: 18.6, color: t.ink_soft },
    lgl_link:        { fontFamily: F.body(400), fontSize: 12, lineHeight: 18.6, color: t.pine,
                       textDecorationLine: "underline" },

    /* ── subject bands (.sc-bands / .sc-band / .sc-band-hd) — the web's 2026-08-30 grouping ──
       Only a teacher with MORE THAN ONE subject sees any of this; a one-subject list keeps the
       plain `sc_list` and renders none of it. The subject is a STRUCTURAL label, so it takes the
       house's mono uppercase kicker under a ledger hairline rather than a display-serif heading
       that would compete with the chapter titles below it, and it carries pine_d rather than
       ink_soft because it is the spine of the list, not a caption on it (globals.css 2545-2551).
       The band owns the outer margin so the inner list can sit tight under its own heading —
       hence `sc_band_list`, which replaces `sc_list`'s 4px top with the web's 7. */
    sc_bands:        { marginTop: 4, marginBottom: 22 },
    sc_band_gap:     { marginTop: 20 },   // .sc-band + .sc-band — every band but the first
    sc_band_hd:      { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15.5, letterSpacing: 1.4,
                       textTransform: UP, color: t.pine_d, paddingBottom: 5,
                       borderBottomWidth: 1, borderBottomColor: t.line },
    sc_band_list:    { rowGap: 9, marginTop: 7 },

    /* ── section card (.sc-card + children) — measured 2026-09-13, 390×844, light ──
       Three states carry the teaching status in the FILL (founder 2026-08-30): st-new sand,
       st-going green, st-done clay, each with its own edge; the 4px left spine repeats it.
       The component applies the colours from the theme (card_new/going/done + _edge, card_tick,
       pine, ochre, clay) so dark follows for free. The 11px graph rule the web draws as a
       background-image is NOT ported — RN has no repeating gradient; the card keeps its fill. */
    sc_card:         { flexDirection: "row", alignItems: "center", columnGap: 13, borderWidth: 1,
                       borderRadius: 11, paddingTop: 10, paddingRight: 15, paddingBottom: 10, paddingLeft: 17,
                       position: "relative", overflow: "hidden" },
    sc_spine:        { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
    sc_tag:          { fontFamily: F.display(500), fontSize: 20, lineHeight: 24, minWidth: 40, color: t.pine_d },
    sc_tag_muted:    { color: t.card_muted },
    sc_tag_name:     { fontFamily: F.mono(400), fontSize: 9.5, lineHeight: 12.35, letterSpacing: 0.29,
                       maxWidth: 76, marginTop: 2, color: t.card_muted },
    sc_body:         { flex: 1, minWidth: 0, rowGap: 4 },
    sc_kicker:       { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15.5, letterSpacing: 1,
                       textTransform: UP, color: t.card_muted },
    sc_title:        { fontFamily: F.body(400), fontSize: 15, lineHeight: 19.2, color: t.ink },
    sc_title_muted:  { fontFamily: F.body(400, true), color: t.card_muted },
    sc_durline:      { fontFamily: F.mono(400), fontSize: 9.5, letterSpacing: 0.57, marginTop: 2, color: t.card_muted },
    sc_rail:         { flexDirection: "row", columnGap: 2, height: 5 },
    sc_tick:         { height: 5, flex: 1, maxWidth: 26, borderRadius: 2, backgroundColor: t.card_tick },
    sc_right:        { flexDirection: "column", alignItems: "flex-end", rowGap: 6 },
    sc_actions_col:  { flexDirection: "column", alignItems: "flex-end", rowGap: 6, alignSelf: "stretch" },
    sc_status_done:  { fontFamily: F.mono(400), fontSize: 9, letterSpacing: 0.9, textTransform: UP, color: t.clay },
    /* "+" track (pine) and "−" untrack (clay): one position, opposite acts. */
    sc_round:        { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: t.line,
                       backgroundColor: t.paper_2, alignItems: "center", justifyContent: "center" },
    sc_round_glyph:  { fontSize: 20, lineHeight: 22 },

    /* ── the "+" track-a-chapter picker (.ap-*) and its chapter rows (.ch-*) ── */
    ap_overlay:      { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
    /* The dimmed ground, absolutely filling the overlay BEHIND the card rather than wrapping it
       — see AttachSheet.jsx's note. The colour lives here and not on `ap_overlay` because the
       overlay is now only a layout box; the thing that is tappable is the thing that is dim. */
    ap_ground:       { position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
                       backgroundColor: "rgba(31,42,36,.42)" },
    ap_modal:        { width: "100%", maxWidth: 460, borderRadius: 14, borderWidth: 1,
                       paddingTop: 22, paddingHorizontal: 22, paddingBottom: 18 },
    ap_confirm:      { maxWidth: 420 },
    /* A window that must hold a tall edit: capped so it can never run off the screen, and its
       body scrolls inside. The web's `.ap-modal` has been `max-height: min(82vh, 100%)` since
       2026-08-27 — `maxHeight: "82%"` is the same ceiling in the units RN has, measured against
       the window rather than a viewport unit that counts area behind the browser chrome. */
    ap_modal_tall:   { maxHeight: "82%" },
    /* ───── the two pick screens (`.tp-portal-*`, globals.css 3013-3023) ─────
       A row is a NAVIGATION row, not a pick: display serif 15, paper-2 on a hairline, r12, with
       the same "›" the portal's rows carry. No hover pair (`:hover` has no counterpart on a
       phone — a technical limitation, CLAUDE.md §4) and no `cursor`. `justifyContent:
       space-between` with the label first is what puts the chevron hard right. */
    tp_portal_list:  { rowGap: 8, marginTop: 14, marginBottom: 18 },
    tp_portal_row:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                       columnGap: 10, paddingVertical: 13, paddingHorizontal: 16,
                       borderWidth: 1, borderRadius: 12 },
    tp_portal_label: { flex: 1, minWidth: 0, fontFamily: F.display(500), fontSize: 15,
                       lineHeight: 20, color: t.ink },
    tp_portal_go:    { fontFamily: F.body(400), fontSize: 17, lineHeight: 20 },
    ap_scrollbody:   { flexGrow: 0, flexShrink: 1 },
    ap_scrollpad:    { paddingBottom: 4 },
    ap_close:        { position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 15,
                       borderWidth: 1, alignItems: "center", justifyContent: "center" },
    ap_close_glyph:  { fontSize: 13, lineHeight: 15 },
    /* ★ A STEP BACK BELONGS IN THE HEADER, NOT AT THE FOOT (founder, 2026-09-15: "each of them
       should have 'x' on top right to click off back to previous screen instead of back button
       saving height"). The ✕ closes; this mirrors it on the LEFT and appears only where there is
       a previous STEP to return to — the duration step, which is reached through periods a week.
       A footer link cost a whole row of a window whose height has been the standing problem, and
       said nothing the two corners do not say better. */
    ap_back:         { position: "absolute", top: 12, left: 12, width: 30, height: 30, borderRadius: 15,
                       borderWidth: 1, alignItems: "center", justifyContent: "center" },
    ap_back_glyph:   { fontSize: 14, lineHeight: 16 },
    ap_head:         { marginBottom: 14, paddingRight: 30 },
    ap_kicker:       { fontFamily: F.mono(400), fontSize: 10.5, lineHeight: 15, letterSpacing: 1.26,
                       textTransform: UP, color: t.ochre },
    ap_title:        { fontFamily: F.display(500), fontSize: 21, lineHeight: 26, color: t.ink, marginTop: 4 },
    ap_sub:          { fontFamily: F.body(400), fontSize: 13, lineHeight: 19, color: t.ink_soft, marginTop: 3 },
    /* The `<b>` inside `.ap-sub` — the subject and the stage in the check window's line. A nested
       Text, because RN picks a face by NAME: `fontWeight: "600"` on a bundled static cut does
       nothing, so the emphasis has to be the semibold family itself. Colour and metrics are
       inherited from `ap_sub`, so only the face is stated here. */
    ap_sub_b:        { fontFamily: F.body(600) },
    ap_list:         { rowGap: 8, marginBottom: 4 },
    ap_row:          { rowGap: 6, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10,
                       borderWidth: 1, borderColor: t.line_soft, backgroundColor: t.paper_2 },
    ap_none:         { fontFamily: F.body(400, true), fontSize: 13, lineHeight: 19, color: t.ink_soft,
                       paddingVertical: 8, paddingHorizontal: 2 },
    ap_actions:      { flexDirection: "row", justifyContent: "flex-end", columnGap: 10, marginTop: 2 },
    ap_btn:          { borderRadius: 7, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 15 },
    ap_btn_label:    { fontFamily: F.mono(400), fontSize: 11, letterSpacing: 0.55, textTransform: UP },
    /* ── the paywall window (`.paywall-card/-msg/-subscribe/-later`, globals.css 3987-4000) ──
       Measured 2026-09-16 from the web's own rules. The phone's Sheet supplies the card and the
       ✕; these are the CONTENTS, and the shape is what parity means here: the web's card is
       CENTRED, where every other window in this app is left-aligned. That is not an accident of
       CSS — a paywall is one statement and one choice, not a form, so the eye is given a column
       rather than a margin to run down. The Sheet's own header is skipped entirely (pass no
       kicker/title/sub) because it would left-align the kicker above a centred body.
       ⚠️ NEW KEYS, so `useWebStyles`' useMemo cannot see them until a real app start — Fast
       Refresh will render this window unstyled. Reload before judging it. */
    paywall_body:    { alignItems: "center", rowGap: 4 },
    paywall_msg:     { fontFamily: F.body(400), fontSize: 15, lineHeight: 23.25, color: t.ink,
                       marginTop: 8, textAlign: "center" },
    paywall_sub:     { borderRadius: 5, paddingVertical: 10, paddingHorizontal: 26, marginTop: 16 },
    paywall_sub_t:   { fontFamily: F.mono(700), fontSize: 13, letterSpacing: 0.78, textTransform: UP },
    paywall_later:   { fontFamily: F.body(400, true), fontSize: 12.5, color: t.ink_soft, marginTop: 10,
                       paddingVertical: 4, paddingHorizontal: 8 },
    /* The "not yet" note Subscribe raises until 6b's billing view exists (founder's Q6 answer). */
    paywall_soon:    { fontFamily: F.body(400), fontSize: 14, lineHeight: 21, color: t.ink_soft,
                       marginTop: 8, textAlign: "center" },

    ch_meta:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 10 },
    ch_name:         { fontFamily: F.body(400), fontSize: 15, lineHeight: 19.2, color: t.ink, flex: 1, minWidth: 0 },
    ch_no:           { color: t.pine_d, fontFamily: F.body(500) },
    ch_go:           { fontFamily: F.body(400), fontSize: 19, lineHeight: 19, color: t.ink_soft },

    /* ── the profile portal window (`.ap-grow`, globals.css 2761-2800) — Track D 5d ──
       A SHORT window: four one-line rows, a footer and a ✕ is a lot for a 360px phone, so
       everything here is deliberately tighter than the chapter picker it borrows its chrome from.
       ⚠️ `.ap-row.ap-row-line` exists at (0,2,0) rather than (0,1,0) because the web once wrote
       it BEFORE `.ap-row` in the file, tied on specificity, lost on source order, and kept
       `flex-direction: column` — which put the name on one line and the "›" on the next, doubled
       the window's height and pushed the ✕ off the top of a phone. On RN there is no cascade to
       lose, so the row style below simply IS the line form. */
    ap_grow_head:    { marginBottom: 10 },
    ap_grow_list:    { rowGap: 6 },
    ap_row_line:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                       columnGap: 10, paddingVertical: 11, paddingHorizontal: 14 },
    /* Takes the slack so the value and the chevron pack together on the RIGHT. Without it
       `space-between` strands a three-child row's value in the middle of the line, where it reads
       as a second label rather than as this row's answer. */
    ap_row_label:    { flex: 1, minWidth: 0, fontFamily: F.body(400), fontSize: 15, lineHeight: 18 },
    /* The current value, CHECK mood only. Mono, smaller and soft, because the NAME is what she is
       choosing between and the value is what she is checking — the row must still scan as a list
       of things to open, not as a table. `numberOfLines={1}` stands in for `white-space: nowrap`:
       a value that wrapped would recreate the two-line row the note above spent a bug fixing. */
    ap_row_val:      { flexGrow: 0, flexShrink: 0, fontFamily: F.mono(400), fontSize: 11.5,
                       letterSpacing: 0.23 },
    /* The footer must NOT read as a fifth row: the rows above are spot edits with card chrome,
       this is the panorama. A hairline-topped line of text, outside the list. */
    ap_foot:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                       columnGap: 10, width: "100%", marginTop: 8,
                       paddingTop: 10, paddingBottom: 0, paddingHorizontal: 2, borderTopWidth: 1 },
    ap_foot_t:       { fontFamily: F.body(400), fontSize: 13.5, lineHeight: 17.55 },
    ap_foot_go:      { fontFamily: F.body(400), fontSize: 17, lineHeight: 17 },

    /* ── LessonView header (.lv-hd / .co-topbar / .lv-title) ── */
    lv_stick:        { paddingTop: 18, paddingBottom: 10, backgroundColor: t.paper },
    lv_hd:           { paddingBottom: 6, marginBottom: 10 },
    co_topbar:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 2, paddingBottom: 8 },
    back_tr:         { fontFamily: F.mono(600), fontSize: 12, letterSpacing: 0.72, textTransform: UP, color: t.pine, borderWidth: 1, borderColor: t.pine, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 15, height: 30, lineHeight: 16 },
    lv_title:        { fontFamily: F.display(500), fontSize: 19.5, lineHeight: 30.225, color: t.ink },
    lv_unum:         { fontFamily: F.display(600, true), fontSize: 19.5, lineHeight: 30.225, color: t.clay, marginRight: 9 },
    uv_durline:      { fontFamily: F.body(400, true), fontSize: 13, lineHeight: 19.5, color: t.ink_soft },

    /* ── unit tabs (.uv-tabs / .uv-tab) ── */
    uv_tabs:         { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: t.line, marginTop: 2 },
    uv_tab:          { paddingTop: 9, paddingBottom: 8, paddingHorizontal: 2, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: "transparent", flex: 1, alignItems: "center" },
    uv_tab_t:        { fontFamily: F.mono(400), fontSize: 11, letterSpacing: 0.77, textTransform: UP, color: t.ink_soft },
    uv_tab_on:       { borderBottomColor: t.clay },
    uv_tab_on_t:     { fontFamily: F.mono(700), color: t.clay },

    /* ── Overview ledger (.uv-ovrows / .uv-ovrow / .uv-ovval) ── */
    uv_ovrows:       { marginBottom: 16 },
    uv_ovrow:        { flexDirection: "row", alignItems: "baseline", gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: t.line_soft },
    uv_ovval:        { fontFamily: F.body(400), fontSize: 13.5, lineHeight: 20.925, color: t.ink, flex: 1 },

    /* ── Material (.uv-mat) ── */
    uv_mat:          { backgroundColor: t.paper_sunk, borderWidth: 1, borderColor: t.edge, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 13 },
    uv_mat_li:       { fontFamily: F.body(400), fontSize: 14, lineHeight: 21, color: t.ink, paddingVertical: 3, paddingLeft: 16 },
    uv_va_kicker:    { marginTop: 10 },
    uv_va_prose:     { fontFamily: F.body(400), fontSize: 14, lineHeight: 21, color: t.ink, marginTop: 6 },
    uv_va_src:       { fontFamily: F.body(400, true), fontSize: 12.5, lineHeight: 18, color: t.ink_soft, marginTop: 6 },

    /* ── Lesson: teacher-notes ribbon (.uv-tnotes-rib) ── */
    uv_tnotes_rib:   { backgroundColor: t.paper_sunk, borderLeftWidth: 3, borderLeftColor: t.clay, borderBottomWidth: 1, borderBottomColor: t.edge_clay, marginBottom: 12 },
    uv_tnotes_sum:   { flexDirection: "row", alignItems: "baseline", gap: 9, paddingVertical: 8, paddingHorizontal: 12 },
    uv_tnotes_k:     { fontFamily: F.mono(500), fontSize: 10.5, lineHeight: 16.275, letterSpacing: 1.89, textTransform: UP, color: t.clay },
    uv_tnotes_teaser:{ fontFamily: F.body(400, true), fontSize: 13, lineHeight: 20.15, color: t.ink_soft, flex: 1 },
    uv_tnotes_p:     { fontFamily: F.body(400, true), fontSize: 14.5, lineHeight: 23.2, color: t.ink, paddingHorizontal: 12, paddingBottom: 10 },
    uv_tnotes_ref:   { fontFamily: F.body(600) },

    /* ── Lesson: the phase spine (.uv-phases / .uv-phase / .uv-ph-*) ── */
    uv_phases:       { marginTop: 2, position: "relative" },
    /* ⚠️ THE RULE BETWEEN PHASES IS CLAY, NOT A NEUTRAL HAIRLINE (founder, 2026-09-15: "the clay
       thin separator line in web app for each phase is missing in expo/phone"). The web is
       `.uv-phase + .uv-phase { border-top: 1px solid var(--clay) }` — the adjacent-sibling form,
       so the rule falls only BETWEEN phases, never above the first or below the last. The phone
       expresses the same geometry as a bottom border dropped on the last row (LessonView), which
       renders identically; what had drifted was the COLOUR — `line_soft` is the app's quiet
       hairline and this rule is not quiet. It is the one that says a phase has ended, and
       globals.css calls it out by name as the weight the bottom nav's own edge matches. */
    uv_phase:        { flexDirection: "row", gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: t.clay },
    uv_ph_time:      { width: 34 },
    /* ───── a phase row ARMED as a bookmark target (phone-only, 2026-09-15) ─────
       No web counterpart: the web's bookmark is dragged with a pointer, which has no body and
       hides nothing, so its rows never become targets. `tint_pine` is the app's own selection
       tint — the one the section wheel already uses for a ticked row — so arming reads as "this
       is selectable", in a colour the teacher has met before. Exactly one row wears it at a
       time — the phase the arrow is over — and only while her finger is down. */
    uv_phase_arm:    { backgroundColor: t.tint_pine, borderRadius: 6,
                       marginHorizontal: -8, paddingHorizontal: 8 },
    uv_ph_n:         { fontFamily: F.mono(600), fontSize: 16, lineHeight: 17.6, color: t.pine },
    uv_ph_u:         { fontFamily: F.mono(400), fontSize: 9, lineHeight: 13.95, letterSpacing: 1.26, textTransform: UP, color: t.ink_soft, marginTop: 2 },
    uv_ph_t:         { fontFamily: F.body(400), fontSize: 13, lineHeight: 20.54, color: t.ink, flex: 1 },
    phaserow:        { fontFamily: F.body(400), fontSize: 13, lineHeight: 20.54, color: t.ink, paddingVertical: 8 },
    uv_hw:           { backgroundColor: t.tint_cream, borderWidth: 1, borderColor: t.edge, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 13, marginTop: 14 },
    uv_hw_p:         { fontFamily: F.body(400), fontSize: 14, lineHeight: 21, color: t.ink, marginTop: 4 },

    /* ── completion (.lv-markcard / .lv-markbtn / .lv-donecard) ── */
    lv_markcard:     { marginTop: 18 },
    lv_markbtn:      { backgroundColor: t.pine, borderRadius: 3, minHeight: 44, paddingVertical: 11, paddingHorizontal: 22, alignItems: "center", justifyContent: "center" },
    lv_markbtn_t:    { fontFamily: F.mono(400), fontSize: 12, letterSpacing: 0.96, textTransform: UP, color: "#f6f1e7" },
    lv_donecard:     { marginTop: 18, borderWidth: 1, borderColor: t.pine, backgroundColor: t.tint_pine, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    lv_chapterdone:  { borderColor: t.ochre, backgroundColor: t.tint_cream },
    lv_donemark:     { fontFamily: F.display(600), fontSize: 18, color: t.pine, marginRight: 10 },
    lv_donetitle:    { fontFamily: F.display(500), fontSize: 16, color: t.ink },
    lv_undo:         { fontFamily: F.mono(600), fontSize: 11, letterSpacing: 0.66, textTransform: UP, color: t.pine },

    /* ── the pvNav strip (.lv-pvnav) ── */
    lv_pvnav:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: t.clay, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 13, marginTop: 16, marginBottom: 4 },
    lv_pvbtn:        { fontFamily: F.mono(700), fontSize: 11, lineHeight: 15.4, color: t.paper },
    lv_pvbtn_off:    { opacity: 0.45 },
    lv_pvmid:        { fontFamily: F.mono(700), fontSize: 11, lineHeight: 15.4, letterSpacing: 0.88, textTransform: UP, color: t.paper, opacity: 0.82 },

    /* ── Assess (.uv-assess-stick / .uv-apager / .assess-*) ── */
    /* ── the assessment pager (.uv-apager) — the PINE BAND, measured 2026-09-14 ──
       It appears only when a unit anchors more than one item, and it is a filled band, not a row
       of links: pine, 6px radius, cream ink. The first Expo cut had it as bare text on paper
       (no fill, no radius, pine ink, both labels uppercased), so on the phone the band simply
       was not there — founder-reported. The two quieter inks take the button's own token at
       reduced opacity rather than a literal cream, so the band holds in dark too, where --pine
       is a mid green and a cream sibling would read inverted against the near-black button. */
    uv_apager:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                       backgroundColor: t.pine, borderRadius: 6,
                       paddingVertical: 5, paddingHorizontal: 13, marginTop: -6, marginBottom: 14 },
    uv_apgbtn:       { fontFamily: F.mono(700), fontSize: 11, lineHeight: 15.4, color: t.paper },
    uv_apgbtn_off:   { opacity: 0.42 },
    uv_apgmid:       { fontFamily: F.mono(400), fontSize: 10, lineHeight: 14, letterSpacing: 0.8,
                       textTransform: UP, color: t.paper, opacity: 0.85 },
    assess_mtabs:    { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: t.line },
    assess_mt:       { paddingTop: 8, paddingBottom: 7, paddingHorizontal: 1, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: "transparent", flex: 1, alignItems: "center" },
    assess_mt_t:     { fontFamily: F.mono(400), fontSize: 10.5, letterSpacing: 0.42, textTransform: UP, color: t.ink_soft },
    assess_mt_on:    { borderBottomColor: t.pine },
    assess_mt_on_t:  { fontFamily: F.mono(700), color: t.pine },
    assess_flat:     { marginTop: 12 },
    assess_qmark:    { fontFamily: F.display(600, true), fontSize: 15, color: t.clay, marginBottom: 4 },
    assess_ovlo:     { paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: t.line_soft, marginBottom: 4 },
    assess_ovk:      { fontFamily: F.mono(700), fontSize: 10, lineHeight: 15.5, letterSpacing: 1, textTransform: UP, color: t.ink_soft, paddingTop: 3 },
    assess_ovlo_t:   { fontFamily: F.body(400), fontSize: 14, lineHeight: 21, color: t.ink, marginTop: 4 },
    assess_tabnav:   { fontFamily: F.mono(400), fontSize: 11, lineHeight: 17.05, letterSpacing: 0.44, color: t.pine, alignSelf: "flex-end", marginTop: 6 },
    assess_prompt:   { fontFamily: F.body(400), fontSize: 13.5, lineHeight: 20.25, color: t.ink, marginTop: 6 },
    assess_opts2:    { marginTop: 10 },
    assess_opt:      { flexDirection: "row", alignItems: "baseline", gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: t.line_soft },
    assess_opt_lab:  { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15, color: t.pine, width: 14 },
    assess_opt_t:    { fontFamily: F.body(400), fontSize: 13.5, lineHeight: 20.25, color: t.ink, flex: 1 },
    assess_look:     { marginTop: 11 },
    assess_look_k:   { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15.5, letterSpacing: 1, textTransform: UP, color: t.pine },
    assess_look_t:   { fontFamily: F.body(400), fontSize: 13.5, lineHeight: 20.25, color: t.ink, marginTop: 3 },
    assess_tick:     { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingVertical: 2 },
    assess_corr_row: { flexDirection: "row", gap: 8, paddingVertical: 2, alignItems: "baseline" },
    assess_tickmark: { color: t.pine, fontSize: 11 },
    assess_rev:      { marginTop: 3 },
    assess_revrow:   { flexDirection: "row", gap: 8, marginVertical: 4, alignItems: "flex-start" },
    assess_rev_lab:  { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15, color: t.pine, width: 14, paddingTop: 1 },
    assess_rev_choice:{ fontFamily: F.mono(400), fontSize: 9.5, letterSpacing: 0.38, textTransform: UP, color: t.pine, backgroundColor: t.tint_pine, borderWidth: 1, borderColor: t.edge_green, borderRadius: 999, paddingVertical: 1, paddingHorizontal: 7, marginLeft: 6, overflow: "hidden" },
    assess_corr_q:   { fontFamily: F.mono(500), fontSize: 9, borderWidth: 1, borderColor: t.pine, color: t.pine, borderRadius: 4, paddingHorizontal: 4, lineHeight: 14 },
    assess_inc:      { fontFamily: F.body(400), fontSize: 13.5, lineHeight: 20.925, color: t.ink },
    assess_inc_strong:{ fontFamily: F.body(600) },
    assess_parts_lead:{ fontFamily: F.body(400), fontSize: 13.5, lineHeight: 20.25, color: t.ink, marginBottom: 6 },
    assess_ansrow:   { flexDirection: "row", gap: 8, alignItems: "baseline", paddingVertical: 3 },
    assess_ans_lab:  { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15, color: t.pine, minWidth: 14 },
    assess_passage:  { borderLeftWidth: 3, borderLeftColor: t.ochre, backgroundColor: t.tint_cream, padding: 12, borderRadius: 6, marginBottom: 10 },
    assess_scaf:     { borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 12, backgroundColor: t.paper_2, marginTop: 4 },
    assess_scaf_row: { fontFamily: F.mono(400), fontSize: 12.5, lineHeight: 20, color: t.ink },
    assess_qtype:    { fontFamily: F.mono(500), fontSize: 10.5, letterSpacing: 1.89, textTransform: UP, color: t.pine },
    assess_lo_k:     { fontFamily: F.mono(400), fontSize: 10, letterSpacing: 1, textTransform: UP, color: t.pine },
    assess_book_item:{ fontFamily: F.body(600) },

    /* ── ChapterOrg (.co-*) ── */
    co_stick:        { paddingTop: 18, paddingBottom: 8, backgroundColor: t.paper },
    co_head:         { paddingTop: 4, paddingBottom: 8 },
    co_title:        { fontFamily: F.display(600), fontSize: 23, lineHeight: 25.76, color: t.ink },
    co_meta:         { fontFamily: F.mono(400), fontSize: 12, lineHeight: 18.6, letterSpacing: 0.24, color: t.ink_soft, marginTop: 9, marginBottom: 6 },
    co_rail:         { flexDirection: "row", gap: 3, marginTop: 6 },
    co_tick:         { flex: 1, height: 4, borderRadius: 2, backgroundColor: t.card_tick },
    co_tick_done:    { backgroundColor: t.pine },
    co_tick_cur:     { backgroundColor: t.clay },
    co_headrule:     { height: 1, backgroundColor: t.clay, marginTop: 8 },
    co_axiswrap:     { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, marginBottom: 16 },
    co_axis:         { flex: 1, gap: 5 },
    co_axis_row:     { fontFamily: F.body(400), fontSize: 13, lineHeight: 19.5, color: t.ink_soft },
    co_axis_name:    { fontFamily: F.body(600), fontSize: 13, lineHeight: 19.5, color: t.pine, marginRight: 7 },
    co_notetab:      { backgroundColor: t.ochre, borderRadius: 8, minHeight: 58, width: 28, alignItems: "center", justifyContent: "center" },
    co_notetab_label:{ fontFamily: F.mono(400), fontSize: 11, letterSpacing: 1.32, textTransform: UP, color: "#fbf6ea" },
    co_groupbar:     { marginTop: 10, marginBottom: 6 },
    /* The spine/section label above a run of units (.co-subname) — mono, sentence case, quiet.
       It was uppercase pine here, which read as a heading competing with the accordion's own
       name; the web sets it as a caption. */
    co_subname:      { fontFamily: F.mono(400), fontSize: 11, lineHeight: 16.5, letterSpacing: 0.33, color: t.ink_soft, flex: 1 },
    /* ★ THE SECTION BOX IS FILLED WHEN CLOSED, PLAIN WHEN OPEN (.co-acc / .co-acc.open).
       Closed axes carry --tint-pine on a --edge-green edge so the choices read AS choices; the
       open one drops to plain --paper so the units inside sit on the page rather than in a
       tinted well. The phone had no fill at all and turned the open one WHITE, which inverted
       the whole idea. */
    co_acc:          { backgroundColor: t.tint_pine, borderWidth: 1, borderColor: t.edge_green,
                       borderRadius: 14, marginBottom: 12, overflow: "hidden" },
    co_acc_open:     { backgroundColor: t.paper, borderColor: t.line },
    co_acchead:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 13 },
    co_acc_name:     { fontFamily: F.display(500), fontSize: 14.5, lineHeight: 20, color: t.ink, flex: 1 },
    co_count:        { fontFamily: F.mono(400), fontSize: 11, color: t.ink_soft },
    co_card:         { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.paper_2, borderWidth: 1, borderColor: t.line, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, marginBottom: 8 },
    /* The CURRENT unit's capsule is ringed in OCHRE, the same ochre as its "now" pill — not
       clay, which is the phase-bookmark's colour elsewhere. */
    co_card_cur:     { borderColor: t.ochre },
    co_card_done:    { borderColor: t.pine },
    /* The sitting's number: clay by default, PINE once taught, and eased back on units still
       ahead — the three states the web gives .co-num. */
    co_num:          { fontFamily: F.display(600, true), fontSize: 15, color: t.clay, minWidth: 20 },
    co_num_done:     { color: t.pine },
    co_num_up:       { opacity: 0.72 },
    co_side:         { flexDirection: "row", alignItems: "center", columnGap: 10 },
    /* ★ NEWSREADER 12, NOT FRAUNCES 13.5 (founder, 2026-09-14) — the parity audit's one
       unresolved divergence, settled toward the web as §4's default says. A unit title is read
       as CONTENT, so it takes the body face, and the web's ≤600px rule is the phone's rule:
       12px over line-height 1.3. Two things the port had missed along with the face:
         · `.co-utitle` drops another notch, to 10.5, for SCIENCE and SOCIAL SCIENCES only
           (globals.css 3819-3822) — those two carry the longest unit titles and were wrapping;
         · `.co-card.done .co-utitle` dims to --ink-soft (3825). The phone dimmed the NUMBER
           (co_num_done) and left the title at full ink, so a taught unit read half-finished. */
    co_utitle:       { fontFamily: F.body(400), fontSize: 12, lineHeight: 15.6, color: t.ink, flex: 1 },
    co_utitle_tight: { fontSize: 10.5, lineHeight: 13.65 },
    co_utitle_done:  { color: t.ink_soft },
    /* ★ "now" is a FILLED OCHRE PILL with paper ink (.co-now) — it was an outlined CLAY pill
       here, which read as a bordered label rather than the one lit marker on the page. */
    co_now:          { fontFamily: F.mono(400), fontSize: 9, letterSpacing: 1.08, textTransform: UP,
                       color: t.paper, backgroundColor: t.ochre, borderRadius: 9,
                       paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
    /* Duration in the phases idiom (.co-dur): a mono number in PINE STACKED over a small "MIN",
       not an inline "40 min". It was inline and grey here. */
    co_dur:          { alignItems: "center" },
    co_dur_n:        { fontFamily: F.mono(600), fontSize: 16, lineHeight: 17.6, color: t.pine },
    co_dur_u:        { fontFamily: F.mono(400), fontSize: 9, letterSpacing: 1.26, textTransform: UP, color: t.ink_soft, marginTop: 2 },
    co_mark:         { fontFamily: F.mono(400), fontSize: 10, color: t.pine },
    co_go:           { color: t.ink_soft, fontSize: 14 },
    /* the SS map (.cof-*) */
    cof_wrap:        { flexDirection: "row", justifyContent: "space-between", gap: 4, paddingTop: 8, paddingBottom: 4, paddingHorizontal: 14, position: "relative" },
    cof_units:       { width: 153, gap: 6 },
    cof_comps:       { width: 108, gap: 10, justifyContent: "space-between" },
    cof_u:           { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 38, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: t.paper, borderWidth: 1, borderColor: t.line_soft, borderRadius: 9 },
    cof_u_cur:       { backgroundColor: t.paper_2, borderColor: t.clay },
    cof_u_done:      { borderColor: t.pine },
    cof_num:         { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15.5, color: t.pine },
    cof_utitle:      { fontFamily: F.display(500), fontSize: 12.5, lineHeight: 15.625, color: t.ink, flex: 1 },
    cof_uopen:       { fontFamily: F.mono(400), fontSize: 14, color: t.pine, paddingVertical: 4, paddingHorizontal: 2 },
    cof_c:           { backgroundColor: t.paper_2, borderWidth: 1, borderColor: t.line, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 10, gap: 4, alignItems: "flex-start" },
    cof_code:        { fontFamily: F.mono(500), fontSize: 12, lineHeight: 18.6, color: t.pine },
    cof_tiername:    { fontFamily: F.mono(400), fontSize: 9, lineHeight: 13.95, letterSpacing: 1.17, textTransform: UP, color: t.ink_soft },
    cof_dots:        { fontSize: 10, lineHeight: 10, letterSpacing: 4, color: t.ink },
    cof_hint:        { fontFamily: F.mono(400), fontSize: 9.5, lineHeight: 14.725, letterSpacing: 1.14, textTransform: UP, color: t.ink_soft, marginTop: 10, marginHorizontal: 18 },
    cof_gap:         { fontFamily: F.body(400, true), fontSize: 13, lineHeight: 19.5, color: t.ink_soft, marginTop: 10, marginHorizontal: 18 },
    cof_pop:         { backgroundColor: t.paper_2, borderLeftWidth: 3, borderRadius: 6, padding: 10, marginVertical: 4, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    cof_pop_t:       { fontFamily: F.body(400), fontSize: 13, lineHeight: 19.5, color: t.ink },
    cof_pop_quiet:   { fontFamily: F.body(400, true), fontSize: 12, lineHeight: 17, color: t.ink_soft, marginTop: 4 },

    /* ── chapter notes modal (.cn-*) ── */
    /* ── chapter notes (.cn-*) — measured 2026-09-14 ──
       A CENTRED CARD over a dimmed page, not a sheet that slides up from the foot: the web is a
       468-wide modal with a hairline under the head and another over the foot, and the writing
       area is RULED PAPER — a line every 32px with the text set at a 32px line-height so she
       writes ON the rules. The first Expo cut was a pageSheet with a plain bordered box, which
       is why it felt like a different thing. */
    cn_scrim:        { flex: 1, backgroundColor: "rgba(31,42,36,.42)", alignItems: "center",
                       justifyContent: "center", padding: 20 },
    /* ★ THE CARD FILLS WHAT IS LEFT, AND THE SHEET IS THE PART THAT GIVES (founder, 2026-09-14).
       flex: 1 under a cap, so the card takes the room between the bar and the keyboard; the head
       and foot never shrink (flexShrink: 0) and the writing sheet absorbs the difference. That
       is what keeps SAVE on screen with the keyboard up — the alternative, a fixed-height card
       pushed below the bar, pushes its own foot off the bottom. */
    cn_modal:        { width: "100%", maxWidth: 468, flex: 1, maxHeight: 620, borderRadius: 12,
                       borderWidth: 1, overflow: "hidden" },
    cn_head:         { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
                       columnGap: 12, paddingTop: 18, paddingHorizontal: 22, paddingBottom: 14,
                       borderBottomWidth: 1, flexShrink: 0 },
    cn_title:        { fontFamily: F.display(600), fontSize: 16, lineHeight: 20, letterSpacing: -0.3,
                       marginTop: 3, color: t.pine_d },
    cn_sg:           { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15, letterSpacing: 0.8,
                       marginTop: 4, color: t.ink_soft },
    cn_scope:        { fontFamily: F.body(400, true), fontSize: 11.5, lineHeight: 16.5,
                       marginTop: 3, color: t.ink_soft },
    /* The child-privacy line is a RULE, not scope information (founder, 2026-08-26): clay,
       UPRIGHT — not italic like the two grey lines above — under its own hairline. */
    cn_warn:         { fontFamily: F.body(400), color: t.clay, marginTop: 6, paddingTop: 5,
                       borderTopWidth: 1 },
    cn_x:            { fontSize: 14, lineHeight: 18, padding: 4, color: t.ink_soft },
    /* The ruled sheet. RULE_H is the web's 32px band; the text carries the same line-height so
       it sits on the rules, and both scroll together (the web's background-attachment: local). */
    /* ⚠️ A FIXED HEIGHT, not flex: 1. The card's height comes from its content (maxHeight only
       caps it), so a flex child had no space to grow into and the sheet rendered at ZERO —
       head and foot with nothing between them, which is exactly what the founder's phone showed.
       The web sets .cn-paper to a fixed 232px, 204px at phone width; that is this number. */
    /* flex: 1 so it takes the slack, minHeight so it stays writable when the keyboard is up and
       the slack is small. The web's fixed 204 is the value it lands on with room to spare. */
    cn_paper_wrap:   { flex: 1, minHeight: 128, backgroundColor: t.paper_2 },
    cn_rule:         { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: t.line },
    cn_paper:        { fontFamily: F.body(400), fontSize: 16, lineHeight: 32, letterSpacing: 0.1,
                       color: t.ink, backgroundColor: "transparent",
                       paddingTop: 5, paddingHorizontal: 22, paddingBottom: 0 },
    cn_foot:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                       columnGap: 12, paddingTop: 12, paddingHorizontal: 22, paddingBottom: 16,
                       borderTopWidth: 1, flexShrink: 0 },
    cn_foot_l:       { flexDirection: "row", alignItems: "center", columnGap: 14 },
    cn_count:        { fontFamily: F.mono(400), fontSize: 11, letterSpacing: 0.44, color: t.ink_soft },
    cn_count_over:   { color: t.clay },
    cn_save:         { backgroundColor: t.pine, borderRadius: 5, paddingVertical: 9, paddingHorizontal: 20 },
    cn_save_t:       { fontFamily: F.mono(400), fontSize: 12, letterSpacing: 0.72, textTransform: UP, color: t.paper },
    /* "Speak" is a bordered PILL with a line-art mic, not plain text with an emoji glyph. */
    cn_speak:        { flexDirection: "row", alignItems: "center", columnGap: 6, borderWidth: 1,
                       borderColor: t.line, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
    cn_speak_t:      { fontFamily: F.mono(400), fontSize: 10.5, letterSpacing: 0.84, textTransform: UP, color: t.ink_soft },

    /* ── My Lessons (.mlp2 + children) — read from globals.css at the ≤600px phone sizes,
          2026-09-14 (Track D step 4b) ───────────────────────────────────────────────────
       The frozen header is the title row (the paired "Your lessons / Year plan" switch plus
       the archive box) over the two wheels; the lesson list scrolls beneath it. The web holds
       it with `position: sticky`; here it simply sits ABOVE the scroller, which is the same
       thing on a screen that owns its own scroll region (the pattern My Classes' greeting
       already uses).
       ⚠️ The switch words are 20px on a phone, NOT the 23px base — globals.css carries that in
       a ≤600px block placed deliberately AFTER the base rules (it was dead for months when it
       sat earlier in the file). Taking the base size here would reproduce that bug on the
       phone, so these are the ≤600px values throughout: vtab/vsep 20, titleleft gap 6,
       titlerow gap 8, archfolder padding 4×5. */
    mlp2_frozen:     { paddingTop: 6, paddingBottom: 12, marginBottom: 6, borderBottomWidth: 1 },
    mlp2_titlerow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 8 },
    mlp2_titleleft:  { flexDirection: "row", alignItems: "center", columnGap: 6, minWidth: 0, flexShrink: 1 },
    /* The word IS the title: same face and size as the retired .mlp2-title, no button chrome.
       Only the live one is inked, and it carries a 1px clay rule directly under it. */
    mlp2_vtab:       { fontFamily: F.display(500), fontSize: 20, lineHeight: 23, color: t.ink_soft,
                       paddingTop: 2, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "transparent" },
    mlp2_vtab_on:    { color: t.ink, borderBottomColor: t.clay },
    mlp2_vsep:       { fontFamily: F.display(500), fontSize: 20, lineHeight: 23, color: t.edge,
                       paddingTop: 2, paddingBottom: 4 },
    mlp2_archfolder: { flexDirection: "row", alignItems: "center", columnGap: 6, paddingVertical: 4,
                       paddingHorizontal: 5, borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
    mlp2_archcount:  { fontFamily: F.mono(600), fontSize: 11, letterSpacing: 0.22, color: t.ink_soft },
    /* Subject box wider than Class at 2:1 — the web's `flex:2` / `flex:1` on the two columns. */
    mlp2_wheels:     { flexDirection: "row", columnGap: 14, marginTop: 12 },
    mlp2_wcol_s:     { flex: 2, minWidth: 0 },
    mlp2_wcol_g:     { flex: 1, minWidth: 0 },
    /* A single-option axis renders STATIC — but at the wheel's own footprint, always: rowPx 72
       plus the peek shell's 1px hairline top and bottom = 74. */
    mlp2_static:     { minHeight: 74, alignItems: "center", justifyContent: "center",
                       paddingHorizontal: 14, borderWidth: 1, borderColor: wheelEdge, borderRadius: 12,
                       backgroundColor: t.tint_pine_2 },
    mlp2_static_t:   { fontFamily: F.body(600), fontSize: 17, lineHeight: 22, color: t.ink, textAlign: "center" },
    /* The status line is exhaustive and single-colour: "Completed 6A, 6C · Teaching now 6B". */
    mlp2_status:     { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline" },
    mlp2_status_t:   { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15, letterSpacing: 0.2, color: t.ink_soft },
    mlp2_status_sep: { marginHorizontal: 6, color: t.line },
    mlp2_ready:      { fontFamily: F.body(400, true), fontSize: 12.5, lineHeight: 17, color: t.ink_soft },
    mlp2_emptybody:  { fontFamily: F.body(400, true), fontSize: 14, lineHeight: 21, color: t.ink_soft,
                       paddingVertical: 22, paddingHorizontal: 4 },
    mlp2_loading:    { fontFamily: F.body(400, true), fontSize: 13, lineHeight: 19, color: t.ink_soft,
                       paddingVertical: 10, paddingHorizontal: 4 },
    /* The card reserves a right column for the archive icon (top) and, on the web, the report
       trigger (bottom); the floor of 82 keeps the two clear of each other. Only the archive
       icon is ported in this step — see the screen's header for why — but the reservation and
       the floor stay, so adding the report later moves nothing. */
    mlp2_cardpad:    { paddingRight: 44, minHeight: 82 },
    mlp2_iconbtn:    { position: "absolute", top: 7, right: 8, zIndex: 2, width: 30, height: 30,
                       borderRadius: 8, borderWidth: 1, borderColor: "transparent",
                       alignItems: "center", justifyContent: "center" },
    mlp2_restore:    { borderRadius: 9, borderWidth: 1, paddingVertical: 7, paddingHorizontal: 15 },
    mlp2_restore_t:  { fontFamily: F.mono(400), fontSize: 10, letterSpacing: 0.6, textTransform: UP },
    /* Transient confirmation / block message — bottom-centre, non-blocking, auto-dismissed.
       `bottom` clears the bottom bar (56.85 + its safe-area inset, applied by the component). */
    mlp2_toast:      { position: "absolute", left: 16, right: 16, alignItems: "center",
                       paddingVertical: 11, paddingHorizontal: 18, borderRadius: 11, borderWidth: 1 },
    mlp2_toast_t:    { fontFamily: F.body(400), fontSize: 13.5, lineHeight: 18.2, textAlign: "center" },
    /* One meta row, not two stacked lines (founder, 2026-08-27): the matrix and the year stamp
       are both small-print provenance and read as the one thing they are. Wraps on a narrow
       phone rather than squashing. */
    sc_metarow:      { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap",
                       columnGap: 12, rowGap: 4, marginTop: 2 },
    sc_metarow_item: { marginTop: 0 },
    sc_yearstamp:    { fontFamily: F.mono(400), fontSize: 9.5, lineHeight: 13, letterSpacing: 0.67,
                       textTransform: UP, color: t.ochre },

    /* The prepare bar under the lesson list (.mlp-allocate). The web lays it out as a row that
       wraps; at ≤600px it goes to a COLUMN with a full-width 44px button, which is the phone's
       shape and so the only one here. */
    mlp_allocate:    { marginTop: 14, borderWidth: 1, borderRadius: 8, paddingVertical: 11,
                       paddingHorizontal: 14, rowGap: 12 },
    mlp_allocate_q:  { fontFamily: F.body(400, true), fontSize: 13, lineHeight: 19.5, color: t.ink },
    mlp_allocate_btn:{ borderRadius: 6, minHeight: 44, alignItems: "center", justifyContent: "center",
                       paddingHorizontal: 14 },
    /* ⚠️ THE SIZE ONLY. This button is `.mlp-allocate-btn prepare-cta` — the pine fill and cream
       label in the base rule are OVERRIDDEN by the prepare-cta layer, which owns the colour,
       the weight, the glow and the ✦. The identity lives in components/PrepareCta.jsx; what
       stays here is what the CONTEXT contributes, which is the web's own division of labour. */
    mlp_allocate_t:  { fontFamily: F.mono(400), fontSize: 10, lineHeight: 13, letterSpacing: 0.5,
                       textTransform: UP },

    /* ── the PROPOSED card (.sc-card.sc-proposed + .sc-prep*) ──
       The one "not yet" signal is STRUCTURE, never colour: a dashed edge and a clay spine on an
       otherwise ordinary card. ⚠️ At phone width the web STACKS the progress line — the note
       leads and the bar sits under it at full width, rather than being squeezed to a stub beside
       it (globals.css ≤600px) — so that is the only arrangement here. */
    sc_proposed:     { borderStyle: "dashed" },
    sc_prep:         { flexDirection: "column", alignItems: "flex-start", rowGap: 5, marginTop: 5 },
    sc_prep_note:    { fontFamily: F.body(400, true), fontSize: 12.5, lineHeight: 17, color: t.ink_soft },
    sc_prep_bar:     { width: "100%", height: 3, borderRadius: 2, overflow: "hidden" },
    sc_prep_fill:    { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 2 },
    /* ★ FAILED IS ONE ROW, so the card is the same HEIGHT as its neighbours (globals.css ≤420px
       undoes the column stacking for exactly this reason: there is no bar to protect, and a
       taller card reads as a different KIND of thing). */
    sc_prep_failed:  { flexDirection: "row", alignItems: "center", columnGap: 10, rowGap: 0 },
    sc_prep_note_failed: { fontFamily: F.body(400), fontSize: 12, lineHeight: 16.5, color: t.ink,
                           flex: 1, minWidth: 0 },
    sc_prep_dismiss: { borderBottomWidth: 1, paddingTop: 2, paddingBottom: 1 },
    sc_prep_dismiss_t: { fontFamily: F.mono(400), fontSize: 11, lineHeight: 14, letterSpacing: 0.66,
                         textTransform: UP, color: t.clay },

    /* ── the peek RollWheel (.fr-wheel-shell.peek) ──
       One compact row showing ONLY the item in use, rolled by drag with a single cycling ▼.
       rowPx is 72 here (My Lessons passes it); the shell's hairline adds 1 top and bottom. */
    rw_shell:        { height: 74, borderWidth: 1, borderColor: wheelEdge, borderRadius: 10,
                       overflow: "hidden", backgroundColor: wheelBg },
    rw_row:          { height: 72, flexDirection: "row", alignItems: "center", paddingRight: 44 },
    rw_label:        { fontFamily: F.body(600), fontSize: 19, lineHeight: 24, color: t.ink },
    rw_cue:          { position: "absolute", right: 7, top: 0, bottom: 0, justifyContent: "center" },
    rw_cue_btn:      { width: 34, height: 26, alignItems: "center", justifyContent: "center" },
    rw_cue_glyph:    { fontSize: 15, lineHeight: 17, color: t.pine },
    /* ── the BASE wheel (.fr-wheel, no .peek) — first run's and Prepare's box ──
       Tint-pine rather than white, a wider right gutter for the ▲▼ PAIR (52 against peek's 44),
       and a 12px gap for the optional chip. Height comes from the caller's rowPx: 64 is the
       web's WHEEL_ROW, Prepare's chapter wheel passes 92 so a two-line title fits. */
    rw_shell_base:   { borderWidth: 1, borderColor: "#c7d9cf", borderRadius: 12,
                       overflow: "hidden", backgroundColor: t.tint_pine_2 },
    rw_row_base:     { flexDirection: "row", alignItems: "center", columnGap: 12, paddingRight: 52 },
    rw_label_base:   { flex: 1, minWidth: 0, fontFamily: F.body(400), fontSize: 15, lineHeight: 19.2, color: t.ink },
    /* `.fr-wheel-lg .fr-wheel-label { font-size: 17px }` — the whole of the web's `large`: one
       notch bigger, for short lists (1…14 periods) where longer lists like chapter titles stay
       at 15. */
    rw_label_lg:     { fontSize: 17, lineHeight: 21.8 },
    /* The chapter number in its own square, inked pine when its row is the pick. */
    rw_chip:         { width: 30, height: 30, borderRadius: 8, alignItems: "center",
                       justifyContent: "center", backgroundColor: t.paper_sunk },
    rw_chip_on:      { backgroundColor: t.pine },
    rw_chip_t:       { fontFamily: F.mono(600), fontSize: 14, lineHeight: 18, color: t.pine_d },
    rw_chip_t_on:    { color: "#fdfaf4" },

    /* ── Prepare a lesson (.prep-* ) — globals.css, measured at the phone's own sizes ──
       ONE control on this screen (founder, 2026-07-26): a period stepper. The duration matrix
       the server needs is DERIVED from that number — her declared lengths, in the weekly ratio
       she teaches them — and only echoed back underneath as small print. A duration field here
       was a second place for the same fact to live, and a second place for it to disagree with
       the profile. */
    /* `.h2` — 22px Fraunces at 500, not the 18 of the app's generic h2 scale. */
    prep_h2:         { fontFamily: F.display(500), fontSize: 22, lineHeight: 28, color: t.ink },
    /* ⚠️ OCHRE, not ink — and the reason is the `.ap-row-line` trap for the FOURTH time.
       The element is `<div className="ap-kicker prep-scope">`. `.prep-scope` (globals.css 938)
       says `color: var(--ink)`, `.ap-kicker` (2703) says `color: var(--ochre)`, both at (0,1,0)
       — so SOURCE ORDER decides and `.ap-kicker` wins, being 1,765 lines later. The web renders
       this line OCHRE and `.prep-scope`'s colour is dead CSS that has never taken effect. §4
       says match what the web DOES, so this is ochre; if the ink was the intent, the fix is on
       the web (raise .prep-scope's specificity or move it below), not here.
       Letter-spacing is .12em at 10.5 = 1.26 — `.ap-kicker`'s, not the 1.89 of `.kicker`. */
    prep_scope:      { fontFamily: F.mono(400), fontSize: 10.5, lineHeight: 14, letterSpacing: 1.26,
                       textTransform: UP, color: t.ochre, marginTop: 7 },
    /* `.h2-sub`: 14.5px, --ink-soft. */
    prep_instr:      { fontFamily: F.body(400), fontSize: 14.5, lineHeight: 21.75, color: t.ink_soft,
                       marginTop: 8, marginBottom: 22 },
    /* `.back.back-tr` — a PILL, not a text link: 1px pine ring, fully rounded, mono 12 at 600,
       .06em, uppercase, pine. `.back-tr` (3725) overrides `.back` (931) for margin and padding. */
    prep_back:       { flexGrow: 0, flexShrink: 0, borderWidth: 1, borderRadius: 999,
                       paddingVertical: 6, paddingHorizontal: 15 },
    prep_back_t:     { fontFamily: F.mono(600), fontSize: 12, lineHeight: 15, letterSpacing: 0.72,
                       textTransform: UP },
    trial_note:      { fontFamily: F.body(400, true), fontSize: 12.5, lineHeight: 18.75,
                       color: t.ink_soft, textAlign: "center", marginTop: 6, marginBottom: 10 },
    /* Two columns, as the web has them at every width: the stepper takes the slack, the boxes
       are a fixed 152 behind a hairline. */
    prep_block:      { flexDirection: "row", alignItems: "stretch", marginTop: 16, marginBottom: 4 },
    prep_left:       { flex: 1, minWidth: 0, paddingRight: 16, justifyContent: "center" },
    prep_right:      { width: 152, flexGrow: 0, flexShrink: 0, rowGap: 10,
                       borderLeftWidth: 1, paddingLeft: 16 },
    prep_fieldlab:   { fontFamily: F.mono(400), fontSize: 10, lineHeight: 13, letterSpacing: 1.5,
                       textTransform: UP, color: t.ink_soft, marginBottom: 10 },
    prep_stepper:    { flexDirection: "row", alignItems: "center", columnGap: 8 },
    prep_step_btn:   { width: 28, height: 28, borderRadius: 6, borderWidth: 1,
                       alignItems: "center", justifyContent: "center" },
    prep_step_glyph: { fontSize: 14, lineHeight: 16, color: t.pine_d },
    /* ⚠️ A REAL, BORDERED FIELD (founder, 2026-09-14: "the periods for this chapter available for
       direct amendment"). It is `.v.g4-vinput` — `.steppermini .v` gives the 18px display face in
       pine, `.g4-vinput` the 56px box with a --line ring, 6px radius and --paper-2 fill. Ported
       borderless it read as a label between two buttons, so the one number on the screen she is
       most likely to change did not look changeable. */
    prep_step_v:     { width: 56, textAlign: "center", fontFamily: F.display(400), fontSize: 18,
                       lineHeight: 22, color: t.pine_d, borderWidth: 1, borderRadius: 6,
                       paddingVertical: 4, paddingHorizontal: 6 },
    prep_mix:        { fontFamily: F.mono(400), fontSize: 11, lineHeight: 14, letterSpacing: 0.44,
                       color: t.ink_soft, marginTop: 8, marginHorizontal: 2 },
    /* The single coverage warning — quiet grey, not an alarm. */
    prep_floor:      { fontFamily: F.body(400, true), fontSize: 12.5, lineHeight: 19.375,
                       color: t.ink_soft, marginTop: 10, marginHorizontal: 2 },
    prep_box:        { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
    prep_sugg_hd:    { flexDirection: "row", alignItems: "center", columnGap: 5 },
    prep_sugg_k:     { fontFamily: F.mono(400), fontSize: 9, lineHeight: 12, letterSpacing: 1.26,
                       textTransform: UP, color: t.ochre },
    prep_info:       { width: 15, height: 15, borderRadius: 7.5, borderWidth: 1, borderColor: "#c9b986",
                       alignItems: "center", justifyContent: "center" },
    prep_info_t:     { fontFamily: F.display(400, true), fontSize: 10, lineHeight: 12, color: t.ochre },
    prep_sugg_body:  { flexDirection: "row", alignItems: "baseline", columnGap: 7, marginTop: 2 },
    prep_sugg_val:   { fontFamily: F.display(600), fontSize: 17, lineHeight: 21, color: t.ochre },
    prep_sugg_ok:    { fontSize: 14, lineHeight: 18, color: t.pine },
    prep_use:        { borderWidth: 1, borderColor: "#ddcfa6", borderRadius: 6,
                       paddingVertical: 2, paddingHorizontal: 7 },
    prep_use_t:      { fontFamily: F.mono(400), fontSize: 9, lineHeight: 12, letterSpacing: 0.45,
                       textTransform: UP, color: t.ochre },
    prep_tip:        { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
                       marginTop: 8 },
    prep_tip_t:      { fontFamily: F.body(400), fontSize: 13, lineHeight: 19.5, color: t.ink },
    prep_brow:       { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
                       columnGap: 8, paddingVertical: 3 },
    prep_brow_div:   { borderTopWidth: 1 },
    prep_brow_k:     { fontFamily: F.mono(400), fontSize: 9, lineHeight: 12, letterSpacing: 0.45,
                       textTransform: UP, color: t.ink_soft },
    prep_brow_v:     { fontFamily: F.mono(400), fontSize: 12, lineHeight: 15, color: t.ink },
    prep_brk_row:    { flexDirection: "row", alignItems: "baseline", columnGap: 11, paddingVertical: 10,
                       paddingHorizontal: 2 },
    prep_brk_ch:     { fontFamily: F.mono(500), fontSize: 11, lineHeight: 14, color: t.clay, width: 46 },
    prep_brk_name:   { flex: 1, minWidth: 0, fontFamily: F.body(400), fontSize: 15, lineHeight: 19.2, color: t.ink },
    prep_brk_p:      { fontFamily: F.mono(400), fontSize: 13, lineHeight: 16, color: t.ink },
    prep_brk_total:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                       columnGap: 12, paddingTop: 12, paddingBottom: 2, paddingHorizontal: 2,
                       borderTopWidth: 1, marginTop: 4 },
    prep_brk_tot_k:  { fontFamily: F.mono(400), fontSize: 10, lineHeight: 13, letterSpacing: 1.4,
                       textTransform: UP, color: t.ink_soft },
    prep_brk_tot_v:  { fontFamily: F.mono(500), fontSize: 14, lineHeight: 17, color: t.pine_d },
    /* The CTA bar. `savebar-prep` is a 56px lift off the form above it. */
    prep_savebar:    { marginTop: 56, rowGap: 10 },

    /* ── the annual-budget editor (`.tp.tp-budget`, globals.css 3028–3072) — Track D step 5c ──
       The Year Plan pencil's destination. One figure, its sense-check, Aruvi's recommendation,
       and a save that sits well clear of the reading.
       ⚠️ `.fr-q` is 27 here, NOT the 32 at line 3353 — that lives inside `@media (min-width:
       700px)` and the phone renders the narrow shape. Reading the desktop value off a bare grep
       is precisely the mistake the parity checker exists to catch. */
    /* ── first run (.fr-prog · .fr-welcome-* · .fr-trial-* · .fr-default-*) ──────────────
       Measured 2026-09-16 off the running web at 390 — by injecting first run's own markup into
       the live page, since the screen itself cannot be reached on a profile that already exists.
       Colours resolve to tokens, so dark follows for free. */
    fr_prog:         { flexDirection: "row", alignItems: "center", columnGap: 4, paddingBottom: 22 },
    fr_prog_step:    { flex: 1, alignItems: "center", rowGap: 6, position: "relative" },
    /* `.fr-prog-step::before` — the connector, absolutely positioned across the gap to the step
       BEFORE this one (left: -50%, width: 100%), under the dots (the dot carries z-index 1).
       Never on the first step. */
    fr_prog_line:    { position: "absolute", top: 13, height: 2 },
    fr_prog_dot:     { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
                       alignItems: "center", justifyContent: "center", zIndex: 1 },
    fr_prog_dot_t:   { fontFamily: F.mono(600), fontSize: 12, lineHeight: 18.6 },
    fr_prog_label:   { fontFamily: F.mono(400), fontSize: 10.5, lineHeight: 16.275, letterSpacing: 0.84,
                       textTransform: UP, color: t.ink_soft },
    fr_prog_label_on:{ color: t.pine_d },
    fr_welcome_title:{ fontFamily: F.display(600), fontSize: 30, lineHeight: 34.5, color: t.ink,
                       marginTop: 8, marginBottom: 10 },
    fr_welcome_rule: { width: 34, height: 3, borderRadius: 2, alignSelf: "center",
                       marginTop: 14, marginBottom: 18 },              // fill: t.pine
    fr_welcome_h2:   { fontFamily: F.display(600), fontSize: 22, lineHeight: 34.1, color: t.ink,
                       marginTop: 56, marginBottom: 6 },
    fr_welcome_sub:  { fontFamily: F.body(400), fontSize: 16, lineHeight: 24.8, color: t.ink_soft,
                       marginBottom: 8 },
    fr_trial_card:   { borderWidth: 1, borderRadius: 14, paddingVertical: 20, paddingHorizontal: 18,
                       alignItems: "center" },                          // bg: t.card_bg, border: t.line
    fr_trial_tick:   { width: 44, height: 44, borderRadius: 22, alignItems: "center",
                       justifyContent: "center", marginBottom: 10 },    // bg: t.tint_pine
    fr_trial_tick_t: { fontSize: 18, lineHeight: 22, color: t.pine },
    fr_trial_h:      { fontFamily: F.display(600), fontSize: 17, lineHeight: 26, color: t.ink,
                       marginTop: 14, marginBottom: 6, textAlign: "center" },
    fr_trial_p:      { fontFamily: F.body(400), fontSize: 13.5, lineHeight: 20.925, color: t.ink,
                       textAlign: "center" },
    fr_loading:      { fontFamily: F.body(400, true), fontSize: 17, lineHeight: 26.35, color: t.ink_soft,
                       paddingVertical: 8, paddingHorizontal: 2 },
    /* The section STATED, not asked — a footnote to the class choice under a hairline, never a
       second question (founder, 2026-08-21). */
    fr_sec_note:     { fontFamily: F.body(400), fontSize: 14, lineHeight: 21, color: t.ink_soft,
                       marginTop: 24, paddingTop: 18, borderTopWidth: 1 },
    fr_sec_note_b:   { fontFamily: F.body(600), color: t.ink },
    fr_defaults:     { rowGap: 12, marginTop: 4 },
    fr_default:      { rowGap: 6, padding: 14, borderRadius: 12, borderWidth: 1 },
    fr_default_edit: { rowGap: 6, paddingTop: 14, paddingBottom: 0, paddingHorizontal: 0,
                       borderWidth: 0, backgroundColor: "transparent" },
    fr_default_krow: { flexDirection: "row", alignItems: "baseline",
                       justifyContent: "space-between", columnGap: 10 },
    fr_default_kick: { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15.5, letterSpacing: 1,
                       textTransform: UP, color: t.ink_soft },
    fr_default_row:  { flexDirection: "row", alignItems: "center",
                       justifyContent: "space-between", columnGap: 10 },
    fr_default_val:  { fontFamily: F.display(400), fontSize: 18, lineHeight: 24, color: t.ink },
    fr_default_val_muted: { color: t.ink_soft },
    /* ⚠️ The web sets this ITALIC and no italic IBM Plex Mono cut is bundled — RN picks a face by
       name, so italic here would either do nothing or be synthesised badly. The upright mono
       stands, and it is the one named divergence on this screen. */
    fr_tag_rec:      { fontFamily: F.mono(400), fontSize: 10.5, lineHeight: 15.5, letterSpacing: 0.525,
                       color: t.pine },
    fr_change_btn:   { borderWidth: 1, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
    fr_change_btn_t: { fontFamily: F.mono(400), fontSize: 11, lineHeight: 15, letterSpacing: 0.66,
                       textTransform: UP, color: t.pine_d },
    fr_done_btn:     { alignSelf: "flex-end", borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14,
                       marginTop: 10 },                                 // bg: t.pine
    fr_done_btn_t:   { fontFamily: F.mono(400), fontSize: 11, lineHeight: 15, letterSpacing: 0.66,
                       textTransform: UP, color: "#fdfaf4" },
    fr_bud_warn:     { fontFamily: F.mono(400), fontSize: 11, lineHeight: 16, letterSpacing: 0.44,
                       color: t.clay, marginBottom: 8 },

    /* ⚠️ NO `marginTop`, AND THAT IS THE MEASURE. On the web `.kicker` carries no margins and
       `.fr-q` is `margin: 0 0 6px`, so the two sit FLUSH — measured on the running page, the
       kicker's bottom and the heading's top are the same pixel. Anything added here opens a gap
       the web does not have. */
    fr_q:            { fontFamily: F.display(600), fontSize: 27, lineHeight: 31.86, letterSpacing: -0.4,
                       color: t.ink, marginBottom: 6 },
    /* The editor's kicker clears the window's corner buttons, which are drawn over this line. */
    /* `paddingRight` reserves the ✕'s column so a long scope can never run under it; `paddingTop`
       gives the ✕ its OWN ROW (founder, 2026-09-15 — reported on the web, fixed on both, since a
       window is one design). Measured: the ✕ occupies 13→43 from the card's top and the kicker
       began at 23, overlapping it by 20px. 26 here puts the kicker at 48, clear of the ✕. */
    tp_kicker_pad:   { paddingRight: 30, paddingTop: 26 },
    tp_val_row:      { flexDirection: "row", alignItems: "center", columnGap: 16,
                       marginTop: 18, marginBottom: 12 },   // .tp-val-row + .tp-val-solo
    tp_val_btn:      { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5,
                       alignItems: "center", justifyContent: "center" },
    tp_val_btn_t:    { fontSize: 20, lineHeight: 20, color: t.pine_d },
    tp_val_input:    { width: 84, textAlign: "center", fontFamily: F.display(600), fontSize: 22,
                       color: t.ink, borderWidth: 1.5, borderRadius: 8,
                       paddingVertical: 4, paddingHorizontal: 6 },
    tp_val_unit:     { fontFamily: F.mono(400), fontSize: 11, letterSpacing: 0.66, textTransform: UP,
                       color: t.ink_soft },
    /* The sense-check, in the small mono of a caption directly under the figure it describes —
       "27 weeks (@ 8 periods/week)". A reading, not a sentence (founder, 2026-08-28). */
    tp_weeks:        { fontFamily: F.mono(400), fontSize: 11.5, lineHeight: 16, letterSpacing: 0.46,
                       color: t.ink_soft, marginTop: -2, marginBottom: 14 },
    tp_estimate_sub: { fontFamily: F.mono(400), fontSize: 11, lineHeight: 16, letterSpacing: 0.44,
                       color: t.ink_soft, marginBottom: 8 },
    /* ★ SAVE SITS WELL CLEAR OF THE READING (founder, 2026-08-28): `.tp-budget .fr-foot` adds
       88px to `.fr-foot`'s own 20 — the gap is what separates "what I am being told" from
       "what I am about to do". */
    /* ★ 88px OF AIR ABOVE SAVE IS A FULL-PAGE MEASURE (founder, 2026-08-28: the gap separates
       "what I am being told" from "what I am about to do"). In a WINDOW the card's own edge
       already draws that line, and 108px of padding pushes the button under the fold of a
       height-capped card — so the windowed variant keeps the separation and spends a third of the
       height on it. The web's `.tp-window-card .fr-foot` makes the same trade. */
    fr_foot:         { alignItems: "center", rowGap: 12, paddingTop: 108 },
    fr_foot_win:     { paddingTop: 28 },
    /* ⚠️ `.fr-cta` DECLARES font-size 16 AND border-radius 12, AND THE BROWSER APPLIES NEITHER.
       The element is `<button class="primary fr-cta">`, and `button.primary` (0,1,1) beats
       `.fr-cta` (0,1,0) on SPECIFICITY — not source order this time — so the live values are
       12px and 3px, straight off `button.primary`. Measured on the running app, not read off the
       rule that looks like the intent: getComputedStyle says 12px / 0.96px / weight 400 /
       radius 3 / #f6f1e7 on pine. This is the `.ap-kicker` trap wearing a different hat, and I
       had ported 16 and 12 before the checker asked which rule wins. */
    fr_cta:          { width: "100%", minHeight: 52, borderRadius: 3,
                       alignItems: "center", justifyContent: "center" },
    fr_cta_t:        { fontFamily: F.mono(400), fontSize: 12, letterSpacing: 0.96, textTransform: UP },
    fr_cta_ink:      { color: "#f6f1e7" },   // button.primary's own foreground, not --paper
    fr_link:         { paddingVertical: 6, paddingHorizontal: 4, marginTop: 14 },  // .tp .fr-link
    /* `.fr-link`'s OWN box, without the profile window's 14px lead-in — the front door's three
       foot links sit in `.ob-foot`, which supplies its own 10px gap. */
    fr_link_pad:     { paddingVertical: 6, paddingHorizontal: 4 },
    fr_link_t:       { fontFamily: F.mono(400), fontSize: 12, letterSpacing: 0.48, color: t.pine },
    /* ⚠️ THERE IS NO `kicker_ochre` KEY AND THERE SHOULD NOT BE (2026-09-15). Four web files
       render `className="kicker kicker-ochre"` and globals.css declares `.kicker-ochre`
       NOWHERE — the checker's `--dump .kicker-ochre` returns no rule at all, and
       getComputedStyle on the live page gives the same pine as a bare `.kicker`. It is a dead
       class name, so `ws.kicker` IS the faithful port and adding a second key would be porting
       an intention the web never had. Recorded here because the name reads like a colour and
       the next person will look for it. */
    /* ── the save-failure banner (`.tp-savefail`, globals.css 4991) ──
       Raised ONLY on a verified mismatch, where the server's copy is the truth and hers has
       already been replaced on screen. It is a statement about what she is now looking at, not
       an apology, which is why it is one line and a Dismiss rather than a retry. */
    /* ── Personal profile's two non-field rows (`.acct-row` 4224-4228, `.ob-email-view`
       4158-4171) — measured 2026-09-16. Everything else on that screen uses the app's own
       `Field`/`Input` family rather than a second measured one. */
    /* ⚠️ NO `marginTop` (corrected 2026-09-16). `.acct-row` is `padding: 7px 0` and nothing
       else — the 18px lived here for Personal profile's ONE Mobile row, and it belongs at that
       call site. A subscription card stacks FIVE of these, where a baked-in margin turns a
       ledger into a list. */
    acct_row:        { flexDirection: "row", alignItems: "baseline", columnGap: 12,
                       paddingVertical: 7, borderBottomWidth: 1 },
    acct_k:          { fontFamily: F.mono(400), fontSize: 10.5, lineHeight: 18.225,
                       letterSpacing: 0.735, textTransform: UP, width: 92 },
    acct_v:          { flex: 1, minWidth: 0, fontFamily: F.body(400), fontSize: 13.5,
                       lineHeight: 18.225 },
    ob_email_view:   { flexDirection: "row", alignItems: "center",
                       justifyContent: "space-between", columnGap: 10, borderWidth: 1,
                       borderRadius: 7, paddingVertical: 11, paddingHorizontal: 12 },
    /* ★ THE PROFILE SHOWS THE WHOLE ADDRESS (2026-08-27) — the type STEPS DOWN as the address
       grows and never truncates, because a half-shown email is worse than a small one. The web's
       `emailFit` thresholds, here as sizes rather than class names. */
    ob_email_addr:   { flex: 1, minWidth: 0, fontFamily: F.body(400), fontSize: 14, lineHeight: 18.9 },

    /* ── F11, the dropdown (`.dd-*`, globals.css 312-352) — measured 2026-09-16 ──────────
       ★ THE WEB BUILT THIS TO ESCAPE macOS. A native `<select>`'s popup is an NSMenu that
       follows the OS appearance and reads none of the page's CSS, so a light app on a dark Mac
       opened a black list — "there is no CSS fix", and `Dropdown.jsx` is the listbox that
       replaces it. ★ **None of that reasoning applies to a phone**, where the native picker is
       a wheel or a sheet and is themed by the OS correctly. What carries over is the SKIN and
       the API; what does not is the machinery — arrows, Home/End, `aria-activedescendant`,
       flip-above-when-tight, and closing on a page scroll are all answers to a pointer and a
       keyboard. The phone gets a Sheet: a list you tap.
       ⚠️ NEW KEYS: invisible to Fast Refresh until a real app start. */
    dd_btn:          { flexDirection: "row", alignItems: "center", columnGap: 8, width: "100%",
                       borderWidth: 1, borderRadius: 7, paddingVertical: 11, paddingHorizontal: 12 },
    dd_lab:          { flex: 1, minWidth: 0, fontFamily: F.body(400), fontSize: 14, lineHeight: 18.2 },
    dd_chev:         { fontFamily: F.body(400), fontSize: 12, lineHeight: 14 },
    dd_opt:          { width: "100%", paddingVertical: 11, paddingHorizontal: 10, borderRadius: 6 },
    dd_opt_t:        { fontFamily: F.body(400), fontSize: 14, lineHeight: 18.9 },
    /* `on` is the CURRENT VALUE — pine and semibold. The web also has an `active` state for the
       keyboard cursor, and the two must not look alike there because both can show at once;
       a finger has no cursor, so only `on` is ported. */
    dd_opt_on:       { fontFamily: F.body(600) },

    /* ── SETTINGS (`.set-*`, `.acct-*`, globals.css 4347-4425, 5143-5146) — 6b, measured
       2026-09-16 ────────────────────────────────────────────────────────────────────────
       ★ SUBVIEWS HAVE NO HEADING — THE BAR NAMES THEM (founder, 2026-09-03: "why should the
       word Settings take so much real estate"). So there is no `set_title` here: the frozen
       bar carries "⚙ Support", "⚙ Subscription & billing", and the per-screen heading the web
       deleted is not ported back in.
       ⚠️ `.setwrap` is max-width 560 on the web; on a phone the column is the screen, so it is
       the page's own 18px gutter instead.
       ⚠️ NEW KEYS: invisible to Fast Refresh until a real app start. */
    set_bar:         { flexDirection: "row", alignItems: "center",
                       justifyContent: "space-between", columnGap: 12,
                       paddingHorizontal: 18 },
    set_bar_title:   { flexDirection: "row", alignItems: "center", columnGap: 9,
                       flexShrink: 1, minWidth: 0, paddingVertical: 10, paddingLeft: 4 },
    set_bar_gear:    { fontFamily: F.body(400), fontSize: 20, lineHeight: 24 },
    /* One line, clipped before it can push the ✕ off a 360px bar — "Subscription & billing"
       is the longest label there is. `numberOfLines={1}` is the phone's text-overflow. */
    set_bar_lab:     { fontFamily: F.display(600), fontSize: 19, lineHeight: 24, flexShrink: 1 },
    set_bar_x:       { paddingVertical: 10, paddingHorizontal: 6 },
    set_bar_x_glyph: { fontFamily: F.body(400), fontSize: 15, lineHeight: 15 },

    /* The big cards: a plain card fill distinct from the paper page, title over small text,
       chevron. COMPACT on purpose (founder, 2026-08-24) — tight padding and gaps so the whole
       list fits one phone screen without scrolling. */
    set_bigcard:     { flexDirection: "row", alignItems: "center", columnGap: 10,
                       paddingVertical: 9, paddingHorizontal: 14, marginBottom: 7,
                       borderWidth: 1, borderRadius: 10 },
    set_bigtext:     { flex: 1, minWidth: 0, rowGap: 1 },
    set_biglab:      { fontFamily: F.display(600), fontSize: 14.5, lineHeight: 19 },
    set_bigsub:      { fontFamily: F.body(400), fontSize: 11, lineHeight: 15.4 },
    set_chev:        { fontFamily: F.body(400), fontSize: 19, lineHeight: 19 },
    set_group_tail:  { marginTop: 14 },

    /* The Account group — the only caption that survives, because it sits over the
       destructive row. */
    set_group:       { marginBottom: 18 },
    set_cap:         { fontFamily: F.mono(400), fontSize: 10, letterSpacing: 0.9,
                       textTransform: UP, marginBottom: 6 },
    set_card:        { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
    set_row:         { flexDirection: "row", alignItems: "center", columnGap: 10,
                       paddingVertical: 9, paddingHorizontal: 14, borderBottomWidth: 1 },
    set_lab:         { flex: 1, minWidth: 0, fontFamily: F.body(400), fontSize: 13, lineHeight: 19 },
    set_hint:        { fontFamily: F.body(400, true), fontSize: 12.5, lineHeight: 19.375,
                       marginVertical: 12 },
    /* `.set-card-pad` — 4px 0, and the 0 is not an omission: the web's Support card lets its
       fields run FLUSH to the card's own border (measured 2026-09-16: every child of
       `.set-card.set-card-pad` sits at the card's own x, at its full width). The card is a
       plane, not a frame with an inset. */
    set_card_pad:    { paddingVertical: 4 },
    /* About Meyy's card holds a bare PARAGRAPH rather than field boxes, and a line of prose
       flush against a border reads as a bug on a phone — so that inset is the phone's, and it
       lives here rather than baked into the type key it used to sit inside. */
    set_card_inset:  { paddingVertical: 10, paddingHorizontal: 14 },
    /* The ONE heading that survives in Settings — "Message sent", which is a STATE and not the
       name of a screen (the bar names screens). `.set-title` 24px/1.55, h1's own .67em margins. */
    set_title:       { fontFamily: F.display(600), fontSize: 24, lineHeight: 37.2,
                       marginVertical: 16 },

    /* ── Settings › Support (`.sup-*`, globals.css 4455-4532) — 6b·F, measured 2026-09-16 in a
       390px iframe on the running web, which is what puts the ≤600px rules in force (the
       extension reports a window resize it does not perform; `.set-first` reading -14 rather
       than -22 is the proof the media query bit). ──────────────────────────────
       ⚠️ NEW KEYS: invisible to Fast Refresh until a real app start. */
    /* The To line: kicker and address on ONE row, baseline-aligned — a VALUE, deliberately not
       a field, so no plane and no border invites a tap on an address she cannot change. One
       line's worth of space below it, not the 20px field gap. */
    sup_to_row:      { flexDirection: "row", alignItems: "baseline", columnGap: 10,
                       marginTop: 2, marginBottom: 14 },
    /* --ink-soft, the same as the To kicker beside it (founder): a value in the label's own
       colour reads as fixed, where full ink reads as something typed. */
    sup_to:          { flex: 1, minWidth: 0, fontFamily: F.body(400), fontSize: 14,
                       lineHeight: 18.2 },
    /* 16px exactly — iOS zooms a focused field under 16px, and a teacher typing a bug report
       should not have the layout jump under her. Four lines, not seven (founder, 2026-09-03):
       with To and Subject above it, a 7-row box pushed Send under the fold at 360×800. */
    sup_text:        { minHeight: 80, height: 104, borderWidth: 1, borderRadius: 3,
                       paddingVertical: 10, paddingHorizontal: 12,
                       fontFamily: F.body(400), fontSize: 16, lineHeight: 24.8 },
    sup_refcap:      { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15.5,
                       letterSpacing: 0.8, textTransform: UP },
    /* Mono at ledger scale — the same face the invoice number uses, because it is the same kind
       of object: a number she may have to read out. */
    sup_ref:         { fontFamily: F.mono(400), fontSize: 19, lineHeight: 29.45,
                       letterSpacing: 0.76, paddingTop: 4, paddingBottom: 10 },
    /* The quiet and error lines under a field (`.ob-quiet` / `.ob-err`). */
    ob_quiet:        { fontFamily: F.body(400), fontSize: 11.5, lineHeight: 17.825,
                       marginTop: 8 },
    ob_err:          { fontFamily: F.body(400), fontSize: 12.5, lineHeight: 19.375,
                       marginTop: 8 },

    /* ── Settings › Subscription & billing (`.set-plan`/`.set-pill`/`.set-sub-card`, globals.css
       3994-3996, 4187, 4426-4444) — 6b·D, measured 2026-09-16 in the 390px iframe ──────────
       ⚠️ NEW KEYS: invisible to Fast Refresh until a real app start. */
    /* The pill row. It carries its OWN inset, which is why `set_card_pad`'s zero horizontal
       padding is not a problem here — and why the sub-card variant below has to give it back. */
    set_plan:        { flexDirection: "row", alignItems: "center", columnGap: 10,
                       flexWrap: "wrap", paddingVertical: 12, paddingHorizontal: 14 },
    /* Inside a subscription card the pill sits ON the card's own ledger grid, so its padding
       collapses to a 6px gap before the first row (`.set-sub-card .set-plan`). */
    set_plan_sub:    { paddingVertical: 0, paddingHorizontal: 0, paddingBottom: 6 },
    set_pill:        { borderWidth: 1, borderRadius: 12, paddingVertical: 3,
                       paddingHorizontal: 9, alignSelf: "flex-start" },
    set_pill_t:      { fontFamily: F.mono(400), fontSize: 10, lineHeight: 15.5,
                       letterSpacing: 0.6, textTransform: UP },
    set_sub_card:    { marginTop: 10 },
    /* Mono because it is a reference she may have to read out or type. */
    set_inv_dl:      { fontFamily: F.mono(400), fontSize: 12, letterSpacing: 0.24 },
    /* `.paywall-subscribe.set-subscribe`. ⚠️ `alignSelf`, not a full-width block: the web's
       rule says `display: block` but a BUTTON still shrinks to its content (measured 129px at
       390), and a full-bleed pine slab would read as the screen's primary action, which on a
       page of ledger cards it is not. */
    set_subscribe:   { alignSelf: "flex-start", borderRadius: 5, paddingVertical: 10,
                       paddingHorizontal: 26, marginTop: 12, marginBottom: 4 },
    set_subscribe_t: { fontFamily: F.mono(700), fontSize: 13, letterSpacing: 0.78,
                       textTransform: UP },

    /* The typed-confirm block for account deletion. */
    acct_del_row:    { flexDirection: "row", alignItems: "center", columnGap: 8, rowGap: 8,
                       flexWrap: "wrap" },
    acct_del_input:  { borderWidth: 1, borderRadius: 5, paddingVertical: 7, paddingHorizontal: 10,
                       fontFamily: F.mono(400), fontSize: 12, width: 110 },
    acct_del_go:     { borderRadius: 5, paddingVertical: 8, paddingHorizontal: 14 },
    acct_del_go_t:   { fontFamily: F.mono(400), fontSize: 11.5 },
    acct_fail:       { fontFamily: F.body(400), fontSize: 12.5, lineHeight: 18, marginTop: 10 },

    /* ── the academic-year cutover (`.dash-nudge`/`.yr-nudge`/`.yr-done`, globals.css 3420-3427,
       4248-4269) — 6a F6, measured 2026-09-16 ──────────────────────────────────────────────
       A tint-pine card with a 1.5px pine border, and a 3px left rule that says WHICH card it is:
       ochre for the offer (a decision is open), pine for the result (it is closed). The web
       carries a box-shadow; RN needs elevation/shadow* and the app draws no other shadowed card,
       so it is omitted — the border and the fill are what make it a card here.
       ⚠️ NEW KEYS: invisible to Fast Refresh until a real app start. */
    dash_nudge:      { position: "relative", borderWidth: 1.5, borderRadius: 14,
                       paddingTop: 15, paddingHorizontal: 17, paddingBottom: 14,
                       marginTop: 20, marginBottom: 6, marginHorizontal: 18 },
    dash_nudge_title:{ fontFamily: F.display(500), fontSize: 17, lineHeight: 22.1 },
    dash_nudge_sub:  { fontFamily: F.body(400), fontSize: 13, lineHeight: 18.85, marginTop: 3 },
    /* ⚠️ A FACE AND NOTHING ELSE. A nested Text that also names a size stops inheriting the
       block it sits in, so the bold year would grow mid-sentence — the `lgl_b` lesson. */
    dash_nudge_sub_b:{ fontFamily: F.body(600) },
    yr_x:            { position: "absolute", top: 6, right: 8, paddingVertical: 8,
                       paddingHorizontal: 10 },
    yr_x_glyph:      { fontFamily: F.body(400), fontSize: 14, lineHeight: 14 },
    /* Keeps a long year label clear of the ✕ — the web's `.yr-nudge .dash-nudge-title`. */
    yr_title_pad:    { paddingRight: 30 },
    yr_nudge_row:    { flexDirection: "row", alignItems: "center", flexWrap: "wrap",
                       columnGap: 12, rowGap: 8, marginTop: 12 },
    yr_nudge_go:     { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 6 },
    yr_nudge_go_t:   { fontFamily: F.mono(400), fontSize: 11.5, letterSpacing: 0.575,
                       textTransform: UP },
    /* The quiet twin: a real control, weighted so it never competes with the primary one. */
    yr_nudge_later:  { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 6 },

    /* ── the shell's "notice updated" bar (`.pn-note`, globals.css 5296-5306) — 6a F10 ──
       Measured 2026-09-16. Quiet by design: nothing is WRONG, so it is paper rather than the
       save-failed bars' clay edge, and it carries a 3px pine rule down its left instead. The
       web's note says it "sits where the save-failed bars sit and yields to them", which on the
       phone is the notices slot in `(app)/_layout.jsx` — pinned under the bar rather than at the
       top of a scroller, because here every screen owns its own.
       ⚠️ NEW KEYS: invisible to Fast Refresh until a real app start. */
    pn_note:         { flexDirection: "row", alignItems: "center", columnGap: 12, flexWrap: "wrap",
                       rowGap: 6, marginHorizontal: 18, marginBottom: 12, paddingVertical: 9,
                       paddingHorizontal: 12, borderWidth: 1, borderLeftWidth: 3, borderRadius: 8 },
    pn_note_t:       { flexGrow: 1, flexShrink: 1, minWidth: 160, fontFamily: F.body(400),
                       fontSize: 13, lineHeight: 20.15 },
    pn_note_acts:    { flexGrow: 0, flexShrink: 0, flexDirection: "row", columnGap: 14 },
    pn_note_btn:     { borderBottomWidth: 1, paddingTop: 2, paddingBottom: 1 },
    pn_note_bt:      { fontFamily: F.mono(400), fontSize: 11, letterSpacing: 0.66, textTransform: UP },

    tp_savefail:     { flexDirection: "row", alignItems: "center", columnGap: 12,
                       marginBottom: 12, paddingVertical: 9, paddingHorizontal: 12,
                       borderWidth: 1, borderRadius: 8 },
    tp_savefail_t:   { flex: 1, minWidth: 0, fontFamily: F.body(400), fontSize: 13, lineHeight: 20.15 },
    tp_savefail_btn: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1,
                       paddingTop: 2, paddingBottom: 1 },
    tp_savefail_bt:  { fontFamily: F.mono(400), fontSize: 11, letterSpacing: 0.66,
                       textTransform: UP },

    /* ── the PICK WHEEL (`.fr-sec-*`, globals.css 3110-3260) — Track D 5d F8 ──
       A fixed-height window of tick rows: as many picks as she likes, ticking independent of
       scroll position (unlike RollWheel, where the resting row IS the answer). Four rows visible,
       FIVE when a trailing column is in play — "the same 21 lengths to scroll, but each row now
       carries a second control, so the window earns the extra height".
       ⚠️ Border widths come from the CSS SOURCE, not from getComputedStyle: a 1.5px border reads
       back as 1.25 and a 1px as 0.625 on this display, because sub-pixel borders are snapped to
       the device grid. Face sizes, paddings and the 52px row all round-tripped exactly, so only
       the hairlines needed reading off the stylesheet. */
    pw_wrap:         { flexDirection: "row", alignItems: "flex-start", columnGap: 12,
                       marginTop: 4, marginBottom: 20 },
    pw_col:          { flex: 1, minWidth: 0 },
    pw_wheel:        { width: "100%", height: 208, borderWidth: 1, borderRadius: 10 },
    pw_wheel_trail:  { height: 260 },                    // .has-trail: five rows, not four
    PW_ROW: 52,                                          // one row; 4 × 52 = 208, 5 × 52 = 260
    /* A row inside the wheel loses the standalone option's radius and border and keeps only a
       hairline under it — `.fr-sec-wheel .fr-sec-opt` overrides `.fr-sec-opt` wholesale. */
    pw_opt:          { flexDirection: "row", alignItems: "center", columnGap: 12,
                       height: 52, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
    pw_optrow:       { flexDirection: "row", alignItems: "center", height: 52,
                       paddingRight: 12, borderBottomWidth: 1 },
    pw_opt_grow:     { flex: 1, minWidth: 0, height: "100%", borderBottomWidth: 0 },
    pw_check:        { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
                       alignItems: "center", justifyContent: "center" },
    pw_check_t:      { fontSize: 12 },
    pw_label:        { fontFamily: F.body(400), fontSize: 15 },
    /* The split column is a FIXED width so the heading, every control and the anchor's bare
       number all centre on one axis — a column of figures, not a heading with two kinds of
       control hanging off it. (`--ppw-col: 96px`.) */
    PW_COL: 96,
    pw_trail:        { width: 96, alignItems: "center", justifyContent: "center", minHeight: 28 },
    pw_trail_rule:   { height: "100%", borderLeftWidth: 1 },   // .has-trail only
    pw_colhead:      { flexDirection: "row", alignItems: "center",
                       paddingRight: 12, paddingBottom: 6, paddingLeft: 14 },
    pw_colhead_t:    { fontFamily: F.mono(400), fontSize: 9.5, letterSpacing: 0.475,
                       textTransform: UP },
    pw_colhead_lead: { flex: 1, minWidth: 0 },
    pw_colhead_tail: { width: 96, textAlign: "center", alignSelf: "stretch",
                       alignItems: "center", justifyContent: "center" },
    /* The running "chosen so far" line — the wheel shows four rows, so this keeps the FULL
       selection visible even when earlier picks have scrolled away, and is what catches a
       forgotten stray tick from a previous batch. */
    pw_summary:      { marginTop: 10, marginHorizontal: 2, fontFamily: F.body(400), fontSize: 13,
                       lineHeight: 18.85 },
    pw_summary_b:    { fontFamily: F.body(600) },
    pw_summary_empty:{ fontFamily: F.body(400, true), opacity: 0.8 },
    /* Bare arrows beside the wheel — no box, just the two glyphs, height-matched to the wheel. */
    pw_arrows:       { height: 208, alignItems: "center", justifyContent: "center", rowGap: 22 },
    pw_arrows_trail: { height: 260 },
    pw_arrow_btn:    { minWidth: 40, minHeight: 40, paddingVertical: 6, paddingHorizontal: 8,
                       alignItems: "center", justifyContent: "center", opacity: 0.85 },
    pw_arrow_t:      { fontSize: 24, lineHeight: 24 },
    /* The "customize" cell on a section wheel. Eight characters is the field's WHOLE width — no
       scrolling inside it — so what she sees while typing is exactly what the card will show. */
    secname:         { width: 82, maxWidth: "100%", fontFamily: F.mono(400), fontSize: 12.5,
                       textAlign: "center", paddingVertical: 6, paddingHorizontal: 6,
                       borderWidth: 1.5, borderRadius: 8 },

    /* ── the numbers editor's two steps (`.fr-hint`, `.fr-ppw-*`) ── */
    fr_hint:         { fontFamily: F.body(400), fontSize: 15, lineHeight: 22.5, marginBottom: 20 },
    /* The ANCHOR cell: a derived, non-editable remainder — a bare number, NO label. The column
       heading already says what it is, and the word "rest" only competed with the figure
       (founder, 2026-07-26). */
    ppw_num:         { fontFamily: F.mono(400), fontSize: 16, textAlign: "center" },
    /* The chip is a form field only while it is still ASKING: at 0 it is a pine-bordered box with
       the figure in pine-d; the moment she picks a number it settles INTO the row — surface and
       edge go transparent and the figure takes the row's own ink — so answered rows read as one
       column of figures beside the anchor's. */
    ppw_sel:         { borderRadius: 8, borderWidth: 1.5, flexDirection: "row", alignItems: "center",
                       justifyContent: "center", width: 62,
                       paddingVertical: 5, paddingLeft: 12, paddingRight: 18 },
    ppw_sel_t:       { fontFamily: F.mono(400), fontSize: 16, textAlign: "center" },
    ppw_caret:       { position: "absolute", right: 8, fontSize: 10 },
    /* The INLINE strip of choices under the wheel — the phone's answer to the web's fixed
       listbox, once the editor itself became a window and a second overlay became untenable.
       It names the length it is setting, because by the time she has scrolled to it the row she
       tapped may be out of sight. */
    ppw_strip:       { flexDirection: "row", alignItems: "center", columnGap: 8,
                       marginTop: 8, paddingVertical: 6, paddingHorizontal: 2,
                       borderTopWidth: 1 },
    ppw_strip_k:     { fontFamily: F.mono(400), fontSize: 10, letterSpacing: 0.6, textTransform: UP },
    /* The open picker's rows (`.fr-ppw-opt`). */
    ppw_opt:         { borderRadius: 6, paddingVertical: 7, paddingHorizontal: 14, minWidth: 54,
                       alignItems: "center" },
    ppw_opt_t:       { fontFamily: F.mono(400), fontSize: 15 },
    /* ── the Prepare CTA (button.prepare-cta, globals.css 3371) ──
       "Every ordinary primary button is calm pine. The one action that actually spends tokens to
       build a plan gets a SINGULAR warm identity." The layer owns colour, weight, glow and ✦;
       each CONTEXT keeps its own size — `.primary` on the prepare screen (3px radius, 11/22,
       .08em at 12), `.mlp-allocate-btn` under the lesson list (6px radius, full width, 44 min
       on a phone). Both boxes below; the identity is applied by components/PrepareCta.jsx. */
    pcta_box_primary:  { borderRadius: 3, paddingVertical: 11, paddingHorizontal: 22,
                         alignItems: "center", justifyContent: "center" },
    pcta_box_allocate: { borderRadius: 6, minHeight: 44, paddingHorizontal: 14,
                         alignItems: "center", justifyContent: "center" },
    /* FIRST RUN's CTA wears BOTH `.fr-cta` (full width, 52 tall, radius 3 — see the specificity
       note there) and `.prepare-cta` (the identity). Same paint, the footer's geometry. */
    pcta_box_fr:       { borderRadius: 3, width: "100%", minHeight: 52,
                         alignItems: "center", justifyContent: "center" },
    pcta_t_primary:    { fontFamily: F.mono(600), fontSize: 12, lineHeight: 15, letterSpacing: 0.96,
                         textTransform: UP },
    pcta_t_allocate:   { fontFamily: F.mono(600), fontSize: 10, lineHeight: 13, letterSpacing: 0.5,
                         textTransform: UP },
    /* The identity: #fdf8ef at weight 600 over the clay→ochre gradient. */
    pcta_ident:        { color: "#fdf8ef" },
    pcta_row:          { flexDirection: "row", alignItems: "center", justifyContent: "center" },
    pcta_spark:        { marginRight: 8 },
    /* `overflow: hidden` clips the gradient to the radius — and would clip the glow with it on
       iOS, so the glow sits on an OUTER wrapper. 0 2px 15px rgba(182,90,49,.32). */
    pcta_clip:         { overflow: "hidden" },
    pcta_glow:         { shadowColor: "#b65a31", shadowOffset: { width: 0, height: 2 },
                         shadowRadius: 15, shadowOpacity: 0.32, elevation: 4 },
    /* inset 0 1px 0 rgba(255,255,255,.14) — an inner top highlight RN has no property for. */
    pcta_inset:        { position: "absolute", top: 0, left: 0, right: 0, height: 1,
                         backgroundColor: "rgba(255,255,255,.14)" },
    prep_hint:       { fontFamily: F.body(400, true), fontSize: 12.5, lineHeight: 18, color: t.ink_soft },

    /* ── Year Plan (.yp + children) — globals.css, with the ≤400px pad ──
       Two period figures side by side: Suggested (Meyy's proposal, her budget distributed by
       chapter weight) and Your plan (what she set when she prepared each lesson). The table is
       ONE object on its own plane (founder, 2026-08-30) — the note and the totals' own controls
       sit outside it, on the page. Columns 1fr / 54 / 68, keyed across header, rows and totals. */
    yp:              { paddingTop: 4, paddingBottom: 10, paddingHorizontal: 10 },
    yp_loading:      { paddingVertical: 28, paddingHorizontal: 12, textAlign: "center",
                       fontFamily: F.body(400), fontSize: 14, lineHeight: 21, color: t.ink_soft },
    yp_table:        { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingBottom: 12,
                       backgroundColor: ypCard },
    yp_colhd:        { flexDirection: "row", alignItems: "flex-end", columnGap: 6, marginTop: 15,
                       paddingBottom: 7, borderBottomWidth: 1 },
    yp_c:            { fontFamily: F.mono(400), fontSize: 8.5, lineHeight: 10.6, letterSpacing: 0.26,
                       textTransform: UP, color: t.ink, textAlign: "right" },
    yp_c_chap:       { flex: 1, minWidth: 0, textAlign: "center" },
    yp_c_sug:        { width: 54 },
    yp_c_plan:       { width: 68 },
    yp_row:          { flexDirection: "row", alignItems: "flex-start", columnGap: 6,
                       paddingVertical: 6, borderBottomWidth: 1 },
    yp_row_pend:     { opacity: 0.7 },
    yp_cell_ch:      { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "baseline", columnGap: 9 },
    yp_cn:           { fontFamily: F.mono(400), fontSize: 11, lineHeight: 14, color: t.ink },
    yp_cname:        { flex: 1, minWidth: 0, fontFamily: F.display(500), fontSize: 11, lineHeight: 13.75, color: t.ink },
    yp_cname_await:  { fontFamily: F.display(400, true), color: t.ink_soft },
    yp_sug:          { width: 54, textAlign: "right", fontFamily: F.display(400), fontSize: 19,
                       lineHeight: 23, color: t.ink },
    yp_planw:        { width: 68, alignItems: "flex-end" },
    yp_plan:         { fontFamily: F.display(600), fontSize: 19, lineHeight: 23, color: t.ink },
    yp_set:          { fontFamily: F.display(500), fontSize: 13, lineHeight: 17, color: t.ink_soft },
    yp_dash:         { color: t.line, fontFamily: F.display(400), fontSize: 19, lineHeight: 23 },
    yp_pend:         { marginTop: 3, fontFamily: F.mono(400), fontSize: 8, lineHeight: 10,
                       letterSpacing: 0.48, textTransform: UP, color: t.ink_soft, opacity: 0.85 },
    yp_tot:          { flexDirection: "row", alignItems: "baseline", columnGap: 6, marginTop: 2,
                       paddingTop: 12, paddingBottom: 10, borderBottomWidth: 2 },
    /* ⚠️ NO `flex` HERE, AND THAT IS THE FIX — confirmed on the handset (2026-09-15, third
       attempt at this one row). It carried `flex: 1` because `.yp-tot`'s label cell is the web
       grid's `1fr`. Fine while the label WAS the cell; once the pencil joined it, every way of
       un-stretching it at the call site was worse than not stretching it here: `flex: 0` is
       grow 0 / shrink 0 / basis ZERO in Yoga and collapsed the words, and `flexBasis: "auto"`
       was the only flexBasis in the entire app — a string value reached for to fight a property
       that should not have been on this style at all.
       The `1fr` now belongs to an explicit spacer in YearPlan.jsx, so this is a plain label that
       sizes to its own words on every platform, with no override and nothing to get wrong.
       ⚠️ A `flex` on a style that is sometimes a whole cell and sometimes one item inside one is
       a trap wherever it appears — the cell-ness belongs to the layout, not to the label. */
    yp_tot_l:        { fontFamily: F.mono(400), fontSize: 10, lineHeight: 13,
                       letterSpacing: 0.6, textTransform: UP, color: t.ink_soft },
    yp_tot_n:        { textAlign: "right", fontFamily: F.display(600), fontSize: 18, lineHeight: 22, color: t.ink },
    /* `yp_tot_lrow` is gone: the label and pencil are direct children of the row now, with an
       explicit spacer for the grid's `1fr`. ⚠️ Removing that wrapper did NOT fix the iOS bug —
       it was a plausible theory (a View has no text baseline, and this row aligns on one) that
       the founder's next look disproved. The cause was `flex` on the label; see YearPlan.jsx. */
    /* `.yp-budget-edit` (globals.css 4752): a phone-sized tap target that does NOT open up the
       line it sits in — 10px of vertical padding cancelled by -10px of margin. On RN that is
       simply `hitSlop`, which is the same intent said properly, so the negative margins go. */
    yp_budget_edit:  { marginLeft: 6, paddingHorizontal: 8, opacity: 0.8 },
    yp_note:         { marginTop: 16, marginBottom: 20, fontFamily: F.body(400, true), fontSize: 14,
                       lineHeight: 22.68, color: t.ink },
    yp_note_b:       { fontFamily: F.body(600), fontStyle: "normal" },
  };
}

export function useWebStyles() {
  const { t, scheme } = useTheme();
  return useMemo(() => webStyles(t, scheme), [t, scheme]);
}
