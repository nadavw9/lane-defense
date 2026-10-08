#!/bin/sh
# Build a relative-base preview of the game for hosting as a private artifact.
#   sh scripts/build-preview.sh <outDir>
# Adds an in-memory localStorage fallback (preview hosts may block storage) and
# writes <outDir>/../preview-batch{1,2}.json file lists (<=250 files each).
set -e
OUT="$1"
rm -rf /tmp/preview-dist "$OUT"
npx vite build --outDir /tmp/preview-dist --emptyOutDir > /dev/null
cp -r /tmp/preview-dist "$OUT"
rm -f "$OUT/admin.html" "$OUT/privacy.html" "$OUT/ui/.gitkeep"
rm -rf "$OUT/models"   # .glb is not a servable artifact type; the game falls back without them
python3 - "$OUT" <<'PY'
import sys, os, json
out = sys.argv[1]
p = os.path.join(out, 'index.html')
s = open(p).read()
shim = """    <script>
      (function () {
        try { var k = '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return; } catch (e) {}
        var m = {};
        var mem = { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); },
          removeItem: function (k) { delete m[k]; }, clear: function () { m = {}; }, key: function (i) { return Object.keys(m)[i] || null; },
          get length() { return Object.keys(m).length; } };
        try { Object.defineProperty(window, 'localStorage', { value: mem, configurable: true }); } catch (e) {}
      })();
    </script>
"""
# Preview-only QA shortcut: open the page with ?unlock=40 to start with levels
# 1..40 unlocked (and a coin float) so bosses can be played without grinding.
# Lives ONLY in the preview index.html; the game source and real builds are untouched.
unlock = """    <script>
      (function () {
        try {
          var m = /[?&]unlock=(\\d+)/.exec(location.search);
          if (!m) return;
          var K = 'lane-defense-v1', d = {};
          try { d = JSON.parse(localStorage.getItem(K) || '{}') || {}; } catch (e) {}
          d.unlockedLevel = Math.max(d.unlockedLevel || 1, Math.min(100, parseInt(m[1], 10)));
          d.coins = Math.max(d.coins || 0, 500);
          localStorage.setItem(K, JSON.stringify(d));
        } catch (e) {}
      })();
    </script>
"""
s = s.replace('    <script type="module"', shim + unlock + '    <script type="module"', 1)
open(p, 'w').write(s)
files = []
for root, _, fs in os.walk(out):
    for f in fs:
        rel = os.path.relpath(os.path.join(root, f), out)
        if rel != 'index.html': files.append(rel)
files.sort()
parent = os.path.dirname(out.rstrip('/'))
json.dump([{'path': f} for f in files[:250]], open(os.path.join(parent, 'preview-batch1.json'), 'w'))
json.dump([{'path': f} for f in files[250:]], open(os.path.join(parent, 'preview-batch2.json'), 'w'))
print(len(files), 'files')
PY
