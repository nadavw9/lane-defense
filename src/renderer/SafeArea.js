// SafeArea — the screen edges the game must keep clear of: status bar, camera
// cutout, gesture bar.
//
// Android 15+ draws apps edge-to-edge (this app targets SDK 36), so the WebView
// extends under the system bars. Two sources report the insets, depending on
// the WebView version: the CSS env(safe-area-inset-*) values (with
// viewport-fit=cover in index.html), and the --safe-area-inset-* custom
// properties Capacitor's SystemBars plugin injects. A probe element resolves the
// larger of the two, so either source works; on desktop both are 0.

let _probe = null;

function probe() {
  if (_probe) return _probe;
  _probe = document.createElement('div');
  const side = (s) => `max(env(safe-area-inset-${s}, 0px), var(--safe-area-inset-${s}, 0px))`;
  _probe.style.cssText = [
    'position:fixed', 'left:0', 'top:0', 'width:0', 'height:0', 'visibility:hidden', 'pointer-events:none',
    `padding-top:${side('top')}`, `padding-right:${side('right')}`,
    `padding-bottom:${side('bottom')}`, `padding-left:${side('left')}`,
  ].join(';');
  document.body.appendChild(_probe);
  return _probe;
}

/** Current insets in CSS px: { top, right, bottom, left }. */
export function safeInsets() {
  const cs = getComputedStyle(probe());
  const px = (v) => parseFloat(v) || 0;
  return { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
}

/**
 * Letterbox a stageW × stageH stage into the window's safe area.
 * Returns CSS values for an absolutely-positioned, translate(-50%,-50%) canvas.
 */
export function fitToSafeArea(stageW, stageH) {
  const b = fitBox(window.innerWidth, window.innerHeight, safeInsets(), stageW, stageH);
  return {
    width:  `${b.width}px`,
    height: `${b.height}px`,
    left:   `${b.x}px`,
    top:    `${b.y}px`,
  };
}

/**
 * Most CSS px of the top/bottom inset bands the stage may cover to fill the
 * width instead of leaving side strips (PrimeTestLab report 10510, M-02: a
 * 393 x 873 phone with a camera-cutout band was 12 px short, which cost a strip
 * down each side). The edge of the stage is background art, never a control.
 */
export const BORROW_PX = 16;

/**
 * Pure fit: the stage box for a winW x winH window with insets i.
 * Returns { width, height, x, y } in CSS px; x/y is the box CENTRE.
 */
export function fitBox(winW, winH, i, stageW, stageH) {
  const availW = Math.max(1, winW - i.left - i.right);
  const availH = Math.max(1, winH - i.top - i.bottom);
  let scale = Math.min(availW / stageW, availH / stageH);
  const fillW = availW / stageW;
  if (fillW > scale && stageH * fillW <= availH + Math.min(BORROW_PX, i.top + i.bottom)) scale = fillW;
  const width = stageW * scale, height = stageH * scale;
  // Centre of the safe box, then kept inside the window: a stage taller than the
  // safe box reaches into whichever inset band has room.
  const cy = Math.min(Math.max(i.top + availH / 2, height / 2), winH - height / 2);
  return { width, height, x: i.left + availW / 2, y: cy };
}
