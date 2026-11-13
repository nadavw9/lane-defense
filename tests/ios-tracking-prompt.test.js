// App Review (13 Nov 2026, guideline 2.1) could not find the App Tracking Transparency prompt.
// iOS shows the alert only while the app is ACTIVE; the old code asked during launch, where the
// request is dropped without an alert and the status stays notDetermined. askTracking waits for
// an active app before asking, and asks again on the next tap if the alert still never appeared.
import { describe, it, expect, vi } from 'vitest';
import { askTracking } from '../src/ads/tracking.js';

function deps({ statuses, active = true }) {
  const seq = [...statuses];
  let tapCb = null, activeCb = null;
  const d = {
    status: vi.fn(async () => ({ status: seq.length > 1 ? seq.shift() : seq[0] })),
    request: vi.fn(async () => {}),
    isActive: vi.fn(async () => active),
    onActive: vi.fn((cb) => { activeCb = cb; }),
    onFirstTap: vi.fn((cb) => { tapCb = cb; }),
    settle: vi.fn(async () => {}),
    tap: () => tapCb?.(),
    becomeActive: () => activeCb?.(),
  };
  return d;
}

describe('askTracking', () => {
  it('does nothing when the player already answered', async () => {
    const d = deps({ statuses: ['authorized'] });
    await askTracking(d);
    expect(d.request).not.toHaveBeenCalled();
  });

  it('asks once the app is active, after letting the launch settle', async () => {
    const d = deps({ statuses: ['notDetermined', 'denied'] });
    await askTracking(d);
    expect(d.settle).toHaveBeenCalled();
    expect(d.request).toHaveBeenCalledTimes(1);
    expect(d.onFirstTap).not.toHaveBeenCalled();
  });

  it('waits for the app to become active before asking', async () => {
    const d = deps({ statuses: ['notDetermined', 'authorized'], active: false });
    const done = askTracking(d);
    await Promise.resolve(); await Promise.resolve();
    expect(d.request).not.toHaveBeenCalled();
    d.becomeActive();
    await done;
    expect(d.request).toHaveBeenCalledTimes(1);
  });

  it('asks again on the first tap when the alert was dropped', async () => {
    const d = deps({ statuses: ['notDetermined', 'notDetermined', 'notDetermined', 'authorized'] });
    await askTracking(d);
    expect(d.request).toHaveBeenCalledTimes(1);
    expect(d.onFirstTap).toHaveBeenCalledTimes(1);
    d.tap();
    await vi.waitFor(() => expect(d.request).toHaveBeenCalledTimes(2));
  });

  it('never throws when the plugin fails', async () => {
    const d = deps({ statuses: ['notDetermined'] });
    d.request.mockRejectedValue(new Error('boom'));
    await expect(askTracking(d)).resolves.toBeUndefined();
  });
});
