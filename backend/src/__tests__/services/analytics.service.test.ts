// ─── Module mocks (must come before any imports of the mocked modules) ──────────

jest.mock('../../config/database', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma,
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { mockPrisma, resetMockPrisma } from '../mocks/prisma.mock';
import {
  getOverviewData,
  getShelterAnalytics,
  getResourceAnalytics,
  getAlertTimeline,
} from '../../services/analytics.service';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const NOW = new Date('2024-06-15T12:00:00.000Z');

/** Returns a date that is {@link daysAgo} days before NOW. */
function daysBack(daysAgo: number): Date {
  return new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

// ─── Helpers to build mock records ────────────────────────────────────────────

const buildWarning = (overrides: Partial<{
  id: string;
  warningCode: string;
  hazardType: string;
  severityLevel: string;
  status: string;
  targetDistricts: string[];
  issuedTime: Date;
  createdAt: Date;
  notificationLogs: ReturnType<typeof buildNotificationLog>[];
}> = {}) => ({
  id: overrides.id ?? 'warning-1',
  warningCode: overrides.warningCode ?? 'W-001',
  hazardType: overrides.hazardType ?? 'FLOOD',
  severityLevel: overrides.severityLevel ?? 'WARNING',
  status: overrides.status ?? 'ACTIVE',
  targetDistricts: overrides.targetDistricts ?? ['Colombo'],
  issuedTime: overrides.issuedTime ?? daysBack(1),
  createdAt: overrides.createdAt ?? daysBack(1),
  notificationLogs: overrides.notificationLogs ?? [],
});

const buildNotificationLog = (overrides: Partial<{
  id: string;
  warningId: string;
  channel: string;
  recipientCount: number;
  deliveredCount: number;
}> = {}) => ({
  id: overrides.id ?? 'log-1',
  warningId: overrides.warningId ?? 'warning-1',
  channel: overrides.channel ?? 'SMS_BLAST',
  recipientCount: overrides.recipientCount ?? 1000,
  deliveredCount: overrides.deliveredCount ?? 850,
});

const buildHazardReportGroup = (status: string, count: number) => ({
  status,
  _count: { id: count },
});

const buildShelter = (overrides: Partial<{
  id: string;
  name: string;
  district: string;
  capacity: number;
  currentOccupancy: number;
  status: string;
  occupancyLogs: unknown[];
}> = {}) => ({
  id: overrides.id ?? 'shelter-1',
  name: overrides.name ?? 'Main Shelter',
  district: overrides.district ?? 'Colombo',
  capacity: overrides.capacity ?? 200,
  currentOccupancy: overrides.currentOccupancy ?? 100,
  status: overrides.status ?? 'OPEN',
  occupancyLogs: overrides.occupancyLogs ?? [],
});

const buildSupplyDispatch = (overrides: Partial<{
  id: string;
  quantity: number;
  destinationLabel: string;
  dispatchedAt: Date;
  supply: { category: string; unit: string } | null;
}> = {}) => ({
  id: overrides.id ?? 'dispatch-1',
  quantity: overrides.quantity ?? 50,
  destinationLabel: overrides.destinationLabel ?? 'Colombo District',
  dispatchedAt: overrides.dispatchedAt ?? daysBack(5),
  supply: overrides.supply !== undefined ? overrides.supply : { category: 'FOOD', unit: 'kg' },
});

const buildReliefSupply = (overrides: Partial<{
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
}> = {}) => ({
  id: overrides.id ?? 'supply-1',
  name: overrides.name ?? 'Rice',
  category: overrides.category ?? 'FOOD',
  quantity: overrides.quantity ?? 500,
  unit: overrides.unit ?? 'kg',
  location: overrides.location ?? 'Warehouse A',
});

// ─── Helpers to wire up the "happy path" mocks for getOverviewData ────────────

/**
 * Sets up all the mock calls that getOverviewData's Promise.all needs,
 * then mocks the sequential calls (groupBy, hazardReport.count loop, findMany).
 */
function setupOverviewMocks({
  totalWarnings = 10,
  warningsThisMonth = 3,
  reportsData = [
    buildHazardReportGroup('VERIFIED', 4),
    buildHazardReportGroup('REJECTED', 2),
    buildHazardReportGroup('PENDING_VERIFICATION', 6),
  ],
  evacuatedCount = 8,
  avgResponseItems = [] as { submittedAt: Date; reviewedAt: Date | null }[],
  shelters = [buildShelter()],
  warningsByType = [{ hazardType: 'FLOOD', _count: { id: 5 } }],
  trendCount = 1,
  activeWarnings = [buildWarning()],
} = {}) {
  // Promise.all batch: [count, count, groupBy, count, findMany, findMany]
  (mockPrisma.warning.count as jest.Mock)
    .mockResolvedValueOnce(totalWarnings)   // totalWarnings
    .mockResolvedValueOnce(warningsThisMonth); // warningsThisMonth

  (mockPrisma.hazardReport.groupBy as jest.Mock).mockResolvedValueOnce(reportsData);
  (mockPrisma.hazardReport.count as jest.Mock).mockResolvedValueOnce(evacuatedCount);
  (mockPrisma.hazardReport.findMany as jest.Mock).mockResolvedValueOnce(avgResponseItems);
  (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValueOnce(shelters);

  // warningsByType groupBy (after Promise.all)
  (mockPrisma.warning.groupBy as jest.Mock).mockResolvedValueOnce(warningsByType);

  // 14-day trend — each of the 14 loop iterations calls hazardReport.count
  for (let i = 0; i < 14; i++) {
    (mockPrisma.hazardReport.count as jest.Mock).mockResolvedValueOnce(trendCount);
  }

  // highRiskZones findMany
  (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce(activeWarnings);
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('analytics.service', () => {
  beforeEach(() => {
    resetMockPrisma();
  });

  // ── getOverviewData ────────────────────────────────────────────────────────

  describe('getOverviewData()', () => {
    describe('KPIs', () => {
      it('returns totalWarningsIssued from warning.count (all-time)', async () => {
        setupOverviewMocks({ totalWarnings: 42 });
        const result = await getOverviewData();
        expect(result.kpis.totalWarningsIssued).toBe(42);
      });

      it('returns warningsThisMonth from second warning.count', async () => {
        setupOverviewMocks({ warningsThisMonth: 7 });
        const result = await getOverviewData();
        expect(result.kpis.warningsThisMonth).toBe(7);
      });

      it('returns citizenReportsReceived as sum of all status group counts', async () => {
        setupOverviewMocks({
          reportsData: [
            buildHazardReportGroup('VERIFIED', 10),
            buildHazardReportGroup('REJECTED', 5),
            buildHazardReportGroup('PENDING_VERIFICATION', 3),
          ],
        });
        const result = await getOverviewData();
        expect(result.kpis.citizenReportsReceived).toBe(18);
      });

      it('calculates verificationRate as verifiedReports / totalReports (rounded)', async () => {
        setupOverviewMocks({
          reportsData: [
            buildHazardReportGroup('VERIFIED', 3),
            buildHazardReportGroup('PENDING_VERIFICATION', 7),
          ],
        });
        const result = await getOverviewData();
        // 3/10 = 0.3, Math.round(0.3 * 100)/100 = 0.3
        expect(result.kpis.verificationRate).toBe(0.3);
      });

      it('returns 0 verificationRate when there are no reports', async () => {
        setupOverviewMocks({ reportsData: [] });
        const result = await getOverviewData();
        expect(result.kpis.verificationRate).toBe(0);
      });

      it('returns peopleEvacuated as sum of currentOccupancy across OPEN/FULL shelters', async () => {
        setupOverviewMocks({
          shelters: [
            buildShelter({ currentOccupancy: 60 }),
            buildShelter({ id: 'shelter-2', currentOccupancy: 40 }),
          ],
        });
        const result = await getOverviewData();
        expect(result.kpis.peopleEvacuated).toBe(100);
      });

      it('calculates shelterCapacityPercent from aggregate capacity and occupancy', async () => {
        setupOverviewMocks({
          shelters: [
            buildShelter({ capacity: 200, currentOccupancy: 80 }),
            buildShelter({ id: 'shelter-2', capacity: 100, currentOccupancy: 20 }),
          ],
        });
        const result = await getOverviewData();
        // (80+20) / (200+100) = 100/300 ≈ 33%
        expect(result.kpis.shelterCapacityPercent).toBe(33);
      });

      it('returns 0 shelterCapacityPercent when total capacity is zero', async () => {
        setupOverviewMocks({ shelters: [] });
        const result = await getOverviewData();
        expect(result.kpis.shelterCapacityPercent).toBe(0);
      });

      it('returns activeShelters as the count of shelters returned by findMany', async () => {
        setupOverviewMocks({
          shelters: [buildShelter(), buildShelter({ id: 's2' }), buildShelter({ id: 's3' })],
        });
        const result = await getOverviewData();
        expect(result.kpis.activeShelters).toBe(3);
      });

      it('calculates avgResponseTimeMinutes from reviewedAt − submittedAt', async () => {
        const submitted = new Date('2024-06-10T10:00:00Z');
        const reviewed = new Date('2024-06-10T10:30:00Z'); // 30 min later
        setupOverviewMocks({
          avgResponseItems: [{ submittedAt: submitted, reviewedAt: reviewed }],
        });
        const result = await getOverviewData();
        expect(result.kpis.avgResponseTimeMinutes).toBe(30);
      });

      it('returns 0 avgResponseTimeMinutes when there are no verified reports', async () => {
        setupOverviewMocks({ avgResponseItems: [] });
        const result = await getOverviewData();
        expect(result.kpis.avgResponseTimeMinutes).toBe(0);
      });

      it('returns districtsAffected equal to the number of unique districts in active warnings', async () => {
        setupOverviewMocks({
          activeWarnings: [
            buildWarning({ targetDistricts: ['Colombo', 'Gampaha'] }),
            buildWarning({ id: 'w2', targetDistricts: ['Kandy'] }),
          ],
        });
        const result = await getOverviewData();
        expect(result.kpis.districtsAffected).toBe(3);
      });

      it('deduplicates districts that appear in multiple active warnings', async () => {
        setupOverviewMocks({
          activeWarnings: [
            buildWarning({ targetDistricts: ['Colombo', 'Gampaha'] }),
            buildWarning({ id: 'w2', targetDistricts: ['Colombo'] }),
          ],
        });
        const result = await getOverviewData();
        expect(result.kpis.districtsAffected).toBe(2);
      });
    });

    describe('warningsByHazardType', () => {
      it('maps each groupBy result to { type, label, count }', async () => {
        setupOverviewMocks({
          warningsByType: [
            { hazardType: 'FLOOD', _count: { id: 8 } },
            { hazardType: 'CYCLONE', _count: { id: 3 } },
          ],
        });
        const result = await getOverviewData();
        expect(result.warningsByHazardType).toHaveLength(2);
        expect(result.warningsByHazardType[0]).toEqual({ type: 'flood', label: 'Flood', count: 8 });
        expect(result.warningsByHazardType[1]).toEqual({ type: 'cyclone', label: 'Cyclone', count: 3 });
      });

      it('returns an empty array when there are no warnings in the period', async () => {
        setupOverviewMocks({ warningsByType: [] });
        const result = await getOverviewData();
        expect(result.warningsByHazardType).toEqual([]);
      });

      it('lowercases the type and capitalises first letter for label', async () => {
        setupOverviewMocks({
          warningsByType: [{ hazardType: 'TSUNAMI', _count: { id: 1 } }],
        });
        const result = await getOverviewData();
        expect(result.warningsByHazardType[0].type).toBe('tsunami');
        expect(result.warningsByHazardType[0].label).toBe('Tsunami');
      });

      it('replaces underscores with spaces in label for multi-word hazard types', async () => {
        setupOverviewMocks({
          warningsByType: [{ hazardType: 'LAND_SLIDE', _count: { id: 2 } }],
        });
        const result = await getOverviewData();
        expect(result.warningsByHazardType[0].label).toBe('Land slide');
      });
    });

    describe('verificationBreakdown', () => {
      it('returns correct approved, rejected, and pending counts', async () => {
        setupOverviewMocks({
          reportsData: [
            buildHazardReportGroup('VERIFIED', 5),
            buildHazardReportGroup('REJECTED', 3),
            buildHazardReportGroup('PENDING_VERIFICATION', 4),
            buildHazardReportGroup('UNDER_REVIEW', 2),
          ],
        });
        const result = await getOverviewData();
        expect(result.verificationBreakdown).toEqual({ approved: 5, rejected: 3, pending: 6 });
      });

      it('returns 0 for each bucket when there are no reports', async () => {
        setupOverviewMocks({ reportsData: [] });
        const result = await getOverviewData();
        expect(result.verificationBreakdown).toEqual({ approved: 0, rejected: 0, pending: 0 });
      });

      it('sums PENDING_VERIFICATION and UNDER_REVIEW into pending', async () => {
        setupOverviewMocks({
          reportsData: [
            buildHazardReportGroup('PENDING_VERIFICATION', 7),
            buildHazardReportGroup('UNDER_REVIEW', 3),
          ],
        });
        const result = await getOverviewData();
        expect(result.verificationBreakdown.pending).toBe(10);
        expect(result.verificationBreakdown.approved).toBe(0);
        expect(result.verificationBreakdown.rejected).toBe(0);
      });
    });

    describe('highRiskZones', () => {
      it('assigns "severe" level for EMERGENCY severity warnings', async () => {
        setupOverviewMocks({
          activeWarnings: [
            buildWarning({ severityLevel: 'EMERGENCY', targetDistricts: ['Galle'] }),
          ],
        });
        const result = await getOverviewData();
        const zone = result.highRiskZones.find(z => z.district === 'Galle');
        expect(zone?.level).toBe('severe');
      });

      it('assigns "high" level for WARNING severity warnings', async () => {
        setupOverviewMocks({
          activeWarnings: [
            buildWarning({ severityLevel: 'WARNING', targetDistricts: ['Kandy'] }),
          ],
        });
        const result = await getOverviewData();
        const zone = result.highRiskZones.find(z => z.district === 'Kandy');
        expect(zone?.level).toBe('high');
      });

      it('assigns "medium" level for other severity levels', async () => {
        setupOverviewMocks({
          activeWarnings: [
            buildWarning({ severityLevel: 'ADVISORY', targetDistricts: ['Matara'] }),
          ],
        });
        const result = await getOverviewData();
        const zone = result.highRiskZones.find(z => z.district === 'Matara');
        expect(zone?.level).toBe('medium');
      });

      it('upgrades a district from medium to high when a WARNING is added', async () => {
        setupOverviewMocks({
          activeWarnings: [
            buildWarning({ id: 'w1', severityLevel: 'ADVISORY', targetDistricts: ['Colombo'] }),
            buildWarning({ id: 'w2', severityLevel: 'WARNING', targetDistricts: ['Colombo'] }),
          ],
        });
        const result = await getOverviewData();
        const zone = result.highRiskZones.find(z => z.district === 'Colombo');
        expect(zone?.level).toBe('high');
      });

      it('upgrades a district from high to severe when an EMERGENCY is added', async () => {
        setupOverviewMocks({
          activeWarnings: [
            buildWarning({ id: 'w1', severityLevel: 'WARNING', targetDistricts: ['Negombo'] }),
            buildWarning({ id: 'w2', severityLevel: 'EMERGENCY', targetDistricts: ['Negombo'] }),
          ],
        });
        const result = await getOverviewData();
        const zone = result.highRiskZones.find(z => z.district === 'Negombo');
        expect(zone?.level).toBe('severe');
      });

      it('returns an empty array when there are no active warnings', async () => {
        setupOverviewMocks({ activeWarnings: [] });
        const result = await getOverviewData();
        expect(result.highRiskZones).toEqual([]);
      });
    });

    describe('citizenReportsTrend', () => {
      it('returns exactly 14 data points', async () => {
        setupOverviewMocks();
        const result = await getOverviewData();
        expect(result.citizenReportsTrend).toHaveLength(14);
      });

      it('each data point has a date string and a numeric count', async () => {
        setupOverviewMocks({ trendCount: 5 });
        const result = await getOverviewData();
        for (const point of result.citizenReportsTrend) {
          expect(typeof point.date).toBe('string');
          expect(/^\d{4}-\d{2}-\d{2}$/.test(point.date)).toBe(true);
          expect(typeof point.count).toBe('number');
        }
      });

      it('populates each day count from hazardReport.count', async () => {
        setupOverviewMocks({ trendCount: 7 });
        const result = await getOverviewData();
        expect(result.citizenReportsTrend.every(p => p.count === 7)).toBe(true);
      });

      it('points are in chronological order (oldest first)', async () => {
        setupOverviewMocks();
        const result = await getOverviewData();
        for (let i = 1; i < result.citizenReportsTrend.length; i++) {
          expect(result.citizenReportsTrend[i].date >= result.citizenReportsTrend[i - 1].date).toBe(true);
        }
      });
    });

    describe('period parameter', () => {
      it('passes a date >= periodStart to hazardReport.groupBy where clause for 7d', async () => {
        setupOverviewMocks();
        await getOverviewData('7d');

        const groupByCall = (mockPrisma.hazardReport.groupBy as jest.Mock).mock.calls[0][0];
        const gteDate: Date = groupByCall.where.submittedAt.gte;

        const expectedStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        // Allow a few seconds of clock drift in the test run
        expect(gteDate.getTime()).toBeGreaterThan(expectedStart.getTime() - 5000);
        expect(gteDate.getTime()).toBeLessThanOrEqual(Date.now());
      });

      it('passes a date >= periodStart to warning.groupBy where clause for 30d', async () => {
        setupOverviewMocks();
        await getOverviewData('30d');

        const groupByCall = (mockPrisma.warning.groupBy as jest.Mock).mock.calls[0][0];
        const gteDate: Date = groupByCall.where.createdAt.gte;

        const expectedStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        expect(gteDate.getTime()).toBeGreaterThan(expectedStart.getTime() - 5000);
        expect(gteDate.getTime()).toBeLessThanOrEqual(Date.now());
      });

      it('defaults to 30d when no period is supplied', async () => {
        setupOverviewMocks();
        await getOverviewData(); // no argument

        const groupByCall = (mockPrisma.warning.groupBy as jest.Mock).mock.calls[0][0];
        const gteDate: Date = groupByCall.where.createdAt.gte;

        const expectedStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        expect(gteDate.getTime()).toBeGreaterThan(expectedStart.getTime() - 5000);
      });

      it('uses a closer start date for 7d than for 90d', async () => {
        // First call: 7d
        setupOverviewMocks();
        await getOverviewData('7d');
        const sevenDayGte: Date = (mockPrisma.warning.groupBy as jest.Mock).mock.calls[0][0].where.createdAt.gte;

        resetMockPrisma();
        setupOverviewMocks();
        await getOverviewData('90d');
        const ninetyDayGte: Date = (mockPrisma.warning.groupBy as jest.Mock).mock.calls[0][0].where.createdAt.gte;

        expect(sevenDayGte.getTime()).toBeGreaterThan(ninetyDayGte.getTime());
      });
    });
  });

  // ── getShelterAnalytics ────────────────────────────────────────────────────

  describe('getShelterAnalytics()', () => {
    describe('KPIs', () => {
      it('returns totalSheltered as sum of currentOccupancy across all shelters', async () => {
        (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValueOnce([
          buildShelter({ currentOccupancy: 80 }),
          buildShelter({ id: 's2', currentOccupancy: 120 }),
        ]);
        const result = await getShelterAnalytics();
        expect(result.kpis.totalSheltered).toBe(200);
      });

      it('returns activeSheltersCount as count of non-CLOSED shelters', async () => {
        (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValueOnce([
          buildShelter({ status: 'OPEN' }),
          buildShelter({ id: 's2', status: 'FULL' }),
          buildShelter({ id: 's3', status: 'CLOSED' }),
        ]);
        const result = await getShelterAnalytics();
        expect(result.kpis.activeSheltersCount).toBe(2);
      });

      it('returns totalDesignatedShelters as total shelter count regardless of status', async () => {
        (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValueOnce([
          buildShelter({ status: 'OPEN' }),
          buildShelter({ id: 's2', status: 'CLOSED' }),
          buildShelter({ id: 's3', status: 'MAINTENANCE' }),
        ]);
        const result = await getShelterAnalytics();
        expect(result.kpis.totalDesignatedShelters).toBe(3);
      });

      it('returns 0 for all KPIs when there are no shelters', async () => {
        (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValueOnce([]);
        const result = await getShelterAnalytics();
        expect(result.kpis.totalSheltered).toBe(0);
        expect(result.kpis.activeSheltersCount).toBe(0);
        expect(result.kpis.totalDesignatedShelters).toBe(0);
      });
    });

    describe('shelterDirectory with capacityRate', () => {
      it('calculates capacityRate as (currentOccupancy / capacity) * 100 rounded', async () => {
        (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValueOnce([
          buildShelter({ capacity: 200, currentOccupancy: 150 }),
        ]);
        const result = await getShelterAnalytics();
        expect(result.shelterDirectory[0].capacityRate).toBe(75);
      });

      it('returns 0 capacityRate when capacity is 0', async () => {
        (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValueOnce([
          buildShelter({ capacity: 0, currentOccupancy: 0 }),
        ]);
        const result = await getShelterAnalytics();
        expect(result.shelterDirectory[0].capacityRate).toBe(0);
      });

      it('returns 100 capacityRate for a fully occupied shelter', async () => {
        (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValueOnce([
          buildShelter({ capacity: 100, currentOccupancy: 100 }),
        ]);
        const result = await getShelterAnalytics();
        expect(result.shelterDirectory[0].capacityRate).toBe(100);
      });

      it('can exceed 100 capacityRate when overcrowded', async () => {
        (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValueOnce([
          buildShelter({ capacity: 50, currentOccupancy: 60 }),
        ]);
        const result = await getShelterAnalytics();
        expect(result.shelterDirectory[0].capacityRate).toBe(120);
      });

      it('maps all shelterDirectory fields correctly', async () => {
        const shelter = buildShelter({
          id: 'sh-99',
          name: 'Galle Shelter',
          district: 'Galle',
          capacity: 300,
          currentOccupancy: 90,
          status: 'OPEN',
        });
        (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValueOnce([shelter]);
        const result = await getShelterAnalytics();
        expect(result.shelterDirectory[0]).toMatchObject({
          id: 'sh-99',
          name: 'Galle Shelter',
          district: 'Galle',
          capacity: 300,
          currentOccupancy: 90,
          status: 'OPEN',
          capacityRate: 30,
        });
      });

      it('includes one entry per shelter returned by findMany', async () => {
        (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValueOnce([
          buildShelter({ id: 's1' }),
          buildShelter({ id: 's2' }),
          buildShelter({ id: 's3' }),
        ]);
        const result = await getShelterAnalytics();
        expect(result.shelterDirectory).toHaveLength(3);
      });

      it('returns an empty shelterDirectory when there are no shelters', async () => {
        (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValueOnce([]);
        const result = await getShelterAnalytics();
        expect(result.shelterDirectory).toEqual([]);
      });
    });
  });

  // ── getResourceAnalytics ──────────────────────────────────────────────────

  describe('getResourceAnalytics()', () => {
    describe('KPIs', () => {
      it('returns totalDistributions as the count of dispatches', async () => {
        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([
          buildSupplyDispatch(),
          buildSupplyDispatch({ id: 'd2' }),
          buildSupplyDispatch({ id: 'd3' }),
        ]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([]);
        const result = await getResourceAnalytics();
        expect(result.kpis.totalDistributions).toBe(3);
      });

      it('returns totalUnitsDispatched as sum of all dispatch quantities', async () => {
        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([
          buildSupplyDispatch({ quantity: 100 }),
          buildSupplyDispatch({ id: 'd2', quantity: 250 }),
        ]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([]);
        const result = await getResourceAnalytics();
        expect(result.kpis.totalUnitsDispatched).toBe(350);
      });

      it('returns 0 for KPIs when there are no dispatches', async () => {
        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([]);
        const result = await getResourceAnalytics();
        expect(result.kpis.totalDistributions).toBe(0);
        expect(result.kpis.totalUnitsDispatched).toBe(0);
        expect(result.kpis.districtsWithDeliveries).toBe(0);
      });

      it('counts unique destinations for districtsWithDeliveries', async () => {
        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([
          buildSupplyDispatch({ destinationLabel: 'Colombo' }),
          buildSupplyDispatch({ id: 'd2', destinationLabel: 'Colombo' }), // duplicate
          buildSupplyDispatch({ id: 'd3', destinationLabel: 'Kandy' }),
        ]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([]);
        const result = await getResourceAnalytics();
        expect(result.kpis.districtsWithDeliveries).toBe(2);
      });
    });

    describe('categoryBreakdown percentages', () => {
      it('calculates percentage based on quantity share of total dispatched units', async () => {
        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([
          buildSupplyDispatch({ quantity: 75, supply: { category: 'FOOD', unit: 'kg' } }),
          buildSupplyDispatch({ id: 'd2', quantity: 25, supply: { category: 'MEDICINE', unit: 'units' } }),
        ]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([]);
        const result = await getResourceAnalytics();

        const food = result.categoryBreakdown.find(c => c.category === 'FOOD');
        const medicine = result.categoryBreakdown.find(c => c.category === 'MEDICINE');
        expect(food?.percentage).toBe(75);
        expect(medicine?.percentage).toBe(25);
      });

      it('percentages sum to 100 for non-empty dispatches', async () => {
        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([
          buildSupplyDispatch({ quantity: 50, supply: { category: 'FOOD', unit: 'kg' } }),
          buildSupplyDispatch({ id: 'd2', quantity: 30, supply: { category: 'MEDICINE', unit: 'units' } }),
          buildSupplyDispatch({ id: 'd3', quantity: 20, supply: { category: 'CLOTHING', unit: 'pcs' } }),
        ]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([]);
        const result = await getResourceAnalytics();

        const total = result.categoryBreakdown.reduce((s, c) => s + c.percentage, 0);
        expect(total).toBe(100);
      });

      it('falls back to "Other" category when supply is null', async () => {
        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([
          buildSupplyDispatch({ quantity: 40, supply: null }),
        ]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([]);
        const result = await getResourceAnalytics();

        const other = result.categoryBreakdown.find(c => c.category === 'Other');
        expect(other).toBeDefined();
        expect(other?.percentage).toBe(100);
      });

      it('returns an empty categoryBreakdown when there are no dispatches', async () => {
        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([]);
        const result = await getResourceAnalytics();
        expect(result.categoryBreakdown).toEqual([]);
      });
    });

    describe('supplyInventory', () => {
      it('maps all reliefSupply fields into supplyInventory', async () => {
        const supply = buildReliefSupply({
          id: 'rs-1',
          name: 'Bottled Water',
          category: 'WATER',
          quantity: 1000,
          unit: 'L',
          location: 'Depot B',
        });
        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([supply]);
        const result = await getResourceAnalytics();

        expect(result.supplyInventory).toHaveLength(1);
        expect(result.supplyInventory[0]).toEqual({
          id: 'rs-1',
          name: 'Bottled Water',
          category: 'WATER',
          quantity: 1000,
          unit: 'L',
          location: 'Depot B',
        });
      });

      it('returns an empty supplyInventory when there are no relief supplies', async () => {
        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([]);
        const result = await getResourceAnalytics();
        expect(result.supplyInventory).toEqual([]);
      });
    });

    describe('period parameter', () => {
      it('passes gte date based on 7d period to supplyDispatch.findMany', async () => {
        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([]);
        await getResourceAnalytics('7d');

        const call = (mockPrisma.supplyDispatch.findMany as jest.Mock).mock.calls[0][0];
        const gteDate: Date = call.where.dispatchedAt.gte;

        const expected = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        expect(gteDate.getTime()).toBeGreaterThan(expected.getTime() - 5000);
        expect(gteDate.getTime()).toBeLessThanOrEqual(Date.now());
      });

      it('passes a further-back gte date for 90d than for 7d', async () => {
        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([]);
        await getResourceAnalytics('7d');
        const sevenDayGte: Date = (mockPrisma.supplyDispatch.findMany as jest.Mock).mock.calls[0][0].where.dispatchedAt.gte;

        (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValueOnce([]);
        (mockPrisma.reliefSupply.findMany as jest.Mock).mockResolvedValueOnce([]);
        await getResourceAnalytics('90d');
        const ninetyDayGte: Date = (mockPrisma.supplyDispatch.findMany as jest.Mock).mock.calls[1][0].where.dispatchedAt.gte;

        expect(sevenDayGte.getTime()).toBeGreaterThan(ninetyDayGte.getTime());
      });
    });
  });

  // ── getAlertTimeline ──────────────────────────────────────────────────────

  describe('getAlertTimeline()', () => {
    it('returns warnings with their notification logs included', async () => {
      const log = buildNotificationLog({ recipientCount: 1000, deliveredCount: 900 });
      const warning = buildWarning({ notificationLogs: [log] });
      (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([warning]);

      const result = await getAlertTimeline();
      expect(result).toHaveLength(1);
      expect(result[0].channels).toHaveLength(1);
    });

    it('maps warning fields to the output shape', async () => {
      const issuedTime = daysBack(2);
      const warning = buildWarning({
        id: 'w-abc',
        warningCode: 'W-007',
        hazardType: 'TSUNAMI',
        severityLevel: 'EMERGENCY',
        status: 'ACTIVE',
        targetDistricts: ['Galle', 'Matara'],
        issuedTime,
        notificationLogs: [],
      });
      (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([warning]);

      const result = await getAlertTimeline();
      expect(result[0]).toMatchObject({
        id: 'w-abc',
        warningCode: 'W-007',
        hazardType: 'TSUNAMI',
        severityLevel: 'EMERGENCY',
        targetDistricts: ['Galle', 'Matara'],
        status: 'ACTIVE',
        issuedTime,
      });
    });

    describe('reachRate calculation', () => {
      it('calculates reachRate as (deliveredCount / recipientCount) * 100 rounded', async () => {
        const log = buildNotificationLog({ recipientCount: 1000, deliveredCount: 850 });
        (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([
          buildWarning({ notificationLogs: [log] }),
        ]);

        const result = await getAlertTimeline();
        expect(result[0].channels[0].reachRate).toBe(85);
      });

      it('returns 0 reachRate when recipientCount is 0', async () => {
        const log = buildNotificationLog({ recipientCount: 0, deliveredCount: 0 });
        (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([
          buildWarning({ notificationLogs: [log] }),
        ]);

        const result = await getAlertTimeline();
        expect(result[0].channels[0].reachRate).toBe(0);
      });

      it('returns 100 reachRate when all recipients are reached', async () => {
        const log = buildNotificationLog({ recipientCount: 500, deliveredCount: 500 });
        (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([
          buildWarning({ notificationLogs: [log] }),
        ]);

        const result = await getAlertTimeline();
        expect(result[0].channels[0].reachRate).toBe(100);
      });

      it('maps channel fields correctly in each notification log', async () => {
        const log = buildNotificationLog({
          channel: 'SMS_BLAST',
          recipientCount: 2000,
          deliveredCount: 1800,
        });
        (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([
          buildWarning({ notificationLogs: [log] }),
        ]);

        const result = await getAlertTimeline();
        expect(result[0].channels[0]).toEqual({
          channel: 'SMS_BLAST',
          recipientCount: 2000,
          deliveredCount: 1800,
          reachRate: 90,
        });
      });

      it('supports multiple notification logs per warning', async () => {
        const logs = [
          buildNotificationLog({ id: 'l1', channel: 'SMS_BLAST', recipientCount: 1000, deliveredCount: 700 }),
          buildNotificationLog({ id: 'l2', channel: 'TV_RADIO', recipientCount: 5000, deliveredCount: 5000 }),
        ];
        (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([
          buildWarning({ notificationLogs: logs }),
        ]);

        const result = await getAlertTimeline();
        expect(result[0].channels).toHaveLength(2);
        expect(result[0].channels[0].reachRate).toBe(70);
        expect(result[0].channels[1].reachRate).toBe(100);
      });
    });

    it('returns an empty array when there are no warnings in the period', async () => {
      (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([]);
      const result = await getAlertTimeline();
      expect(result).toEqual([]);
    });

    it('returns multiple warnings in the order returned by the DB', async () => {
      const w1 = buildWarning({ id: 'w1', warningCode: 'W-001' });
      const w2 = buildWarning({ id: 'w2', warningCode: 'W-002' });
      (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([w1, w2]);

      const result = await getAlertTimeline();
      expect(result[0].id).toBe('w1');
      expect(result[1].id).toBe('w2');
    });

    describe('period parameter', () => {
      it('passes gte date based on 7d period to warning.findMany', async () => {
        (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([]);
        await getAlertTimeline('7d');

        const call = (mockPrisma.warning.findMany as jest.Mock).mock.calls[0][0];
        const gteDate: Date = call.where.issuedTime.gte;

        const expected = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        expect(gteDate.getTime()).toBeGreaterThan(expected.getTime() - 5000);
        expect(gteDate.getTime()).toBeLessThanOrEqual(Date.now());
      });

      it('defaults to 7d when no period is supplied', async () => {
        (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([]);
        await getAlertTimeline(); // no argument

        const call = (mockPrisma.warning.findMany as jest.Mock).mock.calls[0][0];
        const gteDate: Date = call.where.issuedTime.gte;

        const expected7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        expect(gteDate.getTime()).toBeGreaterThan(expected7d.getTime() - 5000);
      });

      it('uses a further-back gte for 30d than for 7d', async () => {
        (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([]);
        await getAlertTimeline('7d');
        const sevenDayGte: Date = (mockPrisma.warning.findMany as jest.Mock).mock.calls[0][0].where.issuedTime.gte;

        (mockPrisma.warning.findMany as jest.Mock).mockResolvedValueOnce([]);
        await getAlertTimeline('30d');
        const thirtyDayGte: Date = (mockPrisma.warning.findMany as jest.Mock).mock.calls[1][0].where.issuedTime.gte;

        expect(sevenDayGte.getTime()).toBeGreaterThan(thirtyDayGte.getTime());
      });
    });
  });
});
