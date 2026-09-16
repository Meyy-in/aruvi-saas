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
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { API } from "@aruvi/shared/config";
import Markdown from "./Markdown";
import { useWebStyles } from "../theme/web";

export default function PrivacyNotice() {
  const ws = useWebStyles();
  const [state, setState] = useState(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    let live = true;
    fetch(`${API}/legal/privacy`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (live) setState(d); })
      .catch(() => { if (live) setFailed(
        "The privacy notice couldn’t be loaded just now. Check your connection and try again."); });
    return () => { live = false; };
  }, []);
  if (failed) return <Text style={ws.lgl_fail}>{failed}</Text>;
  if (!state) return <Text style={ws.fr_loading}>Loading the privacy notice…</Text>;
  const doc = (state && (state.document || state)) || {};
  return (
    <View>
      <Markdown md={doc.body} />
      <Text style={ws.lgl_version}>
        {doc.title || "Privacy Notice"} · version {doc.version}
        {doc.effective_from ? ` · effective ${doc.effective_from}` : ""}
      </Text>
    </View>
  );
}
