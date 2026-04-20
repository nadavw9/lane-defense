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
import { Application, Assets, Container, Graphics, Text } from 'pixi.js';

import { GameRenderer3D }  from '../renderer3d/GameRenderer3D.js';
import { LayerManager }    from './LayerManager.js';
import { LaneRenderer, laneCenterX, posToScreenY, ROAD_BOTTOM_Y } from './LaneRenderer.js';
import { spriteFlags }     from './SpriteFlags.js';
import { CityBackground }  from './CityBackground.js';
import { CarRenderer }     from './CarRenderer.js';
import { ShooterRenderer } from './ShooterRenderer.js';
import { HUDRenderer }     from './HUDRenderer.js';
import { ParticleSystem }  from './ParticleSystem.js';
import { LaneFlash }       from './LaneFlash.js';
import { ComboGlow }       from './ComboGlow.js';

import { FiringLineRenderer } from './FiringLineRenderer.js';
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
import { LivesManager }    from '../game/LivesManager.js';
import { HapticsManager }  from '../game/HapticsManager.js';
import { setColorblindMode } from '../game/ColorblindMode.js';

import { CarDirector }     from '../director/CarDirector.js';
import { ShooterDirector } from '../director/ShooterDirector.js';
import { FairnessArbiter } from '../director/FairnessArbiter.js';
import { IntensityPhase }  from '../director/IntensityPhase.js';
import { SeededRandom }    from '../utils/SeededRandom.js';
import { Lane }            from '../models/Lane.js';
import { Column }          from '../models/Column.js';
import { PHASE_CONFIG }    from '../director/DirectorConfig.js';

import { WinScreen, calcStars }       from '../screens/WinScreen.js';
import { LoseScreen }                  from '../screens/LoseScreen.js';
import { RescueOverlay }              from '../screens/RescueOverlay.js';
import { BoosterUnlockScreen }        from '../screens/BoosterUnlockScreen.js';
import { FTUEOverlay }            from '../screens/FTUEOverlay.js';
import { TransitionOverlay }      from '../screens/TransitionOverlay.js';
import { TitleScreen }            from '../screens/TitleScreen.js';
import { LevelSelectScreen }      from '../screens/LevelSelectScreen.js';
import { ShopScreen }             from '../screens/ShopScreen.js';
import { DailyRewardScreen }      from '../screens/DailyRewardScreen.js';
import { SettingsScreen }         from '../screens/SettingsScreen.js';
import { PauseScreen }            from '../screens/PauseScreen.js';
import { AchievementsScreen }     from '../screens/AchievementsScreen.js';
import { StatsScreen }            from '../screens/StatsScreen.js';
import { SurvivalScreen }          from '../screens/SurvivalScreen.js';
import { AudioManager }           from '../audio/AudioManager.js';
import { BoosterBar }             from './BoosterBar.js';
import { Analytics }              from '../analytics/Analytics.js';
import { AutoTuner }             from '../analytics/AutoTuner.js';
import { AchievementManager }     from '../game/AchievementManager.js';
import { DailyChallengeManager }  from '../game/DailyChallengeManager.js';

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

// ── Sprite manifest ───────────────────────────────────────────────────────────

const COLORS   = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const _B       = import.meta.env.BASE_URL;   // '' in dev, '/lane-defense/' on GH Pages
const CAR_URLS = [
  ...COLORS.map(c => `${_B}sprites/cars/car-${c}.png`),
  `${_B}sprites/cars/car-boss.png`,
];
const SHOOTER_URLS = COLORS.flatMap(c => [
  `${_B}sprites/shooters/shooter-${c}-idle.png`,
  `${_B}sprites/shooters/shooter-${c}-fire.png`,
]);
const ALL_SPRITE_URLS = [...CAR_URLS, ...SHOOTER_URLS];

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
  const app = new Application();
  await app.init({
    width:           APP_W,
    height:          APP_H,
    background:      'transparent',   // Three.js canvas provides the game background
    backgroundAlpha: 0,
    antialias:       true,
    resolution:      window.devicePixelRatio || 1,
    autoDensity:     true,
  });
  document.body.appendChild(app.canvas);

  // ── Fit canvas to viewport ────────────────────────────────────────────────
  // (Declared early so the loading screen is already correctly sized.)
  const _fitCanvas = () => {
    const scale = Math.min(window.innerWidth / APP_W, window.innerHeight / APP_H);
    app.canvas.style.width  = `${APP_W * scale}px`;
    app.canvas.style.height = `${APP_H * scale}px`;
  };
  _fitCanvas();
  window.addEventListener('resize', _fitCanvas);

  // ── Loading screen ────────────────────────────────────────────────────────
  const loadBg = new Graphics();
  loadBg.rect(0, 0, APP_W, APP_H);
  loadBg.fill(0x060610);
  app.stage.addChild(loadBg);

  const loadText = new Text({
    text: 'Loading...',
    style: { fontSize: 28, fontWeight: 'bold', fill: 0x44ff88,
      dropShadow: { color: 0x00cc44, blur: 16, distance: 0, alpha: 0.7 } },
  });
  loadText.anchor.set(0.5);
  loadText.x = APP_W / 2;
  loadText.y = APP_H / 2;
  app.stage.addChild(loadText);

  // Preload all sprite textures before any renderer is created.
  // If loading fails (corrupt files, 404s, etc.) the game falls back to
  // programmatic Graphics — spriteFlags.loaded stays false.
  try {
    await Assets.load(ALL_SPRITE_URLS);
    spriteFlags.loaded = true;
  } catch (e) {
    console.warn('[GameApp] Sprite loading failed — using programmatic graphics fallback.', e);
  }

  loadBg.destroy();
  loadText.destroy();

  // ── Analytics (fire-and-forget, anonymous) ────────────────────────────────
  const analytics = new Analytics();
  analytics.recordSessionStart();

  // ── Progress (localStorage) ──────────────────────────────────────────────
  const progress = new ProgressManager();

  // ── Lives + Haptics + Colorblind ─────────────────────────────────────────
  const livesManager = new LivesManager(progress);
  livesManager.tick();   // credit any regenerated hearts immediately

  const haptics = new HapticsManager();
  haptics.enabled = progress.hapticsEnabled;

  // Apply saved colorblind preference immediately on startup.
  setColorblindMode(progress.colorblindMode);

  // Touch login streak (for title screen badge + achievements).
  const streakResult = progress.touchLoginStreak();
  const loginStreak  = streakResult.count;

  // Weekly featured playlist — same 3 levels for all players this week.
  const weeklyPlaylist = dailyChallengeManager.getWeeklyPlaylist();

  // Offline coin reward — computed once on startup; shown after title appears.
  const offlineReward = progress.claimOfflineReward();

  // ── Layers ───────────────────────────────────────────────────────────────
  const layers      = new LayerManager(app.stage);
  const laneRenderer = new LaneRenderer(layers, APP_W);
  const cityBg       = new CityBackground(layers, APP_W);

  // ── 3D Renderer — replaces LaneRenderer + CityBackground during gameplay ─
  const gameRenderer3D = new GameRenderer3D(APP_W, APP_H);
  gameRenderer3D.init();
  gameRenderer3D.hide();   // hidden until gameplay starts

  // Keep 3D canvas in sync when the window resizes.
  window.addEventListener('resize', () => gameRenderer3D.onResize());

  // ── Vignette — dark edge overlay drawn once above all game layers ─────────
  // Two passes per edge (different alpha/width) for a soft gradient feel.
  const vigG = new Graphics();
  const VW = 70, VH = 80, VA1 = 0.22, VA2 = 0.10;
  // Left / right
  vigG.rect(0,        0, VW,      APP_H); vigG.fill({ color: 0x000000, alpha: VA1 });
  vigG.rect(0,        0, VW * .5, APP_H); vigG.fill({ color: 0x000000, alpha: VA2 });
  vigG.rect(APP_W-VW, 0, VW,      APP_H); vigG.fill({ color: 0x000000, alpha: VA1 });
  vigG.rect(APP_W-VW*.5, 0, VW*.5, APP_H); vigG.fill({ color: 0x000000, alpha: VA2 });
  // Top / bottom
  vigG.rect(0, 0,        APP_W, VH);     vigG.fill({ color: 0x000000, alpha: VA1 });
  vigG.rect(0, 0,        APP_W, VH*.5);  vigG.fill({ color: 0x000000, alpha: VA2 });
  vigG.rect(0, APP_H-VH, APP_W, VH);    vigG.fill({ color: 0x000000, alpha: VA1 });
  vigG.rect(0, APP_H-VH*.5, APP_W, VH*.5); vigG.fill({ color: 0x000000, alpha: VA2 });
  app.stage.addChild(vigG);

  // ── Directors ────────────────────────────────────────────────────────────
  const rng        = new SeededRandom(1);
  const arbiter    = new FairnessArbiter();
  const carDir     = new CarDirector({}, rng);
  const shooterDir = new ShooterDirector({}, rng, arbiter);

  // ── Level manager ─────────────────────────────────────────────────────────
  const levelManager = new LevelManager();

  // AutoTuner: load cached modifiers from localStorage, then fetch fresh data
  // from Firebase in the background.  Never blocks startup.
  const autoTuner = new AutoTuner();
  levelManager.setAutoTuner(autoTuner);
  autoTuner.startFetch();

  const initialCfg = levelManager.current;

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

  // ── Pass stable game-data refs to 3D renderer ─────────────────────────────
  // lanes, columns, and gs.firingSlots are stable array objects; their
  // contents change each frame but the refs never change.
  gameRenderer3D.setGameData(lanes, columns, gs.firingSlots);

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
  let winScreen      = null;
  let rescueOverlay  = null;
  let unlockScreen   = null;

  // ── Meta screens ─────────────────────────────────────────────────────────
  let titleScreen        = null;
  let levelSelectScreen  = null;
  let survivalScreen     = null;
  let survivalWave       = 1;   // current survival wave (increments on each wave win)
  let shopScreen         = null;
  let dailyRewardScreen  = null;
  let settingsScreen     = null;
  let pauseScreen        = null;
  let achievementsScreen = null;
  let statsScreen        = null;

  // ── Achievement system ────────────────────────────────────────────────────
  const achievementManager    = new AchievementManager(progress);
  const dailyChallengeManager = new DailyChallengeManager();
  const achievementQueue      = [];    // pending popup notifications
  let   activeAchievementPopup  = null;
  let   activeAchievementTimer  = 0;

  // ── Per-level daily/no-rescue flags ───────────────────────────────────────
  let currentLevelIsDaily  = false;
  let noRescueThisLevel    = false;
  let isSurvivalRun        = false;
  let dailyDateKey         = '';
  let coinsAtLevelStart    = 0;

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
  const carRenderer        = new CarRenderer(layers, lanes);
  const shooterRenderer    = new ShooterRenderer(layers, columns, boosterState);
  const firingLineRenderer = new FiringLineRenderer(layers, gs.firingSlots);

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
  // Called both for normal levels (levelId: number) and for the daily challenge
  // (levelIdOrConfig: full config object with isDaily:true).
  function _startLevel(levelIdOrConfig) {
    // Tear down any lingering overlay screens.
    winScreen?.destroy();      winScreen      = null;
    rescueOverlay?.destroy();  rescueOverlay  = null;
    ftueOverlay?.destroy();    ftueOverlay    = null;
    unlockScreen?.destroy();   unlockScreen   = null;

    // Resolve config from either a number or a pre-built config object.
    let cfg;
    let levelId;
    if (typeof levelIdOrConfig === 'object' && levelIdOrConfig !== null) {
      cfg     = levelIdOrConfig;
      levelId = 'daily';
    } else {
      levelManager.goToLevel(levelIdOrConfig);
      cfg     = levelManager.current;
      levelId = levelIdOrConfig;
    }

    currentLevelIsDaily = cfg.isDaily  ?? false;
    noRescueThisLevel   = cfg.noRescue ?? false;
    isSurvivalRun       = cfg.isSurvival ?? false;
    dailyDateKey        = currentLevelIsDaily ? dailyChallengeManager.getTodayKey() : '';

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
    // Use levelNumber for normal levels; 'D' label for daily challenge.
    hudRenderer.setLevel(currentLevelIsDaily ? 'D' : levelManager.levelNumber);
    ftueOverlay = _makeFTUEOverlay(app.stage, APP_W, APP_H, cfg);

    // Feature gating: daily challenge unlocks everything; normal levels gate by id.
    const benchUnlocked  = currentLevelIsDaily || levelId >= 6;
    const swapUnlocked   = currentLevelIsDaily || levelId >= 8;
    const peekUnlocked   = currentLevelIsDaily || levelId >= 12;
    const freezeUnlocked = currentLevelIsDaily || levelId >= 14;
    benchStorage.reset();
    benchRenderer.setVisible(benchUnlocked);
    boosterBar.setButtonVisibility(swapUnlocked, peekUnlocked, freezeUnlocked);

    boostersUsedThisLevel       = [];
    firstDeployTooltipShown     = false;
    firstKillDoneThisLevel      = false;
    carRenderer.clearAll();
    firingLineRenderer.reset();
    gameRenderer3D.resetLevel();
    gameRenderer3D.setCombo(0);

    // Start the game-loop ticker exactly once; restart() resets state each time.
    if (!gameLoopStarted) {
      gameLoopStarted = true;
      gameLoop.start();
    }
    gameLoop.resume();   // un-pause if coming from a Quit
    gameLoop.restart();

    pauseBtn.visible = true;

    // ── Booster unlock popup (once per feature, normal levels only) ───────────
    const UNLOCK_LEVELS = [6, 8, 12, 14];
    if (!currentLevelIsDaily && UNLOCK_LEVELS.includes(levelId) && !progress.hasSeenUnlock(levelId)) {
      gameLoop.pause();
      unlockScreen = new BoosterUnlockScreen(app.stage, APP_W, APP_H, levelId, {
        onPlay: () => {
          progress.markSeenUnlock(levelId);
          unlockScreen?.destroy();
          unlockScreen = null;
          gameLoop.resume();
        },
      });
    }

    // Start gameplay music from CALM; phase updates will crossfade as needed.
    audio.resetMusicPhase();
    audio.playMusic('gameplay_calm');
    audio.play('level_start');

    // Restore accumulated coins AFTER restart() (which zeros gs.coins).
    gs.coins         = progress.coins;
    coinsAtLevelStart = progress.coins;

    // ── Level intro splash ("LEVEL X" bounce-in) ──────────────────────────
    if (typeof levelIdOrConfig === 'number') {
      _showLevelIntroSplash(levelManager.levelNumber);
    }

    // ── Switch to 3D renderer for gameplay ────────────────────────────────
    layers.get('backgroundLayer').visible = false;
    layers.get('laneLayer').visible       = false;
    layers.get('carLayer').visible        = false;
    gameRenderer3D.show();
  }

  // ── Level intro splash ("LEVEL X" bounce-in, 1.5 s) ─────────────────────
  function _showLevelIntroSplash(levelNumber) {
    const c    = new Container();
    app.stage.addChild(c);

    // Semi-dark background flash
    const flash = new Graphics();
    flash.rect(0, 0, APP_W, APP_H);
    flash.fill({ color: 0x000000, alpha: 0.40 });
    c.addChild(flash);

    const txt = new Text({
      text: `LEVEL ${levelNumber}`,
      style: {
        fontSize:   52,
        fontWeight: 'bold',
        fill:       0xffffff,
        dropShadow: { color: 0x00cc44, blur: 20, distance: 0, alpha: 0.8 },
      },
    });
    txt.anchor.set(0.5, 0.5);
    txt.x     = APP_W / 2;
    txt.y     = APP_H / 2;
    txt.scale.set(0.3);
    txt.alpha = 0;
    c.addChild(txt);

    let t = 0;
    const unsub = app.ticker.add((ticker) => {
      t += ticker.deltaMS / 1000;
      if (t < 0.25) {
        const prog = t / 0.25;
        const e    = 1 - Math.pow(1 - prog, 3);
        txt.scale.set(0.3 + e * 0.7 + (prog < 0.5 ? (0.5 - prog) * 0.3 : 0));
        txt.alpha  = prog;
        flash.alpha = 0.40 * (1 - prog * 0.5);
      } else if (t < 1.0) {
        txt.scale.set(1); txt.alpha = 1; flash.alpha = 0;
      } else if (t < 1.35) {
        txt.alpha = 1 - (t - 1.0) / 0.35;
      } else {
        app.ticker.remove(unsub);
        c.destroy({ children: true });
      }
    });
  }

  // ── Screen: Title ─────────────────────────────────────────────────────────
  function showTitle() {
    pauseBtn.visible = false;
    audio.playMusic('title');
    // Return to 2D environment layers when leaving gameplay.
    gameRenderer3D.hide();
    layers.get('backgroundLayer').visible = true;
    layers.get('laneLayer').visible       = true;
    layers.get('carLayer').visible        = true;
    titleScreen = new TitleScreen(app.stage, APP_W, APP_H, {
      onPlay: () => {
        titleScreen?.destroy();
        titleScreen = null;
        showLevelSelect();
      },
      onDaily:            () => { showDailyReward(); },
      hasDailyReward:     progress.canClaimDaily(),
      onDailyChallenge:   () => { startDailyChallenge(); },
      onAchievements:     () => { showAchievements(() => { achievementsScreen?.destroy(); achievementsScreen = null; showTitle(); }); },
      onStats:            () => { showStats(); },
      loginStreak:        progress.loginStreak,
      onSurvival: () => {
        titleScreen?.destroy(); titleScreen = null;
        showSurvival();
      },
      onSettings: () => {
        showSettings(() => {
          settingsScreen.destroy();
          settingsScreen = null;
        });
      },
      audio,
    });
  }

  // ── Screen: Survival ─────────────────────────────────────────────────────
  function showSurvival() {
    survivalWave  = 1;
    survivalScreen = new SurvivalScreen(app.stage, APP_W, APP_H, {
      progress,
      audio,
      onBack: () => {
        survivalScreen?.destroy(); survivalScreen = null;
        showTitle();
      },
      onStart: () => {
        survivalScreen?.destroy(); survivalScreen = null;
        const cfg = { ...LevelManager.getSurvivalConfig(survivalWave), isSurvival: true };
        transition.fadeOut(0.25, () => { _startLevel(cfg); transition.fadeIn(0.25, null); });
      },
    });
  }

  // ── Screen: Daily Reward ──────────────────────────────────────────────────
  function showDailyReward() {
    dailyRewardScreen = new DailyRewardScreen(app.stage, APP_W, APP_H, progress, {
      onClose: () => {
        dailyRewardScreen.destroy();
        dailyRewardScreen = null;
        // Check if the daily_claim achievement was just earned.
        const newAch = achievementManager.check('daily_claim');
        newAch.forEach(a => achievementQueue.push(a));
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
  // ── No Hearts panel ─────────────────────────────────────────────────────
  // Shown when player tries to start a level with 0 hearts.
  function _showNoHeartsPanel() {
    const c = new Container();
    app.stage.addChild(c);

    const backdrop = new Graphics();
    backdrop.rect(0, 0, APP_W, APP_H);
    backdrop.fill({ color: 0x000000, alpha: 0.75 });
    backdrop.eventMode = 'static';
    c.addChild(backdrop);

    const PW = 300, PH = 260, px = (APP_W - PW) / 2, py = (APP_H - PH) / 2 - 20;
    const panel = new Graphics();
    panel.roundRect(px, py, PW, PH, 18);
    panel.fill({ color: 0x1a0510, alpha: 0.97 });
    panel.roundRect(px, py, PW, PH, 18);
    panel.stroke({ color: 0xff4466, width: 2, alpha: 0.6 });
    c.addChild(panel);

    const cx = APP_W / 2;
    let cy = py + 44;

    const addT = (text, x, y, style) => {
      const t = new Text({ text, style: { fontWeight: 'bold', ...style } });
      t.anchor.set(0.5, 0.5); t.x = x; t.y = y;
      c.addChild(t);
    };

    addT('OUT OF HEARTS', cx, cy, { fontSize: 24, fill: 0xff4466 });
    cy += 34;

    // Hearts row
    for (let i = 0; i < 5; i++) {
      const hx = cx - 4 * 22 / 2 + i * 22;
      const ht = new Text({ text: '♥', style: { fontSize: 20, fill: 0x333344 } });
      ht.anchor.set(0.5, 0.5); ht.x = hx; ht.y = cy;
      c.addChild(ht);
    }
    cy += 32;

    // Timer until next heart
    const timerTxt = new Text({
      text: `Next heart in ${livesManager.formatTimeUntilNext()}`,
      style: { fontSize: 13, fill: 0x7799aa, fontWeight: 'normal' },
    });
    timerTxt.anchor.set(0.5, 0.5); timerTxt.x = cx; timerTxt.y = cy;
    c.addChild(timerTxt);

    // Update timer every second
    let timerInterval = setInterval(() => {
      livesManager.tick();
      if (livesManager.hasHearts()) {
        clearInterval(timerInterval);
        c.destroy({ children: true });
        return;
      }
      timerTxt.text = `Next heart in ${livesManager.formatTimeUntilNext()}`;
    }, 1000);

    cy += 40;

    // OK button
    const btn = new Graphics();
    btn.roundRect(-90, -22, 180, 44, 12); btn.fill(0x1a1a2e);
    btn.x = cx; btn.y = cy;
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    btn.on('pointerdown', () => {
      clearInterval(timerInterval);
      c.destroy({ children: true });
      audio.play('button_tap');
    });
    btn.on('pointerover', () => { btn.alpha = 0.78; });
    btn.on('pointerout',  () => { btn.alpha = 1.00; });
    const bt = new Text({ text: 'OK', style: { fontSize: 18, fontWeight: 'bold', fill: 0x88aacc } });
    bt.anchor.set(0.5, 0.5); btn.addChild(bt); c.addChild(btn);
  }

  function showLevelSelect() {
    pauseBtn.visible = false;
    audio.playMusic('title');
    livesManager.tick();   // credit any regenerated hearts before showing
    levelSelectScreen = new LevelSelectScreen(app.stage, APP_W, APP_H, progress, {
      onSelectLevel: (levelId) => {        // ── Hearts gate ────────────────────────────────────────────────────
        if (!livesManager.hasHearts()) {
          _showNoHeartsPanel();
          return;
        }
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
      onAchievements: () => {
        levelSelectScreen.destroy();
        levelSelectScreen = null;
        showAchievements(() => {
          achievementsScreen?.destroy();
          achievementsScreen = null;
          showLevelSelect();
        });
      },
      audio,
      weeklyLevels: weeklyPlaylist.levels,
    }, livesManager);
  }
  function showShop() {
    shopScreen = new ShopScreen(app.stage, APP_W, APP_H, progress, boosterState, {
      onBack: () => {
        shopScreen.destroy();
        shopScreen = null;
        showLevelSelect();
      },
      onPurchase: () => {
        const newAch = achievementManager.check('shop_purchase');
        newAch.forEach(a => achievementQueue.push(a));
      },
      audio,
    });
  }

  // ── Screen: Achievements ─────────────────────────────────────────────────
  function showAchievements(onBack) {
    pauseBtn.visible = false;
    audio.playMusic('title');
    achievementsScreen = new AchievementsScreen(app.stage, APP_W, APP_H, progress, {
      onBack,
      audio,
    });
  }

  // ── Screen: Stats ─────────────────────────────────────────────────────────
  function showStats() {
    pauseBtn.visible = false;
    audio.playMusic('title');
    titleScreen?.destroy();
    titleScreen = null;
    statsScreen = new StatsScreen(app.stage, APP_W, APP_H, {
      app,
      progressManager: progress,
      onBack: () => {
        statsScreen?.destroy();
        statsScreen = null;
        showTitle();
      },
      audio,
    });
    statsScreen.show();
  }

  // ── Daily Challenge ───────────────────────────────────────────────────────
  function startDailyChallenge() {
    titleScreen?.destroy();
    titleScreen = null;
    const cfg = dailyChallengeManager.getChallenge();
    transition.fadeOut(0.25, () => {
      _startLevel(cfg);
      transition.fadeIn(0.25, null);
    });
  }

  // ── Screen: Settings ─────────────────────────────────────────────────────
  // onClose is provided by the caller so the same screen works from both
  // the title gear and the in-game pause menu.
  function showSettings(onClose) {
    settingsScreen = new SettingsScreen(app.stage, APP_W, APP_H, audio, { onClose }, progress, haptics);
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

    // Persist coins and boosters.
    progress.setCoins(gs.coins);
    progress.setBoosters(boosterState.swap, boosterState.peek, boosterState.freeze);

    // Track coins earned this level for the Collector achievement.
    const coinsEarned = Math.max(0, gs.coins - coinsAtLevelStart);
    if (coinsEarned > 0) progress.addEarnedCoins(coinsEarned);
    const coinAch = achievementManager.check('coins_earned');
    coinAch.forEach(a => achievementQueue.push(a));

    // Level-end achievements.
    const endAch = achievementManager.check('level_end', {
      won:          true,
      totalDeploys: gs.totalDeploys,
      wrongDeploys: gs.wrongDeploys,
      elapsed:      gs.elapsed,
      rescueUsed:   gs.rescueUsed,
      boostersUsed: boostersUsedThisLevel.length > 0,
    });
    endAch.forEach(a => achievementQueue.push(a));

    let onNext;
    let improved   = [];
    let winLevelId = null;
    if (currentLevelIsDaily) {
      progress.completeDailyChallenge(dailyDateKey);
      const dcAch = achievementManager.check('daily_challenge');
      dcAch.forEach(a => achievementQueue.push(a));
      onNext = null;
    } else {
      const levelId = levelManager.levelNumber;
      const stars   = calcStars(gs);
      progress.recordWin(levelId, stars);

      // Weekly playlist bonus: +15 coins for winning a featured level this week.
      const { levels: featuredLevels, weekKey: wk } = weeklyPlaylist;
      if (featuredLevels.includes(levelId) && !progress.hasClaimedWeeklyLevel(levelId, wk)) {
        gs.coins += 15;
        progress.markClaimedWeeklyLevel(levelId, wk);
        floatingTexts.push(spawnFloatingText(
          layers.get('particleLayer'), APP_W / 2, APP_H / 2 - 60,
          '⭐ WEEKLY BONUS  +15', 0xffcc00,
        ));
        // weekly_hero achievement
        const weeklyAch = achievementManager.check('weekly_win');
        weeklyAch.forEach(a => achievementQueue.push(a));
      }
      // Update personal best and detect new records.
      improved   = progress.updateBestStats(levelId, { combo: gs.maxCombo, time: gs.elapsed, stars });
      winLevelId = levelId;
      onNext = () => {
        winScreen.destroy();
        winScreen = null;
        const nextId = Math.min(40, levelId + 1);
        transition.fadeOut(0.30, () => {
          _startLevel(nextId);
          transition.fadeIn(0.30, null);
        });
      };

      // Rating prompt: show after first ever 3-star win (native integration TBD in Phase 4).
      if (stars === 3 && !progress.ratingPromptShown) {
        progress.markRatingPromptShown();
      }
    }

    winScreen = new WinScreen(
      app.stage, APP_W, APP_H, gs,
      onNext,
      () => {
        winScreen.destroy();
        winScreen = null;
        transition.fadeOut(0.25, () => {
          showLevelSelect();
          transition.fadeIn(0.25, null);
        });
      },
      audio,
      improved,
      winLevelId,
    );
  } 
  function _showNoRescueLose() {
    pauseBtn.visible = false;
    audio.stopMusic();
    audio.play('lose_tone');

    let loseScreen = null;
    loseScreen = new LoseScreen(
      app.stage, APP_W, APP_H,
      {
        onRetry: () => {
          loseScreen?.destroy();
          loseScreen = null;
          rescueOverlay = null;
          const cfg = currentLevelIsDaily ? dailyChallengeManager.getChallenge() : levelManager.levelNumber;
          transition.fadeOut(0.20, () => { _startLevel(cfg); transition.fadeIn(0.20, null); });
        },
        onMenu: () => {
          loseScreen?.destroy();
          loseScreen = null;
          rescueOverlay = null;
          transition.fadeOut(0.20, () => { showLevelSelect(); transition.fadeIn(0.20, null); });
        },
        audio,
      },
      gs,
      livesManager.hearts,
    );

    // Reuse rescueOverlay slot so _startLevel cleans up correctly.
    rescueOverlay = {
      update(dt) { loseScreen?.update(dt); },
      destroy()  { loseScreen?.destroy(); loseScreen = null; },
    };
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
      gameRenderer3D.setCombo(combo);
      if (combo === 4 || combo === 7 || combo === 11) {
        audio.play('combo_milestone', { combo });
        haptics.comboMilestone();
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

      // Achievement checks for kill events.
      const killAch = achievementManager.check('kill', { combo });
      killAch.forEach(a => achievementQueue.push(a));
    },

    onChainHit: (laneIdx) => {
      floatingTexts.push(spawnChainHit(layers.get('particleLayer'), laneIdx));
      // chain_reaction achievement: 2+ kills from one shot.
      const chainAch = achievementManager.check('chain_kill');
      chainAch.forEach(a => achievementQueue.push(a));
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
      if (colIdx  >= 0) gameRenderer3D.triggerDeployPunch(colIdx);
      if (laneIdx >= 0) gameRenderer3D.onShoot(laneIdx);
      haptics.light();
    },

    onHit: (laneIdx, gameX, color, damage, isKill) => {
      particles.spawnHit(laneIdx, gameX, color);
      particles.spawnDamageNumber(laneIdx, gameX, damage);
      gameRenderer3D.onHit(laneIdx, color, damage, isKill);
      if (isKill) {
        particles.spawnExplosion(laneIdx, gameX, color);
        audio.play('car_destroy');
        haptics.killDouble();
      } else {
        audio.play('hit_match');
        haptics.medium();
      }
    },

    onMiss: (laneIdx, gameX) => {
      particles.spawnMiss(laneIdx, gameX);
      gameRenderer3D.onMiss(laneIdx);
      audio.play('hit_miss');
    },

    onEnd: (won, laneIdx) => {
      // 'lose'   = breach after rescue already used (true final loss)
      // 'win'    = timer ran out
      const result = won ? 'win' : (gs.rescueUsed ? 'lose' : 'rescue');
      analytics.recordSession({
        levelId:        currentLevelIsDaily ? 'daily' : levelManager.levelNumber,
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
        // ── Survival: wave complete — auto-advance to next wave ───────────
        if (currentLevelIsDaily === false && isSurvivalRun) {
          survivalWave++;
          progress.recordSurvivalRun(survivalWave - 1, gs.totalKills);
          const survivalAch = achievementManager.check('survival', { wave: survivalWave - 1 });
          survivalAch.forEach(a => achievementQueue.push(a));
          const nextWaveCfg = { ...LevelManager.getSurvivalConfig(survivalWave), isSurvival: true };
          transition.fadeOut(0.20, () => {
            _startLevel(nextWaveCfg);
            transition.fadeIn(0.20, null);
          });
        } else {
          showWin();
        }
      } else {
        audio.stopMusic();
        audio.play('lose_tone');
        shakeTime = 0;
        gameRenderer3D.onBreach();
        haptics.heavy();
        livesManager.loseHeart();
        // noRescue levels (e.g. Sudden Death daily challenge) skip the rescue panel.
        breachCam = { laneIdx: laneIdx ?? 0, t: 0, done: false, skipRescue: noRescueThisLevel };
      }
    },

    onCrisis: (colIdx) => {
      // CRISIS assist fired — a guaranteed-match shooter was injected at the
      // top of this column. Gold flash + sound cue to signal the cavalry arrived.
      gameRenderer3D.triggerCrisisGlow(colIdx);
      shooterRenderer.triggerCrisisFlash(colIdx);
      audio.play('crisis_assist');
      haptics.medium();
      floatingTexts.push(spawnFloatingText(
        layers.get('particleLayer'),
        (colIdx + 0.5) * (APP_W / 4), 560,
        '⚡ CRISIS ASSIST', 0xffcc00,
      ));
      progress.incrementCrisisAssists();
      const crisisAch = achievementManager.check('crisis_assist');
      crisisAch.forEach(a => achievementQueue.push(a));
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
        // progress.incrementBenchUses() was called inside deployFromBench.
        const benchAch = achievementManager.check('bench_deploy');
        benchAch.forEach(a => achievementQueue.push(a));
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
    firingLineRenderer,
    gs.firingSlots,
  );
  new InputManager(app, dragDrop);

  // ── Render ticker (variable rate) ────────────────────────────────────────
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);

    // 3D scene update + render (runs when gameRenderer3D is visible/active).
    gameRenderer3D.update({ lanes: gs.lanes, boosterState, isBreaching: gs.isOver && !gs.won }, dt, gs.elapsed);
    gameRenderer3D.render();

    // Background + road + overlay updates
    cityBg.update(gs.elapsed);
    laneRenderer.update(gs.elapsed);
    unlockScreen?.update(dt);

    // Juice updates
    laneFlash.update(dt);
    comboGlow.update(dt, gs.combo);
    boosterBar.update();
    transition.update(dt);

    // Core renderer updates
    hudRenderer.update(dt);
    hudRenderer.setHearts(livesManager.hearts);
    particles.update(dt);
    carRenderer.update(dt, boosterState.isFrozen(gs.elapsed));
    shooterRenderer.update(gs.elapsed, dt);
    benchRenderer.update();
    firingLineRenderer.update(dt);

    // Disable lane hover tints while any tutorial / combo / achievement overlay
    // is on screen so the colored lane flash doesn't bleed through the UI.
    dragDrop.uiOverlayActive = !!(ftueOverlay || comboPopup || activeAchievementPopup);

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
        if (breachCam.skipRescue) {
          _showNoRescueLose();
        } else {
          showRescue();
        }
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
    if (titleScreen)      titleScreen.update?.(dt);
    if (winScreen)        winScreen.update?.(dt);

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

    // ── Achievement popup queue ────────────────────────────────────────────
    if (activeAchievementPopup) {
      activeAchievementTimer -= dt;
      if (activeAchievementTimer < 1) activeAchievementPopup.alpha = Math.max(0, activeAchievementTimer);
      if (activeAchievementTimer <= 0) {
        activeAchievementPopup.destroy({ children: true });
        activeAchievementPopup = null;
      }
    } else if (achievementQueue.length > 0) {
      const ach = achievementQueue.shift();
      activeAchievementPopup = _buildAchievementPopup(layers.get('hudLayer'), APP_W, ach);
      activeAchievementTimer = 3.0;
    }

    // Phase-based music transitions during active gameplay only.
    if (gameLoopStarted && !gameLoop.paused && !gs.isOver) {
      audio.updateMusicPhase(gs.phase);
    }
  });

  // ── Boot: show title screen (game loop not started yet) ───────────────────
  showTitle();

  // ── Post-boot overlays (deferred so title is visible first) ───────────────

  // Streak master achievement — needs achievementManager which is declared later.
  {
    const sAch = achievementManager.check('login_streak', { streak: loginStreak });
    sAch.forEach(a => achievementQueue.push(a));
  }

  // Offline coin reward popup.
  if (offlineReward) {
    setTimeout(() => _showOfflineRewardPopup(app, offlineReward), 800);
  }

  // Streak shield offer: player's streak was reset but they have a shield.
  if (streakResult.wasReset && streakResult.prevCount >= 3 && progress.hasStreakShield()) {
    setTimeout(() => _showStreakShieldOffer(app, streakResult, progress), offlineReward ? 3500 : 800);
  }
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

function _buildAchievementPopup(layer, w, achievement) {
  const grp = new Container();

  const bg = new Graphics();
  bg.roundRect(18, 0, w - 36, 72, 14);
  bg.fill({ color: 0x120a00, alpha: 0.94 });
  bg.roundRect(18, 0, w - 36, 72, 14);
  bg.stroke({ color: 0xf5c842, width: 2, alpha: 0.90 });
  grp.addChild(bg);

  const label = new Text({
    text: 'ACHIEVEMENT UNLOCKED',
    style: { fontSize: 11, fontWeight: 'bold', fill: 0xf5c842, letterSpacing: 1.5 },
  });
  label.anchor.set(0.5, 0);
  label.x = w / 2;
  label.y = 8;
  grp.addChild(label);

  const name = new Text({
    text: achievement.name,
    style: { fontSize: 18, fontWeight: 'bold', fill: 0xffeebb,
      dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.8 } },
  });
  name.anchor.set(0.5, 0);
  name.x = w / 2;
  name.y = 24;
  grp.addChild(name);

  const desc = new Text({
    text: achievement.desc,
    style: { fontSize: 12, fill: 0xaa9966, fontWeight: 'normal' },
  });
  desc.anchor.set(0.5, 0);
  desc.x = w / 2;
  desc.y = 48;
  grp.addChild(desc);

  grp.y = 44 + 8;
  layer.addChild(grp);
  return grp;
}

main();

// ── Simple toast helper ────────────────────────────────────────────────────────
// Shows a timed banner at the top of the stage for 3.5 s then self-destructs.
// onMount (optional) is called immediately for any side-effects (e.g. shield use).
function _buildSimpleToast(app, w, message, bgColor, textColor, onMount) {
  onMount?.();
  const stage = app.stage;
  const grp = new Container();

  const PW = w - 40, PH = 72;
  const bg = new Graphics();
  bg.roundRect(20, 0, PW, PH, 14);
  bg.fill({ color: bgColor, alpha: 0.96 });
  bg.roundRect(20, 0, PW, PH, 14);
  bg.stroke({ color: textColor, width: 2, alpha: 0.70 });
  grp.addChild(bg);

  const txt = new Text({
    text: message,
    style: {
      fontSize:    16,
      fontWeight:  'bold',
      fill:        textColor,
      align:       'center',
      wordWrap:    true,
      wordWrapWidth: PW - 32,
      dropShadow:  { color: 0x000000, blur: 5, distance: 0, alpha: 0.8 },
    },
  });
  txt.anchor.set(0.5, 0.5);
  txt.x = w / 2;
  txt.y = PH / 2;
  grp.addChild(txt);

  grp.y = 50;
  stage.addChild(grp);

  const TOTAL = 3.5;
  let elapsed = 0;
  const unsub = app.ticker.add((ticker) => {
    elapsed += ticker.deltaMS / 1000;
    if (elapsed > TOTAL - 0.8) grp.alpha = Math.max(0, (TOTAL - elapsed) / 0.8);
    if (elapsed >= TOTAL) {
      app.ticker.remove(unsub);
      grp.destroy({ children: true });
    }
  });
}

// ── Offline reward popup ───────────────────────────────────────────────────────
function _showOfflineRewardPopup(app, reward) {
  const hours = Math.floor(reward.awayMin / 60);
  const mins  = reward.awayMin % 60;
  const away  = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  _buildSimpleToast(app, 390, `☁️ Away for ${away} — welcome back!  +${reward.coins} coins`, 0x0a1a08, 0x55ff99);
}

// ── Streak shield offer ────────────────────────────────────────────────────────
function _showStreakShieldOffer(app, streakResult, progress) {
  _buildSimpleToast(
    app, 390,
    `🛡 Streak shield activated! Your ${streakResult.prevCount}-day streak is safe.`,
    0x120820, 0xaa77ff,
    () => progress.useStreakShield(streakResult.prevCount),
  );
}
