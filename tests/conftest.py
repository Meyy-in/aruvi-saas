"""Test-wide isolation of the STATE directory.

★ WHY THIS FILE EXISTS (2026-09-14). The API suite was writing real tenant state into the
repository's own `data/cloud/state/` — the tracked one — under the ids it invents
(`CutoverKumar`, `TwiceKumar`, `NotesKumar`, `FlagKumar`, `Kumar88`, `OtherKumar`). That had
three consequences, in order of how much they cost:

  1. Running the tests left the working tree dirty, so the residue eventually got committed
     (24 files, in `04a46f99`).
  2. The next run then met state it expected to create fresh, and failed against it:
     `test_the_whole_june_walk`, `test_tapping_twice_is_safe` and `test_api_routes`, the
     second on `already_done: True` — the cutover it was about to perform had already
     happened in the persisted data. A suite that fails on its second run and passes on its
     first is worse than one that simply fails.
  3. It wrote into the same tree as the real accounts (`9000000003`, `9900000099`), which is
     the part that could have cost something that mattered.

The protection was ALREADY WRITTEN — four modules open with

    _TMP_STATE = tempfile.mkdtemp(prefix="aruvi-test-...")
    os.environ.setdefault("ARUVI_STATE_DIR", _TMP_STATE)

— and it was defeated by module import order. `tests/test_api.py` does `from api.main import
app` at line 15 and `tests/test_lp_year.py` does `from api import config, data`, neither
having set the variable; `api/config.py` reads `ARUVI_STATE_DIR` at IMPORT time
(`STATE_DIR = os.environ.get("ARUVI_STATE_DIR", _DEFAULT_STATE)`). So in a whole-suite run,
whichever of those two is imported first binds the app to the real directory for the entire
process, and every later `setdefault` is either too late or a no-op. The careful modules were
only ever safe when run alone.

conftest.py is imported by pytest BEFORE any test module, which is the one hook early enough
to fix it for all of them at once. Setting the variable here also makes the four existing
`setdefault` calls do exactly what their author intended: defer to a value already set, and
keep working when that module is run standalone (`python3 tests/test_cutover.py`), where no
conftest is loaded.

Only STATE is redirected. `ARUVI_DATA_DIR` — the shared, read-only content the runtime reads
(chapters, constitutions, framework) — is deliberately untouched, since the tests need the
real corpus; `api/config.py` keeps the two buckets on separate variables precisely so this is
possible.

The directory is left on disk after the run. It is a `tempfile` path, so the OS reclaims it,
and keeping it means a failing run can still be inspected.
"""
from __future__ import annotations

import os
import tempfile

# Set, not setdefault: an ARUVI_STATE_DIR inherited from the developer's shell would put the
# tests back into a real directory, which is the whole failure above. An explicit opt-out is
# available for the rare case of running the suite against a real tree on purpose.
if not os.environ.get("ARUVI_TEST_USE_REAL_STATE"):
    os.environ["ARUVI_STATE_DIR"] = tempfile.mkdtemp(prefix="aruvi-test-state-")
