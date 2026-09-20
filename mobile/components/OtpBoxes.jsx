/* Six auto-advancing boxes (four under the stub), backspace steps back, a pasted or
 * autofilled code spreads across them — the web's Login.jsx behaviour, on native inputs.
 * The first box carries textContentType/autoComplete oneTimeCode so iOS and Android offer the
 * SMS code above the keyboard; the whole code lands in box 0 and is spread from there. */
import { useRef } from "react";
import { View, StyleSheet } from "react-native";
import { TextInput } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { mono } from "../theme/fonts";

export default function OtpBoxes({ value, onChange, length = 6, autoFocus = false, disabled = false }) {
  const { t } = useTheme();
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || "");
  const setDigit = (i, raw) => {
    const d = raw.replace(/\D/g, "");
    if (d.length >= length) { onChange(d.slice(0, length)); refs.current[length - 1]?.focus(); return; }
    if (d.length > 1) {   // a paste shorter than the code: spread from this box
      const arr = digits.slice(); for (let k = 0; k < d.length && i + k < length; k++) arr[i + k] = d[k];
      onChange(arr.join("")); refs.current[Math.min(i + d.length, length - 1)]?.focus(); return;
    }
    const arr = digits.slice(); arr[i] = d.slice(-1); onChange(arr.join(""));
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    /* WALK-A-024 (founder, 2026-09-20): one Backspace on an EMPTY box steps back AND clears that
       digit — it used to need a second press. */
    if (e.nativeEvent.key === "Backspace" && !digits[i] && i > 0) {
      const arr = digits.slice(); arr[i - 1] = ""; onChange(arr.join(""));
      refs.current[i - 1]?.focus();
    }
  };
  return (
    <View style={s.row}>
      {digits.map((d, i) => (
        <TextInput key={i} ref={(el) => { refs.current[i] = el; }}
          style={[s.box, { borderColor: d ? t.pine : t.edge, backgroundColor: t.field_bg, color: t.ink, fontFamily: mono(500) },
                  disabled && { opacity: 0.45 }]}
          value={d} onChangeText={(v) => setDigit(i, v)} onKeyPress={(e) => onKey(i, e)}
          editable={!disabled}
          keyboardType="number-pad" inputMode="numeric" maxLength={i === 0 ? length : 1}
          textContentType={i === 0 ? "oneTimeCode" : "none"} autoComplete={i === 0 ? "sms-otp" : "off"}
          autoFocus={autoFocus && i === 0} selectTextOnFocus accessibilityLabel={`OTP digit ${i + 1}`} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  // 6 × 44 + 5 × 8 = 304 — the web's phone row, which fits 320px of content at 360 wide
  box: { flex: 1, maxWidth: 48, height: 52, borderWidth: 1.5, borderRadius: 8, textAlign: "center", fontSize: 22 },
});
