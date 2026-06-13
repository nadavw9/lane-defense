// BoosterState — tracks booster inventory and active modes.
// Written to by BoosterBar callbacks and DragDrop; read by ShooterRenderer.
// No PixiJS dependencies — pure logic.
export class BoosterState {
  constructor() {
    this.colorChange = 0;      // remaining COLOR CHANGE charges
    this.freeze = 0;           // remaining freeze charges
    // COLOR CHANGE is a two-tap booster: tap the button → tap a car (records its
    // colour) → tap a colour from the picker → all on-screen cars of the car's
    // original colour become the chosen colour.
    this.colorChangeMode      = false;  // true while waiting for a car / colour tap
    this.colorChangeFromColor = null;   // the tapped car's colour, awaiting a target
    this.freezeShots  = 0;             // remaining shots that won't advance the grid

    // ── Bomb ─────────────────────────────────────────────────────────────────
    this.bombs    = 0;          // stored bomb charges
    this.bombsMax = 3;          // max storable bombs
    this.bombMode = false;      // true while waiting for player to tap placement
  }

  // Enter COLOR CHANGE mode if charges remain (awaiting a car tap). Returns true on success.
  activateColorChange() {
    if (this.colorChange <= 0) return false;
    this.colorChangeMode      = true;
    this.colorChangeFromColor = null;
    return true;
  }

  // Record the colour of the car the player tapped (step 1 → step 2: pick a colour).
  setColorChangeCar(color) {
    if (!this.colorChangeMode) return false;
    this.colorChangeFromColor = color;
    return true;
  }

  // Abort COLOR CHANGE without consuming a charge.
  cancelColorChange() {
    this.colorChangeMode      = false;
    this.colorChangeFromColor = null;
  }

  // Consume one COLOR CHANGE charge once a recolour has been applied.
  consumeColorChange() {
    if (this.colorChange <= 0) return false;
    this.colorChange--;
    this.colorChangeMode      = false;
    this.colorChangeFromColor = null;
    return true;
  }

  // Freeze the grid for exactly the next shot (turn-based: one protected shot,
  // no cars advance, then freeze ends). The game has no clock, so freeze is
  // measured in shots/turns, not seconds.  Returns true on success.
  activateFreeze() {
    if (this.freeze <= 0) return false;
    this.freeze--;
    this.freezeShots = 1;
    return true;
  }

  // True while freeze shots remain (checked by GameLoop before advancing grid).
  isFrozen() {
    return this.freezeShots > 0;
  }

  // Consume one freeze shot.  Returns true when freeze expires.
  consumeFreezeShot() {
    if (this.freezeShots <= 0) return true;
    this.freezeShots--;
    return this.freezeShots === 0;
  }

  // Enter bomb placement mode if charges remain.  Returns true on success.
  activateBomb() {
    if (this.bombs <= 0) return false;
    this.bombMode = true;
    return true;
  }

  // Exit bomb placement mode without consuming a charge.
  cancelBomb() {
    this.bombMode = false;
  }

  // Consume one bomb charge when the player places a bomb.  Returns true on success.
  consumeBomb() {
    if (this.bombs <= 0) return false;
    this.bombs--;
    this.bombMode = false;
    return true;
  }
}
