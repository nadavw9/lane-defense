#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
const THRESHOLD = 0.40;
const FLAG_FILE = join(tmpdir(), 'lane-defense-handoff-fired.flag');
const HANDOFF_PATH = 'SESSION_HANDOFF.md';
async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
    setTimeout(() => resolve(data), 3000);
  });
}
async function main() {
let payload;
const raw = await readStdin();
if (!raw) process.exit(0);
try { payload = JSON.parse(raw); } catch { process.exit(0); }
const cw = payload?.context_window;
if (!cw) process.exit(0);
const usage = cw.current_tokens / cw.max_tokens;
if (usage < THRESHOLD) process.exit(0);
if (existsSync(FLAG_FILE)) process.exit(0);
writeFileSync(FLAG_FILE, Date.now().toString());
console.log('\n⚡ Context at ' + Math.round(usage * 100) + '% — updating SESSION_HANDOFF.md via Haiku...');
let claudeMd = '';
let gitLog = '';
let currentHandoff = '';
try { claudeMd = readFileSync('CLAUDE.md', 'utf8').slice(0, 3000); } catch {}
try { gitLog = execSync('git log --oneline -20', { encoding: 'utf8' }); } catch {}
try { currentHandoff = readFileSync(HANDOFF_PATH, 'utf8').slice(0, 2000); } catch {}
const sessionSummary = payload?.session_summary || 'Tool used: ' + payload?.tool_name;
const prompt = `You are updating a session handoff file for a mobile game project called Lane Defense.
CLAUDE.md (truncated):
${claudeMd}
Recent git commits:
${gitLog}
Current SESSION_HANDOFF.md:
${currentHandoff}
Recent session activity:
${sessionSummary}
Write an updated SESSION_HANDOFF.md that captures:

Current phase and what was just worked on this session
What was shipped (list the commits from this session)
Open issues in priority order
Any new architecture decisions or patterns discovered
Exact next steps for the next session
Any bugs discovered but not yet fixed

Format it as clean markdown starting with:
Lane Defense — Session Handoff
Keep it under 600 lines. Be specific and technical. This file will be dropped into a fresh Claude chat to resume work with zero context loss.`;
try {
const response = await fetch('https://api.anthropic.com/v1/messages', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
'anthropic-version': '2023-06-01',
},
body: JSON.stringify({
model: 'claude-haiku-4-5-20251001',
max_tokens: 4000,
messages: [{ role: 'user', content: prompt }]
})
});
const data = await response.json();
const text = data?.content?.[0]?.text;
if (text) {
writeFileSync(HANDOFF_PATH, text, 'utf8');
console.log('✅ SESSION_HANDOFF.md updated.');
} else {
console.log('⚠️  Haiku returned no content — SESSION_HANDOFF.md not updated.');
}
} catch (e) {
console.log('⚠️  Haiku call failed: ' + e.message);
}
console.log('\n' + '═'.repeat(60));
console.log('📋 CONTEXT AT ' + Math.round(usage * 100) + '% — START A NEW SESSION');
console.log('═'.repeat(60));
console.log('SESSION_HANDOFF.md updated. To continue:');
console.log('  1. Start a new Claude Code session');
console.log('  2. claude --dangerously-skip-permissions');
console.log('  3. First message: "Continue Lane Defense. Read CLAUDE.md and SESSION_HANDOFF.md."');
console.log('═'.repeat(60) + '\n');
}
main();
