import { App, LogLevel } from '@slack/bolt';
import type { GenericMessageEvent, BotMessageEvent } from '@slack/types';

import { ASSISTANT_NAME, TRIGGER_PATTERN } from '../config.js';
import { updateChatName } from '../db.js';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';
import { registerChannel, ChannelOpts } from './registry.js';
import {
  Channel,
  OnInboundMessage,
  OnChatMetadata,
  RegisteredGroup,
} from '../types.js';

// Slack's chat.postMessage API limits text to ~4000 characters per call.
// Messages exceeding this are split into sequential chunks.
const MAX_MESSAGE_LENGTH = 4000;

/**
 * Extract readable text from Slack rich message blocks and attachments.
 * Used as fallback when msg.text is empty (e.g. Grafana alerts, bot cards).
 */
/** Convert a rich_text element to text, preserving @mentions as <@U12345> */
function richElementToText(e: any): string {
  if (e.type === 'user') return `<@${e.user_id}>`;
  if (e.type === 'channel') return `<#${e.channel_id}>`;
  if (e.type === 'link') return e.url || '';
  if (e.type === 'emoji') return `:${e.name}:`;
  return e.text || '';
}

/** Extract inline elements from a rich_text sub-element */
function richInlineToText(el: any): string {
  return (el.elements || []).map(richElementToText).join('');
}

function extractRichContent(
  blocks?: any[],
  attachments?: any[],
): string | null {
  const parts: string[] = [];

  if (blocks) {
    for (const block of blocks) {
      if (block.type === 'section' && block.text?.text) {
        parts.push(block.text.text);
      } else if (block.type === 'section' && block.fields) {
        for (const field of block.fields) {
          if (field.text) parts.push(field.text);
        }
      } else if (block.type === 'header' && block.text?.text) {
        parts.push(block.text.text);
      } else if (block.type === 'rich_text') {
        for (const el of block.elements || []) {
          if (
            el.type === 'rich_text_section' ||
            el.type === 'rich_text_preformatted'
          ) {
            const text = richInlineToText(el);
            if (text) {
              parts.push(
                el.type === 'rich_text_preformatted'
                  ? `\`\`\`\n${text}\n\`\`\``
                  : text,
              );
            }
          } else if (el.type === 'rich_text_quote') {
            const text = richInlineToText(el);
            if (text)
              parts.push(
                text
                  .split('\n')
                  .map((l: string) => `> ${l}`)
                  .join('\n'),
              );
          } else if (el.type === 'rich_text_list') {
            for (const item of el.elements || []) {
              const text = richInlineToText(item);
              if (text) parts.push(`- ${text}`);
            }
          }
        }
      } else if (block.type === 'context') {
        for (const el of block.elements || []) {
          if (el.text) parts.push(el.text);
        }
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

// The message subtypes we process. Bolt delivers all subtypes via app.event('message');
// we filter to regular messages (GenericMessageEvent, subtype undefined) and bot messages
// (BotMessageEvent, subtype 'bot_message') so we can track our own output.
type HandledMessageEvent = GenericMessageEvent | BotMessageEvent;

export interface SlackChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
  registerGroup: (jid: string, group: RegisteredGroup) => void;
}

export class SlackChannel implements Channel {
  name = 'slack';

  private app: App;
  private botUserId: string | undefined;
  private connected = false;
  private outgoingQueue: Array<{ jid: string; text: string }> = [];
  private flushing = false;
  private userNameCache = new Map<string, string>();

  private opts: SlackChannelOpts;
  private allowedUsers: Set<string> | null = null;
  // Channels where all users can interact (not just allowedUsers)
  private openChannels = new Set(['C0AQ2LYTJ7K']);

  constructor(opts: SlackChannelOpts) {
    this.opts = opts;

    // Read tokens from .env (not process.env — keeps secrets off the environment
    // so they don't leak to child processes, matching MarkClaw's security pattern)
    const env = readEnvFile([
      'SLACK_BOT_TOKEN',
      'SLACK_APP_TOKEN',
      'SLACK_ALLOWED_USERS',
    ]);
    const botToken = env.SLACK_BOT_TOKEN;
    const appToken = env.SLACK_APP_TOKEN;
    this.allowedUsers = env.SLACK_ALLOWED_USERS
      ? new Set(env.SLACK_ALLOWED_USERS.split(',').map((u) => u.trim()))
      : null;

    if (!botToken || !appToken) {
      throw new Error(
        'SLACK_BOT_TOKEN and SLACK_APP_TOKEN must be set in .env',
      );
    }

    this.app = new App({
      token: botToken,
      appToken,
      socketMode: true,
      logLevel: LogLevel.ERROR,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Catch unhandled Bolt errors (e.g. WebSocket drop mid-acknowledgement)
    // and log them instead of letting them propagate as unhandled rejections.
    this.app.error(async (err) => {
      logger.warn(
        { err: err.message },
        'Slack Bolt error (connection may have dropped)',
      );
    });

    // Use app.event('message') instead of app.message() to capture all
    // message subtypes including bot_message (needed to track our own output)
    this.app.event('message', async ({ event }) => {
      try {
        // Bolt's event type is the full MessageEvent union (17+ subtypes).
        // We filter on subtype first, then narrow to the two types we handle.
        const subtype = (event as { subtype?: string }).subtype;
        if (subtype && subtype !== 'bot_message') return;

        // After filtering, event is either GenericMessageEvent or BotMessageEvent
        const msg = event as HandledMessageEvent;

        // Extract rich content from blocks/attachments — these contain more detail
        // than msg.text (which is just a plain-text fallback). Prefer rich content
        // when available, fall back to msg.text, skip if neither exists.
        const anyMsg = msg as any;
        const richContent = extractRichContent(
          anyMsg.blocks,
          anyMsg.attachments,
        );
        if (richContent) {
          (msg as any).text = richContent;
        } else if (!msg.text) {
          return;
        }

        const channelJid = `slack:${msg.channel}`;
        const timestamp = new Date(parseFloat(msg.ts) * 1000).toISOString();
        const isGroup = msg.channel_type !== 'im';

        // Determine JID: thread replies get their own session per thread_ts
        const threadTs = (msg as { thread_ts?: string }).thread_ts;
        const isThreadReply = !!threadTs && threadTs !== msg.ts;
        const jid = isThreadReply
          ? `slack:${msg.channel}:${threadTs}`
          : channelJid;

        // Always report metadata for group discovery (use channel JID for metadata)
        this.opts.onChatMetadata(
          channelJid,
          timestamp,
          undefined,
          'slack',
          isGroup,
        );
        // Thread JIDs need their own chat record in the DB before messages can be stored
        if (isThreadReply) {
          this.opts.onChatMetadata(jid, timestamp, undefined, 'slack', true);
        }

        // Only deliver full messages for registered groups
        const groups = this.opts.registeredGroups();

        const isBotMessage = !!msg.bot_id || msg.user === this.botUserId;

        // Only respond to allowed users (when SLACK_ALLOWED_USERS is set)
        if (
          !isBotMessage &&
          this.allowedUsers &&
          msg.user &&
          !this.allowedUsers.has(msg.user) &&
          !this.openChannels.has(msg.channel)
        )
          return;

        // Check if this is an @mention from an allowed user — used to auto-register unregistered channels
        const isMentionFromAllowedUser =
          !isBotMessage &&
          this.botUserId &&
          (msg as { text?: string }).text?.includes(`<@${this.botUserId}>`);

        if (isThreadReply) {
          if (!groups[jid]) {
            // Check if parent is a main DM — route thread replies to main session
            // instead of auto-creating thread sessions. The main agent can use
            // start_thread_task to explicitly create thread sessions when needed.
            const parentGroup = groups[channelJid];
            if (parentGroup?.isMain && !isGroup) {
              // Route to main session with thread context annotation
              const threadJid = `slack:${msg.channel}:${threadTs}`;

              let senderName: string;
              if (isBotMessage) {
                senderName = ASSISTANT_NAME;
              } else {
                senderName =
                  (await this.resolveUserName(msg.user ?? '')) ||
                  msg.user ||
                  'unknown';
              }

              // Translate @mentions for the main session
              let mainContent = await this.resolveMentions(msg.text ?? '');
              if (this.botUserId && !isBotMessage) {
                const mentionPattern = `<@${this.botUserId}>`;
                if (
                  mainContent.includes(mentionPattern) &&
                  !TRIGGER_PATTERN.test(mainContent)
                ) {
                  mainContent = `@${ASSISTANT_NAME} ${mainContent}`;
                }
              }

              this.opts.onMessage(channelJid, {
                id: msg.ts,
                chat_jid: channelJid,
                sender: msg.user || msg.bot_id || '',
                sender_name: senderName,
                content: `[thread:${threadJid}] ${mainContent}`,
                timestamp,
                is_from_me: isBotMessage,
                is_bot_message: isBotMessage,
              });
              return;
            }

            // Non-main channels: auto-register thread session (existing behavior)
            // Auto-register parent channel if missing and user @mentioned the bot
            if (!groups[channelJid]) {
              if (!isMentionFromAllowedUser) return;
              const channelFolder = `slack_${msg.channel.toLowerCase()}`.slice(
                0,
                64,
              );
              this.opts.registerGroup(channelJid, {
                name: msg.channel,
                folder: channelFolder,
                trigger: ASSISTANT_NAME,
                added_at: new Date().toISOString(),
                requiresTrigger: false,
                isMain: false,
              });
              this.opts.onChatMetadata(
                channelJid,
                timestamp,
                msg.channel,
                'slack',
                true,
              );
            }
            // Auto-register thread session inheriting parent channel config
            // In group channels (not open channels), only auto-register if user @mentioned the bot
            const parent = this.opts.registeredGroups()[channelJid];
            if (isGroup && !this.openChannels.has(msg.channel) && !isMentionFromAllowedUser) return;
            const safeTs = threadTs!.replace('.', '_');
            const folder = `${parent.folder}_t_${safeTs}`.slice(0, 64);
            this.opts.registerGroup(jid, {
              name: `${parent.name}-thread-${safeTs}`,
              folder,
              trigger: parent.trigger,
              added_at: new Date().toISOString(),
              requiresTrigger: false,
              isMain: false,
            });
            this.opts.onChatMetadata(jid, timestamp, undefined, 'slack', true);
          }
          // Fall through to deliver the message
        } else {
          if (!groups[jid]) {
            if (!isMentionFromAllowedUser) return;
            // Auto-register the channel on first @mention from an allowed user
            const channelFolder = `slack_${msg.channel.toLowerCase()}`.slice(
              0,
              64,
            );
            this.opts.registerGroup(jid, {
              name: msg.channel,
              folder: channelFolder,
              trigger: ASSISTANT_NAME,
              added_at: new Date().toISOString(),
              requiresTrigger: false,
              isMain: false,
            });
            this.opts.onChatMetadata(
              jid,
              timestamp,
              msg.channel,
              'slack',
              true,
            );
          }
        }

        let senderName: string;
        if (isBotMessage) {
          senderName = ASSISTANT_NAME;
        } else {
          senderName =
            (await this.resolveUserName(msg.user ?? '')) ||
            msg.user ||
            'unknown';
        }

        // Resolve all <@U12345> mentions to @DisplayName, then translate
        // the bot's own mention into the trigger pattern.
        let content = await this.resolveMentions(msg.text ?? '');
        if (this.botUserId && !isBotMessage) {
          const mentionPattern = `<@${this.botUserId}>`;
          if (
            content.includes(mentionPattern) &&
            !TRIGGER_PATTERN.test(content)
          ) {
            content = `@${ASSISTANT_NAME} ${content}`;
          }
        }

        this.opts.onMessage(jid, {
          id: msg.ts,
          chat_jid: jid,
          sender: msg.user || msg.bot_id || '',
          sender_name: senderName,
          content,
          timestamp,
          is_from_me: isBotMessage,
          is_bot_message: isBotMessage,
        });
      } catch (err) {
        logger.error({ err }, 'Error handling Slack message event');
      }
    });

    // Handle @mentions via app_mention events — these fire even when
    // message.channels is not subscribed, ensuring the bot responds to
    // @mentions in channels it has been invited to.
    this.app.event('app_mention', async ({ event }) => {
      try {
        if (!event.text) return;

        const channelJid = `slack:${event.channel}`;
        const timestamp = new Date(parseFloat(event.ts) * 1000).toISOString();

        // Thread handling
        const threadTs = (event as { thread_ts?: string }).thread_ts;
        const isThreadReply = !!threadTs && threadTs !== event.ts;
        const jid = isThreadReply
          ? `slack:${event.channel}:${threadTs}`
          : channelJid;

        // Report metadata
        this.opts.onChatMetadata(
          channelJid,
          timestamp,
          undefined,
          'slack',
          true,
        );
        if (isThreadReply) {
          this.opts.onChatMetadata(jid, timestamp, undefined, 'slack', true);
        }

        // Only allowed users (open channels bypass)
        if (
          this.allowedUsers &&
          event.user &&
          !this.allowedUsers.has(event.user) &&
          !this.openChannels.has(event.channel)
        )
          return;

        const groups = this.opts.registeredGroups();

        // Check if this message was already handled by the 'message' event handler.
        // If the group exists and is registered, the message handler will have processed it.
        // We only need app_mention for auto-registering new channels.
        if (groups[jid]) {
          logger.debug(
            { jid },
            'app_mention: group already registered, skipping (message handler will process)',
          );
          return;
        }

        // Auto-register the channel
        logger.info(
          { jid, channel: event.channel, user: event.user },
          'app_mention: auto-registering channel',
        );
        const channelFolder = `slack_${event.channel.toLowerCase()}`.slice(
          0,
          64,
        );

        if (isThreadReply) {
          // Register parent channel if needed
          if (!groups[channelJid]) {
            this.opts.registerGroup(channelJid, {
              name: event.channel,
              folder: channelFolder,
              trigger: ASSISTANT_NAME,
              added_at: new Date().toISOString(),
              requiresTrigger: false,
              isMain: false,
            });
            this.opts.onChatMetadata(
              channelJid,
              timestamp,
              event.channel,
              'slack',
              true,
            );
          }
          // Register thread session
          const parent = this.opts.registeredGroups()[channelJid];
          const safeTs = threadTs!.replace('.', '_');
          const folder = `${parent.folder}_t_${safeTs}`.slice(0, 64);
          this.opts.registerGroup(jid, {
            name: `${parent.name}-thread-${safeTs}`,
            folder,
            trigger: parent.trigger,
            added_at: new Date().toISOString(),
            requiresTrigger: false,
            isMain: false,
          });
          this.opts.onChatMetadata(jid, timestamp, undefined, 'slack', true);
        } else {
          this.opts.registerGroup(jid, {
            name: event.channel,
            folder: channelFolder,
            trigger: ASSISTANT_NAME,
            added_at: new Date().toISOString(),
            requiresTrigger: false,
            isMain: false,
          });
          this.opts.onChatMetadata(
            jid,
            timestamp,
            event.channel,
            'slack',
            true,
          );
        }

        // Resolve sender name
        const senderName =
          (await this.resolveUserName(event.user ?? '')) ||
          event.user ||
          'unknown';

        // Translate @mention into trigger format
        let content = event.text ?? '';
        if (this.botUserId) {
          const mentionPattern = `<@${this.botUserId}>`;
          if (
            content.includes(mentionPattern) &&
            !TRIGGER_PATTERN.test(content)
          ) {
            content = `@${ASSISTANT_NAME} ${content}`;
          }
        }

        this.opts.onMessage(jid, {
          id: event.ts,
          chat_jid: jid,
          sender: event.user || '',
          sender_name: senderName,
          content,
          timestamp,
          is_from_me: false,
          is_bot_message: false,
        });
      } catch (err) {
        logger.error({ err }, 'Error handling Slack app_mention event');
      }
    });

    this.app.event('reaction_added', async ({ event }) => {
      try {
        if (event.item.type !== 'message') return;
        const reactionChannel = (event.item as { channel?: string }).channel;
        if (this.allowedUsers && !this.allowedUsers.has(event.user) && (!reactionChannel || !this.openChannels.has(reactionChannel))) return;

        const channelId = (
          event.item as { type: 'message'; channel: string; ts: string }
        ).channel;
        const reactionTs = (
          event.item as { type: 'message'; channel: string; ts: string }
        ).ts;
        const channelJid = `slack:${channelId}`;
        const threadJid = `slack:${channelId}:${reactionTs}`;
        const groups = this.opts.registeredGroups();

        // Prefer thread session if the reacted message is a tracked thread root
        const targetJid = groups[threadJid]
          ? threadJid
          : groups[channelJid]
            ? channelJid
            : null;
        if (!targetJid) return;

        const senderName =
          (await this.resolveUserName(event.user)) || event.user;
        const timestamp = new Date(
          parseFloat(event.event_ts) * 1000,
        ).toISOString();

        this.opts.onMessage(targetJid, {
          id: event.event_ts,
          chat_jid: targetJid,
          sender: event.user,
          sender_name: senderName,
          content: `:${event.reaction}:`,
          timestamp,
          is_from_me: false,
          is_bot_message: false,
        });
      } catch (err) {
        logger.error({ err }, 'Error handling Slack reaction_added event');
      }
    });
  }

  private startConnectionWatchdog(): void {
    // Poll every 60s — exit only after 3 consecutive failures so brief network
    // blips don't cause unnecessary restarts.
    const CHECK_INTERVAL = 60_000;
    const MAX_FAILURES = 3;
    let failures = 0;
    const watchdog = setInterval(async () => {
      try {
        await this.app.client.auth.test();
        failures = 0; // Reset on success
      } catch {
        failures++;
        if (failures >= MAX_FAILURES) {
          logger.error(
            { failures },
            'Slack connection watchdog: API unreachable for 3 consecutive checks, restarting process',
          );
          clearInterval(watchdog);
          process.exit(1);
        } else {
          logger.warn(
            { failures, maxFailures: MAX_FAILURES },
            'Slack connection watchdog: API check failed, will retry',
          );
        }
      }
    }, CHECK_INTERVAL);
    watchdog.unref(); // Don't prevent process exit
  }

  async connect(): Promise<void> {
    await this.app.start();

    // Get bot's own user ID for self-message detection.
    // Resolve this BEFORE setting connected=true so that messages arriving
    // during startup can correctly detect bot-sent messages.
    try {
      const auth = await this.app.client.auth.test();
      this.botUserId = auth.user_id as string;
      logger.info({ botUserId: this.botUserId }, 'Connected to Slack');
    } catch (err) {
      logger.warn({ err }, 'Connected to Slack but failed to get bot user ID');
    }

    this.connected = true;
    this.startConnectionWatchdog();

    // Flush any messages queued before connection
    await this.flushOutgoingQueue();

    // Sync channel names in background (don't block startup)
    this.syncChannelMetadata().catch(() => {});
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    // JID format: slack:CHANNEL_ID or slack:CHANNEL_ID:THREAD_TS
    const parts = jid.split(':');
    const channelId = parts[1];
    // Only use thread_ts if it looks like a valid Slack timestamp (digits.digits).
    // Synthetic thread IDs (e.g. admin-ui "admin-1234-xyz") are not valid and
    // would cause Slack API errors — fall back to posting in the channel.
    const rawThreadTs = parts[2];
    const threadTs =
      rawThreadTs && /^\d+\.\d+$/.test(rawThreadTs) ? rawThreadTs : undefined;

    if (!this.connected) {
      this.outgoingQueue.push({ jid, text });
      logger.info(
        { jid, queueSize: this.outgoingQueue.length },
        'Slack disconnected, message queued',
      );
      return;
    }

    try {
      const postChunk = (chunk: string) =>
        this.app.client.chat.postMessage({
          channel: channelId,
          text: chunk,
          ...(threadTs ? { thread_ts: threadTs } : {}),
        });

      // Slack limits messages to ~4000 characters; split if needed
      if (text.length <= MAX_MESSAGE_LENGTH) {
        await postChunk(text);
      } else {
        for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) {
          await postChunk(text.slice(i, i + MAX_MESSAGE_LENGTH));
        }
      }
      logger.info({ jid, length: text.length }, 'Slack message sent');
    } catch (err) {
      this.outgoingQueue.push({ jid, text });
      logger.warn(
        { jid, err, queueSize: this.outgoingQueue.length },
        'Failed to send Slack message, queued',
      );
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('slack:');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    await this.app.stop();
  }

  // Slack does not expose a typing indicator API for bots.
  // This no-op satisfies the Channel interface so the orchestrator
  // doesn't need channel-specific branching.
  async setTyping(_jid: string, _isTyping: boolean): Promise<void> {
    // no-op: Slack Bot API has no typing indicator endpoint
  }

  async editMessage(
    jid: string,
    messageTs: string,
    newText: string,
  ): Promise<void> {
    const channelId = jid.split(':')[1];
    try {
      await this.app.client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: newText,
      });
      logger.info(
        { jid, messageTs, length: newText.length },
        'Slack message edited',
      );
    } catch (err) {
      logger.warn({ jid, messageTs, err }, 'Failed to edit Slack message');
      throw err;
    }
  }

  async addReaction(
    jid: string,
    messageTs: string,
    emoji: string,
  ): Promise<void> {
    const channelId = jid.split(':')[1];
    // Strip surrounding colons if provided (e.g. ":thumbsup:" → "thumbsup")
    const name = emoji.replace(/^:|:$/g, '');
    try {
      await this.app.client.reactions.add({
        channel: channelId,
        timestamp: messageTs,
        name,
      });
      logger.info({ jid, messageTs, emoji: name }, 'Slack reaction added');
    } catch (err) {
      logger.warn(
        { jid, messageTs, emoji: name, err },
        'Failed to add Slack reaction',
      );
      throw err;
    }
  }

  /**
   * Sync channel metadata from Slack.
   * Fetches channels the bot is a member of and stores their names in the DB.
   */
  /** Public for testing. Called in background on connect(). */
  async syncChannelMetadata(): Promise<void> {
    try {
      logger.info('Syncing channel metadata from Slack...');
      let cursor: string | undefined;
      let count = 0;

      do {
        const result = await this.app.client.conversations.list({
          types: 'public_channel,private_channel',
          exclude_archived: true,
          limit: 200,
          cursor,
        });

        for (const ch of result.channels || []) {
          if (ch.id && ch.name && ch.is_member) {
            updateChatName(`slack:${ch.id}`, ch.name);
            count++;
          }
        }

        cursor = result.response_metadata?.next_cursor || undefined;
      } while (cursor);

      logger.info({ count }, 'Slack channel metadata synced');
    } catch (err) {
      logger.error({ err }, 'Failed to sync Slack channel metadata');
    }
  }

  private async resolveUserName(userId: string): Promise<string | undefined> {
    if (!userId) return undefined;

    const cached = this.userNameCache.get(userId);
    if (cached) return cached;

    try {
      const result = await this.app.client.users.info({ user: userId });
      const name = result.user?.real_name || result.user?.name;
      if (name) this.userNameCache.set(userId, name);
      return name;
    } catch (err) {
      logger.debug({ userId, err }, 'Failed to resolve Slack user name');
      return undefined;
    }
  }

  /** Resolve <@U12345> and <@U12345|Name> mentions in text to @DisplayName */
  private async resolveMentions(text: string): Promise<string> {
    const mentionPattern = /<@(U[A-Z0-9]+)(?:\|([^>]*))?>/g;
    const mentions = [...text.matchAll(mentionPattern)];
    if (mentions.length === 0) return text;

    let result = text;
    for (const match of mentions) {
      const userId = match[1];
      const fallbackName = match[2]; // Slack sometimes includes |Name
      const displayName =
        fallbackName || (await this.resolveUserName(userId)) || userId;
      result = result.replace(match[0], `@${displayName}`);
    }
    return result;
  }

  private async flushOutgoingQueue(): Promise<void> {
    if (this.flushing || this.outgoingQueue.length === 0) return;
    this.flushing = true;
    try {
      logger.info(
        { count: this.outgoingQueue.length },
        'Flushing Slack outgoing queue',
      );
      while (this.outgoingQueue.length > 0) {
        const item = this.outgoingQueue.shift()!;
        const parts = item.jid.split(':');
        const channelId = parts[1];
        const rawTs = parts[2];
        const threadTs = rawTs && /^\d+\.\d+$/.test(rawTs) ? rawTs : undefined;
        await this.app.client.chat.postMessage({
          channel: channelId,
          text: item.text,
          ...(threadTs ? { thread_ts: threadTs } : {}),
        });
        logger.info(
          { jid: item.jid, length: item.text.length },
          'Queued Slack message sent',
        );
      }
    } finally {
      this.flushing = false;
    }
  }
}

registerChannel('slack', (opts: ChannelOpts) => {
  const envVars = readEnvFile(['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN']);
  if (!envVars.SLACK_BOT_TOKEN || !envVars.SLACK_APP_TOKEN) {
    logger.warn('Slack: SLACK_BOT_TOKEN or SLACK_APP_TOKEN not set');
    return null;
  }
  return new SlackChannel(opts);
});
