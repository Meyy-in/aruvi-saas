/* The three faces the design system names (CLAUDE.md §4: Fraunces display · Newsreader body ·
 * IBM Plex Mono — "no Inter/system fonts"), bundled through @expo-google-fonts so the phone
 * never loads a font over the network. The web uses the variable fonts; these are the static
 * cuts at the weights the web actually sets (400/500/600/700 + the italics the measured styles use: Newsreader 400i, Fraunces 400i/600i). */
import { Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_400Regular_Italic, Fraunces_600SemiBold_Italic } from "@expo-google-fonts/fraunces";
import { Newsreader_400Regular, Newsreader_500Medium, Newsreader_600SemiBold, Newsreader_400Regular_Italic } from "@expo-google-fonts/newsreader";
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold } from "@expo-google-fonts/ibm-plex-mono";

export const FONT_MAP = {
  Fraunces_400Regular, Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_400Regular_Italic, Fraunces_600SemiBold_Italic,
  Newsreader_400Regular, Newsreader_500Medium, Newsreader_600SemiBold, Newsreader_400Regular_Italic,
  IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold,
};

/* Pick the family name for a role + weight. React Native selects a font by NAME, not by
 * fontWeight, so every Text goes through this rather than setting fontWeight: "600". */
const cut = (base, w, italic) => {
  if (italic) return `${base}_400Regular_Italic`;
  if (w >= 600) return `${base}_600SemiBold`;
  if (w >= 500) return `${base}_500Medium`;
  return `${base}_400Regular`;
};
export const display = (w = 400, italic = false) => cut("Fraunces", w, italic);
export const body = (w = 400, italic = false) => cut("Newsreader", w, italic);
/* ⚠️ 700 REACHES THE BOLD CUT (2026-09-16). `IBMPlexMono_700Bold` has been imported and in
   FONT_MAP since this file was written, but the ladder stopped at 600, so every `mono(700)`
   silently rendered semibold — a bundled face nothing could ask for. The Subscribe button is
   the web’s first 700 in mono and is what found it. */
export const mono = (w = 400) => (w >= 700 ? "IBMPlexMono_700Bold"
  : w >= 600 ? "IBMPlexMono_600SemiBold" : w >= 500 ? "IBMPlexMono_500Medium" : "IBMPlexMono_400Regular");
