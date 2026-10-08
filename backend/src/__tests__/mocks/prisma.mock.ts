/**
 * Mock Prisma Client for unit testing.
 *
 * Usage in a test file:
 *
 *   jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
 *   import { mockPrisma, resetMockPrisma } from '../mocks/prisma.mock';
 *
 *   beforeEach(() => resetMockPrisma());
 */

// Helper to build a fully-typed mock for a single Prisma model delegate.
const buildModelMock = () => ({
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  upsert: jest.fn(),
  groupBy: jest.fn(),
  aggregate: jest.fn(),
});

// One mock instance per Prisma model referenced in the services.
const user = buildModelMock();
const citizen = buildModelMock();
const refreshToken = buildModelMock();
const warning = buildModelMock();
const hazard = buildModelMock();
const hazardReport = buildModelMock();
const shelter = buildModelMock();
const shelterOccupancyLog = buildModelMock();
const rescueTeam = buildModelMock();
const rescueDispatch = buildModelMock();
const reliefSupply = buildModelMock();
const supplyDispatch = buildModelMock();
const broadcastChannel = buildModelMock();
const warningBroadcast = buildModelMock();
const notificationLog = buildModelMock();
const disasterReport = buildModelMock();

/**
 * The mock Prisma client.
 * Import this in tests that need to inspect or configure mock behaviour.
 */
export const mockPrisma = {
  user,
  citizen,
  refreshToken,
  warning,
  hazard,
  hazardReport,
  shelter,
  shelterOccupancyLog,
  rescueTeam,
  rescueDispatch,
  reliefSupply,
  supplyDispatch,
  broadcastChannel,
  warningBroadcast,
  notificationLog,
  disasterReport,

  /**
   * Mock $transaction that executes each operation in the array and returns
   * the resolved values, mirroring the behaviour of the real Prisma
   * interactive transaction for the sequential-array form used in the
   * services (prisma.$transaction([op1, op2, ...])).
   *
   * For the callback form (prisma.$transaction(async (tx) => { ... })) it
   * simply calls the callback with the mock itself so tests can exercise
   * transactional service code without extra ceremony.
   */
  $transaction: jest.fn().mockImplementation(
    (arg: unknown[] | ((tx: unknown) => Promise<unknown>)) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(mockPrisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    },
  ),

  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $executeRaw: jest.fn().mockResolvedValue(0),
  $queryRaw: jest.fn().mockResolvedValue([]),
};

/**
 * Clears all mock implementations and call history on every model delegate
 * and top-level client methods.
 *
 * Call this inside `beforeEach` to keep tests isolated.
 */
export function resetMockPrisma(): void {
  const allModels = [
    user, citizen, refreshToken, warning, hazard, hazardReport, shelter,
    shelterOccupancyLog, rescueTeam, rescueDispatch, reliefSupply,
    supplyDispatch, broadcastChannel, warningBroadcast, notificationLog,
    disasterReport,
  ];

  for (const model of allModels) {
    for (const fn of Object.values(model)) {
      (fn as jest.Mock).mockReset();
    }
  }

  (mockPrisma.$transaction as jest.Mock).mockReset().mockImplementation(
    (arg: unknown[] | ((tx: unknown) => Promise<unknown>)) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(mockPrisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    },
  );

  (mockPrisma.$connect as jest.Mock).mockReset().mockResolvedValue(undefined);
  (mockPrisma.$disconnect as jest.Mock).mockReset().mockResolvedValue(undefined);
  (mockPrisma.$executeRaw as jest.Mock).mockReset().mockResolvedValue(0);
  (mockPrisma.$queryRaw as jest.Mock).mockReset().mockResolvedValue([]);
}
