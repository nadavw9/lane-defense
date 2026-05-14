# Lane Defense — Visual Audit (L1–L20)
_Generated: 2026-05-14. Playwright screenshots taken via `__devGotoLevel` hook at 2.5 s after level start._

---

## Level-by-Level Observations

| Level | Theme | Observation |
|-------|-------|-------------|
| L1  | Morning (cream/pale sky, warm green) | FTUE text banner "Cars incoming! Drag a shooter onto a lane — colors must match." appears centered over the 3D road, directly covering the red bike cars. **Category A.** |
| L2  | Morning | 2 lanes, blue sedans, clean — no issues. |
| L3  | Morning | 3 lanes, red+blue sedans, clean — no issues. |
| L4  | Morning | 4 lanes, red+blue sedans, clean — no issues. |
| L5  | Afternoon (brighter blue sky, clouds) | 4 lanes, red+blue sedans visible. Theme transition from morning is noticeable and distinct. Clean. |
| L6  | Afternoon | 4 lanes, red+blue sedans, clean after dismissing bench-unlock popup. |
| L7  | Afternoon | 4 lanes, red+blue sedans. Same afternoon look as L5-L6. Clean. |
| L8  | Afternoon | 4 lanes, red+blue sedans+green queue items. SWAP booster unlocked. Clean. |
| L9  | Sunset (deep red/orange/yellow sky) | 4 lanes, green jeep-type cars + blue sedans visible. Theme is dramatic and unmistakable. Vivid colors. ✅ |
| L10 | Sunset | 4 lanes, purple+blue+green cars. Theme same as L9. Vivid. ✅ |
| L11 | Sunset | 4 lanes, green+blue+purple cars. Vivid. ✅ |
| L12 | Sunset | 4 lanes, green+red cars. PEEK booster unlocked. Vivid. ✅ |
| L13 | Misty (grey overcast) | **CRITICAL: Fog near=0, entire road is opaque white/grey. ALL CARS COMPLETELY INVISIBLE. Game is unplayable.** **Category C.** |
| L14 | Misty | **Same critical fog bug as L13. Cars barely visible as faint shapes at mid-distance. Unplayable.** **Category C.** |
| L15 | Misty | **Same critical fog bug. Cars invisible. FREEZE booster unlocked.** **Category C.** |
| L16 | Misty | **Same critical fog bug — 4 consecutive misty levels all unplayable.** **Category C.** |
| L17 | Autumn (warm amber/gold sky) | 4 lanes, purple+orange+green cars. Warm golden lighting. Distinct and vivid. ✅ |
| L18 | Autumn | 4 lanes, green+orange cars. Clear and vivid. ✅ |
| L19 | Autumn | 4 lanes, green+purple cars. Fluffy clouds visible. Clear and vivid. ✅ |
| L20 | Autumn | 3 lanes, purple+green+orange cars. Clear. (Fewer lanes may be intentional at L20.) ✅ |

---

## Bug Categories

### Category A — UI Overlay Hiding Gameplay Content

**A1 — L1 FTUE banner covers the 3D road and cars**
- Location: `src/screens/FTUEOverlay.js` — L1 tutorial hint banner
- What happens: The text "Cars incoming! Drag a shooter onto a lane — colors must match." is anchored at the vertical center of the 3D game viewport (~40% from top of canvas), directly covering the cars and road surface.
- Fix: Reposition the banner to the bottom of the 3D road area (above the shooter columns), not over the car lanes.

---

### Category B — Car Color Issues

None found. Car colors across all themes are vivid and correct:
- Red = candy-apple red ✅
- Blue = electric blue ✅
- Green = vivid lime-green ✅
- Purple = bright lavender ✅
- Orange = vivid orange ✅
- Damaged cars keep original color (confirmed — previous session fix held) ✅

---

### Category C — Weather/Theme Broken

**C1 — Misty theme (L13–L16): fog is too dense — entire road turns white, all cars invisible**
- Affected levels: L13, L14, L15, L16 (4 consecutive levels)
- Root cause: Fog `near` value is set too close to camera (likely near=0 or near=2), causing fog to fully blanket the gameplay zone before any car is visible.
- Fix: Set `fog.near = 10, fog.far = 55` in ThemeRegistry.js for the 'misty' theme variant. This preserves the atmospheric effect at distance while keeping the front half of the road fully visible.

---

### Category D — Other Visual Artifacts

**D1 — Shooter queue columns extend below viewport bottom**
- Levels affected: L2+ (any level with 2+ lanes)
- The bottom 1–2 shooter queue items in each column are clipped by the viewport edge. The queue rendering extends to y≈610 CSS px on a 758px canvas, which matches the game canvas boundary — so this may be intentional as a fade/clip. Low priority.

**D2 — L1 title screen has cloud overlapping the "A" in "LANE"**
- A large cloud floats directly over the letter "A" in "LANE DEFENSE" on the title screen, partially obscuring the letter.
- Not a gameplay bug, low priority cosmetic issue.

---

## Summary Table

| Category | Bug | Severity | Levels Affected |
|----------|-----|----------|----------------|
| A | FTUE banner covers 3D road and cars | Medium | L1 |
| C | Misty fog renders entire road invisible | **Critical** | L13–L16 |
| D | Queue items clipped at viewport bottom | Low | L2+ |
| D | Cloud overlaps "A" in title screen logo | Cosmetic | Title |

---

_Next step: Fix Category A (Goal 2), verify car colors (Goal 3), fix misty fog (Goal 4)._
