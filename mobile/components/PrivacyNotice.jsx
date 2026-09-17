/* ───────── The Privacy Notice, as an embeddable block (2026-09-16) ─────────
 *
 * ★ EXTRACTED BECAUSE THERE WERE ALREADY TWO, and the agreement's sign step wanted a third.
 * `settings/legal.jsx` held a local `PrivacyBody()` and `app/privacy.jsx` its own copy of the
 * same fetch and the same two failure sentences. One document, one component.
 *
 * ⚠️ A BARE `fetch`, DELIBERATELY — no identity header. DPDP §5 makes the notice something the
 * fiduciary GIVES at or before collection, so it is served open (`GET /legal/privacy` takes no
 * `X-Aruvi-User`) and the pre-sign-in screen links it before a mobile number is typed. Adding
 * `withUser` here would quietly make it require an account.
 *
 * ⚠️ `app/privacy.jsx` still holds its own copy, for one real reason: its pinned head shows
 * `doc.title`, so that screen needs the document's state and not just its rendering. Merging it
 * would mean lifting state out of here — recorded, not done.
 *
 * ★ `version` SERVES AN OLDER PUBLISHED VERSION (2026-09-17, app. 03 rows 48/54 · app. 04 G4).
 * The document is versioned by FILENAME and never edited once shown, so "the notice she was
 * given" and "the notice current today" are different documents and the screen must be able to
 * ask for the first. Ported to match `web/app/components/PrivacyNotice.jsx` prop for prop.
 * ⚠️ **NOTHING PASSES IT YET — on EITHER surface.** All three web call sites (Login, Settings,
 * Agreement's sheet) take the default, so the `older` hint has never fired in production. It is
 * ported because a component whose API silently differs from the web's is the drift CLAUDE.md §3
 * exists to stop, not because a caller is waiting. **Wire a caller or delete it on BOTH surfaces
 * — do not leave it half-alive on one.**
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { API } from "@aruvi/shared/config";
import { dateWords } from "@aruvi/shared/legalmd";
import Markdown from "./Markdown";
import { useWebStyles } from "../theme/web";

export default function PrivacyNotice({ version = "" }) {
  const ws = useWebStyles();
  const [state, setState] = useState(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    let live = true;
    const q = version ? `?version=${encodeURIComponent(version)}` : "";
    fetch(`${API}/legal/privacy${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (live) setState(d); })
      .catch(() => { if (live) setFailed(
        "The privacy notice couldn’t be loaded just now. Check your connection and try again."); });
    return () => { live = false; };
  }, [version]);
  if (failed) return <Text style={ws.lgl_fail}>{failed}</Text>;
  if (!state) return <Text style={ws.fr_loading}>Loading the privacy notice…</Text>;
  const doc = (state && (state.document || state)) || {};
  const older = state.current_version && doc.version && doc.version !== state.current_version;
  return (
    <View>
      {/* She is reading the version she was GIVEN, and a newer one exists. Said before the
          document, not after it — the whole point is to frame what follows. */}
      {older ? (
        <Text style={ws.lgl_hint}>
          This is version {doc.version}, which you were shown. The current notice is version{" "}
          {state.current_version}.
        </Text>
      ) : null}
      <Markdown md={doc.body} />
      {/* The version line in full — which version, when it was published, in what language, and
          where to find it again. It printed the title and an `effective_from` the web never
          shows, and dropped the language and the pointer the web ends on. */}
      <Text style={ws.lgl_version}>
        Version {doc.version}
        {doc.published ? ` · ${dateWords(doc.published)}` : ""}
        {" · "}{doc.language === "en" ? "English" : doc.language}
        {" · This notice is available at any time under Settings › Legal."}
      </Text>
    </View>
  );
}
