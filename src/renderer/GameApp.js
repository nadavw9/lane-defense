// GameApp — PixiJS entry point and main game loop.
//
// Owns all subsystem instances and wires them together:
//   Director modules (read-only from renderer's perspective)
//   Renderer modules (CarRenderer, ShooterRenderer)
//   Input modules    (InputManager → DragDrop)
//
// Data flow: Director → GameState → Renderers.  Input → onDeploy callback →
// mutates column (consume) → Director refills on next tick → ShooterRenderer reads.
import { Application }      from 'pixi.js';
import { LayerManager }     from './LayerManager.js';
import { LaneRenderer }     from './LaneRenderer.js';
import { CarRenderer }      from './CarRenderer.js';
import { ShooterRenderer }  from './ShooterRenderer.js';
import { DragDrop }         from '../input/DragDrop.js';
import { InputManager }     from '../input/InputManager.js';

import { CarDirector }      from '../director/CarDirector.js';
import { ShooterDirector }  from '../director/ShooterDirector.js';
import { FairnessArbiter }  from '../director/FairnessArbiter.js';
import { IntensityPhase }   from '../director/IntensityPhase.js';
import { SeededRandom }     from '../utils/SeededRandom.js';
import { Lane }             from '../models/Lane.js';
import { Column }           from '../models/Column.js';
import { WORLD_CONFIG, PHASE_CONFIG } from '../director/DirectorConfig.js';

// ── App dimensions ────────────────────────────────────────────────────────────
const APP_W = 390;
const APP_H = 844;

// ── Level config ──────────────────────────────────────────────────────────────
const LEVEL_DURATION = 90;
const COLORS         = ['Red', 'Blue'];
const WORLD          = WORLD_CONFIG[1];
const LANE_COUNT     = 4;
const COL_COUNT      = 4;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildGameState(lanes, columns, elapsed, phaseMan) {
  return {
    lanes,
    columns,
    colorPalette:  COLORS,
    elapsedTime:   elapsed,
    phase:         phaseMan.getCurrentPhase(),
  };
}

// Stagger initial car positions so the level looks alive from frame 1.
function primeInitialCars(carDir, lanes, rng) {
  const calmCfg = PHASE_CONFIG['CALM'];
  for (const lane of lanes) {
    const car = carDir.generateCar(lane, 'CALM', WORLD, COLORS);
    car.position = rng.nextFloat(8, 50);
    lane.addCar(car);
    carDir.resetSpawnTimer(lane, calmCfg);
  }
}

// Remove cars that have reached the breach point so the demo loops forever.
function removeBreachers(lanes) {
  for (const lane of lanes) {
    while (lane.frontCar()?.position >= 100) lane.removeFrontCar();
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────

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

  // ── Layer stack ──────────────────────────────────────────────────────────
  const layers = new LayerManager(app.stage);

  // ── Static lane backgrounds ──────────────────────────────────────────────
  new LaneRenderer(layers, APP_W);

  // ── Director + shared RNG ────────────────────────────────────────────────
  // Both directors share one SeededRandom so the sequence is fully deterministic.
  const rng        = new SeededRandom(1);
  const arbiter    = new FairnessArbiter();
  const carDir     = new CarDirector({}, rng);
  const shooterDir = new ShooterDirector({}, rng, arbiter);
  const phaseMan   = new IntensityPhase(LEVEL_DURATION);

  // ── Game state ───────────────────────────────────────────────────────────
  const lanes   = Array.from({ length: LANE_COUNT },  (_, id) => new Lane({ id }));
  const columns = Array.from({ length: COL_COUNT },   (_, id) => new Column({ id }));

  primeInitialCars(carDir, lanes, rng);

  // Prime columns with an initial fill before the first render.
  phaseMan.update(0);
  const initState  = buildGameState(lanes, columns, 0, phaseMan);
  const initParams = phaseMan.getParams();
  shooterDir.fillColumns(columns, initState, initParams);

  // ── Renderers ────────────────────────────────────────────────────────────
  const carRenderer     = new CarRenderer(layers, lanes);
  const shooterRenderer = new ShooterRenderer(layers, columns);

  // ── Input ─────────────────────────────────────────────────────────────────
  // onDeploy: called by DragDrop when a shooter is successfully dropped on a lane.
  // Consumes the top shooter; ShooterDirector refills the column next tick.
  const dragDrop = new DragDrop(
    layers,
    columns,
    shooterRenderer,
    (colIdx /*, laneIdx — combat handled in step 6 */) => {
      columns[colIdx].consume();
    },
  );
  new InputManager(app, dragDrop);

  // ── Main loop ─────────────────────────────────────────────────────────────
  let elapsed = 0;

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    elapsed += dt;

    // Restart demo after level duration.
    if (elapsed >= LEVEL_DURATION) {
      elapsed = 0;
      for (const lane of lanes) lane.cars.length = 0;
      for (const col  of columns) col.shooters.length = 0;
      primeInitialCars(carDir, lanes, rng);
    }

    // 1. Advance phase clock.
    phaseMan.update(elapsed);
    const currentPhase = phaseMan.getCurrentPhase();
    const phaseCfg     = PHASE_CONFIG[currentPhase];
    const phaseParams  = phaseMan.getParams();
    const gameState    = buildGameState(lanes, columns, elapsed, phaseMan);

    // 2. Advance cars.
    for (const lane of lanes) lane.advance(dt);
    removeBreachers(lanes);

    // 3. Spawn new cars.
    carDir.updateSpawnTimers(lanes, dt, phaseCfg);
    for (const lane of lanes) {
      if (carDir.isReadyToSpawn(lane)) {
        lane.addCar(carDir.generateCar(lane, currentPhase, WORLD, COLORS));
        carDir.resetSpawnTimer(lane, phaseCfg);
      }
    }

    // 4. Refill shooter columns.
    shooterDir.fillColumns(columns, gameState, phaseParams);

    // 5. Sync visuals.
    carRenderer.update();
    shooterRenderer.update(elapsed);
    dragDrop.update(dt);
  });
}

main();
