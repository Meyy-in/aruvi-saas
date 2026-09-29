/* ★ ONE WAY TO PUT AN EMAIL ON RECORD — the phone's twin of web/app/components/EmailEntry.jsx
 * (WALK-A-125 / 135, founder 2026-09-28). Read that file's header for the why; the shape is:
 *   · the address on record FROZEN, with "change" at the right end;
 *   · "change" opens New email + Type it again together; the second has no "change" of its own;
 *   · ONE "Confirm". Matched → collapses to the frozen row. Unmatched → a warning, NOTHING reset
 *     (the old flow sent her back to the first box and could loop forever);
 *   · "change" again while open takes both boxes away;
 *   · no paste into the second box (the context menu is hidden there); the keyboard's saved
 *     addresses (autofill) are allowed in both.
 * Props are the web component's: current, label, selfId, mask, onConfirmed, onDraft, disabled.
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { Field, Input, Link, ErrorLine } from "./ui";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";
import { EMAIL_OK, EMAIL_TAKEN, idInUse } from "@aruvi/shared/format";

export const EMAIL_MISMATCH = "The two entries don’t match — check both and try again.";

const maskEmail = (e) => {
  const [u, d] = String(e).split("@");
  if (!d) return "•••";
  return `${u.slice(0, 1)}•••@${d}`;
};
/* The web's `emailFit`: the type steps DOWN as the address grows, and never truncates. */
const emailSize = (e) => {
  const n = String(e || "").length;
  return n <= 22 ? 14 : n <= 28 ? 13 : n <= 36 ? 12 : 11;
};
const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

export const matchedDraft = (d) =>
  d && d.editing && EMAIL_OK(d.first) && same(d.first, d.second) ? d.first.trim() : null;

const EMAIL_KB = { keyboardType: "email-address", autoCapitalize: "none", autoCorrect: false,
                   autoComplete: "email", textContentType: "emailAddress" };

export default function EmailEntry({ current = "", label = "Email", selfId = "", mask = false,
                                     onConfirmed, onDraft, disabled = false }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const [editing, setEditing] = useState(!current);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setEditing(!current); }, [current]);
  useEffect(() => { onDraft && onDraft({ editing, first, second }); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, first, second]);

  const toggle = () => { setFirst(""); setSecond(""); setErr(""); setEditing((v) => !v); };

  const confirm = async () => {
    if (busy || disabled || !EMAIL_OK(first) || !EMAIL_OK(second)) return;
    if (!same(first, second)) { setErr(EMAIL_MISMATCH); return; }
    const v = first.trim();
    if (current && same(v, current)) { toggle(); return; }
    setBusy(true); setErr("");
    try {
      if (await idInUse(v, selfId)) { setErr(EMAIL_TAKEN); return; }
      const msg = onConfirmed ? await onConfirmed(v) : "";
      if (msg) { setErr(msg); return; }
      setFirst(""); setSecond(""); setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {current ? (
        <Field label={label}>
          <View style={[ws.ob_email_view, { borderColor: t.line, backgroundColor: t.card_bg }]}>
            <Text style={[ws.ob_email_addr, { color: t.ink, fontSize: emailSize(current) }]}>
              {mask ? <Text style={[ws.ob_tick, { color: t.pine }]}>✓ </Text> : null}
              {mask ? maskEmail(current) : current}
            </Text>
            <Link title="change" disabled={disabled || busy} onPress={toggle} />
          </View>
        </Field>
      ) : null}
      {editing ? (
        <>
          <Field label={current ? "New email" : label}>
            <Input value={first} placeholder="Enter your email" editable={!disabled && !busy}
              onChangeText={(v) => { setFirst(v); setErr(""); }} {...EMAIL_KB} />
          </Field>
          <Field label="Type it again">
            <Input value={second} placeholder="Type it again to confirm" editable={!disabled && !busy}
              contextMenuHidden
              onChangeText={(v) => { setSecond(v); setErr(""); }} {...EMAIL_KB} />
          </Field>
          <ErrorLine>{err}</ErrorLine>
          <Link title={busy ? "Checking…" : "Confirm"}
            disabled={disabled || busy || !EMAIL_OK(first) || !EMAIL_OK(second)}
            onPress={confirm} />
        </>
      ) : null}
    </>
  );
}
