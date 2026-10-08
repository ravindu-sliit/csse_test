/**
 * @file warning.service.ts
 * @description Service layer for disaster warning management. Handles the full lifecycle of
 * early-warning events: creation, broadcast simulation, status queries, escalation, and
 * cancellation. Also exposes an aggregated dashboard summary used by the DMC officer UI.
 *
 * All database access goes through the Prisma client configured in `../config/database`.
 * Broadcast side-effects are delegated to `notification.service`.
 *
 * @solid
 * - SRP: This service ONLY handles warning lifecycle (create, list, get, cancel, escalate).
 *        Broadcast logic is delegated to notification.service.ts.
 * - OCP: New hazard types can be added to HazardType enum without modifying this service.
 * - LSP: All errors thrown follow the same { code, message, status } structure.
 * - ISP: Functions accept focused DTOs (CreateWarningDto, not a generic object).
 * - DIP: Depends on prisma abstraction from config, not direct @prisma/client import.
 */

import { prisma } from '../config/database';
import { CreateWarningDto } from '../schemas/warning.schema';
import { generateWarningCode } from '../utils/codeGenerator';
import { simulateBroadcast, calculateTotalReach } from './notification.service';
import { WarningStatus } from '@prisma/client';

/**
 * @description Creates a new disaster warning record, assigns it a unique warning code,
 * persists it to the database with `ACTIVE` status, and immediately triggers a broadcast
 * simulation across the requested channels. Returns the saved warning together with per-
 * channel broadcast results and the estimated total citizen reach.
 *
 * @param {CreateWarningDto} dto - Validated payload describing the warning to be issued.
 *   Includes hazard type, severity level, message, target districts/river basin, optional
 *   expiry time, optional hazard reference ID, and the list of broadcast channels.
 * @param {string} officerId - ID of the authenticated DMC officer issuing the warning.
 *
 * @returns {Promise<{
 *   warning: import('@prisma/client').Warning & { issuedBy: { id: string; name: string } };
 *   broadcastResults: Awaited<ReturnType<typeof simulateBroadcast>>;
 *   estimatedReach: number;
 * }>} An object containing the newly created warning (with issuing officer details),
 * the broadcast simulation results, and the total estimated citizen reach.
 */
export async function createAndBroadcast(dto: CreateWarningDto, officerId: string) {
  // Generate warning code
  const warningCount = await prisma.warning.count();
  const warningCode = generateWarningCode(dto.hazardType, warningCount + 1);

  const warning = await prisma.warning.create({
    data: {
      warningCode,
      hazardType: dto.hazardType as any,
      severityLevel: dto.severityLevel as any,
      message: dto.message,
      targetDistricts: dto.targetDistricts,
      targetRiverBasin: dto.targetRiverBasin,
      issuedById: officerId,
      hazardId: dto.hazardId,
      expiryTime: dto.expiryTime ? new Date(dto.expiryTime) : undefined,
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationLabel: dto.locationLabel,
      sourceReportId: dto.sourceReportId,
      status: WarningStatus.ACTIVE,
    },
    include: {
      issuedBy: { select: { id: true, name: true } },
    },
  });

  // Simulate broadcast
  const broadcastResults = await simulateBroadcast(warning.id, dto.broadcastChannels, dto.targetDistricts);
  const estimatedReach = calculateTotalReach(dto.broadcastChannels, dto.targetDistricts);

  return { warning, broadcastResults, estimatedReach };
}

/**
 * @description Returns a paginated, optionally-filtered list of warnings ordered by issue
 * time (most recent first). Supports filtering by warning status, target district, and
 * hazard type. All string filters are normalised to uppercase before querying.
 *
 * @param {object} params - Pagination and filter options.
 * @param {number} [params.page=1] - 1-based page number.
 * @param {number} [params.limit=20] - Maximum number of records per page.
 * @param {string} [params.status] - Filter by warning status (e.g. `"ACTIVE"`, `"EXPIRED"`).
 *   Case-insensitive; converted to uppercase internally.
 * @param {string} [params.district] - Filter to warnings that target this district. Uses a
 *   Prisma `has` (array-contains) check on `targetDistricts`.
 * @param {string} [params.hazardType] - Filter by hazard type (e.g. `"FLOOD"`, `"CYCLONE"`).
 *   Case-insensitive; converted to uppercase internally.
 *
 * @returns {Promise<{
 *   warnings: (import('@prisma/client').Warning & { issuedBy: { id: string; name: string } })[];
 *   meta: { total: number; page: number; limit: number; totalPages: number };
 * }>} Paginated warning records alongside metadata for client-side pagination controls.
 */
export async function listWarnings(params: {
  page?: number;
  limit?: number;
  status?: string;
  district?: string;
  hazardType?: string;
}) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status.toUpperCase();
  if (params.district) where.targetDistricts = { has: params.district };
  if (params.hazardType) where.hazardType = params.hazardType.toUpperCase();

  const [warnings, total] = await Promise.all([
    prisma.warning.findMany({
      where,
      skip,
      take: limit,
      orderBy: { issuedTime: 'desc' },
      include: { issuedBy: { select: { id: true, name: true } } },
    }),
    prisma.warning.count({ where }),
  ]);

  return { warnings, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

/**
 * @description Fetches a single warning by its primary key, including the issuing officer's
 * details, all associated broadcast channel records, and the full notification delivery log.
 *
 * @param {string} id - UUID of the warning to retrieve.
 *
 * @returns {Promise<
 *   (import('@prisma/client').Warning & {
 *     issuedBy: { id: string; name: string };
 *     broadcastChannels: import('@prisma/client').BroadcastChannel[];
 *     notificationLogs: import('@prisma/client').NotificationLog[];
 *   }) | null
 * >} The fully-hydrated warning record, or `null` if no record with the given ID exists.
 */
export async function getWarningById(id: string) {
  return prisma.warning.findUnique({
    where: { id },
    include: {
      issuedBy: { select: { id: true, name: true } },
      broadcastChannels: true,
      notificationLogs: true,
    },
  });
}

/**
 * @description Aggregates per-channel delivery metrics for a warning and returns a
 * structured broadcast status report. Computes confirmed deliveries, failures, and a
 * progress percentage for each channel from the notification logs.
 *
 * @param {string} warningId - UUID of the warning whose broadcast status is requested.
 *
 * @returns {Promise<{
 *   warningId: string;
 *   warningCode: string;
 *   status: import('@prisma/client').WarningStatus;
 *   channels: {
 *     channel: string;
 *     status: string;
 *     confirmedReach: number | null;
 *     failedCount: number | null;
 *     estimatedReach: number | null;
 *     progressPercent: number;
 *   }[];
 *   totalTargetCitizens: number;
 *   totalConfirmedDeliveries: number;
 *   totalFailed: number;
 * } | null>} Broadcast status object, or `null` if the warning does not exist.
 */
export async function getBroadcastStatus(warningId: string) {
  const warning = await prisma.warning.findUnique({
    where: { id: warningId },
    include: { broadcastChannels: true, notificationLogs: true },
  });
  if (!warning) return null;

  const totalConfirmed = warning.notificationLogs.reduce((s, l) => s + l.deliveredCount, 0);
  const totalFailed = warning.notificationLogs.reduce((s, l) => s + l.failedCount, 0);
  const totalTarget = warning.notificationLogs.reduce((s, l) => s + l.recipientCount, 0);

  return {
    warningId: warning.id,
    warningCode: warning.warningCode,
    status: warning.status,
    channels: warning.broadcastChannels.map((bc) => ({
      channel: bc.channel,
      status: bc.status,
      confirmedReach: bc.confirmedReach,
      failedCount: bc.failedCount,
      estimatedReach: bc.estimatedReach,
      progressPercent: bc.estimatedReach
        ? Math.round(((bc.confirmedReach || 0) / bc.estimatedReach) * 100)
        : 0,
    })),
    totalTargetCitizens: totalTarget,
    totalConfirmedDeliveries: totalConfirmed,
    totalFailed,
  };
}

/**
 * @description Cancels an active warning by updating its status to `CANCELLED`. An optional
 * cancellation reason may be supplied for audit purposes (stored at the call-site or in a
 * future audit-log extension). Throws a structured error object if the warning does not
 * exist or has already been cancelled.
 *
 * @param {string} id - UUID of the warning to cancel.
 * @param {string} [reason] - Optional human-readable explanation for the cancellation.
 *
 * @returns {Promise<import('@prisma/client').Warning>} The updated warning record with
 * `status` set to `CANCELLED`.
 *
 * @throws {{ code: 'NOT_FOUND', message: string, status: 404 }}
 *   When no warning with the given `id` exists in the database.
 * @throws {{ code: 'WARNING_ALREADY_CANCELLED', message: string, status: 409 }}
 *   When the warning's current status is already `CANCELLED`.
 */
export async function cancelWarning(id: string, reason?: string) {
  const warning = await prisma.warning.findUnique({ where: { id } });
  if (!warning) throw { code: 'NOT_FOUND', message: 'Warning not found', status: 404 };
  if (warning.status === WarningStatus.CANCELLED) {
    throw { code: 'WARNING_ALREADY_CANCELLED', message: 'Warning is already cancelled', status: 409 };
  }
  return prisma.warning.update({
    where: { id },
    data: { status: WarningStatus.CANCELLED },
  });
}

/**
 * @description Upgrades (or downgrades) the severity level of an existing warning. Intended
 * for use when a hazard situation intensifies and a higher alert level must be communicated
 * to the public without reissuing an entirely new warning.
 *
 * @param {string} id - UUID of the warning to escalate.
 * @param {string} newSeverityLevel - New severity value to apply (e.g. `"HIGH"`, `"EXTREME"`).
 *   Must be a valid member of the `SeverityLevel` enum defined in the Prisma schema.
 *
 * @returns {Promise<import('@prisma/client').Warning>} The updated warning record reflecting
 * the new severity level.
 */
export async function escalateWarning(id: string, newSeverityLevel: string) {
  return prisma.warning.update({
    where: { id },
    data: { severityLevel: newSeverityLevel as any },
  });
}

/**
 * @description Gathers four key operational metrics in parallel and returns them as a
 * single dashboard summary object. Used by the DMC officer home screen to provide an
 * at-a-glance overview of the current disaster management situation.
 *
 * Metrics collected:
 * - **activeWarnings** – Warnings with status `ACTIVE`.
 * - **pendingReports** – Hazard reports awaiting verification or under review.
 * - **openShelters** – Shelters that are open or currently full.
 * - **deployedTeams** – Rescue teams that are dispatched, en route, or on mission.
 *
 * @returns {Promise<{
 *   activeWarnings: number;
 *   pendingReports: number;
 *   openShelters: number;
 *   deployedTeams: number;
 * }>} Aggregated dashboard counts fetched in parallel via `Promise.all`.
 */
export async function getDashboardSummary() {
  const [activeWarnings, pendingReports, openShelters, deployedTeams] = await Promise.all([
    prisma.warning.count({ where: { status: 'ACTIVE' } }),
    prisma.hazardReport.count({ where: { status: { in: ['PENDING_VERIFICATION', 'UNDER_REVIEW'] } } }),
    prisma.shelter.count({ where: { status: { in: ['OPEN', 'FULL'] } } }),
    prisma.rescueTeam.count({ where: { status: { in: ['DISPATCHED', 'EN_ROUTE', 'ON_MISSION'] } } }),
  ]);
  return { activeWarnings, pendingReports, openShelters, deployedTeams };
}
