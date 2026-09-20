"""
Track B (2026-09-09): SupabaseAuthProvider + the dual-mode identity seam in api/main.py.

Tokens are HS256-signed locally with a test secret, so nothing here touches the network;
the asymmetric (JWKS) path is exercised through an injected fake key source.

Run standalone:  python3 tests/test_supabase_auth.py     (also pytest-compatible)
Needs PyJWT (api/requirements.txt) — skips cleanly without it.
"""
from __future__ import annotations

import os
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import jwt
except ImportError:  # pragma: no cover
    print("SKIP: PyJWT not installed (pip install -r api/requirements.txt)")
    sys.exit(0)

URL = "https://testref.supabase.co"
SECRET = "test-secret-not-real-0123456789abcdef"

# The API must come up in supabase mode against a scratch state dir — env BEFORE import.
_TMP_STATE = tempfile.mkdtemp(prefix="aruvi-test-state-")
os.environ["ARUVI_STATE_DIR"] = _TMP_STATE
os.environ["ARUVI_AUTH_PROVIDER"] = "supabase"
os.environ["ARUVI_SUPABASE_URL"] = URL
os.environ["ARUVI_SUPABASE_JWT_SECRET"] = SECRET

from aruvi_core.adapters.supabase_auth_provider import (  # noqa: E402
    SupabaseAuthProvider, national_number, identity_from_claims)


def _token(phone="919876543210", exp_in=3600, aud="authenticated", iss=URL + "/auth/v1",
           secret=SECRET, alg="HS256", drop=(), iat_offset=0):
    claims = {"sub": "0b1c2d3e-uuid", "aud": aud, "iss": iss, "phone": phone,
              "role": "authenticated", "exp": int(time.time()) + exp_in,
              "iat": int(time.time()) + iat_offset}
    for k in drop:
        claims.pop(k, None)
    return jwt.encode(claims, secret, algorithm=alg)


def _provider(**kw):
    # jwks_client=object() stops the constructor building a real PyJWKClient.
    return SupabaseAuthProvider(URL, jwt_secret=SECRET, jwks_client=kw.pop("jwks", object()))


def test_national_number():
    assert national_number("919876543210") == "9876543210"
    assert national_number("+91 98765 43210") == "9876543210"
    assert national_number("9876543210") == "9876543210"
    assert national_number("447700900123") == "447700900123"   # not India: kept whole
    assert national_number("") == ""
    print("✓ national_number strips only the +91 prefix")


def test_valid_token_is_the_mobile():
    ident = _provider().verify_token(_token())
    assert ident.user_id == "9876543210" and ident.tenant_id == "9876543210"
    assert ident.phone == "9876543210" and ident.role == "teacher"
    print("✓ a valid token resolves to the 10-digit mobile as user == tenant")


def _refused(tok, why):
    try:
        _provider().verify_token(tok)
    except ValueError as e:
        print(f"✓ refused: {why} → {e}")
        return
    raise AssertionError(f"accepted a token it must refuse: {why}")


def test_refusals():
    _refused("", "empty credential")
    _refused("not.a.jwt", "garbage")
    _refused(_token(exp_in=-10), "expired")
    _refused(_token(secret="wrong-secret"), "bad signature")
    _refused(_token(aud="anon"), "wrong audience")
    _refused(_token(iss="https://other.supabase.co/auth/v1"), "wrong issuer")
    _refused(_token(drop=("phone",)), "no phone claim (email-only user)")
    _refused(_token(phone=""), "empty phone claim")
    # alg=none must never pass, whatever the header says.
    _refused(jwt.encode({"phone": "919876543210", "aud": "authenticated",
                         "iss": URL + "/auth/v1"}, None, algorithm="none"), "alg=none")


def test_asymmetric_path_uses_the_jwks_source():
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    priv = ec.generate_private_key(ec.SECP256R1())
    pub = priv.public_key()
    pem = priv.private_bytes(serialization.Encoding.PEM,
                             serialization.PrivateFormat.PKCS8,
                             serialization.NoEncryption())
    tok = _token(secret=pem, alg="ES256")

    class _Key:
        key = pub

    class _FakeJWKS:
        calls = 0
        def get_signing_key_from_jwt(self, t):
            self.calls += 1
            return _Key()

    fake = _FakeJWKS()
    p = SupabaseAuthProvider(URL, jwt_secret="", jwks_client=fake)
    ident = p.verify_token(tok)
    assert ident.user_id == "9876543210" and fake.calls == 1
    # An HS256 token against a JWKS-only provider (no secret) is refused, not downgraded.
    try:
        p.verify_token(_token())
        raise AssertionError("HS256 accepted without a secret")
    except ValueError:
        pass
    print("✓ ES256 verifies through the JWKS source; HS256 without a secret is refused")


def test_identity_from_claims_is_the_one_seam():
    i = identity_from_claims({"sub": "uuid", "phone": "919999988888"})
    assert i.user_id == "9999988888"
    print("✓ identity_from_claims is the single mobile-vs-sub decision point")


def test_api_supabase_mode():
    from fastapi.testclient import TestClient
    import api.main as m
    c = TestClient(m.app)
    good = {"Authorization": f"Bearer {_token()}"}

    # No credential → 401, in words.
    r = c.get("/readiness")
    assert r.status_code == 401, r.text
    # The dev header buys NOTHING in this mode.
    r = c.get("/readiness", headers={"X-Aruvi-User": "Kumar1"})
    assert r.status_code == 401, r.text
    # Expired → 401 with the provider's sentence.
    r = c.get("/readiness", headers={"Authorization": f"Bearer {_token(exp_in=-5)}"})
    assert r.status_code == 401 and "expired" in r.json()["detail"].lower(), r.text
    # Valid → 200, and the account was JIT-created under the MOBILE with the phone stored.
    r = c.get("/readiness", headers=good)
    assert r.status_code == 200, r.text
    acct = m.account_repo.load("9876543210", "9876543210")
    assert acct is not None and acct.phone == "9876543210", acct
    # /onboarding/verified registers under the same id the client will use.
    r = c.post("/onboarding/verified", headers=good)
    assert r.status_code == 200 and r.json()["user_id"] == "9876543210", r.text
    # The open routes stay open.
    assert c.get("/health").status_code == 200
    assert c.get("/legal/privacy").status_code == 200
    assert c.get("/onboarding/known", params={"id": "9876543210"}).json()["known"] is True
    print("✓ API in supabase mode: bearer only, header ignored, account keyed by mobile")

    # WALK-A-018: a token minted BEFORE the erasure can never re-create the account; a fresh
    # sign-in (a later token) comes back as a new account. And a never-activated account is
    # `fresh` at /onboarding/known (WALK-A-021).
    known = c.get("/onboarding/known", params={"id": "9876543210"}).json()
    assert known["known"] is True and known["fresh"] is True, known
    old = {"Authorization": f"Bearer {_token(iat_offset=-120)}"}
    r = c.post("/data-rights/erase", headers=old, json={"confirm": "erase", "downloaded_confirmed": True})
    assert r.status_code == 200, r.text
    r = c.get("/readiness", headers=old)
    assert r.status_code == 401 and "deleted" in r.json()["detail"].lower(), r.text
    assert m.account_repo.load("9876543210", "9876543210") is None, "no ghost account"
    time.sleep(1.2)   # a whole second on, so the new token's integer `iat` postdates the erasure
    new = {"Authorization": f"Bearer {_token()}"}
    assert c.get("/readiness", headers=new).status_code == 200
    assert m.account_repo.load("9876543210", "9876543210") is not None
    print("✓ a pre-erasure token cannot resurrect the account; a new sign-in can")


if __name__ == "__main__":
    test_national_number()
    test_valid_token_is_the_mobile()
    test_refusals()
    test_asymmetric_path_uses_the_jwks_source()
    test_identity_from_claims_is_the_one_seam()
    test_api_supabase_mode()
    print("✅ All Supabase auth tests passed!")
