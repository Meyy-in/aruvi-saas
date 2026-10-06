#!/usr/bin/env bash
# Aruvi dev launcher — one command, both servers, backgrounded with logs.
#
#   ./dev.sh            start both (entitlement enforcement = last used, default off)
#   ./dev.sh on         start/restart with entitlement enforcement ON
#   ./dev.sh off        start/restart with entitlement enforcement OFF
#   ./dev.sh stop       stop both
#   ./dev.sh status     what is running, and the enforcement flag
#   ./dev.sh logs       tail both logs
#
# Subscription for one teacher (different thing from the gate above):
#   ./dev.sh grant <user>   ./dev.sh revoke <user>
#   ./dev.sh trial <user>   ./dev.sh who <user>
#   ./dev.sh erase <user>   full wipe (same path as POST /data-rights/erase)

set -uo pipefail
cd "$(dirname "$0")"

LOGS=".devlogs"
FLAG="$LOGS/entitlement_enforced"
API_PORT=8000
WEB_PORT=3000
mkdir -p "$LOGS"

# ── secrets, once (2026-09-04) ─────────────────────────────────────────────────
# Mail credentials are read by api/main.py ONCE, at startup, so a server started
# without them installs FileNotifier and nothing sends — silently, as far as any
# screen is concerned. Typing them on the command line every time is how a server
# ends up running with last week's values (it happened: two uvicorn processes, one
# holding the port with credentials from before the fix).
#
# `.env` is gitignored. Copy .env.example to .env, fill it in, and every ./dev.sh
# from then on starts with mail configured. `set -a` exports what the file sets,
# so nohup's children inherit it; nothing here is ever echoed.
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

lan_ip() {
  for i in en0 en1; do
    ip=$(ipconfig getifaddr "$i" 2>/dev/null) && [ -n "$ip" ] && { echo "$ip"; return; }
  done
}

port_pid() { lsof -ti tcp:"$1" -sTCP:LISTEN 2>/dev/null; }

# Said at every start and in `status`. Never prints the password — only whether the
# three variables the notifier seam checks are present, and who it will send as.
mail_mode() {
  if [ -n "${ARUVI_SMTP_HOST:-}" ] && [ -n "${ARUVI_SMTP_USER:-}" ] \
     && [ -n "${ARUVI_SMTP_PASSWORD:-}" ]; then
    echo "SENDS as ${ARUVI_MAIL_FROM:-$ARUVI_SMTP_USER}"
  else
    echo "FILE OUTBOX — nothing will send (no .env, or it is incomplete)"
  fi
}

kill_port() {
  local pid; pid=$(port_pid "$1")
  if [ -n "$pid" ]; then
    kill $pid 2>/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      sleep 0.3; [ -z "$(port_pid "$1")" ] && return
    done
    kill -9 $(port_pid "$1") 2>/dev/null
  fi
}

wait_port() {
  for _ in $(seq 1 60); do
    [ -n "$(port_pid "$1")" ] && return 0
    sleep 0.5
  done
  return 1
}

stop_all() {
  kill_port "$API_PORT"; kill_port "$WEB_PORT"
  echo "stopped."
}

start_all() {
  local enforced; enforced=$(cat "$FLAG" 2>/dev/null || echo 0)
  stop_all >/dev/null

  ARUVI_ENTITLEMENT_ENFORCED="$enforced" \
    nohup python3 -m uvicorn api.main:app --host 0.0.0.0 --port "$API_PORT" --no-access-log \
    > "$LOGS/api.log" 2>&1 &   # request lines: .devlogs/access/ (api/access_log.py)
  nohup npm --prefix web run dev -- -H 0.0.0.0 > "$LOGS/web.log" 2>&1 &

  wait_port "$API_PORT" || { echo "API failed — tail $LOGS/api.log"; tail -20 "$LOGS/api.log"; }
  wait_port "$WEB_PORT" || { echo "Web failed — tail $LOGS/web.log"; tail -20 "$LOGS/web.log"; }

  local ip; ip=$(lan_ip)
  echo
  echo "  entitlement enforcement: $([ "$enforced" = 1 ] && echo ON || echo OFF)"
  echo "  mail: $(mail_mode)"
  echo "  web   http://localhost:$WEB_PORT"
  echo "  api   http://localhost:$API_PORT/docs"
  [ -n "$ip" ] && echo "  phone http://$ip:$WEB_PORT   (same WiFi)"
  echo "  logs  ./dev.sh logs      stop  ./dev.sh stop"
}

case "${1:-start}" in
  on)   echo 1 > "$FLAG"; start_all ;;
  off)  echo 0 > "$FLAG"; start_all ;;
  start|"") start_all ;;
  stop) stop_all ;;
  restart) start_all ;;
  status)
    echo "entitlement enforcement: $([ "$(cat "$FLAG" 2>/dev/null || echo 0)" = 1 ] && echo ON || echo OFF)"
    echo "mail: $(mail_mode)"
    echo "api  (:$API_PORT): $(port_pid $API_PORT || echo 'not running')"
    echo "web  (:$WEB_PORT): $(port_pid $WEB_PORT || echo 'not running')"
    ;;
  logs) tail -f "$LOGS/api.log" "$LOGS/web.log" ;;

  # ── one teacher's subscription (thin wrapper over the founder CLI) ──
  grant)  shift; python3 aruvi-scripts/entitlement.py grant "${1:?usage: ./dev.sh grant <user> [--scopes …]}" "${@:2}" ;;
  revoke) shift; python3 aruvi-scripts/entitlement.py revoke "${1:?usage: ./dev.sh revoke <user>}" ;;
  trial)  shift; python3 aruvi-scripts/entitlement.py trial-reset "${1:?usage: ./dev.sh trial <user>}" ;;
  who)    shift; python3 aruvi-scripts/entitlement.py status "${1:?usage: ./dev.sh who <user>}" ;;

  # Full wipe — same code path as POST /data-rights/erase. Asks for a typed "erase".
  # Add --with-consent to also drop the retained consent ledger (agreement re-testing).
  erase)  shift; python3 aruvi-scripts/erase.py "${1:?usage: ./dev.sh erase <user> [--with-consent]}" "${@:2}" ;;

  *) echo "usage: ./dev.sh [start|on|off|stop|status|logs|grant|revoke|trial|who|erase]"; exit 1 ;;
esac
