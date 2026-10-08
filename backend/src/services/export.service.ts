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
import { ReportExportFormat } from '@prisma/client';

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
    prisma.disasterReport.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { generatedAt: 'desc' },
      include: { hazard: { select: { id: true, description: true, type: true, startTime: true, endTime: true } } },
    }),
    prisma.disasterReport.count(),
  ]);
  return { reports, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export const REPORT_CATEGORIES = ['Alerts', 'Citizens Reached', 'Shelter Occupancy', 'Resource Distribution'] as const;
export type ReportCategory = typeof REPORT_CATEGORIES[number];

export interface AnalyticsReportFilters {
  eventId: string;
  districts: string[];
  startDate: string;
  endDate: string;
  categories: ReportCategory[];
}

async function getReportData(filters: AnalyticsReportFilters) {
  const startDate = new Date(filters.startDate);
  const endDate = new Date(filters.endDate);
  if (!filters.eventId || !Array.isArray(filters.districts) || filters.districts.length === 0) {
    throw Object.assign(new Error('Event and at least one district are required'), { code: 'INVALID_FILTERS', status: 400 });
  }
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    throw Object.assign(new Error('End date must be after start date'), { code: 'INVALID_DATE_RANGE', status: 400 });
  }
  if (!Array.isArray(filters.categories) || filters.categories.some(category => !REPORT_CATEGORIES.includes(category))) {
    throw Object.assign(new Error('Invalid report category'), { code: 'INVALID_CATEGORY', status: 400 });
  }
  const districtFilter = filters.districts.length > 0 ? { in: filters.districts } : undefined;
  const warningWhere = {
    hazardId: filters.eventId,
    issuedTime: { gte: startDate, lte: endDate },
    ...(districtFilter ? { targetDistricts: { hasSome: filters.districts } } : {}),
  };
  const [event, warnings, notifications, shelters, dispatches] = await Promise.all([
    prisma.hazard.findFirst({ where: { id: filters.eventId, status: 'RESOLVED', endTime: { not: null } }, select: { id: true, description: true, type: true, startTime: true, endTime: true } }),
    filters.categories.includes('Alerts')
      ? prisma.warning.findMany({ where: warningWhere, select: { id: true, warningCode: true, hazardType: true, severityLevel: true, targetDistricts: true, issuedTime: true } })
      : Promise.resolve([]),
    filters.categories.includes('Citizens Reached')
      ? prisma.notificationLog.findMany({ where: { warning: warningWhere }, select: { recipientCount: true, deliveredCount: true } })
      : Promise.resolve([]),
    filters.categories.includes('Shelter Occupancy')
      ? prisma.shelter.findMany({ where: { district: districtFilter }, select: { name: true, district: true, currentOccupancy: true, capacity: true } })
      : Promise.resolve([]),
    filters.categories.includes('Resource Distribution')
      ? prisma.supplyDispatch.findMany({
        where: { dispatchedAt: { gte: startDate, lte: endDate }, ...(districtFilter ? { shelter: { district: districtFilter } } : {}) },
        select: { dispatchCode: true, destinationLabel: true, quantity: true, unit: true, dispatchedAt: true },
      })
      : Promise.resolve([]),
  ]);

  if (!event) throw Object.assign(new Error('Completed hazard event not found'), { code: 'EVENT_NOT_FOUND', status: 404 });
  const citizensReached = notifications.reduce((sum, item) => sum + (item.deliveredCount || item.recipientCount), 0);
  const peopleSheltered = shelters.reduce((sum, item) => sum + item.currentOccupancy, 0);
  const resourcesDispatched = dispatches.reduce((sum, item) => sum + item.quantity, 0);
  const kpis = {
    totalWarnings: warnings.length,
    citizensReached,
    peopleSheltered,
    resourcesDispatched,
  };
  const rows = [
    ...warnings.map(item => ({ category: 'Alerts', metric: item.warningCode, value: `${item.severityLevel} ${item.targetDistricts.join('; ')}` })),
    ...(filters.categories.includes('Citizens Reached') ? [{ category: 'Citizens Reached', metric: 'Citizens reached', value: String(citizensReached) }] : []),
    ...shelters.map(item => ({ category: 'Shelter Occupancy', metric: item.name, value: `${item.currentOccupancy}/${item.capacity} (${item.district})` })),
    ...dispatches.map(item => ({ category: 'Resource Distribution', metric: item.dispatchCode, value: `${item.quantity} ${item.unit} to ${item.destinationLabel}` })),
  ];
  return { event, kpis, rows, warnings, shelters, dispatches };
}

export async function getCompletedEvents() {
  const approvedReports = await prisma.hazardReport.findMany({
    where: { status: 'VERIFIED', hazardId: null },
    select: {
      id: true,
      hazardType: true,
      description: true,
      district: true,
      locationLabel: true,
      submittedAt: true,
      reviewedAt: true,
      severityEstimate: true,
    },
  });

  for (const report of approvedReports) {
    const hazard = await prisma.hazard.create({
      data: {
        type: report.hazardType,
        description: report.description,
        severity: report.severityEstimate || 'WATCH',
        location: report.locationLabel || report.district,
        district: report.district,
        startTime: report.submittedAt,
        endTime: report.reviewedAt || new Date(),
        status: 'RESOLVED',
      },
    });
    await prisma.hazardReport.update({
      where: { id: report.id },
      data: { hazardId: hazard.id },
    });
  }

  return prisma.hazard.findMany({
    where: { status: 'RESOLVED', endTime: { not: null } },
    orderBy: { endTime: 'desc' },
    select: { id: true, description: true, type: true, startTime: true, endTime: true },
  });
}

export async function previewAnalyticsReport(filters: AnalyticsReportFilters) {
  const data = await getReportData(filters);
  return {
    event: data.event,
    filters,
    kpis: data.kpis,
    categories: filters.categories.map(category => ({
      category,
      rows: data.rows.filter(row => row.category === category),
    })),
    hasData: data.rows.length > 0 || Object.values(data.kpis).some(value => value > 0),
  };
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function createProfessionalPdf(
  title: string,
  generatedAtLabel: string,
  event: { description: string; type: string },
  filters: AnalyticsReportFilters,
  kpis: { totalWarnings: number; citizensReached: number; peopleSheltered: number; resourcesDispatched: number },
  rows: { category: string; metric: string; value: string }[],
) {
  const commands: string[] = [];
  const addText = (font: string, size: number, x: number, y: number, text: string, colour = '0.12 0.18 0.25') => {
    commands.push(`BT /${font} ${size} Tf ${colour} rg ${x} ${y} Td (${escapePdfText(text.slice(0, 105))}) Tj ET`);
  };
  const addLine = (x1: number, y1: number, x2: number, y2: number, colour = '0.82 0.86 0.90') => {
    commands.push(`${colour} RG 0.7 w ${x1} ${y1} m ${x2} ${y2} l S`);
  };
  const addBox = (x: number, y: number, width: number, height: number, fill: string, stroke = '0.85 0.88 0.92') => {
    commands.push(`${fill} rg ${stroke} RG 0.7 w ${x} ${y} ${width} ${height} re B`);
  };

  commands.push('0.08 0.20 0.38 rg 0 695 612 97 re f');
  addText('F2', 22, 42, 752, 'DMC SRI LANKA', '1 1 1');
  addText('F1', 10, 42, 730, 'DISASTER MANAGEMENT CENTRE', '0.78 0.88 0.96');
  addText('F2', 15, 42, 665, 'Disaster Analysis Report', '0.08 0.20 0.38');
  addText('F1', 9, 42, 646, event.description, '0.30 0.36 0.43');
  addLine(42, 632, 570, 632, '0.15 0.42 0.70');

  addText('F2', 9, 42, 608, 'REPORT INFORMATION', '0.08 0.20 0.38');
  addText('F1', 9, 42, 590, `Event type: ${event.type}`);
  addText('F1', 9, 310, 590, `Generated: ${generatedAtLabel}`);
  addText('F1', 9, 42, 574, `Date range: ${filters.startDate} to ${filters.endDate}`);
  addText('F1', 9, 310, 574, `Format: ${filters.categories.join(', ')}`);
  addText('F1', 9, 42, 558, `Districts: ${filters.districts.join(', ')}`);
  addLine(42, 542, 570, 542);

  addText('F2', 9, 42, 520, 'EXECUTIVE SUMMARY', '0.08 0.20 0.38');
  const kpiCards = [
    ['TOTAL WARNINGS', kpis.totalWarnings.toLocaleString()],
    ['CITIZENS REACHED', kpis.citizensReached.toLocaleString()],
    ['PEOPLE SHELTERED', kpis.peopleSheltered.toLocaleString()],
    ['RESOURCES DISPATCHED', kpis.resourcesDispatched.toLocaleString()],
  ];
  kpiCards.forEach(([label, value], index) => {
    const x = 42 + index * 132;
    addBox(x, 468, 120, 38, '0.95 0.97 0.99');
    addText('F2', 14, x + 10, 485, value, '0.08 0.20 0.38');
    addText('F1', 6.5, x + 10, 475, label, '0.35 0.42 0.50');
  });

  let y = 438;
  addText('F2', 9, 42, y, 'ANALYTICAL DETAILS', '0.08 0.20 0.38');
  y -= 18;
  const categories = [...new Set(rows.map(row => row.category))];
  categories.forEach(category => {
    if (y < 85) return;
    addBox(42, y - 5, 528, 19, '0.91 0.95 0.98', '0.78 0.84 0.90');
    addText('F2', 8.5, 52, y + 1, category.toUpperCase(), '0.08 0.20 0.38');
    y -= 24;
    const categoryRows = rows.filter(row => row.category === category);
    categoryRows.slice(0, 12).forEach(row => {
      if (y < 65) return;
      addText('F1', 8, 56, y, row.metric);
      addText('F1', 8, 330, y, row.value, '0.30 0.36 0.43');
      addLine(52, y - 5, 560, y - 5, '0.91 0.93 0.95');
      y -= 16;
    });
    y -= 7;
  });
  addLine(42, 48, 570, 48);
  addText('F1', 7, 42, 32, 'Generated by the DMC Disaster Analytics System', '0.40 0.46 0.52');
  addText('F1', 7, 474, 32, 'Page 1 of 1', '0.40 0.46 0.52');
  const stream = ['q', ...commands, 'Q'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = pdf.length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

export async function generateAnalyticsReport(filters: AnalyticsReportFilters, format: 'CSV' | 'PDF', officerId: string) {
  const data = await getReportData(filters);
  const fs = await import('fs');
  const path = await import('path');
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const generatedAt = new Date();
  const generatedAtLabel = generatedAt.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Colombo',
  });
  const extension = format.toLowerCase();
  const filename = `analytics_${data.event.id}_${generatedAt.toISOString().replace(/[:.]/g, '-')}.${extension}`;
  const filePath = path.resolve(uploadDir, filename);
  const reportRows = [
    { category: 'Report Metadata', metric: 'Generated at', value: generatedAtLabel },
    ...data.rows,
  ];
  const content = format === 'CSV'
    ? Buffer.from(jsonToCsv(reportRows as Record<string, unknown>[]), 'utf8')
    : createProfessionalPdf(
      'Disaster Analysis Report',
      generatedAtLabel,
      data.event,
      filters,
      data.kpis,
      data.rows,
    );
  fs.writeFileSync(filePath, content);
  const report = await prisma.disasterReport.create({
    data: {
      reportTitle: `Disaster Analysis - ${data.event.description}`,
      disasterType: data.event.type,
      district: filters.districts.join(', '),
      period: `${filters.startDate} to ${filters.endDate}`,
      generatedById: officerId,
      exportFormat: format === 'CSV' ? ReportExportFormat.CSV : ReportExportFormat.PDF,
      fileUrl: `/api/analytics/reports/FILE_ID/download`,
      filePath,
      categories: filters.categories,
      hazardId: data.event.id,
      citizensReached: data.kpis.citizensReached,
      shelterOccupancyPeak: data.kpis.peopleSheltered,
      resourceDistributed: data.kpis.resourcesDispatched,
    },
  });
  const fileUrl = `/api/analytics/reports/${report.id}/download`;
  const updated = await prisma.disasterReport.update({ where: { id: report.id }, data: { fileUrl } });
  return { reportId: updated.id, fileUrl: updated.fileUrl, report: updated };
}

export async function getReportFile(id: string) {
  const report = await prisma.disasterReport.findUnique({ where: { id }, select: { filePath: true, reportTitle: true, exportFormat: true } });
  if (!report || !report.filePath) throw Object.assign(new Error('Report file not found'), { code: 'REPORT_NOT_FOUND', status: 404 });
  return report;
}

export async function deleteAnalyticsReport(id: string) {
  const report = await prisma.disasterReport.findUnique({
    where: { id },
    select: { id: true, filePath: true },
  });
  if (!report) throw Object.assign(new Error('Report not found'), { code: 'REPORT_NOT_FOUND', status: 404 });

  if (report.filePath) {
    const fs = await import('fs/promises');
    await fs.rm(report.filePath, { force: true });
  }
  await prisma.disasterReport.delete({ where: { id } });
  return { id: report.id };
}
