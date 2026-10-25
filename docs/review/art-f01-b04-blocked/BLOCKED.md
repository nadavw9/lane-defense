# F-01 sky + B-04 tray void — BLOCKED (need Nadav), not inventable polish

**Date:** 2026-10-26 Asia/Jerusalem  
**Base:** `art/motion-f08-f03-polish` @ `a854552`  
**Verdict:** **CLEAR this stream** — both audit items are **stale vs live code**. Remaining choices are product/layout / 3D scene, not a safe art/* chrome fill.

## F-01 — Title “sky 45% dead space / PLAY too low”

**Audit ask (exact):** sky ~45% with only clouds; PLAY lost in lower third; poor use of space.

**Live today:** full-bleed `title-background.png` town + logo + `app-hero` + PLAY 308×88 mid-screen. The empty sky-cloud void the audit photographed **no longer exists**.

**Evidence:** `title-upper.png` · `title-full.png`

**Why not ship without Nadav:** any further change is a **composition redesign** (raise PLAY, crop town, add vignette band, restack logo/hero). That is art-direction, not a missing plate/gradient.

**Hebrew one-liner for Nadav:**  
> F-01 (שמיים ריקים בטייטל) — כבר מולא ברקע עיר מלא; אם עדיין מרגיש ריק — צריך החלטה ממך: להעלות את PLAY / לחתוך את העיר / או להשאיר.

## B-04 — Shooter tray “pure black void”

**Audit ask (exact):** bottom ~35% pure black; unfinished; “3D road must extend **or** dark gradient blend.”

**Live today:** 3D `Road3D` zone floor (per-world `zone-world*-*.png` / workshop fallback) under bombs; Pixi intentionally paints **no** translucent fill in 3D (would veil bombs — code comment in `ShooterRenderer._drawTray`). Tray is tan/beige sockets, not raw black.

**Evidence:** `tray-zone.png` · `gameplay-full.png`

**Why not ship without Nadav:** remaining “beige around trays” is the **dispatch floor design**. Filling it again with Pixi chrome fights the 3D floor and reintroduces the veil bug. Extending the road / denser zone art / different socket chrome = **scene art-direction**, not a 9-slice plate.

**Hebrew one-liner for Nadav:**  
> B-04 (חור שחור מתחת לכביש) — כבר יש רצפת zone תלת־ממדית, לא שחור; אם עדיין נראה ריק — צריך בחירה ממך: אומנות zone צפופה יותר / להאריך כביש / או להשאיר (בלי מילוי Pixi מעל הפצצות).

## CLEAR

No art/* ship this pass. PremiumUI parity + inventable F-*/motion soft gaps remain CLEAR @ `a854552`. Hats/bike untouched.
