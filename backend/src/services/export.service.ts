/**
 * @file export.service.ts
 * @description Service layer for generating and managing disaster reports.
 * Supports multiple report templates (incident summary, shelter occupancy,
 * resource allocation, and full national log), serialises the results to CSV,
 * persists the file to the local upload directory, and records the report
 * metadata in the database via Prisma.
 */

import { prisma } from '../config/database';
import * as analyticsService from './analytics.service';

/**
 * @description Converts an array of flat objects into a CSV-formatted string.
 * Column headers are derived from the keys of the first element. Values that
 * contain commas are wrapped in double-quotes. Arrays are joined with ", ".
 * Null/undefined values are serialised as empty strings.
 *
 * @param data - Array of homogeneous objects to serialise. Must be non-empty
 *   for headers to be inferred; returns an empty string for an empty array.
 * @returns A CSV string where the first line contains column headers and each
 *   subsequent line represents one row from the input array.
 */
function jsonToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => {
    const val = row[h];
    if (Array.isArray(val)) return `"${(val as unknown[]).join(', ')}"`;
    if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
    return String(val ?? '');
  }).join(','));
  return [headers.join(','), ...rows].join('\n');
}

/**
 * @description Generates a disaster report based on the specified template,
 * writes the resulting data to a CSV file on disk, and persists a
 * `DisasterReport` record in the database.
 *
 * Supported `templateId` values:
 * - `"incident_summary"` – aggregates warning counts and KPIs from the
 *   overview analytics for the given period.
 * - `"shelter_occupancy"` – lists shelter capacity and occupancy figures,
 *   optionally filtered by district.
 * - `"resource_allocation"` – lists supply inventory items from resource
 *   analytics.
 * - Any other value – produces a high-level national summary combining
 *   overview, shelter, and resource KPIs.
 *
 * The CSV file is written to the directory specified by the `UPLOAD_DIR`
 * environment variable (defaults to `./uploads`). The publicly accessible URL
 * is constructed from `BASE_URL` (defaults to `http://localhost:3000`).
 *
 * @param dto - Report generation options.
 * @param dto.templateId - Identifier for the report template to use.
 * @param dto.title - Human-readable report title stored in the database record.
 *   Falls back to `"<templateId>_<ISO date>"` when empty.
 * @param dto.districts - List of district names used to filter shelter data.
 *   Pass an empty array to include all districts.
 * @param dto.format - Intended export format (currently always written as CSV
 *   regardless of this value).
 * @param dto.period - Optional analytics time-window string (e.g. `"30d"`).
 *   Defaults to `"30d"` when omitted.
 * @param officerId - The ID of the DMC officer who is generating the report.
 *   Stored as `generatedById` on the database record.
 * @returns A promise that resolves to the newly created `DisasterReport`
 *   database record, augmented with a `fileUrl` property pointing to the
 *   generated CSV file.
 */
export async function generateReport(dto: {
  templateId: string;
  title: string;
  districts: string[];
  format: string;
  period?: string;
}, officerId: string) {
  // Gather data based on template
  let csvContent = '';
  let disasterType = 'FLOOD';

  if (dto.templateId === 'incident_summary') {
    const data = await analyticsService.getOverviewData(dto.period || '30d');
    const rows = data.warningsByHazardType.map(w => ({
      hazard_type: w.label,
      warnings_count: w.count,
      people_evacuated: data.kpis.peopleEvacuated,
      avg_response_time_minutes: data.kpis.avgResponseTimeMinutes,
    }));
    csvContent = jsonToCsv(rows);
    disasterType = (data.warningsByHazardType[0]?.type?.toUpperCase() || 'FLOOD') as typeof disasterType;
  } else if (dto.templateId === 'shelter_occupancy') {
    const data = await analyticsService.getShelterAnalytics();
    const rows = data.shelterDirectory
      .filter(s => dto.districts.length === 0 || dto.districts.includes(s.district))
      .map(s => ({ shelter_name: s.name, district: s.district, capacity: s.capacity, current_occupancy: s.currentOccupancy, occupancy_rate: `${s.capacityRate}%`, status: s.status }));
    csvContent = jsonToCsv(rows);
  } else if (dto.templateId === 'resource_allocation') {
    const data = await analyticsService.getResourceAnalytics();
    const rows = data.supplyInventory.map(s => ({ name: s.name, category: s.category, quantity: s.quantity, unit: s.unit, location: s.location }));
    csvContent = jsonToCsv(rows);
  } else {
    // Full national log: combine all
    const [overview, shelters, resources] = await Promise.all([
      analyticsService.getOverviewData(),
      analyticsService.getShelterAnalytics(),
      analyticsService.getResourceAnalytics(),
    ]);
    const rows = [{ metric: 'Total Warnings', value: overview.kpis.totalWarningsIssued }, { metric: 'Citizen Reports', value: overview.kpis.citizenReportsReceived }, { metric: 'People Evacuated', value: overview.kpis.peopleEvacuated }, { metric: 'Total Sheltered', value: shelters.kpis.totalSheltered }, { metric: 'Supply Dispatches', value: resources.kpis.totalDistributions }];
    csvContent = jsonToCsv(rows as Record<string, unknown>[]);
  }

  // Save CSV file locally
  const fs = await import('fs');
  const path = await import('path');
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const filename = `${dto.templateId}_${Date.now()}.csv`;
  const filepath = path.join(uploadDir, filename);
  
  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, csvContent);
  const fileUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/${filename}`;

  const report = await prisma.disasterReport.create({
    data: {
      reportTitle: dto.title || `${dto.templateId}_${new Date().toISOString().split('T')[0]}`,
      disasterType: disasterType as any,
      district: dto.districts.join(', ') || 'All Districts',
      period: dto.period || '30d',
      generatedById: officerId,
      exportFormat: 'CSV',
      fileUrl,
    },
  });

  return { ...report, fileUrl };
}

/**
 * @description Retrieves a paginated list of all previously generated disaster
 * reports from the database, ordered by generation date descending (most
 * recent first).
 *
 * @param params - Pagination options.
 * @param params.page - 1-based page number. Defaults to `1`.
 * @param params.limit - Maximum number of records to return per page.
 *   Defaults to `20`.
 * @returns A promise that resolves to an object containing:
 *   - `reports` – the array of `DisasterReport` records for the requested page.
 *   - `meta` – pagination metadata:
 *     - `total` – total number of reports in the database.
 *     - `page` – the current page number.
 *     - `limit` – the page size used.
 *     - `totalPages` – total number of pages given the current limit.
 */
export async function listReports(params: { page?: number; limit?: number }) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const [reports, total] = await Promise.all([
    prisma.disasterReport.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { generatedAt: 'desc' } }),
    prisma.disasterReport.count(),
  ]);
  return { reports, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}
