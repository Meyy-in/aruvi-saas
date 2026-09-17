/* ───────── The subscribe wizard, IN-APP door (6b·D2, Q11) ─────────
 *
 * The wizard itself is `components/SubscribeWizard.jsx` — it serves two doors and its header
 * says how they differ. This route is the in-app one: the paywall's and Settings' Subscribe, for
 * a teacher who is already inside. Done and Cancel are the same act here (back to where she came
 * from, or Subscription & billing when there is no stack behind her), which is the wizard's own
 * default, so it is passed nothing.
 *
 * ⚠️ NO TRIAL FORK. It belongs to the front door and to a teacher who has not started; offering
 * a trial to one whose trial has ended is an offer Meyy cannot honour. The front door is
 * `app/subscribe.jsx`, deliberately OUTSIDE this group — see its own header.
 */
import SubscribeWizard from "../../components/SubscribeWizard";

export default function Subscribe() {
  return <SubscribeWizard />;
}
