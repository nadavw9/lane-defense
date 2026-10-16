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
  const i = safeInsets();
  const availW = Math.max(1, window.innerWidth - i.left - i.right);
  const availH = Math.max(1, window.innerHeight - i.top - i.bottom);
  const scale = Math.min(availW / stageW, availH / stageH);
  return {
    width:  `${stageW * scale}px`,
    height: `${stageH * scale}px`,
    // Centre of the safe box, not of the window.
    left:   `calc(50% + ${(i.left - i.right) / 2}px)`,
    top:    `calc(50% + ${(i.top - i.bottom) / 2}px)`,
  };
}
