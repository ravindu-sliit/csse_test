import '../../config/database'; // ensure module resolution order

// ─── Module mocks (must be before any imports that pull in the mocked modules) ────

jest.mock('../../config/database', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma,
}));

jest.mock('../../utils/codeGenerator', () => ({
  generateReportCode: jest.fn().mockReturnValue('RPT-2026-COL-0001'),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────────

import { mockPrisma, resetMockPrisma } from '../mocks/prisma.mock';
import { generateReportCode } from '../../utils/codeGenerator';
import * as reportService from '../../services/report.service';
import { ReportStatus } from '@prisma/client';

// ─── Typed helpers ────────────────────────────────────────────────────────────────

const mockGenerateReportCode = generateReportCode as jest.MockedFunction<typeof generateReportCode>;

// ─── Shared fixtures ──────────────────────────────────────────────────────────────

const CITIZEN_USER_ID = 'user-citizen-1';
const OFFICER_USER_ID = 'officer-user-1';

const DB_CITIZEN = {
  id: 'citizen-uuid-1',
  userId: CITIZEN_USER_ID,
  nic: '987654321V',
  district: 'Colombo',
};

const SUBMIT_REPORT_DTO = {
  hazardType: 'FLOOD' as const,
  description: 'Heavy flooding near the river crossing, roads impassable.',
  photoUrls: ['https://example.com/photo1.jpg'],
  gpsLatitude: 6.9271,
  gpsLongitude: 79.8612,
  district: 'Colombo',
  locationLabel: 'Near Kelani River Bridge',
};

const CREATED_REPORT = {
  id: 'report-uuid-1',
  reportCode: 'RPT-2026-COL-0001',
  hazardType: 'FLOOD',
  status: ReportStatus.PENDING_VERIFICATION,
  district: 'Colombo',
  gpsLatitude: 6.9271,
  gpsLongitude: 79.8612,
  submittedAt: new Date('2026-10-16T08:00:00.000Z'),
};

const PENDING_REPORT = {
  id: 'report-uuid-1',
  reportCode: 'RPT-2026-COL-0001',
  hazardType: 'FLOOD',
  description: 'Heavy flooding near the river crossing.',
  photoUrls: ['https://example.com/photo1.jpg'],
  gpsLatitude: 6.9271,
  gpsLongitude: 79.8612,
  district: 'Colombo',
  locationLabel: 'Near Kelani River Bridge',
  citizenId: 'citizen-uuid-1',
  status: ReportStatus.PENDING_VERIFICATION,
  submittedAt: new Date('2026-10-16T08:00:00.000Z'),
  reviewedAt: null,
  verifiedById: null,
  rejectionReason: null,
  severityEstimate: null,
};

const VERIFY_REPORT_DTO = {
  severityEstimate: 'WARNING' as const,
  officerNotes: 'Confirmed via satellite imagery.',
  estimatedHouseholds: 120,
};

// ─── Setup / teardown ─────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMockPrisma();
  mockGenerateReportCode.mockReturnValue('RPT-2026-COL-0001');
});

// ─── submitReport() ───────────────────────────────────────────────────────────────

describe('submitReport()', () => {
  describe('success', () => {
    beforeEach(() => {
      mockPrisma.citizen.findUnique.mockResolvedValue(DB_CITIZEN);
      mockPrisma.hazardReport.count.mockResolvedValue(0);
      mockPrisma.hazardReport.create.mockResolvedValue(CREATED_REPORT);
    });

    it('returns the created report with expected fields', async () => {
      const result = await reportService.submitReport(SUBMIT_REPORT_DTO, CITIZEN_USER_ID);

      expect(result).toEqual(CREATED_REPORT);
    });

    it('looks up the citizen by citizenUserId', async () => {
      await reportService.submitReport(SUBMIT_REPORT_DTO, CITIZEN_USER_ID);

      expect(mockPrisma.citizen.findUnique).toHaveBeenCalledWith({
        where: { userId: CITIZEN_USER_ID },
      });
    });

    it('counts existing reports to generate a unique sequence number', async () => {
      await reportService.submitReport(SUBMIT_REPORT_DTO, CITIZEN_USER_ID);

      expect(mockPrisma.hazardReport.count).toHaveBeenCalledTimes(1);
    });

    it('generates a report code using the district and count + 1', async () => {
      mockPrisma.hazardReport.count.mockResolvedValue(5);

      await reportService.submitReport(SUBMIT_REPORT_DTO, CITIZEN_USER_ID);

      expect(mockGenerateReportCode).toHaveBeenCalledWith(SUBMIT_REPORT_DTO.district, 6);
    });

    it('creates the hazard report with correct data and citizenId', async () => {
      await reportService.submitReport(SUBMIT_REPORT_DTO, CITIZEN_USER_ID);

      expect(mockPrisma.hazardReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reportCode: 'RPT-2026-COL-0001',
            hazardType: SUBMIT_REPORT_DTO.hazardType,
            description: SUBMIT_REPORT_DTO.description,
            district: SUBMIT_REPORT_DTO.district,
            citizenId: DB_CITIZEN.id,
            status: ReportStatus.PENDING_VERIFICATION,
          }),
        }),
      );
    });

    it('sets the initial status to PENDING_VERIFICATION', async () => {
      await reportService.submitReport(SUBMIT_REPORT_DTO, CITIZEN_USER_ID);

      expect(mockPrisma.hazardReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ReportStatus.PENDING_VERIFICATION }),
        }),
      );
    });

    it('includes photoUrls and GPS coordinates in the create call', async () => {
      await reportService.submitReport(SUBMIT_REPORT_DTO, CITIZEN_USER_ID);

      expect(mockPrisma.hazardReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            photoUrls: SUBMIT_REPORT_DTO.photoUrls,
            gpsLatitude: SUBMIT_REPORT_DTO.gpsLatitude,
            gpsLongitude: SUBMIT_REPORT_DTO.gpsLongitude,
          }),
        }),
      );
    });

    it('works when photoUrls is an empty array', async () => {
      const dtoNoPhotos = { ...SUBMIT_REPORT_DTO, photoUrls: [] };
      await expect(reportService.submitReport(dtoNoPhotos, CITIZEN_USER_ID)).resolves.toEqual(CREATED_REPORT);
    });
  });

  describe('citizen not found', () => {
    it('throws NOT_FOUND with status 404 when citizen profile does not exist', async () => {
      mockPrisma.citizen.findUnique.mockResolvedValue(null);

      await expect(
        reportService.submitReport(SUBMIT_REPORT_DTO, CITIZEN_USER_ID),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('does not call hazardReport.create when citizen is missing', async () => {
      mockPrisma.citizen.findUnique.mockResolvedValue(null);

      await expect(
        reportService.submitReport(SUBMIT_REPORT_DTO, CITIZEN_USER_ID),
      ).rejects.toBeDefined();

      expect(mockPrisma.hazardReport.create).not.toHaveBeenCalled();
    });

    it('does not count existing reports when citizen is missing', async () => {
      mockPrisma.citizen.findUnique.mockResolvedValue(null);

      await expect(
        reportService.submitReport(SUBMIT_REPORT_DTO, CITIZEN_USER_ID),
      ).rejects.toBeDefined();

      expect(mockPrisma.hazardReport.count).not.toHaveBeenCalled();
    });
  });
});

// ─── listReports() ────────────────────────────────────────────────────────────────

describe('listReports()', () => {
  const REPORT_LIST = [PENDING_REPORT];

  describe('pagination', () => {
    beforeEach(() => {
      mockPrisma.hazardReport.findMany.mockResolvedValue(REPORT_LIST);
      mockPrisma.hazardReport.count.mockResolvedValue(1);
    });

    it('returns reports with pagination meta', async () => {
      const result = await reportService.listReports({});

      expect(result).toMatchObject({
        reports: REPORT_LIST,
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('defaults to page 1 and limit 20 when no params supplied', async () => {
      await reportService.listReports({});

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('calculates correct skip for page 2 with default limit', async () => {
      mockPrisma.hazardReport.count.mockResolvedValue(40);
      mockPrisma.hazardReport.findMany.mockResolvedValue([]);

      const result = await reportService.listReports({ page: 2 });

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
      expect(result.meta.page).toBe(2);
    });

    it('respects a custom limit', async () => {
      await reportService.listReports({ page: 1, limit: 5 });

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 5 }),
      );
    });

    it('computes totalPages correctly when total is not evenly divisible', async () => {
      mockPrisma.hazardReport.count.mockResolvedValue(21);

      const result = await reportService.listReports({ page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(2);
    });

    it('orders results by submittedAt descending', async () => {
      await reportService.listReports({});

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { submittedAt: 'desc' } }),
      );
    });

    it('runs findMany and count in parallel (both are called)', async () => {
      await reportService.listReports({});

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.hazardReport.count).toHaveBeenCalledTimes(1);
    });
  });

  describe('status filter', () => {
    beforeEach(() => {
      mockPrisma.hazardReport.findMany.mockResolvedValue([]);
      mockPrisma.hazardReport.count.mockResolvedValue(0);
    });

    it('filters by a single status', async () => {
      await reportService.listReports({ status: 'VERIFIED' });

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['VERIFIED'] },
          }),
        }),
      );
    });

    it('converts status to uppercase before querying', async () => {
      await reportService.listReports({ status: 'verified' });

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['VERIFIED'] },
          }),
        }),
      );
    });

    it('parses comma-separated statuses into an array', async () => {
      await reportService.listReports({ status: 'PENDING_VERIFICATION,UNDER_REVIEW' });

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['PENDING_VERIFICATION', 'UNDER_REVIEW'] },
          }),
        }),
      );
    });

    it('trims whitespace around comma-separated status values', async () => {
      await reportService.listReports({ status: ' VERIFIED , REJECTED ' });

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['VERIFIED', 'REJECTED'] },
          }),
        }),
      );
    });

    it('does not add a status filter when status param is absent', async () => {
      await reportService.listReports({});

      const call = (mockPrisma.hazardReport.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).not.toHaveProperty('status');
    });
  });

  describe('district filter', () => {
    beforeEach(() => {
      mockPrisma.hazardReport.findMany.mockResolvedValue([]);
      mockPrisma.hazardReport.count.mockResolvedValue(0);
    });

    it('filters by district when provided', async () => {
      await reportService.listReports({ district: 'Galle' });

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ district: 'Galle' }),
        }),
      );
    });

    it('does not add a district filter when district param is absent', async () => {
      await reportService.listReports({});

      const call = (mockPrisma.hazardReport.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).not.toHaveProperty('district');
    });
  });

  describe('hazardType filter', () => {
    beforeEach(() => {
      mockPrisma.hazardReport.findMany.mockResolvedValue([]);
      mockPrisma.hazardReport.count.mockResolvedValue(0);
    });

    it('filters by hazardType and converts it to uppercase', async () => {
      await reportService.listReports({ hazardType: 'flood' });

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ hazardType: 'FLOOD' }),
        }),
      );
    });

    it('does not add a hazardType filter when hazardType param is absent', async () => {
      await reportService.listReports({});

      const call = (mockPrisma.hazardReport.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).not.toHaveProperty('hazardType');
    });
  });

  describe('combined filters', () => {
    it('applies status, district, and hazardType filters together', async () => {
      mockPrisma.hazardReport.findMany.mockResolvedValue([]);
      mockPrisma.hazardReport.count.mockResolvedValue(0);

      await reportService.listReports({
        status: 'PENDING_VERIFICATION',
        district: 'Kandy',
        hazardType: 'LANDSLIDE',
      });

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: ['PENDING_VERIFICATION'] },
            district: 'Kandy',
            hazardType: 'LANDSLIDE',
          },
        }),
      );
    });
  });
});

// ─── getReportById() ──────────────────────────────────────────────────────────────

describe('getReportById()', () => {
  const FULL_REPORT = {
    ...PENDING_REPORT,
    citizen: {
      id: 'citizen-uuid-1',
      user: { name: 'Jane Doe', phoneNumber: '0771234567', email: 'jane@example.com' },
    },
    verifiedBy: null,
  };

  describe('found cases', () => {
    beforeEach(() => {
      mockPrisma.hazardReport.findFirst.mockResolvedValue(FULL_REPORT);
    });

    it('returns the report when found by id', async () => {
      const result = await reportService.getReportById('report-uuid-1');

      expect(result).toEqual(FULL_REPORT);
    });

    it('returns the report when found by reportCode', async () => {
      const result = await reportService.getReportById('RPT-2026-COL-0001');

      expect(result).toEqual(FULL_REPORT);
    });

    it('uses an OR query to match both id and reportCode', async () => {
      const identifier = 'report-uuid-1';
      await reportService.getReportById(identifier);

      expect(mockPrisma.hazardReport.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ id: identifier }, { reportCode: identifier }],
          },
        }),
      );
    });

    it('includes citizen user details in the result', async () => {
      const result = await reportService.getReportById('report-uuid-1');

      expect(result?.citizen?.user).toMatchObject({
        name: 'Jane Doe',
        email: 'jane@example.com',
      });
    });
  });

  describe('not found', () => {
    it('returns null when no report matches the given id or reportCode', async () => {
      mockPrisma.hazardReport.findFirst.mockResolvedValue(null);

      const result = await reportService.getReportById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('calls findFirst exactly once', async () => {
      mockPrisma.hazardReport.findFirst.mockResolvedValue(null);

      await reportService.getReportById('nonexistent-id');

      expect(mockPrisma.hazardReport.findFirst).toHaveBeenCalledTimes(1);
    });
  });
});

// ─── getMyReports() ───────────────────────────────────────────────────────────────

describe('getMyReports()', () => {
  const MY_REPORTS = [
    {
      id: 'report-uuid-1',
      reportCode: 'RPT-2026-COL-0001',
      hazardType: 'FLOOD',
      status: ReportStatus.PENDING_VERIFICATION,
      district: 'Colombo',
      submittedAt: new Date('2026-10-16T08:00:00.000Z'),
      reviewedAt: null,
    },
    {
      id: 'report-uuid-2',
      reportCode: 'RPT-2026-COL-0002',
      hazardType: 'LANDSLIDE',
      status: ReportStatus.VERIFIED,
      district: 'Colombo',
      submittedAt: new Date('2026-10-15T10:00:00.000Z'),
      reviewedAt: new Date('2026-10-16T07:00:00.000Z'),
    },
  ];

  describe('citizen has reports', () => {
    beforeEach(() => {
      mockPrisma.citizen.findUnique.mockResolvedValue(DB_CITIZEN);
      mockPrisma.hazardReport.findMany.mockResolvedValue(MY_REPORTS);
    });

    it('returns the list of reports for the citizen', async () => {
      const result = await reportService.getMyReports(CITIZEN_USER_ID);

      expect(result).toEqual(MY_REPORTS);
    });

    it('looks up the citizen by userId', async () => {
      await reportService.getMyReports(CITIZEN_USER_ID);

      expect(mockPrisma.citizen.findUnique).toHaveBeenCalledWith({
        where: { userId: CITIZEN_USER_ID },
      });
    });

    it('queries reports filtered by the citizen id', async () => {
      await reportService.getMyReports(CITIZEN_USER_ID);

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { citizenId: DB_CITIZEN.id },
        }),
      );
    });

    it('orders results by submittedAt descending', async () => {
      await reportService.getMyReports(CITIZEN_USER_ID);

      expect(mockPrisma.hazardReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { submittedAt: 'desc' } }),
      );
    });

    it('returns an empty array when the citizen has no reports', async () => {
      mockPrisma.hazardReport.findMany.mockResolvedValue([]);

      const result = await reportService.getMyReports(CITIZEN_USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe('no citizen profile', () => {
    it('returns an empty array when no citizen profile exists for the userId', async () => {
      mockPrisma.citizen.findUnique.mockResolvedValue(null);

      const result = await reportService.getMyReports(CITIZEN_USER_ID);

      expect(result).toEqual([]);
    });

    it('does not query hazardReport when citizen is not found', async () => {
      mockPrisma.citizen.findUnique.mockResolvedValue(null);

      await reportService.getMyReports(CITIZEN_USER_ID);

      expect(mockPrisma.hazardReport.findMany).not.toHaveBeenCalled();
    });
  });
});

// ─── verifyReport() ───────────────────────────────────────────────────────────────

describe('verifyReport()', () => {
  const UPDATED_REPORT = {
    ...PENDING_REPORT,
    status: ReportStatus.VERIFIED,
    severityEstimate: 'WARNING',
    verifiedById: OFFICER_USER_ID,
    reviewedAt: expect.any(Date),
  };

  describe('success', () => {
    beforeEach(() => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue(PENDING_REPORT);
      mockPrisma.hazardReport.update.mockResolvedValue(UPDATED_REPORT);
    });

    it('returns the updated report with VERIFIED status', async () => {
      const result = await reportService.verifyReport('report-uuid-1', VERIFY_REPORT_DTO, OFFICER_USER_ID);

      expect(result).toMatchObject({ status: ReportStatus.VERIFIED });
    });

    it('updates the report status to VERIFIED', async () => {
      await reportService.verifyReport('report-uuid-1', VERIFY_REPORT_DTO, OFFICER_USER_ID);

      expect(mockPrisma.hazardReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'report-uuid-1' },
          data: expect.objectContaining({ status: ReportStatus.VERIFIED }),
        }),
      );
    });

    it('stores the severityEstimate from the DTO', async () => {
      await reportService.verifyReport('report-uuid-1', VERIFY_REPORT_DTO, OFFICER_USER_ID);

      expect(mockPrisma.hazardReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            severityEstimate: VERIFY_REPORT_DTO.severityEstimate,
          }),
        }),
      );
    });

    it('records the verifiedById (officer) and a reviewedAt timestamp', async () => {
      await reportService.verifyReport('report-uuid-1', VERIFY_REPORT_DTO, OFFICER_USER_ID);

      expect(mockPrisma.hazardReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verifiedById: OFFICER_USER_ID,
            reviewedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('looks up the report by id before updating', async () => {
      await reportService.verifyReport('report-uuid-1', VERIFY_REPORT_DTO, OFFICER_USER_ID);

      expect(mockPrisma.hazardReport.findUnique).toHaveBeenCalledWith({
        where: { id: 'report-uuid-1' },
      });
    });

    it('works when VerifyReportDto fields are all optional and omitted', async () => {
      const emptyDto = {};
      await expect(
        reportService.verifyReport('report-uuid-1', emptyDto, OFFICER_USER_ID),
      ).resolves.toBeDefined();
    });

    it('allows verifying an UNDER_REVIEW report', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue({
        ...PENDING_REPORT,
        status: ReportStatus.UNDER_REVIEW,
      });

      await expect(
        reportService.verifyReport('report-uuid-1', VERIFY_REPORT_DTO, OFFICER_USER_ID),
      ).resolves.toBeDefined();
    });
  });

  describe('not found', () => {
    it('throws NOT_FOUND with status 404 when report does not exist', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue(null);

      await expect(
        reportService.verifyReport('nonexistent-id', VERIFY_REPORT_DTO, OFFICER_USER_ID),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    });

    it('does not call update when the report is not found', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue(null);

      await expect(
        reportService.verifyReport('nonexistent-id', VERIFY_REPORT_DTO, OFFICER_USER_ID),
      ).rejects.toBeDefined();

      expect(mockPrisma.hazardReport.update).not.toHaveBeenCalled();
    });
  });

  describe('already reviewed', () => {
    it('throws REPORT_ALREADY_REVIEWED with status 409 when status is VERIFIED', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue({
        ...PENDING_REPORT,
        status: ReportStatus.VERIFIED,
      });

      await expect(
        reportService.verifyReport('report-uuid-1', VERIFY_REPORT_DTO, OFFICER_USER_ID),
      ).rejects.toMatchObject({ code: 'REPORT_ALREADY_REVIEWED', status: 409 });
    });

    it('throws REPORT_ALREADY_REVIEWED with status 409 when status is REJECTED', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue({
        ...PENDING_REPORT,
        status: ReportStatus.REJECTED,
      });

      await expect(
        reportService.verifyReport('report-uuid-1', VERIFY_REPORT_DTO, OFFICER_USER_ID),
      ).rejects.toMatchObject({ code: 'REPORT_ALREADY_REVIEWED', status: 409 });
    });

    it('does not call update when report has already been reviewed', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue({
        ...PENDING_REPORT,
        status: ReportStatus.VERIFIED,
      });

      await expect(
        reportService.verifyReport('report-uuid-1', VERIFY_REPORT_DTO, OFFICER_USER_ID),
      ).rejects.toBeDefined();

      expect(mockPrisma.hazardReport.update).not.toHaveBeenCalled();
    });
  });
});

// ─── rejectReport() ───────────────────────────────────────────────────────────────

describe('rejectReport()', () => {
  const REJECTION_REASON = 'Duplicate report — already logged under RPT-2026-COL-0001.';

  const REJECTED_REPORT = {
    ...PENDING_REPORT,
    status: ReportStatus.REJECTED,
    rejectionReason: REJECTION_REASON,
    verifiedById: OFFICER_USER_ID,
    reviewedAt: expect.any(Date),
  };

  describe('success with reason', () => {
    beforeEach(() => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue(PENDING_REPORT);
      mockPrisma.hazardReport.update.mockResolvedValue(REJECTED_REPORT);
    });

    it('returns the updated report with REJECTED status', async () => {
      const result = await reportService.rejectReport('report-uuid-1', REJECTION_REASON, OFFICER_USER_ID);

      expect(result).toMatchObject({ status: ReportStatus.REJECTED });
    });

    it('sets the status to REJECTED', async () => {
      await reportService.rejectReport('report-uuid-1', REJECTION_REASON, OFFICER_USER_ID);

      expect(mockPrisma.hazardReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ReportStatus.REJECTED }),
        }),
      );
    });

    it('stores the rejectionReason in the update payload', async () => {
      await reportService.rejectReport('report-uuid-1', REJECTION_REASON, OFFICER_USER_ID);

      expect(mockPrisma.hazardReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rejectionReason: REJECTION_REASON }),
        }),
      );
    });

    it('records the verifiedById and a reviewedAt timestamp', async () => {
      await reportService.rejectReport('report-uuid-1', REJECTION_REASON, OFFICER_USER_ID);

      expect(mockPrisma.hazardReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verifiedById: OFFICER_USER_ID,
            reviewedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('accepts an undefined rejectionReason (optional field)', async () => {
      mockPrisma.hazardReport.update.mockResolvedValue({
        ...REJECTED_REPORT,
        rejectionReason: undefined,
      });

      await expect(
        reportService.rejectReport('report-uuid-1', undefined, OFFICER_USER_ID),
      ).resolves.toBeDefined();

      expect(mockPrisma.hazardReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rejectionReason: undefined }),
        }),
      );
    });

    it('can reject an UNDER_REVIEW report', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue({
        ...PENDING_REPORT,
        status: ReportStatus.UNDER_REVIEW,
      });

      await expect(
        reportService.rejectReport('report-uuid-1', REJECTION_REASON, OFFICER_USER_ID),
      ).resolves.toBeDefined();
    });
  });

  describe('not found', () => {
    it('throws NOT_FOUND with status 404 when the report does not exist', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue(null);

      await expect(
        reportService.rejectReport('nonexistent-id', REJECTION_REASON, OFFICER_USER_ID),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    });

    it('does not call update when the report is not found', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue(null);

      await expect(
        reportService.rejectReport('nonexistent-id', REJECTION_REASON, OFFICER_USER_ID),
      ).rejects.toBeDefined();

      expect(mockPrisma.hazardReport.update).not.toHaveBeenCalled();
    });
  });

  describe('already reviewed', () => {
    it('throws REPORT_ALREADY_REVIEWED with status 409 when status is VERIFIED', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue({
        ...PENDING_REPORT,
        status: ReportStatus.VERIFIED,
      });

      await expect(
        reportService.rejectReport('report-uuid-1', REJECTION_REASON, OFFICER_USER_ID),
      ).rejects.toMatchObject({ code: 'REPORT_ALREADY_REVIEWED', status: 409 });
    });

    it('throws REPORT_ALREADY_REVIEWED with status 409 when status is REJECTED', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue({
        ...PENDING_REPORT,
        status: ReportStatus.REJECTED,
      });

      await expect(
        reportService.rejectReport('report-uuid-1', REJECTION_REASON, OFFICER_USER_ID),
      ).rejects.toMatchObject({ code: 'REPORT_ALREADY_REVIEWED', status: 409 });
    });

    it('does not call update when report has already been reviewed', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue({
        ...PENDING_REPORT,
        status: ReportStatus.REJECTED,
      });

      await expect(
        reportService.rejectReport('report-uuid-1', REJECTION_REASON, OFFICER_USER_ID),
      ).rejects.toBeDefined();

      expect(mockPrisma.hazardReport.update).not.toHaveBeenCalled();
    });
  });
});

// ─── markUnderReview() ────────────────────────────────────────────────────────────

describe('markUnderReview()', () => {
  const UNDER_REVIEW_REPORT = {
    ...PENDING_REPORT,
    status: ReportStatus.UNDER_REVIEW,
  };

  describe('status change from PENDING_VERIFICATION', () => {
    beforeEach(() => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue(PENDING_REPORT);
      mockPrisma.hazardReport.update.mockResolvedValue(UNDER_REVIEW_REPORT);
    });

    it('returns the updated report with UNDER_REVIEW status', async () => {
      const result = await reportService.markUnderReview('report-uuid-1');

      expect(result).toMatchObject({ status: ReportStatus.UNDER_REVIEW });
    });

    it('updates the status to UNDER_REVIEW', async () => {
      await reportService.markUnderReview('report-uuid-1');

      expect(mockPrisma.hazardReport.update).toHaveBeenCalledWith({
        where: { id: 'report-uuid-1' },
        data: { status: ReportStatus.UNDER_REVIEW },
      });
    });

    it('looks up the report by id before updating', async () => {
      await reportService.markUnderReview('report-uuid-1');

      expect(mockPrisma.hazardReport.findUnique).toHaveBeenCalledWith({
        where: { id: 'report-uuid-1' },
      });
    });
  });

  describe('skip if not PENDING_VERIFICATION', () => {
    it('returns undefined and does not update when report is not found', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue(null);

      const result = await reportService.markUnderReview('nonexistent-id');

      expect(result).toBeUndefined();
      expect(mockPrisma.hazardReport.update).not.toHaveBeenCalled();
    });

    it('returns undefined and does not update when status is UNDER_REVIEW', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue(UNDER_REVIEW_REPORT);

      const result = await reportService.markUnderReview('report-uuid-1');

      expect(result).toBeUndefined();
      expect(mockPrisma.hazardReport.update).not.toHaveBeenCalled();
    });

    it('returns undefined and does not update when status is VERIFIED', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue({
        ...PENDING_REPORT,
        status: ReportStatus.VERIFIED,
      });

      const result = await reportService.markUnderReview('report-uuid-1');

      expect(result).toBeUndefined();
      expect(mockPrisma.hazardReport.update).not.toHaveBeenCalled();
    });

    it('returns undefined and does not update when status is REJECTED', async () => {
      mockPrisma.hazardReport.findUnique.mockResolvedValue({
        ...PENDING_REPORT,
        status: ReportStatus.REJECTED,
      });

      const result = await reportService.markUnderReview('report-uuid-1');

      expect(result).toBeUndefined();
      expect(mockPrisma.hazardReport.update).not.toHaveBeenCalled();
    });
  });
});
