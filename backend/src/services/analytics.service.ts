/**
 * @file analytics.service.ts
 * @description Service layer for the disaster management analytics dashboard.
 *
 * Provides aggregated data for key performance indicators (KPIs), shelter
 * utilisation, resource/supply dispatching, and alert timelines. All queries
 * are scoped to a configurable rolling time window (e.g. "30d", "7d") and are
 * executed against the shared Prisma client.
 *
 * @solid
 * - SRP: This service ONLY handles analytics aggregation and metrics calculation.
 *        Data persistence is handled by respective domain services.
 * - OCP: New metric types can be added without modifying existing aggregation logic.
 * - DIP: Depends on Prisma abstraction for data access.
 *
 * @module services/analytics
 */

import { prisma } from '../config/database';

/**
 * Converts a period string such as "30d" or "7d" into a concrete {@link Date}
 * representing the start of that rolling window relative to the current time.
 *
 * @param {string} [period='30d'] - Rolling window expressed as a number
 *   followed by the letter "d" (days). Defaults to 30 days when the value
 *   cannot be parsed.
 * @returns {Date} The date/time at the beginning of the requested period.
 */
function getPeriodStart(period: string = '30d'): Date {
  const now = new Date();
  const days = parseInt(period.replace('d', '')) || 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Retrieves a comprehensive overview of disaster management activity for the
 * specified time period.
 *
 * @description
 * Aggregates data from multiple Prisma models in parallel and assembles a
 * single overview object that covers:
 * - **KPIs** – total warnings issued, citizen reports, verification rate,
 *   people evacuated, affected districts, average response time, and shelter
 *   utilisation.
 * - **Warnings by hazard type** – counts grouped by `HazardType` enum value
 *   within the period.
 * - **Verification breakdown** – counts of reports split into approved,
 *   rejected, and pending states.
 * - **High-risk zones** – districts that have at least one active warning,
 *   annotated with the highest severity level found ("severe", "high", or
 *   "medium").
 * - **Citizen reports trend** – daily report submission counts for the last 14
 *   calendar days (independent of the `period` parameter).
 *
 * @param {string} [period='30d'] - Rolling time window for most aggregations,
 *   expressed as a number of days followed by "d" (e.g. `"7d"`, `"30d"`).
 * @returns {Promise<{
 *   kpis: {
 *     totalWarningsIssued: number;
 *     warningsThisMonth: number;
 *     citizenReportsReceived: number;
 *     verificationRate: number;
 *     peopleEvacuated: number;
 *     districtsAffected: number;
 *     avgResponseTimeMinutes: number;
 *     activeShelters: number;
 *     shelterCapacityPercent: number;
 *   };
 *   warningsByHazardType: Array<{ type: string; label: string; count: number }>;
 *   verificationBreakdown: { approved: number; rejected: number; pending: number };
 *   highRiskZones: Array<{ district: string; level: string }>;
 *   citizenReportsTrend: Array<{ date: string; count: number }>;
 * }>} Aggregated overview data ready for dashboard consumption.
 */
export async function getOverviewData(period: string = '30d') {
  const periodStart = getPeriodStart(period);

  const [totalWarnings, warningsThisMonth, reportsData, evacuatedData, avgResponseData, shelterData] = await Promise.all([
    prisma.warning.count(),
    prisma.warning.count({ where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
    prisma.hazardReport.groupBy({ by: ['status'], _count: { id: true }, where: { submittedAt: { gte: periodStart } } }),
    prisma.hazardReport.count({ where: { submittedAt: { gte: periodStart } } }),
    prisma.hazardReport.findMany({ where: { status: 'VERIFIED', reviewedAt: { not: null }, submittedAt: { gte: periodStart } }, select: { submittedAt: true, reviewedAt: true } }),
    prisma.shelter.findMany({ where: { status: { in: ['OPEN', 'FULL'] } }, select: { capacity: true, currentOccupancy: true } }),
  ]);

  const totalReports = reportsData.reduce((s, r) => s + r._count.id, 0);
  const verifiedReports = reportsData.find(r => r.status === 'VERIFIED')?._count.id || 0;
  const avgResponseTimeMs = avgResponseData.length > 0
    ? avgResponseData.reduce((sum, r) => sum + (r.reviewedAt!.getTime() - r.submittedAt.getTime()), 0) / avgResponseData.length
    : 0;
  const avgResponseMinutes = Math.round(avgResponseTimeMs / 60000);

  const totalShelterCapacity = shelterData.reduce((s, sh) => s + sh.capacity, 0);
  const totalShelterOccupancy = shelterData.reduce((s, sh) => s + sh.currentOccupancy, 0);
  const capacityPercent = totalShelterCapacity > 0 ? Math.round((totalShelterOccupancy / totalShelterCapacity) * 100) : 0;

  // Warnings by hazard type
  const warningsByType = await prisma.warning.groupBy({
    by: ['hazardType'],
    _count: { id: true },
    where: { createdAt: { gte: periodStart } },
    orderBy: { _count: { id: 'desc' } },
  });

  // Citizen reports trend (last 14 days)
  const trend: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const count = await prisma.hazardReport.count({ where: { submittedAt: { gte: dayStart, lt: dayEnd } } });
    trend.push({ date: dayStart.toISOString().split('T')[0], count });
  }

  // High risk zones (districts with active warnings)
  const activeWarnings = await prisma.warning.findMany({ where: { status: 'ACTIVE' }, select: { targetDistricts: true, severityLevel: true } });
  const districtRiskMap: Record<string, string> = {};
  activeWarnings.forEach(w => {
    w.targetDistricts.forEach(d => {
      const existing = districtRiskMap[d];
      const level = w.severityLevel === 'EMERGENCY' ? 'severe' : w.severityLevel === 'WARNING' ? 'high' : 'medium';
      if (!existing || (level === 'severe') || (level === 'high' && existing === 'medium')) districtRiskMap[d] = level;
    });
  });
  const highRiskZones = Object.entries(districtRiskMap).map(([district, level]) => ({ district, level }));

  return {
    kpis: {
      totalWarningsIssued: totalWarnings,
      warningsThisMonth,
      citizenReportsReceived: totalReports,
      verificationRate: totalReports > 0 ? Math.round((verifiedReports / totalReports) * 100) / 100 : 0,
      peopleEvacuated: totalShelterOccupancy,
      districtsAffected: highRiskZones.length,
      avgResponseTimeMinutes: avgResponseMinutes,
      activeShelters: shelterData.length,
      shelterCapacityPercent: capacityPercent,
    },
    warningsByHazardType: warningsByType.map(w => ({ type: w.hazardType.toLowerCase(), label: w.hazardType.charAt(0) + w.hazardType.slice(1).toLowerCase().replace('_', ' '), count: w._count.id })),
    verificationBreakdown: {
      approved: reportsData.find(r => r.status === 'VERIFIED')?._count.id || 0,
      rejected: reportsData.find(r => r.status === 'REJECTED')?._count.id || 0,
      pending: reportsData.filter(r => ['PENDING_VERIFICATION', 'UNDER_REVIEW'].includes(r.status)).reduce((s, r) => s + r._count.id, 0),
    },
    highRiskZones,
    citizenReportsTrend: trend,
  };
}

/**
 * Retrieves analytics data for all designated shelters including occupancy
 * rates and recent occupancy log entries.
 *
 * @description
 * Fetches every shelter record ordered alphabetically by name and attaches the
 * five most recent occupancy log entries to each. The returned object contains:
 * - **KPIs** – total number of people currently sheltered, count of active
 *   (non-closed) shelters, and the total number of designated shelters in the
 *   system.
 * - **Shelter directory** – per-shelter details including capacity, current
 *   occupancy, capacity utilisation rate (as a percentage), district, and
 *   operational status.
 *
 * @param {string} [period='30d'] - Reserved for future use. Currently accepted
 *   for API consistency but not applied to the shelter queries.
 * @returns {Promise<{
 *   kpis: {
 *     totalSheltered: number;
 *     activeSheltersCount: number;
 *     totalDesignatedShelters: number;
 *   };
 *   shelterDirectory: Array<{
 *     id: string;
 *     name: string;
 *     district: string;
 *     capacityRate: number;
 *     capacity: number;
 *     currentOccupancy: number;
 *     status: string;
 *   }>;
 * }>} Shelter analytics data ready for dashboard consumption.
 */
export async function getShelterAnalytics(period: string = '30d') {
  const shelters = await prisma.shelter.findMany({
    orderBy: { name: 'asc' },
    include: { occupancyLogs: { orderBy: { updatedAt: 'desc' }, take: 5 } },
  });
  const totalSheltered = shelters.reduce((s, sh) => s + sh.currentOccupancy, 0);
  const active = shelters.filter(sh => sh.status !== 'CLOSED').length;
  return {
    kpis: { totalSheltered, activeSheltersCount: active, totalDesignatedShelters: shelters.length },
    shelterDirectory: shelters.map(sh => ({
      id: sh.id,
      name: sh.name,
      district: sh.district,
      capacityRate: sh.capacity > 0 ? Math.round((sh.currentOccupancy / sh.capacity) * 100) : 0,
      capacity: sh.capacity,
      currentOccupancy: sh.currentOccupancy,
      status: sh.status,
    })),
  };
}

/**
 * Retrieves analytics data for relief supply dispatches and current inventory
 * levels within the specified time period.
 *
 * @description
 * Runs two parallel queries – one for supply dispatches within the rolling
 * window and one for the full current inventory – then assembles:
 * - **KPIs** – total number of dispatch transactions, total units dispatched
 *   across all transactions, and the count of distinct destination locations
 *   that received deliveries.
 * - **Category breakdown** – percentage share of total dispatched units grouped
 *   by supply category (e.g. "FOOD", "MEDICAL").
 * - **Supply inventory** – flat list of all relief supply records with
 *   quantities and storage locations.
 *
 * @param {string} [period='30d'] - Rolling time window used to filter dispatch
 *   records, expressed as a number of days followed by "d" (e.g. `"7d"`).
 * @returns {Promise<{
 *   kpis: {
 *     totalDistributions: number;
 *     totalUnitsDispatched: number;
 *     districtsWithDeliveries: number;
 *   };
 *   categoryBreakdown: Array<{ category: string; percentage: number }>;
 *   supplyInventory: Array<{
 *     id: string;
 *     name: string;
 *     category: string;
 *     quantity: number;
 *     unit: string;
 *     location: string;
 *   }>;
 * }>} Resource analytics data ready for dashboard consumption.
 */
export async function getResourceAnalytics(period: string = '30d') {
  const periodStart = getPeriodStart(period);
  const [dispatches, supplies] = await Promise.all([
    prisma.supplyDispatch.findMany({ where: { dispatchedAt: { gte: periodStart } }, include: { supply: { select: { category: true, unit: true } } } }),
    prisma.reliefSupply.findMany(),
  ]);

  const totalDistributions = dispatches.length;
  const totalUnits = dispatches.reduce((s, d) => s + d.quantity, 0);

  const categoryCount: Record<string, number> = {};
  dispatches.forEach(d => {
    const cat = d.supply?.category || 'Other';
    categoryCount[cat] = (categoryCount[cat] || 0) + d.quantity;
  });
  const totalCatUnits = Object.values(categoryCount).reduce((s, v) => s + v, 0);
  const categoryBreakdown = Object.entries(categoryCount).map(([cat, qty]) => ({
    category: cat,
    percentage: totalCatUnits > 0 ? Math.round((qty / totalCatUnits) * 100) : 0,
  }));

  return {
    kpis: { totalDistributions, totalUnitsDispatched: totalUnits, districtsWithDeliveries: new Set(dispatches.map(d => d.destinationLabel)).size },
    categoryBreakdown,
    supplyInventory: supplies.map(s => ({ id: s.id, name: s.name, category: s.category, quantity: s.quantity, unit: s.unit, location: s.location })),
  };
}

/**
 * Retrieves a chronological timeline of disaster warnings issued within the
 * specified period, enriched with notification channel delivery statistics.
 *
 * @description
 * Fetches all warnings whose `issuedTime` falls within the rolling window,
 * ordered from most recent to oldest. Each entry in the returned array
 * includes the full warning metadata plus a `channels` array that describes
 * how many recipients were targeted and successfully reached via each
 * notification channel (e.g. SMS, email, push).
 *
 * The `reachRate` for each channel is expressed as a whole-number percentage
 * (`deliveredCount / recipientCount * 100`), clamped to 0 when there are no
 * recipients.
 *
 * @param {string} [period='7d'] - Rolling time window for the timeline,
 *   expressed as a number of days followed by "d". Defaults to 7 days.
 * @returns {Promise<Array<{
 *   id: string;
 *   warningCode: string;
 *   hazardType: string;
 *   severityLevel: string;
 *   targetDistricts: string[];
 *   issuedTime: Date;
 *   status: string;
 *   channels: Array<{
 *     channel: string;
 *     recipientCount: number;
 *     deliveredCount: number;
 *     reachRate: number;
 *   }>;
 * }>>} Ordered list of warning timeline entries with per-channel reach data.
 */
export async function getAlertTimeline(period: string = '7d') {
  const periodStart = getPeriodStart(period);
  const warnings = await prisma.warning.findMany({
    where: { issuedTime: { gte: periodStart } },
    orderBy: { issuedTime: 'desc' },
    include: { notificationLogs: true },
  });

  return warnings.map(w => ({
    id: w.id,
    warningCode: w.warningCode,
    hazardType: w.hazardType,
    severityLevel: w.severityLevel,
    targetDistricts: w.targetDistricts,
    issuedTime: w.issuedTime,
    status: w.status,
    channels: w.notificationLogs.map(log => ({
      channel: log.channel,
      recipientCount: log.recipientCount,
      deliveredCount: log.deliveredCount,
      reachRate: log.recipientCount > 0 ? Math.round((log.deliveredCount / log.recipientCount) * 100) : 0,
    })),
  }));
}
