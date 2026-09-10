# UC02 SPEC — Submit & Verify Hazard Report
## Smart Disaster Early-Warning and Emergency Coordination System
### Group 060 | Member: Jayakodi P B S K (IT23827608)

---

## 1. Use Case Summary

| Field | Value |
|---|---|
| Use Case ID | UC02 |
| Name | Submit & Verify Hazard Report |
| Primary Actor (Part 1) | Citizen |
| Primary Actor (Part 2) | DMC Duty Officer |
| Secondary Actors | GPS/Location Service (browser Geolocation API), Push Notification Service (FCM) |
| Goal | A citizen submits a field hazard report with GPS coordinates, photos, and description. A DMC Duty Officer reviews, verifies or rejects the report. Verified reports can be used to escalate hazard warnings. |
| Preconditions | Citizen: registered and logged in with role `citizen`. Internet available (or save offline for later). DMC Duty Officer: authenticated with role `dmc_duty_officer`. |
| Postconditions | Report is in `VERIFIED` or `REJECTED` status. If verified, duty officer can optionally trigger warning creation from the verification screen. Notification sent to citizen on outcome. |
| Trigger | Citizen observes a hazard situation in their local area |

---

## 2. Main Flow — Part 1: Citizen Submits Report (Happy Path)

| Step | Actor | Action | System Response |
|---|---|---|---|
| 1 | Citizen | Opens the citizen portal (mobile browser). Sees home page with active warning banners and weather conditions. | System displays CitizenHomePage with active warnings near their district, weather widget, Emergency Dispatch Tools section. |
| 2 | Citizen | Taps "Report Hazard /" card or the Report tab in the bottom navigation | System navigates to SubmitReportPage (multi-step form, Step 1 of 3) |
| 3 | Citizen | Selects hazard type from the selector (Flood, Landslide, Fallen Tree, Road Block, etc.) | Selected type highlighted in orange/primary colour |
| 4 | Citizen | GPS location is auto-detected by the browser Geolocation API | Map widget shows current location with crosshair. GPS coordinates displayed (Lat/Lon). "Adjust Map" link available. |
| 5 | Citizen | Optionally taps "Capture" to add photos (up to 3) | Camera or file picker opens. Photos appear as thumbnails. |
| 6 | Citizen | Enters observation notes in the text area | Character count shown. |
| 7 | Citizen | Taps "Transmit Verified Report to DMC" button | Client-side validation runs. |
| 8 | System | Uploads photos to Cloudinary. Saves report to database with status `PENDING_VERIFICATION`. Generates unique report code. | |
| 9 | System | Returns success response. Navigates citizen to confirmation screen. | ReportSubmittedConfirmation page shows: Report Reference ID, Live Review Status (PENDING VERIFICATION), District Zone, local sync confirmation. |
| 10 | System | Emits Socket.io event to Officer portal (`/officer` namespace): `new_report_submitted` | DMC Verification Queue updates in real-time |

---

## 3. Main Flow — Part 2: DMC Duty Officer Verifies Report (Happy Path)

| Step | Actor | Action | System Response |
|---|---|---|---|
| 1 | DMC Duty Officer | Opens Officer Portal and navigates to Reports | Incoming Hazard Verification Queue page loads |
| 2 | System | Displays verification queue with incoming reports map and live submission logs | Map shows unverified report pins on Sri Lanka map. Queue metrics: total pending (18), critical active (04). Submission log table shows Report ID, Hazard Type, District Zone, Time, Severity, Status, Verification Action buttons. |
| 3 | DMC Duty Officer | Optionally filters by District or Hazard Type | Queue refreshes with filtered results |
| 4 | DMC Duty Officer | Clicks "Verify Report" button for a specific report | System navigates to Report Verification Detail page |
| 5 | System | Displays full report details | Citizen Submission Details: reporter name, phone, GPS coordinates, location label, description text, submitted photos. Verification History Trail timeline. DMC Command Actions panel on right side. |
| 6 | DMC Duty Officer | Reviews photos, GPS location, and description | |
| 7 | DMC Duty Officer | Sets severity level in "Confirm Severity Level" dropdown | |
| 8 | DMC Duty Officer | Writes officer assessment notes | |
| 9 | DMC Duty Officer | Clicks "Approve & Create National Warning" | System sets report `status = VERIFIED`. Sets `reviewedAt` and `verifiedById`. System navigates to Create Warning page with fields pre-filled from the report. |

---

## 4. Alternative Flows

### A1 — Citizen Saves Report Offline
- Trigger: `navigator.onLine === false` when citizen taps submit
- System saves the report (including photo blobs) to **IndexedDB** using the `idb` library
- Shows message: "Report stored locally and fully synced with main DMC servers." (with offline indicator)
- When internet connection is restored (`online` window event fires):
  - `useOfflineReports` hook detects pending items in IndexedDB
  - Submits them to the API in order
  - Removes from IndexedDB on success
  - Shows toast: "Offline report synced successfully"

### A2 — GPS Unavailable
- Trigger: User denies browser location permission or device has no GPS
- System shows: "GPS unavailable. Please enter location manually."
- Manual location input: free text address field + district dropdown
- GPS coordinates stored as `null` in the database if not available

### A3 — Officer Rejects Report
- At Step 9 (Part 2), officer clicks "Decline / Flag as Spurious" instead
- Dialog appears: "Reason for rejection (optional)" text field
- Officer submits rejection
- System sets `status = REJECTED`, stores `rejectionReason`, sets `reviewedAt`
- Notification sent to citizen: "Your report RPT-2024-KLT-0847 has been reviewed and could not be verified."
- Report remains in the system as a historical record

### A4 — Officer Puts Report Under Review
- Officer opens the report detail but has not yet made a decision
- Simply navigating to the detail page can automatically set status to `UNDER_REVIEW`
- This prevents two officers from verifying the same report simultaneously

### A5 — Citizen Adjusts GPS Location Manually
- At Step 4, citizen taps "Adjust Map"
- An interactive map opens allowing the citizen to drag a pin to the exact incident location
- Updated coordinates stored

---

## 5. Exception Flows

### E1 — Photo Upload Fails
- Trigger: Cloudinary upload returns error (network timeout, file too large)
- System shows: "Photo upload failed. Please try a smaller image (max 5MB)."
- Report submission blocked until photos are removed or re-uploaded

### E2 — Report Already Reviewed
- Trigger: Two officers open the same report simultaneously and both try to verify
- Server checks: if `status !== PENDING_VERIFICATION && status !== UNDER_REVIEW`, return 409
- Error code: `REPORT_ALREADY_REVIEWED`
- Second officer sees toast: "This report has already been reviewed by another officer."

### E3 — Invalid GPS Coordinates
- Trigger: Browser sends 0,0 or coordinates outside Sri Lanka
- Client-side validation: check coordinates are within approximate Sri Lanka bounding box (lat 5.9–9.9, lon 79.6–81.9)
- If outside bounds, warn user and ask to adjust manually

---

## 6. UI Pages & Components (UC02)

### Citizen Portal Pages

#### Page 1: Citizen Home (`/citizen/home`)
**Components:**
- `WarningBanner` — dismissible red/amber banner showing the most severe active warning for citizen's district
- `WeatherWidget` — current temperature, condition, precipitation, wind speed
- `EmergencyDispatchTools` — "Report Hazard" primary CTA card + My Reports, Contacts, Shelters quick links
- `RecentAlertsList` — list of recent alerts near the citizen (colour-coded by severity)
- Bottom navigation: Home, Alerts, Report (+ icon), Map, Profile

**Data Sources:**
- `GET /api/warnings?district={userDistrict}&status=active` — warning banner
- `GET /api/citizen/recent-alerts` — recent alerts list

#### Page 2: Submit Hazard Report (`/citizen/report`)
Multi-step form (Steps 1–3 tracked with a progress indicator).

**Step 2 of 3 shown in wireframe:**
- `HazardTypeSelector` — horizontal scrollable chips (Flood, Landslide, Fallen Tree, Road Block)
- `GPSLocationPicker` — auto-detected map with crosshair. Shows Lat/Lon. "Adjust Map" toggle.
- `PhotoUploader` — Camera capture + file select. Thumbnails grid (up to 3 photos).
- `ObservationNotesInput` — multiline textarea
- Submit button: "Transmit Verified Report to DMC" (red, full-width)
- Offline indicator shown if `navigator.onLine === false`

**Validation:**
```typescript
{
  hazardType: required,
  gpsLatitude: required if not manual mode,
  gpsLongitude: required if not manual mode,
  manualLocation: required if GPS unavailable,
  district: required,
  description: required, min 20 chars,
  photoUrls: optional, max 3
}
```

#### Page 3: Report Submitted (`/citizen/report/submitted`)
- Large green check circle
- "Report Successfully Logged" heading
- Details card: Report Reference ID, Live Review Status badge, District Zone
- Info box: "Report stored locally and fully synced with main DMC servers."
- Two action buttons: "Track Report Status" → `/citizen/my-reports`, "Submit Another Observation"

#### Page 4: My Reports (`/citizen/my-reports`)
- List of all reports submitted by the logged-in citizen
- Each row: Report Code, Hazard Type, Date, Status badge (Pending/Verified/Rejected)
- Tap a row to see report details

### Officer Portal Pages

#### Page 5: Verification Queue (`/officer/reports`)
**Layout:** Full page with map on left half, queue table on right half (responsive: stack on smaller screens).

**Components:**
- `IncomingReportsSpatialMap` — Leaflet map with red triangle warning pins for unverified reports
- `QueueMetrics` panel — Pending Review count (yellow), Critical Level count (red)
- Active Filters: District dropdown, Hazard type dropdown
- `VerificationQueueTable` — columns: Report ID, Hazard Type, District Zone, Time, Severity badge, Status, Verify Report button, Reject button

**Data Sources:**
- `GET /api/reports?status=pending_verification,under_review`
- Socket.io event `new_report_submitted` triggers `queryClient.invalidateQueries(['reports'])`

#### Page 6: Report Verification Detail (`/officer/reports/:id`)
**Layout:** Left panel (report details) + right panel (command actions).

**Left panel:**
- "Citizen Submission Details" card with "UNVERIFIED HIGH SEVERITY" badge
- Reporter Profile: name, phone, "Registered Citizen"
- GPS Location: coordinates + river basin label
- User Description: full text
- Submitted Photo Proof: image gallery (up to 3 photos, full-size on click)
- Verification History Trail: timeline (submitted → routed to officer)

**Right panel — DMC Command Actions:**
- "CONFIRM SEVERITY LEVEL" dropdown (Watch/Advisory/Warning/Emergency)
- "OFFICER ASSESSMENT NOTES" textarea
- "POTENTIAL ZONE IMPACT" section: Estimated Households, Alternative Shelters
- "Approve & Create National Warning" red button
- "Decline / Flag as Spurious" outline button

---

## 7. API Endpoints (UC02)

| Method | Endpoint | Auth Role | Description |
|---|---|---|---|
| `POST` | `/api/reports` | citizen | Submit a new hazard report |
| `POST` | `/api/reports/upload-photos` | citizen | Upload photos to Cloudinary, return URLs |
| `GET` | `/api/reports` | dmc_duty_officer, dmc_officer | List reports (filterable by status, district) |
| `GET` | `/api/reports/:id` | dmc_duty_officer, dmc_officer | Get report details |
| `PATCH` | `/api/reports/:id/verify` | dmc_duty_officer | Verify a report |
| `PATCH` | `/api/reports/:id/reject` | dmc_duty_officer | Reject a report |
| `GET` | `/api/reports/my-reports` | citizen | Get the authenticated citizen's reports |

**POST /api/reports — Request Body:**
```json
{
  "hazardType": "flood",
  "description": "Kelani River water has breached the lateral sand barriers. Flooding is now moving into the secondary local service road.",
  "photoUrls": ["https://res.cloudinary.com/dmc/.../photo1.jpg", "https://res.cloudinary.com/dmc/.../photo2.jpg"],
  "gpsLatitude": 6.5823,
  "gpsLongitude": 80.0384,
  "district": "Kalutara",
  "locationLabel": "Kalutara South, Kelani River Basin"
}
```

**PATCH /api/reports/:id/verify — Request Body:**
```json
{
  "severityEstimate": "emergency",
  "officerNotes": "Observations verified with Kelani River basin sensory telemetry. Confirming flood water rising.",
  "estimatedHouseholds": 550
}
```

**PATCH /api/reports/:id/reject — Request Body:**
```json
{
  "rejectionReason": "GPS coordinates are outside known flood zone. Photo does not match described location."
}
```

---

## 8. Sequence Diagram (Text Description)

### Part 1: Citizen Submits
```
Citizen → Citizen Home UI : openApp()
Citizen Home UI → Report API : GET /api/warnings?district=Kalutara&status=active
Report API → DB : query active warnings
DB → Report API : [warning records]
Report API → Citizen Home UI : warnings
Citizen Home UI → Citizen : render home with warning banner

Citizen → Hazard Report UI : tapReportHazard()
Citizen → Hazard Report UI : selectHazardType("flood")

Hazard Report UI → GPS Location Service : requestCurrentPosition()
  alt [GPS Available]
    GPS Location Service → Hazard Report UI : { lat: 6.5823, lon: 80.0384 }
    Hazard Report UI → Citizen : showMapWithPin(lat, lon)
  else [GPS Unavailable]
    GPS Location Service → Hazard Report UI : PositionError
    Hazard Report UI → Citizen : showManualLocationInput()
  end

Citizen → Hazard Report UI : addPhotos([photo1, photo2])
Citizen → Hazard Report UI : enterDescription("Kelani River water has breached...")
Citizen → Hazard Report UI : tapTransmitReport()

  alt [Network Available]
    Hazard Report UI → Report Controller : POST /api/reports/upload-photos
    Report Controller → Cloudinary : upload(photos)
    Cloudinary → Report Controller : { photoUrls[] }
    Report Controller → Hazard Report UI : { photoUrls }

    Hazard Report UI → Report Controller : POST /api/reports { dto + photoUrls }
    Report Controller → Report Service : submitReport(dto, citizenId)
    Report Service → DB : createHazardReport()
    DB → Report Service : report record
    Report Service → Socket.io : emit("new_report_submitted", reportSummary)
    Report Service → Report Controller : report
    Report Controller → Hazard Report UI : 201 { reportCode, status }
    Hazard Report UI → Citizen : navigate to /report/submitted

  else [Network Unavailable]
    Hazard Report UI → IndexedDB : saveOffline(draftReport)
    Hazard Report UI → Citizen : showOfflineConfirmation()
    
    opt [Network Restored]
      useOfflineReports hook → IndexedDB : getPendingReports()
      IndexedDB → useOfflineReports hook : [draftReports]
      useOfflineReports hook → Report Controller : POST /api/reports (each)
      Report Controller → useOfflineReports hook : 201
      useOfflineReports hook → IndexedDB : deletePending(id)
    end
  end
```

### Part 2: Officer Verifies
```
DMC Duty Officer → Verification Queue UI : openReportsPage()
Verification Queue UI → Report Controller : GET /api/reports?status=pending_verification,under_review
Report Controller → Report Service : listReports(filters)
Report Service → DB : query hazard_reports
DB → Report Service : reports[]
Report Service → Report Controller : { reports, meta }
Report Controller → Verification Queue UI : 200 { reports, meta }
Verification Queue UI → DMC Duty Officer : render queue with map + table

DMC Duty Officer → Verification Queue UI : clickVerifyReport("RPT-2024-KLT-0847")
Verification Queue UI → Report Controller : GET /api/reports/RPT-2024-KLT-0847
Report Controller → Report Service : getReportById(id)
Report Service → DB : findUnique + set status = UNDER_REVIEW
DB → Report Service : report detail
Report Service → Report Controller : fullReport
Report Controller → Verification Queue UI : 200 { report }
Verification Queue UI → DMC Duty Officer : render VerificationDetail page

DMC Duty Officer → Report Detail UI : setSevertiyLevel("emergency")
DMC Duty Officer → Report Detail UI : enterOfficerNotes("Observations verified with sensor data...")
DMC Duty Officer → Report Detail UI : clickApproveAndCreateWarning()

Report Detail UI → Report Controller : PATCH /api/reports/RPT-2024-KLT-0847/verify
  { severityEstimate: "emergency", officerNotes: "..." }
Report Controller → Report Service : verifyReport(id, dto, officerId)
Report Service → DB : update status = VERIFIED, reviewedAt, verifiedById
DB → Report Service : updated report
Report Service → Report Controller : updatedReport
Report Controller → Report Detail UI : 200 { report }
Report Detail UI → DMC Duty Officer : navigate to Create Warning page (pre-filled)
```

---

## 9. Offline Architecture Detail

```
IndexedDB (idb library)
└── Store: "pending_reports"
    ├── id: timestamp-based key
    ├── hazardType: string
    ├── description: string
    ├── gpsLatitude: number
    ├── gpsLongitude: number
    ├── district: string
    ├── photos: Blob[]       ← stored as blobs before upload
    ├── createdAt: timestamp
    └── synced: false
```

When network restores:
1. Read all records where `synced = false`
2. For each: upload photos to Cloudinary → get URLs
3. Submit report with URLs
4. On 201: delete from IndexedDB
5. On error: retry once; if still fails, mark `syncError: true` and notify user

---

## 10. Business Logic Notes

- Report code format: `RPT-{YEAR}-{DISTRICT_CODE}-{SEQUENCE}` e.g. `RPT-2024-KLT-0847`
  - District codes: COL=Colombo, GAM=Gampaha, KLT=Kalutara, RTP=Ratnapura, etc.
- A citizen cannot submit more than 5 reports within a 24-hour period (rate limit in service layer).
- Photos are uploaded to Cloudinary folder: `dmc/hazard-reports/{reportCode}/`
- The officer who first opens a report's detail page triggers an implicit `UNDER_REVIEW` status update — preventing duplicate verification.
- A report can only be verified or rejected by a `dmc_duty_officer` — not a `dmc_officer` or `district_officer`.
- Verified reports are linked to the `Hazard` table — if a matching active hazard exists for the same type and district, the report is automatically associated with it.
