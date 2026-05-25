import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const DIR = 'docs/level-screenshots/current';

/**
 * Save a Playwright screenshot to the standard location.
 * Returns the absolute filepath so callers can read it back with the Read tool.
 *
 * Usage:
 *   import { takeScreenshot } from './screenshot.mjs';
 *   const p = await takeScreenshot(page, 'L5-gameplay');
 *   // Read tool: Read docs/level-screenshots/current/L5-gameplay.png
 */
export async function takeScreenshot(page, name) {
  mkdirSync(DIR, { recursive: true });
  const filepath = path.resolve(`${DIR}/${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`Screenshot saved: ${filepath}`);
  return filepath;
}
