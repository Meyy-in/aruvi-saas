/* ───────── F11 — the Aruvi dropdown, as a phone picker (Track D 6b, app. 04 rows J1-J8) ─────────
 *
 * ★ WHY THE WEB HAS ONE AT ALL, AND WHY THE PHONE'S IS DIFFERENT. `web/app/components/Dropdown.jsx`
 * exists because a native `<select>`'s popup on macOS is an NSMenu: it follows the OS appearance
 * and reads none of the page's CSS, so a light app on a dark Mac opened a black list. Its own
 * header says it plainly — "there is no CSS fix" — and so the web rebuilt the control as a
 * listbox with full keyboard support, a fixed-position popup that an `overflow:auto` ancestor
 * cannot clip, a flip-above when the field sits low, and a close-on-page-scroll.
 *
 * ★ EVERY ONE OF THOSE IS AN ANSWER TO A POINTER AND A KEYBOARD, and the phone has neither.
 * What carries over is the SKIN (`dd_*` in theme/web.js, measured off the same CSS) and the API
 * — `value`, `onChange(value)`, `options` — so a call site reads the same on both surfaces. What
 * does not carry over is the machinery: no arrow keys, no `aria-activedescendant`, no flip
 * geometry, no scroll chasing. The list is a Sheet, which is the app's own answer to "choose one
 * of these" everywhere else (the chapter picker, the profile window) and cannot be clipped by
 * anything because it is a Modal.
 *
 * ⚠️ AND IT REUSES THE APP'S Sheet RATHER THAN GROWING A SECOND ONE. A window that behaves almost
 * like the others is worse than either — the ✕, the scrim tap, the fade and the corner geometry
 * are all settled behaviour by now, and every one of them cost a founder report to get right.
 */
import { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Text } from "./Text";
import { Sheet } from "./AttachSheet";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

/* `options` takes the web's two shapes: a plain string, or `{ value, label }`. */
const valOf = (o) => (o && typeof o === "object" ? o.value : o);
const labOf = (o) => (o && typeof o === "object" ? o.label : o);

export default function Dropdown({ value, onChange, options = [], placeholder = "Choose one",
                                   label, disabled = false }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const [open, setOpen] = useState(false);

  const current = options.find((o) => valOf(o) === value);
  /* A dropdown still showing its placeholder reads grey — the web's `.dd-unset .dd-lab`. */
  const unset = !current;

  return (
    <>
      <Pressable onPress={disabled ? undefined : () => setOpen(true)} disabled={disabled}
        accessibilityRole="button" accessibilityLabel={label}
        accessibilityValue={{ text: current ? labOf(current) : placeholder }}
        style={[ws.dd_btn, { backgroundColor: t.field_bg, borderColor: open ? t.pine : t.line,
                             opacity: disabled ? 0.5 : 1 }]}>
        <Text style={[ws.dd_lab, { color: unset ? t.ink_soft : t.ink }]} numberOfLines={1}>
          {current ? labOf(current) : placeholder}
        </Text>
        <Text style={[ws.dd_chev, { color: t.ink_soft }]}>▾</Text>
      </Pressable>

      {open ? (
        <Sheet visible scroll onClose={() => setOpen(false)} kicker={label} title={placeholder}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {options.map((o) => {
              const v = valOf(o);
              const on = v === value;
              /* ★ AN OPTION CAN BE DEAD, and it must actually be dead (2026-09-16, found while
                 walking the subscribe cart). The web disables a subject·stage she already holds
                 or has added in another row, and the label says WHICH — "· you have this" /
                 "· already added". The phone rendered that label and then let her tap it, which
                 is worse than not saying it: the row would accept a pair `cartScopes` de-dupes,
                 so she would see two rows and be charged for one. */
              const dead = !!(o && typeof o === "object" && o.disabled);
              return (
                <Pressable key={String(v)} accessibilityRole="button" disabled={dead}
                  accessibilityState={{ selected: on, disabled: dead }}
                  onPress={dead ? undefined
                                : () => { onChange && onChange(v); setOpen(false); }}
                  style={[ws.dd_opt, on && { backgroundColor: t.tint_pine },
                          dead && { opacity: 0.45 }]}>
                  <Text style={[ws.dd_opt_t, on && ws.dd_opt_on,
                                { color: dead ? t.ink_soft : on ? t.pine : t.ink }]}>
                    {labOf(o)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Sheet>
      ) : null}
    </>
  );
}
