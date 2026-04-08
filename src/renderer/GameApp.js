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
import { BenchStorage }    from '../game/BenchStorage.js';
import { BenchRenderer }   from './BenchRenderer.js';

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
import { Analytics }              from '../analytics/Analytics.js';

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

// Spawn a short-lived floating text centred horizontally at (x, y).
function spawnFloatingText(parent, x, y, text, color = 0xffffff) {
  const t = new Text({
    text,
    style: {
      fontSize:   18,
      fontWeight: 'bold',
      fill:       color,
      dropShadow: { color: 0x000000, blur: 5, distance: 2, alpha: 0.9 },
    },
  });
  t.anchor.set(0.5);
  t.x     = x;
  t.y     = y;
  t.alpha = 1;
  parent.addChild(t);
  return { sprite: t, vy: -30, life: 1.2 };
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

  // ── Analytics (fire-and-forget, anonymous) ────────────────────────────────
  const analytics = new Analytics();
  analytics.recordSessionStart();

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
    boosterState.swap   = saved.swap;
    boosterState.peek   = saved.peek;
    boosterState.freeze = saved.freeze ?? 0;
  }

  // ── Bench storage + renderer ──────────────────────────────────────────────
  const benchStorage  = new BenchStorage();
  const benchRenderer = new BenchRenderer(layers, benchStorage, APP_W);

  // ── HUD + Particles + juice effects ───────────────────────────────────────
  const hudRenderer   = new HUDRenderer(layers, gs, APP_W, audio);
  hudRenderer.setLevel(levelManager.levelNumber);
  const particles     = new ParticleSystem(layers);
  const floatingTexts = [];
  const laneFlash     = new LaneFlash(layers);
  const comboGlow     = new ComboGlow(layers, APP_W, APP_H);
  const boosterBar    = new BoosterBar(
    layers, boosterState, gs, APP_W,
    () => { audio.play('booster_activate'); boosterState.activateSwap(); boostersUsedThisLevel.push('swap'); },
    () => { audio.play('booster_activate'); boosterState.activatePeek(gs.elapsed); boostersUsedThisLevel.push('peek'); },
    () => { audio.play('booster_activate'); boosterState.activateFreeze(gs.elapsed); boostersUsedThisLevel.push('freeze'); },
  );

  // ── Per-level booster tracking (for analytics) ───────────────────────────
  let boostersUsedThisLevel = [];

  // ── Per-level tutorial state ───────────────────────────────────────────────
  let firstDeployTooltipShown = false;
  let firstKillDoneThisLevel  = false;

  // ── Combo popup ────────────────────────────────────────────────────────────
  let comboPopup      = null;
  let comboPopupTimer = 0;

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
    // L14 first-visit: grant 2 free freeze charges if player has none.
    const savedBoosters = progress.getBoosters();
    if (levelId === 14 && savedBoosters.freeze === 0) {
      progress.setBoosters(savedBoosters.swap, savedBoosters.peek, 2);
      savedBoosters.freeze = 2;
    }
    boosterState.swap        = savedBoosters.swap;
    boosterState.peek        = savedBoosters.peek;
    boosterState.freeze      = savedBoosters.freeze ?? 0;
    boosterState.swapMode    = false;
    boosterState.swapFirst   = -1;
    boosterState.peekUntil   = -Infinity;
    boosterState.freezeUntil = -Infinity;

    applyLevelConfig(cfg);
    hudRenderer.setLevel(levelManager.levelNumber);
    ftueOverlay = _makeFTUEOverlay(app.stage, APP_W, APP_H, cfg);

    // Feature gating: show/hide bench and booster buttons based on level id.
    const benchUnlocked  = levelId >= 6;
    const swapUnlocked   = levelId >= 8;
    const peekUnlocked   = levelId >= 12;
    const freezeUnlocked = levelId >= 14;
    benchStorage.reset();  // always reset bench
    benchRenderer.setVisible(benchUnlocked);
    boosterBar.setButtonVisibility(swapUnlocked, peekUnlocked, freezeUnlocked);

    boostersUsedThisLevel       = [];
    firstDeployTooltipShown     = false;
    firstKillDoneThisLevel      = false;
    carRenderer.clearAll();

    // Start the game-loop ticker exactly once; restart() resets state each time.
    if (!gameLoopStarted) {
      gameLoopStarted = true;
      gameLoop.start();
    }
    gameLoop.resume();   // un-pause if coming from a Quit
    gameLoop.restart();

    pauseBtn.visible = true;

    // Start gameplay music from CALM; phase updates will crossfade as needed.
    audio.resetMusicPhase();
    audio.playMusic('gameplay_calm');
    audio.play('level_start');

    // Restore accumulated coins AFTER restart() (which zeros gs.coins).
    gs.coins = progress.coins;
  }

  // ── Screen: Title ─────────────────────────────────────────────────────────
  function showTitle() {
    pauseBtn.visible = false;
    audio.playMusic('title');
    titleScreen = new TitleScreen(app.stage, APP_W, APP_H, {
      onPlay: () => {
        titleScreen?.destroy();
        titleScreen = null;
        showLevelSelect();
      },
      onDaily:        () => { showDailyReward(); },
      hasDailyReward: progress.canClaimDaily(),
      onSettings: () => {
        showSettings(() => {
          settingsScreen.destroy();
          settingsScreen = null;
        });
      },
      audio,
    });
  }

  // ── Screen: Daily Reward ──────────────────────────────────────────────────
  function showDailyReward() {
    dailyRewardScreen = new DailyRewardScreen(app.stage, APP_W, APP_H, progress, {
      onClose: () => {
        dailyRewardScreen.destroy();
        dailyRewardScreen = null;
        if (titleScreen) {
          titleScreen.destroy();
          titleScreen = null;
          showTitle();
        }
      },
      audio,
    });
  }

  // ── Screen: Level Select ──────────────────────────────────────────────────
  function showLevelSelect() {
    pauseBtn.visible = false;
    audio.playMusic('title');   // title pad plays on all meta screens
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
      audio,
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
      audio,
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
      audio,
    });
  }

  // ── Screen: Win ───────────────────────────────────────────────────────────
  function showWin() {
    pauseBtn.visible = false;
    audio.stopMusic();
    // Delay fanfare slightly so the screen fade-in completes first.
    setTimeout(() => audio.play('win_fanfare'), 300);
    const levelId = levelManager.levelNumber;
    const stars   = calcStars(gs);

    // Persist: stars, unlocked level, coins, boosters used this level.
    progress.recordWin(levelId, stars);
    progress.setCoins(gs.coins);
    progress.setBoosters(boosterState.swap, boosterState.peek, boosterState.freeze);

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
      audio,
    );
  }

  // ── Screen: Rescue ────────────────────────────────────────────────────────
  function showRescue() {
    pauseBtn.visible = false;
    audio.play('rescue_offer');
    rescueOverlay = new RescueOverlay(app.stage, APP_W, APP_H, gs, {
      onRescueAd: () => {
        gs.rescue(10);
        gameLoop.shuffleForRescue();
        rescueOverlay.destroy();
        rescueOverlay = null;
        audio.resetMusicPhase();
        audio.playMusic('gameplay_calm');
        pauseBtn.visible = true;
      },
      onRescueCoins: () => {
        gs.coins -= 50;
        progress.setCoins(gs.coins);
        gs.rescue(10);
        gameLoop.shuffleForRescue();
        rescueOverlay.destroy();
        rescueOverlay = null;
        audio.resetMusicPhase();
        audio.playMusic('gameplay_calm');
        pauseBtn.visible = true;
      },
      onRetry: () => {
        rescueOverlay.destroy();
        rescueOverlay = null;
        gs.coins = progress.coins;
        carRenderer.clearAll();
        gameLoop.resume();
        gameLoop.restart();
        gs.coins = progress.coins;
        audio.resetMusicPhase();
        audio.playMusic('gameplay_calm');
        pauseBtn.visible = true;
      },
    });
  }

  // ── Game loop ─────────────────────────────────────────────────────────────
  const gameLoop = new GameLoop({
    app, gameState: gs, carDir, shooterDir,
    combatResolver, rng, boosterState, benchStorage,

    onKill: (combo) => {
      hudRenderer.bumpCombo(combo);
      if (combo === 4 || combo === 7 || combo === 11) {
        audio.play('combo_milestone', { combo });
      }

      // L2: notify FTUE overlay on first kill so it can show the combo hint.
      if (!firstKillDoneThisLevel) {
        firstKillDoneThisLevel = true;
        ftueOverlay?.onFirstKill();
      }

      // One-time combo explanation popup the first time combo reaches 3.
      if (combo >= 3 && !comboPopup && !progress.seenComboTip) {
        comboPopup      = _buildComboPopup(layers.get('hudLayer'), APP_W);
        comboPopupTimer = 3;
      }
    },

    onChainHit: (laneIdx) => {
      floatingTexts.push(spawnChainHit(layers.get('particleLayer'), laneIdx));
    },

    onShoot: (damage, laneIdx, colIdx) => {
      audio.play('shoot', { damage });

      // On very first deploy: dismiss arrow hint and (for L1-L5) show damage tooltip.
      const tipDamage = (!firstDeployTooltipShown && levelManager.levelNumber <= 5)
        ? damage : undefined;
      firstDeployTooltipShown = true;
      ftueOverlay?.onFirstDeploy(tipDamage);

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
      // 'rescue' = first breach (rescue still available)
      // 'lose'   = breach after rescue already used (true final loss)
      // 'win'    = timer ran out
      const result = won ? 'win' : (gs.rescueUsed ? 'lose' : 'rescue');
      analytics.recordSession({
        levelId:        levelManager.levelNumber,
        result,
        duration:       gs.elapsed,
        deploys:        gs.totalDeploys,
        correctDeploys: gs.correctDeploys,
        wrongDeploys:   gs.wrongDeploys,
        maxCombo:       gs.maxCombo,
        carsKilled:     gs.totalKills,
        carryOvers:     gs.carryOvers,
        rescueUsed:     gs.rescueUsed,
        boostersUsed:   [...boostersUsedThisLevel],
        benchUsed:      gs.benchUsed,
      });

      if (won) {
        showWin();
      } else {
        audio.stopMusic();
        audio.play('lose_tone');
        shakeTime = 0;
        breachCam = { laneIdx: laneIdx ?? 0, t: 0, done: false };
      }
    },
  });

  // ── Input ────────────────────────────────────────────────────────────────
  const dragDrop = new DragDrop(
    layers, columns, gs.lanes, benchStorage, shooterRenderer, benchRenderer,
    {
      onDeploy: (colIdx, laneIdx) => {
        if (colIdx >= gs.activeColCount || laneIdx >= gs.activeLaneCount) return;
        gameLoop.deploy(colIdx, laneIdx);
      },
      onDeployFromBench: (shooter, laneIdx) => {
        if (laneIdx >= gs.activeLaneCount) return;
        gameLoop.deployFromBench(shooter, laneIdx);
      },
      onBenchStore: (_colIdx) => {
        // Column refills automatically via ShooterDirector next tick.
        // No audio currently — bench storage is a silent action.
      },
      onColorMismatch: () => {
        audio.play('hit_miss');
      },
      onBenchFull: () => {
        audio.play('hit_miss');
        floatingTexts.push(spawnFloatingText(
          layers.get('particleLayer'),
          APP_W / 2, 700,
          'BENCH FULL', 0xff6644,
        ));
      },
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
    carRenderer.update(dt, boosterState.isFrozen(gs.elapsed));
    shooterRenderer.update(gs.elapsed, dt);
    benchRenderer.update();
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

    // Combo explanation popup — auto-dismiss after 3 s.
    if (comboPopup) {
      comboPopupTimer -= dt;
      if (comboPopupTimer < 1) comboPopup.alpha = Math.max(0, comboPopupTimer);
      if (comboPopupTimer <= 0) {
        comboPopup.destroy({ children: true });
        comboPopup = null;
        progress.markSeenComboTip();
      }
    }
    if (levelSelectScreen) levelSelectScreen.update(dt);

    // Phase-based music transitions during active gameplay only.
    if (gameLoopStarted && !gameLoop.paused && !gs.isOver) {
      audio.updateMusicPhase(gs.phase);
    }
  });

  // ── Boot: show title screen (game loop not started yet) ───────────────────
  showTitle();
}

function _makeFTUEOverlay(stage, w, h, cfg) {
  if (cfg.laneCount >= 4 && cfg.colCount >= 4 && !cfg.showArrow && !cfg.hintText && !cfg.showAreaLabels) return null;
  return new FTUEOverlay(stage, w, h, cfg);
}

function _buildComboPopup(layer, w) {
  const grp = new Container();

  const bg = new Graphics();
  bg.roundRect(30, 0, w - 60, 64, 14);
  bg.fill({ color: 0x1a0800, alpha: 0.92 });
  bg.roundRect(30, 0, w - 60, 64, 14);
  bg.stroke({ color: 0xff9922, width: 2, alpha: 0.85 });
  grp.addChild(bg);

  const title = new Text({
    text: 'COMBO ×3!',
    style: { fontSize: 20, fontWeight: 'bold', fill: 0xffcc22,
      dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.9 } },
  });
  title.anchor.set(0.5, 0);
  title.x = w / 2;
  title.y = 6;
  grp.addChild(title);

  const body = new Text({
    text: 'Chain kills for bonus coins and fire speed!',
    style: { fontSize: 13, fontWeight: 'bold', fill: 0xffe8aa, align: 'center',
      wordWrap: true, wordWrapWidth: w - 80,
      dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.9 } },
  });
  body.anchor.set(0.5, 0);
  body.x = w / 2;
  body.y = 32;
  grp.addChild(body);

  // Centre vertically between HUD and road
  grp.y = 44 + 12;
  layer.addChild(grp);
  return grp;
}

main();
