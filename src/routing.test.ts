import { describe, it, expect, beforeEach } from 'vitest';

import { _initTestDatabase, getAllChats, storeChatMetadata } from './db.js';
import { getAvailableGroups, _setRegisteredGroups } from './index.js';

beforeEach(() => {
  _initTestDatabase();
  _setRegisteredGroups({});
});

// --- JID ownership patterns ---

describe('JID ownership patterns', () => {
  // These test the patterns that will become ownsJid() on the Channel interface

  it('Slack channel JID: starts with slack:', () => {
    const jid = 'slack:C0123456789';
    expect(jid.startsWith('slack:')).toBe(true);
  });

  it('Slack DM JID: starts with slack:D', () => {
    const jid = 'slack:D0123456789';
    expect(jid.startsWith('slack:')).toBe(true);
  });
});

// --- getAvailableGroups ---

describe('getAvailableGroups', () => {
  it('returns only groups, excludes DMs', () => {
    storeChatMetadata(
      'slack:C0000000001',
      '2024-01-01T00:00:01.000Z',
      'Group 1',
      'slack',
      true,
    );
    storeChatMetadata(
      'slack:D_USER_001',
      '2024-01-01T00:00:02.000Z',
      'User DM',
      'slack',
      false,
    );
    storeChatMetadata(
      'slack:C0000000002',
      '2024-01-01T00:00:03.000Z',
      'Group 2',
      'slack',
      true,
    );

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.jid)).toContain('slack:C0000000001');
    expect(groups.map((g) => g.jid)).toContain('slack:C0000000002');
    expect(groups.map((g) => g.jid)).not.toContain('slack:D_USER_001');
  });

  it('excludes __group_sync__ sentinel', () => {
    storeChatMetadata('__group_sync__', '2024-01-01T00:00:00.000Z');
    storeChatMetadata(
      'slack:C0000000003',
      '2024-01-01T00:00:01.000Z',
      'Group',
      'slack',
      true,
    );

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].jid).toBe('slack:C0000000003');
  });

  it('marks registered groups correctly', () => {
    storeChatMetadata(
      'slack:C_REG_001',
      '2024-01-01T00:00:01.000Z',
      'Registered',
      'slack',
      true,
    );
    storeChatMetadata(
      'slack:C_UNREG_002',
      '2024-01-01T00:00:02.000Z',
      'Unregistered',
      'slack',
      true,
    );

    _setRegisteredGroups({
      'slack:C_REG_001': {
        name: 'Registered',
        folder: 'registered',
        trigger: '@Andy',
        added_at: '2024-01-01T00:00:00.000Z',
      },
    });

    const groups = getAvailableGroups();
    const reg = groups.find((g) => g.jid === 'slack:C_REG_001');
    const unreg = groups.find((g) => g.jid === 'slack:C_UNREG_002');

    expect(reg?.isRegistered).toBe(true);
    expect(unreg?.isRegistered).toBe(false);
  });

  it('returns groups ordered by most recent activity', () => {
    storeChatMetadata(
      'slack:C_OLD_001',
      '2024-01-01T00:00:01.000Z',
      'Old',
      'slack',
      true,
    );
    storeChatMetadata(
      'slack:C_NEW_002',
      '2024-01-01T00:00:05.000Z',
      'New',
      'slack',
      true,
    );
    storeChatMetadata(
      'slack:C_MID_003',
      '2024-01-01T00:00:03.000Z',
      'Mid',
      'slack',
      true,
    );

    const groups = getAvailableGroups();
    expect(groups[0].jid).toBe('slack:C_NEW_002');
    expect(groups[1].jid).toBe('slack:C_MID_003');
    expect(groups[2].jid).toBe('slack:C_OLD_001');
  });

  it('excludes non-group chats regardless of JID format', () => {
    // Unknown JID format stored without is_group should not appear
    storeChatMetadata(
      'unknown-format-123',
      '2024-01-01T00:00:01.000Z',
      'Unknown',
    );
    // Explicitly non-group with unusual JID
    storeChatMetadata(
      'custom:abc',
      '2024-01-01T00:00:02.000Z',
      'Custom DM',
      'custom',
      false,
    );
    // A real group for contrast
    storeChatMetadata(
      'slack:C0000000003',
      '2024-01-01T00:00:03.000Z',
      'Group',
      'slack',
      true,
    );

    const groups = getAvailableGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].jid).toBe('slack:C0000000003');
  });

  it('returns empty array when no chats exist', () => {
    const groups = getAvailableGroups();
    expect(groups).toHaveLength(0);
  });
});
