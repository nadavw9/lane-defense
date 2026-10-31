// demoScenes — the moving picture behind every first-time explanation (DemoCard.js). One entry per
// guide key (guideContent CARDS); a key without a scene falls back to the text GuideCard (only the
// cards that point at a REAL board element with a hand: second_colour, the L1 tour, the guided
// first bridge). Copy stays short: the picture does the explaining. Owner, 2026-10-31: "assume
// people forward every explanation without reading".
//
// Rows: 0 far, 2 nearest the red line. Lanes: 0 left. Times in seconds from the loop start;
// `loop` is when the scene rebuilds (plus a 0.6 s rest). Ops: see DemoCard.js.

const BIG = 'big', VAN = 'jeep', BIKE = 'small';

export const DEMO_SCENES = {
  lane_2: {
    ribbon: 'NEW LANE', title: 'TWO LANES', sub: 'EACH BOMB TO ITS OWN COLOR',
    caption: 'Aim every bomb at a car of its color',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 2, color: 'Red', type: BIKE }, { lane: 1, row: 2, color: 'Blue', type: BIKE }, { lane: 0, row: 1, color: 'Blue', type: BIKE }, { lane: 1, row: 1, color: 'Red', type: BIKE }],
      bombs: ['Red', 'Blue'], loop: 4.2,
      steps: [[0.3, 'shot', 0, 0], [0.95, 'boom', 0], [1.0, 'advance'], [1.7, 'shot', 1, 1], [2.35, 'boom', 1], [2.4, 'advance'], [3.0, 'tag', 'MATCH!', 1]],
    },
  },
  lane_3: {
    ribbon: 'NEW LANE', title: 'THREE LANES', sub: 'NEAREST TO THE LINE FIRST',
    caption: 'Stop the car closest to the red line first',
    scene: {
      lanes: 3, cars: [{ lane: 0, row: 1, color: 'Blue', type: BIKE }, { lane: 1, row: 2, color: 'Red', type: BIKE }, { lane: 2, row: 0, color: 'Green', type: BIKE }],
      bombs: ['Red', 'Blue', 'Green'], loop: 4.0,
      steps: [[0.2, 'tag', 'CLOSEST!', 1], [0.8, 'shot', 0, 1], [1.45, 'boom', 1], [1.5, 'advance'], [2.1, 'shot', 1, 0], [2.75, 'boom', 0], [2.8, 'advance']],
    },
  },
  bridge: {
    ribbon: 'NEW!', title: 'BRIDGES', sub: 'DRAG CAR TO CAR',
    caption: 'Same color, side by side: bridge them. One hit takes both!',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 2, color: 'Blue', type: BIG }, { lane: 1, row: 2, color: 'Blue', type: BIG }],
      bombs: ['Blue', 'Red'], loop: 4.6,
      steps: [[0.4, 'bridge', 0, 1], [1.5, 'shot', 0, 0], [2.1, 'hit', 1], [2.15, 'boom', 0], [2.15, 'boom', 1], [2.3, 'tag', 'ONE SHOT, TWO CARS!']],
    },
  },
  speeder: {
    ribbon: 'HEADS UP', title: 'SPEEDERS', sub: 'TWO STEPS A TURN',
    caption: 'A flame car breaks its bridge when it moves. Bridge it in front, then shoot!',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 0, color: 'Red', type: BIG, trait: 'speeder' }, { lane: 1, row: 0, color: 'Red', type: BIG }],
      bombs: ['Red'], loop: 5.0,
      steps: [[0.3, 'bridge', 0, 1, 0], [1.4, 'advance'], [1.8, 'snap', 0, 1], [2.9, 'tag', 'IT RAN AHEAD!', 0]],
    },
  },
  combo: {
    ribbon: 'TIP', title: 'COMBO', sub: 'HIT AFTER HIT',
    caption: 'Every hit in a row adds to the bonus. A wasted shot resets it',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 2, color: 'Red', type: BIKE }, { lane: 1, row: 2, color: 'Blue', type: BIKE }, { lane: 0, row: 1, color: 'Red', type: BIKE }, { lane: 1, row: 1, color: 'Blue', type: BIKE }],
      bombs: ['Red', 'Blue'], counter: 'x0', loop: 4.6,
      steps: [[0.3, 'shot', 0, 0], [0.95, 'boom', 0], [0.95, 'counter', 'x1'], [1.0, 'advance'], [1.5, 'shot', 1, 1], [2.15, 'boom', 1], [2.15, 'counter', 'x2'], [2.2, 'advance'], [2.7, 'shot', 0, 0], [3.35, 'boom', 0], [3.35, 'counter', 'x3'], [3.5, 'tag', 'COMBO x3!']],
    },
  },
  supercharge: {
    ribbon: 'NEW!', title: 'SUPERCHARGE', sub: '5 IN A ROW = A DOUBLE HIT',
    caption: 'Destroy a car 5 shots in a row: the next bomb hits twice',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 2, color: 'Red', type: BIKE }, { lane: 1, row: 2, color: 'Red', type: VAN }, { lane: 0, row: 1, color: 'Red', type: BIKE }],
      bombs: ['Red', 'Red'], counter: '4/5', loop: 4.8,
      steps: [[0.3, 'shot', 0, 0], [0.95, 'boom', 0], [0.95, 'counter', '5/5'], [1.0, 'advance'], [1.1, 'glow', 'front'], [1.2, 'tag', 'CHARGED!'], [2.0, 'shot', 1, 1], [2.65, 'shrink', 1], [2.9, 'shrink', 1], [3.1, 'tag', 'HITS TWICE!', 1], [3.2, 'unglow']],
    },
  },
  goal_colour: {
    ribbon: 'NEW GOAL', title: 'A COLOR GOAL', sub: 'ONLY THIS COLOR COUNTS',
    caption: 'Only cars of the goal color count. Others still move the traffic',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 2, color: 'Red', type: BIKE }, { lane: 1, row: 2, color: 'Blue', type: BIKE }, { lane: 0, row: 1, color: 'Blue', type: BIKE }],
      bombs: ['Red', 'Blue'], goal: { color: 'Blue', n: 3 }, loop: 4.4,
      steps: [[0.3, 'shot', 0, 0], [0.95, 'boom', 0, -1, 'nogoal'], [1.0, 'tag', 'NOT BLUE', 0], [1.05, 'advance'], [1.9, 'shot', 1, 1], [2.55, 'boom', 1], [2.6, 'advance'], [3.2, 'shot', 1, 0], [3.85, 'boom', 0]],
    },
  },
  freeze_booster: {
    ribbon: 'NEW BOOSTER', title: 'FREEZE', sub: 'THE NEXT SHOT MOVES NO CARS',
    caption: '3 free! Tap FREEZE, then shoot: the traffic stands still',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 1, color: 'Red', type: BIKE }, { lane: 1, row: 2, color: 'Blue', type: BIG }],
      bombs: ['Red', 'Blue'], boosters: ['freeze'], loop: 4.4,
      steps: [[0.3, 'boosterTap', 'freeze'], [0.9, 'freeze', 'on'], [1.4, 'shot', 0, 0], [2.05, 'boom', 0], [2.2, 'tag', 'NO MOVE!', 1], [3.2, 'freeze', 'off']],
    },
  },
  colour_change_booster: {
    ribbon: 'NEW BOOSTER', title: 'COLOR SWAP', sub: 'REPAINT ONE COLOR',
    caption: '3 free! Tap COLOR, tap a car, pick a color: all its kind change',
    scene: {
      lanes: 3, cars: [{ lane: 0, row: 2, color: 'Red', type: BIKE }, { lane: 1, row: 2, color: 'Green', type: BIKE }, { lane: 2, row: 2, color: 'Red', type: BIKE }, { lane: 1, row: 1, color: 'Red', type: BIKE }],
      bombs: ['Green', 'Green'], boosters: ['swap'], loop: 4.6,
      steps: [[0.3, 'boosterTap', 'swap'], [1.0, 'recolor', 'Red', 'Green'], [1.1, 'tag', 'ALL GREEN!'], [2.0, 'shot', 0, 0], [2.65, 'boom', 0], [2.7, 'advance'], [3.3, 'shot', 1, 2], [3.95, 'boom', 2]],
    },
  },
  gift_car: {
    ribbon: 'NEW!', title: 'GIFT CARS', sub: 'A BOW = A FREE BOOSTER',
    caption: 'Destroy a car with a bow for a free booster',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 2, color: 'Red', type: BIKE, trait: 'gift' }, { lane: 1, row: 2, color: 'Blue', type: BIKE }],
      bombs: ['Red', 'Blue'], boosters: ['freeze'], loop: 4.0,
      steps: [[0.3, 'shot', 0, 0], [0.9, 'gift', 0], [0.95, 'boom', 0], [1.7, 'boosterPlus', 'freeze']],
    },
  },
  traffic_light: {
    ribbon: 'NEW!', title: 'TRAFFIC LIGHT', sub: 'RED = THAT LANE WAITS',
    caption: 'On red the lane stands still. The number counts your shots to green',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 1, color: 'Red', type: BIKE }, { lane: 1, row: 1, color: 'Blue', type: BIKE }, { lane: 1, row: 0, color: 'Blue', type: BIKE }],
      bombs: ['Blue', 'Blue', 'Red'], loop: 5.2,
      steps: [[0.2, 'light', 0, 'red', 2], [0.8, 'shot', 0, 1], [1.45, 'boom', 1], [1.5, 'surge', [1]], [1.55, 'light', 0, 'red', 1], [2.3, 'shot', 1, 1], [2.95, 'boom', 1], [3.0, 'light', 0, 'green'], [3.1, 'advance'], [3.3, 'tag', 'GO!', 0]],
    },
  },
  convoy: {
    ribbon: 'NEW!', title: 'CONVOY', sub: 'ONE HIT EACH',
    caption: 'A lane of motorbikes: one hit each. Clear them fast!',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 2, color: 'Red', type: BIKE }, { lane: 0, row: 1, color: 'Red', type: BIKE }, { lane: 0, row: 0, color: 'Red', type: BIKE }, { lane: 1, row: 1, color: 'Blue', type: VAN }],
      bombs: ['Red', 'Red', 'Red'], loop: 4.6,
      steps: [[0.3, 'shot', 0, 0], [0.95, 'boom', 0], [1.0, 'advance'], [1.4, 'shot', 1, 0], [2.05, 'boom', 0], [2.1, 'advance'], [2.5, 'shot', 2, 0], [3.15, 'boom', 0], [3.3, 'tag', 'CLEAR!', 0]],
    },
  },
  rainbow_bomb: {
    ribbon: 'NEW!', title: 'RAINBOW BOMB', sub: 'ONE COLOR, EVERY LANE',
    caption: '3 multi-kills in a row earn it. It hits its color in every lane',
    scene: {
      lanes: 3, cars: [{ lane: 0, row: 2, color: 'Red', type: BIKE }, { lane: 1, row: 2, color: 'Blue', type: BIKE }, { lane: 2, row: 2, color: 'Red', type: BIKE }, { lane: 1, row: 1, color: 'Red', type: BIKE }],
      bombs: ['Red'], counter: 'x3', loop: 4.0,
      steps: [[0.2, 'tag', 'RAINBOW!'], [0.8, 'shot', 0, 0], [1.45, 'boom', 0], [1.5, 'hit', 2], [1.55, 'boom', 2], [1.6, 'hit', 1], [1.65, 'boom', 1, 1], [1.9, 'tag', 'EVERY LANE!', 1]],
    },
  },
  freeze_earned: {
    ribbon: 'EARNED!', title: 'FREEZE EARNED', sub: '3 CARS WITH ONE BOMB',
    caption: 'Three cars in one shot earn a FREEZE. Tap it for a free shot',
    scene: {
      lanes: 3, cars: [{ lane: 0, row: 2, color: 'Red', type: BIKE }, { lane: 1, row: 2, color: 'Red', type: BIKE }, { lane: 2, row: 2, color: 'Red', type: BIKE }],
      bombs: ['Red'], boosters: ['freeze'], loop: 4.4,
      steps: [[0.3, 'bridge', 0, 1], [1.1, 'bridge', 1, 2], [2.0, 'shot', 0, 1], [2.6, 'hit', 0], [2.6, 'hit', 2], [2.65, 'boom', 0], [2.65, 'boom', 1], [2.65, 'boom', 2], [2.8, 'tag', 'x3!'], [3.3, 'boosterPlus', 'freeze']],
    },
  },
  colour_change_earned: {
    ribbon: 'EARNED!', title: 'COLOR SWAP EARNED', sub: '2 MULTI-KILLS IN A ROW',
    caption: 'Two multi-kill shots in a row earn a COLOR SWAP',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 2, color: 'Red', type: BIKE }, { lane: 1, row: 2, color: 'Red', type: BIKE }, { lane: 0, row: 1, color: 'Blue', type: BIKE }, { lane: 1, row: 1, color: 'Blue', type: BIKE }],
      bombs: ['Red', 'Blue'], boosters: ['swap'], counter: 'x0', loop: 5.0,
      steps: [[0.3, 'bridge', 0, 1], [1.1, 'shot', 0, 0], [1.7, 'hit', 1], [1.75, 'boom', 0], [1.75, 'boom', 1], [1.8, 'counter', 'x1'], [1.85, 'advance'], [2.4, 'bridge', 0, 1], [3.2, 'shot', 1, 0], [3.8, 'hit', 1], [3.85, 'boom', 0], [3.85, 'boom', 1], [3.9, 'counter', 'x2'], [4.2, 'boosterPlus', 'swap']],
    },
  },
  first_kill: {
    ribbon: 'FIRST KILL!', title: 'BOOM!', sub: '10 CARS = A BOMB BOOSTER',
    caption: 'Every 10 cars you destroy earn a BOMB booster',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 2, color: 'Red', type: BIKE }, { lane: 1, row: 2, color: 'Blue', type: BIKE }, { lane: 0, row: 1, color: 'Red', type: BIKE }],
      bombs: ['Red', 'Blue'], boosters: ['bomb'], goal: { n: 10 }, loop: 4.6,
      steps: [[0.3, 'shot', 0, 0], [0.95, 'boom', 0], [1.0, 'advance'], [1.5, 'shot', 1, 1], [2.15, 'boom', 1], [2.2, 'advance'], [2.7, 'shot', 0, 0], [3.35, 'boom', 0], [3.6, 'tag', '3/10'], [4.0, 'boosterPlus', 'bomb']],
    },
  },
  first_miss: {
    ribbon: 'OOPS', title: 'WRONG COLOR', sub: 'NO DAMAGE',
    caption: 'A bomb only hurts cars of its own color. Match them!',
    scene: {
      lanes: 1, cars: [{ lane: 0, row: 2, color: 'Red', type: BIG }],
      bombs: ['Blue', 'Red'], loop: 4.0,
      steps: [[0.3, 'bounce', 0, 0], [1.5, 'shot', 1, 0], [2.15, 'shrink', 0], [2.3, 'tag', 'MATCH!', 0]],
    },
  },
  streak_charged: {
    ribbon: 'POWER SHOT!', title: 'CHARGED', sub: 'FIRE IT: IT HITS TWICE',
    caption: 'Your front bombs are charged. Fire one: it hits twice',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 2, color: 'Red', type: VAN }, { lane: 1, row: 2, color: 'Blue', type: BIKE }],
      bombs: ['Red', 'Blue'], loop: 4.0,
      steps: [[0.1, 'glow', 'front'], [0.6, 'shot', 0, 0], [1.25, 'shrink', 0], [1.5, 'shrink', 0], [1.7, 'tag', 'TWICE!', 0], [1.8, 'unglow']],
    },
  },
  plate_break: {
    ribbon: 'HEADS UP', title: 'HEAVY PLATING', sub: 'TWO HITS OF ANY COLOR',
    caption: 'Two hits of any color strip the plating. Then its own color hurts',
    scene: {
      lanes: 1, cars: [{ lane: 0, row: 2, color: 'Red', type: BIG, trait: 'plated', armor: 2 }],
      bombs: ['Blue', 'Green', 'Red'], loop: 5.0,
      steps: [[0.3, 'shot', 0, 0], [0.95, 'tag', 'CLANG', 0], [1.5, 'shot', 1, 0], [2.15, 'plate', 0], [3.0, 'shot', 2, 0], [3.65, 'shrink', 0]],
    },
  },
  armor_break: {
    ribbon: 'HEADS UP', title: 'ARMOR', sub: 'ANY COLOR POPS THE PLATE',
    caption: 'Any bomb knocks the armor off. Then hit it with its own color',
    scene: {
      lanes: 1, cars: [{ lane: 0, row: 2, color: 'Red', type: BIG, trait: 'armored', armor: 1 }],
      bombs: ['Blue', 'Red'], loop: 4.2,
      steps: [[0.3, 'shot', 0, 0], [0.95, 'plate', 0], [1.9, 'shot', 1, 0], [2.55, 'shrink', 0], [2.7, 'tag', 'NOW!', 0]],
    },
  },
  volatile_surge: {
    ribbon: 'HEADS UP', title: 'VOLATILE', sub: 'IT SHOVES THE OTHERS',
    caption: 'When a volatile car blows up, the other lanes lurch forward',
    scene: {
      lanes: 3, cars: [{ lane: 1, row: 2, color: 'Red', type: BIG, trait: 'volatile' }, { lane: 0, row: 0, color: 'Blue', type: BIKE }, { lane: 2, row: 0, color: 'Green', type: BIKE }],
      bombs: ['Red'], loop: 4.0,
      steps: [[0.4, 'shot', 0, 1], [1.05, 'shrink', 1], [1.6, 'shot', 0, 1], [2.25, 'boom', 1], [2.3, 'surge', [0, 2]], [2.4, 'advance']],
    },
  },
  mender_heal: {
    ribbon: 'HEADS UP', title: 'MENDER', sub: 'LEFT ALONE, IT GROWS BACK',
    caption: 'A mender grows back a size when left alone. Finish it fast',
    scene: {
      lanes: 2, cars: [{ lane: 0, row: 1, color: 'Red', type: VAN, trait: 'mender' }, { lane: 1, row: 2, color: 'Blue', type: BIKE }, { lane: 1, row: 1, color: 'Blue', type: BIKE }],
      bombs: ['Red', 'Blue'], loop: 5.0,
      steps: [[0.3, 'shot', 0, 0], [0.95, 'shrink', 0], [1.3, 'shot', 1, 1], [1.95, 'boom', 1], [2.0, 'advance'], [2.5, 'shot', 1, 1], [3.15, 'boom', 1], [3.2, 'advance'], [3.5, 'grow', 0], [3.7, 'tag', 'GREW BACK!', 0]],
    },
  },
};
