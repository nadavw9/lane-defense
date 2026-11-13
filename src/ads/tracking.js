// App Tracking Transparency, asked so the alert actually appears.
//
// iOS shows the ATT alert only while the app is ACTIVE. A request made during launch (before the
// app becomes active) is dropped without an alert and the status stays notDetermined: App Review
// rejected build 20 (13 Nov 2026, guideline 2.1) because it never saw the prompt. So: wait until
// the app is active, let the launch settle, ask; if the status is still notDetermined (the alert
// was dropped), ask again on the player's first tap, which can only happen in an active app.
// The first ad request comes levels later, so the prompt still precedes any tracking.

/**
 * @param {object} d
 * @param {() => Promise<{status: string}>} d.status       current ATT status
 * @param {() => Promise<unknown>} d.request               show the system alert
 * @param {() => Promise<boolean>} d.isActive              is the app active now
 * @param {(cb: () => void) => void} d.onActive            call cb once when the app becomes active
 * @param {(cb: () => void) => void} d.onFirstTap          call cb once on the next tap
 * @param {() => Promise<void>} d.settle                   short pause after launch
 */
export async function askTracking(d) {
  try {
    if ((await d.status()).status !== 'notDetermined') return;
    if (!(await d.isActive())) await new Promise((resolve) => d.onActive(resolve));
    await d.settle();
    await d.request();
    if ((await d.status()).status !== 'notDetermined') return;
    d.onFirstTap(async () => {
      try {
        if ((await d.status()).status === 'notDetermined') await d.request();
      } catch (e) {
        console.warn('[tracking] second request failed:', e);
      }
    });
  } catch (e) {
    console.warn('[tracking] authorization failed:', e);
  }
}
