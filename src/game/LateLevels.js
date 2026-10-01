// L41-L100: the long game. Worlds 3-7 (see levelMapLayout.WORLD_DEFS).
//
// One idea per level, one boss every tenth. New special cars arrive with their
// world and are then mixed with everything that came before:
//   plated  L41 (Neon Nights)     mender   L46 (Sun Valley)
//   phantom L61 (Frost Pass)      volatile L76 (Harbor Lights)
// Bosses: L50 Sun King, L60 Dune Crawler, L70 Whiteout Beast, L80 Harbor Master,
// L90 Dread Hauler, L100 Starlight Colossus.
//
// `heft` values are sim-tuned (node tools/tune-levels.mjs 41-100) into the bands
// in tools/bands.mjs; the trait mix and goals are the authored part.
import { lv, boss, open, goalTotal, goalColor, goalType, goalTrait } from './levelDsl.js';

// A boss on lane 1 with ordinary traffic on lanes 0 and 2 (the L10/L20/L30 shape).
const soloBoss = (sequence, extra = {}) => [...open(0, 2), { lane: 1, row: 1, sequence, moveEvery: 2, ...extra }];

export const LATE_LEVELS = [

  // ═══ WORLD 3 — Neon Nights (L31-45): plated cars close it out ═════════════

  lv(41, 'Double plate', 'ORBY', { heft: 0.3, traits: { plated: 0.07 }, total: 26,
    hint: 'NEW! Plated cars — it takes TWO hits, any colour, to strip the plating' }),
  lv(42, 'Plate and shift', 'OPGB', { traits: { plated: 0.04, chameleon: 0.10 }, total: 28 }),
  lv(43, 'Dark road', 'RBGY', { traits: { plated: 0.03, speeder: 0.08 }, total: 24 }),           // relief
  lv(44, 'Shape hunt', 'ORYG', { traits: { plated: 0.06, chameleon: 0.14 },
    goals: [goalTrait('chameleon', 3), goalTotal(16)] }),
  lv(45, 'Neon finale', 'ORPB', { traits: { speeder: 0.05, armored: 0.05, plated: 0.03, chameleon: 0.05 }, total: 28 }),

  // ═══ WORLD 4 — Sun Valley (L46-60): menders and the desert ════════════════

  lv(46, 'Oasis', 'RGYO', { traits: { mender: 0.16 }, total: 24,
    hint: 'NEW! Menders — they heal 1 HP every turn they are not hit. Keep shooting!' }),
  lv(47, 'Quick fix', 'BYOR', { traits: { mender: 0.12, speeder: 0.10 }, total: 26 }),
  lv(48, 'Heat haze', 'RGPY', { traits: { mender: 0.08, chameleon: 0.08 }, total: 24 }),           // relief
  lv(49, 'Repair crew', 'GOPR', { traits: { mender: 0.18, armored: 0.08 },
    goals: [goalTrait('mender', 4), goalColor('Green', 7)] }),
  { // L50 BOSS "Sun King": a long sequence; menders patch up the escorts.
    ...lv(50, 'Sun King', 'RYOG', { traits: { mender: 0.14 }, duration: 120,
      hint: 'BOSS! Menders patch up its escorts — finish the escorts fast',
      initialCars: soloBoss(['Orange', 'Yellow', 'Red', 'Green', 'Orange', 'Red', 'Yellow', 'Green']) }),
    goals: boss },
  lv(51, 'Mirage', 'BYPO', { traits: { chameleon: 0.16, mender: 0.08 }, total: 28 }),
  lv(52, 'Dust storm', 'RYOP', { traits: { speeder: 0.18 }, total: 28 }),
  lv(53, 'Caravan', 'GORY', { traits: { plated: 0.05, mender: 0.10 }, total: 26 }),
  lv(54, 'Canyon run', 'BOGP', { traits: { speeder: 0.08, mender: 0.08, armored: 0.05 }, total: 30 }),
  lv(55, 'Cool shade', 'RBYG', { traits: { mender: 0.06 }, total: 24 }),                          // relief
  lv(56, 'Sandblast', 'RPYG', { traits: { plated: 0.06, chameleon: 0.10 },
    goals: [goalTotal(24), goalType('truck', 4)] }),
  lv(57, 'Workshop', 'OGRB', { traits: { mender: 0.20, armored: 0.10 }, budget: 30,
    goals: [goalTrait('mender', 4), goalColor('Orange', 5)] }),
  lv(58, 'Rush at noon', 'YPOB', { traits: { speeder: 0.14, chameleon: 0.10, mender: 0.08 }, total: 30 }),
  lv(59, 'Heat wave', 'RGOY', { traits: { speeder: 0.08, armored: 0.08, plated: 0.03, mender: 0.08 }, total: 28 }),
  { // L60 BOSS "Dune Crawler": a short sequence, but speeders flank it on both sides.
    ...lv(60, 'Dune Crawler', 'YORG', { traits: { speeder: 0.20 }, duration: 120,
      hint: 'BOSS! Speeders flank it on both sides — watch the side lanes',
      initialCars: soloBoss(['Yellow', 'Orange', 'Red', 'Green', 'Orange', 'Yellow', 'Red']) }),
    goals: boss },

  // ═══ WORLD 5 — Frost Pass (L61-75): phantoms in the whiteout ══════════════

  lv(61, 'Whiteout', 'PBGY', { traits: { phantom: 0.16 }, total: 24,
    hint: 'NEW! Phantom cars — their colour stays hidden in the fog until they get close' }),
  lv(62, 'Black ice', 'BRYP', { traits: { phantom: 0.12, speeder: 0.12 }, total: 26 }),
  lv(63, 'Thaw', 'GBYR', { traits: { phantom: 0.08 }, total: 24 }),                               // relief
  lv(64, 'Snow chains', 'PGBO', { traits: { armored: 0.12, phantom: 0.12 }, total: 28 }),
  lv(65, 'Ghost hunt', 'BYPR', { traits: { phantom: 0.22 },
    goals: [goalTrait('phantom', 4), goalColor('Purple', 6)] }),
  lv(66, 'Icicle', 'BYPR', { traits: { plated: 0.05, phantom: 0.10 }, total: 28 }),
  lv(67, 'Blizzard', 'GPOB', { traits: { phantom: 0.14, chameleon: 0.12 }, total: 28 }),
  lv(68, 'Frostbite', 'RBYP', { traits: { mender: 0.10, phantom: 0.12 }, total: 30, dense: true }),
  lv(69, 'Cabin', 'GYBR', { traits: { phantom: 0.06, speeder: 0.08 }, total: 24 }),               // relief
  { // L70 BOSS "Whiteout Beast": an 8-light sequence; phantoms hide the escorts' colours.
    ...lv(70, 'Whiteout Beast', 'BPYR', { traits: { phantom: 0.12 }, duration: 125,
      hint: 'BOSS! Phantom escorts in the fog — and eight lights to clear',
      initialCars: soloBoss(['Blue', 'Purple', 'Yellow', 'Red', 'Blue', 'Yellow', 'Purple', 'Red']) }),
    goals: boss },
  lv(71, 'Avalanche', 'RBYG', { traits: { speeder: 0.16, phantom: 0.10 }, total: 30 }),
  lv(72, 'Frozen convoy', 'OPGB', { traits: { plated: 0.06, armored: 0.10 }, total: 26 }),
  lv(73, 'Aurora', 'PGYB', { traits: { chameleon: 0.16, phantom: 0.12 }, total: 30 }),
  lv(74, 'Deep freeze', 'RPBY', { traits: { plated: 0.04, mender: 0.10, phantom: 0.10 }, total: 28 }),
  lv(75, 'Summit', 'ORYP', { traits: { speeder: 0.06, armored: 0.06, chameleon: 0.06, phantom: 0.06, mender: 0.06, plated: 0.03 }, total: 30 }),

  // ═══ WORLD 6 — Harbor Lights (L76-90): volatile cargo ═════════════════════

  lv(76, 'Powder keg', 'ORBG', { traits: { volatile: 0.14 }, total: 24,
    hint: 'NEW! Volatile cars — when one blows up, every OTHER lane surges forward a row' }),
  lv(77, 'Chain reaction', 'YORP', { traits: { volatile: 0.12, speeder: 0.08 }, total: 26 }),
  lv(78, 'Dock rats', 'RBGY', { traits: { volatile: 0.06 }, total: 24 }),                         // relief
  lv(79, 'Fuel depot', 'OYRG', { traits: { volatile: 0.20 },
    goals: [goalTrait('volatile', 3), goalColor('Orange', 6)] }),
  { // L80 BOSS "Harbor Master": two haulers, one re-plating, volatile cargo between them.
    ...lv(80, 'Harbor Master', 'ORBY', { traits: { volatile: 0.08 }, duration: 125,
      hint: 'BOSS! Two haulers — and volatile cargo in the middle lane',
      initialCars: [...open(1),
        { lane: 0, row: 1, sequence: ['Orange', 'Red', 'Blue', 'Yellow', 'Orange'], moveEvery: 3 },
        { lane: 2, row: 1, sequence: ['Blue', 'Yellow', 'Orange', 'Red'], moveEvery: 3, reArmor: true }] }),
    goals: [{ type: 'defeatBoss', count: 2 }] },
  lv(81, 'Cargo run', 'GPOR', { traits: { plated: 0.05, volatile: 0.10 }, total: 28 }),
  lv(82, 'Fog horn', 'BYOP', { traits: { phantom: 0.12, volatile: 0.10 }, total: 28 }),
  lv(83, 'Tide', 'RGBO', { traits: { mender: 0.10, volatile: 0.12, chameleon: 0.08 }, total: 30 }),
  lv(84, 'Crane lift', 'YPRO', { traits: { armored: 0.06, plated: 0.03, volatile: 0.06 }, total: 28 }),
  lv(85, 'Calm water', 'BGYR', { traits: { volatile: 0.05 }, total: 24 }),                         // relief
  lv(86, 'Salvage', 'ORGP', { traits: { volatile: 0.16, mender: 0.14 }, budget: 30,
    goals: [goalTrait('volatile', 2), goalTrait('mender', 3), goalColor('Green', 3)] }),
  lv(87, 'Storm warning', 'RBYO', { traits: { speeder: 0.12, volatile: 0.14 }, total: 30 }),
  lv(88, 'Smugglers', 'PYOG', { traits: { phantom: 0.12, chameleon: 0.12, volatile: 0.08 }, total: 30 }),
  lv(89, 'Last tide', 'ORYB', { traits: { speeder: 0.07, plated: 0.03, phantom: 0.07, volatile: 0.07, mender: 0.07 }, total: 30 }),
  { // L90 BOSS "Dread Hauler": re-plates after every light, so each light costs two bombs.
    ...lv(90, 'Dread Hauler', 'ORYB', { traits: { plated: 0.04 }, duration: 130,
      hint: 'BOSS! Its plating grows back after every light — and it creeps in slowly',
      initialCars: soloBoss(['Orange', 'Red', 'Blue', 'Yellow', 'Orange', 'Blue'], { reArmor: true, moveEvery: 3 }) }),
    goals: boss },

  // ═══ WORLD 7 — Starlight Strip (L91-100): everything, at once ═════════════

  lv(91, 'Launch pad', 'RBGY', { traits: { speeder: 0.06, mender: 0.06 }, total: 24 }),           // relief
  lv(92, 'Orbit', 'PYOB', { traits: { speeder: 0.12, chameleon: 0.12, phantom: 0.08 }, total: 30 }),
  lv(93, 'Meteor shower', 'ORPG', { traits: { volatile: 0.14, plated: 0.05 }, total: 30 }),
  lv(94, 'Zero gravity', 'BYPR', { traits: { mender: 0.12, phantom: 0.12, speeder: 0.08 }, total: 30 }),
  lv(95, 'Warp lane', 'OYBG', { traits: { speeder: 0.16, volatile: 0.10 }, total: 30, dense: true }),
  lv(96, 'Event horizon', 'ORPY', { traits: { speeder: 0.06, armored: 0.06, chameleon: 0.06, plated: 0.03, mender: 0.06, volatile: 0.06, phantom: 0.06 }, total: 30 }),
  lv(97, 'Comet tail', 'BGYR', { traits: { speeder: 0.06, chameleon: 0.06 }, total: 24 }),         // relief
  lv(98, 'Black hole', 'RPBO', { traits: { plated: 0.06, phantom: 0.12, mender: 0.10 }, total: 30 }),
  lv(99, 'Final countdown', 'ORYP', { traits: { speeder: 0.08, plated: 0.03, chameleon: 0.08, phantom: 0.08, volatile: 0.08 }, total: 30 }),
  { // L100 BOSS "Starlight Colossus": three titans, one per lane, no ordinary traffic.
    ...lv(100, 'Starlight Colossus', 'ORBY', { traits: {}, duration: 140,
      hint: 'BOSS! Three titans, one per lane — take them down together',
      initialCars: [
        { lane: 0, row: 1, sequence: ['Orange', 'Red', 'Blue', 'Yellow', 'Orange'], moveEvery: 3 },
        { lane: 1, row: 1, sequence: ['Blue', 'Yellow', 'Orange', 'Red'], moveEvery: 3, reArmor: true },
        { lane: 2, row: 1, sequence: ['Yellow', 'Red', 'Blue', 'Orange', 'Red', 'Yellow'], moveEvery: 3 }] }),
    goals: [{ type: 'defeatBoss', count: 3 }] },
];
