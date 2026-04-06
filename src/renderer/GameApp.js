// GameApp — PixiJS bootstrap and render loop.
//
// Responsibilities:
//   • Create all subsystems (directors, game state, loop, renderers, input)
//   • Run the RENDER ticker (variable rate, reads GameState, never writes it)
//   • Screen routing: Title → LevelSelect → Game → Win/Lose → LevelSelect
//   • Persist progress (stars, coins, boosters) to localStorage via ProgressManager
//   • Phase 3A juice: lane flash, deploy punch, car death, combo glow,
//     screen transitions, breach camera, Swap/Peek boosters
//
// Data flow:
//   InputManager → DragDrop → GameLoop.deploy() → GameState mutation
//   GameState → CarRenderer / ShooterRenderer / HUDRenderer / ParticleSystem
import { Application, Graphics, Text } from 'pixi.js';

import { LayerManager }    from './LayerManager.js';
import { LaneRenderer, laneCenterX, posToScreenY, ROAD_BOTTOM_Y } from './LaneRenderer.js';
import { CarRenderer }     from './CarRenderer.js';
import { ShooterRenderer } from './ShooterRenderer.js';
import { HUDRenderer }     from './HUDRenderer.js';
import { ParticleSystem }  from './ParticleSystem.js';
import { LaneFlash }       from './LaneFlash.js';
import { ComboGlow }       from './ComboGlow.js';

import { DragDrop }        from '../input/DragDrop.js';
import { InputManager }    from '../input/InputManager.js';

import { GameState }       from '../game/GameState.js';
import { GameLoop }        from '../game/GameLoop.js';
import { CombatResolver }  from '../game/CombatResolver.js';
import { LevelManager }    from '../game/LevelManager.js';
import { BoosterState }    from '../game/BoosterState.js';
import { ProgressManager } from '../game/ProgressManager.js';

import { CarDirector }     from '../director/CarDirector.js';
import { ShooterDirector } from '../director/ShooterDirector.js';
import { FairnessArbiter } from '../director/FairnessArbiter.js';
import { IntensityPhase }  from '../director/IntensityPhase.js';
import { SeededRandom }    from '../utils/SeededRandom.js';
import { Lane }            from '../models/Lane.js';
import { Column }          from '../models/Column.js';
import { PHASE_CONFIG }    from '../director/DirectorConfig.js';

import { WinScreen, calcStars }   from '../screens/WinScreen.js';
import { RescueOverlay }          from '../screens/RescueOverlay.js';
import { FTUEOverlay }            from '../screens/FTUEOverlay.js';
import { TransitionOverlay }      from '../screens/TransitionOverlay.js';
import { TitleScreen }            from '../screens/TitleScreen.js';
import { LevelSelectScreen }      from '../screens/LevelSelectScreen.js';
import { ShopScreen }             from '../screens/ShopScreen.js';
import { DailyRewardScreen }      from '../screens/DailyRewardScreen.js';
import { SettingsScreen }         from '../screens/SettingsScreen.js';
import { PauseScreen }            from '../screens/PauseScreen.js';
import { AudioManager }           from '../audio/AudioManager.js';
import { BoosterBar }             from './BoosterBar.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const APP_W       = 390;
const APP_H       = 844;
const TOTAL_LANES = 4;
const TOTAL_COLS  = 4;

// Breach camera: zoom toward the breaching lane for this many seconds before
// showing the rescue overlay.
const BREACH_CAM_DURATION = 0.50; // seconds
const BREACH_CAM_ZOOM     = 0.08; // fraction over 1.0 (8% zoom-in at peak)

// ── Floating chain-hit labels ─────────────────────────────────────────────────

const CHAIN_HIT_STYLE = {
  fontSize:   26,
  fontWeight: 'bold',
  fill:       0xffdd00,
  dropShadow: { color: 0x000000, blur: 6, distance: 2, alpha: 0.9 },
};

function spawnChainHit(parent, laneIdx) {
  // Spawn near the front of the lane (near the breach line at position ~85)
  const x = laneCenterX(laneIdx, 0.85) + (Math.random() - 0.5) * 40;
  const y = posToScreenY(85);
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
    const ft     = texts[i];
    ft.life     -= dt;
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

  // ── Fit canvas to viewport (scale-to-fit, preserving 390×844 aspect) ─────
  // Without this, body's `align-items: center` clips the top of the canvas
  // (and the HUD) whenever the browser window is shorter than APP_H pixels.
  const _fitCanvas = () => {
    const scale = Math.min(window.innerWidth / APP_W, window.innerHeight / APP_H);
    app.canvas.style.width  = `${APP_W * scale}px`;
    app.canvas.style.height = `${APP_H * scale}px`;
  };
  _fitCanvas();
  window.addEventListener('resize', _fitCanvas);

  // ── Progress (localStorage) ──────────────────────────────────────────────
  const progress = new ProgressManager();

  // ── Layers ───────────────────────────────────────────────────────────────
  const layers = new LayerManager(app.stage);
  new LaneRenderer(layers, APP_W);

  // ── Directors ────────────────────────────────────────────────────────────
  const rng        = new SeededRandom(1);
  const arbiter    = new FairnessArbiter();
  const carDir     = new CarDirector({}, rng);
  const shooterDir = new ShooterDirector({}, rng, arbiter);

  // ── Level manager ─────────────────────────────────────────────────────────
  const levelManager = new LevelManager();
  const initialCfg   = levelManager.current;

  // ── Fixed arrays: always 4 lanes and 4 columns ───────────────────────────
  const lanes   = Array.from({ length: TOTAL_LANES }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: TOTAL_COLS },  (_, id) => new Column({ id }));

  // ── Game state ───────────────────────────────────────────────────────────
  const phaseMan = new IntensityPhase(initialCfg.duration);
  const gs = new GameState({
    lanes, columns,
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

  // ── Boosters — init from saved inventory ──────────────────────────────────
  const boosterState = new BoosterState();
  {
    const saved = progress.getBoosters();
    boosterState.swap = saved.swap;
    boosterState.peek = saved.peek;
  }

  // ── HUD + Particles + juice effects ───────────────────────────────────────
  const hudRenderer   = new HUDRenderer(layers, gs, APP_W, audio);
  hudRenderer.setLevel(levelManager.levelNumber);
  const particles     = new ParticleSystem(layers);
  const floatingTexts = [];
  const laneFlash     = new LaneFlash(layers);
  const comboGlow     = new ComboGlow(layers, APP_W, APP_H);
  const boosterBar    = new BoosterBar(
    layers, boosterState, gs, APP_W,
    () => { boosterState.activateSwap(); },
    () => { boosterState.activatePeek(gs.elapsed); },
  );

  // ── FTUE overlay ──────────────────────────────────────────────────────────
  let ftueOverlay = null;  // created in _startLevel

  // ── End-of-game screens ───────────────────────────────────────────────────
  let winScreen     = null;
  let rescueOverlay = null;

  // ── Meta screens ─────────────────────────────────────────────────────────
  let titleScreen        = null;
  let levelSelectScreen  = null;
  let shopScreen         = null;
  let dailyRewardScreen  = null;
  let settingsScreen     = null;
  let pauseScreen        = null;

  // ── Transition overlay (always topmost) ───────────────────────────────────
  const transition = new TransitionOverlay(app.stage, APP_W, APP_H);

  // ── Pause button (|| icon, top-right of HUD, shown during gameplay) ──────
  const pauseBtn = (() => {
    const HIT = 40;           // tap-target size
    const g   = new Graphics();
    // Background pill
    g.roundRect(0, 0, HIT, HIT, 8);
    g.fill({ color: 0x000000, alpha: 0.40 });
    // Two vertical bars of the || symbol
    g.rect(10, 10, 6, 20);
    g.fill({ color: 0xffffff, alpha: 0.90 });
    g.rect(24, 10, 6, 20);
    g.fill({ color: 0xffffff, alpha: 0.90 });
    g.x       = APP_W - HIT - 4;
    g.y       = 2;
    g.eventMode = 'static';
    g.cursor    = 'pointer';
    g.visible   = false;
    g.on('pointerdown', () => showPause());
    g.on('pointerover',  () => { g.alpha = 0.70; });
    g.on('pointerout',   () => { g.alpha = 1.00; });
    layers.get('hudLayer').addChild(g);
    return g;
  })();

  // ── Stage effects ─────────────────────────────────────────────────────────
  let shakeTime = 0;
  let breachCam = null;       // null | { laneIdx, t, done }

  // ── Game-loop flag — start() called only once ─────────────────────────────
  let gameLoopStarted = false;

  // ── Renderers ────────────────────────────────────────────────────────────
  const carRenderer     = new CarRenderer(layers, lanes);
  const shooterRenderer = new ShooterRenderer(layers, columns, boosterState);

  // ── Level config helper ───────────────────────────────────────────────────
  function applyLevelConfig(cfg) {
    gs.activeLaneCount    = cfg.laneCount;
    gs.activeColCount     = cfg.colCount;
    gs.colors             = cfg.colors;
    gs.world              = cfg.worldConfig;
    gs.phaseMan           = new IntensityPhase(cfg.duration);
    gameLoop.baseDuration = cfg.duration;
  }

  // ── Core level-start routine ──────────────────────────────────────────────
  // Called both for first play and for every subsequent level.
  function _startLevel(levelId) {
    // Tear down any lingering overlay screens.
    winScreen?.destroy();      winScreen      = null;
    rescueOverlay?.destroy();  rescueOverlay  = null;
    ftueOverlay?.destroy();    ftueOverlay    = null;

    levelManager.goToLevel(levelId);
    const cfg = levelManager.current;

    // Restore persistent booster inventory for this level.
    const savedBoosters = progress.getBoosters();
    boosterState.swap      = savedBoosters.swap;
    boosterState.peek      = savedBoosters.peek;
    boosterState.swapMode  = false;
    boosterState.swapFirst = -1;
    boosterState.peekUntil = -Infinity;

    applyLevelConfig(cfg);
    hudRenderer.setLevel(levelManager.levelNumber);
    ftueOverlay = _makeFTUEOverlay(app.stage, APP_W, APP_H, cfg);

    carRenderer.clearAll();

    // Start the game-loop ticker exactly once; restart() resets state each time.
    if (!gameLoopStarted) {
      gameLoopStarted = true;
      gameLoop.start();
    }
    gameLoop.resume();   // un-pause if coming from a Quit
    gameLoop.restart();

    pauseBtn.visible = true;

    // Restore accumulated coins AFTER restart() (which zeros gs.coins).
    gs.coins = progress.coins;
  }

  // ── Screen: Title ─────────────────────────────────────────────────────────
  function showTitle() {
    pauseBtn.visible = false;
    titleScreen = new TitleScreen(app.stage, APP_W, APP_H, {
      onPlay: () => {
        titleScreen.destroy();
        titleScreen = null;
        showLevelSelect();
      },
      onDaily: () => {
        showDailyReward();
      },
      hasDailyReward: progress.canClaimDaily(),
      onSettings: () => {
        showSettings(() => {
          settingsScreen.destroy();
          settingsScreen = null;
          // TitleScreen is still underneath — no rebuild needed.
        });
      },
    });
  }

  // ── Screen: Daily Reward ──────────────────────────────────────────────────
  function showDailyReward() {
    dailyRewardScreen = new DailyRewardScreen(app.stage, APP_W, APP_H, progress, {
      onClose: () => {
        dailyRewardScreen.destroy();
        dailyRewardScreen = null;
        // Rebuild title so the reward badge reflects the new claim state.
        if (titleScreen) {
          titleScreen.destroy();
          titleScreen = null;
          showTitle();
        }
      },
    });
  }

  // ── Screen: Level Select ──────────────────────────────────────────────────
  function showLevelSelect() {
    pauseBtn.visible = false;
    levelSelectScreen = new LevelSelectScreen(app.stage, APP_W, APP_H, progress, {
      onSelectLevel: (levelId) => {
        levelSelectScreen.destroy();
        levelSelectScreen = null;
        transition.fadeOut(0.25, () => {
          _startLevel(levelId);
          transition.fadeIn(0.25, null);
        });
      },
      onBack: () => {
        levelSelectScreen.destroy();
        levelSelectScreen = null;
        showTitle();
      },
      onShop: () => {
        levelSelectScreen.destroy();
        levelSelectScreen = null;
        showShop();
      },
    });
  }

  // ── Screen: Shop ──────────────────────────────────────────────────────────
  function showShop() {
    shopScreen = new ShopScreen(app.stage, APP_W, APP_H, progress, boosterState, {
      onBack: () => {
        shopScreen.destroy();
        shopScreen = null;
        showLevelSelect();
      },
    });
  }

  // ── Screen: Settings ─────────────────────────────────────────────────────
  // onClose is provided by the caller so the same screen works from both
  // the title gear and the in-game pause menu.
  function showSettings(onClose) {
    settingsScreen = new SettingsScreen(app.stage, APP_W, APP_H, audio, { onClose });
  }

  // ── Screen: Pause ─────────────────────────────────────────────────────────
  function showPause() {
    gameLoop.pause();
    pauseBtn.visible = false;
    pauseScreen = new PauseScreen(app.stage, APP_W, APP_H, {
      onResume: () => {
        pauseScreen.destroy();
        pauseScreen   = null;
        pauseBtn.visible = true;
        gameLoop.resume();
      },
      onSettings: () => {
        pauseScreen.destroy();
        pauseScreen = null;
        showSettings(() => {
          settingsScreen.destroy();
          settingsScreen = null;
          showPause();   // rebuild pause screen on settings close
        });
      },
      onQuit: () => {
        pauseScreen.destroy();
        pauseScreen = null;
        // Leave gameLoop paused — _startLevel() will resume it.
        transition.fadeOut(0.25, () => {
          showLevelSelect();
          transition.fadeIn(0.25, null);
        });
      },
    });
  }

  // ── Screen: Win ───────────────────────────────────────────────────────────
  function showWin() {
    pauseBtn.visible = false;
    const levelId = levelManager.levelNumber;
    const stars   = calcStars(gs);

    // Persist: stars, unlocked level, coins, boosters used this level.
    progress.recordWin(levelId, stars);
    progress.setCoins(gs.coins);
    progress.setBoosters(boosterState.swap, boosterState.peek);

    winScreen = new WinScreen(
      app.stage, APP_W, APP_H, gs,

      // ── Next Level ──────────────────────────────────────────────────────
      () => {
        winScreen.destroy();
        winScreen = null;
        const nextId = Math.min(20, levelId + 1);
        transition.fadeOut(0.30, () => {
          _startLevel(nextId);
          transition.fadeIn(0.30, null);
        });
      },

      // ── Menu (Level Select) ─────────────────────────────────────────────
      () => {
        winScreen.destroy();
        winScreen = null;
        transition.fadeOut(0.25, () => {
          showLevelSelect();
          transition.fadeIn(0.25, null);
        });
      },
    );
  }

  // ── Screen: Rescue ────────────────────────────────────────────────────────
  function showRescue() {
    pauseBtn.visible = false;
    rescueOverlay = new RescueOverlay(app.stage, APP_W, APP_H, gs, {
      onRescueAd: () => {
        gs.rescue(10);
        rescueOverlay.destroy();
        rescueOverlay = null;
      },
      onRescueCoins: () => {
        gs.coins -= 50;
        progress.setCoins(gs.coins);  // persist the deduction
        gs.rescue(10);
        rescueOverlay.destroy();
        rescueOverlay = null;
      },
      onRetry: () => {
        rescueOverlay.destroy();
        rescueOverlay = null;
        // Restore coins to saved state — level earnings are lost on retry.
        gs.coins = progress.coins;
        carRenderer.clearAll();
        gameLoop.resume();
        gameLoop.restart();
        gs.coins = progress.coins;
        pauseBtn.visible = true;
      },
    });
  }

  // ── Game loop ─────────────────────────────────────────────────────────────
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

    onShoot: (damage, laneIdx, colIdx) => {
      audio.play('shoot', { damage });
      ftueOverlay?.onFirstDeploy();
      if (laneIdx >= 0) laneFlash.flash(laneIdx);
      if (colIdx  >= 0) shooterRenderer.triggerDeployPunch(colIdx);
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
        shakeTime = 0;
        breachCam = { laneIdx: laneIdx ?? 0, t: 0, done: false };
      }
    },
  });

  // ── Input ────────────────────────────────────────────────────────────────
  const dragDrop = new DragDrop(
    layers, columns, shooterRenderer,
    (colIdx, laneIdx) => {
      if (colIdx >= gs.activeColCount || laneIdx >= gs.activeLaneCount) return;
      gameLoop.deploy(colIdx, laneIdx);
    },
    boosterState,
  );
  new InputManager(app, dragDrop);

  // ── Render ticker (variable rate) ────────────────────────────────────────
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);

    // Juice updates
    laneFlash.update(dt);
    comboGlow.update(dt, gs.combo);
    boosterBar.update();
    transition.update(dt);

    // Core renderer updates
    hudRenderer.update(dt);
    particles.update(dt);
    carRenderer.update(dt);
    shooterRenderer.update(gs.elapsed, dt);
    dragDrop.update(dt);

    tickFloatingTexts(floatingTexts, dt);

    // ── Breach camera ──────────────────────────────────────────────────────
    if (breachCam && !breachCam.done) {
      breachCam.t += dt;
      const prog    = Math.min(1, breachCam.t / BREACH_CAM_DURATION);
      const zoomAmt = BREACH_CAM_ZOOM * Math.sin(Math.PI * prog);
      const scale   = 1 + zoomAmt;
      const pivotX  = APP_W / 2;
      const pivotY  = ROAD_BOTTOM_Y;

      app.stage.scale.set(scale);
      app.stage.pivot.set(pivotX, pivotY);
      app.stage.position.set(pivotX, pivotY);

      if (breachCam.t >= BREACH_CAM_DURATION) {
        breachCam.done = true;
        app.stage.scale.set(1);
        app.stage.pivot.set(0, 0);
        app.stage.position.set(0, 0);
        showRescue();
      }
    } else {
      if (shakeTime > 0) {
        shakeTime = Math.max(0, shakeTime - dt);
        const mag = (shakeTime / 0.35) * 7;
        app.stage.x = (Math.random() - 0.5) * 2 * mag;
        app.stage.y = (Math.random() - 0.5) * 2 * mag;
      } else {
        app.stage.x = 0;
        app.stage.y = 0;
      }
    }

    if (rescueOverlay)    rescueOverlay.update(dt);
    if (ftueOverlay)      ftueOverlay.update(dt);
    if (levelSelectScreen) levelSelectScreen.update(dt);
  });

  // ── Boot: show title screen (game loop not started yet) ───────────────────
  showTitle();
}

function _makeFTUEOverlay(stage, w, h, cfg) {
  if (cfg.laneCount >= 4 && cfg.colCount >= 4 && !cfg.showArrow) return null;
  return new FTUEOverlay(stage, w, h, cfg);
}

main();
