#!/bin/bash
# One attempt to tap "Allow" on the App Tracking Transparency alert in a booted iOS Simulator.
# Used by .github/workflows/ios-review-video.yml (App Review, 13 Nov 2026, asked to SEE the prompt).
# Prints CLICKED-osascript / CLICKED-idb on success, otherwise what each method saw.
#   bash scripts/ci/att-tap.sh <simulator-udid>
UDID="$1"
lim() { local s=$1; shift; perl -e 'alarm shift; exec @ARGV' "$s" "$@"; }
mkdir -p out

# 1. macOS accessibility: the Simulator window exposes the device's UI to System Events.
r=$(lim 40 osascript <<'OSA' 2>&1
tell application "Simulator" to activate
tell application "System Events" to tell process "Simulator"
  repeat with e in (entire contents of window 1)
    try
      if role of e is "AXButton" and (name of e is "Allow" or description of e is "Allow") then
        click e
        return "clicked"
      end if
    end try
  end repeat
end tell
return "none"
OSA
)
case "$r" in *clicked*) echo "CLICKED-osascript"; exit 0;; esac
echo "osascript: $(echo "$r" | tail -1 | head -c 150)"

# 2. idb: reads the simulator's accessibility tree and taps through CoreSimulator.
command -v idb >/dev/null || { echo "idb: not installed"; exit 0; }
lim 40 idb ui describe-all --udid "$UDID" --json > out/ax.json 2> out/idb.err || { echo "idb describe failed: $(head -c 150 out/idb.err)"; exit 0; }
XY=$(python3 - <<'PY'
import json
raw = open('out/ax.json').read().strip()
try:
    els = json.loads(raw)
except Exception:
    els = [json.loads(l) for l in raw.splitlines() if l.strip()]
if isinstance(els, dict):
    els = [els]
for e in els:
    if (e.get('AXLabel') or '').strip() == 'Allow' and e.get('frame'):
        f = e['frame']
        print(int(f['x'] + f['width'] / 2), int(f['y'] + f['height'] / 2))
        break
PY
)
[ -n "$XY" ] || { echo "idb: no Allow button yet"; exit 0; }
lim 30 idb ui tap --udid "$UDID" $XY > out/idb-tap.log 2>&1 && echo "CLICKED-idb at $XY" || echo "idb tap failed: $(head -c 150 out/idb-tap.log)"
