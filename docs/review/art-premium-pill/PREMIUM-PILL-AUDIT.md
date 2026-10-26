# Traffic Bomb: PremiumUI pill + tag (art/premium-pill)

**Date:** 2026-10-26 · **Base:** `art/f01-raise-play` @ `4e76945` · layout/chrome only, no logic.

Survey of player-facing leftovers (every screen in `src/screens`, `src/renderer`) found the most visible
hand-drawn chrome is flat navy capsules: Title LEVEL pill, Title button captions, Map coin and page
counters. The kit had no capsule, so every screen rolled its own.

## Ship
| Element | Before | After |
|---|---|---|
| Kit | no capsule / tag | `PremiumUI.pill(w, h, { rim, face })` (gold bevel rim, lit face, gloss, ink) and `PremiumUI.tag(text)` (red lipped capsule) |
| Title LEVEL N | flat navy roundRect, thin brass stroke | `pill` |
| Title captions | flat navy roundRect | `pill({ rim: false })` |
| Title NEW tags | flat red roundRect + Text | `tag('NEW')` |
| Title captions overlap | TROPHIES / CHALLENGE plates overlapped | captions shrink to their slot (gapX) |
| Map coin + page counter | flat navy roundRect | `pill` |

Text fits in every frame (English UI). Self HUMAN-FINAL per the chrome rule.

## Next (from the survey, most visible first)
GoalCounterUI HUD band, PreLevel streak bar / NEW-this-level box / FREE chip, FTUEOverlay hint banner,
WinScreen SHARE as plain text, Map stars plaque + RACE pill, Shop tiles. Kit gaps: toast, toggle, slider.
Missing icon sprites force hand drawing: map, lock, pause.
