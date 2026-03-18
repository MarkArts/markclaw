/**
 * Stdio MCP Server for MarkClaw
 * Standalone process that agent teams subagents can inherit.
 * Reads context from environment variables, writes IPC files for the host.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { CronExpressionParser } from 'cron-parser';

const IPC_DIR = '/workspace/ipc';
const MESSAGES_DIR = path.join(IPC_DIR, 'messages');

/** Extract readable text from Slack blocks/attachments when msg.text is empty. */
function extractSlackRichContent(blocks?: any[], attachments?: any[]): string | null {
  const parts: string[] = [];
  if (blocks) {
    for (const block of blocks) {
      if (block.type === 'section' && block.text?.text) parts.push(block.text.text);
      else if (block.type === 'section' && block.fields) {
        for (const f of block.fields) { if (f.text) parts.push(f.text); }
      }
      else if (block.type === 'header' && block.text?.text) parts.push(block.text.text);
      else if (block.type === 'rich_text') {
        for (const el of block.elements || []) {
          if (el.type === 'rich_text_section') {
            const t = (el.elements || []).map((e: any) => e.text || e.url || '').join('');
            if (t) parts.push(t);
          }
        }
      }
      else if (block.type === 'context') {
        for (const el of block.elements || []) { if (el.text) parts.push(el.text); }
      }
    }
  }
  if (attachments) {
    for (const att of attachments) {
      if (att.title) parts.push(att.title);
      if (att.text) parts.push(att.text);
      if (att.fallback && !att.text && !att.title) parts.push(att.fallback);
      if (att.pretext) parts.push(att.pretext);
    }
  }
  return parts.length > 0 ? parts.join('\n') : null;
}
const TASKS_DIR = path.join(IPC_DIR, 'tasks');

// Context from environment variables (set by the agent runner)
const chatJid = process.env.MARKCLAW_CHAT_JID!;
const groupFolder = process.env.MARKCLAW_GROUP_FOLDER!;
const isMain = process.env.MARKCLAW_IS_MAIN === '1';

function writeIpcFile(dir: string, data: object): string {
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(dir, filename);

  // Atomic write: temp file then rename
  const tempPath = `${filepath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filepath);

  return filename;
}

const server = new McpServer({
  name: 'markclaw',
  version: '1.0.0',
});

server.tool(
  'send_message',
  "Send a message to the user or group. This is the ONLY way to communicate with users — your text output is not sent automatically. Call this for every message you want the user to see: acknowledgements, progress updates, final responses, error reports. You can call this multiple times.",
  {
    text: z.string().describe('The message text to send'),
    sender: z.string().optional().describe('Your role/identity name (e.g. "Researcher").'),
    target_jid: z.string().optional().describe('(Main only) Send to a different chat/thread JID. Use to respond in a specific thread, e.g. "slack:CHANNEL:THREAD_TS".'),
  },
  async (args) => {
    const targetJid = (isMain && args.target_jid) ? args.target_jid : chatJid;
    const data: Record<string, string | undefined> = {
      type: 'message',
      chatJid: targetJid,
      text: args.text,
      sender: args.sender || undefined,
      groupFolder,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(MESSAGES_DIR, data);

    return { content: [{ type: 'text' as const, text: 'Message sent.' }] };
  },
);

server.tool(
  'schedule_task',
  `Schedule a recurring or one-time task. The task will run as a full agent with access to all tools.

CONTEXT MODE - Choose based on task type:
\u2022 "group": Task runs in the group's conversation context, with access to chat history. Use for tasks that need context about ongoing discussions, user preferences, or recent interactions.
\u2022 "isolated": Task runs in a fresh session with no conversation history. Use for independent tasks that don't need prior context. When using isolated mode, include all necessary context in the prompt itself.

If unsure which mode to use, you can ask the user. Examples:
- "Remind me about our discussion" \u2192 group (needs conversation context)
- "Check the weather every morning" \u2192 isolated (self-contained task)
- "Follow up on my request" \u2192 group (needs to know what was requested)
- "Generate a daily report" \u2192 isolated (just needs instructions in prompt)

MESSAGING BEHAVIOR - The task agent's output is NOT sent automatically. The agent must use send_message to communicate with the user or group. Include guidance in the prompt about whether the agent should:
\u2022 Always send a message (e.g., reminders, daily briefings)
\u2022 Only send a message when there's something to report (e.g., "notify me if...")
\u2022 Never send a message (background maintenance tasks)

SCHEDULE VALUE FORMAT (all times are LOCAL timezone):
\u2022 cron: Standard cron expression (e.g., "*/5 * * * *" for every 5 minutes, "0 9 * * *" for daily at 9am LOCAL time)
\u2022 interval: Milliseconds between runs (e.g., "300000" for 5 minutes, "3600000" for 1 hour)
\u2022 once: Local time WITHOUT "Z" suffix (e.g., "2026-02-01T15:30:00"). Do NOT use UTC/Z suffix.`,
  {
    prompt: z.string().describe('What the agent should do when the task runs. For isolated mode, include all necessary context here.'),
    schedule_type: z.enum(['cron', 'interval', 'once']).describe('cron=recurring at specific times, interval=recurring every N ms, once=run once at specific time'),
    schedule_value: z.string().describe('cron: "*/5 * * * *" | interval: milliseconds like "300000" | once: local timestamp like "2026-02-01T15:30:00" (no Z suffix!)'),
    context_mode: z.enum(['group', 'isolated']).default('group').describe('group=runs with chat history and memory, isolated=fresh session (include context in prompt)'),
    target_group_jid: z.string().optional().describe('(Main group only) JID of the group to schedule the task for. Defaults to the current group.'),
  },
  async (args) => {
    // Validate schedule_value before writing IPC
    if (args.schedule_type === 'cron') {
      try {
        CronExpressionParser.parse(args.schedule_value);
      } catch {
        return {
          content: [{ type: 'text' as const, text: `Invalid cron: "${args.schedule_value}". Use format like "0 9 * * *" (daily 9am) or "*/5 * * * *" (every 5 min).` }],
          isError: true,
        };
      }
    } else if (args.schedule_type === 'interval') {
      const ms = parseInt(args.schedule_value, 10);
      if (isNaN(ms) || ms <= 0) {
        return {
          content: [{ type: 'text' as const, text: `Invalid interval: "${args.schedule_value}". Must be positive milliseconds (e.g., "300000" for 5 min).` }],
          isError: true,
        };
      }
    } else if (args.schedule_type === 'once') {
      if (/[Zz]$/.test(args.schedule_value) || /[+-]\d{2}:\d{2}$/.test(args.schedule_value)) {
        return {
          content: [{ type: 'text' as const, text: `Timestamp must be local time without timezone suffix. Got "${args.schedule_value}" — use format like "2026-02-01T15:30:00".` }],
          isError: true,
        };
      }
      const date = new Date(args.schedule_value);
      if (isNaN(date.getTime())) {
        return {
          content: [{ type: 'text' as const, text: `Invalid timestamp: "${args.schedule_value}". Use local time format like "2026-02-01T15:30:00".` }],
          isError: true,
        };
      }
    }

    // Non-main groups can only schedule for themselves
    const targetJid = isMain && args.target_group_jid ? args.target_group_jid : chatJid;

    const data = {
      type: 'schedule_task',
      prompt: args.prompt,
      schedule_type: args.schedule_type,
      schedule_value: args.schedule_value,
      context_mode: args.context_mode || 'group',
      targetJid,
      createdBy: groupFolder,
      timestamp: new Date().toISOString(),
    };

    const filename = writeIpcFile(TASKS_DIR, data);

    return {
      content: [{ type: 'text' as const, text: `Task scheduled (${filename}): ${args.schedule_type} - ${args.schedule_value}` }],
    };
  },
);

server.tool(
  'list_tasks',
  "List all scheduled tasks. From main: shows all tasks. From other groups: shows only that group's tasks.",
  {},
  async () => {
    const tasksFile = path.join(IPC_DIR, 'current_tasks.json');

    try {
      if (!fs.existsSync(tasksFile)) {
        return { content: [{ type: 'text' as const, text: 'No scheduled tasks found.' }] };
      }

      const allTasks = JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));

      const tasks = isMain
        ? allTasks
        : allTasks.filter((t: { groupFolder: string }) => t.groupFolder === groupFolder);

      if (tasks.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No scheduled tasks found.' }] };
      }

      const formatted = tasks
        .map(
          (t: { id: string; prompt: string; schedule_type: string; schedule_value: string; status: string; next_run: string }) =>
            `- [${t.id}] ${t.prompt.slice(0, 50)}... (${t.schedule_type}: ${t.schedule_value}) - ${t.status}, next: ${t.next_run || 'N/A'}`,
        )
        .join('\n');

      return { content: [{ type: 'text' as const, text: `Scheduled tasks:\n${formatted}` }] };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error reading tasks: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  },
);

server.tool(
  'pause_task',
  'Pause a scheduled task. It will not run until resumed.',
  { task_id: z.string().describe('The task ID to pause') },
  async (args) => {
    const data = {
      type: 'pause_task',
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return { content: [{ type: 'text' as const, text: `Task ${args.task_id} pause requested.` }] };
  },
);

server.tool(
  'resume_task',
  'Resume a paused task.',
  { task_id: z.string().describe('The task ID to resume') },
  async (args) => {
    const data = {
      type: 'resume_task',
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return { content: [{ type: 'text' as const, text: `Task ${args.task_id} resume requested.` }] };
  },
);

server.tool(
  'cancel_task',
  'Cancel and delete a scheduled task.',
  { task_id: z.string().describe('The task ID to cancel') },
  async (args) => {
    const data = {
      type: 'cancel_task',
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return { content: [{ type: 'text' as const, text: `Task ${args.task_id} cancellation requested.` }] };
  },
);

server.tool(
  'register_group',
  `Register a new chat/group so the agent can respond to messages there. Main group only.

Use available_groups.json to find the JID for a group. The folder name must be channel-prefixed: "slack_{group-name}" (e.g., "slack_general", "slack_dev-team"). Use lowercase with hyphens for the group name part.`,
  {
    jid: z.string().describe('The chat JID (e.g., "slack:C0123456789")'),
    name: z.string().describe('Display name for the group'),
    folder: z.string().describe('Channel-prefixed folder name (e.g., "slack_general", "slack_dev-team")'),
    trigger: z.string().describe('Trigger word (e.g., "@Andy")'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [{ type: 'text' as const, text: 'Only the main group can register new groups.' }],
        isError: true,
      };
    }

    const data = {
      type: 'register_group',
      jid: args.jid,
      name: args.name,
      folder: args.folder,
      trigger: args.trigger,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [{ type: 'text' as const, text: `Group "${args.name}" registered. It will start receiving messages immediately.` }],
    };
  },
);

server.tool(
  'start_thread_task',
  `Start a new task in a dedicated Slack thread. Creates a thread on the specified message, spawns a new agent session for it, and routes the task to that session. Main group only.

Use this when the user requests work that should run independently — e.g., "update PR x", "investigate the bug", "write the docs". The thread provides an isolated workspace with its own session and memory, while the main session stays aware of all active threads.

The new session starts fresh (no conversation history from the main session). Include all relevant context in task_prompt so the thread agent can work autonomously.`,
  {
    message_ts: z.string().describe('The Slack message ts to create a thread on (from the id attribute of the incoming <message> XML)'),
    task_prompt: z.string().describe('Full instructions for the thread agent. Include all context needed since this starts a fresh session.'),
    task_name: z.string().describe('Short descriptive name for the task (e.g., "Fix PR #2726 CI", "Deploy staging", "Research auth bug"). Shown in the UI.'),
    initial_message: z.string().optional().describe('Optional message to post in the thread immediately (e.g., "Working on updating PR x...")'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [{ type: 'text' as const, text: 'Only the main group can start thread tasks.' }],
        isError: true,
      };
    }

    const data = {
      type: 'start_thread_task',
      chatJid,
      messageTs: args.message_ts,
      taskPrompt: args.task_prompt,
      taskName: args.task_name,
      initialMessage: args.initial_message,
      groupFolder,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [{ type: 'text' as const, text: `Thread task started on message ${args.message_ts}. A new agent session will handle it in the thread.` }],
    };
  },
);

server.tool(
  'add_reaction',
  "Add an emoji reaction to a Slack message. Use this to acknowledge messages: 👀 when you start working on something, ✅ when done, ❌ on failure. The message_id is the `id` attribute from the incoming <message> XML.",
  {
    message_id: z.string().describe('The message ID (Slack ts) from the id attribute of the incoming <message> XML'),
    emoji: z.string().describe('Emoji name without colons, e.g. "eyes", "white_check_mark", "x"'),
    target_jid: z.string().optional().describe('Chat JID to react in. Defaults to current chat.'),
  },
  async (args) => {
    const data = {
      type: 'add_reaction',
      chatJid: args.target_jid || chatJid,
      messageId: args.message_id,
      emoji: args.emoji,
    };
    writeIpcFile(MESSAGES_DIR, data);
    return { content: [{ type: 'text' as const, text: 'Reaction added.' }] };
  },
);

server.tool(
  'edit_message',
  "Edit a Slack message that was previously sent. Use the message's Slack ts (timestamp) as the message_id.",
  {
    message_id: z.string().describe('The Slack ts of the message to edit'),
    text: z.string().describe('The new message text'),
    target_jid: z.string().optional().describe('Chat JID. Defaults to current chat.'),
  },
  async (args) => {
    const data = {
      type: 'edit_message',
      chatJid: args.target_jid || chatJid,
      messageId: args.message_id,
      text: args.text,
    };
    writeIpcFile(MESSAGES_DIR, data);
    return { content: [{ type: 'text' as const, text: 'Message edit queued.' }] };
  },
);

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

server.tool(
  'slack_read_thread',
  `Read all messages in a Slack thread. Use this when you need context about what was discussed — especially when responding to a thread where the original message isn't in your conversation history.

The channel_id and thread_ts can be extracted from the chat JID (slack:CHANNEL_ID:THREAD_TS).
Example: chatJid "slack:C085D3GVAD7:1772636935.624119" → channel_id="C085D3GVAD7", thread_ts="1772636935.624119"`,
  {
    channel_id: z.string().describe('Slack channel ID, e.g. "C085D3GVAD7"'),
    thread_ts: z.string().describe('Thread parent timestamp, e.g. "1772636935.624119"'),
    limit: z.number().optional().describe('Max messages to return (default 100)'),
  },
  async (args) => {
    if (!SLACK_BOT_TOKEN) {
      return { content: [{ type: 'text' as const, text: 'SLACK_BOT_TOKEN not available.' }], isError: true };
    }
    const params = new URLSearchParams({
      channel: args.channel_id,
      ts: args.thread_ts,
      limit: String(args.limit ?? 100),
    });
    const resp = await fetch(`https://slack.com/api/conversations.replies?${params}`, {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    });
    const data = await resp.json() as {
      ok: boolean; error?: string;
      messages?: Array<{ user?: string; bot_id?: string; username?: string; text?: string; ts?: string; blocks?: any[]; attachments?: any[]; files?: Array<{ name?: string; url_private?: string }> }>;
    };
    if (!data.ok) {
      return { content: [{ type: 'text' as const, text: `Slack API error: ${data.error}` }], isError: true };
    }
    const lines = (data.messages ?? []).map(m => {
      const who = m.username || m.user || m.bot_id || 'unknown';
      const text = m.text || extractSlackRichContent(m.blocks, m.attachments) || '';
      const fileLabels = (m.files ?? []).map(f => `[file: ${f.name ?? 'unknown'}]`).join(' ');
      return `[${m.ts}] ${who}: ${text}${fileLabels ? ' ' + fileLabels : ''}`;
    });
    return { content: [{ type: 'text' as const, text: lines.join('\n') || 'No messages found.' }] };
  },
);

server.tool(
  'slack_read_channel',
  'Read recent messages from a Slack channel.',
  {
    channel_id: z.string().describe('Slack channel ID, e.g. "C085D3GVAD7"'),
    limit: z.number().optional().describe('Max messages to return (default 50)'),
  },
  async (args) => {
    if (!SLACK_BOT_TOKEN) {
      return { content: [{ type: 'text' as const, text: 'SLACK_BOT_TOKEN not available.' }], isError: true };
    }
    const params = new URLSearchParams({
      channel: args.channel_id,
      limit: String(args.limit ?? 50),
    });
    const resp = await fetch(`https://slack.com/api/conversations.history?${params}`, {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    });
    const data = await resp.json() as {
      ok: boolean; error?: string;
      messages?: Array<{ user?: string; bot_id?: string; username?: string; text?: string; ts?: string; blocks?: any[]; attachments?: any[] }>;
    };
    if (!data.ok) {
      return { content: [{ type: 'text' as const, text: `Slack API error: ${data.error}` }], isError: true };
    }
    const lines = (data.messages ?? []).reverse().map(m => {
      const who = m.username || m.user || m.bot_id || 'unknown';
      const text = m.text || extractSlackRichContent(m.blocks, m.attachments) || '';
      return `[${m.ts}] ${who}: ${text}`;
    });
    return { content: [{ type: 'text' as const, text: lines.join('\n') || 'No messages found.' }] };
  },
);

// Start the stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
