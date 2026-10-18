// L101-L200: the second tour. Worlds 8-14 revisit the settings of worlds 1-7 (see
// levelMapLayout.WORLD_DEFS: the same art, the same 15 / 10 page sizes) with everything the
// player has learned in play. No new rules: every special car, goal type and board element
// is one the first hundred levels taught.
//
// Same cadence as L41-100, so the difficulty labels and tuning bands stay honest:
//   x0  BIG WAVE (dense milestone, SUPER HARD)      x5  HARD (the heaviest mix in its block)
//   x1 / x6  relief (one light trait, short goal)   the rest: one idea per level, named
// Each world leans on two or three traits and spotlights each one with a trait goal; colour
// goals, van goals (`jeep` = 3-hit van) and plain totals rotate through. Traffic lights,
// motorbike convoys and gift cars come from levelDsl.identityFor, like every level.
//
// heft / trait scale / goal scale are sim-tuned: node tools/tune-levels.mjs 101-200 300 --write
import { lv, goalTotal, goalColor, goalType, goalTrait } from './levelDsl.js';

export const TOUR_LEVELS = [

  // ═══ WORLD 8 — Rush Hour (L101-115, Toy Town art): speeders, armor, shape-shifters ═══

  lv(101, 'Rush hour', 'RBGY', { traits: { speeder: 0.06 }, total: 24 }),                         // relief
  lv(102, 'Gridlock', 'OBYP', { traits: { armored: 0.10, speeder: 0.08 }, total: 28 }),
  lv(103, 'Lane change', 'RGPB', { traits: { chameleon: 0.14, armored: 0.06 }, total: 28 }),
  lv(104, 'Speed trap', 'YRBO', { traits: { speeder: 0.14 },
    goals: [goalTrait('speeder', 4), goalTotal(18)] }),
  lv(105, 'Double park', 'GPOR', { traits: { armored: 0.10, plated: 0.05, chameleon: 0.08 }, total: 30 }),   // hard
  lv(106, 'Green wave', 'BYGR', { traits: { chameleon: 0.06 }, total: 24 }),                      // relief
  lv(107, 'Detour', 'ORPB', { traits: { mender: 0.10, speeder: 0.10 }, total: 28 }),
  lv(108, 'Red-light run', 'RYBG', { traits: { phantom: 0.10, chameleon: 0.08 },
    goals: [goalColor('Red', 6), goalTotal(18)] }),
  lv(109, 'School run', 'PBOY', { traits: { armored: 0.12, mender: 0.08 },
    goals: [goalType('jeep', 4), goalTotal(20)] }),
  lv(110, 'Rush-hour wave', 'ROBY', { traits: { speeder: 0.12, armored: 0.06 }, duration: 130, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Rush hour in every lane' }),
  lv(111, 'Coffee break', 'GBRY', { traits: { speeder: 0.05 }, total: 24 }),                      // relief
  lv(112, 'Bus lane', 'OPGY', { traits: { plated: 0.05, armored: 0.08 }, total: 28 }),
  lv(113, 'Taxi chase', 'RBPO', { traits: { speeder: 0.16, chameleon: 0.10 }, total: 30 }),
  lv(114, 'Paint shop', 'YGBR', { traits: { chameleon: 0.18 },
    goals: [goalTrait('chameleon', 4), goalColor('Blue', 5)] }),
  lv(115, 'City limits', 'ORPG', { traits: { speeder: 0.06, armored: 0.06, chameleon: 0.06, mender: 0.06, plated: 0.03 }, total: 30 }),   // hard

  // ═══ WORLD 9 — Night Shift (L116-130, Steel Yards art): armor, plating, menders ═══

  lv(116, 'Night shift', 'RBGO', { traits: { armored: 0.06 }, total: 24 }),                       // relief
  lv(117, 'Steel beams', 'PYRB', { traits: { plated: 0.06, armored: 0.08 }, total: 28 }),
  lv(118, 'Forklift', 'GOBY', { traits: { mender: 0.12, armored: 0.08 }, total: 28 }),
  lv(119, 'Rivets', 'RYPG', { traits: { plated: 0.07 },
    goals: [goalTrait('plated', 3), goalTotal(18)] }),
  lv(120, 'Furnace wave', 'OBRY', { traits: { armored: 0.10, plated: 0.03 }, duration: 130, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Armored escorts in every lane' }),
  lv(121, 'Lunch whistle', 'BGYP', { traits: { mender: 0.06 }, total: 24 }),                     // relief
  lv(122, 'Conveyor', 'ROGB', { traits: { speeder: 0.12, armored: 0.10 }, total: 28 }),
  lv(123, 'Welding sparks', 'YPOR', { traits: { volatile: 0.08, plated: 0.04 }, total: 28 }),
  lv(124, 'Scrap yard', 'GBRO', { traits: { mender: 0.16, plated: 0.04 },
    goals: [goalTrait('mender', 4), goalColor('Orange', 5)] }),
  lv(125, 'Overtime', 'RPYB', { traits: { armored: 0.12, mender: 0.10, plated: 0.04 }, total: 30 }),   // hard
  lv(126, 'Shift change', 'OGBY', { traits: { armored: 0.05, speeder: 0.05 }, total: 24 }),      // relief
  lv(127, 'Crane hook', 'BRPG', { traits: { chameleon: 0.12, armored: 0.10 }, total: 28 }),
  lv(128, 'Smokestack', 'YOGR', { traits: { phantom: 0.10, mender: 0.10 }, total: 30 }),
  lv(129, 'Heavy load', 'PBOY', { traits: { armored: 0.10, plated: 0.05 },
    goals: [goalType('jeep', 5), goalTotal(20)] }),
  lv(130, 'Iron wave', 'ROGB', { traits: { plated: 0.04, mender: 0.10 }, duration: 135, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Plated cars that patch themselves up' }),

  // ═══ WORLD 10 — Neon Rain (L131-145, Neon Nights art): phantoms, shape-shifters, plating ═══

  lv(131, 'Neon rain', 'BPGY', { traits: { chameleon: 0.06 }, total: 24 }),                       // relief
  lv(132, 'Puddles', 'ORBY', { traits: { phantom: 0.12 }, total: 26 }),
  lv(133, 'Billboard', 'RGPO', { traits: { chameleon: 0.16, plated: 0.04 }, total: 28 }),
  lv(134, 'Underpass', 'YBRG', { traits: { phantom: 0.14, speeder: 0.10 }, total: 28 }),
  lv(135, 'Blackout', 'OPBR', { traits: { phantom: 0.14, chameleon: 0.10, plated: 0.04 }, total: 30 }),   // hard
  lv(136, 'Arcade', 'GYRB', { traits: { phantom: 0.05 }, total: 24 }),                            // relief
  lv(137, 'Taillights', 'RPOY', { traits: { speeder: 0.14, phantom: 0.08 },
    goals: [goalColor('Red', 6), goalTotal(20)] }),
  lv(138, 'Hologram', 'BGOP', { traits: { chameleon: 0.14, phantom: 0.10 },
    goals: [goalTrait('phantom', 4), goalTotal(18)] }),
  lv(139, 'Wet asphalt', 'YRBO', { traits: { armored: 0.08, speeder: 0.12 }, total: 30 }),
  lv(140, 'Neon wave', 'PBRY', { traits: { phantom: 0.12, chameleon: 0.06 }, duration: 135, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Phantoms in the neon rain' }),
  lv(141, 'Night market', 'OGYB', { traits: { chameleon: 0.06, speeder: 0.05 }, total: 24 }),    // relief
  lv(142, 'Flicker', 'RBPG', { traits: { phantom: 0.12, mender: 0.08 }, total: 28 }),
  lv(143, 'Laser grid', 'YOPR', { traits: { plated: 0.06, chameleon: 0.12 }, total: 28 }),
  lv(144, 'Mirror maze', 'GBYO', { traits: { chameleon: 0.20 },
    goals: [goalTrait('chameleon', 5), goalColor('Green', 4)] }),
  lv(145, 'Neon storm', 'RPOB', { traits: { phantom: 0.08, chameleon: 0.08, plated: 0.03, speeder: 0.08, volatile: 0.05 }, total: 30 }),   // hard

  // ═══ WORLD 11 — Sandstorm (L146-160, Sun Valley art): menders, speeders, volatile cargo ═══

  lv(146, 'Sandstorm', 'RGYO', { traits: { mender: 0.06 }, total: 24 }),                          // relief
  lv(147, 'Dust devil', 'BYOR', { traits: { speeder: 0.18 }, total: 28 }),
  lv(148, 'Oil field', 'GORP', { traits: { volatile: 0.12, mender: 0.08 }, total: 28 }),
  lv(149, 'Tumbleweed', 'YPGB', { traits: { speeder: 0.12, chameleon: 0.10 },
    goals: [goalTrait('speeder', 4), goalTotal(18)] }),
  lv(150, 'Desert wave', 'ROYG', { traits: { volatile: 0.08, speeder: 0.08 }, duration: 135, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Fast cars with volatile cargo' }),
  lv(151, 'Water stop', 'BGRY', { traits: { speeder: 0.06 }, total: 24 }),                        // relief
  lv(152, 'Sun scorch', 'OPYR', { traits: { mender: 0.18, armored: 0.06 }, total: 28 }),
  lv(153, 'Quicksand', 'GBOY', { traits: { plated: 0.05, mender: 0.12 }, total: 28 }),
  lv(154, 'Dune buggy', 'RYPB', { traits: { speeder: 0.14, volatile: 0.10 }, total: 30 }),
  lv(155, 'Scorpion pass', 'OGRP', { traits: { mender: 0.12, volatile: 0.10, speeder: 0.08, plated: 0.03 }, total: 30 }),   // hard
  lv(156, 'Shade tent', 'YBGR', { traits: { mender: 0.06 }, total: 24 }),                         // relief
  lv(157, 'Pipeline', 'ORBG', { traits: { volatile: 0.18 },
    goals: [goalTrait('volatile', 3), goalColor('Orange', 5)] }),
  lv(158, 'Heat mirage', 'PYOB', { traits: { phantom: 0.10, chameleon: 0.10 }, total: 28 }),
  lv(159, 'Camel train', 'GRYO', { traits: { armored: 0.10, mender: 0.10 },
    goals: [goalType('jeep', 4), goalTotal(20)] }),
  lv(160, 'Sandstorm wave', 'YORB', { traits: { mender: 0.12, speeder: 0.06 }, duration: 140, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Menders racing through the storm' }),

  // ═══ WORLD 12 — Glacier Road (L161-175, Frost Pass art): phantoms, armor, menders ═══

  lv(161, 'Glacier road', 'BPGY', { traits: { phantom: 0.06 }, total: 24 }),                      // relief
  lv(162, 'Snowplow', 'RBYO', { traits: { armored: 0.12 }, total: 26 }),
  lv(163, 'Frozen lake', 'GPBR', { traits: { phantom: 0.14, plated: 0.04 }, total: 28 }),
  lv(164, 'Ice fishing', 'YRGB', { traits: { mender: 0.12, phantom: 0.10 },
    goals: [goalTrait('mender', 3), goalTotal(18)] }),
  lv(165, 'Polar night', 'OBPY', { traits: { phantom: 0.16, armored: 0.08, speeder: 0.08 }, total: 30 }),   // hard
  lv(166, 'Hot cocoa', 'RGYB', { traits: { armored: 0.05 }, total: 24 }),                         // relief
  lv(167, 'Sled run', 'PBOG', { traits: { speeder: 0.16, phantom: 0.08 }, total: 28 }),
  lv(168, 'Crevasse', 'YORB', { traits: { volatile: 0.10, phantom: 0.10 }, total: 28 }),
  lv(169, 'Snow blind', 'BGRP', { traits: { phantom: 0.20, speeder: 0.08 },
    goals: [goalTrait('phantom', 5), goalColor('Blue', 7)] }),
  lv(170, 'Glacier wave', 'GBPY', { traits: { phantom: 0.10, armored: 0.06 }, duration: 140, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Armored phantoms in the snow' }),
  lv(171, 'Ski lodge', 'ORYB', { traits: { chameleon: 0.06 }, total: 24 }),                       // relief
  lv(172, 'Permafrost', 'RPGO', { traits: { plated: 0.06, mender: 0.10 }, total: 28 }),
  lv(173, 'Frost giants', 'BYOR', { traits: { armored: 0.10, plated: 0.04 },
    goals: [goalType('jeep', 5), goalTotal(20)] }),
  lv(174, 'Northern lights', 'GPYB', { traits: { chameleon: 0.14, phantom: 0.12 }, total: 30 }),
  lv(175, 'Ice age', 'ROPB', { traits: { phantom: 0.07, armored: 0.07, mender: 0.07, plated: 0.03, chameleon: 0.07 }, total: 30 }),   // hard

  // ═══ WORLD 13 — Storm Harbor (L176-190, Harbor Lights art): volatile cargo, plating, fog ═══

  lv(176, 'Storm harbor', 'OBGY', { traits: { volatile: 0.05 }, total: 24 }),                     // relief
  lv(177, 'High tide', 'RYPB', { traits: { volatile: 0.12, phantom: 0.08 }, total: 28 }),
  lv(178, 'Barge', 'GORY', { traits: { plated: 0.06, armored: 0.08 }, total: 28 }),
  lv(179, 'Lighthouse', 'BPOR', { traits: { phantom: 0.12, volatile: 0.10 },
    goals: [goalTrait('volatile', 3), goalTotal(18)] }),
  lv(180, 'Harbor wave', 'ROBY', { traits: { volatile: 0.10, plated: 0.03 }, duration: 140, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! Volatile cargo with plated escorts' }),
  lv(181, 'Fish market', 'YGBR', { traits: { speeder: 0.06 }, total: 24 }),                       // relief
  lv(182, 'Tugboat', 'OPGB', { traits: { mender: 0.12, volatile: 0.10 }, total: 28 }),
  lv(183, 'Container stack', 'RBYO', { traits: { plated: 0.06, chameleon: 0.10 }, total: 28 }),
  lv(184, 'Squall', 'GYPR', { traits: { speeder: 0.14, volatile: 0.12 }, total: 30 }),
  lv(185, 'Shipwreck', 'OBRP', { traits: { volatile: 0.12, phantom: 0.10, plated: 0.04, mender: 0.06 }, total: 30 }),   // hard
  lv(186, 'Calm bay', 'BYGO', { traits: { volatile: 0.05 }, total: 24 }),                         // relief
  lv(187, 'Customs check', 'RPOY', { traits: { armored: 0.12, chameleon: 0.10 },
    goals: [goalColor('Purple', 5), goalTotal(20)] }),
  lv(188, 'Gale force', 'GBRY', { traits: { speeder: 0.16, phantom: 0.10 }, total: 30 }),
  lv(189, 'Dry dock', 'OYPB', { traits: { mender: 0.16, plated: 0.05 },
    goals: [goalTrait('mender', 4), goalTotal(18)] }),
  lv(190, 'Storm wave', 'ORPY', { traits: { volatile: 0.08, phantom: 0.08 }, duration: 145, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! The storm brings everything ashore' }),

  // ═══ WORLD 14 — Galaxy Finale (L191-200, Starlight Strip art): everything ═══════

  lv(191, 'Liftoff', 'RBGY', { traits: { speeder: 0.06, mender: 0.06 }, total: 24 }),             // relief
  lv(192, 'Asteroid belt', 'PYOB', { traits: { volatile: 0.12, plated: 0.05 }, total: 30 }),
  lv(193, 'Nebula', 'ORPG', { traits: { phantom: 0.12, chameleon: 0.12 }, total: 30 }),
  lv(194, 'Space dock', 'BYPR', { traits: { armored: 0.10, mender: 0.10 },
    goals: [goalType('jeep', 4), goalTotal(20)] }),
  lv(195, 'Supernova', 'OYBG', { traits: { speeder: 0.10, volatile: 0.10, phantom: 0.08, plated: 0.03 }, total: 30 }),   // hard
  lv(196, 'Moon base', 'RGYB', { traits: { chameleon: 0.06 }, total: 24 }),                       // relief
  lv(197, 'Wormhole', 'RPBO', { traits: { speeder: 0.12, chameleon: 0.10, phantom: 0.10 },
    goals: [goalTrait('phantom', 3), goalColor('Red', 5)] }),
  lv(198, 'Dark matter', 'ORYP', { traits: { plated: 0.05, mender: 0.10, volatile: 0.10 }, total: 30 }),
  lv(199, 'Last orbit', 'BGOR', { traits: { speeder: 0.07, armored: 0.07, chameleon: 0.07, phantom: 0.07, volatile: 0.07 }, total: 30 }),
  lv(200, 'Galaxy rush', 'ORBY', { traits: { speeder: 0.06, armored: 0.06, chameleon: 0.06, plated: 0.03, mender: 0.06, volatile: 0.06, phantom: 0.06 }, duration: 150, total: 32, dense: true, milestone: true,
    hint: 'BIG WAVE! The final rush: everything at once' }),
];
