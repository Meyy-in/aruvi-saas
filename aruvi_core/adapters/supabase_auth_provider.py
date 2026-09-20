"""AuthProvider adapter for Supabase Auth — the credential is a Supabase-issued JWT.

Track B of docs/mobile_migration_plan.md (2026-09-09). The client (web or the Expo app)
signs in with supabase-js — `signInWithOtp({phone})` → `verifyOtp` — and from then on
sends the session's access token as `Authorization: Bearer …`. THIS class verifies that
token offline: signature, expiry, audience and issuer, with no call to Supabase per
request. `api/main.py:_current_identity()` remains the single caller.

★ THE IDENTITY IS STILL THE MOBILE. Supabase's stable subject (`sub`) is a UUID, but
every contract in this product — `/onboarding/known?id=`, the email→mobile resolution,
the invoice, the consent ledger, the per-user localStorage keys — is keyed by the
10-digit number, and the front door's own header says "mobile IS the identity". So the
user_id (== tenant_id) is derived from the token's verified `phone` claim, E.164 without
the plus ("919876543210"), reduced to the 10-digit national number the rest of the
product already speaks. A token without a phone claim (an email-only Supabase user)
is refused: there is no identity to run under. Consequence to remember: a teacher who
changes her number is a new account — Supabase's phone-change flow stays OFF in the
beta. Flipping to `sub` as the key is one line in `identity_from_claims`, deliberately
kept as a separate function so that decision is visible and testable.

Verification supports both key styles Supabase issues: the project's asymmetric signing
keys (ES256/RS256, fetched and cached from the JWKS endpoint) and the legacy shared
HS256 secret (`jwt_secret`; also what the tests use, so they need no network).
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from aruvi_core.ports import AuthProvider, Identity

AUDIENCE = "authenticated"
_ASYMMETRIC = ("ES256", "RS256")


def national_number(phone: str) -> str:
    """'919876543210' / '+91 98765 43210' → '9876543210'. Only the Indian prefix is
    stripped (the product hardcodes +91 at the front door); any other shape is kept as
    its digits so nothing silently collides."""
    digits = "".join(c for c in str(phone or "") if c.isdigit())
    if len(digits) == 12 and digits.startswith("91"):
        return digits[2:]
    return digits


def identity_from_claims(claims: Dict[str, Any]) -> Identity:
    """The ONE place a verified token becomes an Identity (see the module note)."""
    uid = national_number(claims.get("phone") or "")
    if not uid:
        raise ValueError("This sign-in has no mobile number attached.")
    iat = claims.get("iat")
    try:
        iat = int(iat) if iat is not None else None
    except (TypeError, ValueError):
        iat = None
    return Identity(user_id=uid, tenant_id=uid, role="teacher", phone=uid, issued_at=iat)


class SupabaseAuthProvider(AuthProvider):
    """Verifies Supabase access tokens; raises ValueError on anything short of valid."""

    def __init__(self, url: str, jwt_secret: str = "", jwks_client: Optional[object] = None,
                 audience: str = AUDIENCE):
        """
        Args:
            url:         the project URL, https://<ref>.supabase.co — the issuer is
                         derived from it (`<url>/auth/v1`).
            jwt_secret:  the legacy HS256 secret (Project settings → API → JWT). Optional
                         once the project signs with asymmetric keys.
            jwks_client: injectable for tests; defaults to PyJWKClient over the project's
                         JWKS endpoint, keys cached across requests.
        """
        self.issuer = (url or "").rstrip("/") + "/auth/v1"
        self.secret = jwt_secret or ""
        self.audience = audience
        self._jwks = jwks_client
        if self._jwks is None and url:
            from jwt import PyJWKClient   # lazy: PyJWT is an API dependency, not core's
            self._jwks = PyJWKClient(self.issuer + "/.well-known/jwks.json", cache_keys=True)

    def verify_token(self, token: str) -> Identity:
        import jwt
        token = (token or "").strip()
        if not token:
            raise ValueError("Sign in to continue.")
        try:
            alg = jwt.get_unverified_header(token).get("alg", "")
            if alg == "HS256":
                if not self.secret:
                    raise ValueError("HS256 token but no JWT secret is configured.")
                key = self.secret
            elif alg in _ASYMMETRIC:
                if self._jwks is None:
                    raise ValueError("No JWKS source configured.")
                key = self._jwks.get_signing_key_from_jwt(token).key
            else:
                raise ValueError(f"Unsupported token algorithm: {alg or '?'}")
            claims = jwt.decode(token, key, algorithms=[alg], audience=self.audience,
                                issuer=self.issuer)
        except ValueError:
            raise
        except jwt.ExpiredSignatureError:
            raise ValueError("Your session has expired — please sign in again.")
        except jwt.PyJWTError as e:
            raise ValueError(f"Invalid sign-in token: {e.__class__.__name__}")
        return identity_from_claims(claims)
