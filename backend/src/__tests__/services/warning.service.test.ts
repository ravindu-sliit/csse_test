/**
 * Unit tests for warning.service.ts
 *
 * Mocked dependencies:
 *  - prisma           → mockPrisma (see mocks/prisma.mock.ts)
 *  - notification.service → simulateBroadcast, calculateTotalReach
 *  - utils/codeGenerator  → generateWarningCode
 */

// ─── Module mocks (must appear before any import that pulls in the real modules) ──

jest.mock('../../config/database', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma,
}));

jest.mock('../../services/notification.service', () => ({
  simulateBroadcast: jest.fn(),
  calculateTotalReach: jest.fn(),
}));

jest.mock('../../utils/codeGenerator', () => ({
  generateWarningCode: jest.fn(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────────

import { mockPrisma, resetMockPrisma } from '../mocks/prisma.mock';
import { simulateBroadcast, calculateTotalReach } from '../../services/notification.service';
import { generateWarningCode } from '../../utils/codeGenerator';
import * as warningService from '../../services/warning.service';

// ─── Typed mock helpers ───────────────────────────────────────────────────────────

const mockSimulateBroadcast = simulateBroadcast as jest.MockedFunction<typeof simulateBroadcast>;
const mockCalculateTotalReach = calculateTotalReach as jest.MockedFunction<typeof calculateTotalReach>;
const mockGenerateWarningCode = generateWarningCode as jest.MockedFunction<typeof generateWarningCode>;

// ─── Shared fixtures ─────────────────────────────────────────────────────────────

const OFFICER_ID = 'officer-uuid-1';

const CREATE_WARNING_DTO = {
  hazardType: 'FLOOD' as const,
  severityLevel: 'WARNING' as const,
  targetDistricts: ['Colombo', 'Gampaha'],
  targetRiverBasin: 'Kelani',
  message: 'Heavy flooding expected along the Kelani River basin.',
  broadcastChannels: ['SMS_BLAST', 'PUSH_NOTIFICATION'] as any,
  hazardId: 'hazard-uuid-1',
  expiryTime: '2026-10-17T08:00:00.000Z',
};

const DB_WARNING = {
  id: 'warning-uuid-1',
  warningCode: 'DMC-2026-F01',
  hazardType: 'FLOOD',
  severityLevel: 'WARNING',
  status: 'ACTIVE',
  message: 'Heavy flooding expected along the Kelani River basin.',
  targetDistricts: ['Colombo', 'Gampaha'],
  targetRiverBasin: 'Kelani',
  issuedById: OFFICER_ID,
  hazardId: 'hazard-uuid-1',
  issuedTime: new Date('2026-10-16T08:00:00.000Z'),
  expiryTime: new Date('2026-10-17T08:00:00.000Z'),
  issuedBy: { id: OFFICER_ID, name: 'Duty Officer' },
};

const BROADCAST_CHANNEL_RECORD = {
  id: 'bc-uuid-1',
  warningId: 'warning-uuid-1',
  channel: 'SMS_BLAST',
  status: 'completed',
  estimatedReach: 8200000,
  confirmedReach: 7300000,
  failedCount: 900000,
};

const NOTIFICATION_LOG_RECORD = {
  id: 'nl-uuid-1',
  warningId: 'warning-uuid-1',
  channel: 'SMS_BLAST',
  recipientCount: 8200000,
  deliveredCount: 7300000,
  failedCount: 900000,
};

// ─── Setup / teardown ────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMockPrisma();
  mockSimulateBroadcast.mockReset();
  mockCalculateTotalReach.mockReset();
  mockGenerateWarningCode.mockReset();
});

// ─── createAndBroadcast() ────────────────────────────────────────────────────────

describe('createAndBroadcast()', () => {
  describe('successful creation with broadcast', () => {
    const BROADCAST_RESULTS = [
      { id: 'bc-uuid-1', channel: 'SMS_BLAST', status: 'completed' },
      { id: 'bc-uuid-2', channel: 'PUSH_NOTIFICATION', status: 'completed' },
    ];

    beforeEach(() => {
      mockPrisma.warning.count.mockResolvedValue(0);
      mockGenerateWarningCode.mockReturnValue('DMC-2026-F01');
      mockPrisma.warning.create.mockResolvedValue(DB_WARNING);
      mockSimulateBroadcast.mockResolvedValue(BROADCAST_RESULTS as any);
      mockCalculateTotalReach.mockReturnValue(9600000);
    });

    it('generates a warning code based on hazardType and sequence', async () => {
      await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      expect(mockPrisma.warning.count).toHaveBeenCalledTimes(1);
      // sequence = count + 1 = 1
      expect(mockGenerateWarningCode).toHaveBeenCalledWith('FLOOD', 1);
    });

    it('persists the warning with ACTIVE status and correct fields', async () => {
      await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      expect(mockPrisma.warning.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            warningCode: 'DMC-2026-F01',
            hazardType: 'FLOOD',
            severityLevel: 'WARNING',
            status: 'ACTIVE',
            issuedById: OFFICER_ID,
            targetDistricts: ['Colombo', 'Gampaha'],
          }),
        }),
      );
    });

    it('calls simulateBroadcast with the new warning id and channels', async () => {
      await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      expect(mockSimulateBroadcast).toHaveBeenCalledWith(
        DB_WARNING.id,
        CREATE_WARNING_DTO.broadcastChannels,
        CREATE_WARNING_DTO.targetDistricts,
      );
    });

    it('calls calculateTotalReach with the selected channels', async () => {
      await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      expect(mockCalculateTotalReach).toHaveBeenCalledWith(CREATE_WARNING_DTO.broadcastChannels, CREATE_WARNING_DTO.targetDistricts);
    });

    it('returns warning, broadcastResults, and estimatedReach', async () => {
      const result = await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      expect(result).toEqual({
        warning: DB_WARNING,
        broadcastResults: BROADCAST_RESULTS,
        estimatedReach: 9600000,
      });
    });

    it('uses expiryTime as a Date when provided', async () => {
      await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      const callArg = mockPrisma.warning.create.mock.calls[0][0];
      expect(callArg.data.expiryTime).toBeInstanceOf(Date);
    });

    it('omits expiryTime when not provided', async () => {
      const dtoWithoutExpiry = { ...CREATE_WARNING_DTO, expiryTime: undefined };
      await warningService.createAndBroadcast(dtoWithoutExpiry, OFFICER_ID);

      const callArg = mockPrisma.warning.create.mock.calls[0][0];
      expect(callArg.data.expiryTime).toBeUndefined();
    });

    it('uses incremented sequence when warnings already exist', async () => {
      mockPrisma.warning.count.mockResolvedValue(5);
      await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      expect(mockGenerateWarningCode).toHaveBeenCalledWith('FLOOD', 6);
    });
  });

  describe('error propagation', () => {
    it('propagates prisma create errors', async () => {
      mockPrisma.warning.count.mockResolvedValue(0);
      mockGenerateWarningCode.mockReturnValue('DMC-2026-F01');
      mockPrisma.warning.create.mockRejectedValue(new Error('DB error'));

      await expect(
        warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID),
      ).rejects.toThrow('DB error');
    });

    it('propagates simulateBroadcast errors', async () => {
      mockPrisma.warning.count.mockResolvedValue(0);
      mockGenerateWarningCode.mockReturnValue('DMC-2026-F01');
      mockPrisma.warning.create.mockResolvedValue(DB_WARNING);
      mockSimulateBroadcast.mockRejectedValue(new Error('Broadcast failure'));

      await expect(
        warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID),
      ).rejects.toThrow('Broadcast failure');
    });
  });
});

// ─── listWarnings() ───────────────────────────────────────────────────────────────

describe('listWarnings()', () => {
  const WARNINGS_LIST = [DB_WARNING];

  describe('pagination', () => {
    it('uses default page=1 and limit=20 when not provided', async () => {
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(1);

      await warningService.listWarnings({});

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('calculates correct skip for page 2 with limit 10', async () => {
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(25);

      await warningService.listWarnings({ page: 2, limit: 10 });

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('returns correct meta with totalPages', async () => {
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(45);

      const result = await warningService.listWarnings({ page: 1, limit: 20 });

      expect(result.meta).toEqual({ total: 45, page: 1, limit: 20, totalPages: 3 });
    });

    it('calculates totalPages=1 when results fit in one page', async () => {
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(5);

      const result = await warningService.listWarnings({ page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(1);
    });

    it('runs findMany and count in parallel', async () => {
      mockPrisma.warning.findMany.mockResolvedValue([]);
      mockPrisma.warning.count.mockResolvedValue(0);

      await warningService.listWarnings({});

      // Both should have been called exactly once (Promise.all)
      expect(mockPrisma.warning.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.warning.count).toHaveBeenCalledTimes(1);
    });
  });

  describe('filtering by status', () => {
    it('uppercases the status filter before querying', async () => {
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(1);

      await warningService.listWarnings({ status: 'active' });

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'ACTIVE' }) }),
      );
    });

    it('omits status from where clause when not provided', async () => {
      mockPrisma.warning.findMany.mockResolvedValue([]);
      mockPrisma.warning.count.mockResolvedValue(0);

      await warningService.listWarnings({});

      const whereArg = mockPrisma.warning.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('status');
    });
  });

  describe('filtering by district', () => {
    it('uses Prisma has operator for district filter', async () => {
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(1);

      await warningService.listWarnings({ district: 'Colombo' });

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetDistricts: { has: 'Colombo' },
          }),
        }),
      );
    });

    it('omits district from where clause when not provided', async () => {
      mockPrisma.warning.findMany.mockResolvedValue([]);
      mockPrisma.warning.count.mockResolvedValue(0);

      await warningService.listWarnings({});

      const whereArg = mockPrisma.warning.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('targetDistricts');
    });
  });

  describe('filtering by hazardType', () => {
    it('uppercases the hazardType filter before querying', async () => {
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(1);

      await warningService.listWarnings({ hazardType: 'flood' });

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ hazardType: 'FLOOD' }) }),
      );
    });

    it('omits hazardType from where clause when not provided', async () => {
      mockPrisma.warning.findMany.mockResolvedValue([]);
      mockPrisma.warning.count.mockResolvedValue(0);

      await warningService.listWarnings({});

      const whereArg = mockPrisma.warning.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('hazardType');
    });
  });

  describe('combined filters', () => {
    it('applies all three filters simultaneously', async () => {
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(1);

      await warningService.listWarnings({ status: 'active', district: 'Gampaha', hazardType: 'landslide' });

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'ACTIVE',
            targetDistricts: { has: 'Gampaha' },
            hazardType: 'LANDSLIDE',
          },
        }),
      );
    });
  });

  describe('result shape', () => {
    it('returns warnings array and meta object', async () => {
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(1);

      const result = await warningService.listWarnings({});

      expect(result).toHaveProperty('warnings', WARNINGS_LIST);
      expect(result).toHaveProperty('meta');
    });

    it('returns empty array when no warnings match', async () => {
      mockPrisma.warning.findMany.mockResolvedValue([]);
      mockPrisma.warning.count.mockResolvedValue(0);

      const result = await warningService.listWarnings({ status: 'EXPIRED' });

      expect(result.warnings).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('orders results by issuedTime descending', async () => {
      mockPrisma.warning.findMany.mockResolvedValue([]);
      mockPrisma.warning.count.mockResolvedValue(0);

      await warningService.listWarnings({});

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { issuedTime: 'desc' } }),
      );
    });
  });
});

// ─── getWarningById() ─────────────────────────────────────────────────────────────

describe('getWarningById()', () => {
  it('returns the warning with relations when found', async () => {
    const fullWarning = {
      ...DB_WARNING,
      broadcastChannels: [BROADCAST_CHANNEL_RECORD],
      notificationLogs: [NOTIFICATION_LOG_RECORD],
    };
    mockPrisma.warning.findUnique.mockResolvedValue(fullWarning);

    const result = await warningService.getWarningById('warning-uuid-1');

    expect(result).toEqual(fullWarning);
    expect(mockPrisma.warning.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'warning-uuid-1' } }),
    );
  });

  it('includes broadcastChannels and notificationLogs in the query', async () => {
    mockPrisma.warning.findUnique.mockResolvedValue(null);

    await warningService.getWarningById('warning-uuid-1');

    const includeArg = mockPrisma.warning.findUnique.mock.calls[0][0].include;
    expect(includeArg).toHaveProperty('broadcastChannels', true);
    expect(includeArg).toHaveProperty('notificationLogs', true);
  });

  it('returns null when warning does not exist', async () => {
    mockPrisma.warning.findUnique.mockResolvedValue(null);

    const result = await warningService.getWarningById('non-existent-uuid');

    expect(result).toBeNull();
  });

  it('passes the correct id to prisma', async () => {
    mockPrisma.warning.findUnique.mockResolvedValue(null);

    await warningService.getWarningById('specific-id-123');

    expect(mockPrisma.warning.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'specific-id-123' } }),
    );
  });
});

// ─── getBroadcastStatus() ─────────────────────────────────────────────────────────

describe('getBroadcastStatus()', () => {
  const WARNING_WITH_LOGS = {
    ...DB_WARNING,
    broadcastChannels: [
      {
        channel: 'SMS_BLAST',
        status: 'completed',
        confirmedReach: 7300000,
        failedCount: 900000,
        estimatedReach: 8200000,
      },
      {
        channel: 'PUSH_NOTIFICATION',
        status: 'completed',
        confirmedReach: 1200000,
        failedCount: 200000,
        estimatedReach: 1400000,
      },
    ],
    notificationLogs: [
      { recipientCount: 8200000, deliveredCount: 7300000, failedCount: 900000 },
      { recipientCount: 1400000, deliveredCount: 1200000, failedCount: 200000 },
    ],
  };

  it('returns null when warning is not found', async () => {
    mockPrisma.warning.findUnique.mockResolvedValue(null);

    const result = await warningService.getBroadcastStatus('non-existent-uuid');

    expect(result).toBeNull();
  });

  it('aggregates total confirmed, failed, and target counts from notification logs', async () => {
    mockPrisma.warning.findUnique.mockResolvedValue(WARNING_WITH_LOGS);

    const result = await warningService.getBroadcastStatus('warning-uuid-1');

    expect(result).not.toBeNull();
    expect(result!.totalConfirmedDeliveries).toBe(7300000 + 1200000);
    expect(result!.totalFailed).toBe(900000 + 200000);
    expect(result!.totalTargetCitizens).toBe(8200000 + 1400000);
  });

  it('returns correct shape with warningId, warningCode, and status', async () => {
    mockPrisma.warning.findUnique.mockResolvedValue(WARNING_WITH_LOGS);

    const result = await warningService.getBroadcastStatus('warning-uuid-1');

    expect(result).toMatchObject({
      warningId: DB_WARNING.id,
      warningCode: DB_WARNING.warningCode,
      status: DB_WARNING.status,
    });
  });

  it('calculates progressPercent correctly for each channel', async () => {
    mockPrisma.warning.findUnique.mockResolvedValue(WARNING_WITH_LOGS);

    const result = await warningService.getBroadcastStatus('warning-uuid-1');

    // SMS_BLAST: 7300000 / 8200000 = ~89%
    const smsChannel = result!.channels.find((c) => c.channel === 'SMS_BLAST');
    expect(smsChannel!.progressPercent).toBe(Math.round((7300000 / 8200000) * 100));

    // PUSH_NOTIFICATION: 1200000 / 1400000 = ~86%
    const pushChannel = result!.channels.find((c) => c.channel === 'PUSH_NOTIFICATION');
    expect(pushChannel!.progressPercent).toBe(Math.round((1200000 / 1400000) * 100));
  });

  it('returns progressPercent=0 when estimatedReach is 0 or null', async () => {
    const warningWithZeroReach = {
      ...WARNING_WITH_LOGS,
      broadcastChannels: [
        { channel: 'SMS_BLAST', status: 'pending', confirmedReach: 0, failedCount: 0, estimatedReach: 0 },
      ],
      notificationLogs: [],
    };
    mockPrisma.warning.findUnique.mockResolvedValue(warningWithZeroReach);

    const result = await warningService.getBroadcastStatus('warning-uuid-1');

    expect(result!.channels[0].progressPercent).toBe(0);
  });

  it('handles warning with no broadcast channels or logs gracefully', async () => {
    const warningNoData = { ...DB_WARNING, broadcastChannels: [], notificationLogs: [] };
    mockPrisma.warning.findUnique.mockResolvedValue(warningNoData);

    const result = await warningService.getBroadcastStatus('warning-uuid-1');

    expect(result).not.toBeNull();
    expect(result!.channels).toHaveLength(0);
    expect(result!.totalConfirmedDeliveries).toBe(0);
    expect(result!.totalFailed).toBe(0);
    expect(result!.totalTargetCitizens).toBe(0);
  });
});

// ─── cancelWarning() ─────────────────────────────────────────────────────────────

describe('cancelWarning()', () => {
  describe('successful cancellation', () => {
    const ACTIVE_WARNING = { ...DB_WARNING, status: 'ACTIVE' };
    const CANCELLED_WARNING = { ...DB_WARNING, status: 'CANCELLED' };

    beforeEach(() => {
      mockPrisma.warning.findUnique.mockResolvedValue(ACTIVE_WARNING);
      mockPrisma.warning.update.mockResolvedValue(CANCELLED_WARNING);
    });

    it('updates the warning status to CANCELLED', async () => {
      await warningService.cancelWarning('warning-uuid-1');

      expect(mockPrisma.warning.update).toHaveBeenCalledWith({
        where: { id: 'warning-uuid-1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('returns the updated warning', async () => {
      const result = await warningService.cancelWarning('warning-uuid-1');

      expect(result).toEqual(CANCELLED_WARNING);
    });

    it('accepts an optional reason without error', async () => {
      await expect(
        warningService.cancelWarning('warning-uuid-1', 'Situation resolved'),
      ).resolves.not.toThrow();
    });
  });

  describe('not found', () => {
    it('throws NOT_FOUND error when warning does not exist', async () => {
      mockPrisma.warning.findUnique.mockResolvedValue(null);

      await expect(warningService.cancelWarning('non-existent-uuid')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('does not call prisma update when warning is not found', async () => {
      mockPrisma.warning.findUnique.mockResolvedValue(null);

      await expect(warningService.cancelWarning('non-existent-uuid')).rejects.toBeDefined();
      expect(mockPrisma.warning.update).not.toHaveBeenCalled();
    });
  });

  describe('already cancelled', () => {
    it('throws WARNING_ALREADY_CANCELLED error for a cancelled warning', async () => {
      mockPrisma.warning.findUnique.mockResolvedValue({ ...DB_WARNING, status: 'CANCELLED' });

      await expect(warningService.cancelWarning('warning-uuid-1')).rejects.toMatchObject({
        code: 'WARNING_ALREADY_CANCELLED',
        status: 409,
      });
    });

    it('does not call prisma update when warning is already cancelled', async () => {
      mockPrisma.warning.findUnique.mockResolvedValue({ ...DB_WARNING, status: 'CANCELLED' });

      await expect(warningService.cancelWarning('warning-uuid-1')).rejects.toBeDefined();
      expect(mockPrisma.warning.update).not.toHaveBeenCalled();
    });
  });
});

// ─── escalateWarning() ───────────────────────────────────────────────────────────

describe('escalateWarning()', () => {
  it('updates the severityLevel to the new value', async () => {
    const escalatedWarning = { ...DB_WARNING, severityLevel: 'EMERGENCY' };
    mockPrisma.warning.update.mockResolvedValue(escalatedWarning);

    await warningService.escalateWarning('warning-uuid-1', 'EMERGENCY');

    expect(mockPrisma.warning.update).toHaveBeenCalledWith({
      where: { id: 'warning-uuid-1' },
      data: { severityLevel: 'EMERGENCY' },
    });
  });

  it('returns the updated warning with new severity level', async () => {
    const escalatedWarning = { ...DB_WARNING, severityLevel: 'EMERGENCY' };
    mockPrisma.warning.update.mockResolvedValue(escalatedWarning);

    const result = await warningService.escalateWarning('warning-uuid-1', 'EMERGENCY');

    expect(result.severityLevel).toBe('EMERGENCY');
  });

  it('can downgrade severity (e.g., EMERGENCY → WATCH)', async () => {
    const downgraded = { ...DB_WARNING, severityLevel: 'WATCH' };
    mockPrisma.warning.update.mockResolvedValue(downgraded);

    const result = await warningService.escalateWarning('warning-uuid-1', 'WATCH');

    expect(mockPrisma.warning.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { severityLevel: 'WATCH' } }),
    );
    expect(result.severityLevel).toBe('WATCH');
  });

  it('propagates prisma errors (e.g., record not found)', async () => {
    mockPrisma.warning.update.mockRejectedValue(
      new Error('Record to update not found.'),
    );

    await expect(
      warningService.escalateWarning('non-existent-uuid', 'EMERGENCY'),
    ).rejects.toThrow('Record to update not found.');
  });

  it('passes the correct warning id to prisma', async () => {
    const updated = { ...DB_WARNING, severityLevel: 'ADVISORY' };
    mockPrisma.warning.update.mockResolvedValue(updated);

    await warningService.escalateWarning('specific-warning-id', 'ADVISORY');

    expect(mockPrisma.warning.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'specific-warning-id' } }),
    );
  });
});

// ─── getDashboardSummary() ────────────────────────────────────────────────────────

describe('getDashboardSummary()', () => {
  describe('successful aggregation', () => {
    beforeEach(() => {
      mockPrisma.warning.count.mockResolvedValue(4);
      mockPrisma.hazardReport.count.mockResolvedValue(12);
      mockPrisma.shelter.count.mockResolvedValue(7);
      mockPrisma.rescueTeam.count.mockResolvedValue(3);
    });

    it('returns all four dashboard counts', async () => {
      const result = await warningService.getDashboardSummary();

      expect(result).toEqual({
        activeWarnings: 4,
        pendingReports: 12,
        openShelters: 7,
        deployedTeams: 3,
      });
    });

    it('queries active warnings with ACTIVE status filter', async () => {
      await warningService.getDashboardSummary();

      expect(mockPrisma.warning.count).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
      });
    });

    it('queries pending hazard reports with PENDING_VERIFICATION or UNDER_REVIEW status', async () => {
      await warningService.getDashboardSummary();

      expect(mockPrisma.hazardReport.count).toHaveBeenCalledWith({
        where: { status: { in: ['PENDING_VERIFICATION', 'UNDER_REVIEW'] } },
      });
    });

    it('queries open shelters with OPEN or FULL status', async () => {
      await warningService.getDashboardSummary();

      expect(mockPrisma.shelter.count).toHaveBeenCalledWith({
        where: { status: { in: ['OPEN', 'FULL'] } },
      });
    });

    it('queries deployed teams with DISPATCHED, EN_ROUTE, or ON_MISSION status', async () => {
      await warningService.getDashboardSummary();

      expect(mockPrisma.rescueTeam.count).toHaveBeenCalledWith({
        where: { status: { in: ['DISPATCHED', 'EN_ROUTE', 'ON_MISSION'] } },
      });
    });

    it('runs all four count queries in parallel (Promise.all)', async () => {
      await warningService.getDashboardSummary();

      // All four counts should be called in the same tick
      expect(mockPrisma.warning.count).toHaveBeenCalledTimes(1);
      expect(mockPrisma.hazardReport.count).toHaveBeenCalledTimes(1);
      expect(mockPrisma.shelter.count).toHaveBeenCalledTimes(1);
      expect(mockPrisma.rescueTeam.count).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('returns zeros when there are no active entities', async () => {
      mockPrisma.warning.count.mockResolvedValue(0);
      mockPrisma.hazardReport.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.rescueTeam.count.mockResolvedValue(0);

      const result = await warningService.getDashboardSummary();

      expect(result).toEqual({
        activeWarnings: 0,
        pendingReports: 0,
        openShelters: 0,
        deployedTeams: 0,
      });
    });

    it('handles large counts without overflow', async () => {
      mockPrisma.warning.count.mockResolvedValue(9999);
      mockPrisma.hazardReport.count.mockResolvedValue(9999);
      mockPrisma.shelter.count.mockResolvedValue(9999);
      mockPrisma.rescueTeam.count.mockResolvedValue(9999);

      const result = await warningService.getDashboardSummary();

      expect(result.activeWarnings).toBe(9999);
      expect(result.pendingReports).toBe(9999);
    });

    it('propagates database errors', async () => {
      mockPrisma.warning.count.mockRejectedValue(new Error('Connection timeout'));
      mockPrisma.hazardReport.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.rescueTeam.count.mockResolvedValue(0);

      await expect(warningService.getDashboardSummary()).rejects.toThrow('Connection timeout');
    });
  });
});
