"""The Ask Aruvi question bank — ONE file, signed-in only, cached on the device (2026-08-30).

Run: python3 tests/test_ask_aruvi_kb.py

★ THE ONE THING THESE TESTS EXIST TO PROTECT.

The bank is hand-written and lives in exactly ONE place:

    data/cloud/content/ask_aruvi/qa_knowledge_base.json   ← the file you edit

`GET /ask-aruvi` serves it from there, behind X-Aruvi-User, and the client caches it in
localStorage so the help screen still works offline (web/app/ask-aruvi/bank.js).

It used to ALSO be copied into web/app/ask-aruvi/ and imported at build time — which compiled
all 120 answers into the main page chunk, a PUBLIC url served before sign-in. The bank states
how period allocation is weighted and how each subject's assessment is built; that is founder
IP, and it was downloadable by any crawler in machine-readable form.
`test_bank_is_not_bundled` is what stops that returning: it is the security guard of this
file, not a tidiness check. If someone re-adds the import for convenience, the exposure comes
back silently and nothing else would notice.

`test_index_is_current` guards the other half. Keywords are tf-idf derived and score 3 against
a query where the question scores 2 and the answer 1, so they are what make a teacher's own
word reach the right pair. They are corpus-relative: editing ONE pair shifts the ranking for
every other. A hand-edit that skips the re-index leaves the bank looking correct and searching
worse. Fixed by: python3 aruvi-scripts/sync_ask_aruvi.py

★ ON test_teacher_words_reach_their_pair.

It mirrors askAruviSearch.js and asserts that a set of realistic teacher phrasings land on the
intended pair. Eight of these failed when the 2026-08-30 batch was first written — "rename"
appeared nowhere in the sections pair, "support" nowhere in its question, "cost" nowhere at all
— and the wording was changed until they landed. If you reword a pair and this test fails, the
finding is real: a teacher's word no longer reaches that answer. **Fix the wording, not the
test** — or, if the question genuinely no longer covers that phrasing, move the expectation to
the pair that now does.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "aruvi-scripts"))

import sync_ask_aruvi as sync  # noqa: E402

OFFICIAL = sync.OFFICIAL
BUNDLED = sync.BUNDLED

# Teacher phrasing -> the pair it must reach (top 2). See the module docstring.
LANDINGS = [
    ("free trial",                    "d30"),
    ("how much does it cost",         "d31"),
    ("renew",                         "d32"),
    ("add a subject",                 "d33"),
    ("invoice",                       "d34"),
    ("sign in",                       "d35"),
    ("agreement",                     "d36"),
    ("contact support",               "d38"),
    ("download my data",              "d39"),
    ("delete my account",             "d40"),
    ("rename section",                "d41"),
    ("end of year",                   "d42"),
    ("chapter notes",                 "d11"),
    ("who writes the plans",          "a33"),
    ("how are plans generated",       "a33"),
    ("too few periods",               "c21"),
    ("maximum periods",               "c22"),
    ("edit the plan",                 "e19"),
    ("refund",                        "e22"),
]


def load(path):
    return json.loads(Path(path).read_text())


# ── a compact mirror of askAruviSearch.js (keyword 3 · question 2 · answer 1) ──
def _toks(text):
    out = []
    for w in re.findall(r"[A-Za-z0-9]+", text):
        n = sync.norm(w)
        if len(n) >= 2:
            out.append(n)
    return out


def _hit(bag, tok, weight):
    if tok in bag:
        return weight
    if len(tok) >= 3:
        for t in bag:
            if t.startswith(tok):
                return weight
    return 0


def search(pairs, query):
    scored = []
    for i, p in enumerate(pairs):
        keys = {sync.norm(k) for k in p.get("keywords", [])}
        ques = set(_toks(p["question"]))
        ans = set(_toks(p["answer"]))
        score = matched = 0
        for tok in dict.fromkeys(_toks(query)):
            w = max(_hit(keys, tok, 3), _hit(ques, tok, 2), _hit(ans, tok, 1))
            if w:
                score += w
                matched += 1
        if score:
            scored.append((-matched, -score, i, p))
    scored.sort()
    return [p["id"] for *_, p in scored]


# ── tests ─────────────────────────────────────────────────────────────────────
def test_official_file_exists_and_parses():
    assert OFFICIAL.exists(), (
        "The official question bank is missing: %s\n"
        "It is Bucket A-serve content and belongs inside data/cloud/ (the migration unit)."
        % OFFICIAL)
    kb = load(OFFICIAL)
    assert kb.get("pairs"), "no pairs"
    assert kb.get("categories"), "no categories"
    print("  ok  official file parses · %d pairs · %d categories"
          % (len(kb["pairs"]), len(kb["categories"])))


def test_shape_is_sound():
    problems = sync.validate(load(OFFICIAL))
    assert not problems, "question bank problems:\n  " + "\n  ".join(problems)
    print("  ok  every pair has an id, a category, a question and an answer; ids unique")


def test_index_is_current():
    kb = load(OFFICIAL)
    fresh = sync.compute_keywords(kb["pairs"])
    stale = [p["id"] for p in kb["pairs"] if p.get("keywords") != fresh[p["id"]]]
    assert not stale, (
        "%d pair(s) have a stale search index: %s\n"
        "Someone edited the bank without re-indexing. Run:\n"
        "  python3 aruvi-scripts/sync_ask_aruvi.py"
        % (len(stale), ", ".join(stale[:10])))
    print("  ok  search index current on all %d pairs" % len(kb["pairs"]))


def test_bank_is_not_bundled():
    """The security guard. The bank must never ship inside the web build.

    A static import puts it in a public page chunk served BEFORE sign-in, which is how the
    allocation weighting and the per-subject assessment blueprint became downloadable by
    anyone. If this fails, the exposure is live — do not "fix" it by deleting the test.
    """
    assert not BUNDLED.exists(), (
        "The bank is back in the web app: %s\n"
        "It would ship in a public chunk, readable without an account. It is served by "
        "GET /ask-aruvi and cached on the device instead." % BUNDLED)
    web = REPO_ROOT / "web" / "app"
    offenders = []
    for f in list(web.rglob("*.jsx")) + list(web.rglob("*.js")):
        if ".next" in f.parts:
            continue
        txt = f.read_text()
        if "qa_knowledge_base.json" in txt and "import" in txt.split("qa_knowledge_base.json")[0][-120:]:
            offenders.append(str(f.relative_to(REPO_ROOT)))
    assert not offenders, (
        "These files import the bank into the web build: %s" % ", ".join(offenders))
    print("  ok  bank is not bundled and nothing imports it")


def test_the_route_and_the_client_agree():
    """The bank is only reachable if all three pieces line up: a route that serves it, a
    reader in api/data.py, and a client that fetches THAT path."""
    main = (REPO_ROOT / "api" / "main.py").read_text()
    dat = (REPO_ROOT / "api" / "data.py").read_text()
    # ⚠️ THE CLIENT MOVED (Track D step 1, 2026-09-11) and this test did not follow it until
    # 2026-09-16: web/app/ask-aruvi/bank.js is now a two-line re-export and the real reader is
    # in packages/shared, which BOTH surfaces run. Asserting against the shim passed for a
    # fortnight while testing nothing, then failed outright once the shim stopped naming the
    # path. Check the shared file, and check that the web still points at it.
    bank_js = (REPO_ROOT / "packages" / "shared" / "src" / "ask-aruvi" / "bank.js").read_text()
    web_shim = (REPO_ROOT / "web" / "app" / "ask-aruvi" / "bank.js").read_text()
    assert "@aruvi/shared/ask-aruvi/bank" in web_shim, (
        "web/app/ask-aruvi/bank.js no longer re-exports the shared reader — the two surfaces "
        "would drift, which is the whole point of packages/shared.")
    assert '@app.get("/ask-aruvi")' in main, "GET /ask-aruvi is missing from api/main.py"
    assert "_current_identity" in main.split('@app.get("/ask-aruvi")')[1][:600], (
        "GET /ask-aruvi must depend on _current_identity — without it the bank is public "
        "again, which is the whole reason it left the bundle.")
    assert "ask_aruvi_bank_bytes" in dat, "api/data.py has no ask_aruvi_bank_bytes()"
    assert '"/ask-aruvi"' in bank_js, "bank.js does not fetch /ask-aruvi"
    assert "If-None-Match" in bank_js, (
        "bank.js must send If-None-Match — without it every app load re-downloads ~90KB "
        "instead of an eighteen-byte 'unchanged'.")
    print("  ok  route is identity-gated, reader exists, client fetches it with an ETag")


def test_unchanged_is_never_a_304():
    """The freshness check must not answer 304 — on Render it does not survive the edge.

    Measured on the live service, 2026-09-16: the same URL with the same account answers 200
    WITHOUT If-None-Match and 503 WITH it, while an unauthenticated request carrying the header
    gets a normal 401 (so the header reaches us; it is the reply that does not get back). The
    identical route code run locally returns a textbook 304. Our end is correct and the empty
    304 is what Render's edge mangles.

    ★ THIS TEST EXISTS BECAUSE THE BUG IS INVISIBLE. Both clients swallow a failed check and
    keep their stored copy, so restoring the 304 breaks nothing anyone can SEE: Ask Meyy goes
    on answering, My Lessons goes on listing — and the bank silently stops updating, so an
    edited answer never reaches a phone again. Nothing else in the product would notice.
    """
    main = (REPO_ROOT / "api" / "main.py").read_text()
    assert "status_code=304" not in main, (
        "api/main.py answers 304 somewhere. Render's edge turns an empty 304 into a 503 and "
        "both freshness checks fail silently — say 'unchanged' in a 200 instead. See the note "
        "above get_plans.")
    for route in ('@app.get("/plans/{subject}/{grade}")', '@app.get("/ask-aruvi")'):
        # The route's own body: from its decorator to the next one. A fixed character window
        # would silently stop testing the day a route grows past it — /plans already has.
        after = main.split(route)[1]
        body = after.split("\n@app.")[0]
        assert "if_none_match" in body, "%s no longer runs a freshness check" % route
        assert "UNCHANGED" in body, (
            "%s takes an ETag but never answers with the unchanged marker — a check that can "
            "only ever return the full body is a check that costs and saves nothing." % route)
    print("  ok  the freshness checks answer 200 + unchanged, never 304")


def test_teacher_words_reach_their_pair():
    pairs = load(OFFICIAL)["pairs"]
    misses = []
    for query, want in LANDINGS:
        top = search(pairs, query)[:2]
        if want not in top:
            misses.append("%-28s -> %s   (want %s)" % (query, top or ["nothing"], want))
    assert not misses, (
        "%d teacher phrasing(s) no longer reach their answer:\n  " % len(misses)
        + "\n  ".join(misses)
        + "\nFix the WORDING of the pair, not this test — see the module docstring.")
    print("  ok  all %d teacher phrasings land in the top 2" % len(LANDINGS))


def test_no_retired_feature_names():
    """Period Notes were removed 2026-07-23. The term must not come back in the help.

    It is not a typo guard: leaving the phrase in an answer keeps it a live SEARCH TERM, so a
    teacher typing it is shown a pair about a feature that does not exist.
    """
    blob = OFFICIAL.read_text().lower()
    assert "period note" not in blob, (
        "'period note' is back in the question bank. The per-unit section note was removed on "
        "2026-07-23; there is one note per chapter, per academic year.")
    print("  ok  no reference to the retired Period Notes")


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    print("test_ask_aruvi_kb — %d tests" % len(tests))
    for t in tests:
        t()
    print("all green")
