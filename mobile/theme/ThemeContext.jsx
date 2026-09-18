/* Theme = the OS scheme + the teacher's in-app override (Auto/Light/Dark), the same three-way
 * the web keeps in localStorage under `aruvi-theme`. Stored through the shared storage shim so
 * the key survives sign-out (it is a device preference, not a teacher cache — clearTeacherCaches
 * does not name it). `t` is the resolved token set for the effective scheme. */
import { createContext, useContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { storage } from "@aruvi/shared/storage";
import { light, dark } from "./tokens";

const KEY = "aruvi-theme";
/* The teacher's text size (2026-09-18) — a DEVICE preference like the theme, so it survives
   sign-out. "system" follows the iPhone (capped in components/Text.jsx); the rest are fixed. */
const SIZE_KEY = "aruvi-text-size";
export const TEXT_SCALES = { standard: 1, large: 1.1, larger: 1.2 };
export const TextSizeCtx = createContext("system");
const ThemeCtx = createContext({ t: light, scheme: "light", pref: "system", setPref: () => {},
                                textSize: "system", setTextSize: () => {} });

export function ThemeProvider({ children }) {
  const os = useColorScheme() || "light";
  const [pref, setPrefState] = useState(() => { try { return storage.getItem(KEY) || "system"; } catch { return "system"; } });
  const setPref = (p) => { setPrefState(p); try { storage.setItem(KEY, p); } catch {} };
  const [textSize, setTextSizeState] = useState(() => {
    try { const v = storage.getItem(SIZE_KEY); return v && (v === "system" || TEXT_SCALES[v]) ? v : "system"; }
    catch { return "system"; }
  });
  const setTextSize = (v) => { setTextSizeState(v); try { storage.setItem(SIZE_KEY, v); } catch {} };
  const scheme = pref === "system" ? os : pref;
  const value = useMemo(() => ({ t: scheme === "dark" ? dark : light, scheme, pref, setPref,
                                 textSize, setTextSize }), [scheme, pref, textSize]);
  return (
    <ThemeCtx.Provider value={value}>
      <TextSizeCtx.Provider value={textSize}>{children}</TextSizeCtx.Provider>
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
