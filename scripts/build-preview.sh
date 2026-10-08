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
# Preview-only QA gate: the hosted page cannot read ?unlock=, so the game's module
# is held back until the player picks "Normal" or "Unlock L1-40" on a tiny overlay.
# Lives ONLY in the preview index.html; game source and real builds are untouched.
import re
mod = re.search(r'<script type="module"[^>]*src="([^"]+)"[^>]*></script>', s)
src = mod.group(1)
gate = """    <script>
      (function () {
        var SRC = "%s";
        function start(unlock) {
          try {
            if (unlock) {
              var K = 'lane-defense-v1', d = {};
              try { d = JSON.parse(localStorage.getItem(K) || '{}') || {}; } catch (e) {}
              d.unlockedLevel = Math.max(d.unlockedLevel || 1, 40);
              d.coins = Math.max(d.coins || 0, 500);
              localStorage.setItem(K, JSON.stringify(d));
            }
          } catch (e) {}
          var o = document.getElementById('qa-gate'); if (o) o.remove();
          var t = document.createElement('script');
          t.type = 'module'; t.crossOrigin = ''; t.src = SRC; document.body.appendChild(t);
        }
        window.addEventListener('DOMContentLoaded', function () {
          var o = document.createElement('div'); o.id = 'qa-gate';
          o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font:600 18px sans-serif;color:#fff';
          o.innerHTML = '<div>Traffic Bomb preview</div>';
          function btn(label, u) {
            var b = document.createElement('button'); b.textContent = label;
            b.style.cssText = 'font:700 18px sans-serif;padding:14px 28px;border-radius:14px;border:0;background:#2F8CFF;color:#fff;min-width:240px';
            b.onclick = function () { start(u); }; o.appendChild(b);
          }
          btn('Play normally', false);
          btn('Unlock levels 1-40 (boss QA)', true);
          document.body.appendChild(o);
        });
      })();
    </script>
""" % src
s = s.replace(mod.group(0), gate, 1)
s = s.replace('    <script>', shim + '    <script>', 1) if False else s
s = s.replace(gate, shim + gate, 1)
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
