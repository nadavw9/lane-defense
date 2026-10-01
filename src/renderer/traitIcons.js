// One place that says how a special-car trait is drawn in 2D UI (goal cards, car
// manual, pre-level screen, intro cards). Art lives in public/sprites/designed.

const ENTRIES = {
  speeder:   { name: 'SPEEDER',   sprite: 'speeder-big-yellow',   rule: 'Moves 2 steps a turn' },
  armored:   { name: 'ARMOURED',  sprite: 'armored-big-blue',     rule: 'Any color breaks the plates' },
  chameleon: { name: 'CHAMELEON', sprite: 'chameleon-big-green',  rule: 'Changes color every turn' },
  plated:    { name: 'PLATED',    sprite: 'armored-big-red',      rule: 'Two hits, any color, strip it' },
  mender:    { name: 'MENDER',    sprite: 'mender-big-green',     rule: 'Heals 1 HP a turn if not hit' },
  volatile:  { name: 'VOLATILE',  sprite: 'volatile-big-orange',  rule: 'Blows: other lanes surge 1 row' },
  phantom:   { name: 'PHANTOM',   sprite: 'car-purple-processed', rule: 'Color hidden until it nears', tint: 0x2A2548, mark: '?' },
};

export function traitInfo(trait) { return ENTRIES[trait] ?? null; }
export function traitSpritePath(trait) {
  const e = ENTRIES[trait];
  return e ? `sprites/designed/${e.sprite}.png` : null;
}
export const TRAIT_KEYS = Object.keys(ENTRIES);
