/* The few primitives every screen uses — primary/link buttons, a field, quiet and error
 * lines — styled from the tokens so a screen never names a colour. */
import { Pressable, View, StyleSheet, ActivityIndicator } from "react-native";
import { Text, TextInput } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";
import { type } from "../theme/type";

export function Button({ title, onPress, disabled, busy, kind = "primary", style }) {
  const { t } = useTheme();
  const primary = kind === "primary";
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} accessibilityRole="button"
      style={({ pressed }) => [s.btn, primary ? { backgroundColor: t.pine, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }
        : { backgroundColor: "transparent", opacity: pressed ? 0.6 : 1 }, style]}>
      {busy ? <ActivityIndicator color={primary ? t.paper : t.pine} /> :
        <Text style={[type.button, { color: primary ? "#f3efe6" : t.pine }]}>{title}</Text>}
    </Pressable>
  );
}

/* ★ THE WEB'S `.fr-link`, EXACTLY (founder, 2026-09-16: "align look and font 'New to Meyy? Get
 * started →' on expo/iphone with same in the web app"). This drew 17px Newsreader with an
 * underline; the web's foot links are the house MONO at 12px, pine, unadorned — the same control
 * the profile window and first run use, which is why it looked like a different product on the
 * one screen a teacher meets first.
 * ⚠️ Underline REMOVED, not restyled: `.fr-link` has none, and on the web the affordance is the
 * pine ink and the hover. On a phone there is no hover, and the ink is what carries it.
 * Every caller of this primitive is a front-door foot link (login.jsx, three of them), so the
 * change is safely made here rather than at each call site. */
export function Link({ title, onPress, disabled, style }) {
  const ws = useWebStyles();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="link" hitSlop={6}
      style={[ws.fr_link_pad, disabled && { opacity: 0.45 }]}>
      {/* `.ob-foot` centres its contents; the row itself stays stretched so a CTA beside this
          link keeps its full width. */}
      <Text style={[ws.fr_link_t, { textAlign: "center" }, style]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, children }) {
  const { t } = useTheme();
  return (
    <View style={{ marginTop: 18 }}>
      {label ? <Text style={[type.label, { color: t.ink_soft, marginBottom: 6 }]}>{label}</Text> : null}
      {children}
    </View>
  );
}

/* ★ A LOCKED FIELD LOOKS LOCKED (founder, 2026-09-16: "when mobile is entered and OTP is being
 * asked, grey the mobile box — an empty fill gives the impression it can be changed"). The number
 * locks once the code is in flight, and on the returning path where it came from her account —
 * but it kept the light FIELD background, which is this app's "type here" surface, so the lock
 * was real and invisible and the box invited a tap that did nothing. Sunk paper and soft ink
 * instead: nothing is added, the affordance is simply withdrawn. Applied HERE rather than at the
 * two call sites, so every read-only field in the app says the same thing. */
export function Input({ style, ...props }) {
  /* WALK-A-029/023 (2026-09-20): on iOS a single-line TextInput with a lineHeight draws its text at
     the BOTTOM of the box (and so '+91' beside it looked raised). Single-line fields drop the
     lineHeight and centre vertically; multiline keeps it. */
  const singleLine = !props.multiline;
  const { t } = useTheme();
  const locked = props.editable === false;
  return <TextInput placeholderTextColor={t.ink_soft}
    style={[type.body, s.input, singleLine && { lineHeight: undefined, textAlignVertical: "center", paddingVertical: 0 },
      { backgroundColor: locked ? t.paper_sunk : t.field_bg, borderColor: t.edge,
        color: locked ? t.ink_soft : t.ink },
      style]} {...props} />;
}

export function Quiet({ children, style }) {
  const { t } = useTheme();
  return <Text style={[type.small, { color: t.ink_soft, marginTop: 8 }, style]}>{children}</Text>;
}

export function ErrorLine({ children }) {
  const { t } = useTheme();
  if (!children) return null;
  return <Text accessibilityRole="alert" style={[type.small, { color: t.danger, marginTop: 10 }]}>{children}</Text>;
}

const s = StyleSheet.create({
  btn: { minHeight: 50, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
});
