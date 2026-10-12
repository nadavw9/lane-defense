// L41-L100: the long game. Worlds 3-7 (see levelMapLayout.WORLD_DEFS).
//
// One idea per level, one BIG WAVE (dense milestone) every tenth. New special cars arrive with their
// world and are then mixed with everything that came before:
//   plated  L41 (Neon Nights)     mender   L46 (Sun Valley)
//   phantom L61 (Frost Pass)      volatile L76 (Harbor Lights)
// Big waves: L50 Sun rush, L60 Dune rush, L70 Whiteout rush, L80 Harbor rush,
// L90 Dread rush, L100 Starlight rush.
//
// `heft` values are sim-tuned (node tools/tune-levels.mjs 41-100) into the bands
// in tools/bands.mjs; the trait mix and goals are the authored part.
import { lv, goalTotal, goalColor, goalType, goalTrait } from './levelDsl.js';

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
    hint: 'NEW! Menders — left alone, they grow back a size. Keep shooting them!' }),
  lv(47, 'Quick fix', 'BYOR', { traits: { mender: 0.12, speeder: 0.10 }, total: 26 }),
  lv(48, 'Heat haze', 'RGPY', { traits: { mender: 0.08, chameleon: 0.08 }, total: 24 }),           // relief
  lv(49, 'Repair crew', 'GOPR', { traits: { mender: 0.18, armored: 0.08 },
    goals: [goalTrait('mender', 4), goalColor('Green', 7)] }),
  lv(50, 'Sun rush', 'RYOG', { traits: { mender: 0.14 }, duration: 120, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Menders patch up the escorts. Finish cars fast' }),
  lv(51, 'Mirage', 'BYPO', { traits: { chameleon: 0.16, mender: 0.08 }, total: 28 }),
  lv(52, 'Dust storm', 'RYOP', { traits: { speeder: 0.18 }, total: 28 }),
  lv(53, 'Caravan', 'GORY', { traits: { plated: 0.05, mender: 0.10 }, total: 26 }),
  lv(54, 'Canyon run', 'BOGP', { traits: { speeder: 0.08, mender: 0.08, armored: 0.05 }, total: 30 }),
  lv(55, 'Cool shade', 'RBYG', { traits: { mender: 0.06 }, total: 24 }),                          // relief
  lv(56, 'Sandblast', 'RPYG', { traits: { plated: 0.06, chameleon: 0.10 },
    goals: [goalTotal(24), goalType('jeep', 4)] }),
  lv(57, 'Workshop', 'OGRB', { traits: { mender: 0.20, armored: 0.10 }, budget: 30,
    goals: [goalTrait('mender', 4), goalColor('Orange', 5)] }),
  lv(58, 'Rush at noon', 'YPOB', { traits: { speeder: 0.14, chameleon: 0.10, mender: 0.08 }, total: 30 }),
  lv(59, 'Heat wave', 'RGOY', { traits: { speeder: 0.08, armored: 0.08, plated: 0.03, mender: 0.08 }, total: 28 }),
  lv(60, 'Dune rush', 'YORG', { traits: { speeder: 0.20 }, duration: 120, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Speeders in every lane' }),

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
  lv(70, 'Whiteout rush', 'BPYR', { traits: { phantom: 0.12 }, duration: 125, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Phantoms hide in the fog' }),
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
  lv(80, 'Harbor rush', 'ORBY', { traits: { volatile: 0.08 }, duration: 125, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Volatile cargo in every lane' }),
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
  lv(90, 'Dread rush', 'ORYB', { traits: { plated: 0.04 }, duration: 130, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Plated cars keep coming' }),

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
  lv(100, 'Starlight rush', 'ORBY', { traits: { speeder: 0.06, armored: 0.06, chameleon: 0.06, plated: 0.03, mender: 0.06, volatile: 0.06, phantom: 0.06 }, duration: 140, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Everything at once' }),
];
