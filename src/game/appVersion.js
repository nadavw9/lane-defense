// The version line in Settings > About. It used to be a hard-coded 'v1.1.0', so testers quoted the
// wrong build (PrimeTestLab report 10454, 14 Nov 2026). On native the installed app's own version
// and build win (Capacitor App.getInfo); otherwise the build label CI bakes in (VITE_APP_VERSION).

/** @param {{VITE_APP_VERSION?: string}} env  @param {{version?: string, build?: string}} [info] */
export function versionLabel(env, info) {
  if (info?.version) return info.build ? `v${info.version} (${info.build})` : `v${info.version}`;
  return env?.VITE_APP_VERSION ? `v${env.VITE_APP_VERSION}` : 'dev';
}
