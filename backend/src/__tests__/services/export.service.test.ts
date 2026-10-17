// ─── Module mocks (must come before any imports of the mocked modules) ──────────

jest.mock('../../config/database', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma,
}));

jest.mock('../../services/analytics.service');

// Mock the dynamic import of 'fs' and 'path' used inside generateReport.
// The service does `const fs = await import('fs')` and `const path = await import('path')`,
// so we mock those Node built-ins at the module level so jest can intercept them.
jest.mock('fs');
jest.mock('path');

// ─── Imports ──────────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as nodePath from 'path';
import { mockPrisma, resetMockPrisma } from '../mocks/prisma.mock';
import * as analyticsService from '../../services/analytics.service';
import {
  generateReport,
  listReports,
  getCompletedEvents,
  previewAnalyticsReport,
  generateAnalyticsReport,
  getReportFile,
  deleteAnalyticsReport,
} from '../../services/export.service';

// ─── Typed mocks ─────────────────────────────────────────────────────────────

const mockAnalytics = analyticsService as jest.Mocked<typeof analyticsService>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = nodePath as jest.Mocked<typeof nodePath>;

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const OFFICER_ID = 'officer-001';

const buildDisasterReport = (overrides: Partial<{
  id: string;
  reportTitle: string;
  disasterType: string;
  district: string;
  period: string;
  generatedById: string;
  exportFormat: string;
  fileUrl: string;
  generatedAt: Date;
}> = {}) => ({
  id: overrides.id ?? 'report-001',
  reportTitle: overrides.reportTitle ?? 'Test Report',
  disasterType: overrides.disasterType ?? 'FLOOD',
  district: overrides.district ?? 'All Districts',
  period: overrides.period ?? '30d',
  generatedById: overrides.generatedById ?? OFFICER_ID,
  exportFormat: overrides.exportFormat ?? 'CSV',
  fileUrl: overrides.fileUrl ?? 'http://localhost:3000/uploads/test.csv',
  generatedAt: overrides.generatedAt ?? new Date('2024-06-15T12:00:00.000Z'),
});

/** Minimal overview data returned by analyticsService.getOverviewData */
const buildOverviewData = (overrides: Partial<{
  warningsByHazardType: { type: string; label: string; count: number }[];
  kpis: {
    totalWarningsIssued: number;
    warningsThisMonth: number;
    citizenReportsReceived: number;
    verificationRate: number;
    peopleEvacuated: number;
    districtsAffected: number;
    avgResponseTimeMinutes: number;
    activeShelters: number;
    shelterCapacityPercent: number;
  };
}> = {}) => ({
  kpis: overrides.kpis ?? {
    totalWarningsIssued: 10,
    warningsThisMonth: 3,
    citizenReportsReceived: 20,
    verificationRate: 0.75,
    peopleEvacuated: 500,
    districtsAffected: 4,
    avgResponseTimeMinutes: 45,
    activeShelters: 8,
    shelterCapacityPercent: 72,
  },
  warningsByHazardType: overrides.warningsByHazardType ?? [
    { type: 'flood', label: 'Flood', count: 5 },
    { type: 'cyclone', label: 'Cyclone', count: 3 },
  ],
  verificationBreakdown: { approved: 8, rejected: 2, pending: 4 },
  highRiskZones: [{ district: 'Colombo', level: 'high' }],
  citizenReportsTrend: [],
});

const buildShelterAnalyticsData = () => ({
  kpis: { totalSheltered: 1200, activeSheltersCount: 5, totalDesignatedShelters: 8 },
  shelterDirectory: [
    { id: 's-1', name: 'Colombo Shelter A', district: 'Colombo', capacity: 300, currentOccupancy: 210, capacityRate: 70, status: 'OPEN' as const },
    { id: 's-2', name: 'Galle Shelter B',   district: 'Galle',   capacity: 200, currentOccupancy: 180, capacityRate: 90, status: 'FULL' as const },
    { id: 's-3', name: 'Kandy Shelter C',   district: 'Kandy',   capacity: 150, currentOccupancy: 90,  capacityRate: 60, status: 'OPEN' as const },
  ],
});

const buildResourceAnalyticsData = () => ({
  kpis: { totalDistributions: 25, totalUnitsDispatched: 1000, districtsWithDeliveries: 6 },
  categoryBreakdown: [{ category: 'FOOD', percentage: 60 }, { category: 'MEDICINE', percentage: 40 }],
  supplyInventory: [
    { id: 'sup-1', name: 'Rice',    category: 'FOOD',     quantity: 500, unit: 'kg',    location: 'Warehouse A' },
    { id: 'sup-2', name: 'Panadol', category: 'MEDICINE', quantity: 200, unit: 'units', location: 'Warehouse B' },
  ],
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Wire up the fs/path mocks that generateReport calls for every template.
 * Returns the fake filepath so assertions can reference it.
 */
function setupFsMocks(filename = 'template_1234567890.csv', uploadDir = './uploads') {
  const fakePath = `${uploadDir}/${filename}`;
  (mockFs.existsSync as jest.Mock).mockReturnValue(true);
  (mockFs.mkdirSync as jest.Mock).mockReturnValue(undefined);
  (mockFs.writeFileSync as jest.Mock).mockReturnValue(undefined);
  (mockPath.join as jest.Mock).mockReturnValue(fakePath);
  return fakePath;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('exportService', () => {
  beforeEach(() => {
    resetMockPrisma();
    jest.clearAllMocks();
    // Default env vars
    process.env.UPLOAD_DIR = './uploads';
    process.env.BASE_URL = 'http://localhost:3000';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  generateReport
  // ═══════════════════════════════════════════════════════════════════════════

  describe('generateReport()', () => {
    // ── incident_summary template ────────────────────────────────────────────

    describe('templateId: incident_summary', () => {
      const dto = {
        templateId: 'incident_summary',
        title: 'Incident Summary Report',
        districts: [],
        format: 'CSV',
        period: '7d',
      };

      it('calls getOverviewData with the given period', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        setupFsMocks('incident_summary_123.csv');
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        expect(mockAnalytics.getOverviewData).toHaveBeenCalledWith('7d');
      });

      it('writes a CSV file to the upload directory', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        setupFsMocks('incident_summary_123.csv');
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
        const [filePath, content] = (mockFs.writeFileSync as jest.Mock).mock.calls[0];
        expect(typeof filePath).toBe('string');
        // CSV should contain the expected headers
        expect(content).toContain('hazard_type');
        expect(content).toContain('warnings_count');
        expect(content).toContain('people_evacuated');
        expect(content).toContain('avg_response_time_minutes');
      });

      it('creates a disasterReport record with correct fields', async () => {
        const overviewData = buildOverviewData();
        mockAnalytics.getOverviewData.mockResolvedValue(overviewData);
        setupFsMocks('incident_summary_123.csv');
        const createdReport = buildDisasterReport({ reportTitle: dto.title, period: dto.period });
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(createdReport);

        await generateReport(dto, OFFICER_ID);

        expect(mockPrisma.disasterReport.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              reportTitle: dto.title,
              generatedById: OFFICER_ID,
              exportFormat: 'CSV',
              period: dto.period,
            }),
          }),
        );
      });

      it('returns the created report with a fileUrl', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        setupFsMocks('incident_summary_123.csv');
        const createdReport = buildDisasterReport({ fileUrl: 'http://localhost:3000/uploads/incident_summary_123.csv' });
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(createdReport);

        const result = await generateReport(dto, OFFICER_ID);

        expect(result.fileUrl).toMatch(/^http/);
        expect(result.id).toBe(createdReport.id);
      });

      it('derives disasterType from the first warningsByHazardType entry', async () => {
        const overviewData = buildOverviewData({
          warningsByHazardType: [{ type: 'cyclone', label: 'Cyclone', count: 7 }],
        });
        mockAnalytics.getOverviewData.mockResolvedValue(overviewData);
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        expect(mockPrisma.disasterReport.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ disasterType: 'CYCLONE' }),
          }),
        );
      });

      it('falls back to FLOOD when warningsByHazardType is empty', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData({ warningsByHazardType: [] }));
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        expect(mockPrisma.disasterReport.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ disasterType: 'FLOOD' }),
          }),
        );
      });

      it('uses a generated title when dto.title is empty', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport({ ...dto, title: '' }, OFFICER_ID);

        const callData = (mockPrisma.disasterReport.create as jest.Mock).mock.calls[0][0].data;
        expect(callData.reportTitle).toMatch(/^incident_summary_\d{4}-\d{2}-\d{2}$/);
      });

      it('uses default period "30d" when dto.period is not provided', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        const { period: _omitted, ...dtoWithoutPeriod } = dto;
        await generateReport(dtoWithoutPeriod as typeof dto, OFFICER_ID);

        expect(mockAnalytics.getOverviewData).toHaveBeenCalledWith('30d');
        const callData = (mockPrisma.disasterReport.create as jest.Mock).mock.calls[0][0].data;
        expect(callData.period).toBe('30d');
      });
    });

    // ── shelter_occupancy template ───────────────────────────────────────────

    describe('templateId: shelter_occupancy', () => {
      const dto = {
        templateId: 'shelter_occupancy',
        title: 'Shelter Occupancy Report',
        districts: [],
        format: 'CSV',
        period: '30d',
      };

      it('calls getShelterAnalytics (not getOverviewData)', async () => {
        mockAnalytics.getShelterAnalytics.mockResolvedValue(buildShelterAnalyticsData());
        setupFsMocks('shelter_occupancy_123.csv');
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        expect(mockAnalytics.getShelterAnalytics).toHaveBeenCalledTimes(1);
        expect(mockAnalytics.getOverviewData).not.toHaveBeenCalled();
      });

      it('writes a CSV file with shelter-specific headers', async () => {
        mockAnalytics.getShelterAnalytics.mockResolvedValue(buildShelterAnalyticsData());
        setupFsMocks('shelter_occupancy_123.csv');
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        const content: string = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
        expect(content).toContain('shelter_name');
        expect(content).toContain('district');
        expect(content).toContain('capacity');
        expect(content).toContain('current_occupancy');
        expect(content).toContain('occupancy_rate');
        expect(content).toContain('status');
      });

      it('includes all shelters when districts array is empty', async () => {
        mockAnalytics.getShelterAnalytics.mockResolvedValue(buildShelterAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport({ ...dto, districts: [] }, OFFICER_ID);

        const content: string = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
        // All three shelters appear in the CSV
        expect(content).toContain('Colombo Shelter A');
        expect(content).toContain('Galle Shelter B');
        expect(content).toContain('Kandy Shelter C');
      });

      it('filters shelters to matching districts when districts are specified', async () => {
        mockAnalytics.getShelterAnalytics.mockResolvedValue(buildShelterAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport({ ...dto, districts: ['Colombo'] }, OFFICER_ID);

        const content: string = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
        expect(content).toContain('Colombo Shelter A');
        expect(content).not.toContain('Galle Shelter B');
        expect(content).not.toContain('Kandy Shelter C');
      });

      it('filters shelters to multiple specified districts', async () => {
        mockAnalytics.getShelterAnalytics.mockResolvedValue(buildShelterAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport({ ...dto, districts: ['Colombo', 'Kandy'] }, OFFICER_ID);

        const content: string = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
        expect(content).toContain('Colombo Shelter A');
        expect(content).toContain('Kandy Shelter C');
        expect(content).not.toContain('Galle Shelter B');
      });

      it('produces an empty CSV body when no shelters match the district filter', async () => {
        mockAnalytics.getShelterAnalytics.mockResolvedValue(buildShelterAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport({ ...dto, districts: ['Jaffna'] }, OFFICER_ID);

        const content: string = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
        // jsonToCsv returns '' for empty array → writeFileSync is still called but with ''
        expect(content).toBe('');
      });

      it('stores joined district names in the report record', async () => {
        mockAnalytics.getShelterAnalytics.mockResolvedValue(buildShelterAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport({ ...dto, districts: ['Colombo', 'Galle'] }, OFFICER_ID);

        const callData = (mockPrisma.disasterReport.create as jest.Mock).mock.calls[0][0].data;
        expect(callData.district).toBe('Colombo, Galle');
      });
    });

    // ── resource_allocation template ─────────────────────────────────────────

    describe('templateId: resource_allocation', () => {
      const dto = {
        templateId: 'resource_allocation',
        title: 'Resource Allocation Report',
        districts: [],
        format: 'CSV',
        period: '14d',
      };

      it('calls getResourceAnalytics (not other analytics functions)', async () => {
        mockAnalytics.getResourceAnalytics.mockResolvedValue(buildResourceAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        expect(mockAnalytics.getResourceAnalytics).toHaveBeenCalledTimes(1);
        expect(mockAnalytics.getOverviewData).not.toHaveBeenCalled();
        expect(mockAnalytics.getShelterAnalytics).not.toHaveBeenCalled();
      });

      it('writes a CSV file with resource-specific headers', async () => {
        mockAnalytics.getResourceAnalytics.mockResolvedValue(buildResourceAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        const content: string = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
        expect(content).toContain('name');
        expect(content).toContain('category');
        expect(content).toContain('quantity');
        expect(content).toContain('unit');
        expect(content).toContain('location');
      });

      it('includes all supply inventory items in the CSV', async () => {
        mockAnalytics.getResourceAnalytics.mockResolvedValue(buildResourceAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        const content: string = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
        expect(content).toContain('Rice');
        expect(content).toContain('Panadol');
      });

      it('creates the database record with the correct period', async () => {
        mockAnalytics.getResourceAnalytics.mockResolvedValue(buildResourceAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        const callData = (mockPrisma.disasterReport.create as jest.Mock).mock.calls[0][0].data;
        expect(callData.period).toBe('14d');
      });
    });

    // ── default / full national log template ─────────────────────────────────

    describe('templateId: default (full national log)', () => {
      const dto = {
        templateId: 'full_national_log',
        title: 'Full National Log',
        districts: [],
        format: 'CSV',
        period: '30d',
      };

      it('calls all three analytics functions in parallel', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        mockAnalytics.getShelterAnalytics.mockResolvedValue(buildShelterAnalyticsData());
        mockAnalytics.getResourceAnalytics.mockResolvedValue(buildResourceAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        expect(mockAnalytics.getOverviewData).toHaveBeenCalledTimes(1);
        expect(mockAnalytics.getShelterAnalytics).toHaveBeenCalledTimes(1);
        expect(mockAnalytics.getResourceAnalytics).toHaveBeenCalledTimes(1);
      });

      it('writes a CSV with summary metric rows', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        mockAnalytics.getShelterAnalytics.mockResolvedValue(buildShelterAnalyticsData());
        mockAnalytics.getResourceAnalytics.mockResolvedValue(buildResourceAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        const content: string = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1];
        expect(content).toContain('Total Warnings');
        expect(content).toContain('Citizen Reports');
        expect(content).toContain('People Evacuated');
        expect(content).toContain('Total Sheltered');
        expect(content).toContain('Supply Dispatches');
      });

      it('stores "All Districts" when no districts are provided', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        mockAnalytics.getShelterAnalytics.mockResolvedValue(buildShelterAnalyticsData());
        mockAnalytics.getResourceAnalytics.mockResolvedValue(buildResourceAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        const callData = (mockPrisma.disasterReport.create as jest.Mock).mock.calls[0][0].data;
        expect(callData.district).toBe('All Districts');
      });

      it('creates the database record once', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        mockAnalytics.getShelterAnalytics.mockResolvedValue(buildShelterAnalyticsData());
        mockAnalytics.getResourceAnalytics.mockResolvedValue(buildResourceAnalyticsData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        expect(mockPrisma.disasterReport.create).toHaveBeenCalledTimes(1);
      });
    });

    // ── File-system behaviour ────────────────────────────────────────────────

    describe('file system operations', () => {
      const dto = {
        templateId: 'incident_summary',
        title: 'FS Test',
        districts: [],
        format: 'CSV',
        period: '7d',
      };

      it('creates the upload directory when it does not exist', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        (mockFs.existsSync as jest.Mock).mockReturnValue(false);
        (mockFs.mkdirSync as jest.Mock).mockReturnValue(undefined);
        (mockFs.writeFileSync as jest.Mock).mockReturnValue(undefined);
        (mockPath.join as jest.Mock).mockReturnValue('./uploads/incident_summary_123.csv');
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        expect(mockFs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining('uploads'),
          expect.objectContaining({ recursive: true }),
        );
      });

      it('does NOT call mkdirSync when upload directory already exists', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        (mockFs.existsSync as jest.Mock).mockReturnValue(true);
        (mockFs.mkdirSync as jest.Mock).mockReturnValue(undefined);
        (mockFs.writeFileSync as jest.Mock).mockReturnValue(undefined);
        (mockPath.join as jest.Mock).mockReturnValue('./uploads/incident_summary_123.csv');
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        expect(mockFs.mkdirSync).not.toHaveBeenCalled();
      });

      it('constructs the fileUrl using BASE_URL env variable', async () => {
        process.env.BASE_URL = 'https://api.example.com';
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        setupFsMocks('incident_summary_999.csv');
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        const callData = (mockPrisma.disasterReport.create as jest.Mock).mock.calls[0][0].data;
        expect(callData.fileUrl).toContain('https://api.example.com');
      });

      it('falls back to http://localhost:3000 when BASE_URL is not set', async () => {
        delete process.env.BASE_URL;
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        setupFsMocks('incident_summary_000.csv');
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        const callData = (mockPrisma.disasterReport.create as jest.Mock).mock.calls[0][0].data;
        expect(callData.fileUrl).toContain('http://localhost:3000');
      });

      it('uses UPLOAD_DIR env variable for the directory path', async () => {
        process.env.UPLOAD_DIR = '/var/app/exports';
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        (mockFs.existsSync as jest.Mock).mockReturnValue(true);
        (mockFs.writeFileSync as jest.Mock).mockReturnValue(undefined);
        (mockPath.join as jest.Mock).mockReturnValue('/var/app/exports/incident_summary_123.csv');
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        expect(mockPath.join).toHaveBeenCalledWith('/var/app/exports', expect.any(String));
      });

      it('falls back to ./uploads when UPLOAD_DIR is not set', async () => {
        delete process.env.UPLOAD_DIR;
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        (mockFs.existsSync as jest.Mock).mockReturnValue(true);
        (mockFs.writeFileSync as jest.Mock).mockReturnValue(undefined);
        (mockPath.join as jest.Mock).mockReturnValue('./uploads/incident_summary_123.csv');
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(dto, OFFICER_ID);

        expect(mockPath.join).toHaveBeenCalledWith('./uploads', expect.any(String));
      });
    });

    // ── Database record creation (shared across templates) ───────────────────

    describe('database record creation', () => {
      it('sets exportFormat to "CSV" for every template', async () => {
        for (const templateId of ['incident_summary', 'shelter_occupancy', 'resource_allocation', 'other']) {
          resetMockPrisma();
          jest.clearAllMocks();
          mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
          mockAnalytics.getShelterAnalytics.mockResolvedValue(buildShelterAnalyticsData());
          mockAnalytics.getResourceAnalytics.mockResolvedValue(buildResourceAnalyticsData());
          setupFsMocks();
          (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

          await generateReport({ templateId, title: 'T', districts: [], format: 'CSV', period: '30d' }, OFFICER_ID);

          const callData = (mockPrisma.disasterReport.create as jest.Mock).mock.calls[0][0].data;
          expect(callData.exportFormat).toBe('CSV');
        }
      });

      it('includes generatedById matching the officerId argument', async () => {
        mockAnalytics.getOverviewData.mockResolvedValue(buildOverviewData());
        setupFsMocks();
        (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(buildDisasterReport());

        await generateReport(
          { templateId: 'incident_summary', title: 'T', districts: [], format: 'CSV', period: '7d' },
          'officer-xyz',
        );

        const callData = (mockPrisma.disasterReport.create as jest.Mock).mock.calls[0][0].data;
        expect(callData.generatedById).toBe('officer-xyz');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  listReports
  // ═══════════════════════════════════════════════════════════════════════════

  describe('listReports()', () => {
    /** Shorthand to set up both parallel Prisma calls. */
    function setupListMocks(reports: ReturnType<typeof buildDisasterReport>[], total: number) {
      (mockPrisma.disasterReport.findMany as jest.Mock).mockResolvedValue(reports);
      (mockPrisma.disasterReport.count as jest.Mock).mockResolvedValue(total);
    }

    it('returns reports and metadata with default page 1 and limit 20', async () => {
      const reports = [buildDisasterReport()];
      setupListMocks(reports, 1);

      const result = await listReports({});

      expect(result.reports).toEqual(reports);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('paginates using the given page and limit', async () => {
      const reports = Array.from({ length: 5 }, (_, i) => buildDisasterReport({ id: `r-${i}` }));
      setupListMocks(reports, 55);

      const result = await listReports({ page: 2, limit: 5 });

      expect(mockPrisma.disasterReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
      expect(result.meta).toEqual({ total: 55, page: 2, limit: 5, totalPages: 11 });
    });

    it('orders results by generatedAt descending', async () => {
      setupListMocks([], 0);

      await listReports({});

      expect(mockPrisma.disasterReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { generatedAt: 'desc' } }),
      );
    });

    it('calls disasterReport.count once to get the total', async () => {
      setupListMocks([], 0);

      await listReports({});

      expect(mockPrisma.disasterReport.count).toHaveBeenCalledTimes(1);
    });

    it('calculates totalPages correctly for an exact multiple', async () => {
      setupListMocks([], 40);

      const result = await listReports({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(4);
    });

    it('rounds totalPages up for a non-exact multiple', async () => {
      setupListMocks([], 41);

      const result = await listReports({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(5);
    });

    it('skips the correct number of records for page 3 with limit 10', async () => {
      setupListMocks([], 30);

      await listReports({ page: 3, limit: 10 });

      expect(mockPrisma.disasterReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('returns an empty reports array when there are no records', async () => {
      setupListMocks([], 0);

      const result = await listReports({});

      expect(result.reports).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('uses page 1 when page param is undefined', async () => {
      setupListMocks([], 0);

      await listReports({ limit: 5 });

      expect(mockPrisma.disasterReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 5 }),
      );
    });

    it('uses limit 20 when limit param is undefined', async () => {
      setupListMocks([], 0);

      await listReports({ page: 1 });

      expect(mockPrisma.disasterReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('runs findMany and count in parallel (both called before either resolves)', async () => {
      // Both mocks resolve immediately; verify both are called within the same tick
      let findManyResolved = false;
      let countResolved = false;

      (mockPrisma.disasterReport.findMany as jest.Mock).mockImplementation(() =>
        Promise.resolve([]).then(v => { findManyResolved = true; return v; }),
      );
      (mockPrisma.disasterReport.count as jest.Mock).mockImplementation(() =>
        Promise.resolve(0).then(v => { countResolved = true; return v; }),
      );

      await listReports({});

      expect(findManyResolved).toBe(true);
      expect(countResolved).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  getCompletedEvents
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getCompletedEvents()', () => {
    const verifiedReport = {
      id: 'rep-1',
      hazardType: 'FLOOD',
      description: 'Flooding in Colombo',
      district: 'Colombo',
      locationLabel: 'Colombo North',
      submittedAt: new Date('2026-09-01'),
      reviewedAt: new Date('2026-09-02'),
      severityEstimate: 'WARNING',
    };

    const createdHazard = {
      id: 'hazard-1',
      type: 'FLOOD',
      description: 'Flooding in Colombo',
      severity: 'WARNING',
      location: 'Colombo North',
      district: 'Colombo',
      startTime: new Date('2026-09-01'),
      endTime: new Date('2026-09-02'),
      status: 'RESOLVED',
    };

    it('creates a hazard for each verified report without a hazardId', async () => {
      (mockPrisma.hazardReport.findMany as jest.Mock).mockResolvedValue([verifiedReport]);
      (mockPrisma.hazard.create as jest.Mock).mockResolvedValue(createdHazard);
      (mockPrisma.hazardReport.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.hazard.findMany as jest.Mock).mockResolvedValue([createdHazard]);

      await getCompletedEvents();

      expect(mockPrisma.hazard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'FLOOD', district: 'Colombo', status: 'RESOLVED' }),
        }),
      );
    });

    it('links the created hazard back to the report', async () => {
      (mockPrisma.hazardReport.findMany as jest.Mock).mockResolvedValue([verifiedReport]);
      (mockPrisma.hazard.create as jest.Mock).mockResolvedValue(createdHazard);
      (mockPrisma.hazardReport.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.hazard.findMany as jest.Mock).mockResolvedValue([createdHazard]);

      await getCompletedEvents();

      expect(mockPrisma.hazardReport.update).toHaveBeenCalledWith({
        where: { id: 'rep-1' },
        data: { hazardId: 'hazard-1' },
      });
    });

    it('returns all resolved hazards ordered by endTime desc', async () => {
      (mockPrisma.hazardReport.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.hazard.findMany as jest.Mock).mockResolvedValue([createdHazard]);

      const result = await getCompletedEvents();

      expect(mockPrisma.hazard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { endTime: 'desc' } }),
      );
      expect(result).toEqual([createdHazard]);
    });

    it('uses district as location fallback when locationLabel is null', async () => {
      (mockPrisma.hazardReport.findMany as jest.Mock).mockResolvedValue([{ ...verifiedReport, locationLabel: null }]);
      (mockPrisma.hazard.create as jest.Mock).mockResolvedValue(createdHazard);
      (mockPrisma.hazardReport.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.hazard.findMany as jest.Mock).mockResolvedValue([createdHazard]);

      await getCompletedEvents();

      expect(mockPrisma.hazard.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ location: 'Colombo' }) }),
      );
    });

    it('uses WATCH as severity fallback when severityEstimate is null', async () => {
      (mockPrisma.hazardReport.findMany as jest.Mock).mockResolvedValue([{ ...verifiedReport, severityEstimate: null }]);
      (mockPrisma.hazard.create as jest.Mock).mockResolvedValue(createdHazard);
      (mockPrisma.hazardReport.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.hazard.findMany as jest.Mock).mockResolvedValue([createdHazard]);

      await getCompletedEvents();

      expect(mockPrisma.hazard.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ severity: 'WATCH' }) }),
      );
    });

    it('does not call hazard.create when no verified reports exist', async () => {
      (mockPrisma.hazardReport.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.hazard.findMany as jest.Mock).mockResolvedValue([]);

      await getCompletedEvents();

      expect(mockPrisma.hazard.create).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  previewAnalyticsReport
  // ═══════════════════════════════════════════════════════════════════════════

  describe('previewAnalyticsReport()', () => {
    const validFilters = {
      eventId: 'event-1',
      districts: ['Colombo'],
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      categories: ['Alerts'] as any,
    };

    const mockHazard = {
      id: 'event-1',
      description: 'Test flood event',
      type: 'FLOOD',
      startTime: new Date('2026-09-01'),
      endTime: new Date('2026-09-30'),
    };

    beforeEach(() => {
      (mockPrisma.warning.findMany as jest.Mock).mockResolvedValue([
        { id: 'w-1', warningCode: 'DMC-001', hazardType: 'FLOOD', severityLevel: 'WARNING', targetDistricts: ['Colombo'], issuedTime: new Date() },
      ]);
      (mockPrisma.notificationLog.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.hazard.findFirst as jest.Mock).mockResolvedValue(mockHazard);
    });

    it('returns event, kpis, and category rows', async () => {
      const result = await previewAnalyticsReport(validFilters);
      expect(result.event).toEqual(mockHazard);
      expect(result.kpis).toBeDefined();
      expect(result.categories).toBeInstanceOf(Array);
    });

    it('throws INVALID_FILTERS when eventId is missing', async () => {
      await expect(previewAnalyticsReport({ ...validFilters, eventId: '' }))
        .rejects.toMatchObject({ code: 'INVALID_FILTERS' });
    });

    it('throws INVALID_FILTERS when districts array is empty', async () => {
      await expect(previewAnalyticsReport({ ...validFilters, districts: [] }))
        .rejects.toMatchObject({ code: 'INVALID_FILTERS' });
    });

    it('throws INVALID_DATE_RANGE when endDate is before startDate', async () => {
      await expect(previewAnalyticsReport({ ...validFilters, startDate: '2026-09-30', endDate: '2026-09-01' }))
        .rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
    });

    it('throws INVALID_DATE_RANGE when dates are equal', async () => {
      await expect(previewAnalyticsReport({ ...validFilters, startDate: '2026-09-01', endDate: '2026-09-01' }))
        .rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
    });

    it('throws INVALID_CATEGORY when an unknown category is provided', async () => {
      await expect(previewAnalyticsReport({ ...validFilters, categories: ['InvalidCat'] as any }))
        .rejects.toMatchObject({ code: 'INVALID_CATEGORY' });
    });

    it('throws EVENT_NOT_FOUND when hazard does not exist', async () => {
      (mockPrisma.hazard.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(previewAnalyticsReport(validFilters)).rejects.toMatchObject({ code: 'EVENT_NOT_FOUND' });
    });

    it('sets hasData to true when rows exist', async () => {
      const result = await previewAnalyticsReport(validFilters);
      expect(result.hasData).toBe(true);
    });

    it('sets hasData to false when no rows and all kpis are zero', async () => {
      (mockPrisma.warning.findMany as jest.Mock).mockResolvedValue([]);
      const result = await previewAnalyticsReport(validFilters);
      expect(result.hasData).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  generateAnalyticsReport
  // ═══════════════════════════════════════════════════════════════════════════

  describe('generateAnalyticsReport()', () => {
    const validFilters = {
      eventId: 'event-1',
      districts: ['Colombo'],
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      categories: ['Alerts'] as any,
    };

    const mockHazard = {
      id: 'event-1',
      description: 'Test flood',
      type: 'FLOOD',
      startTime: new Date('2026-09-01'),
      endTime: new Date('2026-09-30'),
    };

    const mockReport = {
      id: 'report-analytics-1',
      fileUrl: '/api/analytics/reports/report-analytics-1/download',
      reportTitle: 'Disaster Analysis - Test flood',
      filePath: '/tmp/test.csv',
      exportFormat: 'CSV',
    };

    beforeEach(() => {
      (mockPrisma.warning.findMany as jest.Mock).mockResolvedValue([
        { id: 'w-1', warningCode: 'DMC-001', hazardType: 'FLOOD', severityLevel: 'WARNING', targetDistricts: ['Colombo'], issuedTime: new Date() },
      ]);
      (mockPrisma.notificationLog.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.shelter.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.supplyDispatch.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.hazard.findFirst as jest.Mock).mockResolvedValue(mockHazard);
      (mockPrisma.disasterReport.create as jest.Mock).mockResolvedValue(mockReport);
      (mockPrisma.disasterReport.update as jest.Mock).mockResolvedValue(mockReport);
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.writeFileSync as jest.Mock).mockReturnValue(undefined);
      (mockPath.resolve as jest.Mock).mockReturnValue('/tmp/test.csv');
    });

    it('generates a CSV report and returns reportId and fileUrl', async () => {
      const result = await generateAnalyticsReport(validFilters, 'CSV', OFFICER_ID);
      expect(result.reportId).toBe('report-analytics-1');
      expect(result.fileUrl).toBeDefined();
    });

    it('generates a PDF report without throwing', async () => {
      await expect(generateAnalyticsReport(validFilters, 'PDF', OFFICER_ID)).resolves.toBeDefined();
    });

    it('writes a file to the upload directory', async () => {
      await generateAnalyticsReport(validFilters, 'CSV', OFFICER_ID);
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it('creates the upload directory when it does not exist', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      (mockFs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      await generateAnalyticsReport(validFilters, 'CSV', OFFICER_ID);
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('creates a disasterReport record in the database', async () => {
      await generateAnalyticsReport(validFilters, 'CSV', OFFICER_ID);
      expect(mockPrisma.disasterReport.create).toHaveBeenCalledTimes(1);
    });

    it('updates the fileUrl after creating the report', async () => {
      await generateAnalyticsReport(validFilters, 'CSV', OFFICER_ID);
      expect(mockPrisma.disasterReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockReport.id },
          data: expect.objectContaining({ fileUrl: expect.stringContaining(mockReport.id) }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  getReportFile
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getReportFile()', () => {
    it('returns the report file metadata when found', async () => {
      const mockFile = { filePath: '/uploads/report.csv', reportTitle: 'Test', exportFormat: 'CSV' };
      (mockPrisma.disasterReport.findUnique as jest.Mock).mockResolvedValue(mockFile);
      const result = await getReportFile('report-1');
      expect(result).toEqual(mockFile);
    });

    it('throws REPORT_NOT_FOUND when report does not exist', async () => {
      (mockPrisma.disasterReport.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(getReportFile('bad-id')).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
    });

    it('throws REPORT_NOT_FOUND when filePath is null', async () => {
      (mockPrisma.disasterReport.findUnique as jest.Mock).mockResolvedValue(
        { filePath: null, reportTitle: 'Test', exportFormat: 'CSV' },
      );
      await expect(getReportFile('report-1')).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  deleteAnalyticsReport
  // ═══════════════════════════════════════════════════════════════════════════

  describe('deleteAnalyticsReport()', () => {
    it('deletes the database record and returns the id', async () => {
      (mockPrisma.disasterReport.findUnique as jest.Mock).mockResolvedValue({ id: 'report-1', filePath: null });
      (mockPrisma.disasterReport.delete as jest.Mock).mockResolvedValue({});
      const result = await deleteAnalyticsReport('report-1');
      expect(mockPrisma.disasterReport.delete).toHaveBeenCalledWith({ where: { id: 'report-1' } });
      expect(result).toEqual({ id: 'report-1' });
    });

    it('throws REPORT_NOT_FOUND when the report does not exist', async () => {
      (mockPrisma.disasterReport.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(deleteAnalyticsReport('bad-id')).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
    });

    it('resolves successfully when filePath is present', async () => {
      (mockPrisma.disasterReport.findUnique as jest.Mock).mockResolvedValue({ id: 'report-1', filePath: '/uploads/report.csv' });
      (mockPrisma.disasterReport.delete as jest.Mock).mockResolvedValue({});
      await expect(deleteAnalyticsReport('report-1')).resolves.toEqual({ id: 'report-1' });
    });

    it('does not throw when filePath is null', async () => {
      (mockPrisma.disasterReport.findUnique as jest.Mock).mockResolvedValue({ id: 'report-1', filePath: null });
      (mockPrisma.disasterReport.delete as jest.Mock).mockResolvedValue({});
      await expect(deleteAnalyticsReport('report-1')).resolves.toEqual({ id: 'report-1' });
    });
  });
});
