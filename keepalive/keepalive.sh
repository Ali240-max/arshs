#!/usr/bin/env bash
# Keeps the ARSHS Supabase project awake: calls keepalive_ping(), which inserts a row and deletes it.
# Config lives in ~/.config/arshs-keepalive.env (see keepalive/README.md).
set -uo pipefail

CONFIG="${ARSHS_KEEPALIVE_CONFIG:-$HOME/.config/arshs-keepalive.env}"
LOG="${ARSHS_KEEPALIVE_LOG:-$HOME/.local/state/arshs-keepalive.log}"
mkdir -p "$(dirname "$LOG")"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

if [[ ! -r "$CONFIG" ]]; then log "ERROR config not found: $CONFIG"; exit 1; fi
# shellcheck disable=SC1090
source "$CONFIG"
if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" ]]; then log "ERROR SUPABASE_URL or SUPABASE_ANON_KEY missing in $CONFIG"; exit 1; fi

URL="${SUPABASE_URL%/}/rest/v1/rpc/keepalive_ping"
HEADERS=(-H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json")
# Old-style keys are JWTs (start with eyJ) and also go in Authorization. New sb_publishable_ keys don't.
[[ "$SUPABASE_ANON_KEY" == eyJ* ]] && HEADERS+=(-H "Authorization: Bearer $SUPABASE_ANON_KEY")

# Up to 3 tries, 60 s apart, in case the internet drops for a moment
for attempt in 1 2 3; do
  RESPONSE=$(/usr/bin/curl -sS --max-time 30 -w $'\n%{http_code}' -X POST "$URL" "${HEADERS[@]}" -d '{}' 2>&1)
  CODE="${RESPONSE##*$'\n'}"
  BODY="${RESPONSE%$'\n'*}"
  if [[ "$CODE" == "200" ]]; then
    log "OK $BODY"
    break
  fi
  log "FAIL attempt $attempt (HTTP $CODE) $BODY"
  [[ $attempt -lt 3 ]] && sleep 60
done

# Keep the log small: last 500 lines
tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
[[ "$CODE" == "200" ]]
