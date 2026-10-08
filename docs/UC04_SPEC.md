# UC04 SPEC — Analyse Disaster Response & Generate Reports
## Smart Disaster Early-Warning and Emergency Coordination System
### Group 060 | Member: Pathirana P D R S (IT23843752)

---

## 1. Use Case Summary

| Field | Value |
|---|---|
| Use Case ID | UC04 |
| Name | Analyse Disaster Response & Generate Reports |
| Primary Actor | DMC Officer |
| Secondary Actors | NGO / Donor Organisation (consumes exported reports) |
| Goal | After (or during) a disaster event, the DMC Officer views analytics dashboards covering warning effectiveness, citizen report verification rates, shelter occupancy trends, and resource distribution. The officer generates and exports a downloadable statistical report. |
| Preconditions | User authenticated with role `dmc_officer`. Historical data exists in the system (warnings, reports, shelters, dispatches) from previous or ongoing events. |
| Postconditions | Officer has reviewed statistical data. A `DisasterReport` record is created. A downloadable file (PDF/Excel/CSV) is generated and stored. Officer can share/export the file. |
| Trigger | A disaster response cycle ends, or a ministerial audit report is requested, or the officer wants to review live response effectiveness |

---

## 2. Main Flow — Analyse & Generate Report (Happy Path)

| Step | Actor | Action | System Response |
|---|---|---|---|
| 1 | DMC Officer | Navigates to Analytics section in the Officer Portal | Disaster Analytics Dashboard loads |
| 2 | System | Displays KPI summary cards and visualizations | KPIs: Total Warnings Issued, Citizen Reports Received (% verified), People Evacuated (districts affected), Avg Response Time, Active Shelters (capacity %). Also shows: Warnings by Hazard Type bar chart, Verification Rate donut chart, Incident Density Heatmap, Citizen Reports Trend (30 days bar chart) |
| 3 | DMC Officer | Navigates to "Shelters" in the analytics sidebar | Shelter Utilization & Capacity Audit page loads |
| 4 | System | Shows shelter-specific analytics | KPIs: Peak Occupancy Rate, Average Citizen Stay (days), Total Sheltered, Active Shelters Running. Stacked bar chart: Occupancy Over Time by District. Capacity vs Actual Usage table. Designated Safe House Directory table. |
| 5 | DMC Officer | Navigates to "Resources" in analytics sidebar | Supply Chain & Resource Metrics page loads |
| 6 | System | Shows resource analytics | KPIs: Total Distribution Operations, Ration Items Dispatched, Districts Fully Covered, Mean Emergency Delivery time. National Supply Distribution Map. Distribution Category Breakdown (Food/Water/Medicine/Shelter Kits %). Priority warehouse stock levels. |
| 7 | DMC Officer | Navigates to "Alert Timeline" | Historical Alert Timeline Logs page loads |
| 8 | System | Shows chronological warning audit | Filter bar (All Hazards / Red Warnings / Last 7 Days). Summary panel: total warnings, avg reach rate, fastest dispatch. Per-warning expandable cards with per-channel delivery metrics. |
| 9 | DMC Officer | Navigates to "Report Builder" | Automated Report Builder page loads |
| 10 | DMC Officer | Selects a report template (e.g., "Incident Summary Report") | Template description shown on the right. Document preview panel shows placeholder. |
| 11 | DMC Officer | Configures scope: selects districts (checkboxes) and output format (PDF/Excel/CSV) | Preview updates with selected scope. |
| 12 | DMC Officer | Clicks "Generate Document /" | System calls analytics service to aggregate data. Generates file. Stores to Cloudinary. Creates `DisasterReport` record. |
| 13 | System | Returns download URL. Shows in Recent Export Logs. | Officer sees the generated file in the "Recent Export Logs" table with download link. |
| 14 | DMC Officer | Clicks "Download" | File downloads to officer's browser |

---

## 3. Alternative Flows

### A1 — Schedule Recurring Briefing
- At Step 12, officer clicks "Schedule briefing" instead of "Generate Document"
- Officer sets a recurrence (daily/weekly) and target email
- System creates a scheduled task record
- At the scheduled time, the system auto-generates and emails the report
- **Note**: Email delivery uses Nodemailer with Gmail SMTP. Actual scheduling can use `node-cron`.

### A2 — Export Already Generated Report
- Officer navigates to Report Builder
- Finds a previously generated report in "Recent Export Logs"
- Clicks "Download" to re-download (file URL still valid from Cloudinary)
- No re-generation needed

### A3 — Filter by Specific Event/Period
- On the Analytics Dashboard, officer uses a filter (if implemented): "Select Disaster Event" or "Select Period"
- All charts and KPIs update to show data scoped to that event/period
- This is implemented as query parameters on the analytics API endpoints

---

## 4. Exception Flows

### E1 — No Data Available for Selected Scope
- Trigger: Officer selects a district with no historical records
- System returns an empty state UI: "No data available for selected district and period"
- Chart components render with empty state illustrations
- Report generation is blocked: "Not enough data to generate this report"

### E2 — Report Generation Timeout
- Trigger: Report generation takes more than 30 seconds (large dataset)
- System shows a loading spinner with progress indicator
- If timeout occurs, returns 504 error
- Officer can retry or select a smaller scope
- For the uni project: this is unlikely with seed data volumes

### E3 — File Storage Error (Cloudinary)
- Trigger: Cloudinary upload fails after report generation
- System saves the report data in `DisasterReport` table but `fileUrl` is `null`
- Error toast: "Report generated but could not be saved to cloud. Please try downloading again."
- Officer can retry download generation

---

## 5. Report Templates

### Template 1: Incident Summary Report
**Description**: "Brief of warning dispatch and reach"
**Sections:**
- Event header (disaster type, districts, date range)
- Total warnings issued + breakdown by severity
- Citizen reach metrics (SMS, Push, TV/Radio coverage %)
- Verified vs rejected hazard reports count
- Response timeline

### Template 2: Resource Allocation Audit
**Description**: "Warehouses dispatched and inventory logs"
**Sections:**
- Supply inventory opening/closing stock
- All supply dispatch records (TX-XXXX logs)
- Per-district distribution table
- Category breakdown (Food/Water/Medicine/Shelter Kits)
- Warehouse utilization percentages

### Template 3: Safe Camps Occupancy Report
**Description**: "Detailed capacity ratios per Safe House"
**Sections:**
- All shelters with peak occupancy dates
- Average stay duration per shelter
- Capacity vs actual usage charts
- Amenities availability per shelter
- Total people sheltered count

### Template 4: Full National Disaster Log
**Description**: "Combined analytical report for ministerial audit"
**Sections:**
- All of the above templates combined
- Executive summary with key performance indicators
- Chronological event timeline
- Recommendations section (static text placeholder)

---

## 6. UI Pages & Components (UC04)

### Analytics Portal Navigation
- Analytics portal uses a **separate sidebar** from the coordination portal:
  - Dashboard (with "NEW" badge)
  - Alert Timeline (with "NEW" badge)
  - Shelters
  - Resources
  - Report Builder

### Page 1: Disaster Analytics Dashboard (`/officer/analytics/dashboard`)

**KPI Bar (top):**
- `StatCard` × 5:
  - Total Warnings Issued (red dot, `+12 This Month` delta)
  - Citizen Reports Received (orange dot, `89% Verified` note)
  - People Evacuated (green dot, `9 Districts Affected`)
  - Avg. Response Time (blue dot, `-8 min from Q1` delta — improvement shown in green)
  - Active Shelters (purple dot, `Capacity: 84%`)

**Middle Row:**
- `WarningsByHazardChart` (horizontal bar chart) — Flood 124, Landslide 78, Cyclone 32, Tsunami 13
- `VerificationRateDonut` — 72% approved (green), 18% rejected (red), 10% pending (orange). Legend below.
- `IncidentDensityMap` — Sri Lanka Leaflet map with district colour heat overlay (red = severe, orange = high, yellow = medium). High-risk zone list below map.

**Bottom Row:**
- `CitizenReportsTrendChart` (bar chart, 30-day history) — total 1,832 reports. Line overlay for trend.

**Data Source:** `GET /api/analytics/overview?period=30d`

### Page 2: Shelter Utilization & Capacity Audit (`/officer/analytics/shelters`)

**KPI Bar:**
- Peak Occupancy Rate, Average Citizen Stay (Days), Total Sheltered, Active Shelters Running

**Charts:**
- `ShelterOccupancyChart` — stacked bar chart, X axis = 5 time periods, Y axis = occupant count. Stacked by district (Ratnapura/Kalutara/Galle/Matara colour coding). Legend below.
- `CapacityVsActualTable` — right side panel with horizontal progress bars per shelter: `{name} {current} / {capacity} beds`

**Table:**
- Designated Safe House Directory: Safe Camp Name, District, Capacity Rate %, Meals Dispensed, Status badge (Critical/Normal/High Occupancy/Stable)

**Data Source:** `GET /api/analytics/shelters?period=30d`

### Page 3: Supply Chain & Resource Metrics (`/officer/analytics/resources`)

**KPI Bar:**
- Total Distributions (342 Operations), Ration Items Dispatched (45,600 units), Districts Fully Shaded (12/25), Mean Emergency Delivery (4.2 Hours)

**Charts:**
- `ResourceDistributionMap` — Sri Lanka Leaflet map with district tooltips showing pack count (e.g., "Colombo (12k packs)", "Ampara (45k packs)", "Galle (8k packs)")
- `DistributionCategoryBreakdown` — 4 coloured block tiles showing Food 42%, Water 28%, Medicine 18%, Shelter Kits 12%
- `PriorityWarehouseTable` — Warehouse name, units, reserve percentage

**Data Source:** `GET /api/analytics/resources?period=30d`

### Page 4: Historical Alert Timeline Logs (`/officer/analytics/alert-timeline`)

**Filter Bar:**
- Pill filters: All Hazards | Red Warnings | Last 7 Days
- Summary bar (dark): Total Period Alerts, Avg Reach Rate, Fastest Dispatch

**Alert Cards (expandable):**
Each card shows:
- Severity colour dot (red/amber/green)
- Warning title (ALL CAPS) + severity badge
- "Affected districts: X, Y, Z"
- Sub-metrics row:
  - App Push Notifications: `N,NNN sent`
  - DMC Siren Alert SMS Network: `N.NM delivered`
  - Cumulative Public Reach Rate: `NN.N% reached` + green progress bar
- Timestamp (right aligned)

**Data Source:** `GET /api/analytics/alert-timeline?filter=all&period=7d`

### Page 5: Automated Report Builder (`/officer/analytics/report-builder`)

**Layout:** 3 columns
1. "1. Choose Template" — vertical list of 4 template cards. Active card highlighted in blue/primary.
2. "2. Configure Scope" — district checkboxes grid (Colombo, Gampaha, Kalutara, Galle, Matara, Hambantota, Ratnapura, Kegalle). Output format: PDF | Excel (.xlsx) | CSV (.csv) toggle buttons. "Generate Document" blue button. "Schedule briefing" outline button.
3. "Document Preview" — placeholder thumbnail of the document layout.

**Recent Export Logs Table:**
- Document File Name, Format, Generated Date, Size, Actions (Download link)

**Data Source:**
- `GET /api/report-generator/history` — recent exports list

---

## 7. API Endpoints (UC04)

| Method | Endpoint | Auth Role | Description |
|---|---|---|---|
| `GET` | `/api/analytics/overview` | dmc_officer | Dashboard KPIs and chart data |
| `GET` | `/api/analytics/shelters` | dmc_officer | Shelter occupancy analytics |
| `GET` | `/api/analytics/resources` | dmc_officer | Supply chain analytics |
| `GET` | `/api/analytics/alert-timeline` | dmc_officer | Historical warning delivery data |
| `GET` | `/api/analytics/dashboard-summary` | any officer | Stats for top nav/dashboard summary |
| `POST` | `/api/report-generator/generate` | dmc_officer | Trigger report file generation |
| `GET` | `/api/report-generator/history` | dmc_officer | List previously generated reports |
| `GET` | `/api/report-generator/:id/download` | dmc_officer | Get download URL for a report |

**GET /api/analytics/overview?period=30d — Response:**
```json
{
  "success": true,
  "data": {
    "kpis": {
      "totalWarningsIssued": 247,
      "warningsThisMonth": 12,
      "citizenReportsReceived": 1832,
      "verificationRate": 0.89,
      "peopleEvacuated": 14200,
      "districtsAffected": 9,
      "avgResponseTimeMinutes": 42,
      "avgResponseTimeDeltaMinutes": -8,
      "activeShelters": 18,
      "shelterCapacityPercent": 0.84
    },
    "warningsByHazardType": [
      { "type": "flood", "label": "Flood", "count": 124 },
      { "type": "landslide", "label": "Landslide", "count": 78 },
      { "type": "cyclone", "label": "Cyclone", "count": 32 },
      { "type": "tsunami", "label": "Tsunami", "count": 13 }
    ],
    "verificationBreakdown": {
      "approved": 1320,
      "rejected": 330,
      "pending": 182
    },
    "highRiskZones": [
      { "district": "Ratnapura", "level": "severe" },
      { "district": "Gampaha", "level": "high" },
      { "district": "Colombo", "level": "high" },
      { "district": "Kegalle", "level": "medium" }
    ],
    "citizenReportsTrend": [
      { "date": "2026-09-08", "count": 42 },
      { "date": "2026-09-09", "count": 55 }
    ]
  }
}
```

**POST /api/report-generator/generate — Request Body:**
```json
{
  "templateId": "incident_summary",
  "districts": ["Colombo", "Gampaha", "Kalutara"],
  "format": "PDF",
  "title": "Incident Summary - Kelani Flood Q3 2026"
}
```

**POST /api/report-generator/generate — Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "clxxx...",
    "title": "Incident Summary - Kelani Flood Q3 2026",
    "fileUrl": "https://res.cloudinary.com/dmc/reports/incident_summary_2026.pdf",
    "format": "PDF",
    "generatedAt": "2026-10-07T11:00:00.000Z",
    "sizeBytes": 4404019
  },
  "message": "Report generated successfully"
}
```

---

## 8. Sequence Diagram (Text Description)

```
DMC Officer → Analytics Dashboard UI : openAnalytics()
Analytics Dashboard UI → Analytics Controller : GET /api/analytics/overview?period=30d
Analytics Controller → Analytics Service : getOverviewData("30d")
Analytics Service → DB : aggregate queries
  - COUNT warnings GROUP BY hazard_type
  - COUNT hazard_reports GROUP BY status
  - SUM shelter current_occupancy, COUNT active shelters
  - AVG (reviewed_at - submitted_at) for verified reports
  - COUNT citizens by evacuation records
DB → Analytics Service : raw aggregates
Analytics Service → Analytics Controller : formattedData { kpis, charts }
Analytics Controller → Analytics Dashboard UI : 200 { data }
Analytics Dashboard UI → DMC Officer : render dashboard (KPIs + charts + heatmap)

DMC Officer → Report Builder UI : clickReportBuilder()
Report Builder UI → Report Gen Controller : GET /api/report-generator/history
Report Gen Controller → DB : findMany(disaster_reports, ORDER BY createdAt DESC, LIMIT 10)
DB → Report Gen Controller : recent reports[]
Report Gen Controller → Report Builder UI : 200 { reports }
Report Builder UI → DMC Officer : render builder + export logs

DMC Officer → Report Builder UI : selectTemplate("incident_summary")
DMC Officer → Report Builder UI : selectDistricts(["Colombo", "Gampaha", "Kalutara"])
DMC Officer → Report Builder UI : selectFormat("PDF")
DMC Officer → Report Builder UI : clickGenerateDocument()

Report Builder UI → Report Gen Controller : POST /api/report-generator/generate
  { templateId: "incident_summary", districts: [...], format: "PDF" }
Report Gen Controller → Export Service : generateReport(dto, officerId)
Export Service → Analytics Service : gatherReportData(districts, period)
Analytics Service → DB : run all required aggregate queries
DB → Analytics Service : data sets
Analytics Service → Export Service : reportData { warnings, reports, shelters, resources }

Export Service → Export Service : buildPDF(reportData)
  [uses pdfkit or similar PDF library]
  [builds formatted document with tables, charts as images]

Export Service → Cloudinary : upload(pdfBuffer, folder: "dmc/reports")
Cloudinary → Export Service : { fileUrl, publicId, bytes }

Export Service → DB : create DisasterReport {
  title, format: "PDF",
  fileUrl, generatedById, districts,
  citizensReached, shelterOccupancyPeak, resourceDistributed
}
DB → Export Service : report record

Export Service → Report Gen Controller : { report, fileUrl }
Report Gen Controller → Report Builder UI : 201 { reportId, fileUrl, sizeBytes }
Report Builder UI → DMC Officer : show success + update export logs table

DMC Officer → Report Builder UI : clickDownload(fileUrl)
Report Builder UI → Browser : window.open(fileUrl) or anchor download
Browser → DMC Officer : file downloads
```

---

## 9. Analytics Service Queries

All analytics queries are in `backend/src/services/analytics.service.ts`.

### Key Prisma Queries

**Total Warnings by Hazard Type:**
```typescript
const warningsByType = await prisma.warning.groupBy({
  by: ['hazardType'],
  _count: { id: true },
  where: { createdAt: { gte: periodStart } },
  orderBy: { _count: { id: 'desc' } },
});
```

**Verification Rate:**
```typescript
const verificationStats = await prisma.hazardReport.groupBy({
  by: ['status'],
  _count: { id: true },
  where: { submittedAt: { gte: periodStart } },
});
```

**Average Response Time (report submitted to verified):**
```typescript
const reports = await prisma.hazardReport.findMany({
  where: {
    status: 'VERIFIED',
    reviewedAt: { not: null },
    submittedAt: { gte: periodStart },
  },
  select: { submittedAt: true, reviewedAt: true },
});
const avgMinutes = reports.reduce((sum, r) => {
  const diffMs = r.reviewedAt!.getTime() - r.submittedAt.getTime();
  return sum + diffMs / 60000;
}, 0) / reports.length;
```

**Shelter Occupancy Over Time (by district, 5 periods):**
```typescript
// Uses shelter_occupancy_logs table
// Group by district + week/period
// Returns stacked chart data
```

**Supply Distribution Breakdown:**
```typescript
const distributions = await prisma.supplyDispatch.groupBy({
  by: ['unit'],
  _sum: { quantity: true },
  where: {
    transitStatus: 'DELIVERED',
    dispatchedAt: { gte: periodStart },
  },
});
```

---

## 10. Report Generation Implementation

### PDF Generation: `pdfkit`
```bash
npm install pdfkit @types/pdfkit
```

### Excel Generation: `exceljs`
```bash
npm install exceljs
```

### CSV Generation: Built-in (JSON → CSV string)
```typescript
function jsonToCsv(data: Record<string, unknown>[]): string {
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).join(','));
  return [headers, ...rows].join('\n');
}
```

### Export Service Template:
```typescript
// backend/src/services/export.service.ts

export async function generateReport(dto: GenerateReportDto, officerId: string) {
  const data = await analyticsService.gatherReportData(dto.districts, dto.period);

  let fileBuffer: Buffer;
  let mimeType: string;
  let extension: string;

  switch (dto.format) {
    case 'PDF':
      fileBuffer = await buildPDF(dto.templateId, data);
      mimeType = 'application/pdf';
      extension = '.pdf';
      break;
    case 'EXCEL':
      fileBuffer = await buildExcel(dto.templateId, data);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = '.xlsx';
      break;
    case 'CSV':
      fileBuffer = Buffer.from(buildCsv(data));
      mimeType = 'text/csv';
      extension = '.csv';
      break;
  }

  const filename = `${dto.templateId}_${Date.now()}${extension}`;
  const uploadResult = await cloudinary.uploader.upload_stream(
    { folder: 'dmc/reports', resource_type: 'raw', public_id: filename },
    // handle callback
  );

  const report = await prisma.disasterReport.create({
    data: {
      reportTitle: dto.title,
      disasterType: data.primaryHazardType,
      district: dto.districts.join(', '),
      period: dto.period,
      generatedById: officerId,
      exportFormat: dto.format,
      fileUrl: uploadResult.secure_url,
    },
  });

  return report;
}
```

---

## 11. Business Logic Notes

- Analytics data is **always read-only**. No POST/PATCH/DELETE on analytics endpoints.
- The `period` query parameter accepts: `7d`, `30d`, `90d`, `1y`, or ISO date range `2026-05-01,2026-05-31`.
- `avgResponseTime` is calculated from `hazardReport.submittedAt` → `hazardReport.reviewedAt`. Reports without `reviewedAt` are excluded.
- The alert timeline shows all warnings regardless of status (active, expired, cancelled).
- High-risk zones are determined by: district with 3+ active hazard warnings in the current period, OR shelter occupancy > 85% in that district.
- Generated report files are stored in Cloudinary under `dmc/reports/` folder with `resource_type: raw` (for non-image files).
- Report file names follow: `{templateId}_{YYYYMMDD}_{officerInitials}.{ext}` e.g. `incident_summary_20261007_KP.pdf`.
- `DisasterReport.fileUrl` is nullable — if Cloudinary upload fails, the DB record still exists so the officer can see the report was attempted.
