// GameApp — PixiJS entry point.
// Creates the application, wires LayerManager, LaneRenderer, and CarRenderer,
// then runs the game loop: advance cars, spawn new ones, render.
//
// Director modules (CarDirector, IntensityPhase) drive spawning so the
// cars reflect real difficulty curves from the Phase 1 director.
import { Application }  from 'pixi.js';
import { LayerManager } from './LayerManager.js';
import { LaneRenderer } from './LaneRenderer.js';
import { CarRenderer }  from './CarRenderer.js';

import { CarDirector }   from '../director/CarDirector.js';
import { IntensityPhase } from '../director/IntensityPhase.js';
import { SeededRandom }  from '../utils/SeededRandom.js';
import { Lane }          from '../models/Lane.js';
import { WORLD_CONFIG, PHASE_CONFIG } from '../director/DirectorConfig.js';

// ── Layout ────────────────────────────────────────────────────────────────────
const APP_W = 390;
const APP_H = 844;

// ── Level config ─────────────────────────────────────────────────────────────
const LEVEL_DURATION = 90;          // seconds
const COLORS         = ['Red', 'Blue'];
const WORLD          = WORLD_CONFIG[1];
const LANE_COUNT     = 4;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Stagger initial car positions so the level looks alive from frame 1.
// Each lane gets one car placed at a random position in its first third.
function primeInitialCars(carDir, lanes, rng) {
  const calmCfg = PHASE_CONFIG['CALM'];
  for (const lane of lanes) {
    const car = carDir.generateCar(lane, 'CALM', WORLD, COLORS);
    car.position = rng.nextFloat(5, 45);   // staggered across the near half
    lane.addCar(car);
    carDir.resetSpawnTimer(lane, calmCfg);
  }
}

// Remove any car that has reached or passed the breach line (position >= 100).
// In the demo loop we reset the level rather than ending it, so cars cycle.
function removeBreachers(lanes) {
  for (const lane of lanes) {
    // frontCar() is the most-advanced car (index 0).
    while (lane.frontCar() !== null && lane.frontCar().position >= 100) {
      lane.removeFrontCar();
    }
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
  const app = new Application();
  await app.init({
    width:           APP_W,
    height:          APP_H,
    backgroundColor: 0x111111,
    antialias:       true,
    resolution:      window.devicePixelRatio || 1,
    autoDensity:     true,
  });
  document.body.appendChild(app.canvas);

  // ── Layer stack ─────────────────────────────────────────────────────────
  const layers = new LayerManager(app.stage);

  // ── Static background ───────────────────────────────────────────────────
  new LaneRenderer(layers, APP_W);

  // ── Director + game state ────────────────────────────────────────────────
  const rng     = new SeededRandom(1);
  const carDir  = new CarDirector({}, rng);
  const phaseMan = new IntensityPhase(LEVEL_DURATION);
  const lanes   = Array.from({ length: LANE_COUNT }, (_, id) => new Lane({ id }));

  primeInitialCars(carDir, lanes, rng);

  // ── Renderers ────────────────────────────────────────────────────────────
  const carRenderer = new CarRenderer(layers, lanes);

  // ── Game loop ────────────────────────────────────────────────────────────
  let elapsed = 0;

  app.ticker.add((ticker) => {
    // Cap delta so a paused/hidden tab doesn't fire a huge catch-up tick.
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    elapsed += dt;

    // Restart demo loop after level duration so it runs indefinitely.
    if (elapsed >= LEVEL_DURATION) {
      elapsed = 0;
      for (const lane of lanes) lane.cars.length = 0;
      primeInitialCars(carDir, lanes, rng);
      return;
    }

    // 1. Update phase — drives spawn cadence and car HP.
    phaseMan.update(elapsed);
    const currentPhase = phaseMan.getCurrentPhase();
    const phaseCfg     = PHASE_CONFIG[currentPhase];

    // 2. Advance all cars toward the breach.
    for (const lane of lanes) lane.advance(dt);

    // 3. Remove cars that breached (demo keeps running rather than ending).
    removeBreachers(lanes);

    // 4. Spawn new cars when each lane's cooldown expires.
    carDir.updateSpawnTimers(lanes, dt, phaseCfg);
    for (const lane of lanes) {
      if (carDir.isReadyToSpawn(lane)) {
        const car = carDir.generateCar(lane, currentPhase, WORLD, COLORS);
        lane.addCar(car);
        carDir.resetSpawnTimer(lane, phaseCfg);
      }
    }

    // 5. Sync visuals to state — renderer reads, never writes.
    carRenderer.update();
  });
}

main();
