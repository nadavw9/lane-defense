// _l40-loss-timing.mjs — diagnostic: which gauntlet stage do L40 losses land in?
// GAME_DESIGN §3c L40: "watch the sim's loss timing (should skew to stage 3),
// not just the win-rate". Probes CarDirector.setProgress (the same kill-progress
// feed the spawnScript stages key on) to capture progress at the moment of loss.
// Run: node scripts/_l40-loss-timing.mjs

import { SimulationRunner } from '../src/simulation/SimulationRunner.js';
import { LevelManager } from '../src/game/LevelManager.js';
import { CarDirector } from '../src/director/CarDirector.js';

const origSetProgress = CarDirector.prototype.setProgress;
let lastProgress = 0;
CarDirector.prototype.setProgress = function (pct) {
  lastProgress = Math.max(0, Math.min(1, pct ?? 0));
  return origSetProgress.call(this, pct);
};

const lm = new LevelManager();
lm.goToLevel(40);
const cfg = lm.current;
const runner = new SimulationRunner({
  duration: cfg.duration, colors: cfg.colors, worldConfig: cfg.worldConfig,
  levelId: 40, skill: 'average', laneCount: cfg.laneCount, colCount: cfg.colCount,
  laneTargetCarCount: cfg.laneTargetCarCount, spawnBudget: cfg.spawnBudget,
  gridRows: cfg.gridRows, goals: cfg.goals ?? [],
  initialCars: cfg.initialCars ?? null, spawnScript: cfg.spawnScript ?? null,
});

const RUNS = 500;
let wins = 0;
const lossStage = { 'stage1 (0-33% bike swarm)': 0, 'stage2 (33-66% truck wall)': 0, 'stage3 (66-100% pincer)': 0 };
for (let s = 0; s < RUNS; s++) {
  lastProgress = 0;
  const r = runner.runLevel(1 + s);
  if (r.won) { wins++; continue; }
  if (lastProgress <= 0.33) lossStage['stage1 (0-33% bike swarm)']++;
  else if (lastProgress <= 0.66) lossStage['stage2 (33-66% truck wall)']++;
  else lossStage['stage3 (66-100% pincer)']++;
}

const losses = RUNS - wins;
console.log(`L40 @ hp=${cfg.worldConfig.hpMultiplier}: ${((wins / RUNS) * 100).toFixed(1)}% wins, ${losses} losses`);
for (const [k, v] of Object.entries(lossStage)) {
  console.log(`  ${k}: ${v} (${losses ? ((v / losses) * 100).toFixed(0) : 0}% of losses)`);
}
