/**
 * MarkClaw Agent Runner (CLI subprocess mode)
 * Runs inside a container, spawns a single long-lived claude CLI process.
 *
 * Input protocol:
 *   Stdin: Full ContainerInput JSON (read until EOF)
 *   IPC:   Follow-up messages written as JSON files to /workspace/ipc/input/
 *          Files: {type:"message", text:"..."}.json — polled and consumed
 *          Sentinel: /workspace/ipc/input/_close — signals session end
 *
 * Stdout protocol:
 *   Each result is wrapped in OUTPUT_START_MARKER / OUTPUT_END_MARKER pairs.
 *   Multiple results may be emitted over the session lifetime.
 *
 * Session lifecycle:
 *   One claude process runs for the entire container lifetime.
 *   Messages are piped to claude's stdin as stream-json. Results stream back.
 *   Container stays alive until the host sends _close (idle timeout).
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  secrets?: Record<string, string>;
}

interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

const IPC_INPUT_DIR = '/workspace/ipc/input';
const IPC_INPUT_CLOSE_SENTINEL = path.join(IPC_INPUT_DIR, '_close');
const IPC_POLL_MS = 500;

const OUTPUT_START_MARKER = '---MARKCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---MARKCLAW_OUTPUT_END---';

// Secrets to strip from Bash tool subprocess environments
const SECRET_ENV_VARS = ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_AUTH_TOKEN'];

function writeOutput(output: ContainerOutput): void {
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

function log(message: string): void {
  console.error(`[agent-runner] ${message}`);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function shouldClose(): boolean {
  if (fs.existsSync(IPC_INPUT_CLOSE_SENTINEL)) {
    try { fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL); } catch { /* ignore */ }
    return true;
  }
  return false;
}

function drainIpcInput(): string[] {
  try {
    fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
    const files = fs.readdirSync(IPC_INPUT_DIR)
      .filter(f => f.endsWith('.json'))
      .sort();

    const messages: string[] = [];
    for (const file of files) {
      const filePath = path.join(IPC_INPUT_DIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        fs.unlinkSync(filePath);
        if (data.type === 'message' && data.text) {
          messages.push(data.text);
        }
      } catch (err) {
        log(`Failed to process input file ${file}: ${err instanceof Error ? err.message : String(err)}`);
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }
    return messages;
  } catch (err) {
    log(`IPC drain error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/**
 * Write MCP config for the markclaw server in the working directory.
 * Claude CLI picks up .mcp.json from cwd automatically.
 */
function writeMcpConfig(containerInput: ContainerInput, sdkEnv: Record<string, string | undefined>): void {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');

  const mcpConfig: Record<string, unknown> = {
    mcpServers: {
      markclaw: {
        command: 'node',
        args: [mcpServerPath],
        env: {
          MARKCLAW_CHAT_JID: containerInput.chatJid,
          MARKCLAW_GROUP_FOLDER: containerInput.groupFolder,
          MARKCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
          ...(sdkEnv.SLACK_BOT_TOKEN ? { SLACK_BOT_TOKEN: sdkEnv.SLACK_BOT_TOKEN } : {}),
        },
      },
    },
  };

  fs.writeFileSync('/workspace/group/.mcp.json', JSON.stringify(mcpConfig, null, 2));
  log('Wrote .mcp.json with markclaw MCP server');
}

/**
 * Write bash sanitization hook to settings.json so secrets don't leak
 * into Bash tool subprocesses.
 */
function writeSanitizeBashHook(): void {
  const hookScript = path.join('/tmp', 'hooks', 'sanitize-bash.js');
  const hookDir = path.dirname(hookScript);
  fs.mkdirSync(hookDir, { recursive: true });

  const secretVars = SECRET_ENV_VARS.map(v => `'${v}'`).join(', ');
  fs.writeFileSync(hookScript, `#!/usr/bin/env node
const SECRET_VARS = [${secretVars}];
let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const command = data.tool_input?.command;
    if (command) {
      const prefix = 'unset ' + SECRET_VARS.join(' ') + ' 2>/dev/null; ';
      process.stdout.write(JSON.stringify({
        decision: 'approve',
        reason: 'sanitized',
        updatedInput: { ...data.tool_input, command: prefix + command },
      }));
    }
  } catch {}
});
`);

  const settingsPath = path.join(process.env.HOME || '/home/node', '.claude', 'settings.json');
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch { /* fresh settings */ }

  settings.hooks = {
    ...(settings.hooks as Record<string, unknown> || {}),
    PreToolUse: [
      {
        matcher: 'Bash',
        hooks: [`node ${hookScript}`],
      },
    ],
  };

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  log('Wrote bash sanitization hook to settings.json');
}

/**
 * Format a user message for stream-json input to claude CLI.
 */
function formatStreamJsonMessage(text: string, sessionId?: string): string {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content: text },
    session_id: sessionId || '',
    parent_tool_use_id: null,
  });
}

/**
 * Run a single long-lived claude CLI session.
 *
 * One claude process runs for the entire container lifetime.
 * Messages arrive via IPC and are piped to stdin as stream-json.
 * Results stream back via stdout. Session ends on _close sentinel.
 * No session timer — the host's idle timeout handles cleanup.
 */
async function runSession(
  initialPrompt: string,
  sessionId: string | undefined,
  sdkEnv: Record<string, string | undefined>,
  additionalDirs: string[],
  supplementalContext: string | undefined,
): Promise<void> {
  const args: string[] = [
    '-p',                                  // print mode (non-interactive)
    '--output-format', 'stream-json',      // structured JSON output
    '--input-format', 'stream-json',       // structured JSON input via stdin
    '--dangerously-skip-permissions',      // bypass all permission checks
    '--verbose',                           // include detailed message types
  ];

  // Additional directories for CLAUDE.md loading
  for (const dir of additionalDirs) {
    args.push('--add-dir', dir);
  }

  // Supplemental system prompt (SOUL.md, TIPS.md)
  if (supplementalContext) {
    args.push('--append-system-prompt', supplementalContext);
  }

  // Resume existing session
  if (sessionId) {
    args.push('--resume', sessionId);
  }

  log(`Starting long-lived claude session (resume: ${sessionId || 'new'}, dirs: ${additionalDirs.join(',')})`);

  const claude = spawn('claude', args, {
    env: sdkEnv as Record<string, string>,
    cwd: '/workspace/group',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let newSessionId: string | undefined;
  let messageCount = 0;
  let resultCount = 0;

  // Send initial prompt
  claude.stdin.write(formatStreamJsonMessage(initialPrompt, sessionId) + '\n');

  // Poll IPC continuously — pipe messages to stdin, close on sentinel
  let ipcPolling = true;
  const pollIpc = () => {
    if (!ipcPolling) return;
    if (shouldClose()) {
      log('Close sentinel detected, closing stdin');
      claude.stdin.end();
      ipcPolling = false;
      return;
    }
    const messages = drainIpcInput();
    for (const text of messages) {
      log(`Piping IPC message (${text.length} chars)`);
      claude.stdin.write(formatStreamJsonMessage(text, newSessionId || sessionId) + '\n');
    }
    setTimeout(pollIpc, IPC_POLL_MS);
  };
  setTimeout(pollIpc, IPC_POLL_MS);

  // Capture stderr for debugging
  claude.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line) log(line);
    }
  });

  // Read stream-json output line by line
  const rl = createInterface({ input: claude.stdout });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line) as Record<string, unknown>;
      messageCount++;
      const msgType = msg.type === 'system' ? `system/${msg.subtype}` : msg.type;
      log(`[msg #${messageCount}] type=${msgType}`);

      // Extract session ID from init message
      if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
        newSessionId = msg.session_id as string;
        log(`Session initialized: ${newSessionId}`);
      }

      // Log assistant content for observability
      if (msg.type === 'assistant') {
        const message = msg.message as { content?: Array<{ type: string; text?: string; name?: string }> } | undefined;
        if (message?.content) {
          const textParts = message.content
            .filter(c => c.type === 'text')
            .map(c => c.text || '')
            .join('');
          const toolCalls = message.content
            .filter(c => c.type === 'tool_use')
            .map(c => c.name || '')
            .join(', ');
          if (textParts) log(`  text: ${textParts.slice(0, 400)}`);
          if (toolCalls) log(`  tools: ${toolCalls}`);
        }
      }

      // Task notifications
      if (msg.type === 'system' && msg.subtype === 'task_notification') {
        log(`Task notification: task=${msg.task_id} status=${msg.status} summary=${msg.summary}`);
      }

      // Handle result — emit to host
      if (msg.type === 'result') {
        resultCount++;
        const textResult = (msg.result as string) || null;
        log(`Result #${resultCount}: subtype=${msg.subtype}${textResult ? ` text=${textResult.slice(0, 200)}` : ''}`);
        writeOutput({
          status: 'success',
          result: textResult,
          newSessionId,
        });
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  // Cleanup
  ipcPolling = false;

  // Wait for process to exit
  const exitCode = await new Promise<number | null>((resolve) => {
    claude.on('close', (code) => resolve(code));
  });

  log(`Session ended. Exit code: ${exitCode}, messages: ${messageCount}, results: ${resultCount}`);

  // Emit final session update
  writeOutput({ status: 'success', result: null, newSessionId: newSessionId || sessionId });

  if (exitCode !== 0 && resultCount === 0) {
    throw new Error(`Claude CLI exited with code ${exitCode}`);
  }
}

async function main(): Promise<void> {
  let containerInput: ContainerInput;

  try {
    const stdinData = await readStdin();
    containerInput = JSON.parse(stdinData);
    try { fs.unlinkSync('/tmp/input.json'); } catch { /* may not exist */ }
    log(`Received input for group: ${containerInput.groupFolder}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to parse input: ${err instanceof Error ? err.message : String(err)}`,
    });
    process.exit(1);
  }

  // Build env: merge secrets so claude CLI can authenticate
  const sdkEnv: Record<string, string | undefined> = { ...process.env };
  for (const [key, value] of Object.entries(containerInput.secrets || {})) {
    sdkEnv[key] = value;
  }

  // Write MCP config for the markclaw IPC server
  writeMcpConfig(containerInput, sdkEnv);

  // Write bash sanitization hook
  writeSanitizeBashHook();

  // Discover additional directories
  const additionalDirs: string[] = [];
  const globalDir = '/workspace/global';
  if (fs.existsSync(globalDir)) {
    additionalDirs.push(globalDir);
  }
  const extraBase = '/workspace/extra';
  if (fs.existsSync(extraBase)) {
    for (const entry of fs.readdirSync(extraBase)) {
      const fullPath = path.join(extraBase, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        additionalDirs.push(fullPath);
      }
    }
  }
  if (additionalDirs.length > 0) {
    log(`Additional directories: ${additionalDirs.join(', ')}`);
  }

  // Load supplemental context (SOUL.md, TIPS.md)
  const supplementalFiles = ['SOUL.md', 'TIPS.md'];
  const supplementalParts: string[] = [];
  for (const filename of supplementalFiles) {
    const filePath = path.join(globalDir, filename);
    if (fs.existsSync(filePath)) {
      supplementalParts.push(fs.readFileSync(filePath, 'utf-8'));
    }
  }
  const supplementalContext = supplementalParts.length > 0 ? supplementalParts.join('\n\n') : undefined;

  const sessionId = containerInput.sessionId;
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });

  // Clean up stale _close sentinel from previous container runs
  try { fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL); } catch { /* ignore */ }

  // Build initial prompt (drain any pending IPC messages too)
  let prompt = containerInput.prompt;
  if (containerInput.isScheduledTask) {
    prompt = `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n${prompt}`;
  }
  const pending = drainIpcInput();
  if (pending.length > 0) {
    log(`Draining ${pending.length} pending IPC messages into initial prompt`);
    prompt += '\n' + pending.join('\n');
  }

  // Run a single long-lived session — exits on _close sentinel or error
  try {
    await runSession(prompt, sessionId, sdkEnv, additionalDirs, supplementalContext);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Session error: ${errorMessage}`);
    writeOutput({
      status: 'error',
      result: null,
      newSessionId: sessionId,
      error: errorMessage,
    });
    process.exit(1);
  }
}

main();
