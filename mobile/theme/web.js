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

export function webStyles(t) {
  const cream = "#f3efe6";                 // --bar-ink / cream on pine (both themes)
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
    ap_overlay:      { flex: 1, alignItems: "center", justifyContent: "center", padding: 20,
                       backgroundColor: "rgba(31,42,36,.42)" },
    ap_modal:        { width: "100%", maxWidth: 460, borderRadius: 14, borderWidth: 1,
                       paddingTop: 22, paddingHorizontal: 22, paddingBottom: 18 },
    ap_confirm:      { maxWidth: 420 },
    ap_close:        { position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 15,
                       borderWidth: 1, alignItems: "center", justifyContent: "center" },
    ap_close_glyph:  { fontSize: 13, lineHeight: 15 },
    ap_head:         { marginBottom: 14, paddingRight: 30 },
    ap_kicker:       { fontFamily: F.mono(400), fontSize: 10.5, lineHeight: 15, letterSpacing: 1.26,
                       textTransform: UP, color: t.ochre },
    ap_title:        { fontFamily: F.display(500), fontSize: 21, lineHeight: 26, color: t.ink, marginTop: 4 },
    ap_sub:          { fontFamily: F.body(400), fontSize: 13, lineHeight: 19, color: t.ink_soft, marginTop: 3 },
    ap_list:         { rowGap: 8, marginBottom: 4 },
    ap_row:          { rowGap: 6, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10,
                       borderWidth: 1, borderColor: t.line_soft, backgroundColor: t.paper_2 },
    ap_none:         { fontFamily: F.body(400, true), fontSize: 13, lineHeight: 19, color: t.ink_soft,
                       paddingVertical: 8, paddingHorizontal: 2 },
    ap_actions:      { flexDirection: "row", justifyContent: "flex-end", columnGap: 10, marginTop: 2 },
    ap_btn:          { borderRadius: 7, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 15 },
    ap_btn_label:    { fontFamily: F.mono(400), fontSize: 11, letterSpacing: 0.55, textTransform: UP },
    ch_meta:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 10 },
    ch_name:         { fontFamily: F.body(400), fontSize: 15, lineHeight: 19.2, color: t.ink, flex: 1, minWidth: 0 },
    ch_no:           { color: t.pine_d, fontFamily: F.body(500) },
    ch_go:           { fontFamily: F.body(400), fontSize: 19, lineHeight: 19, color: t.ink_soft },

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
    uv_phase:        { flexDirection: "row", gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: t.line_soft },
    uv_ph_time:      { width: 34 },
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
    co_utitle:       { fontFamily: F.display(500), fontSize: 13.5, lineHeight: 18, color: t.ink, flex: 1 },
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
    cn_modal:        { width: "100%", maxWidth: 468, maxHeight: "90%", borderRadius: 12,
                       borderWidth: 1, overflow: "hidden" },
    cn_head:         { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
                       columnGap: 12, paddingTop: 18, paddingHorizontal: 22, paddingBottom: 14,
                       borderBottomWidth: 1 },
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
    cn_paper_wrap:   { flex: 1, backgroundColor: t.paper_2 },
    cn_rule:         { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: t.line },
    cn_paper:        { fontFamily: F.body(400), fontSize: 16, lineHeight: 32, letterSpacing: 0.1,
                       color: t.ink, backgroundColor: "transparent",
                       paddingTop: 5, paddingHorizontal: 22, paddingBottom: 0 },
    cn_foot:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                       columnGap: 12, paddingTop: 12, paddingHorizontal: 22, paddingBottom: 16,
                       borderTopWidth: 1 },
    cn_foot_l:       { flexDirection: "row", alignItems: "center", columnGap: 14 },
    cn_count:        { fontFamily: F.mono(400), fontSize: 11, letterSpacing: 0.44, color: t.ink_soft },
    cn_count_over:   { color: t.clay },
    cn_save:         { backgroundColor: t.pine, borderRadius: 5, paddingVertical: 9, paddingHorizontal: 20 },
    cn_save_t:       { fontFamily: F.mono(400), fontSize: 12, letterSpacing: 0.72, textTransform: UP, color: t.paper },
    /* "Speak" is a bordered PILL with a line-art mic, not plain text with an emoji glyph. */
    cn_speak:        { flexDirection: "row", alignItems: "center", columnGap: 6, borderWidth: 1,
                       borderColor: t.line, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
    cn_speak_t:      { fontFamily: F.mono(400), fontSize: 10.5, letterSpacing: 0.84, textTransform: UP, color: t.ink_soft },
  };
}

export function useWebStyles() {
  const { t } = useTheme();
  return useMemo(() => webStyles(t), [t]);
}
