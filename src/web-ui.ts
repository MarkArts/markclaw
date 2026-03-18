/**
 * MarkClaw Web UI — lightweight HTTP server for monitoring sessions.
 * Reads SQLite DB, transcript JSONL files, and log files.
 * Serves a single-page app with SSE for live tailing.
 */

import { execFile, spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import { URL, URLSearchParams } from 'url';

import {
  CONTAINER_IMAGE,
  DATA_DIR,
  GROUPS_DIR as CFG_GROUPS_DIR,
  STORE_DIR,
  TIMEZONE,
} from './config.js';
import {
  CONTAINER_RUNTIME_BIN,
  readonlyMountArgs,
} from './container-runtime.js';
import { readRetryEvents, pruneRetryEvents } from './group-queue.js';
import { logger } from './logger.js';
import { triggerTaskNow } from './task-scheduler.js';

const WEB_UI_PORT = parseInt(process.env.WEB_UI_PORT || '8080', 10);
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const LOGS_DIR = path.resolve(process.cwd(), 'logs');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const MAX_RETRIES_DISPLAY = 5; // Must match MAX_RETRIES in group-queue.ts
const DB_PATH = path.join(STORE_DIR, 'messages.db');
const GROUPS_DIR = path.resolve(process.cwd(), 'groups');
const GITHUB_ORG = process.env.GITHUB_ORG || '';
const JIRA_SITE = process.env.JIRA_SITE || '';

// --- Work tab cache ---
interface WorkCache {
  prs: any[];
  tickets: any[];
  timestamp: number;
}
let workCache: WorkCache | null = null;
let workCacheRefreshing = false;
const WORK_CACHE_TTL = 60000; // 60s

// Read shared env for GH_TOKEN, Jira creds etc.
function readSharedEnv(): Record<string, string> {
  const envFile = path.join(GROUPS_DIR, 'global', '.env-shared');
  const vars: Record<string, string> = {};
  try {
    const content = fs.readFileSync(envFile, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.replace(/^export\s+/, '').trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq);
      let val = trimmed.slice(eq + 1);
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  } catch {
    /* file may not exist */
  }
  return vars;
}

// Read project .env for API keys
function readDotEnv(): Record<string, string> {
  const envFile = path.resolve(process.cwd(), '.env');
  const vars: Record<string, string> = {};
  try {
    const content = fs.readFileSync(envFile, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.replace(/^export\s+/, '').trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq);
      let val = trimmed.slice(eq + 1);
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  } catch {
    /* file may not exist */
  }
  return vars;
}

// Strip ANSI escape codes from log lines
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07/g;

// Lazy-import better-sqlite3 to avoid loading it at module scope
// (the main DB is managed by db.ts; we open a separate read-only connection)
let getReadDb: () => import('better-sqlite3').Database;

async function initReadDb(): Promise<void> {
  const { default: Database } = await import('better-sqlite3');
  let readDb: import('better-sqlite3').Database | null = null;
  getReadDb = () => {
    if (!readDb) {
      readDb = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    }
    return readDb!;
  };
}

function jsonResponse(
  res: http.ServerResponse,
  data: unknown,
  status = 200,
): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function serveStatic(res: http.ServerResponse, filename: string): void {
  const safe = path.basename(filename);
  const filepath = path.join(PUBLIC_DIR, safe);
  if (!fs.existsSync(filepath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(safe);
  const contentTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
  };
  const ct = contentTypes[ext] || 'text/plain';
  const body = fs.readFileSync(filepath);
  res.writeHead(200, {
    'Content-Type': ct,
    'Content-Length': body.length,
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

function getTranscriptPath(groupFolder: string): string | null {
  const sessionDir = path.join(
    SESSIONS_DIR,
    groupFolder,
    '.claude',
    'projects',
  );
  if (!fs.existsSync(sessionDir)) return null;

  // Try known session ID first (fastest)
  const db = getReadDb();
  const row = db
    .prepare('SELECT session_id FROM sessions WHERE group_folder = ?')
    .get(groupFolder) as { session_id: string } | undefined;

  for (const subdir of fs.readdirSync(sessionDir)) {
    const full = path.join(sessionDir, subdir);
    if (!fs.statSync(full).isDirectory()) continue;

    // If we have a session ID, look for that specific file
    if (row) {
      const jsonl = path.join(full, `${row.session_id}.jsonl`);
      if (fs.existsSync(jsonl)) return jsonl;
    }

    // Fallback: find any .jsonl file (for running containers whose session isn't saved yet)
    // Pick the most recently modified one
    const jsonlFiles = fs.readdirSync(full).filter((f) => f.endsWith('.jsonl'));
    if (jsonlFiles.length > 0) {
      let newest = jsonlFiles[0];
      let newestMtime = 0;
      for (const f of jsonlFiles) {
        const mtime = fs.statSync(path.join(full, f)).mtimeMs;
        if (mtime > newestMtime) {
          newestMtime = mtime;
          newest = f;
        }
      }
      return path.join(full, newest);
    }
  }

  return null;
}

interface TranscriptBlock {
  type: string;
  text?: string;
  name?: string;
  id?: string;
  input?: unknown;
  tool_use_id?: string;
  is_error?: boolean;
}

interface TranscriptMessage {
  line: number;
  type: 'user' | 'assistant';
  uuid: string;
  timestamp: string;
  model?: string;
  content: TranscriptBlock[];
}

interface TranscriptStats {
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  lastEntryType: string | null;
  lastActivity: string | null;
  needsUserAction: boolean;
  userActionReason: string | null;
}

function getTranscriptStats(filepath: string): TranscriptStats {
  const stats: TranscriptStats = {
    messageCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    lastEntryType: null,
    lastActivity: null,
    needsUserAction: false,
    userActionReason: null,
  };
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      const type = entry.type;
      if (type === 'user' || type === 'assistant') {
        stats.messageCount++;
        stats.lastEntryType = type;
        const usage = entry.message?.usage;
        if (usage) {
          stats.totalInputTokens +=
            (usage.input_tokens || 0) +
            (usage.cache_read_input_tokens || 0) +
            (usage.cache_creation_input_tokens || 0);
          stats.totalOutputTokens += usage.output_tokens || 0;
        }
      }
    } catch {
      /* skip malformed lines */
    }
  }

  // Extract last activity from the tail of the transcript
  stats.lastActivity = extractLastActivity(lines);
  const actionResult = detectNeedsUserAction(lines);
  stats.needsUserAction = actionResult.needed;
  stats.userActionReason = actionResult.reason;
  return stats;
}

/**
 * Scan the last N entries of the transcript to produce a short activity label
 * like "editing src/foo.ts", "running tests", "reading PR #42"
 */
function extractLastActivity(lines: string[]): string | null {
  // Scan from the end to find the most recent meaningful action
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 30); i--) {
    const line = lines[i]?.trim();
    if (!line) continue;
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.type !== 'assistant') continue;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;

    for (let j = content.length - 1; j >= 0; j--) {
      const block = content[j];

      // Tool use → describe the action
      if (block.type === 'tool_use') {
        const name: string = block.name || '';
        const input = block.input || {};
        return summarizeToolUse(name, input);
      }

      // Text → take the first sentence (truncated)
      if (block.type === 'text' && block.text?.trim()) {
        const text: string = block.text.trim();
        const firstLine = text.split('\n')[0].slice(0, 60);
        // Truncate to ~5 words
        const words = firstLine.split(/\s+/).slice(0, 6);
        return (
          words.join(' ') + (firstLine.split(/\s+/).length > 6 ? '...' : '')
        );
      }
    }
  }
  return null;
}

function summarizeToolUse(name: string, input: Record<string, any>): string {
  // Map tool names to readable activity labels
  const file = input.file_path || input.path || input.file || '';
  const shortFile = file ? file.split('/').slice(-2).join('/') : '';

  switch (name) {
    case 'Read':
      return shortFile ? `reading ${shortFile}` : 'reading file';
    case 'Edit':
      return shortFile ? `editing ${shortFile}` : 'editing file';
    case 'Write':
      return shortFile ? `writing ${shortFile}` : 'writing file';
    case 'Bash':
      return describeBash(input.command || input.description || '');
    case 'Grep':
    case 'Glob':
      return input.pattern
        ? `searching for "${String(input.pattern).slice(0, 30)}"`
        : 'searching codebase';
    case 'Agent':
      return 'delegating to subagent';
    case 'WebFetch':
    case 'WebSearch':
      return 'browsing web';
    default:
      // MCP tools
      if (name.startsWith('mcp__markclaw__send_message'))
        return 'sending message';
      if (name.startsWith('mcp__markclaw__start_thread'))
        return 'starting thread task';
      if (name.startsWith('mcp__markclaw__'))
        return name.replace('mcp__markclaw__', '').replace(/_/g, ' ');
      return name.replace(/_/g, ' ').slice(0, 40);
  }
}

/**
 * Detect if the last assistant message is requesting user action (not just a task completion).
 * Looks for: questions, URLs to visit, explicit requests to do something, SSO prompts, PR reviews, etc.
 */
function detectNeedsUserAction(lines: string[]): {
  needed: boolean;
  reason: string | null;
} {
  const no = { needed: false, reason: null };
  // Find the last assistant entry
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
    const line = lines[i]?.trim();
    if (!line) continue;
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type !== 'assistant') continue;

    const content = entry.message?.content;
    if (!Array.isArray(content)) return no;

    // Collect all text from the last assistant message
    let fullText = '';
    for (const block of content) {
      if (block.type === 'text' && block.text) fullText += block.text + '\n';
    }
    if (!fullText.trim()) return no;

    // Patterns that indicate the agent is requesting user action, with human-readable reasons
    const actionPatterns: Array<{ pattern: RegExp; reason: string }> = [
      // Authentication / authorization
      {
        pattern: /\bsso\s+(login|link|url|auth)/i,
        reason: 'SSO authentication needed',
      },
      {
        pattern: /\bverification\s+(url|link|code)\b/i,
        reason: 'Verification needed',
      },
      {
        pattern: /\bplease\s+(authorize|authenticate)\b/i,
        reason: 'Authentication needed',
      },
      // Blocked on external events (CI, merge, deploy, approval)
      { pattern: /\bwaiting for\s+ci\b/i, reason: 'Blocked on CI' },
      {
        pattern:
          /\bwaiting for\s+(the\s+)?(pipeline|build|checks?|tests?|actions?)\b/i,
        reason: 'Blocked on CI',
      },
      {
        pattern: /\bwaiting for\s+(the\s+)?(pr|pull request|merge)\b/i,
        reason: 'Waiting for merge',
      },
      {
        pattern: /\bwaiting for\s+(the\s+)?(deploy|deployment|release)\b/i,
        reason: 'Waiting for deploy',
      },
      {
        pattern:
          /\bonce\s+(it'?s|the\s+pr\s+is|ci|the\s+build\s+is)\s+(merged|passing|complete|done|deployed)\b/i,
        reason: 'Blocked — needs merge/CI',
      },
      {
        pattern: /\bonce\s+(merged|deployed|approved|released)\b/i,
        reason: 'Blocked — needs merge/CI',
      },
      {
        pattern:
          /\bafter\s+(it'?s|the\s+pr\s+is|ci)\s+(merged|passing|complete)\b/i,
        reason: 'Blocked — needs merge/CI',
      },
      // Direct user action requests
      {
        pattern:
          /\bwaiting for\s+(you|your|approval|confirmation|input|response)\b/i,
        reason: 'Waiting for your response',
      },
      {
        pattern:
          /\breview\s+(the|this)\s+(pr|pull request|merge request|changes)\b/i,
        reason: 'PR review requested',
      },
      {
        pattern: /\bplease\s+(visit|open|click|go to|navigate)\b/i,
        reason: 'Link needs your attention',
      },
      {
        pattern: /\bplease\s+(review|approve|confirm|check|verify|merge)\b/i,
        reason: 'Approval needed',
      },
      {
        pattern: /\byou\s+(need to|must)\b/i,
        reason: 'Action required from you',
      },
      {
        pattern: /\byou\s+(should|can now|will need to)\b/i,
        reason: 'Follow-up suggested',
      },
      {
        pattern: /\bopen\s+(this|the)\s+(url|link)\b/i,
        reason: 'Link needs your attention',
      },
      // Questions / decisions
      { pattern: /\bcould you\b/i, reason: 'Question for you' },
      { pattern: /\bwould you\b/i, reason: 'Question for you' },
      { pattern: /\bcan you\b/i, reason: 'Question for you' },
      { pattern: /\bdo you want\b/i, reason: 'Decision needed' },
      { pattern: /\bshall i\b/i, reason: 'Decision needed' },
      { pattern: /\blet me know\b/i, reason: 'Waiting for your response' },
      {
        pattern: /\bhow (?:do you|would you|should i)\b/i,
        reason: 'Question for you',
      },
      { pattern: /\?\s*$/m, reason: 'Question for you' },
    ];

    // Patterns that indicate task completion (override the above)
    const completionPatterns = [
      /\b(?:done|completed|finished|all set|all good)\b.*[.!]\s*$/im,
      /\bsuccessfully\b/i,
      /\bhere(?:'s| is) (?:the|a) summary\b/i,
      /\bresults posted\b/i,
      /\bis now installed\b/i,
    ];

    let matchedReason: string | null = null;
    for (const { pattern, reason } of actionPatterns) {
      if (pattern.test(fullText)) {
        matchedReason = reason;
        break;
      }
    }

    if (matchedReason) {
      for (const p of completionPatterns) {
        if (p.test(fullText)) return no;
      }
      return { needed: true, reason: matchedReason };
    }

    return no;
  }
  return no;
}

function describeBash(cmd: string): string {
  const c = cmd.trim().split(/\s+/);
  const bin = c[0]?.replace(/^.*\//, '') || '';
  if (['npm', 'npx', 'yarn', 'pnpm'].includes(bin)) {
    const sub = c[1] || '';
    if (sub === 'run' && c[2]) return `running ${c[2]}`;
    if (sub === 'test') return 'running tests';
    if (sub === 'install') return 'installing deps';
    return `running ${bin} ${sub}`.slice(0, 40);
  }
  if (bin === 'git') return `git ${c[1] || ''}`.trim();
  if (bin === 'docker') return `docker ${c[1] || ''}`.trim();
  if (bin === 'gh') return `gh ${c.slice(1, 3).join(' ')}`.trim();
  if (bin === 'curl') return 'fetching URL';
  if (bin === 'aws') return `aws ${c.slice(1, 3).join(' ')}`.trim();
  if (['pulumi', 'terraform'].includes(bin))
    return `${bin} ${c[1] || ''}`.trim();
  if (['cat', 'head', 'tail', 'less'].includes(bin)) return 'reading output';
  if (['grep', 'rg', 'find'].includes(bin)) return 'searching files';
  if (['make', 'cargo', 'go'].includes(bin)) return `building (${bin})`;
  return cmd.slice(0, 40);
}

function parseTranscript(
  filepath: string,
  offset: number,
  limit: number,
): TranscriptMessage[] {
  const messages: TranscriptMessage[] = [];
  const lines = fs.readFileSync(filepath, 'utf-8').split('\n');

  for (let i = offset; i < lines.length && messages.length < limit; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const entryType = entry.type;
    if (
      entryType === 'queue-operation' ||
      entryType === 'system' ||
      entryType === 'progress'
    )
      continue;

    const ts: string = entry.timestamp || '';
    const uuid: string = entry.uuid || '';
    const msg = entry.message || {};

    if (entryType === 'user') {
      const content = msg.content;
      const parsed: TranscriptBlock[] = [];

      if (typeof content === 'string') {
        parsed.push({ type: 'text', text: content });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            parsed.push({ type: 'text', text: block.text || '' });
          } else if (block.type === 'tool_result') {
            let text: string;
            if (typeof block.content === 'string') {
              text = block.content;
            } else if (Array.isArray(block.content)) {
              text = block.content
                .filter((r: any) => r.type === 'text')
                .map((r: any) => r.text || '')
                .join('\n');
            } else {
              text = String(block.content || '');
            }
            parsed.push({
              type: 'tool_result',
              tool_use_id: block.tool_use_id || '',
              text: text.slice(0, 2000),
              is_error: block.is_error || false,
            });
          }
        }
      }
      if (parsed.length > 0) {
        messages.push({
          line: i,
          type: 'user',
          uuid,
          timestamp: ts,
          content: parsed,
        });
      }
    } else if (entryType === 'assistant') {
      const content = msg.content;
      const parsed: TranscriptBlock[] = [];

      if (typeof content === 'string') {
        parsed.push({ type: 'text', text: content });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'thinking') {
            parsed.push({
              type: 'thinking',
              text: (block.thinking || '').slice(0, 5000),
            });
          } else if (block.type === 'text') {
            parsed.push({ type: 'text', text: block.text || '' });
          } else if (block.type === 'tool_use') {
            const inp = block.input || {};
            const truncatedInput: Record<string, unknown> = {};
            if (typeof inp === 'object' && inp !== null) {
              for (const [k, v] of Object.entries(inp)) {
                truncatedInput[k] = typeof v === 'string' ? v.slice(0, 500) : v;
              }
            }
            parsed.push({
              type: 'tool_use',
              id: block.id || '',
              name: block.name || '',
              input: truncatedInput,
            });
          }
        }
      }
      if (parsed.length > 0) {
        messages.push({
          line: i,
          type: 'assistant',
          uuid,
          timestamp: ts,
          model: msg.model || '',
          content: parsed,
        });
      }
    }
  }

  return messages;
}

const BASIC_AUTH_USER = 'mark';
const BASIC_AUTH_PASS = 'mark';

function checkAuth(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): boolean {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="MarkClaw"' });
    res.end('Unauthorized');
    return false;
  }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString();
  const [user, pass] = decoded.split(':');
  if (user !== BASIC_AUTH_USER || pass !== BASIC_AUTH_PASS) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="MarkClaw"' });
    res.end('Unauthorized');
    return false;
  }
  return true;
}

function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  if (!checkAuth(req, res)) return;

  const parsed = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = parsed.pathname;
  const params = parsed.searchParams;

  try {
    if (pathname === '/api/groups') {
      handleGroups(res);
    } else if (pathname === '/api/messages') {
      const group = params.get('group') || 'slack_main';
      const limit = parseInt(params.get('limit') || '50', 10);
      handleMessages(res, group, limit);
    } else if (pathname === '/api/sessions') {
      handleSessions(res);
    } else if (pathname.startsWith('/api/transcript')) {
      const group = params.get('group') || 'slack_main';
      const offset = parseInt(params.get('offset') || '0', 10);
      const limit = parseInt(params.get('limit') || '200', 10);
      handleTranscript(res, group, offset, limit);
    } else if (pathname.startsWith('/api/stream/')) {
      const group = pathname.slice('/api/stream/'.length);
      handleStream(res, group);
    } else if (pathname === '/api/containers') {
      handleContainers(res);
    } else if (pathname === '/api/schedules') {
      handleSchedules(res);
    } else if (pathname.startsWith('/api/schedule-runs/')) {
      const taskId = pathname.slice('/api/schedule-runs/'.length);
      const limit = parseInt(params.get('limit') || '20', 10);
      handleScheduleRuns(res, taskId, limit);
    } else if (pathname === '/api/send-message' && req.method === 'POST') {
      handleSendMessage(req, res);
      return;
    } else if (pathname === '/api/start-session' && req.method === 'POST') {
      handleStartSession(req, res);
      return;
    } else if (pathname === '/api/work-action' && req.method === 'POST') {
      handleWorkAction(req, res);
      return;
    } else if (pathname === '/api/deactivate' && req.method === 'POST') {
      handleDeactivate(req, res);
      return;
    } else if (pathname === '/api/delete-session' && req.method === 'POST') {
      handleDeleteSession(req, res);
      return;
    } else if (pathname === '/api/stop-container' && req.method === 'POST') {
      handleStopContainer(req, res);
      return;
    } else if (pathname === '/api/schedule-pause' && req.method === 'POST') {
      handleSchedulePause(req, res);
      return;
    } else if (pathname === '/api/schedule-resume' && req.method === 'POST') {
      handleScheduleResume(req, res);
      return;
    } else if (pathname === '/api/schedule-delete' && req.method === 'POST') {
      handleScheduleDelete(req, res);
      return;
    } else if (pathname === '/api/schedule-model' && req.method === 'POST') {
      handleScheduleModel(req, res);
      return;
    } else if (pathname === '/api/schedule-run-now' && req.method === 'POST') {
      handleScheduleRunNow(req, res);
      return;
    } else if (pathname === '/api/search') {
      const q = params.get('q') || '';
      const searchLimit = parseInt(params.get('limit') || '50', 10);
      handleSearch(res, q, searchLimit);
    } else if (pathname === '/api/github-prs') {
      handleGitHubPRs(res);
      return;
    } else if (pathname === '/api/jira-tickets') {
      handleJiraTickets(res);
      return;
    } else if (pathname === '/api/config') {
      jsonResponse(res, { jiraSite: JIRA_SITE, githubOrg: GITHUB_ORG });
      return;
    } else if (pathname === '/api/work') {
      handleWork(res);
      return;
    } else if (pathname === '/api/summarize' && req.method === 'POST') {
      handleSummarize(req, res);
      return;
    } else if (pathname === '/api/housekeeping' && req.method === 'POST') {
      handleHousekeeping(req, res);
      return;
    } else if (pathname === '/api/retry-events') {
      handleRetryEvents(res, params);
      return;
    } else if (pathname === '/api/costs') {
      handleCosts(res);
    } else if (pathname === '/api/logs') {
      const name = params.get('name') || 'markclaw';
      const lines = parseInt(params.get('lines') || '100', 10);
      handleLogFile(res, name, lines);
    } else if (pathname === '/' || pathname === '/index.html') {
      serveStatic(res, 'index.html');
    } else {
      serveStatic(res, pathname.slice(1));
    }
  } catch (err) {
    logger.error({ err, path: pathname }, 'Web UI request error');
    jsonResponse(res, { error: 'Internal server error' }, 500);
  }
}

/**
 * Resolve a human-readable display name for a group.
 * Looks up chat name from the chats table, and for thread JIDs
 * also resolves the parent channel name.
 */
function resolveDisplayName(
  db: import('better-sqlite3').Database,
  jid: string,
  name: string,
): string {
  const chat = db.prepare('SELECT name FROM chats WHERE jid = ?').get(jid) as
    | { name: string }
    | undefined;
  // For thread JIDs, also look up the parent channel name
  const parentJid =
    jid.includes(':') && jid.split(':').length === 3
      ? jid.split(':').slice(0, 2).join(':')
      : null;
  const parentChat = parentJid
    ? (db.prepare('SELECT name FROM chats WHERE jid = ?').get(parentJid) as
        | { name: string }
        | undefined)
    : undefined;
  // Use chat name if it differs from the raw JID (means it was synced from Slack)
  const chatName = chat?.name && chat.name !== jid ? chat.name : null;
  const parentName =
    parentChat?.name && parentChat.name !== parentJid ? parentChat.name : null;
  // Build display_name: prefer chat name, fall back to parent channel name for threads
  if (chatName) {
    return chatName;
  } else if (parentName) {
    // Thread: show "parent-channel > thread"
    const threadPart = name.replace(/^.*?-thread-/, 'thread-');
    return parentName + ' > ' + threadPart;
  }
  return name;
}

function handleGroups(res: http.ServerResponse): void {
  const db = getReadDb();
  const groups = db.prepare('SELECT * FROM registered_groups').all() as any[];

  const result = groups.map((g) => {
    const session = db
      .prepare('SELECT session_id FROM sessions WHERE group_folder = ?')
      .get(g.folder) as { session_id: string } | undefined;
    // Get last message time from the chats table
    const chat = db
      .prepare('SELECT name, last_message_time FROM chats WHERE jid = ?')
      .get(g.jid) as { name: string; last_message_time: string } | undefined;
    const displayName = resolveDisplayName(db, g.jid, g.name);
    const row: any = {
      ...g,
      display_name: displayName,
      session_id: session?.session_id || null,
      last_message_time: chat?.last_message_time || null,
    };
    // Always check transcript file — it exists even for running containers without saved session_id
    const tpath = getTranscriptPath(g.folder);
    if (tpath) {
      try {
        const stat = fs.statSync(tpath);
        row.transcript_size = stat.size;
        row.transcript_modified = stat.mtimeMs / 1000;
        const stats = getTranscriptStats(tpath);
        row.message_count = stats.messageCount;
        row.total_input_tokens = stats.totalInputTokens;
        row.total_output_tokens = stats.totalOutputTokens;
        row.last_entry_type = stats.lastEntryType;
        row.last_activity = stats.lastActivity;
        row.needs_user_action = stats.needsUserAction;
        row.user_action_reason = stats.userActionReason;
      } catch {
        /* file may have been removed */
      }
    }
    // Also check for unanswered user messages with questions (? in content)
    // Only for main DM sessions — thread sessions have multi-user conversations
    // where a ? is often directed at other people, not the agent.
    if (!row.needs_user_action && g.is_main) {
      try {
        const lastMsg = db
          .prepare(
            'SELECT content, is_from_me, is_bot_message, timestamp FROM messages WHERE chat_jid = ? ORDER BY timestamp DESC LIMIT 1',
          )
          .get(g.jid) as
          | {
              content: string;
              is_from_me: number;
              is_bot_message: number;
              timestamp: string;
            }
          | undefined;
        if (
          lastMsg &&
          !lastMsg.is_from_me &&
          !lastMsg.is_bot_message &&
          lastMsg.content?.includes('?')
        ) {
          // Only if it's recent (last 48h)
          const msgAge =
            (Date.now() - new Date(lastMsg.timestamp).getTime()) / 1000;
          if (msgAge < 48 * 3600) {
            row.needs_user_action = true;
            row.user_action_reason = 'Unanswered message';
            if (!row.last_activity)
              row.last_activity = lastMsg.content.slice(0, 200);
          }
        }
      } catch {
        /* best-effort */
      }
    }
    // Check for recent max-retries failures
    if (!row.needs_user_action) {
      try {
        const recentEvents = readRetryEvents(48 * 3600); // last 48h
        const exhausted = recentEvents.filter(
          (e) => e.type === 'max_retries_exceeded' && e.groupJid === g.jid,
        );
        if (exhausted.length > 0) {
          row.needs_user_action = true;
          row.user_action_reason = `Failed after ${MAX_RETRIES_DISPLAY} retries`;
          if (!row.last_activity)
            row.last_activity =
              'Agent hit rate limit or error — messages dropped';
        }
      } catch {
        /* best-effort */
      }
    }
    // Compute cost for this group from transcript
    if (tpath) {
      try {
        const groupCost = emptyCost();
        const throwaway = emptyCost();
        const dummyModel: Record<string, CostEntry> = {};
        const dummyDay: Record<string, CostEntry> = {};
        scanJsonlForCosts(tpath, throwaway, groupCost, dummyModel, dummyDay);
        row.cost = groupCost.cost;
      } catch {
        /* best-effort */
      }
    }
    return row;
  });

  // Sort: main group first, then by latest activity descending.
  // Use transcript_modified (file mtime, updates on every agent action) as primary,
  // fall back to last_message_time (Slack message timestamp) for groups without transcripts.
  result.sort((a: any, b: any) => {
    if (a.is_main && !b.is_main) return -1;
    if (!a.is_main && b.is_main) return 1;
    const ta =
      a.transcript_modified ||
      (a.last_message_time
        ? new Date(a.last_message_time).getTime() / 1000
        : 0);
    const tb =
      b.transcript_modified ||
      (b.last_message_time
        ? new Date(b.last_message_time).getTime() / 1000
        : 0);
    return tb - ta;
  });

  jsonResponse(res, result);
}

function handleMessages(
  res: http.ServerResponse,
  group: string,
  limit: number,
): void {
  const db = getReadDb();
  const grp = db
    .prepare('SELECT jid FROM registered_groups WHERE folder = ?')
    .get(group) as { jid: string } | undefined;
  if (!grp) {
    jsonResponse(res, { error: 'group not found' }, 404);
    return;
  }
  const messages = db
    .prepare(
      `SELECT id, sender_name, content, timestamp, is_from_me, is_bot_message
       FROM messages WHERE chat_jid = ?
       ORDER BY timestamp DESC LIMIT ?`,
    )
    .all(grp.jid, limit) as any[];
  jsonResponse(res, messages.reverse());
}

function handleSessions(res: http.ServerResponse): void {
  const db = getReadDb();
  const sessions = db.prepare('SELECT * FROM sessions').all() as any[];
  const result = sessions.map((s) => {
    const tpath = getTranscriptPath(s.group_folder);
    if (tpath) {
      const stat = fs.statSync(tpath);
      return {
        ...s,
        transcript_path: tpath,
        transcript_size: stat.size,
        transcript_modified: stat.mtimeMs / 1000,
      };
    }
    return s;
  });
  jsonResponse(res, result);
}

function handleTranscript(
  res: http.ServerResponse,
  group: string,
  offset: number,
  limit: number,
): void {
  const tpath = getTranscriptPath(group);
  if (!tpath) {
    jsonResponse(res, { error: 'transcript not found' }, 404);
    return;
  }
  const totalLines = fs
    .readFileSync(tpath, 'utf-8')
    .split('\n')
    .filter(Boolean).length;
  // Default to latest messages
  if (offset === 0 && limit < totalLines) {
    offset = Math.max(0, totalLines - limit);
  }
  const messages = parseTranscript(tpath, offset, limit);
  jsonResponse(res, { messages, total_lines: totalLines, offset, path: tpath });
}

function handleStream(res: http.ServerResponse, group: string): void {
  const tpath = getTranscriptPath(group);
  if (!tpath) {
    jsonResponse(res, { error: 'transcript not found' }, 404);
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    Connection: 'keep-alive',
  });

  const stat = fs.statSync(tpath);
  let pos = stat.size;

  const interval = setInterval(() => {
    try {
      const currentStat = fs.statSync(tpath);
      if (currentStat.size > pos) {
        const fd = fs.openSync(tpath, 'r');
        const buf = Buffer.alloc(currentStat.size - pos);
        fs.readSync(fd, buf, 0, buf.length, pos);
        fs.closeSync(fd);
        pos = currentStat.size;

        const newLines = buf.toString('utf-8').split('\n');
        for (const line of newLines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const entry = JSON.parse(trimmed);
            if (entry.type === 'queue-operation' || entry.type === 'system')
              continue;
            res.write(`data: ${JSON.stringify(entry)}\n\n`);
          } catch {
            // skip malformed lines
          }
        }
      }
      // Keepalive
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(interval);
    }
  }, 1000);

  res.on('close', () => clearInterval(interval));
}

function handleLogFile(
  res: http.ServerResponse,
  name: string,
  lineCount: number,
): void {
  const safeName = path.basename(name);
  const logPath = path.join(LOGS_DIR, `${safeName}.log`);
  if (!fs.existsSync(logPath)) {
    jsonResponse(res, { error: `log ${safeName} not found` }, 404);
    return;
  }
  const allLines = fs.readFileSync(logPath, 'utf-8').split('\n');
  const tail = allLines.slice(-lineCount).map((l) => l.replace(ANSI_RE, ''));
  jsonResponse(res, { lines: tail });
}

function handleContainers(res: http.ServerResponse): void {
  // Get markclaw containers with stats
  execFile(
    'docker',
    [
      'ps',
      '-a',
      '--filter',
      'name=markclaw-',
      '--format',
      '{{.Names}}\t{{.Status}}\t{{.CreatedAt}}\t{{.Size}}',
    ],
    { timeout: 5000 },
    (err, stdout) => {
      if (err) {
        jsonResponse(res, { error: `docker ps failed: ${err.message}` }, 500);
        return;
      }

      const containers = stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [name, status, created, size] = line.split('\t');
          const isRunning = status?.startsWith('Up') ?? false;
          // Extract group folder from container name: markclaw-<folder>-<timestamp>
          const match = name?.match(/^markclaw-(.+)-\d+$/);
          const groupFolder = match ? match[1].replace(/-/g, '_') : name;
          return { name, status, created, size, isRunning, groupFolder };
        });

      // Also get docker system stats
      execFile(
        'docker',
        [
          'system',
          'df',
          '--format',
          '{{.Type}}\t{{.TotalCount}}\t{{.Active}}\t{{.Size}}\t{{.Reclaimable}}',
        ],
        { timeout: 5000 },
        (err2, stdout2) => {
          const system = !err2
            ? stdout2
                .trim()
                .split('\n')
                .filter(Boolean)
                .map((line) => {
                  const [type, total, active, size, reclaimable] =
                    line.split('\t');
                  return { type, total, active, size, reclaimable };
                })
            : [];

          jsonResponse(res, { containers, system });
        },
      );
    },
  );
}

function handleSchedules(res: http.ServerResponse): void {
  const db = getReadDb();
  const tasks = db
    .prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC')
    .all() as any[];

  // Build index of JSONL files with their total cost and mtime for task group folders
  const groupFileCosts: Record<
    string,
    Array<{ mtime: number; cost: number }>
  > = {};

  function loadGroupFileCosts(
    groupFolder: string,
  ): Array<{ mtime: number; cost: number }> {
    if (groupFileCosts[groupFolder]) return groupFileCosts[groupFolder];
    const fileCosts: Array<{ mtime: number; cost: number }> = [];
    // Find the main session file to exclude it (it gets written to during conversations)
    const mainSessionPath = getTranscriptPath(groupFolder);
    const sessionDir = path.join(
      SESSIONS_DIR,
      groupFolder,
      '.claude',
      'projects',
    );
    if (fs.existsSync(sessionDir)) {
      const scanFile = (filepath: string) => {
        // Skip the main session transcript — it's not task-specific
        if (
          mainSessionPath &&
          path.resolve(filepath) === path.resolve(mainSessionPath)
        )
          return;
        let stat: fs.Stats;
        try {
          stat = fs.statSync(filepath);
        } catch {
          return;
        }
        let content: string;
        try {
          content = fs.readFileSync(filepath, 'utf-8');
        } catch {
          return;
        }
        // Only include files from scheduled tasks (marked with [SCHEDULED TASK)
        if (!content.includes('[SCHEDULED TASK')) return;
        let fileCost = 0;
        for (const line of content.split('\n')) {
          if (!line.includes('"usage"')) continue;
          let entry: any;
          try {
            entry = JSON.parse(line);
          } catch {
            continue;
          }
          if (entry.type !== 'assistant') continue;
          const msg = entry.message || {};
          if (!msg.usage) continue;
          const family = getModelFamily(msg.model || '');
          fileCost += calcCost(
            family,
            msg.usage.input_tokens || 0,
            msg.usage.output_tokens || 0,
            msg.usage.cache_read_input_tokens || 0,
            msg.usage.cache_creation_input_tokens || 0,
          );
        }
        if (fileCost > 0) {
          fileCosts.push({ mtime: stat.mtimeMs, cost: fileCost });
        }
      };
      const walkDir = (dir: string) => {
        let items: string[];
        try {
          items = fs.readdirSync(dir);
        } catch {
          return;
        }
        for (const item of items) {
          const full = path.join(dir, item);
          try {
            const s = fs.statSync(full);
            if (s.isDirectory()) walkDir(full);
            else if (item.endsWith('.jsonl')) scanFile(full);
          } catch {
            /* skip */
          }
        }
      };
      walkDir(sessionDir);
    }
    fileCosts.sort((a, b) => a.mtime - b.mtime);
    groupFileCosts[groupFolder] = fileCosts;
    return fileCosts;
  }

  // Enrich with latest run info and cost data
  const result = tasks.map((t) => {
    const lastRun = db
      .prepare(
        'SELECT * FROM task_run_logs WHERE task_id = ? ORDER BY run_at DESC LIMIT 1',
      )
      .get(t.id) as any | undefined;
    const runCount = (
      db
        .prepare(
          'SELECT COUNT(*) as count FROM task_run_logs WHERE task_id = ?',
        )
        .get(t.id) as any
    ).count;
    const failCount = (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM task_run_logs WHERE task_id = ? AND status = 'error'",
        )
        .get(t.id) as any
    ).count;

    // Compute cost per run by matching JSONL files (by mtime) to run time windows
    // Each isolated task run creates its own JSONL file, so match file mtime to run window
    let totalCost = 0;
    let costRuns = 0;
    if (runCount > 0) {
      const allRuns = db
        .prepare(
          'SELECT run_at, duration_ms FROM task_run_logs WHERE task_id = ? ORDER BY run_at DESC LIMIT 50',
        )
        .all(t.id) as Array<{ run_at: string; duration_ms: number }>;
      const fileCosts = loadGroupFileCosts(t.group_folder);
      for (const run of allRuns) {
        // run_at is recorded at END of run, so window is [run_at - duration, run_at]
        const runEnd = new Date(run.run_at).getTime();
        const runStart = runEnd - (run.duration_ms || 60000);
        // Find JSONL files whose mtime falls within this run's window
        let runCost = 0;
        for (const fc of fileCosts) {
          if (fc.mtime < runStart) continue;
          if (fc.mtime > runEnd) break;
          runCost += fc.cost;
        }
        if (runCost > 0) {
          totalCost += runCost;
          costRuns++;
        }
      }
    }

    const avgCostPerRun = costRuns > 0 ? totalCost / costRuns : 0;

    // Estimate runs per day from schedule
    let runsPerDay = 0;
    if (t.status === 'active') {
      if (t.schedule_type === 'cron') {
        runsPerDay = estimateCronRunsPerDay(t.schedule_value);
      } else if (t.schedule_type === 'interval') {
        const ms = parseInt(t.schedule_value, 10);
        if (ms > 0) runsPerDay = 86400000 / ms;
      }
    }

    // Scale projected costs if model changed since historical runs
    const dotEnv = readDotEnv();
    const defaultModel =
      process.env.ANTHROPIC_MODEL ||
      dotEnv.ANTHROPIC_MODEL ||
      'claude-sonnet-4-6';
    const configuredModel = t.model || defaultModel;
    const configuredFamily = getModelFamily(configuredModel);
    // Historical runs used the default model (or whatever was set at the time)
    const historicalFamily = getModelFamily(defaultModel);
    // Scale by output pricing ratio (dominant cost factor) if model families differ
    let modelScale = 1;
    if (configuredFamily !== historicalFamily && avgCostPerRun > 0) {
      const oldPrice =
        MODEL_PRICING[historicalFamily]?.output || MODEL_PRICING.sonnet.output;
      const newPrice =
        MODEL_PRICING[configuredFamily]?.output || MODEL_PRICING.sonnet.output;
      modelScale = newPrice / oldPrice;
    }
    const projectedCostPerRun = avgCostPerRun * modelScale;
    const costPerDay = projectedCostPerRun * runsPerDay;
    const costPerWeek = costPerDay * 7;

    return {
      ...t,
      run_count: runCount,
      fail_count: failCount,
      last_run_status: lastRun?.status || null,
      last_run_at: lastRun?.run_at || null,
      last_run_duration_ms: lastRun?.duration_ms || null,
      last_run_error: lastRun?.error || null,
      total_cost: totalCost,
      avg_cost_per_run: avgCostPerRun,
      runs_per_day: runsPerDay,
      cost_per_day: costPerDay,
      cost_per_week: costPerWeek,
      effective_model: configuredModel,
      model_family: configuredFamily,
    };
  });

  jsonResponse(res, result);
}

function handleScheduleRuns(
  res: http.ServerResponse,
  taskId: string,
  limit: number,
): void {
  const db = getReadDb();
  const runs = db
    .prepare(
      'SELECT * FROM task_run_logs WHERE task_id = ? ORDER BY run_at DESC LIMIT ?',
    )
    .all(taskId, limit) as any[];
  jsonResponse(res, runs);
}

/** Estimate how many times a cron expression fires per day (simple heuristic). */
function estimateCronRunsPerDay(cron: string): number {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return 0;
  const [min, hour, dom, _mon, dow] = parts;

  // Count matching minutes per hour
  const countField = (field: string, max: number): number => {
    if (field === '*') return max;
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2), 10);
      return step > 0 ? Math.floor(max / step) : max;
    }
    return field.split(',').length;
  };

  const minsPerHour = countField(min, 60);
  const hoursPerDay = countField(hour, 24);
  let daysMultiplier = 1;
  if (dow !== '*') {
    const dowCount = dow.split(',').length;
    daysMultiplier = dowCount / 7;
  }
  if (dom !== '*') {
    const domCount = dom.split(',').length;
    daysMultiplier = Math.min(daysMultiplier, domCount / 31);
  }
  return minsPerHour * hoursPerDay * daysMultiplier;
}

// Pricing per token by model family
const MODEL_PRICING: Record<
  string,
  { input: number; output: number; cache_read: number; cache_create: number }
> = {
  opus: {
    input: 5 / 1e6,
    output: 25 / 1e6,
    cache_read: 0.5 / 1e6,
    cache_create: 6.25 / 1e6,
  },
  sonnet: {
    input: 3 / 1e6,
    output: 15 / 1e6,
    cache_read: 0.3 / 1e6,
    cache_create: 3.75 / 1e6,
  },
  haiku: {
    input: 1 / 1e6,
    output: 5 / 1e6,
    cache_read: 0.1 / 1e6,
    cache_create: 1.25 / 1e6,
  },
};

function getModelFamily(model: string): string {
  if (!model) return 'sonnet';
  const m = model.toLowerCase();
  if (m.includes('opus')) return 'opus';
  if (m.includes('haiku')) return 'haiku';
  return 'sonnet';
}

function calcCost(
  family: string,
  input: number,
  output: number,
  cacheRead: number,
  cacheCreate: number,
): number {
  const p = MODEL_PRICING[family] || MODEL_PRICING.sonnet;
  return (
    input * p.input +
    output * p.output +
    cacheRead * p.cache_read +
    cacheCreate * p.cache_create
  );
}

interface CostEntry {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_create_tokens: number;
  cost: number;
}

function emptyCost(): CostEntry {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_create_tokens: 0,
    cost: 0,
  };
}

function addUsageToBuckets(
  usage: any,
  model: string,
  timestamp: string,
  total: CostEntry,
  groupEntry: CostEntry,
  byModel: Record<string, CostEntry>,
  byDay: Record<string, CostEntry>,
): void {
  const family = getModelFamily(model);
  const inputTok = usage.input_tokens || 0;
  const outputTok = usage.output_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheCreate = usage.cache_creation_input_tokens || 0;
  const cost = calcCost(family, inputTok, outputTok, cacheRead, cacheCreate);

  for (const bucket of [total, groupEntry]) {
    bucket.input_tokens += inputTok;
    bucket.output_tokens += outputTok;
    bucket.cache_read_tokens += cacheRead;
    bucket.cache_create_tokens += cacheCreate;
    bucket.cost += cost;
  }

  if (!byModel[family]) byModel[family] = emptyCost();
  const me = byModel[family];
  me.input_tokens += inputTok;
  me.output_tokens += outputTok;
  me.cache_read_tokens += cacheRead;
  me.cache_create_tokens += cacheCreate;
  me.cost += cost;

  const day = timestamp.slice(0, 10);
  if (day) {
    if (!byDay[day]) byDay[day] = emptyCost();
    const de = byDay[day];
    de.input_tokens += inputTok;
    de.output_tokens += outputTok;
    de.cache_read_tokens += cacheRead;
    de.cache_create_tokens += cacheCreate;
    de.cost += cost;
  }
}

function scanJsonlForCosts(
  filepath: string,
  total: CostEntry,
  groupEntry: CostEntry,
  byModel: Record<string, CostEntry>,
  byDay: Record<string, CostEntry>,
): void {
  let content: string;
  try {
    content = fs.readFileSync(filepath, 'utf-8');
  } catch {
    return;
  }

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type !== 'assistant') continue;
    const msg = entry.message || {};
    if (!msg.usage) continue;
    addUsageToBuckets(
      msg.usage,
      msg.model || '',
      entry.timestamp || '',
      total,
      groupEntry,
      byModel,
      byDay,
    );
  }
}

let getWriteDb: (() => import('better-sqlite3').Database) | null = null;

async function initWriteDb(): Promise<void> {
  if (getWriteDb) return;
  const { default: Database } = await import('better-sqlite3');
  let writeDb: import('better-sqlite3').Database | null = null;
  getWriteDb = () => {
    if (!writeDb) {
      writeDb = new Database(DB_PATH);
    }
    return writeDb;
  };
}

function handleSendMessage(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { group, message } = JSON.parse(body);
      if (!group || !message) {
        jsonResponse(res, { error: 'group and message required' }, 400);
        return;
      }

      const db = getReadDb();
      const grp = db
        .prepare('SELECT jid, folder FROM registered_groups WHERE folder = ?')
        .get(group) as { jid: string; folder: string } | undefined;
      if (!grp) {
        jsonResponse(res, { error: 'group not found' }, 404);
        return;
      }

      const isWebUI = grp.jid.startsWith('webui:');
      const channel = grp.jid.startsWith('slack:')
        ? 'slack'
        : isWebUI ? 'webui' : 'unknown';
      const now = new Date().toISOString();
      const msgId =
        'admin-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const content = isWebUI ? message : '[via admin-ui, respond in ' + channel + '] ' + message;

      await initWriteDb();
      getWriteDb!()
        .prepare(
          'INSERT OR REPLACE INTO messages (id, chat_jid, sender, sender_name, content, timestamp, is_from_me, is_bot_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(msgId, grp.jid, 'admin-ui', 'Admin (Web UI)', content, now, 0, 0);

      logger.info({ group, jid: grp.jid, msgId }, 'Admin UI message sent');
      jsonResponse(res, { ok: true, id: msgId });
    } catch (err) {
      logger.error({ err }, 'Failed to handle send-message');
      jsonResponse(res, { error: 'invalid request' }, 400);
    }
  });
}

function handleStartSession(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { prompt, name } = JSON.parse(body);
      if (!prompt) {
        jsonResponse(res, { error: 'prompt is required' }, 400);
        return;
      }

      const ts = Date.now();
      const jid = `webui:${ts}`;
      const sanitized = name
        ? name.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40)
        : String(ts);
      const folder = `webui_${sanitized}`;
      const displayName = name || `WebUI ${new Date(ts).toLocaleString()}`;
      const now = new Date().toISOString();

      // Register the group in the DB
      await initWriteDb();
      const wdb = getWriteDb!();
      wdb.prepare(
        `INSERT OR REPLACE INTO registered_groups (jid, name, folder, trigger_pattern, added_at, container_config, requires_trigger, is_main, parent_folder)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(jid, displayName, folder, '.*', now, null, 0, 0, null);

      // Create the groups directory
      const groupDir = path.join(GROUPS_DIR, folder);
      fs.mkdirSync(path.join(groupDir, 'logs'), { recursive: true });

      // Store chat metadata
      wdb.prepare(
        `INSERT OR REPLACE INTO chats (jid, name, last_message_time, channel, is_group) VALUES (?, ?, ?, ?, ?)`,
      ).run(jid, displayName, now, 'webui', 1);

      // Store the initial message
      const msgId = 'webui-' + ts + '-' + Math.random().toString(36).slice(2, 8);
      wdb.prepare(
        `INSERT OR REPLACE INTO messages (id, chat_jid, sender, sender_name, content, timestamp, is_from_me, is_bot_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(msgId, jid, 'webui-user', 'User (Web UI)', prompt, now, 0, 0);

      logger.info({ jid, folder, msgId }, 'WebUI session started');
      jsonResponse(res, { group: folder, jid });
    } catch (err) {
      logger.error({ err }, 'Failed to handle start-session');
      jsonResponse(res, { error: 'invalid request' }, 400);
    }
  });
}

function handleWorkAction(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { action, type, ref, title, url } = JSON.parse(body);
      if (!action || !type || !ref) {
        jsonResponse(res, { error: 'action, type, and ref required' }, 400);
        return;
      }

      const db = getReadDb();
      const mainGroup = db
        .prepare('SELECT jid, folder FROM registered_groups WHERE is_main = 1')
        .get() as { jid: string; folder: string } | undefined;
      if (!mainGroup) {
        jsonResponse(res, { error: 'no main session' }, 404);
        return;
      }

      // Only Slack supported for now
      if (!mainGroup.jid.startsWith('slack:')) {
        jsonResponse(
          res,
          { error: 'work actions only supported for Slack channels' },
          400,
        );
        return;
      }

      const channelId = mainGroup.jid.split(':')[1];
      const dotenv = readDotEnv();
      const botToken = process.env.SLACK_BOT_TOKEN || dotenv.SLACK_BOT_TOKEN;
      if (!botToken) {
        jsonResponse(res, { error: 'SLACK_BOT_TOKEN not configured' }, 500);
        return;
      }

      // Build the anchor message (visible in Slack)
      const anchorText =
        action === 'pickup'
          ? `Picking up ${ref}: ${title}`
          : `Cleaning ${ref}: ${title}`;

      // Post to Slack to get a real message ts
      const slackBody = JSON.stringify({
        channel: channelId,
        text: anchorText,
      });
      const slackRes = await new Promise<any>((resolve, reject) => {
        const r = https.request(
          {
            hostname: 'slack.com',
            path: '/api/chat.postMessage',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              Authorization: `Bearer ${botToken}`,
              'Content-Length': Buffer.byteLength(slackBody),
            },
          },
          (apiRes) => {
            let data = '';
            apiRes.on('data', (c: Buffer) => {
              data += c.toString();
            });
            apiRes.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch {
                reject(new Error('Invalid Slack response'));
              }
            });
          },
        );
        r.on('error', reject);
        r.write(slackBody);
        r.end();
      });

      if (!slackRes.ok || !slackRes.ts) {
        logger.error({ slackRes }, 'Slack postMessage failed');
        jsonResponse(
          res,
          {
            error:
              'Failed to post Slack message: ' + (slackRes.error || 'unknown'),
          },
          500,
        );
        return;
      }

      const messageTs = slackRes.ts;

      // Build the task prompt
      const prompts: Record<string, Record<string, string>> = {
        pickup: {
          pr: `Pick up PR ${ref}: ${title} (${url}). Check CI status, review comments, and open threads. Fix any CI failures and address review feedback. Post a summary of what you found and what you're doing to fix it.`,
          jira: `Pick up ${ref}: ${title} (${url}). Read the ticket and understand the requirements. Check for linked PRs or branches. If a PR exists, check its CI and reviews — fix failures and address feedback. If no PR exists, clone the repo, create a branch, implement the ticket, and open a PR. Post a summary of the current state and your plan before starting.`,
        },
        clean: {
          pr: `Clean up PR ${ref}: ${title} (${url}). Review and simplify the PR description, clean up code, ensure commit messages are clear. Apply /get-qodo-rules first.`,
          jira: `Clean up work for ${ref}: ${title} (${url}). Review all linked PRs, simplify descriptions, clean up code. Apply /get-qodo-rules first.`,
        },
      };

      const taskPrompt = prompts[action]?.[type];
      if (!taskPrompt) {
        jsonResponse(res, { error: 'unknown action/type' }, 400);
        return;
      }

      // Write IPC task file to the IPC directory that the watcher monitors
      const ipcDir = path.join(DATA_DIR, 'ipc', mainGroup.folder, 'tasks');
      fs.mkdirSync(ipcDir, { recursive: true });
      const taskData = {
        type: 'start_thread_task',
        chatJid: mainGroup.jid,
        messageTs,
        taskPrompt,
        taskName: `${action}: ${ref}`,
        initialMessage: `Working on it...`,
        groupFolder: mainGroup.folder,
        timestamp: new Date().toISOString(),
      };
      const taskFile = path.join(
        ipcDir,
        `work-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`,
      );
      fs.writeFileSync(taskFile, JSON.stringify(taskData));

      logger.info(
        { action, ref, messageTs, taskFile },
        'Work action dispatched',
      );
      jsonResponse(res, { ok: true, ts: messageTs });
    } catch (err) {
      logger.error({ err }, 'Failed to handle work-action');
      jsonResponse(res, { error: 'internal error' }, 500);
    }
  });
}

function handleDeactivate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { folder } = JSON.parse(body);
      if (!folder) {
        jsonResponse(res, { error: 'folder required' }, 400);
        return;
      }

      await initWriteDb();
      const db = getWriteDb!();
      const grp = db
        .prepare(
          'SELECT jid, name, is_main FROM registered_groups WHERE folder = ?',
        )
        .get(folder) as
        | { jid: string; name: string; is_main: number }
        | undefined;
      if (!grp) {
        jsonResponse(res, { error: 'group not found' }, 404);
        return;
      }
      if (grp.is_main) {
        jsonResponse(res, { error: 'cannot deactivate main session' }, 400);
        return;
      }

      db.prepare('DELETE FROM registered_groups WHERE folder = ?').run(folder);
      logger.info(
        { folder, jid: grp.jid, name: grp.name },
        'Group deactivated via admin UI',
      );
      jsonResponse(res, { ok: true, folder, name: grp.name });
    } catch (err) {
      logger.error({ err }, 'Failed to handle deactivate');
      jsonResponse(res, { error: 'invalid request' }, 400);
    }
  });
}

function handleDeleteSession(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { folder } = JSON.parse(body);
      if (!folder) {
        jsonResponse(res, { error: 'folder required' }, 400);
        return;
      }

      await initWriteDb();
      const db = getWriteDb!();
      const grp = db
        .prepare(
          'SELECT jid, name, is_main FROM registered_groups WHERE folder = ?',
        )
        .get(folder) as
        | { jid: string; name: string; is_main: number }
        | undefined;
      if (!grp) {
        jsonResponse(res, { error: 'group not found' }, 404);
        return;
      }
      if (grp.is_main) {
        jsonResponse(res, { error: 'cannot delete main session' }, 400);
        return;
      }

      // Delete DB records: messages, chats, sessions, scheduled tasks, registered group
      db.prepare('DELETE FROM messages WHERE chat_jid = ?').run(grp.jid);
      db.prepare('DELETE FROM chats WHERE jid = ?').run(grp.jid);
      db.prepare('DELETE FROM sessions WHERE group_folder = ?').run(folder);
      db.prepare(
        'DELETE FROM task_run_logs WHERE task_id IN (SELECT id FROM scheduled_tasks WHERE group_folder = ?)',
      ).run(folder);
      db.prepare('DELETE FROM scheduled_tasks WHERE group_folder = ?').run(
        folder,
      );
      db.prepare('DELETE FROM registered_groups WHERE folder = ?').run(folder);

      // Remove session files (transcripts, .claude config)
      const sessionsDir = path.join(DATA_DIR, 'sessions', folder);
      if (fs.existsSync(sessionsDir)) {
        fs.rmSync(sessionsDir, { recursive: true, force: true });
      }

      // Remove group folder if it exists and is not a shared folder
      const groupDir = path.join(GROUPS_DIR, folder);
      if (fs.existsSync(groupDir) && folder !== 'global') {
        fs.rmSync(groupDir, { recursive: true, force: true });
      }

      logger.info(
        { folder, jid: grp.jid, name: grp.name },
        'Session deleted via admin UI',
      );
      jsonResponse(res, { ok: true, folder, name: grp.name });
    } catch (err) {
      logger.error({ err }, 'Failed to handle delete-session');
      jsonResponse(res, { error: 'internal error' }, 500);
    }
  });
}

function handleRetryEvents(
  res: http.ServerResponse,
  params: URLSearchParams,
): void {
  try {
    const maxAgeDays = parseInt(params.get('days') || '7', 10);
    const events = readRetryEvents(maxAgeDays * 86400);

    // Resolve group names
    const db = getReadDb();
    const groups = db
      .prepare('SELECT jid, name, folder FROM registered_groups')
      .all() as any[];
    const jidToName: Record<string, string> = {};
    const jidToFolder: Record<string, string> = {};
    for (const g of groups) {
      jidToName[g.jid] =
        resolveDisplayName(db, g.jid, g.name) || g.name || g.folder;
      jidToFolder[g.jid] = g.folder;
    }

    const enriched = events.map((e) => ({
      ...e,
      groupName: jidToName[e.groupJid] || e.groupJid,
      groupFolder: jidToFolder[e.groupJid] || '',
    }));

    // Summary stats
    const totalRetries = events.filter((e) => e.type === 'retry').length;
    const totalExhausted = events.filter(
      (e) => e.type === 'max_retries_exceeded',
    ).length;
    const byGroup: Record<
      string,
      {
        retries: number;
        exhausted: number;
        lastEvent: string;
        name: string;
        folder: string;
      }
    > = {};
    for (const e of enriched) {
      if (!byGroup[e.groupJid]) {
        byGroup[e.groupJid] = {
          retries: 0,
          exhausted: 0,
          lastEvent: e.timestamp,
          name: e.groupName,
          folder: e.groupFolder,
        };
      }
      const g = byGroup[e.groupJid];
      if (e.type === 'retry') g.retries++;
      else g.exhausted++;
      if (e.timestamp > g.lastEvent) g.lastEvent = e.timestamp;
    }

    // Prune old events periodically
    if (events.length > 1000) pruneRetryEvents(maxAgeDays * 86400);

    jsonResponse(res, {
      events: enriched.reverse(), // newest first
      summary: { totalRetries, totalExhausted },
      byGroup: Object.entries(byGroup)
        .map(([jid, stats]) => ({ jid, ...stats }))
        .sort((a, b) => b.exhausted - a.exhausted || b.retries - a.retries),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to read retry events');
    jsonResponse(res, { error: 'Failed to read retry events' }, 500);
  }
}

function handleCosts(res: http.ServerResponse): void {
  const db = getReadDb();
  const groups = db.prepare('SELECT * FROM registered_groups').all() as any[];

  const total = emptyCost();
  const byGroup: Record<
    string,
    CostEntry & { folder: string; name: string; display_name: string }
  > = {};
  const byModel: Record<string, CostEntry> = {};
  const byDay: Record<string, CostEntry> = {};

  // Build a JID lookup for display name resolution
  const jidByFolder: Record<string, string> = {};
  for (const g of groups) {
    jidByFolder[g.folder] = g.jid;
  }

  // Scan ALL JSONL files across all session directories
  try {
    const sessionDirs = fs.readdirSync(SESSIONS_DIR);
    for (const folder of sessionDirs) {
      // Determine the registered group folder (strip thread suffixes like _t_1234)
      const baseFolder = folder.replace(/_t_.*$/, '');
      if (!byGroup[baseFolder]) {
        const jid = jidByFolder[baseFolder];
        const gInfo = groups.find((g: any) => g.folder === baseFolder);
        const displayName = jid
          ? resolveDisplayName(db, jid, gInfo?.name || baseFolder)
          : baseFolder;
        byGroup[baseFolder] = {
          ...emptyCost(),
          folder: baseFolder,
          name: gInfo?.name || baseFolder,
          display_name: displayName,
        };
      }
      const groupEntry = byGroup[baseFolder];

      const projDir = path.join(SESSIONS_DIR, folder, '.claude', 'projects');
      if (!fs.existsSync(projDir)) continue;
      const walkDir = (dir: string) => {
        let items: string[];
        try {
          items = fs.readdirSync(dir);
        } catch {
          return;
        }
        for (const item of items) {
          const full = path.join(dir, item);
          try {
            const s = fs.statSync(full);
            if (s.isDirectory()) {
              walkDir(full);
              continue;
            }
            if (item.endsWith('.jsonl')) {
              scanJsonlForCosts(full, total, groupEntry, byModel, byDay);
            }
          } catch {
            /* skip */
          }
        }
      };
      walkDir(projDir);
    }
  } catch {
    /* best-effort */
  }

  // Compute schedule vs interactive breakdown
  // Track scheduled cost during a second lightweight pass (only check file headers)
  const scheduledCost = emptyCost();
  // Build a set of files that are scheduled tasks (cached from main scan)
  try {
    const sessionDirs = fs.readdirSync(SESSIONS_DIR);
    for (const folder of sessionDirs) {
      const projDir = path.join(SESSIONS_DIR, folder, '.claude', 'projects');
      if (!fs.existsSync(projDir)) continue;
      const classifyDir = (dir: string) => {
        let items: string[];
        try {
          items = fs.readdirSync(dir);
        } catch {
          return;
        }
        for (const item of items) {
          const full = path.join(dir, item);
          try {
            const s = fs.statSync(full);
            if (s.isDirectory()) {
              classifyDir(full);
              continue;
            }
            if (!item.endsWith('.jsonl')) continue;
            // Quick check: read first 2KB to see if it's a scheduled task
            const fd = fs.openSync(full, 'r');
            const buf = Buffer.alloc(2048);
            fs.readSync(fd, buf, 0, 2048, 0);
            fs.closeSync(fd);
            if (!buf.toString('utf-8').includes('[SCHEDULED TASK')) continue;
            // This is a scheduled task file — scan for costs
            const dummyGroup = emptyCost();
            const dummyModel: Record<string, CostEntry> = {};
            const dummyDay: Record<string, CostEntry> = {};
            scanJsonlForCosts(
              full,
              scheduledCost,
              dummyGroup,
              dummyModel,
              dummyDay,
            );
          } catch {
            /* skip */
          }
        }
      };
      classifyDir(projDir);
    }
  } catch {
    /* best-effort */
  }
  const interactiveCost: CostEntry = {
    input_tokens: Math.max(0, total.input_tokens - scheduledCost.input_tokens),
    output_tokens: Math.max(
      0,
      total.output_tokens - scheduledCost.output_tokens,
    ),
    cache_read_tokens: Math.max(
      0,
      total.cache_read_tokens - scheduledCost.cache_read_tokens,
    ),
    cache_create_tokens: Math.max(
      0,
      total.cache_create_tokens - scheduledCost.cache_create_tokens,
    ),
    cost: Math.max(0, total.cost - scheduledCost.cost),
  };

  // Scan host Claude Code sessions (management/dev cost)
  const managementCost = emptyCost();
  const managementByDay: Record<string, CostEntry> = {};
  try {
    const homeDir = os.homedir();
    const hostProjectsDir = path.join(homeDir, '.claude', 'projects');
    if (fs.existsSync(hostProjectsDir)) {
      for (const projFolder of fs.readdirSync(hostProjectsDir)) {
        const projDir = path.join(hostProjectsDir, projFolder);
        try {
          if (!fs.statSync(projDir).isDirectory()) continue;
        } catch {
          continue;
        }
        for (const item of fs.readdirSync(projDir)) {
          if (!item.endsWith('.jsonl')) continue;
          const full = path.join(projDir, item);
          try {
            const dummyGroup = emptyCost();
            scanJsonlForCosts(
              full,
              managementCost,
              dummyGroup,
              {},
              managementByDay,
            );
          } catch {
            /* skip */
          }
        }
      }
    }
  } catch {
    /* best-effort */
  }
  const managementDayList = Object.entries(managementByDay)
    .map(([date, e]) => ({ date, ...e }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const groupList = Object.values(byGroup).sort((a, b) => b.cost - a.cost);
  const modelList = Object.entries(byModel)
    .map(([model, e]) => ({ model, ...e }))
    .sort((a, b) => b.cost - a.cost);
  const dayList = Object.entries(byDay)
    .map(([date, e]) => ({ date, ...e }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const typeBreakdown = {
    scheduled: scheduledCost,
    interactive: interactiveCost,
  };

  jsonResponse(res, {
    total,
    by_group: groupList,
    by_model: modelList,
    by_day: dayList,
    by_type: typeBreakdown,
    management: { total: managementCost, by_day: managementDayList },
  });
}

function handleStopContainer(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      const { folder } = JSON.parse(body);
      if (!folder) {
        jsonResponse(res, { error: 'folder required' }, 400);
        return;
      }

      // Find running container matching the folder pattern
      const safeName = folder.replace(/[^a-zA-Z0-9-]/g, '-');
      execFile(
        'docker',
        [
          'ps',
          '--filter',
          `name=markclaw-${safeName}-`,
          '--format',
          '{{.Names}}',
        ],
        { timeout: 5000 },
        (err, stdout) => {
          if (err) {
            jsonResponse(
              res,
              { error: `docker ps failed: ${err.message}` },
              500,
            );
            return;
          }

          const containerName = stdout.trim().split('\n').filter(Boolean)[0];
          if (!containerName) {
            jsonResponse(
              res,
              { error: 'no running container found for folder' },
              404,
            );
            return;
          }

          execFile(
            'docker',
            ['stop', containerName],
            { timeout: 15000 },
            (stopErr) => {
              if (stopErr) {
                jsonResponse(
                  res,
                  { error: `docker stop failed: ${stopErr.message}` },
                  500,
                );
                return;
              }
              logger.info(
                { folder, containerName },
                'Container stopped via admin UI',
              );
              jsonResponse(res, { ok: true, container: containerName });
            },
          );
        },
      );
    } catch (err) {
      logger.error({ err }, 'Failed to handle stop-container');
      jsonResponse(res, { error: 'invalid request' }, 400);
    }
  });
}

function handleSchedulePause(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { id } = JSON.parse(body);
      if (!id) {
        jsonResponse(res, { error: 'id required' }, 400);
        return;
      }

      await initWriteDb();
      const db = getWriteDb!();
      const task = db
        .prepare('SELECT id, status FROM scheduled_tasks WHERE id = ?')
        .get(id) as { id: string; status: string } | undefined;
      if (!task) {
        jsonResponse(res, { error: 'task not found' }, 404);
        return;
      }

      db.prepare(
        'UPDATE scheduled_tasks SET status = ?, next_run = NULL WHERE id = ?',
      ).run('paused', id);
      logger.info({ taskId: id }, 'Task paused via admin UI');
      jsonResponse(res, { ok: true, id });
    } catch (err) {
      logger.error({ err }, 'Failed to handle schedule-pause');
      jsonResponse(res, { error: 'invalid request' }, 400);
    }
  });
}

function handleScheduleResume(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { id } = JSON.parse(body);
      if (!id) {
        jsonResponse(res, { error: 'id required' }, 400);
        return;
      }

      await initWriteDb();
      const db = getWriteDb!();
      const task = db
        .prepare('SELECT id, status FROM scheduled_tasks WHERE id = ?')
        .get(id) as { id: string; status: string } | undefined;
      if (!task) {
        jsonResponse(res, { error: 'task not found' }, 404);
        return;
      }

      db.prepare(
        "UPDATE scheduled_tasks SET status = 'active' WHERE id = ?",
      ).run(id);
      logger.info({ taskId: id }, 'Task resumed via admin UI');
      jsonResponse(res, { ok: true, id });
    } catch (err) {
      logger.error({ err }, 'Failed to handle schedule-resume');
      jsonResponse(res, { error: 'invalid request' }, 400);
    }
  });
}

function handleScheduleDelete(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { id } = JSON.parse(body);
      if (!id) {
        jsonResponse(res, { error: 'id required' }, 400);
        return;
      }

      await initWriteDb();
      const db = getWriteDb!();
      const task = db
        .prepare('SELECT id FROM scheduled_tasks WHERE id = ?')
        .get(id) as { id: string } | undefined;
      if (!task) {
        jsonResponse(res, { error: 'task not found' }, 404);
        return;
      }

      db.prepare('DELETE FROM task_run_logs WHERE task_id = ?').run(id);
      db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);
      logger.info({ taskId: id }, 'Task deleted via admin UI');
      jsonResponse(res, { ok: true, id });
    } catch (err) {
      logger.error({ err }, 'Failed to handle schedule-delete');
      jsonResponse(res, { error: 'invalid request' }, 400);
    }
  });
}

function handleScheduleModel(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { id, model } = JSON.parse(body);
      if (!id) {
        jsonResponse(res, { error: 'id required' }, 400);
        return;
      }

      await initWriteDb();
      const db = getWriteDb!();
      const task = db
        .prepare('SELECT id FROM scheduled_tasks WHERE id = ?')
        .get(id) as { id: string } | undefined;
      if (!task) {
        jsonResponse(res, { error: 'task not found' }, 404);
        return;
      }

      // model can be null/empty (revert to default) or a model string
      const newModel =
        typeof model === 'string' && model.trim() ? model.trim() : null;
      db.prepare('UPDATE scheduled_tasks SET model = ? WHERE id = ?').run(
        newModel,
        id,
      );
      logger.info(
        { taskId: id, model: newModel },
        'Task model updated via admin UI',
      );
      jsonResponse(res, { ok: true, id, model: newModel });
    } catch (err) {
      logger.error({ err }, 'Failed to handle schedule-model');
      jsonResponse(res, { error: 'invalid request' }, 400);
    }
  });
}

function handleScheduleRunNow(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { id } = JSON.parse(body);
      if (!id) {
        jsonResponse(res, { error: 'id required' }, 400);
        return;
      }
      // Respond immediately so the UI doesn't wait for the task to complete
      jsonResponse(res, { ok: true, id });
      triggerTaskNow(id).catch((err) => {
        logger.error({ taskId: id, err }, 'Run-now task failed');
      });
    } catch (err) {
      logger.error({ err }, 'Failed to handle schedule-run-now');
      jsonResponse(res, { error: 'invalid request' }, 400);
    }
  });
}

function handleSearch(
  res: http.ServerResponse,
  query: string,
  limit: number,
): void {
  if (!query) {
    jsonResponse(res, { error: 'q parameter required' }, 400);
    return;
  }

  const db = getReadDb();

  // Search messages table
  const messages = db
    .prepare(
      `SELECT * FROM messages WHERE content LIKE '%' || ? || '%' ORDER BY timestamp DESC LIMIT ?`,
    )
    .all(query, limit) as any[];

  // Search transcript JSONL files
  const transcripts: Array<{
    folder: string;
    display_name: string;
    line: number;
    type: string;
    timestamp: string;
    snippet: string;
  }> = [];

  try {
    const groups = db.prepare('SELECT * FROM registered_groups').all() as any[];
    for (const g of groups) {
      const tpath = getTranscriptPath(g.folder);
      if (!tpath) continue;

      let content: string;
      try {
        content = fs.readFileSync(tpath, 'utf-8');
      } catch {
        continue;
      }

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line || !line.includes(query)) continue;

        let entry: any;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }

        // Extract all text segments from the entry to find the matching one
        const texts: string[] = [];
        const msg = entry.message || {};
        const msgContent = msg.content;
        if (typeof msgContent === 'string') {
          texts.push(msgContent);
        } else if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            if (block.text) texts.push(block.text);
            if (block.name) texts.push(block.name);
            if (typeof block.input === 'string') texts.push(block.input);
            else if (block.input) texts.push(JSON.stringify(block.input));
          }
        }
        // Find the text segment that contains the query match
        const qLower = query.toLowerCase();
        let snippet = '';
        for (const t of texts) {
          const idx = t.toLowerCase().indexOf(qLower);
          if (idx >= 0) {
            const start = Math.max(0, idx - 80);
            const end = Math.min(t.length, idx + query.length + 80);
            snippet =
              (start > 0 ? '...' : '') +
              t.slice(start, end) +
              (end < t.length ? '...' : '');
            break;
          }
        }
        // Fallback: show first available text
        if (!snippet && texts.length > 0) {
          snippet =
            texts[0].slice(0, 150) + (texts[0].length > 150 ? '...' : '');
        }

        transcripts.push({
          folder: g.folder,
          display_name: resolveDisplayName(db, g.jid, g.name),
          line: i,
          type: entry.type || 'unknown',
          timestamp: entry.timestamp || '',
          snippet,
        });

        if (transcripts.length >= limit) break;
      }
      if (transcripts.length >= limit) break;
    }
  } catch {
    /* best-effort */
  }

  jsonResponse(res, { messages, transcripts });
}

// --- GitHub PRs ---
function handleGitHubPRs(res: http.ServerResponse): void {
  const env = readSharedEnv();
  const ghToken = env.GH_TOKEN;
  if (!ghToken) {
    jsonResponse(res, { error: 'GH_TOKEN not configured in .env-shared' }, 500);
    return;
  }

  // Use gh CLI to list open PRs authored by me across the org
  // gh search prs gives cross-repo results
  const ghPaths = [
    path.join(process.env.HOME || '', '.nix-profile/bin/gh'),
    '/nix/var/nix/profiles/default/bin/gh',
    '/usr/local/bin/gh',
    '/usr/bin/gh',
  ];
  const ghBin = ghPaths.find((p) => fs.existsSync(p)) || 'gh';

  // Use gh search prs for cross-repo results
  execFile(
    ghBin,
    [
      'search',
      'prs',
      '--owner',
      GITHUB_ORG,
      '--author',
      '@me',
      '--state',
      'open',
      '--json',
      'number,title,repository,updatedAt,url,isDraft',
      '--limit',
      '30',
    ],
    { env: { ...process.env, GH_TOKEN: ghToken }, timeout: 15000 },
    (err, stdout) => {
      if (err) {
        jsonResponse(
          res,
          { error: 'Failed to fetch PRs: ' + (err.message || '') },
          500,
        );
        return;
      }
      try {
        const prs = JSON.parse(stdout);
        // Group by repo and fetch CI + review status
        const byRepo: Record<string, any[]> = {};
        for (const pr of prs) {
          const repo = pr.repository?.nameWithOwner || 'unknown';
          pr.repo = repo;
          if (!byRepo[repo]) byRepo[repo] = [];
          byRepo[repo].push(pr);
        }
        // Fetch review decision + CI per repo
        let pending = Object.keys(byRepo).length;
        if (pending === 0) {
          jsonResponse(res, { prs: [] });
          return;
        }
        const allPrs: any[] = [];
        for (const [repo, repoPrs] of Object.entries(byRepo)) {
          // Get review decisions for this repo's PRs
          execFile(
            ghBin,
            [
              'pr',
              'list',
              '--repo',
              repo,
              '--state',
              'open',
              '--author',
              '@me',
              '--json',
              'number,reviewDecision,headRefName',
              '--limit',
              '30',
            ],
            { env: { ...process.env, GH_TOKEN: ghToken }, timeout: 10000 },
            (err2, stdout2) => {
              const reviewMap: Record<
                number,
                { review: string; branch: string }
              > = {};
              if (!err2) {
                try {
                  for (const rp of JSON.parse(stdout2)) {
                    reviewMap[rp.number] = {
                      review: rp.reviewDecision || '',
                      branch: rp.headRefName || '',
                    };
                  }
                } catch {
                  /* ignore */
                }
              }
              // Enrich search results with review + branch info + Jira refs
              for (const pr of repoPrs) {
                const info = reviewMap[pr.number];
                pr.reviewDecision = info?.review || '';
                pr.headRefName = info?.branch || '';
                const jiraRefs = new Set<string>();
                const jiraPattern = /[A-Z]{2,10}-\d+/g;
                for (const text of [pr.headRefName, pr.title]) {
                  if (text)
                    for (const m of text.matchAll(jiraPattern))
                      jiraRefs.add(m[0]);
                }
                pr.jiraRefs = [...jiraRefs];
              }
              // Now fetch CI status
              fetchCIStatus(ghBin, ghToken, repo, repoPrs, (enriched) => {
                allPrs.push(...enriched);
                pending--;
                if (pending <= 0) {
                  allPrs.sort((a, b) =>
                    (b.updatedAt || '').localeCompare(a.updatedAt || ''),
                  );
                  jsonResponse(res, { prs: allPrs });
                }
              });
            },
          );
        }
      } catch {
        jsonResponse(res, { prs: [] });
      }
    },
  );
}

function fetchCIStatus(
  ghBin: string,
  ghToken: string,
  repo: string,
  prs: any[],
  cb: (enriched: any[]) => void,
): void {
  let pending = prs.length;
  if (pending === 0) {
    cb([]);
    return;
  }
  for (const pr of prs) {
    const branch = pr.headRefName || pr.headBranch || '';
    if (!branch) {
      pr.ci = 'unknown';
      pending--;
      if (pending <= 0) cb(prs);
      continue;
    }
    execFile(
      ghBin,
      [
        'run',
        'list',
        '--repo',
        repo,
        '--branch',
        branch,
        '--json',
        'status,conclusion,name,databaseId',
        '--limit',
        '10',
      ],
      { env: { ...process.env, GH_TOKEN: ghToken }, timeout: 10000 },
      (err, stdout) => {
        if (err) {
          pr.ci = 'unknown';
          pr.repo = repo;
          pending--;
          if (pending <= 0) cb(prs);
          return;
        }
        try {
          const allRuns = JSON.parse(stdout);
          // Only consider the latest run per workflow name (gh returns newest first)
          const latestByName = new Map<string, any>();
          for (const r of allRuns) {
            if (!latestByName.has(r.name)) latestByName.set(r.name, r);
          }
          const runs = [...latestByName.values()];
          if (runs.length === 0) {
            pr.ci = 'none';
          } else if (runs.some((r: any) => r.conclusion === 'failure')) {
            pr.ci = 'failure';
          } else if (
            runs.some(
              (r: any) => r.status === 'in_progress' || r.status === 'queued',
            )
          ) {
            pr.ci = 'pending';
          } else if (runs.every((r: any) => r.conclusion === 'success')) {
            pr.ci = 'success';
          } else {
            pr.ci = 'mixed';
          }
          pr.ciRuns = runs;
        } catch {
          pr.ci = 'unknown';
        }

        // For failed runs, fetch job-level details to show which specific jobs failed
        // (workflow name alone is too vague — e.g. "lint" workflow may have multiple jobs)
        const failedRuns = (pr.ciRuns || []).filter(
          (r: any) => r.conclusion === 'failure',
        );
        // Deduplicate by workflow name — only fetch jobs for one run per workflow
        const seenWorkflows = new Set<string>();
        const uniqueFailedRuns = failedRuns.filter((r: any) => {
          if (seenWorkflows.has(r.name)) return false;
          seenWorkflows.add(r.name);
          return true;
        });
        if (uniqueFailedRuns.length > 0 && uniqueFailedRuns.length <= 3) {
          let jobsPending = uniqueFailedRuns.length;
          const failedJobs: Array<{ name: string }> = [];
          for (const run of uniqueFailedRuns) {
            execFile(
              ghBin,
              [
                'run',
                'view',
                String(run.databaseId),
                '--repo',
                repo,
                '--json',
                'jobs',
              ],
              { env: { ...process.env, GH_TOKEN: ghToken }, timeout: 10000 },
              (jobErr, jobStdout) => {
                if (!jobErr) {
                  try {
                    const data = JSON.parse(jobStdout);
                    for (const job of data.jobs || []) {
                      if (job.conclusion === 'failure') {
                        failedJobs.push({ name: job.name || run.name });
                      }
                    }
                  } catch {
                    /* ignore */
                  }
                }
                jobsPending--;
                if (jobsPending <= 0) {
                  if (failedJobs.length > 0) {
                    pr.ciFailedJobs = failedJobs;
                  }
                  pr.repo = repo;
                  pending--;
                  if (pending <= 0) cb(prs);
                }
              },
            );
          }
        } else {
          pr.repo = repo;
          pending--;
          if (pending <= 0) cb(prs);
        }
      },
    );
  }
}

// --- Jira Tickets ---
function handleJiraTickets(res: http.ServerResponse): void {
  const env = readSharedEnv();
  const site = env.JIRA_SITE;
  const user = env.JIRA_USER;
  const token = env.JIRA_API_TOKEN;
  if (!site || !user || !token) {
    jsonResponse(
      res,
      { error: 'Jira credentials not configured in .env-shared' },
      500,
    );
    return;
  }

  const jql =
    'assignee=currentUser() AND status in ("To Do","In Progress","In Review","Code Review") ORDER BY updated DESC';
  const body = JSON.stringify({
    jql,
    maxResults: 30,
    fields: ['summary', 'status', 'priority', 'updated', 'issuetype'],
  });

  const url = new URL('/rest/api/3/search/jql', site);
  const auth = Buffer.from(`${user}:${token}`).toString('base64');

  const proto: typeof http = url.protocol === 'https:' ? (https as any) : http;
  const reqOpts = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const jiraReq = proto.request(reqOpts, (jiraRes: http.IncomingMessage) => {
    let data = '';
    jiraRes.on('data', (c: Buffer) => {
      data += c.toString();
    });
    jiraRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const tickets = (parsed.issues || []).map((issue: any) => ({
          key: issue.key,
          summary: issue.fields?.summary || '',
          status: issue.fields?.status?.name || '',
          statusCategory: issue.fields?.status?.statusCategory?.key || '',
          priority: issue.fields?.priority?.name || '',
          type: issue.fields?.issuetype?.name || '',
          updated: issue.fields?.updated || '',
          url: `${site}/browse/${issue.key}`,
        }));
        jsonResponse(res, { tickets });
      } catch {
        jsonResponse(res, { error: 'Failed to parse Jira response' }, 500);
      }
    });
  });
  jiraReq.on('error', (err: Error) => {
    jsonResponse(res, { error: 'Jira request failed: ' + err.message }, 500);
  });
  jiraReq.write(body);
  jiraReq.end();
}

// --- Combined Work endpoint with caching ---
function fetchPRsAsync(): Promise<any[]> {
  return new Promise((resolve) => {
    const env = readSharedEnv();
    const ghToken = env.GH_TOKEN;
    if (!ghToken) {
      resolve([]);
      return;
    }

    const ghPaths = [
      path.join(process.env.HOME || '', '.nix-profile/bin/gh'),
      '/nix/var/nix/profiles/default/bin/gh',
      '/usr/local/bin/gh',
      '/usr/bin/gh',
    ];
    const ghBin = ghPaths.find((p) => fs.existsSync(p)) || 'gh';

    execFile(
      ghBin,
      [
        'search',
        'prs',
        '--owner',
        GITHUB_ORG,
        '--author',
        '@me',
        '--state',
        'open',
        '--json',
        'number,title,repository,updatedAt,url,isDraft',
        '--limit',
        '30',
      ],
      { env: { ...process.env, GH_TOKEN: ghToken }, timeout: 15000 },
      (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }
        try {
          const prs = JSON.parse(stdout);
          const byRepo: Record<string, any[]> = {};
          for (const pr of prs) {
            const repo = pr.repository?.nameWithOwner || 'unknown';
            pr.repo = repo;
            if (!byRepo[repo]) byRepo[repo] = [];
            byRepo[repo].push(pr);
          }
          let pending = Object.keys(byRepo).length;
          if (pending === 0) {
            resolve([]);
            return;
          }
          const allPrs: any[] = [];
          for (const [repo, repoPrs] of Object.entries(byRepo)) {
            execFile(
              ghBin,
              [
                'pr',
                'list',
                '--repo',
                repo,
                '--state',
                'open',
                '--author',
                '@me',
                '--json',
                'number,reviewDecision,headRefName',
                '--limit',
                '30',
              ],
              { env: { ...process.env, GH_TOKEN: ghToken }, timeout: 10000 },
              (err2, stdout2) => {
                const reviewMap: Record<
                  number,
                  { review: string; branch: string }
                > = {};
                if (!err2) {
                  try {
                    for (const rp of JSON.parse(stdout2)) {
                      reviewMap[rp.number] = {
                        review: rp.reviewDecision || '',
                        branch: rp.headRefName || '',
                      };
                    }
                  } catch {
                    /* ignore */
                  }
                }
                for (const pr of repoPrs) {
                  const info = reviewMap[pr.number];
                  pr.reviewDecision = info?.review || '';
                  pr.headRefName = info?.branch || '';
                  // Extract Jira ticket references from branch name and title
                  const jiraRefs = new Set<string>();
                  const jiraPattern = /[A-Z]{2,10}-\d+/g;
                  for (const text of [pr.headRefName, pr.title]) {
                    if (text)
                      for (const m of text.matchAll(jiraPattern))
                        jiraRefs.add(m[0]);
                  }
                  pr.jiraRefs = [...jiraRefs];
                }
                fetchCIStatus(ghBin, ghToken, repo, repoPrs, (enriched) => {
                  allPrs.push(...enriched);
                  pending--;
                  if (pending <= 0) {
                    allPrs.sort((a, b) =>
                      (b.updatedAt || '').localeCompare(a.updatedAt || ''),
                    );
                    resolve(allPrs);
                  }
                });
              },
            );
          }
        } catch {
          resolve([]);
        }
      },
    );
  });
}

function fetchTicketsAsync(): Promise<any[]> {
  return new Promise((resolve) => {
    const env = readSharedEnv();
    const site = env.JIRA_SITE;
    const user = env.JIRA_USER;
    const token = env.JIRA_API_TOKEN;
    if (!site || !user || !token) {
      resolve([]);
      return;
    }

    const jql =
      'assignee=currentUser() AND status in ("To Do","In Progress","In Review","Code Review") ORDER BY updated DESC';
    const body = JSON.stringify({
      jql,
      maxResults: 30,
      fields: ['summary', 'status', 'priority', 'updated', 'issuetype'],
    });
    const url = new URL('/rest/api/3/search/jql', site);
    const auth = Buffer.from(`${user}:${token}`).toString('base64');
    const proto: typeof http =
      url.protocol === 'https:' ? (https as any) : http;
    const reqOpts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const jiraReq = proto.request(reqOpts, (jiraRes: http.IncomingMessage) => {
      let data = '';
      jiraRes.on('data', (c: Buffer) => {
        data += c.toString();
      });
      jiraRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const tickets = (parsed.issues || []).map((issue: any) => ({
            key: issue.key,
            summary: issue.fields?.summary || '',
            status: issue.fields?.status?.name || '',
            statusCategory: issue.fields?.status?.statusCategory?.key || '',
            priority: issue.fields?.priority?.name || '',
            type: issue.fields?.issuetype?.name || '',
            updated: issue.fields?.updated || '',
            url: `${site}/browse/${issue.key}`,
          }));
          resolve(tickets);
        } catch {
          resolve([]);
        }
      });
    });
    jiraReq.on('error', () => {
      resolve([]);
    });
    jiraReq.write(body);
    jiraReq.end();
  });
}

async function refreshWorkCache(): Promise<void> {
  if (workCacheRefreshing) return;
  workCacheRefreshing = true;
  try {
    const [prs, tickets] = await Promise.all([
      fetchPRsAsync(),
      fetchTicketsAsync(),
    ]);
    workCache = { prs, tickets, timestamp: Date.now() };
  } catch (err) {
    logger.error({ err }, 'Failed to refresh work cache');
  } finally {
    workCacheRefreshing = false;
  }
}

function handleWork(res: http.ServerResponse): void {
  if (workCache && Date.now() - workCache.timestamp < WORK_CACHE_TTL) {
    jsonResponse(res, {
      prs: workCache.prs,
      tickets: workCache.tickets,
      cached: true,
      age: Date.now() - workCache.timestamp,
    });
    // Trigger background refresh if > 30s old
    if (Date.now() - workCache.timestamp > 30000) refreshWorkCache();
    return;
  }
  // First load or stale — fetch and cache
  refreshWorkCache().then(() => {
    if (workCache) {
      jsonResponse(res, {
        prs: workCache.prs,
        tickets: workCache.tickets,
        cached: false,
      });
    } else {
      jsonResponse(res, { prs: [], tickets: [] });
    }
  });
}

// --- Summarize endpoint (runs context-gathering in a container, then LLM summary) ---
function handleSummarize(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const { type, ref, url: itemUrl } = JSON.parse(body);
      if (!type || !ref) {
        jsonResponse(res, { error: 'type and ref required' }, 400);
        return;
      }

      // Build a shell script to gather context using the container's tools
      let script = '';
      if (type === 'pr') {
        const match = ref.match(/^(.+?)#(\d+)$/);
        if (!match) {
          jsonResponse(res, { error: 'invalid PR ref' }, 400);
          return;
        }
        const shortRepo = match[1];
        const prNum = match[2];
        const fullRepo =
          workCache?.prs.find((p) => {
            const r = (p.repo || '').split('/').pop();
            return r === shortRepo && String(p.number) === prNum;
          })?.repo || `${GITHUB_ORG}/${shortRepo}`;

        // CI info from cache
        let ciInfo = '';
        const cachedPr = workCache?.prs.find((p) => {
          const r = (p.repo || '').split('/').pop();
          return r === shortRepo && String(p.number) === prNum;
        });
        if (cachedPr?.ci) {
          ciInfo = `CI: ${cachedPr.ci}`;
          if (cachedPr.ciRuns) {
            ciInfo +=
              '\n' +
              cachedPr.ciRuns
                .slice(0, 5)
                .map(
                  (r: any) =>
                    `  ${r.name || 'check'}: ${r.conclusion || r.status || 'pending'}`,
                )
                .join('\n');
          }
        }

        script = `#!/bin/bash
set -e
echo "=== PR Details ==="
gh pr view ${prNum} --repo ${fullRepo} --json title,body,comments,reviews,state,reviewDecision,additions,deletions,changedFiles 2>/dev/null || echo "Failed to fetch PR"
echo ""
echo "=== CI Status ==="
echo ${JSON.stringify(ciInfo)}
echo ""
echo "=== Recent CI Runs ==="
gh run list --repo ${fullRepo} --branch "$(gh pr view ${prNum} --repo ${fullRepo} --json headRefName -q .headRefName 2>/dev/null)" --json name,status,conclusion --limit 5 2>/dev/null || echo "No CI data"
`;
      } else if (type === 'jira') {
        // Use curl + Jira REST API (acli requires persistent auth config)
        // JIRA_SITE, JIRA_USER, JIRA_API_TOKEN are injected as env vars
        const safeRef = ref.replace(/[^A-Z0-9-]/gi, '');
        script = `#!/bin/bash
echo "=== Jira Ticket ==="
RESPONSE=$(curl -s -u "$JIRA_USER:$JIRA_API_TOKEN" -H "Accept: application/json" "$JIRA_SITE/rest/api/3/issue/${safeRef}?fields=summary,description,status,priority,comment,subtasks,issuetype,assignee" 2>&1)
if [ -z "$RESPONSE" ]; then
  echo "Empty response from Jira API"
else
  echo "$RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    f = d.get('fields', {})
    print(d.get('key','?') + ': ' + f.get('summary',''))
    print('Status: ' + f.get('status',{}).get('name','?'))
    print('Type: ' + f.get('issuetype',{}).get('name','?'))
    print('Priority: ' + f.get('priority',{}).get('name','?'))
    def adf(n):
        if not n: return ''
        if isinstance(n, str): return n
        if n.get('type') == 'text': return n.get('text', '')
        return ' '.join(adf(c) for c in n.get('content', []))
    desc = adf(f.get('description'))
    if desc: print('Description: ' + desc[:2000])
    subs = f.get('subtasks', [])
    if subs:
        print('Subtasks:')
        for s in subs: print('  - ' + s.get('key','?') + ' [' + s.get('fields',{}).get('status',{}).get('name','?') + ']: ' + s.get('fields',{}).get('summary',''))
    comments = f.get('comment', {}).get('comments', [])
    if comments:
        print('Recent Comments:')
        for c in comments[-5:]:
            body = adf(c.get('body'))
            print('  - ' + c.get('author',{}).get('displayName','?') + ': ' + body[:300])
except Exception as e:
    print('JSON parse failed: ' + str(e))
    print('Raw: ' + sys.stdin.read()[:200] if hasattr(sys.stdin, 'read') else '')
" 2>&1
fi
`;
      } else {
        jsonResponse(res, { error: 'unknown type' }, 400);
        return;
      }

      // Run script in container to gather context
      const context = await runContainerScript(script);

      if (!context || context.length < 10) {
        jsonResponse(res, { error: 'Could not fetch context for ' + ref }, 500);
        return;
      }

      // Call Claude API with the gathered context
      const summary = await callClaudeForSummary(context, type, ref);
      jsonResponse(res, { summary });
    } catch (err: any) {
      jsonResponse(
        res,
        { error: 'Summarize failed: ' + (err.message || '') },
        500,
      );
    }
  });
}

/** Run a bash script inside the agent container with full tool access (gh, acli, etc.) */
function runContainerScript(script: string): Promise<string> {
  return new Promise((resolve) => {
    const containerName = `markclaw-summarize-${Date.now()}`;
    const args: string[] = ['run', '-i', '--rm', '--name', containerName];
    args.push('--network', 'host');
    args.push('-e', `TZ=${TIMEZONE}`);
    args.push('-e', 'AWS_EC2_METADATA_DISABLED=true');
    args.push('--entrypoint', 'bash');

    // Inject shared tool credentials (GH_TOKEN, JIRA creds, etc.)
    const sharedEnvFile = path.join(GROUPS_DIR, 'global', '.env-shared');
    if (fs.existsSync(sharedEnvFile)) {
      for (const line of fs.readFileSync(sharedEnvFile, 'utf-8').split('\n')) {
        const m = line.match(/^export\s+(\w+)="([^"]*)"/);
        if (m && m[1] !== 'PATH') args.push('-e', `${m[1]}=${m[2]}`);
      }
    }
    args.push('-e', 'GH_CONFIG_DIR=/home/node/.config/gh');

    // Run as host user
    const hostUid = process.getuid?.();
    const hostGid = process.getgid?.();
    if (hostUid != null && hostUid !== 0 && hostUid !== 1000) {
      args.push('--user', `${hostUid}:${hostGid}`);
      args.push('-e', 'HOME=/home/node');
    }

    // Mount /nix for tool access (gh, acli, etc.)
    if (fs.existsSync('/nix')) {
      args.push('-v', '/nix:/nix');
    }

    // Mount SSH for git access
    const sshDir = path.join(os.homedir(), '.ssh');
    if (fs.existsSync(sshDir)) {
      args.push(...readonlyMountArgs(sshDir, '/home/node/.ssh'));
    }

    // Pass -s so bash reads script from stdin (avoids shell escaping issues with -c)
    args.push(CONTAINER_IMAGE, '-s');

    const proc = spawn(CONTAINER_RUNTIME_BIN, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 20000,
    });

    proc.stdin.write(script);
    proc.stdin.end();

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        logger.warn(
          { code, stderr: stderr.slice(0, 300) },
          'Summarize container exited with error',
        );
      }
      // Return whatever we got, even on error — partial context is better than none
      resolve((stdout + '\n' + stderr).slice(0, 8000));
    });
    proc.on('error', (err) => {
      logger.error({ err }, 'Failed to spawn summarize container');
      resolve('');
    });
  });
}

function getClaudeApiAuth(): {
  headerName: string;
  headerValue: string;
} | null {
  // Try API key first
  const env = readSharedEnv();
  const dotenv = readDotEnv();
  const apiKey =
    process.env.ANTHROPIC_API_KEY ||
    env.ANTHROPIC_API_KEY ||
    dotenv.ANTHROPIC_API_KEY;
  if (apiKey) return { headerName: 'x-api-key', headerValue: apiKey };

  // Fall back to OAuth credentials from ~/.claude/.credentials.json
  try {
    const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
    if (fs.existsSync(credPath)) {
      const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
      const token = creds?.claudeAiOauth?.accessToken;
      if (token)
        return { headerName: 'Authorization', headerValue: `Bearer ${token}` };
    }
  } catch {
    /* ignore */
  }

  return null;
}

function callClaudeForSummary(
  context: string,
  type: string,
  ref: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const auth = getClaudeApiAuth();
    if (!auth) {
      reject(new Error('No API key or OAuth token configured'));
      return;
    }

    const prompt = `You are a terse engineering assistant. Given the following ${type === 'pr' ? 'Pull Request' : 'Jira ticket'} context, summarize what is left to do in 2-3 short sentences. Focus on: blockers, failing CI, requested changes, and next steps. If everything looks good, say so. Be concrete and actionable. Do NOT use markdown formatting — no bold, no headers, no bullet lists. Write plain text only, use dashes or numbered lines if needed.\n\nContext:\n${context}`;

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'Content-Length': String(Buffer.byteLength(body)),
      [auth.headerName]: auth.headerValue,
    };

    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers,
      },
      (apiRes) => {
        let data = '';
        apiRes.on('data', (c: Buffer) => {
          data += c.toString();
        });
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const text = parsed.content?.[0]?.text || 'No summary generated';
            resolve(text);
          } catch {
            reject(new Error('Failed to parse Claude response'));
          }
        });
      },
    );
    req.on('error', (err) => {
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

// --- Housekeeping: rule-based session cleanup recommendations ---
function handleHousekeeping(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      const db = getReadDb();
      const groups = db
        .prepare('SELECT * FROM registered_groups')
        .all() as any[];

      const now = Date.now() / 1000;
      const STALE_1H = 3600;
      const STALE_24H = 86400;
      const STALE_7D = 604800;

      const recommendations: {
        folder: string;
        name: string;
        reason: string;
        age: string;
        ageSecs: number;
        cost: number;
        messageCount: number;
        category: string;
      }[] = [];

      for (const g of groups) {
        if (g.is_main) continue; // never touch main

        const tpath = getTranscriptPath(g.folder);
        let transcriptMod = 0;
        let stats: TranscriptStats | null = null;
        let cost = 0;

        if (tpath) {
          try {
            const stat = fs.statSync(tpath);
            transcriptMod = stat.mtimeMs / 1000;
            stats = getTranscriptStats(tpath);
          } catch {
            /* ignore */
          }
          try {
            const gc = emptyCost();
            const tc = emptyCost();
            const dm: Record<string, CostEntry> = {};
            const dd: Record<string, CostEntry> = {};
            scanJsonlForCosts(tpath, tc, gc, dm, dd);
            cost = gc.cost;
          } catch {
            /* ignore */
          }
        }

        const isRunning = transcriptMod > 0 && now - transcriptMod < 120;
        if (isRunning) continue; // never touch running

        const ageSecs = transcriptMod > 0 ? now - transcriptMod : 0;
        const messageCount = stats?.messageCount || 0;
        const displayName =
          resolveDisplayName(db, g.jid, g.name) || g.name || g.folder;

        // Categorize by staleness
        let reason = '';
        let category = '';

        if (ageSecs === 0 || messageCount === 0) {
          reason = 'Empty session — no activity or messages';
          category = 'empty';
        } else if (ageSecs > STALE_7D) {
          const days = Math.floor(ageSecs / 86400);
          reason = `Stale — inactive for ${days} days`;
          category = 'stale_7d';
        } else if (ageSecs > STALE_24H) {
          const hours = Math.floor(ageSecs / 3600);
          reason = `Inactive for ${hours} hours`;
          category = 'stale_24h';
        } else if (ageSecs > STALE_1H) {
          const hours = Math.floor(ageSecs / 3600);
          const mins = Math.floor((ageSecs % 3600) / 60);
          reason = `Idle for ${hours}h ${mins}m`;
          category = 'stale_1h';
        } else {
          continue; // active within the last hour — skip
        }

        recommendations.push({
          folder: g.folder,
          name: displayName,
          reason,
          age: formatAge(ageSecs),
          ageSecs,
          cost,
          messageCount,
          category,
        });
      }

      // Sort: empty first, then by age descending (oldest first)
      recommendations.sort((a, b) => {
        if (a.category === 'empty' && b.category !== 'empty') return -1;
        if (b.category === 'empty' && a.category !== 'empty') return 1;
        return b.ageSecs - a.ageSecs;
      });

      const running = groups.filter((g: any) => {
        const tpath = getTranscriptPath(g.folder);
        if (!tpath) return false;
        try {
          const stat = fs.statSync(tpath);
          return now - stat.mtimeMs / 1000 < 120;
        } catch {
          return false;
        }
      }).length;

      jsonResponse(res, {
        total: groups.length,
        running,
        recommendations,
      });
    } catch (err: any) {
      jsonResponse(
        res,
        { error: 'Housekeeping failed: ' + (err.message || '') },
        500,
      );
    }
  });
}

function formatAge(secs: number): string {
  if (secs < 60) return Math.floor(secs) + 's ago';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}

// Callback for sending messages via channels (set by startWebUI)
let routeOutboundFn: ((jid: string, text: string) => Promise<void>) | null =
  null;

export function startWebUI(opts?: {
  routeOutbound?: (jid: string, text: string) => Promise<void>;
}): void {
  if (opts?.routeOutbound) routeOutboundFn = opts.routeOutbound;
  // Ensure public dir exists
  if (!fs.existsSync(PUBLIC_DIR)) {
    logger.warn(
      { publicDir: PUBLIC_DIR },
      'Web UI public directory not found, skipping',
    );
    return;
  }

  initReadDb()
    .then(() => {
      const server = http.createServer(handleRequest);
      server.listen(WEB_UI_PORT, '0.0.0.0', () => {
        logger.info(`Web UI started on http://localhost:${WEB_UI_PORT}`);
      });
      server.on('error', (err) => {
        logger.error({ err }, 'Web UI server error');
      });

      // Start background work cache refresh every 60s
      refreshWorkCache();
      setInterval(() => {
        refreshWorkCache();
      }, WORK_CACHE_TTL);
    })
    .catch((err) => {
      logger.error({ err }, 'Failed to initialize Web UI database connection');
    });
}
