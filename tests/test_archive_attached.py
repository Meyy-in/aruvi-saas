"""An attached lesson is never archived — the server refuses it (founder, 2026-09-18)."""
import os, sys, tempfile, pathlib
os.environ["ARUVI_STATE_DIR"] = tempfile.mkdtemp(prefix="aruvi-test-arch-")
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient  # noqa: E402
from api import main  # noqa: E402

c = TestClient(main.app)
M = "9000000081"
H = {"X-Aruvi-User": M}


def test_attached_refused_detached_allowed():
    year = main._resolve_year(M, M)
    main.section_state_repo.save_one(M, M, year, "science_vi_6A", "ch4.json", 0, False)
    rr = c.post("/plan-archive", headers=H, json={"subject": "science", "grade": "vi", "filename": "ch4.json"})
    assert rr.status_code == 409, rr.text
    assert "attached" in rr.json()["detail"]
    ok = c.post("/plan-archive", headers=H, json={"subject": "science", "grade": "vi", "filename": "ch5.json"})
    assert ok.status_code == 200, ok.text
    # once detached, it can be archived
    main.section_state_repo.delete_one(M, M, year, "science_vi_6A")
    assert c.post("/plan-archive", headers=H, json={"subject": "science", "grade": "vi",
                                                    "filename": "ch4.json"}).status_code == 200


if __name__ == "__main__":
    test_attached_refused_detached_allowed(); print("✅ archive-attached test passed")
