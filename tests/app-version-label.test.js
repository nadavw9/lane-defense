// PrimeTestLab report 10454 (14 Nov 2026, M-01): Settings said "v1.1.0" on build 1.1.25 (125); the
// label was a hard-coded constant. It now comes from the installed app (native) or the build.
import { describe, it, expect } from 'vitest';
import { versionLabel } from '../src/game/appVersion.js';

describe('versionLabel', () => {
  it('uses the installed app version and build on native', () => {
    expect(versionLabel({ VITE_APP_VERSION: '1.1.25' }, { version: '1.1.25', build: '125' })).toBe('v1.1.25 (125)');
    expect(versionLabel({}, { version: '1.0', build: '22' })).toBe('v1.0 (22)');
  });

  it('falls back to the build label, then to dev', () => {
    expect(versionLabel({ VITE_APP_VERSION: '1.1.25' })).toBe('v1.1.25');
    expect(versionLabel({})).toBe('dev');
  });

  it('skips a build number that repeats nothing useful', () => {
    expect(versionLabel({}, { version: '1.1.25', build: '' })).toBe('v1.1.25');
  });
});
