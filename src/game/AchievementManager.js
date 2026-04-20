// AchievementManager — stateless achievement checker.
// All state lives in ProgressManager; this class only contains definitions
// and the check() dispatch logic.
export const ACHIEVEMENTS = [
  // ── Original 10 ──────────────────────────────────────────────────────────
  { id: 'first_blood',   name: 'First Blood',      desc: 'Kill your first car' },
  { id: 'combo_starter', name: 'Combo Starter',     desc: 'Reach a 3x combo' },
  { id: 'combo_master',  name: 'Combo Master',      desc: 'Reach an 8x combo' },
  { id: 'bench_warmer',  name: 'Bench Warmer',      desc: 'Deploy from bench 10 times' },
  { id: 'sharpshooter',  name: 'Sharpshooter',      desc: 'Finish a level with 100% color accuracy' },
  { id: 'survivor',      name: 'Survivor',           desc: 'Use rescue and still win' },
  { id: 'speed_demon',   name: 'Speed Demon',        desc: 'Win a level in under 30 seconds' },
  { id: 'collector',     name: 'Collector',          desc: 'Earn 500 total coins' },
  { id: 'shopkeeper',    name: 'Shopkeeper',         desc: 'Buy 5 boosters from the shop' },
  { id: 'dedicated',     name: 'Dedicated',          desc: 'Claim 7 daily rewards' },
  // ── v1.3: 10 new achievements ─────────────────────────────────────────────
  { id: 'chain_reaction',   name: 'Chain Reaction',   desc: 'Kill 2 cars with a single shot' },
  { id: 'combo_legend',     name: 'Combo Legend',     desc: 'Reach a 12x combo' },
  { id: 'crisis_saved',     name: 'Crisis Saved',     desc: 'Benefit from CRISIS assist 3 times' },
  { id: 'weekly_hero',      name: 'Weekly Hero',      desc: 'Win a weekly featured level' },
  { id: 'streak_master',    name: 'Streak Master',    desc: 'Maintain a 7-day login streak' },
  { id: 'survival_rookie',  name: 'Survival Rookie',  desc: 'Reach Wave 5 in Survival mode' },
  { id: 'survival_veteran', name: 'Survival Veteran', desc: 'Reach Wave 10 in Survival mode' },
  { id: 'no_mercy',         name: 'No Mercy',         desc: 'Win without using any boosters or rescue' },
  { id: 'big_spender',      name: 'Big Spender',      desc: 'Spend 200 coins in the shop' },
  { id: 'daily_challenger', name: 'Daily Challenger', desc: 'Complete 5 daily challenges' },
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
        if (data.combo >= 3)  award('combo_starter');
        if (data.combo >= 8)  award('combo_master');
        if (data.combo >= 12) award('combo_legend');
        break;

      case 'chain_kill':
        // Fired when carry-over kills happen (2+ cars from one shot).
        award('chain_reaction');
        break;

      case 'level_end':
        if (data.won) {
          if (data.totalDeploys > 0 && data.wrongDeploys === 0) award('sharpshooter');
          if (data.rescueUsed) award('survivor');
          if (data.elapsed < 30) award('speed_demon');
          if (!data.rescueUsed && !data.boostersUsed) award('no_mercy');
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
        if (this._p.totalCoinsSpent >= 200)      award('big_spender');
        break;

      case 'daily_claim':
        if (this._p.totalDailyClaims >= 7) award('dedicated');
        break;

      case 'crisis_assist':
        if (this._p.crisisAssistsReceived >= 3) award('crisis_saved');
        break;

      case 'weekly_win':
        award('weekly_hero');
        break;

      case 'login_streak':
        if (data.streak >= 7) award('streak_master');
        break;

      case 'survival':
        if (data.wave >= 5)  award('survival_rookie');
        if (data.wave >= 10) award('survival_veteran');
        break;

      case 'daily_challenge':
        if (this._p.totalDailyChallengesDone >= 5) award('daily_challenger');
        break;
    }

    return newly;
  }
}
