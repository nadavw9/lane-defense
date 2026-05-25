/**
 * PixiJS stage → Playwright clientX/clientY converter.
 *
 * Stage dimensions are fixed: 390 × 844 (APP_W × APP_H in GameApp.js).
 * The PixiJS canvas is canvas:not(#three-canvas).
 * The Three.js canvas (#three-canvas) has pointer-events:none — never target it.
 *
 * Usage in a browser_evaluate call:
 *   const rect = await getPixiRect(page);
 *   const { clientX, clientY } = stageToClient(195, 470, rect);  // PLAY button
 */

/**
 * Convert PixiJS stage coordinates to Playwright clientX/clientY.
 * @param {number} stageX  - X in PixiJS stage space (0–390)
 * @param {number} stageY  - Y in PixiJS stage space (0–844)
 * @param {DOMRect} rect   - result of canvas.getBoundingClientRect()
 */
export function stageToClient(stageX, stageY, rect) {
  return {
    clientX: rect.left + (stageX / 390) * rect.width,
    clientY: rect.top  + (stageY / 844) * rect.height,
  };
}

/**
 * Get the PixiJS canvas bounding rect via Playwright page.evaluate.
 * Always targets canvas:not(#three-canvas).
 * @param {import('playwright').Page} page
 * @returns {Promise<DOMRect>}
 */
export async function getPixiRect(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas:not(#three-canvas)');
    if (!canvas) throw new Error('PixiJS canvas not found');
    return canvas.getBoundingClientRect();
  });
}

/**
 * Dispatch a pointerdown + pointerup on the PixiJS canvas at stage coordinates.
 * Use this instead of browser_click for game canvas interactions.
 * @param {import('playwright').Page} page
 * @param {number} stageX
 * @param {number} stageY
 */
export async function tapStage(page, stageX, stageY) {
  await page.evaluate(([sx, sy]) => {
    const canvas = document.querySelector('canvas:not(#three-canvas)');
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + (sx / 390) * rect.width;
    const cy = rect.top  + (sy / 844) * rect.height;
    const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1 };
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
    canvas.dispatchEvent(new PointerEvent('pointerup',   opts));
  }, [stageX, stageY]);
}
