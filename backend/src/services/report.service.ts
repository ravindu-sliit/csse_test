/**
 * @file report.service.ts
 * @description Service layer for hazard report lifecycle management.
 *
 * Handles all business logic related to citizen-submitted hazard reports,
 * including creation, retrieval, pagination/filtering, and status transitions
 * (verification, rejection, and marking under review). All database access
 * goes through the shared Prisma client.
 *
 * @module services/report
 */

import { prisma } from '../config/database';
import { SubmitReportDto, VerifyReportDto } from '../schemas/report.schema';
import { generateReportCode } from '../utils/codeGenerator';
import { ReportStatus } from '@prisma/client';

/**
 * @description Creates a new hazard report on behalf of an authenticated citizen.
 *
 * Looks up the citizen profile associated with the given user ID, generates a
 * sequential district-scoped report code, then persists the report with an
 * initial status of `PENDING_VERIFICATION`.
 *
 * @param {SubmitReportDto} dto - Validated payload containing hazard type,
 *   description, optional photo URLs, GPS coordinates, district, and an
 *   optional human-readable location label.
 * @param {string} citizenUserId - The `User.id` of the authenticated citizen
 *   submitting the report.
 * @returns {Promise<Pick<HazardReport, 'id' | 'reportCode' | 'hazardType' | 'status' | 'district' | 'gpsLatitude' | 'gpsLongitude' | 'submittedAt'>>}
 *   A partial view of the newly created hazard report.
 * @throws {{ code: 'NOT_FOUND', message: string, status: 404 }}
 *   When no citizen profile exists for the provided `citizenUserId`.
 */
export async function submitReport(dto: SubmitReportDto, citizenUserId: string) {
  // Get citizen profile
  const citizen = await prisma.citizen.findUnique({ where: { userId: citizenUserId } });
  if (!citizen) throw { code: 'NOT_FOUND', message: 'Citizen profile not found. Please complete registration.', status: 404 };

  const count = await prisma.hazardReport.count();
  const reportCode = generateReportCode(dto.district, count + 1);

  return prisma.hazardReport.create({
    data: {
      reportCode,
      hazardType: dto.hazardType as any,
      description: dto.description,
      photoUrls: dto.photoUrls,
      gpsLatitude: dto.gpsLatitude,
      gpsLongitude: dto.gpsLongitude,
      district: dto.district,
      locationLabel: dto.locationLabel,
      citizenId: citizen.id,
      status: ReportStatus.PENDING_VERIFICATION,
    },
    select: {
      id: true, reportCode: true, hazardType: true, status: true, district: true,
      gpsLatitude: true, gpsLongitude: true, submittedAt: true,
    },
  });
}

/**
 * @description Retrieves a paginated, optionally filtered list of hazard reports.
 *
 * Supports filtering by one or more comma-separated statuses, district, and
 * hazard type. Results are ordered by submission date descending and include
 * the submitting citizen's contact details and the reviewing officer's identity.
 *
 * @param {object} params - Query parameters for filtering and pagination.
 * @param {string} [params.status] - Comma-separated list of report statuses to
 *   include (e.g. `"PENDING_VERIFICATION,UNDER_REVIEW"`). Case-insensitive.
 * @param {string} [params.district] - Exact district name to filter by.
 * @param {string} [params.hazardType] - Hazard type to filter by. Case-insensitive.
 * @param {number} [params.page=1] - 1-based page number.
 * @param {number} [params.limit=20] - Maximum number of records per page.
 * @returns {Promise<{ reports: HazardReport[], meta: { total: number, page: number, limit: number, totalPages: number } }>}
 *   The matching reports for the requested page together with pagination metadata.
 */
export async function listReports(params: {
  status?: string;
  district?: string;
  hazardType?: string;
  page?: number;
  limit?: number;
}) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (params.status) {
    const statuses = params.status.split(',').map(s => s.trim().toUpperCase());
    where.status = { in: statuses };
  }
  if (params.district) where.district = params.district;
  if (params.hazardType) where.hazardType = params.hazardType.toUpperCase();

  const [reports, total] = await Promise.all([
    prisma.hazardReport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { submittedAt: 'desc' },
      include: {
        citizen: { include: { user: { select: { name: true, phoneNumber: true } } } },
        verifiedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.hazardReport.count({ where }),
  ]);

  return { reports, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

/**
 * @description Fetches a single hazard report by its UUID or its human-readable
 * report code.
 *
 * The lookup is performed with an `OR` condition, so both `id` and `reportCode`
 * are tried against the provided `id` argument. Returns `null` when no matching
 * record is found.
 *
 * @param {string} id - Either the UUID (`HazardReport.id`) or the report code
 *   (e.g. `"RPT-COL-00042"`) of the report to retrieve.
 * @returns {Promise<HazardReport | null>} The full report including citizen
 *   contact details (name, phone, email) and reviewing officer information,
 *   or `null` if no report matches.
 */
export async function getReportById(id: string) {
  return prisma.hazardReport.findFirst({
    where: { OR: [{ id }, { reportCode: id }] },
    include: {
      citizen: { include: { user: { select: { name: true, phoneNumber: true, email: true } } } },
      verifiedBy: { select: { id: true, name: true } },
    },
  });
}

/**
 * @description Retrieves all hazard reports submitted by a specific citizen,
 * ordered by submission date descending.
 *
 * Silently returns an empty array when no citizen profile is associated with
 * the given user ID, rather than throwing an error. This simplifies the caller
 * for scenarios where profile setup is not yet complete.
 *
 * @param {string} citizenUserId - The `User.id` of the authenticated citizen
 *   whose reports should be listed.
 * @returns {Promise<Pick<HazardReport, 'id' | 'reportCode' | 'hazardType' | 'status' | 'district' | 'submittedAt' | 'reviewedAt'>[]>}
 *   An array of partial report records, or an empty array if the citizen
 *   profile does not exist.
 */
export async function getMyReports(citizenUserId: string) {
  const citizen = await prisma.citizen.findUnique({ where: { userId: citizenUserId } });
  if (!citizen) return [];
  return prisma.hazardReport.findMany({
    where: { citizenId: citizen.id },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, reportCode: true, hazardType: true, status: true, district: true, submittedAt: true, reviewedAt: true },
  });
}

/**
 * @description Marks a hazard report as `VERIFIED` and records the reviewing
 * officer's severity estimate.
 *
 * Only reports that have not already been reviewed (i.e. not currently
 * `VERIFIED` or `REJECTED`) may be verified. The reviewing officer's ID and
 * the review timestamp are recorded automatically.
 *
 * @param {string} id - UUID of the hazard report to verify.
 * @param {VerifyReportDto} dto - Validated payload containing the officer's
 *   `severityEstimate` for the hazard.
 * @param {string} officerId - The `User.id` of the DMC officer performing the
 *   verification.
 * @returns {Promise<HazardReport>} The updated hazard report record.
 * @throws {{ code: 'NOT_FOUND', message: string, status: 404 }}
 *   When no report with the given `id` exists.
 * @throws {{ code: 'REPORT_ALREADY_REVIEWED', message: string, status: 409 }}
 *   When the report has already been verified or rejected.
 */
export async function verifyReport(id: string, dto: VerifyReportDto, officerId: string) {
  const report = await prisma.hazardReport.findUnique({ where: { id } });
  if (!report) throw { code: 'NOT_FOUND', message: 'Report not found', status: 404 };
  if (report.status === ReportStatus.VERIFIED || report.status === ReportStatus.REJECTED) {
    throw { code: 'REPORT_ALREADY_REVIEWED', message: 'This report has already been reviewed', status: 409 };
  }
  const reviewedAt = new Date();
  const hazard = await prisma.hazard.create({
    data: {
      type: report.hazardType,
      description: report.description,
      severity: dto.severityEstimate || 'WATCH',
      location: report.locationLabel || report.district,
      district: report.district,
      startTime: report.submittedAt,
      endTime: reviewedAt,
      status: 'RESOLVED',
    },
  });

  return prisma.hazardReport.update({
    where: { id },
    data: {
      status: ReportStatus.VERIFIED,
      severityEstimate: dto.severityEstimate as any,
      verifiedById: officerId,
      reviewedAt,
      hazardId: hazard?.id,
    },
  });
}

/**
 * @description Marks a hazard report as `REJECTED` and optionally records a
 * rejection reason provided by the reviewing officer.
 *
 * Only reports that have not already been reviewed (i.e. not currently
 * `VERIFIED` or `REJECTED`) may be rejected. The reviewing officer's ID and
 * the review timestamp are recorded automatically.
 *
 * @param {string} id - UUID of the hazard report to reject.
 * @param {string | undefined} rejectionReason - Optional human-readable
 *   explanation for why the report is being rejected.
 * @param {string} officerId - The `User.id` of the DMC officer performing the
 *   rejection.
 * @returns {Promise<HazardReport>} The updated hazard report record.
 * @throws {{ code: 'NOT_FOUND', message: string, status: 404 }}
 *   When no report with the given `id` exists.
 * @throws {{ code: 'REPORT_ALREADY_REVIEWED', message: string, status: 409 }}
 *   When the report has already been verified or rejected.
 */
export async function rejectReport(id: string, rejectionReason: string | undefined, officerId: string) {
  const report = await prisma.hazardReport.findUnique({ where: { id } });
  if (!report) throw { code: 'NOT_FOUND', message: 'Report not found', status: 404 };
  if (report.status === ReportStatus.VERIFIED || report.status === ReportStatus.REJECTED) {
    throw { code: 'REPORT_ALREADY_REVIEWED', message: 'This report has already been reviewed', status: 409 };
  }
  return prisma.hazardReport.update({
    where: { id },
    data: {
      status: ReportStatus.REJECTED,
      rejectionReason,
      verifiedById: officerId,
      reviewedAt: new Date(),
    },
  });
}

/**
 * @description Transitions a hazard report from `PENDING_VERIFICATION` to
 * `UNDER_REVIEW`, signalling that a DMC officer has begun assessing it.
 *
 * This is a no-op if the report does not exist or is not currently in the
 * `PENDING_VERIFICATION` state, preventing accidental status regressions.
 *
 * @param {string} id - UUID of the hazard report to mark as under review.
 * @returns {Promise<HazardReport | undefined>} The updated report if the
 *   transition was applied, or `undefined` if the report was not found or was
 *   already past the `PENDING_VERIFICATION` state.
 */
export async function markUnderReview(id: string) {
  const report = await prisma.hazardReport.findUnique({ where: { id } });
  if (!report || report.status !== ReportStatus.PENDING_VERIFICATION) return;
  return prisma.hazardReport.update({
    where: { id },
    data: { status: ReportStatus.UNDER_REVIEW },
  });
}
