// GameApp — PixiJS bootstrap and render loop.
//
// Responsibilities:
//   • Create all subsystems (directors, game state, loop, renderers, input)
//   • Run the RENDER ticker (variable rate, reads GameState, never writes it)
//   • Manage level progression via LevelManager (FTUE L1→L2→L4→standard)
//   • Show FTUEOverlay dim mask + tutorial arrow for early levels
//   • Route end-of-game events to WinScreen / RescueOverlay
//
// Data flow:
//   InputManager → DragDrop → GameLoop.deploy() → GameState mutation
//   GameState → CarRenderer / ShooterRenderer / HUDRenderer / ParticleSystem
import { Application, Text } from 'pixi.js';

import { LayerManager }    from './LayerManager.js';
import { LaneRenderer, LANE_AREA_Y, LANE_HEIGHT, ENDPOINT_X } from './LaneRenderer.js';
import { CarRenderer }     from './CarRenderer.js';
import { ShooterRenderer } from './ShooterRenderer.js';
import { HUDRenderer }     from './HUDRenderer.js';
import { ParticleSystem }  from './ParticleSystem.js';

import { DragDrop }        from '../input/DragDrop.js';
import { InputManager }    from '../input/InputManager.js';

import { GameState }       from '../game/GameState.js';
import { GameLoop }        from '../game/GameLoop.js';
import { CombatResolver }  from '../game/CombatResolver.js';
import { LevelManager }    from '../game/LevelManager.js';

import { CarDirector }     from '../director/CarDirector.js';
import { ShooterDirector } from '../director/ShooterDirector.js';
import { FairnessArbiter } from '../director/FairnessArbiter.js';
import { IntensityPhase }  from '../director/IntensityPhase.js';
import { SeededRandom }    from '../utils/SeededRandom.js';
import { Lane }            from '../models/Lane.js';
import { Column }          from '../models/Column.js';
import { PHASE_CONFIG }    from '../director/DirectorConfig.js';

import { WinScreen }      from '../screens/WinScreen.js';
import { RescueOverlay }  from '../screens/RescueOverlay.js';
import { FTUEOverlay }    from '../screens/FTUEOverlay.js';
import { AudioManager }   from '../audio/AudioManager.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const APP_W      = 390;
const APP_H      = 844;
const TOTAL_LANES = 4;
const TOTAL_COLS  = 4;

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

  // ── Level manager — determines active lane/col count, HP, speed, duration ─
  const levelManager = new LevelManager();
  const initialCfg   = levelManager.current;

  // ── Fixed arrays: always 4 lanes and 4 columns ───────────────────────────
  // Renderers iterate all 4; only activeLanes/activeCols are used by game logic.
  const lanes   = Array.from({ length: TOTAL_LANES }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: TOTAL_COLS },  (_, id) => new Column({ id }));

  // ── Game state ───────────────────────────────────────────────────────────
  const phaseMan = new IntensityPhase(initialCfg.duration);

  const gs = new GameState({
    lanes,
    columns,
    colors:    initialCfg.colors,
    world:     initialCfg.worldConfig,
    duration:  initialCfg.duration,
    phaseMan,
    laneCount: initialCfg.laneCount,
    colCount:  initialCfg.colCount,
  });

  // ── Combat ───────────────────────────────────────────────────────────────
  const combatResolver = new CombatResolver();

  // ── Audio ─────────────────────────────────────────────────────────────────
  const audio = new AudioManager();

  // ── HUD + Particles ───────────────────────────────────────────────────────
  const hudRenderer   = new HUDRenderer(layers, gs, APP_W, audio);
  const particles     = new ParticleSystem(layers);
  const floatingTexts = [];

  // ── FTUE overlay (dim mask + tutorial arrow) ──────────────────────────────
  // Recreated on each level change; null when full-board with no FTUE needed.
  let ftueOverlay = _makeFTUEOverlay(app.stage, APP_W, APP_H, initialCfg);

  // ── End-of-game screens (created lazily on demand) ────────────────────────
  let winScreen     = null;
  let rescueOverlay = null;

  // Stage shake state — triggered on breach.
  let shakeTime = 0;

  // ── Level advancement ─────────────────────────────────────────────────────
  function applyLevelConfig(cfg) {
    gs.activeLaneCount = cfg.laneCount;
    gs.activeColCount  = cfg.colCount;
    gs.colors          = cfg.colors;
    gs.world           = cfg.worldConfig;
    // Recreate phaseMan so transition boundaries fit the new duration.
    gs.phaseMan        = new IntensityPhase(cfg.duration);
    gameLoop.baseDuration = cfg.duration;
  }

  function advanceLevel() {
    const cfg = levelManager.advance();
    ftueOverlay?.destroy();
    ftueOverlay = _makeFTUEOverlay(app.stage, APP_W, APP_H, cfg);
    applyLevelConfig(cfg);
    gameLoop.restart();
  }

  // ── Screen helpers ────────────────────────────────────────────────────────
  function showWin() {
    winScreen = new WinScreen(app.stage, APP_W, APP_H, gs, () => {
      winScreen.destroy();
      winScreen = null;
      advanceLevel();
    });
  }

  function showRescue() {
    rescueOverlay = new RescueOverlay(app.stage, APP_W, APP_H, gs, {
      onRescueAd: () => {
        gs.rescue(10);
        rescueOverlay.destroy();
        rescueOverlay = null;
      },
      onRescueCoins: () => {
        gs.coins -= 50;
        gs.rescue(10);
        rescueOverlay.destroy();
        rescueOverlay = null;
      },
      onRetry: () => {
        rescueOverlay.destroy();
        rescueOverlay = null;
        gameLoop.restart();
      },
    });
  }

  // ── Game loop (logic, fixed 60fps) ───────────────────────────────────────
  const gameLoop = new GameLoop({
    app, gameState: gs, carDir, shooterDir,
    combatResolver, rng,

    onKill: (combo) => {
      hudRenderer.bumpCombo(combo);
      if (combo === 4 || combo === 7 || combo === 11) {
        audio.play('combo_milestone', { combo });
      }
    },

    onChainHit: (laneIdx) => {
      floatingTexts.push(spawnChainHit(layers.get('particleLayer'), laneIdx));
    },

    onShoot: (damage) => {
      audio.play('shoot', { damage });
      // Hide tutorial hint on the player's first deploy.
      ftueOverlay?.onFirstDeploy();
    },

    onHit: (laneIdx, gameX, color, damage, isKill) => {
      particles.spawnHit(laneIdx, gameX, color);
      particles.spawnDamageNumber(laneIdx, gameX, damage);
      if (isKill) {
        particles.spawnExplosion(laneIdx, gameX, color);
        audio.play('car_destroy');
      } else {
        audio.play('hit_match');
      }
    },

    onMiss: (laneIdx, gameX) => {
      particles.spawnMiss(laneIdx, gameX);
      audio.play('hit_miss');
    },

    onEnd: (won, laneIdx) => {
      if (won) {
        showWin();
      } else {
        shakeTime = 0.35;
        showRescue();
      }
    },
  });

  // Prime initial cars + columns for the starting level.
  phaseMan.update(0);
  const calmCfg = PHASE_CONFIG['CALM'];
  for (const lane of gs.activeLanes) {
    const car    = carDir.generateCar(lane, 'CALM', gs.world, gs.colors);
    car.position = rng.nextFloat(8, 50);
    lane.addCar(car);
    carDir.resetSpawnTimer(lane, calmCfg);
  }
  shooterDir.fillColumns(gs.activeCols, gs.asDirectorState(), phaseMan.getParams());

  gameLoop.start();

  // ── Renderers ────────────────────────────────────────────────────────────
  const carRenderer     = new CarRenderer(layers, lanes);
  const shooterRenderer = new ShooterRenderer(layers, columns);

  // ── Input ────────────────────────────────────────────────────────────────
  const dragDrop = new DragDrop(
    layers, columns, shooterRenderer,
    (colIdx, laneIdx) => {
      // Reject drags outside the active subset — inactive areas are dimmed
      // and should not be interactive.
      if (colIdx >= gs.activeColCount || laneIdx >= gs.activeLaneCount) return;
      gameLoop.deploy(colIdx, laneIdx);
    },
  );
  new InputManager(app, dragDrop);

  // ── Render ticker (variable rate) ────────────────────────────────────────
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);

    hudRenderer.update(dt);
    particles.update(dt);
    carRenderer.update();
    shooterRenderer.update(gs.elapsed);
    dragDrop.update(dt);

    tickFloatingTexts(floatingTexts, dt);

    // Screen shake on breach
    if (shakeTime > 0) {
      shakeTime = Math.max(0, shakeTime - dt);
      const mag = (shakeTime / 0.35) * 7;
      app.stage.x = (Math.random() - 0.5) * 2 * mag;
      app.stage.y = (Math.random() - 0.5) * 2 * mag;
    } else {
      app.stage.x = 0;
      app.stage.y = 0;
    }

    if (rescueOverlay) rescueOverlay.update(dt);
    if (ftueOverlay)   ftueOverlay.update(dt);
  });
}

// Create an FTUEOverlay only when the level needs one (FTUE levels with
// fewer than 4 lanes/cols, or with a tutorial arrow).
function _makeFTUEOverlay(stage, w, h, cfg) {
  if (cfg.laneCount >= 4 && cfg.colCount >= 4 && !cfg.showArrow) return null;
  return new FTUEOverlay(stage, w, h, cfg);
}

main();
