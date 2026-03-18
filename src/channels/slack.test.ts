import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// --- Mocks ---

// Mock registry (registerChannel runs at import time)
vi.mock('./registry.js', () => ({ registerChannel: vi.fn() }));

// Mock config
vi.mock('../config.js', () => ({
  ASSISTANT_NAME: 'Jonesy',
  TRIGGER_PATTERN: /^@Jonesy\b/i,
}));

// Mock logger
vi.mock('../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock db
vi.mock('../db.js', () => ({
  updateChatName: vi.fn(),
}));

// --- @slack/bolt mock ---

type Handler = (...args: any[]) => any;

const appRef = vi.hoisted(() => ({ current: null as any }));

vi.mock('@slack/bolt', () => ({
  App: class MockApp {
    eventHandlers = new Map<string, Handler>();
    token: string;
    appToken: string;

    client = {
      auth: {
        test: vi.fn().mockResolvedValue({ user_id: 'U_BOT_123' }),
      },
      chat: {
        postMessage: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      },
      reactions: {
        add: vi.fn().mockResolvedValue(undefined),
      },
      conversations: {
        list: vi.fn().mockResolvedValue({
          channels: [],
          response_metadata: {},
        }),
      },
      users: {
        info: vi.fn().mockResolvedValue({
          user: { real_name: 'Alice Smith', name: 'alice' },
        }),
      },
    };

    constructor(opts: any) {
      this.token = opts.token;
      this.appToken = opts.appToken;
      appRef.current = this;
    }

    event(name: string, handler: Handler) {
      this.eventHandlers.set(name, handler);
    }

    error(_handler: Handler) {}
    async start() {}
    async stop() {}
  },
  LogLevel: { ERROR: 'error' },
}));

// Mock env
vi.mock('../env.js', () => ({
  readEnvFile: vi.fn().mockReturnValue({
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_APP_TOKEN: 'xapp-test-token',
  }),
}));

import { SlackChannel, SlackChannelOpts } from './slack.js';
import { updateChatName } from '../db.js';
import { readEnvFile } from '../env.js';

// --- Test helpers ---

function createTestOpts(
  overrides?: Partial<SlackChannelOpts>,
): SlackChannelOpts {
  return {
    onMessage: vi.fn(),
    onChatMetadata: vi.fn(),
    registeredGroups: vi.fn(() => ({
      'slack:C0123456789': {
        name: 'Test Channel',
        folder: 'test-channel',
        trigger: '@Jonesy',
        added_at: '2024-01-01T00:00:00.000Z',
      },
    })),
    registerGroup: vi.fn(),
    ...overrides,
  };
}

function createMessageEvent(overrides: {
  channel?: string;
  channelType?: string;
  user?: string;
  text?: string;
  ts?: string;
  threadTs?: string;
  subtype?: string;
  botId?: string;
}) {
  return {
    channel: overrides.channel ?? 'C0123456789',
    channel_type: overrides.channelType ?? 'channel',
    user: overrides.user ?? 'U_USER_456',
    text: 'text' in overrides ? overrides.text : 'Hello everyone',
    ts: overrides.ts ?? '1704067200.000000',
    thread_ts: overrides.threadTs,
    subtype: overrides.subtype,
    bot_id: overrides.botId,
  };
}

function currentApp() {
  return appRef.current;
}

async function triggerMessageEvent(
  event: ReturnType<typeof createMessageEvent>,
) {
  const handler = currentApp().eventHandlers.get('message');
  if (handler) await handler({ event });
}

// --- Tests ---

describe('SlackChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Connection lifecycle ---

  describe('connection lifecycle', () => {
    it('resolves connect() when app starts', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      await channel.connect();

      expect(channel.isConnected()).toBe(true);
    });

    it('registers message event handler on construction', () => {
      const opts = createTestOpts();
      new SlackChannel(opts);

      expect(currentApp().eventHandlers.has('message')).toBe(true);
    });

    it('gets bot user ID on connect', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      await channel.connect();

      expect(currentApp().client.auth.test).toHaveBeenCalled();
    });

    it('disconnects cleanly', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      await channel.connect();
      expect(channel.isConnected()).toBe(true);

      await channel.disconnect();
      expect(channel.isConnected()).toBe(false);
    });

    it('isConnected() returns false before connect', () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      expect(channel.isConnected()).toBe(false);
    });
  });

  // --- Message handling ---

  describe('message handling', () => {
    it('delivers message for registered channel', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ text: 'Hello everyone' });
      await triggerMessageEvent(event);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'slack:C0123456789',
        expect.any(String),
        undefined,
        'slack',
        true,
      );
      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:C0123456789',
        expect.objectContaining({
          id: '1704067200.000000',
          chat_jid: 'slack:C0123456789',
          sender: 'U_USER_456',
          content: 'Hello everyone',
          is_from_me: false,
        }),
      );
    });

    it('only emits metadata for unregistered channels', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ channel: 'C9999999999' });
      await triggerMessageEvent(event);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'slack:C9999999999',
        expect.any(String),
        undefined,
        'slack',
        true,
      );
      expect(opts.onMessage).not.toHaveBeenCalled();
    });

    it('skips non-text subtypes (channel_join, etc.)', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ subtype: 'channel_join' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).not.toHaveBeenCalled();
      expect(opts.onChatMetadata).not.toHaveBeenCalled();
    });

    it('allows bot_message subtype through', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        subtype: 'bot_message',
        botId: 'B_OTHER_BOT',
        text: 'Bot message',
      });
      await triggerMessageEvent(event);

      expect(opts.onChatMetadata).toHaveBeenCalled();
    });

    it('skips messages with no text', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ text: undefined as any });
      await triggerMessageEvent(event);

      expect(opts.onMessage).not.toHaveBeenCalled();
    });

    it('detects bot messages by bot_id', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        subtype: 'bot_message',
        botId: 'B_MY_BOT',
        text: 'Bot response',
      });
      await triggerMessageEvent(event);

      // Has bot_id so should be marked as bot message
      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:C0123456789',
        expect.objectContaining({
          is_from_me: true,
          is_bot_message: true,
          sender_name: 'Jonesy',
        }),
      );
    });

    it('detects bot messages by matching bot user ID', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        user: 'U_BOT_123',
        text: 'Self message',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:C0123456789',
        expect.objectContaining({
          is_from_me: true,
          is_bot_message: true,
        }),
      );
    });

    it('identifies IM channel type as non-group', async () => {
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({
          'slack:D0123456789': {
            name: 'DM',
            folder: 'dm',
            trigger: '@Jonesy',
            added_at: '2024-01-01T00:00:00.000Z',
          },
        })),
      });
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        channel: 'D0123456789',
        channelType: 'im',
      });
      await triggerMessageEvent(event);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'slack:D0123456789',
        expect.any(String),
        undefined,
        'slack',
        false, // IM is not a group
      );
    });

    it('converts ts to ISO timestamp', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ ts: '1704067200.000000' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:C0123456789',
        expect.objectContaining({
          timestamp: '2024-01-01T00:00:00.000Z',
        }),
      );
    });

    it('resolves user name from Slack API', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ user: 'U_USER_456', text: 'Hello' });
      await triggerMessageEvent(event);

      expect(currentApp().client.users.info).toHaveBeenCalledWith({
        user: 'U_USER_456',
      });
      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:C0123456789',
        expect.objectContaining({
          sender_name: 'Alice Smith',
        }),
      );
    });

    it('caches user names to avoid repeated API calls', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      // First message — API call
      await triggerMessageEvent(
        createMessageEvent({ user: 'U_USER_456', text: 'First' }),
      );
      // Second message — should use cache
      await triggerMessageEvent(
        createMessageEvent({
          user: 'U_USER_456',
          text: 'Second',
          ts: '1704067201.000000',
        }),
      );

      expect(currentApp().client.users.info).toHaveBeenCalledTimes(1);
    });

    it('falls back to user ID when API fails', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      currentApp().client.users.info.mockRejectedValueOnce(
        new Error('API error'),
      );

      const event = createMessageEvent({ user: 'U_UNKNOWN', text: 'Hi' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:C0123456789',
        expect.objectContaining({
          sender_name: 'U_UNKNOWN',
        }),
      );
    });

    it('routes threaded replies to a per-thread JID and auto-registers the thread', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        ts: '1704067201.000000',
        threadTs: '1704067200.000000', // parent message ts — this is a reply
        text: 'Thread reply',
      });
      await triggerMessageEvent(event);

      // Thread reply uses a thread-specific JID
      const threadJid = 'slack:C0123456789:1704067200.000000';
      expect(opts.registerGroup).toHaveBeenCalledWith(
        threadJid,
        expect.objectContaining({
          folder: expect.stringContaining('test-channel_t_'),
        }),
      );
      expect(opts.onMessage).toHaveBeenCalledWith(
        threadJid,
        expect.objectContaining({ content: 'Thread reply' }),
      );
    });

    it('delivers thread parent messages normally', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        ts: '1704067200.000000',
        threadTs: '1704067200.000000', // same as ts — this IS the parent
        text: 'Thread parent',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:C0123456789',
        expect.objectContaining({
          content: 'Thread parent',
        }),
      );
    });

    it('delivers messages without thread_ts normally', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ text: 'Normal message' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalled();
    });
  });

  // --- @mention translation ---

  describe('@mention translation', () => {
    it('prepends trigger when bot is @mentioned via Slack format', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect(); // sets botUserId to 'U_BOT_123'

      const event = createMessageEvent({
        text: 'Hey <@U_BOT_123> what do you think?',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:C0123456789',
        expect.objectContaining({
          content: '@Jonesy Hey <@U_BOT_123> what do you think?',
        }),
      );
    });

    it('does not prepend trigger when trigger pattern already matches', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        text: '@Jonesy <@U_BOT_123> hello',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      // Content should be unchanged since it already matches TRIGGER_PATTERN
      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:C0123456789',
        expect.objectContaining({
          content: '@Jonesy <@U_BOT_123> hello',
        }),
      );
    });

    it('does not translate mentions in bot messages', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        text: 'Echo: <@U_BOT_123>',
        subtype: 'bot_message',
        botId: 'B_MY_BOT',
      });
      await triggerMessageEvent(event);

      // Bot messages skip mention translation
      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:C0123456789',
        expect.objectContaining({
          content: 'Echo: <@U_BOT_123>',
        }),
      );
    });

    it('does not translate mentions for other users', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        text: 'Hey <@U_OTHER_USER> look at this',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      // Mention is for a different user, not the bot
      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:C0123456789',
        expect.objectContaining({
          content: 'Hey <@U_OTHER_USER> look at this',
        }),
      );
    });
  });

  // --- sendMessage ---

  describe('sendMessage', () => {
    it('sends message via Slack client', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      await channel.sendMessage('slack:C0123456789', 'Hello');

      expect(currentApp().client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C0123456789',
        text: 'Hello',
      });
    });

    it('strips slack: prefix from JID', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      await channel.sendMessage('slack:D9876543210', 'DM message');

      expect(currentApp().client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'D9876543210',
        text: 'DM message',
      });
    });

    it('queues message when disconnected', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      // Don't connect — should queue
      await channel.sendMessage('slack:C0123456789', 'Queued message');

      expect(currentApp().client.chat.postMessage).not.toHaveBeenCalled();
    });

    it('queues message on send failure', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      currentApp().client.chat.postMessage.mockRejectedValueOnce(
        new Error('Network error'),
      );

      // Should not throw
      await expect(
        channel.sendMessage('slack:C0123456789', 'Will fail'),
      ).resolves.toBeUndefined();
    });

    it('splits long messages at 4000 character boundary', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      // Create a message longer than 4000 chars
      const longText = 'A'.repeat(4500);
      await channel.sendMessage('slack:C0123456789', longText);

      // Should be split into 2 messages: 4000 + 500
      expect(currentApp().client.chat.postMessage).toHaveBeenCalledTimes(2);
      expect(currentApp().client.chat.postMessage).toHaveBeenNthCalledWith(1, {
        channel: 'C0123456789',
        text: 'A'.repeat(4000),
      });
      expect(currentApp().client.chat.postMessage).toHaveBeenNthCalledWith(2, {
        channel: 'C0123456789',
        text: 'A'.repeat(500),
      });
    });

    it('sends exactly-4000-char messages as a single message', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const text = 'B'.repeat(4000);
      await channel.sendMessage('slack:C0123456789', text);

      expect(currentApp().client.chat.postMessage).toHaveBeenCalledTimes(1);
      expect(currentApp().client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C0123456789',
        text,
      });
    });

    it('splits messages into 3 parts when over 8000 chars', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const longText = 'C'.repeat(8500);
      await channel.sendMessage('slack:C0123456789', longText);

      // 4000 + 4000 + 500 = 3 messages
      expect(currentApp().client.chat.postMessage).toHaveBeenCalledTimes(3);
    });

    it('flushes queued messages on connect', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      // Queue messages while disconnected
      await channel.sendMessage('slack:C0123456789', 'First queued');
      await channel.sendMessage('slack:C0123456789', 'Second queued');

      expect(currentApp().client.chat.postMessage).not.toHaveBeenCalled();

      // Connect triggers flush
      await channel.connect();

      expect(currentApp().client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C0123456789',
        text: 'First queued',
      });
      expect(currentApp().client.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C0123456789',
        text: 'Second queued',
      });
    });
  });

  // --- ownsJid ---

  describe('ownsJid', () => {
    it('owns slack: JIDs', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.ownsJid('slack:C0123456789')).toBe(true);
    });

    it('owns slack: DM JIDs', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.ownsJid('slack:D0123456789')).toBe(true);
    });

    it('does not own non-Slack JID formats', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.ownsJid('12345@g.us')).toBe(false);
      expect(channel.ownsJid('12345@s.example.net')).toBe(false);
    });

    it('does not own unknown JID formats', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.ownsJid('random-string')).toBe(false);
    });
  });

  // --- syncChannelMetadata ---

  describe('syncChannelMetadata', () => {
    it('calls conversations.list and updates chat names', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      currentApp().client.conversations.list.mockResolvedValue({
        channels: [
          { id: 'C001', name: 'general', is_member: true },
          { id: 'C002', name: 'random', is_member: true },
          { id: 'C003', name: 'external', is_member: false },
        ],
        response_metadata: {},
      });

      await channel.connect();

      // connect() calls syncChannelMetadata internally
      expect(updateChatName).toHaveBeenCalledWith('slack:C001', 'general');
      expect(updateChatName).toHaveBeenCalledWith('slack:C002', 'random');
      // Non-member channels are skipped
      expect(updateChatName).not.toHaveBeenCalledWith('slack:C003', 'external');
    });

    it('handles API errors gracefully', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      currentApp().client.conversations.list.mockRejectedValue(
        new Error('API error'),
      );

      // Should not throw
      await expect(channel.connect()).resolves.toBeUndefined();
    });
  });

  // --- setTyping ---

  describe('setTyping', () => {
    it('resolves without error (no-op)', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      // Should not throw — Slack has no bot typing indicator API
      await expect(
        channel.setTyping('slack:C0123456789', true),
      ).resolves.toBeUndefined();
    });

    it('accepts false without error', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      await expect(
        channel.setTyping('slack:C0123456789', false),
      ).resolves.toBeUndefined();
    });
  });

  // --- Constructor error handling ---

  describe('constructor', () => {
    it('throws when SLACK_BOT_TOKEN is missing', () => {
      vi.mocked(readEnvFile).mockReturnValueOnce({
        SLACK_BOT_TOKEN: '',
        SLACK_APP_TOKEN: 'xapp-test-token',
      });

      expect(() => new SlackChannel(createTestOpts())).toThrow(
        'SLACK_BOT_TOKEN and SLACK_APP_TOKEN must be set in .env',
      );
    });

    it('throws when SLACK_APP_TOKEN is missing', () => {
      vi.mocked(readEnvFile).mockReturnValueOnce({
        SLACK_BOT_TOKEN: 'xoxb-test-token',
        SLACK_APP_TOKEN: '',
      });

      expect(() => new SlackChannel(createTestOpts())).toThrow(
        'SLACK_BOT_TOKEN and SLACK_APP_TOKEN must be set in .env',
      );
    });
  });

  // --- syncChannelMetadata pagination ---

  describe('syncChannelMetadata pagination', () => {
    it('paginates through multiple pages of channels', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);

      // First page returns a cursor; second page returns no cursor
      currentApp()
        .client.conversations.list.mockResolvedValueOnce({
          channels: [{ id: 'C001', name: 'general', is_member: true }],
          response_metadata: { next_cursor: 'cursor_page2' },
        })
        .mockResolvedValueOnce({
          channels: [{ id: 'C002', name: 'random', is_member: true }],
          response_metadata: {},
        });

      await channel.connect();

      // Reset mock state — connect() fires a background sync; we test the sync explicitly below
      currentApp().client.conversations.list.mockReset();
      currentApp()
        .client.conversations.list.mockResolvedValueOnce({
          channels: [{ id: 'C001', name: 'general', is_member: true }],
          response_metadata: { next_cursor: 'cursor_page2' },
        })
        .mockResolvedValueOnce({
          channels: [{ id: 'C002', name: 'random', is_member: true }],
          response_metadata: {},
        });

      await channel.syncChannelMetadata();

      // Should have called conversations.list twice (once per page)
      expect(currentApp().client.conversations.list).toHaveBeenCalledTimes(2);
      expect(currentApp().client.conversations.list).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ cursor: 'cursor_page2' }),
      );

      // Both channels from both pages stored
      expect(updateChatName).toHaveBeenCalledWith('slack:C001', 'general');
      expect(updateChatName).toHaveBeenCalledWith('slack:C002', 'random');
    });
  });

  // --- Channel properties ---

  describe('channel properties', () => {
    it('has name "slack"', () => {
      const channel = new SlackChannel(createTestOpts());
      expect(channel.name).toBe('slack');
    });
  });

  // --- addReaction ---

  describe('addReaction', () => {
    it('calls reactions.add with channel and emoji', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      await channel.addReaction(
        'slack:C0123456789',
        '1704067200.000000',
        'eyes',
      );

      expect(currentApp().client.reactions.add).toHaveBeenCalledWith({
        channel: 'C0123456789',
        timestamp: '1704067200.000000',
        name: 'eyes',
      });
    });

    it('strips surrounding colons from emoji name', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      await channel.addReaction(
        'slack:C0123456789',
        '1704067200.000000',
        ':thumbsup:',
      );

      expect(currentApp().client.reactions.add).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'thumbsup' }),
      );
    });

    it('strips leading colon only', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      await channel.addReaction(
        'slack:C0123456789',
        '1704067200.000000',
        ':white_check_mark',
      );

      expect(currentApp().client.reactions.add).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'white_check_mark' }),
      );
    });

    it('works with thread JIDs (uses channel part only)', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      await channel.addReaction(
        'slack:C0123456789:1704067200_000000',
        '1704067201.000000',
        'eyes',
      );

      expect(currentApp().client.reactions.add).toHaveBeenCalledWith({
        channel: 'C0123456789',
        timestamp: '1704067201.000000',
        name: 'eyes',
      });
    });

    it('throws and logs on API error', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      currentApp().client.reactions.add.mockRejectedValueOnce(
        new Error('rate limited'),
      );

      await expect(
        channel.addReaction('slack:C0123456789', '1704067200.000000', 'eyes'),
      ).rejects.toThrow('rate limited');
    });
  });

  // --- editMessage ---

  describe('editMessage', () => {
    it('calls chat.update with channel, ts, and new text', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      await channel.editMessage(
        'slack:C0123456789',
        '1704067200.000000',
        'Updated text',
      );

      expect(currentApp().client.chat.update).toHaveBeenCalledWith({
        channel: 'C0123456789',
        ts: '1704067200.000000',
        text: 'Updated text',
      });
    });

    it('works with thread JIDs (uses channel part only)', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      await channel.editMessage(
        'slack:C0123456789:1704067200_000000',
        '1704067201.000000',
        'Fixed',
      );

      expect(currentApp().client.chat.update).toHaveBeenCalledWith({
        channel: 'C0123456789',
        ts: '1704067201.000000',
        text: 'Fixed',
      });
    });

    it('throws and logs on API error', async () => {
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      currentApp().client.chat.update.mockRejectedValueOnce(
        new Error('message_not_found'),
      );

      await expect(
        channel.editMessage('slack:C0123456789', '1704067200.000000', 'Oops'),
      ).rejects.toThrow('message_not_found');
    });
  });

  // --- SLACK_ALLOWED_USERS filtering ---

  describe('SLACK_ALLOWED_USERS filtering', () => {
    it('allows all users when SLACK_ALLOWED_USERS is not set', async () => {
      // Default mock returns no SLACK_ALLOWED_USERS — all users allowed
      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ user: 'U_ANYONE' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalled();
    });

    it('blocks messages from users not in SLACK_ALLOWED_USERS', async () => {
      vi.mocked(readEnvFile).mockReturnValueOnce({
        SLACK_BOT_TOKEN: 'xoxb-test-token',
        SLACK_APP_TOKEN: 'xapp-test-token',
        SLACK_ALLOWED_USERS: 'U_ALLOWED_1,U_ALLOWED_2',
      });

      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ user: 'U_NOT_ALLOWED' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).not.toHaveBeenCalled();
    });

    it('allows messages from users in SLACK_ALLOWED_USERS', async () => {
      vi.mocked(readEnvFile).mockReturnValueOnce({
        SLACK_BOT_TOKEN: 'xoxb-test-token',
        SLACK_APP_TOKEN: 'xapp-test-token',
        SLACK_ALLOWED_USERS: 'U_ALLOWED_1,U_ALLOWED_2',
      });

      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ user: 'U_ALLOWED_1' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalled();
    });

    it('trims whitespace in SLACK_ALLOWED_USERS list', async () => {
      vi.mocked(readEnvFile).mockReturnValueOnce({
        SLACK_BOT_TOKEN: 'xoxb-test-token',
        SLACK_APP_TOKEN: 'xapp-test-token',
        SLACK_ALLOWED_USERS: 'U_ALLOWED_1 , U_ALLOWED_2',
      });

      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({ user: 'U_ALLOWED_2' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalled();
    });

    it('bot messages always pass through regardless of SLACK_ALLOWED_USERS', async () => {
      vi.mocked(readEnvFile).mockReturnValueOnce({
        SLACK_BOT_TOKEN: 'xoxb-test-token',
        SLACK_APP_TOKEN: 'xapp-test-token',
        SLACK_ALLOWED_USERS: 'U_ALLOWED_ONLY',
      });

      const opts = createTestOpts();
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        subtype: 'bot_message',
        botId: 'B_SOME_BOT',
        text: 'Bot output',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalled();
    });
  });

  // --- Auto-registration on @mention ---

  describe('auto-registration on @mention', () => {
    it('auto-registers unregistered channel when allowed user @mentions bot', async () => {
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({})), // no registered channels
      });
      const channel = new SlackChannel(opts);
      await channel.connect(); // botUserId = 'U_BOT_123'

      const event = createMessageEvent({
        channel: 'CNEWCHANNEL',
        text: 'Hey <@U_BOT_123> can you help?',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      expect(opts.registerGroup).toHaveBeenCalledWith(
        'slack:CNEWCHANNEL',
        expect.objectContaining({
          folder: 'slack_cnewchannel',
          requiresTrigger: false,
          isMain: false,
        }),
      );
      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:CNEWCHANNEL',
        expect.objectContaining({
          content: '@Jonesy Hey <@U_BOT_123> can you help?',
        }),
      );
    });

    it('does NOT auto-register when user is not @mentioning the bot', async () => {
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({})),
      });
      const channel = new SlackChannel(opts);
      await channel.connect();

      // Message without bot @mention in unregistered channel
      const event = createMessageEvent({
        channel: 'CUNREGISTERED',
        text: 'Just talking here',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      expect(opts.registerGroup).not.toHaveBeenCalled();
      expect(opts.onMessage).not.toHaveBeenCalled();
    });

    it('does NOT auto-register when message is from a blocked user', async () => {
      vi.mocked(readEnvFile).mockReturnValueOnce({
        SLACK_BOT_TOKEN: 'xoxb-test-token',
        SLACK_APP_TOKEN: 'xapp-test-token',
        SLACK_ALLOWED_USERS: 'U_ALLOWED_ONLY',
      });

      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({})),
      });
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        channel: 'CUNREGISTERED',
        text: 'Hey <@U_BOT_123>',
        user: 'U_NOT_ALLOWED',
      });
      await triggerMessageEvent(event);

      expect(opts.registerGroup).not.toHaveBeenCalled();
    });

    it('auto-registers thread and parent channel when @mentioned in a thread of unregistered channel', async () => {
      const registeredGroupsMap: Record<string, any> = {};
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => registeredGroupsMap),
        registerGroup: vi.fn((jid, group) => {
          registeredGroupsMap[jid] = group;
        }),
      });
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        channel: 'CNEWCHANNEL',
        ts: '1704067201.000000',
        threadTs: '1704067200.000000',
        text: 'Hey <@U_BOT_123> in thread',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      // Parent channel registered first
      expect(opts.registerGroup).toHaveBeenCalledWith(
        'slack:CNEWCHANNEL',
        expect.objectContaining({ requiresTrigger: false }),
      );
      // Thread session registered second
      const safeTs = '1704067200_000000';
      expect(opts.registerGroup).toHaveBeenCalledWith(
        `slack:CNEWCHANNEL:1704067200.000000`,
        expect.objectContaining({
          folder: expect.stringContaining(`_t_${safeTs}`),
          requiresTrigger: false,
        }),
      );
      // Message delivered to thread JID
      expect(opts.onMessage).toHaveBeenCalledWith(
        'slack:CNEWCHANNEL:1704067200.000000',
        expect.objectContaining({
          content: '@Jonesy Hey <@U_BOT_123> in thread',
        }),
      );
    });

    it('auto-registers thread session when parent channel is already registered', async () => {
      const opts = createTestOpts({
        // Parent channel registered, thread not
        registeredGroups: vi.fn(() => ({
          'slack:C0123456789': {
            name: 'test-channel',
            folder: 'test-channel',
            trigger: '@Jonesy',
            added_at: '2024-01-01T00:00:00.000Z',
          },
        })),
      });
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        channel: 'C0123456789',
        ts: '1704067201.000000',
        threadTs: '1704067200.000000',
        text: 'Thread reply',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      // Thread JID registered (parent already exists)
      expect(opts.registerGroup).toHaveBeenCalledTimes(1);
      expect(opts.registerGroup).toHaveBeenCalledWith(
        'slack:C0123456789:1704067200.000000',
        expect.objectContaining({
          folder: expect.stringContaining('test-channel_t_'),
        }),
      );
    });
  });

  // --- onChatMetadata always called for thread JIDs (FK constraint fix) ---

  describe('thread onChatMetadata (FK constraint fix)', () => {
    it('calls onChatMetadata for thread JID even when thread is already registered', async () => {
      const threadJid = 'slack:C0123456789:1704067200.000000';
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({
          'slack:C0123456789': {
            name: 'Test Channel',
            folder: 'test-channel',
            trigger: '@Jonesy',
            added_at: '2024-01-01T00:00:00.000Z',
          },
          [threadJid]: {
            name: 'test-channel-thread-1704067200_000000',
            folder: 'test-channel_t_1704067200_000000',
            trigger: '@Jonesy',
            added_at: '2024-01-01T00:00:00.000Z',
          },
        })),
      });
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        channel: 'C0123456789',
        ts: '1704067201.000000',
        threadTs: '1704067200.000000',
        text: 'Reply in registered thread',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      // Must always call onChatMetadata for thread JID to satisfy FK constraint
      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        threadJid,
        expect.any(String),
        undefined,
        'slack',
        true,
      );
      expect(opts.onMessage).toHaveBeenCalledWith(
        threadJid,
        expect.objectContaining({ content: 'Reply in registered thread' }),
      );
    });

    it('calls onChatMetadata for both channel and thread JIDs on each thread reply', async () => {
      const threadJid = 'slack:C0123456789:1704067200.000000';
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({
          'slack:C0123456789': {
            name: 'Test Channel',
            folder: 'test-channel',
            trigger: '@Jonesy',
            added_at: '2024-01-01T00:00:00.000Z',
          },
          [threadJid]: {
            name: 'thread',
            folder: 'test-channel_t_1704067200_000000',
            trigger: '@Jonesy',
            added_at: '2024-01-01T00:00:00.000Z',
          },
        })),
      });
      const channel = new SlackChannel(opts);
      await channel.connect();

      const event = createMessageEvent({
        channel: 'C0123456789',
        ts: '1704067202.000000',
        threadTs: '1704067200.000000',
        text: 'Another reply',
        user: 'U_USER_456',
      });
      await triggerMessageEvent(event);

      // Both channel and thread metadata calls must happen
      const metadataCalls = vi.mocked(opts.onChatMetadata).mock.calls;
      const jidsNotified = metadataCalls.map((c) => c[0]);
      expect(jidsNotified).toContain('slack:C0123456789');
      expect(jidsNotified).toContain(threadJid);
    });
  });
});
