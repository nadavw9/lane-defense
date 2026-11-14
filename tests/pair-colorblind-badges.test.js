// PrimeTestLab report 10454 (14 Nov 2026, M-02): with Colorblind shapes on, a bridged pair showed
// no shapes. The singles (which carry the roof badge) hide while the baked pair sprite shows, so
// the pair must carry its own two badges and toggle them with the setting. Car3D needs a real
// canvas, so this guards the wiring in the source (the pair captures: CB=1 scripts/_pair-shots.mjs).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/renderer3d/Car3D.js', import.meta.url), 'utf8');
const body = (name) => {
  const i = src.indexOf(`\n  ${name}(`);
  expect(i, `${name} exists`).toBeGreaterThan(0);
  return src.slice(i, src.indexOf('\n  }\n', i));
};

describe('bridged pairs keep their colour-blind shapes', () => {
  it('the pair builds one shape badge per car, from each car colour', () => {
    const dress = body('_dressPair');
    expect(dress).toMatch(/pe\.badges\s*=\s*\[pe\.carA,\s*pe\.carB\]\.map/);
    expect(dress).toMatch(/_getShapeTex\(car\.color\)/);
  });

  it('the badges follow the setting and their own car every frame', () => {
    const place = body('_placePairs');
    expect(place).toMatch(/isColorblind\(\)/);
    expect(place).toMatch(/b\.visible\s*=/);
    expect(place).toMatch(/b\.position\.x\s*=/);
  });

  it('the badges are freed with the pair', () => {
    expect(body('_disposePair')).toMatch(/pe\.badges/);
  });
});
