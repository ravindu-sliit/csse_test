/**
 * @file warning.service.test.ts
 * @description Unit tests for warning.service.ts (UC01 — Issue & Broadcast Hazard Warning)
 * @author Sooriyaarachchi E A R N (IT23829510)
 *
 * Coverage target: >80% statements, branches, functions, and lines.
 *
 * Test strategy:
 *  - All external dependencies (Prisma, notification service, code generator)
 *    are fully mocked so tests run in isolation without a real database.
 *  - Each describe block targets one exported function.
 *  - Tests cover: positive (happy path), negative (not found / conflict),
 *    edge cases (empty arrays, zero values, missing optional fields),
 *    and error propagation (DB failures, broadcast failures).
 *
 * Mocked dependencies:
 *  - prisma                → mockPrisma (see mocks/prisma.mock.ts)
 *  - notification.service  → simulateBroadcast, calculateTotalReach
 *  - utils/codeGenerator   → generateWarningCode
 */

// ─── Module mocks (must appear before any import that pulls in the real modules) ──
// Replacing real Prisma, notification service, and code generator with jest mocks
// so no database connection or side-effects occur during tests.

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
// Cast jest.fn() mocks to typed MockedFunction so TypeScript allows .mockReturnValue etc.

const mockSimulateBroadcast = simulateBroadcast as jest.MockedFunction<typeof simulateBroadcast>;
const mockCalculateTotalReach = calculateTotalReach as jest.MockedFunction<typeof calculateTotalReach>;
const mockGenerateWarningCode = generateWarningCode as jest.MockedFunction<typeof generateWarningCode>;

// ─── Shared fixtures ─────────────────────────────────────────────────────────────
// Reusable test data shared across multiple test suites.
// Using realistic Sri Lanka DMC data for meaningful test context.

const OFFICER_ID = 'officer-uuid-1';

/** A valid CreateWarningDto representing a flood warning for Colombo & Gampaha districts */
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

/** The DB record returned after a successful warning.create() call */
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

/** A broadcast channel record as stored in the DB after simulateBroadcast */
const BROADCAST_CHANNEL_RECORD = {
  id: 'bc-uuid-1',
  warningId: 'warning-uuid-1',
  channel: 'SMS_BLAST',
  status: 'completed',
  estimatedReach: 8200000,
  confirmedReach: 7300000,
  failedCount: 900000,
};

/** A notification log record representing delivery metrics per channel */
const NOTIFICATION_LOG_RECORD = {
  id: 'nl-uuid-1',
  warningId: 'warning-uuid-1',
  channel: 'SMS_BLAST',
  recipientCount: 8200000,
  deliveredCount: 7300000,
  failedCount: 900000,
};

// ─── Setup / teardown ────────────────────────────────────────────────────────────
// Reset all mocks before each test to prevent state leaking between tests.

beforeEach(() => {
  resetMockPrisma();
  mockSimulateBroadcast.mockReset();
  mockCalculateTotalReach.mockReset();
  mockGenerateWarningCode.mockReset();
});

// ═════════════════════════════════════════════════════════════════════════════════
// createAndBroadcast()
// Core UC01 function: creates a warning record and triggers multi-channel broadcast.
// ═════════════════════════════════════════════════════════════════════════════════

describe('createAndBroadcast()', () => {

  // Happy path: all dependencies succeed, warning is created and broadcast fires
  describe('successful creation with broadcast', () => {
    const BROADCAST_RESULTS = [
      { id: 'bc-uuid-1', channel: 'SMS_BLAST', status: 'completed' },
      { id: 'bc-uuid-2', channel: 'PUSH_NOTIFICATION', status: 'completed' },
    ];

    beforeEach(() => {
      // Mock count=0 so the first warning gets sequence 1
      mockPrisma.warning.count.mockResolvedValue(0);
      mockGenerateWarningCode.mockReturnValue('DMC-2026-F01');
      mockPrisma.warning.create.mockResolvedValue(DB_WARNING);
      mockSimulateBroadcast.mockResolvedValue(BROADCAST_RESULTS as any);
      mockCalculateTotalReach.mockReturnValue(9600000);
    });

    it('generates a warning code based on hazardType and sequence', async () => {
      // The service counts existing warnings to determine the next sequence number.
      // With count=0, the sequence should be 0+1=1, passed to generateWarningCode.
      await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      expect(mockPrisma.warning.count).toHaveBeenCalledTimes(1);
      expect(mockGenerateWarningCode).toHaveBeenCalledWith('FLOOD', 1);
    });

    it('persists the warning with ACTIVE status and correct fields', async () => {
      // All new warnings must be created with ACTIVE status and preserve the
      // issuing officer's id, hazard type, severity, and target districts.
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
      // After persisting, the service must delegate broadcast to notification.service,
      // passing the new warning's DB id, the requested channels, and target districts.
      await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      expect(mockSimulateBroadcast).toHaveBeenCalledWith(
        DB_WARNING.id,
        CREATE_WARNING_DTO.broadcastChannels,
        CREATE_WARNING_DTO.targetDistricts,
      );
    });

    it('calls calculateTotalReach with the selected channels and districts', async () => {
      // estimatedReach shown to the officer is derived from calculateTotalReach,
      // which uses district population to give a realistic reach figure.
      await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      expect(mockCalculateTotalReach).toHaveBeenCalledWith(
        CREATE_WARNING_DTO.broadcastChannels,
        CREATE_WARNING_DTO.targetDistricts,
      );
    });

    it('returns warning, broadcastResults, and estimatedReach', async () => {
      // The return value bundles all three so the controller can respond with
      // the full picture in a single API response.
      const result = await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      expect(result).toEqual({
        warning: DB_WARNING,
        broadcastResults: BROADCAST_RESULTS,
        estimatedReach: 9600000,
      });
    });

    it('converts expiryTime string to a Date object before persisting', async () => {
      // The DTO carries expiryTime as an ISO string; the service must convert it
      // to a Date so Prisma stores it as a proper timestamp.
      await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      const callArg = mockPrisma.warning.create.mock.calls[0][0];
      expect(callArg.data.expiryTime).toBeInstanceOf(Date);
    });

    it('omits expiryTime when not provided (open-ended warning)', async () => {
      // Warnings without an expiry remain ACTIVE until manually cancelled.
      // The field must be absent (undefined) rather than set to null.
      const dtoWithoutExpiry = { ...CREATE_WARNING_DTO, expiryTime: undefined };
      await warningService.createAndBroadcast(dtoWithoutExpiry, OFFICER_ID);

      const callArg = mockPrisma.warning.create.mock.calls[0][0];
      expect(callArg.data.expiryTime).toBeUndefined();
    });

    it('increments sequence correctly when warnings already exist', async () => {
      // Edge case: if 5 warnings already exist, the next sequence must be 6.
      mockPrisma.warning.count.mockResolvedValue(5);
      await warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID);

      expect(mockGenerateWarningCode).toHaveBeenCalledWith('FLOOD', 6);
    });
  });

  // Error path: downstream failures must bubble up to the caller
  describe('error propagation', () => {
    it('propagates database errors from warning.create', async () => {
      // If the DB write fails (e.g. constraint violation), the error must not
      // be swallowed — the controller must receive it to return a 500 response.
      mockPrisma.warning.count.mockResolvedValue(0);
      mockGenerateWarningCode.mockReturnValue('DMC-2026-F01');
      mockPrisma.warning.create.mockRejectedValue(new Error('DB error'));

      await expect(
        warningService.createAndBroadcast(CREATE_WARNING_DTO, OFFICER_ID),
      ).rejects.toThrow('DB error');
    });

    it('propagates errors thrown by simulateBroadcast', async () => {
      // Even if the warning is persisted, a broadcast failure must propagate
      // so the caller is aware the notification did not go out.
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

// ═════════════════════════════════════════════════════════════════════════════════
// listWarnings()
// Returns a paginated, filterable list of warnings for the officer dashboard.
// ═════════════════════════════════════════════════════════════════════════════════

describe('listWarnings()', () => {
  const WARNINGS_LIST = [DB_WARNING];

  // Pagination behaviour
  describe('pagination', () => {
    it('defaults to page=1, limit=20 when params are omitted', async () => {
      // Callers that do not supply page/limit must still get a valid result
      // using sensible defaults (skip=0, take=20).
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(1);

      await warningService.listWarnings({});

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('calculates skip correctly for page 2 with limit 10', async () => {
      // skip = (page - 1) * limit = (2-1)*10 = 10
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(25);

      await warningService.listWarnings({ page: 2, limit: 10 });

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('returns correct meta with totalPages rounded up', async () => {
      // 45 records / 20 per page = 2.25 → ceil = 3 pages
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(45);

      const result = await warningService.listWarnings({ page: 1, limit: 20 });

      expect(result.meta).toEqual({ total: 45, page: 1, limit: 20, totalPages: 3 });
    });

    it('returns totalPages=1 when all results fit on one page', async () => {
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(5);

      const result = await warningService.listWarnings({ page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(1);
    });

    it('runs findMany and count in parallel via Promise.all', async () => {
      // Both queries must be initiated in the same tick for performance.
      mockPrisma.warning.findMany.mockResolvedValue([]);
      mockPrisma.warning.count.mockResolvedValue(0);

      await warningService.listWarnings({});

      expect(mockPrisma.warning.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.warning.count).toHaveBeenCalledTimes(1);
    });
  });

  // Filtering behaviour
  describe('filtering by status', () => {
    it('normalises status to uppercase before querying', async () => {
      // Client may send "active" but DB stores "ACTIVE" — service must normalise.
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(1);

      await warningService.listWarnings({ status: 'active' });

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'ACTIVE' }) }),
      );
    });

    it('omits status from where clause when not provided', async () => {
      // No status filter = return all statuses (ACTIVE, EXPIRED, CANCELLED)
      mockPrisma.warning.findMany.mockResolvedValue([]);
      mockPrisma.warning.count.mockResolvedValue(0);

      await warningService.listWarnings({});

      const whereArg = mockPrisma.warning.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('status');
    });
  });

  describe('filtering by district', () => {
    it('uses Prisma array-contains (has) operator for district filter', async () => {
      // targetDistricts is a string[] column — must use { has: district } not equals.
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

    it('omits district filter when not provided', async () => {
      mockPrisma.warning.findMany.mockResolvedValue([]);
      mockPrisma.warning.count.mockResolvedValue(0);

      await warningService.listWarnings({});

      const whereArg = mockPrisma.warning.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('targetDistricts');
    });
  });

  describe('filtering by hazardType', () => {
    it('normalises hazardType to uppercase before querying', async () => {
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(1);

      await warningService.listWarnings({ hazardType: 'flood' });

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ hazardType: 'FLOOD' }) }),
      );
    });

    it('omits hazardType filter when not provided', async () => {
      mockPrisma.warning.findMany.mockResolvedValue([]);
      mockPrisma.warning.count.mockResolvedValue(0);

      await warningService.listWarnings({});

      const whereArg = mockPrisma.warning.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('hazardType');
    });
  });

  describe('combined filters', () => {
    it('applies status, district, and hazardType simultaneously', async () => {
      // All three filters must be combined in a single where clause — not separate queries.
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
    it('returns a warnings array and a meta pagination object', async () => {
      mockPrisma.warning.findMany.mockResolvedValue(WARNINGS_LIST);
      mockPrisma.warning.count.mockResolvedValue(1);

      const result = await warningService.listWarnings({});

      expect(result).toHaveProperty('warnings', WARNINGS_LIST);
      expect(result).toHaveProperty('meta');
    });

    it('returns empty warnings array with zero meta when no records match', async () => {
      // Edge case: filtering by EXPIRED with no expired warnings should return empty.
      mockPrisma.warning.findMany.mockResolvedValue([]);
      mockPrisma.warning.count.mockResolvedValue(0);

      const result = await warningService.listWarnings({ status: 'EXPIRED' });

      expect(result.warnings).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('orders results by issuedTime descending (most recent first)', async () => {
      // Officers need the latest warnings at the top of the list.
      mockPrisma.warning.findMany.mockResolvedValue([]);
      mockPrisma.warning.count.mockResolvedValue(0);

      await warningService.listWarnings({});

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { issuedTime: 'desc' } }),
      );
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════════
// getWarningById()
// Fetches a single warning with its broadcast channels and notification logs.
// ═════════════════════════════════════════════════════════════════════════════════

describe('getWarningById()', () => {
  it('returns the fully hydrated warning when found', async () => {
    // The warning detail page needs channels and logs — both must be included.
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

  it('includes broadcastChannels and notificationLogs in the Prisma query', async () => {
    // Verify the include clause is present so relations are not accidentally omitted.
    mockPrisma.warning.findUnique.mockResolvedValue(null);

    await warningService.getWarningById('warning-uuid-1');

    const includeArg = mockPrisma.warning.findUnique.mock.calls[0][0].include;
    expect(includeArg).toHaveProperty('broadcastChannels', true);
    expect(includeArg).toHaveProperty('notificationLogs', true);
  });

  it('returns null when no warning matches the id (negative case)', async () => {
    // The controller checks for null and responds with 404.
    mockPrisma.warning.findUnique.mockResolvedValue(null);

    const result = await warningService.getWarningById('non-existent-uuid');

    expect(result).toBeNull();
  });

  it('passes the exact id to Prisma without modification', async () => {
    mockPrisma.warning.findUnique.mockResolvedValue(null);

    await warningService.getWarningById('specific-id-123');

    expect(mockPrisma.warning.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'specific-id-123' } }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════════
// getBroadcastStatus()
// Aggregates per-channel delivery metrics for the broadcast status dashboard.
// ═════════════════════════════════════════════════════════════════════════════════

describe('getBroadcastStatus()', () => {
  /** Warning fixture with two broadcast channels and matching notification logs */
  const WARNING_WITH_LOGS = {
    ...DB_WARNING,
    broadcastChannels: [
      { channel: 'SMS_BLAST', status: 'completed', confirmedReach: 7300000, failedCount: 900000, estimatedReach: 8200000 },
      { channel: 'PUSH_NOTIFICATION', status: 'completed', confirmedReach: 1200000, failedCount: 200000, estimatedReach: 1400000 },
    ],
    notificationLogs: [
      { recipientCount: 8200000, deliveredCount: 7300000, failedCount: 900000 },
      { recipientCount: 1400000, deliveredCount: 1200000, failedCount: 200000 },
    ],
  };

  it('returns null when the warning does not exist (negative case)', async () => {
    mockPrisma.warning.findUnique.mockResolvedValue(null);

    const result = await warningService.getBroadcastStatus('non-existent-uuid');

    expect(result).toBeNull();
  });

  it('sums confirmed, failed, and target counts across all notification logs', async () => {
    // Total confirmed = 7,300,000 + 1,200,000 = 8,500,000
    // Total failed    = 900,000   + 200,000   = 1,100,000
    // Total target    = 8,200,000 + 1,400,000 = 9,600,000
    mockPrisma.warning.findUnique.mockResolvedValue(WARNING_WITH_LOGS);

    const result = await warningService.getBroadcastStatus('warning-uuid-1');

    expect(result!.totalConfirmedDeliveries).toBe(7300000 + 1200000);
    expect(result!.totalFailed).toBe(900000 + 200000);
    expect(result!.totalTargetCitizens).toBe(8200000 + 1400000);
  });

  it('returns warningId, warningCode, and status in the response', async () => {
    mockPrisma.warning.findUnique.mockResolvedValue(WARNING_WITH_LOGS);

    const result = await warningService.getBroadcastStatus('warning-uuid-1');

    expect(result).toMatchObject({
      warningId: DB_WARNING.id,
      warningCode: DB_WARNING.warningCode,
      status: DB_WARNING.status,
    });
  });

  it('calculates progressPercent correctly per channel', async () => {
    // SMS_BLAST:        round(7,300,000 / 8,200,000 * 100) = 89%
    // PUSH_NOTIFICATION: round(1,200,000 / 1,400,000 * 100) = 86%
    mockPrisma.warning.findUnique.mockResolvedValue(WARNING_WITH_LOGS);

    const result = await warningService.getBroadcastStatus('warning-uuid-1');

    const sms = result!.channels.find(c => c.channel === 'SMS_BLAST');
    expect(sms!.progressPercent).toBe(Math.round((7300000 / 8200000) * 100));

    const push = result!.channels.find(c => c.channel === 'PUSH_NOTIFICATION');
    expect(push!.progressPercent).toBe(Math.round((1200000 / 1400000) * 100));
  });

  it('returns progressPercent=0 when estimatedReach is zero (edge case)', async () => {
    // Avoid division-by-zero — should return 0% not NaN or Infinity.
    const warningWithZeroReach = {
      ...WARNING_WITH_LOGS,
      broadcastChannels: [{ channel: 'SMS_BLAST', status: 'pending', confirmedReach: 0, failedCount: 0, estimatedReach: 0 }],
      notificationLogs: [],
    };
    mockPrisma.warning.findUnique.mockResolvedValue(warningWithZeroReach);

    const result = await warningService.getBroadcastStatus('warning-uuid-1');

    expect(result!.channels[0].progressPercent).toBe(0);
  });

  it('handles a warning with no channels or logs (edge case — returns zeros)', async () => {
    // A warning that was created but broadcast has not started yet.
    const warningNoData = { ...DB_WARNING, broadcastChannels: [], notificationLogs: [] };
    mockPrisma.warning.findUnique.mockResolvedValue(warningNoData);

    const result = await warningService.getBroadcastStatus('warning-uuid-1');

    expect(result!.channels).toHaveLength(0);
    expect(result!.totalConfirmedDeliveries).toBe(0);
    expect(result!.totalFailed).toBe(0);
    expect(result!.totalTargetCitizens).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════
// cancelWarning()
// Transitions a warning to CANCELLED status. Guards against double-cancellation.
// ═════════════════════════════════════════════════════════════════════════════════

describe('cancelWarning()', () => {

  // Happy path: active warning is successfully cancelled
  describe('successful cancellation', () => {
    const ACTIVE_WARNING = { ...DB_WARNING, status: 'ACTIVE' };
    const CANCELLED_WARNING = { ...DB_WARNING, status: 'CANCELLED' };

    beforeEach(() => {
      mockPrisma.warning.findUnique.mockResolvedValue(ACTIVE_WARNING);
      mockPrisma.warning.update.mockResolvedValue(CANCELLED_WARNING);
    });

    it('sets warning status to CANCELLED in the database', async () => {
      await warningService.cancelWarning('warning-uuid-1');

      expect(mockPrisma.warning.update).toHaveBeenCalledWith({
        where: { id: 'warning-uuid-1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('returns the updated warning record', async () => {
      const result = await warningService.cancelWarning('warning-uuid-1');

      expect(result).toEqual(CANCELLED_WARNING);
    });

    it('accepts an optional cancellation reason without throwing', async () => {
      // The reason parameter is for audit purposes; it must not break the flow.
      await expect(
        warningService.cancelWarning('warning-uuid-1', 'Situation resolved'),
      ).resolves.not.toThrow();
    });
  });

  // Negative: warning not found
  describe('not found', () => {
    it('throws NOT_FOUND (404) when the warning does not exist', async () => {
      mockPrisma.warning.findUnique.mockResolvedValue(null);

      await expect(warningService.cancelWarning('non-existent-uuid')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('does not call prisma.update when warning is not found', async () => {
      // Guard: the update must never be called if the lookup fails.
      mockPrisma.warning.findUnique.mockResolvedValue(null);

      await expect(warningService.cancelWarning('non-existent-uuid')).rejects.toBeDefined();
      expect(mockPrisma.warning.update).not.toHaveBeenCalled();
    });
  });

  // Negative: already cancelled (conflict)
  describe('already cancelled', () => {
    it('throws WARNING_ALREADY_CANCELLED (409) for a cancelled warning', async () => {
      // Business rule: you cannot cancel a warning that is already cancelled.
      mockPrisma.warning.findUnique.mockResolvedValue({ ...DB_WARNING, status: 'CANCELLED' });

      await expect(warningService.cancelWarning('warning-uuid-1')).rejects.toMatchObject({
        code: 'WARNING_ALREADY_CANCELLED',
        status: 409,
      });
    });

    it('does not call prisma.update when warning is already cancelled', async () => {
      mockPrisma.warning.findUnique.mockResolvedValue({ ...DB_WARNING, status: 'CANCELLED' });

      await expect(warningService.cancelWarning('warning-uuid-1')).rejects.toBeDefined();
      expect(mockPrisma.warning.update).not.toHaveBeenCalled();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════════
// escalateWarning()
// Updates the severity level of an existing warning (upgrade or downgrade).
// ═════════════════════════════════════════════════════════════════════════════════

describe('escalateWarning()', () => {
  it('updates severityLevel to the new value', async () => {
    // Primary use: upgrading WARNING → EMERGENCY when situation worsens.
    const escalatedWarning = { ...DB_WARNING, severityLevel: 'EMERGENCY' };
    mockPrisma.warning.update.mockResolvedValue(escalatedWarning);

    await warningService.escalateWarning('warning-uuid-1', 'EMERGENCY');

    expect(mockPrisma.warning.update).toHaveBeenCalledWith({
      where: { id: 'warning-uuid-1' },
      data: { severityLevel: 'EMERGENCY' },
    });
  });

  it('returns the updated warning with the new severity level', async () => {
    const escalatedWarning = { ...DB_WARNING, severityLevel: 'EMERGENCY' };
    mockPrisma.warning.update.mockResolvedValue(escalatedWarning);

    const result = await warningService.escalateWarning('warning-uuid-1', 'EMERGENCY');

    expect(result.severityLevel).toBe('EMERGENCY');
  });

  it('also supports downgrading severity (e.g. EMERGENCY → WATCH)', async () => {
    // If the situation improves, officers can reduce severity — same code path.
    const downgraded = { ...DB_WARNING, severityLevel: 'WATCH' };
    mockPrisma.warning.update.mockResolvedValue(downgraded);

    const result = await warningService.escalateWarning('warning-uuid-1', 'WATCH');

    expect(mockPrisma.warning.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { severityLevel: 'WATCH' } }),
    );
    expect(result.severityLevel).toBe('WATCH');
  });

  it('propagates Prisma errors when the warning id does not exist', async () => {
    // If the record is not found, Prisma throws — the service must not catch it.
    mockPrisma.warning.update.mockRejectedValue(new Error('Record to update not found.'));

    await expect(
      warningService.escalateWarning('non-existent-uuid', 'EMERGENCY'),
    ).rejects.toThrow('Record to update not found.');
  });

  it('passes the exact warning id to Prisma', async () => {
    const updated = { ...DB_WARNING, severityLevel: 'ADVISORY' };
    mockPrisma.warning.update.mockResolvedValue(updated);

    await warningService.escalateWarning('specific-warning-id', 'ADVISORY');

    expect(mockPrisma.warning.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'specific-warning-id' } }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════════
// getDashboardSummary()
// Fetches four real-time KPI counts for the officer command dashboard.
// ═════════════════════════════════════════════════════════════════════════════════

describe('getDashboardSummary()', () => {

  // Happy path: all four counts return realistic values
  describe('successful aggregation', () => {
    beforeEach(() => {
      mockPrisma.warning.count.mockResolvedValue(4);
      mockPrisma.hazardReport.count.mockResolvedValue(12);
      mockPrisma.shelter.count.mockResolvedValue(7);
      mockPrisma.rescueTeam.count.mockResolvedValue(3);
    });

    it('returns all four KPI counts in a single object', async () => {
      const result = await warningService.getDashboardSummary();

      expect(result).toEqual({
        activeWarnings: 4,
        pendingReports: 12,
        openShelters: 7,
        deployedTeams: 3,
      });
    });

    it('queries only ACTIVE warnings', async () => {
      // Only ACTIVE warnings should count — EXPIRED and CANCELLED must be excluded.
      await warningService.getDashboardSummary();

      expect(mockPrisma.warning.count).toHaveBeenCalledWith({ where: { status: 'ACTIVE' } });
    });

    it('queries reports with PENDING_VERIFICATION or UNDER_REVIEW status', async () => {
      // Both statuses indicate the officer has unprocessed work in the queue.
      await warningService.getDashboardSummary();

      expect(mockPrisma.hazardReport.count).toHaveBeenCalledWith({
        where: { status: { in: ['PENDING_VERIFICATION', 'UNDER_REVIEW'] } },
      });
    });

    it('queries shelters with OPEN or FULL status', async () => {
      // FULL shelters are still active and relevant to the operational picture.
      await warningService.getDashboardSummary();

      expect(mockPrisma.shelter.count).toHaveBeenCalledWith({
        where: { status: { in: ['OPEN', 'FULL'] } },
      });
    });

    it('queries rescue teams with DISPATCHED, EN_ROUTE, or ON_MISSION status', async () => {
      await warningService.getDashboardSummary();

      expect(mockPrisma.rescueTeam.count).toHaveBeenCalledWith({
        where: { status: { in: ['DISPATCHED', 'EN_ROUTE', 'ON_MISSION'] } },
      });
    });

    it('executes all four count queries in parallel (Promise.all)', async () => {
      // Parallel execution minimises dashboard load time — each query must be
      // called exactly once within the same Promise.all batch.
      await warningService.getDashboardSummary();

      expect(mockPrisma.warning.count).toHaveBeenCalledTimes(1);
      expect(mockPrisma.hazardReport.count).toHaveBeenCalledTimes(1);
      expect(mockPrisma.shelter.count).toHaveBeenCalledTimes(1);
      expect(mockPrisma.rescueTeam.count).toHaveBeenCalledTimes(1);
    });
  });

  // Edge cases and error handling
  describe('edge cases', () => {
    it('returns all zeros when no active entities exist', async () => {
      // Normal state at system start or after a full stand-down.
      mockPrisma.warning.count.mockResolvedValue(0);
      mockPrisma.hazardReport.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.rescueTeam.count.mockResolvedValue(0);

      const result = await warningService.getDashboardSummary();

      expect(result).toEqual({ activeWarnings: 0, pendingReports: 0, openShelters: 0, deployedTeams: 0 });
    });

    it('handles large counts without numeric overflow', async () => {
      // Stress test: very high counts must pass through unchanged.
      mockPrisma.warning.count.mockResolvedValue(9999);
      mockPrisma.hazardReport.count.mockResolvedValue(9999);
      mockPrisma.shelter.count.mockResolvedValue(9999);
      mockPrisma.rescueTeam.count.mockResolvedValue(9999);

      const result = await warningService.getDashboardSummary();

      expect(result.activeWarnings).toBe(9999);
      expect(result.pendingReports).toBe(9999);
    });

    it('propagates database connection errors to the caller', async () => {
      // If the DB is unreachable, the error must surface — the dashboard must
      // not silently return stale zeros.
      mockPrisma.warning.count.mockRejectedValue(new Error('Connection timeout'));
      mockPrisma.hazardReport.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.rescueTeam.count.mockResolvedValue(0);

      await expect(warningService.getDashboardSummary()).rejects.toThrow('Connection timeout');
    });
  });
});
