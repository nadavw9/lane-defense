// TestFlight rollout (2026-10-31, owner rule: "make sure from now on you always do this").
// An uploaded build is NOT delivered by the public link until it is (1) in the external group and
// (2) submitted to and approved by Apple's beta review; until then the link keeps serving the last
// approved build (the owner's wife got build 12 while 15 and 16 sat at READY_FOR_BETA_SUBMISSION).
// Run by ios-release.yml right after the upload; also runnable by hand.
//
//   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8_BASE64   App Store Connect API key (the upload key)
//   BUILD_NUMBER                                   the build to release (CURRENT_PROJECT_VERSION)
//   ASC_APP_ID        default 6827777380           Traffic Bomb
//   TESTFLIGHT_GROUP  default the "Friends" group  f452c867-9057-497d-b682-4ecf7b891f7d
//   WAIT_MINUTES      default 40                   how long to wait for Apple to process the build
//
// Steps: wait for processingState VALID -> add to the group (204; "already" is fine) -> submit for
// beta review (201; an existing submission is fine) -> report externalBuildState. Exit 1 only when
// the build never appears or a call fails outright, so the workflow shows the gap.
import crypto from 'node:crypto';
import https from 'node:https';

const env = (k, d) => (process.env[k] ?? d);
const KID = env('ASC_KEY_ID'), ISS = env('ASC_ISSUER_ID'), P8B64 = env('ASC_KEY_P8_BASE64');
const BUILD = String(env('BUILD_NUMBER', '')).trim();
const APP = env('ASC_APP_ID', '6827777380');
const GROUP = env('TESTFLIGHT_GROUP', 'f452c867-9057-497d-b682-4ecf7b891f7d');
const WAIT_MIN = Number(env('WAIT_MINUTES', '40'));
if (!KID || !ISS || !P8B64 || !BUILD) { console.error('testflight-release: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8_BASE64 and BUILD_NUMBER are required'); process.exit(1); }
const pem = Buffer.from(P8B64, 'base64').toString('utf8');

const b64u = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'ES256', kid: KID, typ: 'JWT' }));
  const p = b64u(JSON.stringify({ iss: ISS, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
  const sig = crypto.sign('sha256', Buffer.from(h + '.' + p), { key: pem, dsaEncoding: 'ieee-p1363' });
  return h + '.' + p + '.' + b64u(sig);
}
function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.appstoreconnect.apple.com', path, method,
      headers: { Authorization: 'Bearer ' + jwt(), Accept: 'application/json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) },
    }, (res) => { let out = ''; res.on('data', c => out += c); res.on('end', () => resolve({ status: res.statusCode, json: safe(out) })); });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}
const safe = (s) => { try { return JSON.parse(s); } catch { return { raw: s }; } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const errText = (r) => (r.json?.errors ?? []).map(e => `${e.status} ${e.code}: ${e.detail ?? e.title}`).join('; ') || JSON.stringify(r.json).slice(0, 300);

// 1. The build, once Apple has processed it.
let build = null;
const deadline = Date.now() + WAIT_MIN * 60_000;
while (Date.now() < deadline) {
  const r = await call('GET', `/v1/builds?filter[app]=${APP}&filter[version]=${BUILD}&fields[builds]=version,processingState&limit=1`);
  if (r.status !== 200) { console.error('builds query failed:', r.status, errText(r)); process.exit(1); }
  const b = r.json.data?.[0];
  if (b?.attributes?.processingState === 'VALID') { build = b; break; }
  console.log(`build ${BUILD}: ${b ? b.attributes.processingState : 'not uploaded yet'}; waiting`);
  await sleep(60_000);
}
if (!build) { console.error(`build ${BUILD} was not VALID within ${WAIT_MIN} minutes`); process.exit(1); }
console.log(`build ${BUILD} VALID (${build.id})`);

// 2. Into the external group.
// The group-side link answered 404 for build 21 (12 Nov 2026) while the build-side one worked, so
// the build-side link goes first and the group-side one is the fallback.
let add = await call('POST', `/v1/builds/${build.id}/relationships/betaGroups`, { data: [{ type: 'betaGroups', id: GROUP }] });
if (add.status === 404) add = await call('POST', `/v1/betaGroups/${GROUP}/relationships/builds`, { data: [{ type: 'builds', id: build.id }] });
if (add.status === 204) console.log('added to the group', GROUP);
else if (add.status === 409 || /already/i.test(errText(add))) console.log('already in the group');
else { console.error('adding to the group failed:', add.status, errText(add)); process.exit(1); }

// 3. Beta review submission (external testers only see approved builds). A build that was already
//    submitted answers 422 INVALID_QC_STATE to a second submission, so look first.
const existing = await call('GET', `/v1/builds/${build.id}/betaAppReviewSubmission`);
const state = existing.json?.data?.attributes?.betaReviewState;
if (state) console.log('beta review already submitted:', state);
else {
  const sub = await call('POST', '/v1/betaAppReviewSubmissions', { data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: build.id } } } } });
  if (sub.status === 201) console.log('submitted for beta review:', sub.json.data?.attributes?.betaReviewState);
  else { console.error('beta review submission failed:', sub.status, errText(sub)); process.exit(1); }
}

// 4. Where it stands now (Apple usually approves follow-up builds within minutes to hours).
const det = await call('GET', `/v1/builds/${build.id}/buildBetaDetail`);
const ext = det.json?.data?.attributes?.externalBuildState;
console.log(`externalBuildState: ${ext}${ext === 'IN_BETA_TESTING' ? ' (the public link serves this build)' : ' (the link serves it once Apple approves)'}`);
