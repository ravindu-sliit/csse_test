// ─── Module mocks (must come before any imports of the mocked modules) ──────────

jest.mock('../../config/database', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma,
}));

// ─── Imports ─────────────────────────────────────────────────────────────────────

import { NotificationChannel } from '@prisma/client';
import { mockPrisma, resetMockPrisma } from '../mocks/prisma.mock';
import {
  simulateBroadcast,
  calculateTotalReach,
} from '../../services/notification.service';

// ─── Constants mirrored from the service ─────────────────────────────────────────

const SIMULATED_REACH: Record<string, number> = {
  SMS_BLAST: 8200000,
  PUSH_NOTIFICATION: 1400000,
  TV_RADIO: 12000000,
  COASTAL_SIREN: 500000,
};

// ─── Shared fixtures ─────────────────────────────────────────────────────────────

const WARNING_ID = 'warning-uuid-1';

const buildBroadcastRecord = (channel: string, estimated: number) => ({
  id: `broadcast-${channel}`,
  warningId: WARNING_ID,
  channel: channel as NotificationChannel,
  status: 'completed',
  estimatedReach: estimated,
  confirmedReach: Math.floor(estimated * 0.9),
  failedCount: Math.floor(estimated * 0.1),
  startedAt: new Date('2024-01-01T00:00:00Z'),
  completedAt: new Date('2024-01-01T00:00:01Z'),
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:01Z'),
});

// ─── Test suite ───────────────────────────────────────────────────────────────────

describe('notification.service', () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  // ── simulateBroadcast ─────────────────────────────────────────────────────────

  describe('simulateBroadcast()', () => {
    it('creates a warningBroadcast and notificationLog for a single channel', async () => {
      const channel = 'SMS_BLAST';
      const estimated = SIMULATED_REACH[channel]; // 8_200_000
      const broadcastRecord = buildBroadcastRecord(channel, estimated);

      (mockPrisma.warningBroadcast.create as jest.Mock).mockResolvedValueOnce(broadcastRecord);
      (mockPrisma.notificationLog.create as jest.Mock).mockResolvedValueOnce({});

      const results = await simulateBroadcast(WARNING_ID, [channel]);

      // One broadcast record returned
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(broadcastRecord);

      // warningBroadcast.create called once with correct shape
      expect(mockPrisma.warningBroadcast.create).toHaveBeenCalledTimes(1);
      const broadcastCall = (mockPrisma.warningBroadcast.create as jest.Mock).mock.calls[0][0];
      expect(broadcastCall.data.warningId).toBe(WARNING_ID);
      expect(broadcastCall.data.channel).toBe(channel);
      expect(broadcastCall.data.status).toBe('completed');
      expect(broadcastCall.data.estimatedReach).toBe(estimated);
      expect(broadcastCall.data.confirmedReach).toBeGreaterThanOrEqual(0);
      expect(broadcastCall.data.confirmedReach).toBeLessThanOrEqual(estimated);
      expect(broadcastCall.data.failedCount).toBeGreaterThanOrEqual(0);
      expect(broadcastCall.data.failedCount).toBeLessThanOrEqual(estimated);
      expect(broadcastCall.data.startedAt).toBeInstanceOf(Date);
      expect(broadcastCall.data.completedAt).toBeInstanceOf(Date);

      // notificationLog.create called once with correct shape
      expect(mockPrisma.notificationLog.create).toHaveBeenCalledTimes(1);
      const logCall = (mockPrisma.notificationLog.create as jest.Mock).mock.calls[0][0];
      expect(logCall.data.warningId).toBe(WARNING_ID);
      expect(logCall.data.channel).toBe(channel);
      expect(logCall.data.recipientCount).toBe(estimated);
      expect(logCall.data.deliveredCount).toBeGreaterThanOrEqual(0);
      expect(logCall.data.failedCount).toBeGreaterThanOrEqual(0);
    });

    it('uses SIMULATED_REACH estimatedReach for each known channel', async () => {
      const channel = 'TV_RADIO';
      const expected = SIMULATED_REACH[channel]; // 12_000_000

      (mockPrisma.warningBroadcast.create as jest.Mock).mockResolvedValueOnce(
        buildBroadcastRecord(channel, expected),
      );
      (mockPrisma.notificationLog.create as jest.Mock).mockResolvedValueOnce({});

      await simulateBroadcast(WARNING_ID, [channel]);

      const broadcastData = (mockPrisma.warningBroadcast.create as jest.Mock).mock.calls[0][0].data;
      expect(broadcastData.estimatedReach).toBe(expected);

      const logData = (mockPrisma.notificationLog.create as jest.Mock).mock.calls[0][0].data;
      expect(logData.recipientCount).toBe(expected);
    });

    it('falls back to 100 000 estimatedReach for an unknown channel', async () => {
      const channel = 'UNKNOWN_CHANNEL';
      const fallback = 100000;

      (mockPrisma.warningBroadcast.create as jest.Mock).mockResolvedValueOnce(
        buildBroadcastRecord(channel, fallback),
      );
      (mockPrisma.notificationLog.create as jest.Mock).mockResolvedValueOnce({});

      await simulateBroadcast(WARNING_ID, [channel]);

      const broadcastData = (mockPrisma.warningBroadcast.create as jest.Mock).mock.calls[0][0].data;
      expect(broadcastData.estimatedReach).toBe(fallback);

      const logData = (mockPrisma.notificationLog.create as jest.Mock).mock.calls[0][0].data;
      expect(logData.recipientCount).toBe(fallback);
    });

    it('handles multiple channels: creates one broadcast and one log per channel', async () => {
      const channels = ['SMS_BLAST', 'PUSH_NOTIFICATION', 'COASTAL_SIREN'];

      for (const ch of channels) {
        (mockPrisma.warningBroadcast.create as jest.Mock).mockResolvedValueOnce(
          buildBroadcastRecord(ch, SIMULATED_REACH[ch]),
        );
        (mockPrisma.notificationLog.create as jest.Mock).mockResolvedValueOnce({});
      }

      const results = await simulateBroadcast(WARNING_ID, channels);

      expect(results).toHaveLength(channels.length);
      expect(mockPrisma.warningBroadcast.create).toHaveBeenCalledTimes(channels.length);
      expect(mockPrisma.notificationLog.create).toHaveBeenCalledTimes(channels.length);

      // Each call should reference the correct channel and estimatedReach
      for (let i = 0; i < channels.length; i++) {
        const broadcastData = (mockPrisma.warningBroadcast.create as jest.Mock).mock.calls[i][0].data;
        expect(broadcastData.channel).toBe(channels[i]);
        expect(broadcastData.estimatedReach).toBe(SIMULATED_REACH[channels[i]]);

        const logData = (mockPrisma.notificationLog.create as jest.Mock).mock.calls[i][0].data;
        expect(logData.channel).toBe(channels[i]);
        expect(logData.recipientCount).toBe(SIMULATED_REACH[channels[i]]);
      }
    });

    it('processes channels sequentially and returns broadcasts in order', async () => {
      const channels = ['TV_RADIO', 'SMS_BLAST'];
      const callOrder: string[] = [];

      for (const ch of channels) {
        const record = buildBroadcastRecord(ch, SIMULATED_REACH[ch]);
        (mockPrisma.warningBroadcast.create as jest.Mock).mockImplementationOnce(async () => {
          callOrder.push(`broadcast:${ch}`);
          return record;
        });
        (mockPrisma.notificationLog.create as jest.Mock).mockImplementationOnce(async () => {
          callOrder.push(`log:${ch}`);
          return {};
        });
      }

      const results = await simulateBroadcast(WARNING_ID, channels);

      // TV_RADIO processed before SMS_BLAST
      expect(callOrder).toEqual([
        'broadcast:TV_RADIO',
        'log:TV_RADIO',
        'broadcast:SMS_BLAST',
        'log:SMS_BLAST',
      ]);

      expect(results[0]).toMatchObject({ channel: 'TV_RADIO' });
      expect(results[1]).toMatchObject({ channel: 'SMS_BLAST' });
    });

    it('confirmedReach + failedCount equals estimatedReach for each channel', async () => {
      const channel = 'COASTAL_SIREN';
      const estimated = SIMULATED_REACH[channel]; // 500_000

      (mockPrisma.warningBroadcast.create as jest.Mock).mockResolvedValueOnce(
        buildBroadcastRecord(channel, estimated),
      );
      (mockPrisma.notificationLog.create as jest.Mock).mockResolvedValueOnce({});

      await simulateBroadcast(WARNING_ID, [channel]);

      const data = (mockPrisma.warningBroadcast.create as jest.Mock).mock.calls[0][0].data;
      expect(data.confirmedReach + data.failedCount).toBe(estimated);
    });

    it('returns an empty array when channels list is empty', async () => {
      const results = await simulateBroadcast(WARNING_ID, []);

      expect(results).toEqual([]);
      expect(mockPrisma.warningBroadcast.create).not.toHaveBeenCalled();
      expect(mockPrisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it('rejects when warningBroadcast.create fails', async () => {
      (mockPrisma.warningBroadcast.create as jest.Mock).mockRejectedValueOnce(
        new Error('DB write error'),
      );

      await expect(simulateBroadcast(WARNING_ID, ['SMS_BLAST'])).rejects.toThrow('DB write error');
    });
  });

  // ── calculateTotalReach ───────────────────────────────────────────────────────

  describe('calculateTotalReach()', () => {
    it('returns 0 for an empty channels array', () => {
      expect(calculateTotalReach([])).toBe(0);
    });

    it('returns the correct reach for a single known channel', () => {
      expect(calculateTotalReach(['SMS_BLAST'])).toBe(8200000);
      expect(calculateTotalReach(['PUSH_NOTIFICATION'])).toBe(1400000);
      expect(calculateTotalReach(['TV_RADIO'])).toBe(12000000);
      expect(calculateTotalReach(['COASTAL_SIREN'])).toBe(500000);
    });

    it('returns 0 for an unknown channel', () => {
      expect(calculateTotalReach(['UNKNOWN_CHANNEL'])).toBe(0);
      expect(calculateTotalReach(['PIGEON_POST'])).toBe(0);
    });

    it('sums reach correctly for multiple known channels', () => {
      const channels = ['SMS_BLAST', 'TV_RADIO'];
      // 8_200_000 + 12_000_000 = 20_200_000
      expect(calculateTotalReach(channels)).toBe(20200000);
    });

    it('sums all four known channels', () => {
      const channels = ['SMS_BLAST', 'PUSH_NOTIFICATION', 'TV_RADIO', 'COASTAL_SIREN'];
      const expected =
        SIMULATED_REACH.SMS_BLAST +
        SIMULATED_REACH.PUSH_NOTIFICATION +
        SIMULATED_REACH.TV_RADIO +
        SIMULATED_REACH.COASTAL_SIREN;
      expect(calculateTotalReach(channels)).toBe(expected);
    });

    it('ignores unknown channels and only sums known ones', () => {
      const channels = ['SMS_BLAST', 'UNKNOWN_CHANNEL', 'TV_RADIO'];
      // 8_200_000 + 0 + 12_000_000 = 20_200_000
      expect(calculateTotalReach(channels)).toBe(20200000);
    });

    it('returns 0 when all channels are unknown', () => {
      expect(calculateTotalReach(['FOO', 'BAR', 'BAZ'])).toBe(0);
    });

    it('handles duplicate channels by summing each occurrence', () => {
      // If the same channel appears twice, count it twice
      expect(calculateTotalReach(['SMS_BLAST', 'SMS_BLAST'])).toBe(16400000);
    });
  });
});
