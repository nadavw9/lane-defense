#!/usr/bin/env node
// sync-claude-md.mjs — surgical CLAUDE.md sync after commits.
//
// Usage:
//   node scripts/sync-claude-md.mjs
//
// As a post-commit hook (.git/hooks/post-commit):
//   #!/bin/sh
//   node scripts/sync-claude-md.mjs
//
// Uses Claude Code's existing auth — no ANTHROPIC_API_KEY needed.
// Skips run: if no non-CLAUDE.md commits since last CLAUDE.md update.

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

function getAuthToken() {
  try {
    const creds = JSON.parse(readFileSync(join(homedir(), '.claude', '.credentials.json'), 'utf8'));
    return creds?.claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}

// Git log since the last commit that touched CLAUDE.md.
// If CLAUDE.md was never committed, falls back to last 10 commits.
function getRecentLog() {
  try {
    const lastClaudeMdHash = execSync(
      'git log --diff-filter=M --follow -n 1 --format="%H" -- CLAUDE.md',
      { encoding: 'utf8' },
    ).trim();

    if (!lastClaudeMdHash) {
      return execSync('git log --oneline -10', { encoding: 'utf8' }).trim();
    }

    const log = execSync(
      `git log --oneline ${lastClaudeMdHash}..HEAD`,
      { encoding: 'utf8' },
    ).trim();

    // No new commits after the last CLAUDE.md sync — nothing to do.
    if (!log) return null;
    return log;
  } catch {
    return execSync('git log --oneline -10', { encoding: 'utf8' }).trim();
  }
}

const gitLog = getRecentLog();
if (gitLog === null) {
  console.log('ℹ️  No new commits since last CLAUDE.md update — skipping sync.');
  process.exit(0);
}

const claudeMd = readFileSync('CLAUDE.md', 'utf8');

const prompt = `You are maintaining CLAUDE.md for a mobile game project called Lane Defense.

Current CLAUDE.md:
${claudeMd}

Git commits since the last CLAUDE.md update:
${gitLog}

Your job: identify and fix ONLY the parts of CLAUDE.md that are now wrong or contradicted by the recent commits. Make surgical corrections:
- If a commit removed a system (gate, HP bars, survival mode), update any section that still references it
- If a commit added a system (AdMob, new mechanic, new screen), add or update the relevant section
- If the self-audit checklist references something deleted, fix the checklist
- If TODO / production gates changed status, update them
- If a commit changes a constant, color, or threshold, update the matching table or note
- Do NOT rewrite accurate sections — keep them word-for-word
- Do NOT add commentary or meta-notes about what you changed
- Do NOT truncate the file — return the complete CLAUDE.md

Return the corrected CLAUDE.md in full.`;

async function run() {
  console.log('🔄 Syncing CLAUDE.md with recent commits…');

  try {
    const authToken = getAuthToken();
    const client = authToken ? new Anthropic({ authToken }) : new Anthropic();
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      messages:   [{ role: 'user', content: prompt }],
    });
    const updated = response.content?.[0]?.text;

    if (!updated || updated.length < 200) {
      console.log('⚠️  Haiku returned no content — CLAUDE.md not changed.');
      process.exit(0);
    }

    writeFileSync('CLAUDE.md', updated, 'utf8');
    console.log('✅ CLAUDE.md synced.');
  } catch (e) {
    console.log('⚠️  sync-claude-md failed: ' + e.message);
    process.exit(0);
  }
}

run();
