#!/usr/bin/env bash
# aftermeet smoke test — exercises every public surface end-to-end.
# Usage:
#   ./tests/smoke.sh                          # against production
#   BASE=http://localhost:8788 ./tests/smoke.sh   # against local dev
set -uo pipefail

BASE="${BASE:-https://aftermeet.pages.dev}"
EVENT_URL="${EVENT_URL:-https://cerebralvalley.ai/e/genspark-meetup-seoul}"
EXPECT_SLUG="${EXPECT_SLUG:-genspark-meetup-seoul}"
PROFILE_URL="${PROFILE_URL:-https://github.com/torvalds}"

PASS=0
FAIL=0
FAILED=()

c_red=$'\033[31m'; c_grn=$'\033[32m'; c_yel=$'\033[33m'; c_dim=$'\033[2m'; c_rst=$'\033[0m'

ok()   { PASS=$((PASS+1)); printf "  ${c_grn}✓${c_rst} %s\n" "$1"; }
fail() { FAIL=$((FAIL+1)); FAILED+=("$1"); printf "  ${c_red}✗${c_rst} %s\n    ${c_dim}%s${c_rst}\n" "$1" "${2:-}"; }
note() { printf "  ${c_dim}…${c_rst} %s\n" "$1"; }
hdr()  { printf "\n${c_yel}▸ %s${c_rst}\n" "$1"; }

# Returns body to stdout, status to var STATUS
curl_status() {
  local url="$1"; shift
  STATUS=$(curl -s -o /tmp/aftermeet_body -w "%{http_code}" "$url" "$@")
  cat /tmp/aftermeet_body
}

assert_status() {
  local url="$1" expect="$2" desc="$3"; shift 3
  curl_status "$url" "$@" > /tmp/aftermeet_out
  if [ "$STATUS" = "$expect" ]; then ok "$desc ($STATUS)"; else fail "$desc" "got $STATUS, expected $expect"; fi
}

assert_contains() {
  local url="$1" needle="$2" desc="$3"; shift 3
  local body; body=$(curl -s "$url" "$@")
  if echo "$body" | grep -qiF -e "$needle"; then ok "$desc"; else fail "$desc" "missing: $needle"; fi
}

assert_json_field() {
  local body="$1" field="$2" desc="$3"
  if echo "$body" | python3 -c "import json,sys; d=json.load(sys.stdin); k='$field'.split('.'); v=d
for part in k:
    v = v[int(part)] if part.isdigit() else v[part]
print('OK' if v is not None else 'EMPTY')" 2>/dev/null | grep -q OK; then
    ok "$desc"
  else
    fail "$desc" "field '$field' missing in response"
  fi
}

echo "═══════════════════════════════════════════════════════"
echo "   aftermeet smoke test"
echo "   BASE = $BASE"
echo "═══════════════════════════════════════════════════════"

hdr "1. Static pages"
assert_status "$BASE/"        200 "GET /"
assert_contains "$BASE/"      "aftermeet" "/ contains brand"
assert_contains "$BASE/"      "after the meet" "/ has tagline"
assert_status "$BASE/host"    200 "GET /host"
assert_contains "$BASE/host"  "Create the event" "/host has heading"
assert_status "$BASE/pitch"   200 "GET /pitch"
assert_contains "$BASE/pitch" "pitchQR" "/pitch has QR canvas"
assert_status "$BASE/style.css" 200 "GET /style.css"
assert_contains "$BASE/style.css" "--accent" "style.css has design tokens"

hdr "2. POST /api/events — create event"
CREATE_BODY=$(curl -s -X POST "$BASE/api/events" \
  -H "Content-Type: application/json" \
  -d "{\"eventUrl\":\"$EVENT_URL\"}")
echo "    ${c_dim}response: $(echo "$CREATE_BODY" | head -c 160)…${c_rst}"
SLUG=$(echo "$CREATE_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('slug',''))" 2>/dev/null)
if [ "$SLUG" = "$EXPECT_SLUG" ]; then ok "slug = $SLUG"; else fail "slug mismatch" "got '$SLUG', expected '$EXPECT_SLUG'"; fi
assert_json_field "$CREATE_BODY" "event.title" "event has title"
assert_json_field "$CREATE_BODY" "event.source" "event has source"

# idempotent re-submit
CREATE_BODY_2=$(curl -s -X POST "$BASE/api/events" \
  -H "Content-Type: application/json" \
  -d "{\"eventUrl\":\"$EVENT_URL\"}")
SLUG2=$(echo "$CREATE_BODY_2" | python3 -c "import json,sys; print(json.load(sys.stdin).get('slug',''))" 2>/dev/null)
if [ "$SLUG" = "$SLUG2" ]; then ok "POST is idempotent (same slug on re-submit)"; else fail "idempotency broken" "$SLUG vs $SLUG2"; fi

hdr "3. POST /api/events — error paths"
ERR_BODY=$(curl -s -o /tmp/aftermeet_err -w "%{http_code}" -X POST "$BASE/api/events" \
  -H "Content-Type: application/json" -d '{}')
if [ "$ERR_BODY" = "400" ]; then ok "missing eventUrl → 400"; else fail "missing eventUrl validation" "got $ERR_BODY"; fi

hdr "4. GET /api/events"
GET_BODY=$(curl -s "$BASE/api/events?slug=$EXPECT_SLUG")
assert_json_field "$GET_BODY" "event.slug" "GET returns event"
assert_json_field "$GET_BODY" "participants" "GET returns participants array"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/events?slug=does-not-exist-xyz")
if [ "$STATUS" = "404" ]; then ok "unknown slug → 404"; else fail "unknown slug handling" "got $STATUS"; fi

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/events")
if [ "$STATUS" = "400" ]; then ok "missing slug → 400"; else fail "missing slug validation" "got $STATUS"; fi

hdr "5. POST /api/profiles — add participant"
PROFILE_BODY=$(curl -s -X POST "$BASE/api/profiles" \
  -H "Content-Type: application/json" \
  -d "{\"eventSlug\":\"$EXPECT_SLUG\",\"profileUrl\":\"$PROFILE_URL\",\"note\":\"smoke test bot\"}")
echo "    ${c_dim}response: $(echo "$PROFILE_BODY" | head -c 200)…${c_rst}"
assert_json_field "$PROFILE_BODY" "profile.id" "profile has id"
assert_json_field "$PROFILE_BODY" "profile.name" "profile has name (from GH API)"
assert_json_field "$PROFILE_BODY" "profile.avatar" "profile has avatar (from GH API)"

# idempotent re-add
PROFILE_BODY_2=$(curl -s -X POST "$BASE/api/profiles" \
  -H "Content-Type: application/json" \
  -d "{\"eventSlug\":\"$EXPECT_SLUG\",\"profileUrl\":\"$PROFILE_URL\"}")
ID1=$(echo "$PROFILE_BODY"   | python3 -c "import json,sys; print(json.load(sys.stdin)['profile']['id'])" 2>/dev/null)
ID2=$(echo "$PROFILE_BODY_2" | python3 -c "import json,sys; print(json.load(sys.stdin)['profile']['id'])" 2>/dev/null)
if [ "$ID1" = "$ID2" ] && [ -n "$ID1" ]; then ok "re-adding same profile is idempotent"; else fail "profile id mismatch" "$ID1 vs $ID2"; fi

hdr "6. POST /api/profiles — error paths"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/profiles" \
  -H "Content-Type: application/json" -d '{"profileUrl":"https://x"}')
if [ "$STATUS" = "400" ]; then ok "missing eventSlug → 400"; else fail "missing eventSlug validation" "got $STATUS"; fi

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/profiles" \
  -H "Content-Type: application/json" \
  -d "{\"eventSlug\":\"definitely-not-a-real-event-zzz\",\"profileUrl\":\"$PROFILE_URL\"}")
if [ "$STATUS" = "404" ]; then ok "unknown event → 404"; else fail "unknown event handling" "got $STATUS"; fi

hdr "7. Dynamic event pages render"
assert_status "$BASE/e/$EXPECT_SLUG"        200 "GET /e/<slug>"
assert_contains "$BASE/e/$EXPECT_SLUG" "Genspark" "event page has title"
assert_contains "$BASE/e/$EXPECT_SLUG" "person-name" "event page renders cards"
assert_status "$BASE/e/$EXPECT_SLUG/screen" 200 "GET /e/<slug>/screen"
assert_contains "$BASE/e/$EXPECT_SLUG/screen" "Scan to join" "screen has scan CTA"
assert_status "$BASE/e/$EXPECT_SLUG/join"   200 "GET /e/<slug>/join"
assert_contains "$BASE/e/$EXPECT_SLUG/join" "Your profile link" "join has profile input"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/e/no-such-event-xxx/screen")
if [ "$STATUS" = "404" ]; then ok "unknown event /screen → 404"; else fail "unknown event /screen" "got $STATUS"; fi

hdr "8. End-to-end: profile shows up on event page"
EVENT_HTML=$(curl -s "$BASE/e/$EXPECT_SLUG")
# We just added Linus Torvalds (or whoever PROFILE_URL points to)
NAME_HINT=$(echo "$PROFILE_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin)['profile'].get('name','') or '')" 2>/dev/null)
if [ -n "$NAME_HINT" ] && echo "$EVENT_HTML" | grep -qF "$NAME_HINT"; then
  ok "added profile appears in /e/$EXPECT_SLUG (name='$NAME_HINT')"
else
  fail "added profile not visible on event page" "looked for '$NAME_HINT'"
fi

hdr "9. Participant count reflected in API"
COUNT=$(curl -s "$BASE/api/events?slug=$EXPECT_SLUG" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['event'].get('participantIds',[])))" 2>/dev/null)
if [ -n "$COUNT" ] && [ "$COUNT" -ge 1 ]; then ok "participantIds count = $COUNT (≥1)"; else fail "participant count" "got '$COUNT'"; fi

echo ""
echo "═══════════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  printf "${c_grn}  PASSED${c_rst}  %d / %d\n" "$PASS" "$((PASS+FAIL))"
else
  printf "${c_red}  FAILED${c_rst}  %d / %d  (${c_red}%d failing${c_rst})\n" "$PASS" "$((PASS+FAIL))" "$FAIL"
  printf "${c_red}  Failures:${c_rst}\n"
  for f in "${FAILED[@]}"; do printf "    • %s\n" "$f"; done
fi
echo "═══════════════════════════════════════════════════════"

[ "$FAIL" -eq 0 ]
