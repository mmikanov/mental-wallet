jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '@/data/database';
import { saveCheckinRecord, clearCheckinHistory } from '@/services/checkinRecordService';
import type { CheckinRecord } from '@/types/checkin';

const mockRunAsync = jest.fn();

describe('checkinRecordService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDatabase as jest.Mock).mockResolvedValue({ runAsync: mockRunAsync });
  });

  describe('saveCheckinRecord', () => {
    const validRecord: CheckinRecord = {
      id: 'test-uuid-1234',
      bodyEnergy: 'medium',
      pleasantness: 'unpleasant',
      thoughtPattern: 'racing',
      context: 'alone_at_home',
      derivedFeeling: 'overwhelmed',
      wasChanged: false,
      finalEmotion: 'overwhelmed',
      recordedAt: '2024-01-15T10:30:00.000Z',
    };

    it('writes record to DB successfully', async () => {
      mockRunAsync.mockResolvedValue(undefined);

      await saveCheckinRecord(validRecord);

      expect(mockRunAsync).toHaveBeenCalledTimes(1);
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO guided_checkin_records'),
        [
          validRecord.id,
          validRecord.bodyEnergy,
          validRecord.pleasantness,
          validRecord.thoughtPattern,
          validRecord.context,
          validRecord.derivedFeeling,
          0, // wasChanged: false → 0
          validRecord.finalEmotion,
          validRecord.recordedAt,
        ]
      );
    });

    it('handles DB failure gracefully (logs error, does not throw)', async () => {
      const dbError = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
      mockRunAsync.mockRejectedValue(dbError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(saveCheckinRecord(validRecord)).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[checkinRecordService] Failed to save check-in record:',
        dbError
      );

      consoleSpy.mockRestore();
    });
  });

  describe('clearCheckinHistory', () => {
    it('deletes all records', async () => {
      mockRunAsync.mockResolvedValue(undefined);

      await clearCheckinHistory();

      expect(mockRunAsync).toHaveBeenCalledWith('DELETE FROM guided_checkin_records', []);
    });
  });
});
