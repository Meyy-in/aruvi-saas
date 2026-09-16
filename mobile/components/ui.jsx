/* The few primitives every screen uses — primary/link buttons, a field, quiet and error
 * lines — styled from the tokens so a screen never names a colour. */
import { Pressable, View, StyleSheet, ActivityIndicator } from "react-native";
import { Text, TextInput } from "./Text";
import { useTheme } from "../theme/ThemeContext";
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

export function Link({ title, onPress, disabled, style }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="link" hitSlop={6}>
      <Text style={[type.body, { color: t.pine, textDecorationLine: "underline", opacity: disabled ? 0.5 : 1 }, style]}>{title}</Text>
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
  const { t } = useTheme();
  const locked = props.editable === false;
  return <TextInput placeholderTextColor={t.ink_soft}
    style={[type.body, s.input,
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
