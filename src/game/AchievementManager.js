// AchievementManager — stateless achievement checker.
// All state lives in ProgressManager; this class only contains definitions
// and the check() dispatch logic.
export const ACHIEVEMENTS = [
  { id: 'first_blood',   name: 'First Blood',    desc: 'Kill your first car' },
  { id: 'combo_starter', name: 'Combo Starter',   desc: 'Reach a 3x combo' },
  { id: 'combo_master',  name: 'Combo Master',    desc: 'Reach an 8x combo' },
  { id: 'bench_warmer',  name: 'Bench Warmer',    desc: 'Deploy from bench 10 times' },
  { id: 'sharpshooter',  name: 'Sharpshooter',   desc: 'Finish a level with 100% color accuracy' },
  { id: 'survivor',      name: 'Survivor',        desc: 'Use rescue and still win' },
  { id: 'speed_demon',   name: 'Speed Demon',     desc: 'Win a level in under 30 seconds' },
  { id: 'collector',     name: 'Collector',       desc: 'Earn 500 total coins' },
  { id: 'shopkeeper',    name: 'Shopkeeper',      desc: 'Buy 5 boosters from the shop' },
  { id: 'dedicated',     name: 'Dedicated',       desc: 'Claim 7 daily rewards' },
];

export class AchievementManager {
  constructor(progress) {
    this._p = progress;
  }

  // Check achievements for a given event.
  // Returns an array of newly-earned achievement objects (may be empty).
  // data fields vary by event type — see switch cases below.
  check(event, data = {}) {
    const newly = [];
    const award = (id) => {
      if (!this._p.hasAchievement(id)) {
        this._p.awardAchievement(id);
        const def = ACHIEVEMENTS.find(a => a.id === id);
        if (def) newly.push(def);
      }
    };

    switch (event) {
      case 'kill':
        award('first_blood');
        if (data.combo >= 3) award('combo_starter');
        if (data.combo >= 8) award('combo_master');
        break;

      case 'level_end':
        if (data.won) {
          if (data.totalDeploys > 0 && data.wrongDeploys === 0) award('sharpshooter');
          if (data.rescueUsed) award('survivor');
          if (data.elapsed < 30) award('speed_demon');
        }
        break;

      case 'bench_deploy':
        if (this._p.totalBenchUses >= 10) award('bench_warmer');
        break;

      case 'coins_earned':
        if (this._p.totalCoinsEarned >= 500) award('collector');
        break;

      case 'shop_purchase':
        if (this._p.totalBoostersPurchased >= 5) award('shopkeeper');
        break;

      case 'daily_claim':
        if (this._p.totalDailyClaims >= 7) award('dedicated');
        break;
    }

    return newly;
  }
}
