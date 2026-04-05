// GameApp — PixiJS bootstrap and render loop.
//
// Responsibilities:
//   • Create all subsystems (directors, game state, loop, renderers, input)
//   • Run the RENDER ticker (variable rate, reads GameState, never writes it)
//   • Host the combo display and floating chain-hit text
//
// Data flow:
//   InputManager → DragDrop → GameLoop.deploy() → GameState mutation
//   GameState → CarRenderer / ShooterRenderer / combo display
import { Application, Text } from 'pixi.js';

import { LayerManager }    from './LayerManager.js';
import { LaneRenderer, LANE_AREA_Y, LANE_HEIGHT, ENDPOINT_X } from './LaneRenderer.js';
import { CarRenderer }     from './CarRenderer.js';
import { ShooterRenderer } from './ShooterRenderer.js';

import { DragDrop }        from '../input/DragDrop.js';
import { InputManager }    from '../input/InputManager.js';

import { GameState }       from '../game/GameState.js';
import { GameLoop }        from '../game/GameLoop.js';
import { CombatResolver }  from '../game/CombatResolver.js';

import { CarDirector }     from '../director/CarDirector.js';
import { ShooterDirector } from '../director/ShooterDirector.js';
import { FairnessArbiter } from '../director/FairnessArbiter.js';
import { IntensityPhase }  from '../director/IntensityPhase.js';
import { SeededRandom }    from '../utils/SeededRandom.js';
import { Lane }            from '../models/Lane.js';
import { Column }          from '../models/Column.js';
import { WORLD_CONFIG, PHASE_CONFIG } from '../director/DirectorConfig.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const APP_W          = 390;
const APP_H          = 844;
const LEVEL_DURATION = 90;
const COLORS         = ['Red', 'Blue'];
const LANE_COUNT     = 4;
const COL_COUNT      = 4;

// ── Combo display ─────────────────────────────────────────────────────────────

const COMBO_COLORS = [0xffffff, 0xffffff, 0xffee44, 0xffcc00, 0xff8800, 0xff4400];

function makeComboText(parent) {
  const t = new Text({
    text: '',
    style: { fontSize: 28, fontWeight: 'bold', fill: 0xffffff,
             dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.8 } },
  });
  t.anchor.set(0.5, 0.5);
  t.x = APP_W / 2;
  t.y = 22;       // centre of 44px HUD bar
  parent.addChild(t);
  return t;
}

function updateComboText(comboText, combo) {
  if (combo < 2) {
    comboText.text  = '';
    comboText.alpha = 0;
    return;
  }
  const idx   = Math.min(combo - 1, COMBO_COLORS.length - 1);
  comboText.style.fill  = COMBO_COLORS[idx];
  comboText.style.fontSize = Math.min(22 + combo * 3, 42);
  comboText.text  = `×${combo} COMBO!`;
  comboText.alpha = 1;
  comboText.scale.set(1.25);  // brief pop — eases back each frame
}

// ── Floating chain-hit labels ─────────────────────────────────────────────────

const CHAIN_HIT_STYLE = {
  fontSize:   26,
  fontWeight: 'bold',
  fill:       0xffdd00,
  dropShadow: { color: 0x000000, blur: 6, distance: 2, alpha: 0.9 },
};

function spawnChainHit(parent, laneIdx) {
  const x = ENDPOINT_X / 2 + (Math.random() - 0.5) * 60;
  const y = LANE_AREA_Y + laneIdx * LANE_HEIGHT + LANE_HEIGHT / 2;
  const t = new Text({ text: 'CHAIN HIT!', style: CHAIN_HIT_STYLE });
  t.anchor.set(0.5);
  t.x     = x;
  t.y     = y;
  t.alpha = 1;
  parent.addChild(t);
  return { sprite: t, vy: -55, life: 1.0 };
}

function tickFloatingTexts(texts, dt) {
  for (let i = texts.length - 1; i >= 0; i--) {
    const ft    = texts[i];
    ft.life    -= dt;
    ft.sprite.y += ft.vy * dt;
    ft.sprite.alpha = Math.max(0, ft.life);
    if (ft.life <= 0) {
      ft.sprite.destroy();
      texts.splice(i, 1);
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

  // ── Layers ───────────────────────────────────────────────────────────────
  const layers = new LayerManager(app.stage);
  new LaneRenderer(layers, APP_W);

  // ── Directors ────────────────────────────────────────────────────────────
  const rng        = new SeededRandom(1);
  const arbiter    = new FairnessArbiter();
  const carDir     = new CarDirector({}, rng);
  const shooterDir = new ShooterDirector({}, rng, arbiter);
  const phaseMan   = new IntensityPhase(LEVEL_DURATION);

  // ── Game state ───────────────────────────────────────────────────────────
  const lanes   = Array.from({ length: LANE_COUNT }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: COL_COUNT },  (_, id) => new Column({ id }));

  const gs = new GameState({
    lanes, columns, colors: COLORS, world: WORLD_CONFIG[1],
    duration: LEVEL_DURATION, phaseMan,
  });

  // ── Combat ───────────────────────────────────────────────────────────────
  const combatResolver = new CombatResolver();

  // ── HUD / FX display objects ─────────────────────────────────────────────
  const comboText    = makeComboText(layers.get('hudLayer'));
  const floatingTexts = [];

  // ── Game loop (logic, fixed 60fps) ───────────────────────────────────────
  const gameLoop = new GameLoop({
    app, gameState: gs, carDir, shooterDir,
    combatResolver, rng,
    onKill: (combo) => updateComboText(comboText, combo),
    onChainHit: (laneIdx) => {
      floatingTexts.push(
        spawnChainHit(layers.get('particleLayer'), laneIdx)
      );
    },
  });

  // Prime initial cars + columns before starting the loop.
  phaseMan.update(0);
  const calmCfg = PHASE_CONFIG['CALM'];
  for (const lane of lanes) {
    const car    = carDir.generateCar(lane, 'CALM', gs.world, gs.colors);
    car.position = rng.nextFloat(8, 50);
    lane.addCar(car);
    carDir.resetSpawnTimer(lane, calmCfg);
  }
  shooterDir.fillColumns(columns, gs.asDirectorState(), phaseMan.getParams());

  gameLoop.start();

  // ── Renderers ────────────────────────────────────────────────────────────
  const carRenderer     = new CarRenderer(layers, lanes);
  const shooterRenderer = new ShooterRenderer(layers, columns);

  // ── Input ────────────────────────────────────────────────────────────────
  const dragDrop = new DragDrop(
    layers, columns, shooterRenderer,
    (colIdx, laneIdx) => gameLoop.deploy(colIdx, laneIdx),
  );
  new InputManager(app, dragDrop);

  // ── Render ticker (variable rate) ────────────────────────────────────────
  // Logic already ran in gameLoop's ticker (added first).
  // This ticker only updates visuals — it never mutates game state.
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);

    carRenderer.update();
    shooterRenderer.update(gs.elapsed);
    dragDrop.update(dt);

    // Ease combo text scale back to 1
    if (comboText.scale.x > 1) {
      const s = comboText.scale.x - dt * 4;
      comboText.scale.set(Math.max(1, s));
    }

    tickFloatingTexts(floatingTexts, dt);
  });
}

main();
