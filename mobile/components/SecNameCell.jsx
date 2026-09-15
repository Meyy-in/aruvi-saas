/* ───────── the "customize" cell on a section wheel (Track D step 5d) ─────────
 *
 * A port of `SecNameCell` in TeachingProfile.jsx. The box that opens on a ticked row, so ticking
 * reads as "and now, if you like, name it".
 *
 * ★ HER OWN NAME IS A LABEL, NEVER A KEY (founder, 2026-08-30). The LETTER is Meyy's key and stays
 * it: `sec` and `tag` are what every bookmark, chapter binding and cache key in the product is
 * built from, so a rename must never touch them. `name` is a display label laid over the tag —
 * "Rose", "Blue", "Tamil-B", whatever her school calls the room. That is the whole design:
 * renaming a section can therefore never orphan the work attached to it.
 *
 * ★ EIGHT CHARACTERS, AND THE FIELD IS ITS WHOLE WIDTH. It has to sit in a card's corner beside
 * the class number and in a 96px column on a 360px phone; a label that wraps is not a label. No
 * scrolling inside it either, so what she sees while typing is exactly what the card will show.
 * Blank means not customized and the field is ABSENT from the record — never an empty string — so
 * "has a name" is one truthiness test everywhere (`secObj`, in @aruvi/shared/profile).
 *
 * ★ DELIBERATELY NOT AUTOFOCUSED. PickWheel re-rests the wheel on every toggle (an animated
 * scroll), and pulling focus into a field inside that scroller mid-animation fights it and throws
 * the keyboard up over the list she is still picking from. The box appearing IS the invitation.
 */
import { TextInput } from "react-native";
import { SEC_NAME_MAX, cleanSecName } from "@aruvi/shared/profile";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

export default function SecNameCell({ on, tag, value, onChange }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  if (!on) return null;
  return (
    <TextInput value={value} maxLength={SEC_NAME_MAX}
      onChangeText={(v) => onChange(cleanSecName(v))}
      autoCorrect={false} autoCapitalize="words" spellCheck={false}
      accessibilityLabel={`Your own name for section ${tag} (optional, up to ${SEC_NAME_MAX} characters)`}
      style={[ws.secname, { borderColor: t.pine, backgroundColor: t.paper_2, color: t.ink }]} />
  );
}
