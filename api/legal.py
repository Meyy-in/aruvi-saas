"""The user agreement, read from disk and cut into the shape the UI ticks (2026-08-27).

ONE SOURCE, TWO SURFACES. `data/cloud/content/legal/consent_and_disclaimer_v{V}.md` is
the founder's document, and it is the only copy: the subscribe wizard's Agreement step
and Settings › Legal both render THIS text, parsed, never a re-typed summary. A legal
document that exists twice is a legal document that will disagree with itself, and the
half a teacher ticked is the half that binds.

It lives under DATA_DIR (Bucket A-serve, CLAUDE.md §7) and not under docs/ or
data/authoring/, for a plain reason: the runtime serves it to every teacher before she
pays, so it must travel inside the migration unit. It is shared, read-only, versioned
content — exactly what Bucket A is.

**The version is the filename.** `..._v0.1.md` → "0.1". That is deliberate: publishing a
new version is dropping a new FILE beside the old one, never editing text a teacher has
already accepted. Her consent record names the version she saw, so the file she saw must
still exist to be shown back to her. `current_version()` picks the highest on disk; older
files stay readable by `load_consent_document("0.1")`.

**What the parser expects** (the document's own shape — see the file):

    > blockquote           founder/legal-review notes — DROPPED, never shown to a teacher
    ## Before you subscribe …
    *intro paragraph*
    ### ☐ 1. Title         one of the five acknowledgements …
    body …
    **I understand and agree.**        … each ending on this line
    ---
    ---
    # Full User Agreement …            the body the final tick accepts
    ## Final acknowledgement
    ### ☐ I have read …                the sixth tick
    ## Optional                        …and, from v0.4, anything below this heading
    ### ☐ Send me occasional emails …  the OPTIONAL tick — never one of the six

Anything that breaks that shape raises ConsentDocumentError at read time rather than
serving a half-document — a consent screen missing a tick is worse than a 500, because
nobody would notice.

★ THE OPTIONAL TICK IS NOT AN ACKNOWLEDGEMENT (founder, 2026-09-04). Marketing consent is
parsed into its own `optional` slot and never into `acknowledgements`, for reasons that
are legal before they are structural: DPDP §6 requires consent to be free, specific and
unconditional, so a marketing choice may not gate the service. Everything in `acks` is
mandatory by construction — Agreement.jsx computes `allTicked` from it and the five-box
tally counts it — so putting marketing there would bundle it into the accept button, which
is the exact thing the law forbids. It is also the reason the five-count guard below stays
at 5 and must not be relaxed to "5 or 6": the guard is what would catch someone quietly
promoting an optional term into a required one.

Its ANSWER is stored on the Account (withdrawable, erased with her), never in the retained
consent ledger — see POST /legal/consent in api/main.py.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

DOCUMENT_ID = "consent_and_disclaimer"
LANGUAGE = "en"          # English governs until certified translations exist (§ front matter)
FINAL_ACK_ID = "final"
# The optional marketing tick (v0.4+). Deliberately not in `acknowledgement_ids()` — an
# acceptance is valid whether or not this was ticked.
OPTIONAL_ID = "marketing_email"

_FILE_RE = re.compile(r"^consent_and_disclaimer_v([0-9][0-9.]*)\.md$")
# "### ☐ 1. Aruvi is a teaching aid — …"  (the box may be ☐ or ☑ in a future draft)
_ACK_RE = re.compile(r"^###\s+[☐☑]\s*(\d+)\.\s*(.+?)\s*$")
_FINAL_RE = re.compile(r"^###\s+[☐☑]\s*(.+?)\s*$")
_AGREE_LINE = "**I understand and agree.**"


class ConsentDocumentError(RuntimeError):
    """The document on disk is missing or does not have the expected shape."""


# ★ Reads go through the Storage port (2026-08-29), like every other Bucket A read.
# The agreement is content the runtime serves to every teacher before she pays, so it
# travels inside the migration unit and belongs behind the same seam as the library —
# it was reading DATA_DIR directly for the same reason api/data.py was: the port had no
# way to list, and listing is how a published version is discovered.
_LEGAL_PREFIX = "legal"


def _version_key(v: str) -> tuple:
    """"0.10" sorts above "0.9" — compare part by part, not as text."""
    return tuple(int(p) for p in v.split(".") if p.isdigit())


def available_versions() -> List[str]:
    """Every published version in the content store, oldest first."""
    from . import data
    names = [k.rsplit("/", 1)[-1]
             for k in data.storage().list_prefix(_LEGAL_PREFIX, ".md")]
    out = [m.group(1) for m in (_FILE_RE.match(n) for n in names) if m]
    return sorted(out, key=_version_key)


def current_version() -> str:
    """The version a teacher signing today must accept — the highest published."""
    vs = available_versions()
    if not vs:
        raise ConsentDocumentError(
            f"No consent document found under {_LEGAL_PREFIX}/ "
            f"(expected consent_and_disclaimer_v{{version}}.md).")
    return vs[-1]


def _read(version: str) -> str:
    from . import data
    text = data.storage().get_text(
        f"{_LEGAL_PREFIX}/consent_and_disclaimer_v{version}.md")
    if text is None:
        raise ConsentDocumentError(f"Consent document v{version} is not readable.")
    return text


def _strip(lines: List[str]) -> str:
    """Join a block back into markdown, trimmed of the blank lines and bare `---` rules
    that separated it from its neighbours in the file. Those rules divide the DOCUMENT;
    the UI draws its own boundaries, so a leading or trailing one is just a stray line."""
    def junk(s: str) -> bool:
        return (not s.strip()) or s.strip() == "---"
    while lines and junk(lines[0]):
        lines.pop(0)
    while lines and junk(lines[-1]):
        lines.pop()
    return "\n".join(lines)


_cache: Dict[str, Dict[str, Any]] = {}


def load_consent_document(version: Optional[str] = None) -> Dict[str, Any]:
    """The parsed document. Cached per version in-process — the file only changes when
    the founder publishes a new one, and a new one is a new filename."""
    version = version or current_version()
    if version in _cache:
        return _cache[version]

    raw = _read(version)
    # The `> …` front matter is a note to the LAWYER (placement, review status, what to
    # record). Showing it to a teacher would be showing her the scaffolding.
    body = [ln for ln in raw.splitlines() if not ln.lstrip().startswith(">")]

    intro: List[str] = []
    acks: List[Dict[str, Any]] = []
    agreement: List[str] = []
    final_text = ""

    section = "head"            # head → intro → acks → agreement
    cur: Optional[Dict[str, Any]] = None
    cur_body: List[str] = []
    in_final = False
    in_optional = False
    optional_text = ""

    def close_ack() -> None:
        nonlocal cur, cur_body
        if cur is not None:
            cur["body"] = _strip(cur_body)
            acks.append(cur)
        cur, cur_body = None, []

    for ln in body:
        s = ln.strip()

        if s.startswith("## Before you subscribe"):
            section = "intro"
            continue
        if s.startswith("# Full User Agreement"):
            close_ack()
            section = "agreement"
            continue
        if s.startswith("## Final acknowledgement"):
            in_final = True
            continue
        # ★ v0.4: everything below "## Optional" is the marketing tick, which is NOT one
        #   of the six. Absent in v0.1–v0.3, so `optional` is simply None there and every
        #   already-signed version keeps parsing exactly as it did.
        if s.startswith("## Optional"):
            in_final = False
            in_optional = True
            continue

        if section == "intro":
            m = _ACK_RE.match(s)
            if m:
                close_ack()
                section = "acks"
                cur = {"id": f"ack{m.group(1)}", "n": int(m.group(1)), "title": m.group(2)}
                continue
            intro.append(ln)
            continue

        if section == "acks":
            m = _ACK_RE.match(s)
            if m:
                close_ack()
                cur = {"id": f"ack{m.group(1)}", "n": int(m.group(1)), "title": m.group(2)}
                continue
            if s == _AGREE_LINE or s == "---":
                continue        # the tick's own label; the UI draws the checkbox
            cur_body.append(ln)
            continue

        if section == "agreement":
            if in_optional:
                m = _FINAL_RE.match(s)
                if m and not optional_text:
                    optional_text = m.group(1)
                continue
            if in_final:
                m = _FINAL_RE.match(s)
                if m and not final_text:
                    final_text = m.group(1)
                continue        # nothing after the final tick but the draft footer
            agreement.append(ln)
            continue

    close_ack()

    # ★ STAYS AT 5 — do not relax this to "5 or 6" when the optional tick is present.
    #   The optional tick is parsed elsewhere precisely so that this guard keeps meaning
    #   what it means: it is what would catch an optional term being quietly promoted
    #   into a required one, which for a marketing consent is a DPDP §6 violation.
    if len(acks) != 5:
        raise ConsentDocumentError(
            f"Consent document v{version} has {len(acks)} acknowledgements; expected 5. "
            "The five ticks are the document's contract with the UI — fix the document "
            "or update api/legal.py deliberately.")
    if not final_text:
        raise ConsentDocumentError(
            f"Consent document v{version} has no final acknowledgement line.")

    doc = {
        "document_id": DOCUMENT_ID,
        "version": version,
        "language": LANGUAGE,
        "title": "User Agreement & Disclaimer",
        "intro": _strip(intro),
        "acknowledgements": acks,
        "agreement": _strip(agreement),
        "final": {"id": FINAL_ACK_ID, "text": final_text},
        # None on v0.1–v0.3 (they have no "## Optional" section). The UI renders the
        # box only when this is present, so an older version shows exactly what it did.
        "optional": ({"id": OPTIONAL_ID, "text": optional_text} if optional_text else None),
    }
    _cache[version] = doc
    return doc


# ── THE TRIGGER LINE (founder, 2026-10-06) ───────────────────────────────────────
# From v1.0 every agreement file carries, in its lawyer notes, ONE line saying what a teacher
# who accepted an EARLIER version must do when this one is published:
#     > **Re-acceptance:** none        → her acceptance carries over; the shell shows a bar
#     > **Re-acceptance:** 3, final    → at her next purchase she re-confirms ONLY those
#     > **Re-acceptance:** all         → every tick again (the pre-v1.0 rule)
# The founder chooses it per change. A file WITHOUT the line counts as `all`, which is what
# every draft before v1.0 meant in practice — so old versions behave exactly as they did.
_REACCEPT_RE = re.compile(r"^>\s*\*\*Re-acceptance:\*\*\s*(.+?)\s*$", re.IGNORECASE)
ALL = "all"


def reacceptance(version: str):
    """`ALL`, or the SET of tick ids (`ack1`…`ack5`, `final`) a re-signatory must confirm
    again for this version. An empty set means nothing — the acceptance carries over."""
    for ln in _read(version).splitlines():
        m = _REACCEPT_RE.match(ln.strip())
        if not m:
            continue
        spec = m.group(1).strip().lower()
        if spec.startswith("all"):
            return ALL
        if spec.startswith("none"):
            return set()
        out = set()
        for tok in re.split(r"[,\s]+", spec):
            tok = tok.strip()
            if re.fullmatch(r"(ack)?[1-5]", tok):
                out.add("ack" + tok[-1])
            elif tok == FINAL_ACK_ID:
                out.add(FINAL_ACK_ID)
        if not out:
            raise ConsentDocumentError(
                f"Consent document v{version} has a Re-acceptance line that names nothing "
                f"recognisable ({m.group(1)!r}) — write none, all, or points 1-5 / final.")
        return out
    return ALL


def required_since(prior_version: str, current: Optional[str] = None):
    """What a teacher whose standing acceptance is `prior_version` must re-confirm before the
    CURRENT version binds her: the union of every published version after hers. `ALL` wins
    over any set. An empty set = her acceptance carries over."""
    current = current or current_version()
    need: set = set()
    for v in available_versions():
        if _version_key(prior_version) < _version_key(v) <= _version_key(current):
            spec = reacceptance(v)
            if spec == ALL:
                return ALL
            need |= spec
    return need


def acknowledgement_ids(version: Optional[str] = None) -> List[str]:
    """The ids every acceptance must carry — the five, in order. The final tick is
    recorded separately (it accepts the body, not one point)."""
    return [a["id"] for a in load_consent_document(version)["acknowledgements"]]


# ── The Privacy Notice — the SECOND document family (2026-09-04) ─────────────────
# `data/cloud/content/legal/privacy_policy_v{V}.md`, beside the agreement, under the
# same rules: one copy, the version is the FILENAME, a new version is a new file, the
# `> …` front matter is a note to the lawyer and is never shown.
#
# ★ IT IS GIVEN, NOT SIGNED. DPDP §5 makes the notice something a fiduciary GIVES at or
# before collection; consent (§6) is a separate act and, in Meyy, is asked for only where
# consent is the basis (marketing email — the agreement's optional tick). So there are no
# acknowledgement blocks to parse, no ticks, and no ledger: the whole document is ONE body
# rendered as-is, and the only record kept is which version was SHOWN to her and when
# (`Account.privacy_notice`, erased with the account). Asking her to tick "I accept the
# privacy policy" would imply the service runs on her consent — which is withdrawable —
# and put the account itself on a footing the notice deliberately does not claim.
#
# ★ SERVED WITHOUT AN IDENTITY. A notice must be readable BEFORE she gives us anything —
# the sign-in screen links to it while the mobile field is still empty — so
# GET /legal/privacy takes no X-Aruvi-User (api/main.py). The agreement route keeps its
# dependency because it also reports HER acceptance state.

PRIVACY_DOCUMENT_ID = "privacy_policy"
_PRIVACY_FILE_RE = re.compile(r"^privacy_policy_v([0-9][0-9.]*)\.md$")
# The dated footer: "*Draft v0.1 · 2026-09-04 · For legal review before publication.*"
_DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")


# ★ THE PRE-LAUNCH DRAFTS ARE NOT SERVED (founder, 2026-10-06). v0.1–v0.6 were internal drafts —
# they named the founder personally and carried open brackets — and v1.0 is the launch baseline.
# Their files stay on disk (and in git) as the record; the API simply does not hand them out.
# Notice v1.0 §12: "an earlier version is available on request from support@meyy.in".
PRIVACY_FIRST_SERVED = "1.0"


def privacy_versions() -> List[str]:
    """Every SERVED notice version (from PRIVACY_FIRST_SERVED on), oldest first."""
    from . import data
    names = [k.rsplit("/", 1)[-1]
             for k in data.storage().list_prefix(_LEGAL_PREFIX, ".md")]
    out = [m.group(1) for m in (_PRIVACY_FILE_RE.match(n) for n in names) if m]
    floor = _version_key(PRIVACY_FIRST_SERVED)
    return sorted([v for v in out if _version_key(v) >= floor], key=_version_key)


def current_privacy_version() -> str:
    """The version shown to a teacher today — the highest published."""
    vs = privacy_versions()
    if not vs:
        raise ConsentDocumentError(
            f"No privacy notice found under {_LEGAL_PREFIX}/ "
            f"(expected privacy_policy_v{{version}}.md).")
    return vs[-1]


_privacy_cache: Dict[str, Dict[str, Any]] = {}


def load_privacy_document(version: Optional[str] = None) -> Dict[str, Any]:
    """The notice, front matter dropped, as one markdown body plus its title and date.
    Cached per version — a version's text never changes once published."""
    from . import data
    version = version or current_privacy_version()
    if version not in privacy_versions():
        raise ConsentDocumentError(f"Privacy notice v{version} is not published.")
    if version in _privacy_cache:
        return _privacy_cache[version]
    raw = data.storage().get_text(f"{_LEGAL_PREFIX}/privacy_policy_v{version}.md")
    if raw is None:
        raise ConsentDocumentError(f"Privacy notice v{version} is not readable.")
    lines = [ln for ln in raw.splitlines() if not ln.lstrip().startswith(">")]
    title = ""
    body: List[str] = []
    for ln in lines:
        s = ln.strip()
        # The first `# ` line is the document's title; the UI sets it as the heading.
        # "(Draft v0.1)" and the like belong to the file, not the screen — the version
        # is stated once, in the footer line the component renders.
        if not title and s.startswith("# "):
            title = re.sub(r"\s*\((?:Draft\s+)?v[0-9.]+\)\s*$", "", s[2:].strip())
            continue
        body.append(ln)
    # The dated footer line is the file's own stamp; the UI prints "Version · date" from
    # `published`, so the line itself is taken OUT of the body rather than shown twice.
    published = ""
    for i in range(len(body) - 1, -1, -1):
        s = body[i].strip()
        if not s or s == "---":
            continue
        if s.startswith("*") and s.endswith("*") and _DATE_RE.search(s):
            published = _DATE_RE.search(s).group(1)
            del body[i]
        break
    if not title or not "".join(body).strip():
        raise ConsentDocumentError(
            f"Privacy notice v{version} has no title or no body — the file is not the "
            "document the UI expects.")
    doc = {
        "document_id": PRIVACY_DOCUMENT_ID,
        "version": version,
        "language": LANGUAGE,
        "title": title,
        "published": published,
        "body": _strip(body),
    }
    _privacy_cache[version] = doc
    return doc
