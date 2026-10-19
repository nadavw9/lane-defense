// The level's goal in words, shown under the goal tiles on the level card (owner 2026-10-20:
// a tile with three cars and a 9 did not say what to do). Pure: no Pixi.

const TYPE = { small: ['motorbike', 'motorbikes'], big: ['car', 'cars'], jeep: ['van', 'vans'],
  truck: ['truck', 'trucks'], bigrig: ['big rig', 'big rigs'], tank: ['tank', 'tanks'] };
const TRAIT = { speeder: ['speeder', 'speeders'], chameleon: ['chameleon', 'chameleons'], mender: ['mender', 'menders'] };

function part(g) {
  const n = g.count ?? 0, one = n === 1;
  if (g.type === 'destroyColor') return `${n} ${String(g.color).toLowerCase()} ${one ? 'car' : 'cars'}`;
  if (g.type === 'destroyType') { const t = TYPE[g.carType] ?? TYPE.big; return `${n} ${one ? t[0] : t[1]}`; }
  if (g.type === 'destroyTrait') {
    const t = TRAIT[g.trait];
    return t ? `${n} ${one ? t[0] : t[1]}` : `${n} ${g.trait} ${one ? 'car' : 'cars'}`;
  }
  return `${n} ${one ? 'car' : 'cars'} of any color`;
}

export function goalSentence(goals) {
  return goals?.length ? `Destroy ${goals.map(part).join(' + ')}` : '';
}
