#!/usr/bin/env sh
# Container entrypoint (Track A). Two jobs, then uvicorn.
#
# 1. SEED THE SELLER-SIDE SERIES onto an empty disk. The invoice counter
#    (invoices/_series/), the support reference counter (support/_series/) and the consent
#    ledger (consents/_ledger/) are deliberately outside the {kind}/{tenant}/{user} shape
#    so erasure can't reach them — and for the same reason a brand-new disk has none of
#    them. Numbering must CONTINUE (MEY/2026-27/7864…, MEY-S-…), not restart, so each is
#    copied from the image's seed exactly once: only when that path is absent on the disk.
#    Teacher state is never seeded — a production disk starts with no teachers.
#
# 2. Say out loud where state lives and whether mail will send (dev.sh's habit).
set -eu

STATE="${ARUVI_STATE_DIR:-/var/aruvi/state}"
SEED="${ARUVI_SEED_DIR:-/app/seed/state}"
mkdir -p "$STATE"

for rel in invoices/_series support/_series consents/_ledger; do
  if [ -d "$SEED/$rel" ] && [ ! -d "$STATE/$rel" ]; then
    mkdir -p "$STATE/$(dirname "$rel")"
    cp -r "$SEED/$rel" "$STATE/$rel"
    echo "[aruvi] seeded $rel onto $STATE"
  fi
done

echo "[aruvi] content: ${ARUVI_DATA_DIR:-/app/data/cloud/content}"
echo "[aruvi] state:   $STATE"
if [ -n "${ARUVI_SMTP_HOST:-}" ] && [ -n "${ARUVI_SMTP_USER:-}" ] && [ -n "${ARUVI_SMTP_PASSWORD:-}" ]; then
  echo "[aruvi] mail: SENDS as ${ARUVI_MAIL_FROM:-$ARUVI_SMTP_USER}"
else
  echo "[aruvi] mail: FILE OUTBOX — nothing will send"
fi

# --no-access-log: uvicorn's own access lines print the CONCRETE path with its query string, so
# an id in a URL would sit in the host's logs. api/access_log.py keeps Meyy's one-year log
# instead, with route patterns only (Privacy Notice v0.5 §2/§7).
exec python3 -m uvicorn api.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*' --no-access-log
