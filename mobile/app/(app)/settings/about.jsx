/* About Meyy was removed (WALK-A-136, founder 2026-09-29). The route survives only so an old
 * link lands on the Settings list rather than a blank screen; nothing in the app opens it. */
import { Redirect } from "expo-router";

export default function About() {
  return <Redirect href="/settings" />;
}
