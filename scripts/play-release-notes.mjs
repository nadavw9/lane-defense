// Play release notes — writes play/whatsnew/whatsnew-<lang> onto a release that is ALREADY on a
// Play track (the android-release workflow uploads the bundle; this attaches or replaces the notes
// afterwards without a new build). Runs in GitHub Actions (.github/workflows/play-release-notes.yml)
// with the service account in PLAY_SERVICE_ACCOUNT_JSON; it never prints the key.
//
//   PLAY_SERVICE_ACCOUNT_JSON=<json> TRACK=internal [VERSION_CODE=120] node scripts/play-release-notes.mjs
//
// Without VERSION_CODE the newest release on the track (highest version code) gets the notes.
import { createSign } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGE = 'com.nadavw.trafficbomb';
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const MAX_CHARS = 500;   // Play's limit per language

const saJson = process.env.PLAY_SERVICE_ACCOUNT_JSON;
if (!saJson) { console.error('PLAY_SERVICE_ACCOUNT_JSON is not set'); process.exit(1); }
const sa = JSON.parse(saJson);
const track = process.env.TRACK || 'internal';
const wantCode = process.env.VERSION_CODE ? String(Number(process.env.VERSION_CODE)) : null;
const notesDir = process.env.NOTES_DIR || 'play/whatsnew';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: sa.token_uri, iat: now, exp: now + 3600,
  }));
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(sa.private_key);
  const assertion = `${header}.${claims}.${b64url(signature)}`;
  const r = await fetch(sa.token_uri, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!r.ok) throw new Error(`token request failed: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

function loadNotes() {
  const files = readdirSync(notesDir).filter(f => f.startsWith('whatsnew-'));
  if (!files.length) throw new Error(`no whatsnew-<lang> files in ${notesDir}`);
  return files.map(f => {
    const language = f.slice('whatsnew-'.length);
    const text = readFileSync(join(notesDir, f), 'utf8').replace(/\r\n/g, '\n').trim();
    const len = [...text].length;
    if (len > MAX_CHARS) throw new Error(`${f} is ${len} chars; Play allows ${MAX_CHARS}`);
    return { language, text };
  });
}

async function main() {
  const notes = loadNotes();
  const token = await accessToken();
  const call = async (method, path, body) => {
    const r = await fetch(`${API}${path}`, {
      method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  };

  const edit = await call('POST', '/edits', {});
  const t = await call('GET', `/edits/${edit.id}/tracks/${track}`);
  const releases = t.releases ?? [];
  if (!releases.length) throw new Error(`track ${track} has no releases`);
  const codeOf = (rel) => Math.max(...(rel.versionCodes ?? []).map(Number));
  const target = wantCode
    ? releases.find(rel => (rel.versionCodes ?? []).includes(wantCode))
    : releases.reduce((a, b) => (codeOf(b) > codeOf(a) ? b : a));
  if (!target) throw new Error(`no release with version code ${wantCode} on ${track}; have ${releases.map(r => r.versionCodes?.join('/')).join(', ')}`);

  target.releaseNotes = notes;
  await call('PUT', `/edits/${edit.id}/tracks/${track}`, { track, releases });
  await call('POST', `/edits/${edit.id}:commit`, null);
  console.log(`release notes set on ${track} release "${target.name}" (version codes ${target.versionCodes?.join(', ')}, status ${target.status}) for ${notes.map(n => n.language).join(', ')}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
