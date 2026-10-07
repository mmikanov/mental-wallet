import {
  getStoredChannel,
  setChannelOnce,
  resolveInstallChannelOnce,
} from '../analyticsChannel';
import { parseChannelFromReferrer } from '../installReferrer';

// --- Mocks ---

const mockRunAsync = jest.fn().mockResolvedValue(undefined);
const mockGetFirstAsync = jest.fn().mockResolvedValue(null);

jest.mock('../../data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: (...args: unknown[]) => mockRunAsync(...args),
    getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
  }),
}));

jest.mock('@/services/installReferrer', () => ({
  readInstallReferrer: jest.fn(),
  // Keep the real parser so resolution exercises the actual parse logic.
  parseChannelFromReferrer: jest.requireActual('../installReferrer')
    .parseChannelFromReferrer,
}));

import { readInstallReferrer } from '@/services/installReferrer';

const mockReadInstallReferrer = readInstallReferrer as jest.MockedFunction<
  typeof readInstallReferrer
>;

const INSERT_OR_IGNORE_SQL = `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`;

// --- Tests ---

describe('analyticsChannel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFirstAsync.mockResolvedValue(null);
  });

  describe('setChannelOnce', () => {
    it('writes the channel via INSERT OR IGNORE on first write', async () => {
      await setChannelOnce('reddit');

      expect(mockRunAsync).toHaveBeenCalledTimes(1);
      expect(mockRunAsync).toHaveBeenCalledWith(INSERT_OR_IGNORE_SQL, [
        'install_channel',
        'reddit',
      ]);
    });

    it('never overwrites an existing value — second write still uses INSERT OR IGNORE (no UPDATE/REPLACE)', async () => {
      // First write stores 'reddit'. Simulate persistence by having read-back return it.
      await setChannelOnce('reddit');
      mockGetFirstAsync.mockResolvedValue({ value: 'reddit' });

      // Second write with a different value — INSERT OR IGNORE will not overwrite.
      await setChannelOnce('linkedin');

      // Both calls use the write-once form; none use UPDATE or REPLACE.
      for (const call of mockRunAsync.mock.calls) {
        expect(call[0]).toBe(INSERT_OR_IGNORE_SQL);
      }
      // Read-back still returns the first value.
      await expect(getStoredChannel()).resolves.toBe('reddit');
    });

    it('ignores empty input (writes nothing)', async () => {
      await setChannelOnce('');
      expect(mockRunAsync).not.toHaveBeenCalled();
    });

    it('ignores blank/whitespace input (writes nothing)', async () => {
      await setChannelOnce('   ');
      expect(mockRunAsync).not.toHaveBeenCalled();
    });

    it('trims surrounding whitespace before storing', async () => {
      await setChannelOnce('  reddit  ');
      expect(mockRunAsync).toHaveBeenCalledWith(INSERT_OR_IGNORE_SQL, [
        'install_channel',
        'reddit',
      ]);
    });
  });

  describe('getStoredChannel', () => {
    it('returns null when no channel is stored', async () => {
      mockGetFirstAsync.mockResolvedValue(null);
      await expect(getStoredChannel()).resolves.toBeNull();
    });

    it('returns the stored value when present', async () => {
      mockGetFirstAsync.mockResolvedValue({ value: 'reddit' });
      await expect(getStoredChannel()).resolves.toBe('reddit');
    });
  });

  describe('resolveInstallChannelOnce', () => {
    it('parses utm_source from the referrer and stores it once', async () => {
      mockReadInstallReferrer.mockResolvedValue('utm_source=reddit&utm_campaign=x');

      const result = await resolveInstallChannelOnce();

      expect(result).toBe('reddit');
      expect(mockRunAsync).toHaveBeenCalledTimes(1);
      expect(mockRunAsync).toHaveBeenCalledWith(INSERT_OR_IGNORE_SQL, [
        'install_channel',
        'reddit',
      ]);
    });

    it('stores nothing and returns null when the referrer is empty', async () => {
      mockReadInstallReferrer.mockResolvedValue('');

      const result = await resolveInstallChannelOnce();

      expect(result).toBeNull();
      expect(mockRunAsync).not.toHaveBeenCalled();
    });

    it('stores nothing and returns null when the referrer is absent (null)', async () => {
      mockReadInstallReferrer.mockResolvedValue(null);

      const result = await resolveInstallChannelOnce();

      expect(result).toBeNull();
      expect(mockRunAsync).not.toHaveBeenCalled();
    });

    it('stores nothing when the referrer has no utm_source', async () => {
      mockReadInstallReferrer.mockResolvedValue('utm_campaign=x&utm_medium=social');

      const result = await resolveInstallChannelOnce();

      expect(result).toBeNull();
      expect(mockRunAsync).not.toHaveBeenCalled();
    });

    it('does not read the native referrer when a channel is already stored', async () => {
      mockGetFirstAsync.mockResolvedValue({ value: 'reddit' });

      const result = await resolveInstallChannelOnce();

      expect(result).toBe('reddit');
      expect(mockReadInstallReferrer).not.toHaveBeenCalled();
      expect(mockRunAsync).not.toHaveBeenCalled();
    });
  });
});

describe('parseChannelFromReferrer', () => {
  it('returns null for null input', () => {
    expect(parseChannelFromReferrer(null)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseChannelFromReferrer('')).toBeNull();
  });

  it('extracts utm_source from a typical referrer', () => {
    expect(parseChannelFromReferrer('utm_source=reddit&utm_campaign=x')).toBe('reddit');
  });

  it('returns null when utm_source is absent', () => {
    expect(parseChannelFromReferrer('utm_campaign=x&utm_medium=social')).toBeNull();
  });

  it('decodes URL-encoded values', () => {
    expect(parseChannelFromReferrer('utm_source=foo%20bar')).toBe('foo bar');
  });

  it('decodes + as a space', () => {
    expect(parseChannelFromReferrer('utm_source=foo+bar')).toBe('foo bar');
  });

  it('handles utm_source among extra params in any position', () => {
    expect(
      parseChannelFromReferrer('utm_medium=social&utm_source=reddit&utm_campaign=x')
    ).toBe('reddit');
  });

  it('returns null when utm_source has an empty value', () => {
    expect(parseChannelFromReferrer('utm_source=&utm_campaign=x')).toBeNull();
  });
});
