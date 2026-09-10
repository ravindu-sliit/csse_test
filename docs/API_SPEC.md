# API SPEC
## Smart Disaster Early-Warning and Emergency Coordination System
### Group 060

---

## Base URL
- Development: `http://localhost:3000/api`
- Production: `https://your-api.railway.app/api`

## Authentication
All protected routes require a JWT Bearer token:
```
Authorization: Bearer <access_token>
```
Tokens are obtained from `POST /api/auth/login`.

## Response Envelope
All responses follow the standard envelope defined in CODING_CONVENTIONS.md.

---

## AUTH ROUTES (`/api/auth`)

### POST /api/auth/register
Register a new user account.

**Auth:** None  
**Body:**
```json
{
  "name": "Asela Gunawardene",
  "email": "asela@test.lk",
  "phoneNumber": "+94771234567",
  "password": "Password123!",
  "role": "citizen",
  "district": "Kalutara",
  "nic": "991234567V"
}
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "clxxx", "name": "Asela Gunawardene", "email": "asela@test.lk", "role": "citizen" },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```
**Errors:** 409 `DUPLICATE_ENTRY` (email already registered), 400 `VALIDATION_ERROR`

---

### POST /api/auth/login
Authenticate and receive tokens.

**Auth:** None  
**Body:**
```json
{ "email": "officer@dmc.lk", "password": "Password123!" }
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "clyyy", "name": "Capt. K. Perera", "role": "dmc_duty_officer", "district": null },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```
**Errors:** 401 `INVALID_CREDENTIALS`

---

### POST /api/auth/refresh
Get a new access token using refresh token.

**Auth:** None  
**Body:** `{ "refreshToken": "eyJhbGci..." }`  
**Response 200:** `{ "success": true, "data": { "accessToken": "..." } }`  
**Errors:** 401 `TOKEN_EXPIRED`, 401 `TOKEN_INVALID`

---

### POST /api/auth/logout
Invalidate refresh token.

**Auth:** Bearer token  
**Body:** `{ "refreshToken": "eyJhbGci..." }`  
**Response 200:** `{ "success": true, "message": "Logged out successfully" }`

---

## HAZARDS (`/api/hazards`)

### GET /api/hazards
List active hazards.

**Auth:** Any authenticated user  
**Query Params:** `status?` (active|resolved|monitoring), `district?`, `type?`  
**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxxx",
      "type": "flood",
      "severity": "emergency",
      "district": "Colombo",
      "riverBasin": "Kelani River Basin",
      "status": "active",
      "startTime": "2026-10-07T08:00:00.000Z"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

## WARNINGS (`/api/warnings`)

### POST /api/warnings
Create a warning and initiate broadcast.

**Auth:** `dmc_officer`, `dmc_duty_officer`  
**Body:**
```json
{
  "hazardType": "flood",
  "severityLevel": "emergency",
  "targetDistricts": ["Colombo", "Gampaha"],
  "targetRiverBasin": "Kelani River Basin",
  "message": "EMERGENCY RED ALERT: Kelani River water levels have exceeded danger threshold. Evacuate immediately.",
  "broadcastChannels": ["sms_blast", "push_notification", "tv_radio"],
  "hazardId": "clxxx",
  "expiryTime": "2026-10-08T18:00:00.000Z"
}
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "clyyy",
    "warningCode": "DMC-2026-F98",
    "hazardType": "flood",
    "severityLevel": "emergency",
    "status": "active",
    "issuedTime": "2026-10-07T10:24:00.000Z",
    "targetDistricts": ["Colombo", "Gampaha"],
    "estimatedReach": 9600000,
    "broadcastChannels": [
      { "channel": "sms_blast", "status": "in_progress" },
      { "channel": "push_notification", "status": "in_progress" },
      { "channel": "tv_radio", "status": "in_progress" }
    ]
  },
  "message": "Warning created and broadcast initiated"
}
```

---

### GET /api/warnings
List all warnings.

**Auth:** Any officer  
**Query Params:** `status?` (active|expired|cancelled), `district?`, `hazardType?`, `page?`, `limit?`  
**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clyyy",
      "warningCode": "DMC-2026-F98",
      "hazardType": "flood",
      "severityLevel": "emergency",
      "status": "active",
      "targetDistricts": ["Colombo", "Gampaha"],
      "issuedTime": "2026-10-07T10:24:00.000Z",
      "issuedBy": { "id": "clzzz", "name": "Capt. K. Perera" }
    }
  ],
  "meta": { "total": 247, "page": 1, "limit": 20, "totalPages": 13 }
}
```

---

### GET /api/warnings/:id
Get single warning with broadcast details.

**Auth:** Any officer  
**Response 200:** Full warning object including `broadcastChannels`, `notificationLogs`.

---

### GET /api/warnings/:id/broadcast-status
Real-time broadcast delivery stats. Intended for polling every 5 seconds.

**Auth:** `dmc_officer`, `dmc_duty_officer`  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "warningId": "clyyy",
    "warningCode": "DMC-2026-F98",
    "status": "active",
    "channels": [
      { "channel": "sms_blast", "status": "in_progress", "confirmedReach": 8421080, "failedCount": 148290, "estimatedReach": 8200000, "progressPercent": 87 },
      { "channel": "push_notification", "status": "completed", "confirmedReach": 1316000, "failedCount": 84000, "estimatedReach": 1400000, "progressPercent": 94 },
      { "channel": "tv_radio", "status": "active", "confirmedReach": null, "failedCount": null }
    ],
    "totalTargetCitizens": 9600000,
    "totalConfirmedDeliveries": 8421080,
    "totalFailed": 148290
  }
}
```

---

### PATCH /api/warnings/:id/cancel
Cancel a warning.

**Auth:** `dmc_officer`, `dmc_duty_officer`  
**Body:** `{ "reason": "Flood levels receding" }`  
**Response 200:** `{ "success": true, "data": { "id": "...", "status": "cancelled" } }`  
**Errors:** 409 `WARNING_ALREADY_CANCELLED`, 404 `NOT_FOUND`

---

### PATCH /api/warnings/:id/escalate
Escalate severity.

**Auth:** `dmc_officer`, `dmc_duty_officer`  
**Body:** `{ "newSeverityLevel": "emergency", "reason": "Situation worsening" }`  
**Response 200:** Updated warning object.

---

## HAZARD REPORTS (`/api/reports`)

### POST /api/reports
Submit a hazard report (citizen).

**Auth:** `citizen`  
**Body:**
```json
{
  "hazardType": "flood",
  "description": "Kelani River water has breached the lateral sand barriers. Flooding now moving into secondary service road.",
  "photoUrls": ["https://res.cloudinary.com/dmc/image/upload/photo1.jpg"],
  "gpsLatitude": 6.5823,
  "gpsLongitude": 80.0384,
  "district": "Kalutara",
  "locationLabel": "Kalutara South, Kelani River Basin"
}
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "clxxx",
    "reportCode": "RPT-2024-KLT-0847",
    "status": "pending_verification",
    "submittedAt": "2026-10-07T10:24:00.000Z"
  },
  "message": "Report submitted successfully"
}
```

---

### POST /api/reports/upload-photos
Upload photos to Cloudinary and return URLs.

**Auth:** `citizen`  
**Content-Type:** `multipart/form-data`  
**Form fields:** `photos` (up to 3 files, max 5MB each, image/jpeg or image/png)  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "photoUrls": [
      "https://res.cloudinary.com/dmc/image/upload/v1234/dmc/hazard-reports/RPT-2024-KLT-0847/photo1.jpg"
    ]
  }
}
```
**Errors:** 400 `UPLOAD_FAILED` (file too large), 400 `VALIDATION_ERROR` (invalid type)

---

### GET /api/reports
List hazard reports (officer view).

**Auth:** `dmc_duty_officer`, `dmc_officer`  
**Query Params:** `status?`, `district?`, `hazardType?`, `page?`, `limit?`  
**Response 200:** Paginated list with reporter name, GPS, status, severity, timestamps.

---

### GET /api/reports/my-reports
Get authenticated citizen's own reports.

**Auth:** `citizen`  
**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "reportCode": "RPT-2024-KLT-0847",
      "hazardType": "flood",
      "status": "pending_verification",
      "submittedAt": "2026-10-07T10:24:00.000Z",
      "district": "Kalutara"
    }
  ]
}
```

---

### GET /api/reports/:id
Get full report details.

**Auth:** `dmc_duty_officer`, `dmc_officer`, or the owning `citizen`  
**Response 200:** Full report with photos, GPS, description, verification history.

---

### PATCH /api/reports/:id/verify
Verify a report.

**Auth:** `dmc_duty_officer`  
**Body:**
```json
{
  "severityEstimate": "emergency",
  "officerNotes": "Observations verified with Kelani River basin sensory telemetry.",
  "estimatedHouseholds": 550
}
```
**Response 200:** Updated report with `status: "verified"`, `reviewedAt`, `verifiedBy`.  
**Errors:** 409 `REPORT_ALREADY_REVIEWED`

---

### PATCH /api/reports/:id/reject
Reject a report.

**Auth:** `dmc_duty_officer`  
**Body:** `{ "rejectionReason": "GPS coordinates outside known flood zone." }`  
**Response 200:** Updated report with `status: "rejected"`.

---

## SHELTERS (`/api/shelters`)

### POST /api/shelters
Register a new shelter.

**Auth:** `district_officer`  
**Body:**
```json
{
  "name": "Rathmalana Maha Vidyalaya",
  "address": "Rathmalana, Colombo",
  "district": "Colombo",
  "capacity": 500,
  "contactNumber": "071 234 5678",
  "amenities": ["water", "electricity", "medical", "food"]
}
```
**Response 201:** Created shelter object.  
**Errors:** 409 `DUPLICATE_ENTRY`, 400 `VALIDATION_ERROR`

---

### GET /api/shelters
List shelters.

**Auth:** Any officer  
**Query Params:** `district?`, `status?` (open|full|closed), `page?`, `limit?`  
**Response 200:** Paginated list.

---

### GET /api/shelters/:id
Get shelter details including recent occupancy log.

**Auth:** Any officer  
**Response 200:** Full shelter with `occupancyLogs` (last 10 entries).

---

### PATCH /api/shelters/:id/occupancy
Update current occupancy.

**Auth:** `district_officer`  
**Body:** `{ "newOccupancy": 350 }`  
**Response 200:** `{ "success": true, "data": { "id": "...", "currentOccupancy": 350, "status": "open" } }`  
**Errors:** 409 `SHELTER_CAPACITY_EXCEEDED`, 404 `NOT_FOUND`

---

### PATCH /api/shelters/:id/status
Open or close a shelter.

**Auth:** `district_officer`  
**Body:** `{ "status": "closed" }`  
**Response 200:** Updated shelter.

---

## RESCUE TEAMS (`/api/rescue-teams`)

### GET /api/rescue-teams
List rescue teams.

**Auth:** Any officer  
**Query Params:** `status?`, `district?`  
**Response 200:**
```json
{
  "success": true,
  "data": [
    { "id": "clxxx", "teamCode": "TEAM-A", "teamName": "Navy Swiftwater", "teamType": "Navy", "status": "available", "memberCount": 12, "district": "Colombo" }
  ]
}
```

---

### POST /api/rescue-teams
Register a rescue team.

**Auth:** `district_officer`, `dmc_officer`  
**Body:** `{ "teamCode": "TEAM-E", "teamName": "...", "teamType": "Civil", "contactNumber": "...", "district": "Gampaha", "memberCount": 10 }`  
**Response 201:** Created team.

---

## DISPATCHES (`/api/dispatches`)

### POST /api/dispatches
Create rescue team dispatch.

**Auth:** `district_officer`  
**Body:**
```json
{
  "teamId": "clxxx",
  "targetDistrict": "Gampaha",
  "missionDetails": "Flood rescue - residential area inundated",
  "criticality": "HIGH",
  "gearChecklist": ["inflatable_boats", "paramedic_kit"]
}
```
**Response 201:** Dispatch record + updated team status.  
**Errors:** 409 `TEAM_UNAVAILABLE`

---

### PATCH /api/dispatches/:id/status
Update mission status.

**Auth:** `district_officer`, `rescue_team`  
**Body:** `{ "status": "on_mission" }`  
**Response 200:** Updated dispatch.

---

## SUPPLY (`/api/supplies`)

### GET /api/supplies
List relief supplies.

**Auth:** Any officer  
**Query Params:** `category?`, `status?`, `district?`  
**Response 200:** List of supplies with current quantities.

---

### POST /api/supplies
Register a new supply item.

**Auth:** `district_officer`  
**Body:** `{ "name": "Rice Packs", "category": "Food", "quantity": 2400, "unit": "Units", "location": "Colombo Central Depot", "organizationId": "clxxx" }`  
**Response 201:** Created supply.

---

## SUPPLY DISPATCHES (`/api/supply-dispatches`)

### GET /api/supply-dispatches
List supply dispatches.

**Auth:** Any officer  
**Query Params:** `shelterId?`, `transitStatus?`, `page?`, `limit?`  
**Response 200:** Paginated list.

---

### POST /api/supply-dispatches
Create supply dispatch bill.

**Auth:** `district_officer`  
**Body:**
```json
{
  "supplyId": "clyyy",
  "shelterId": "clzzz",
  "destinationLabel": "Ratnapura Central School",
  "quantity": 400,
  "unit": "Packs"
}
```
**Response 201:** `{ "dispatchCode": "TX-8902", ... }`  
**Errors:** 400 `INSUFFICIENT_SUPPLY`

---

### PATCH /api/supply-dispatches/:id/status
Update transit status.

**Auth:** `district_officer`  
**Body:** `{ "transitStatus": "in_transit" }`  
**Response 200:** Updated dispatch.

---

## ANALYTICS (`/api/analytics`)

### GET /api/analytics/overview
Dashboard KPIs and chart data.

**Auth:** `dmc_officer`  
**Query Params:** `period?` (7d|30d|90d|1y, default 30d), `districts?` (comma-separated)  
**Response 200:** See UC04_SPEC.md for full response shape.

---

### GET /api/analytics/shelters
Shelter utilization analytics.

**Auth:** `dmc_officer`  
**Query Params:** `period?`  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "kpis": {
      "peakOccupancyRate": 12400,
      "peakOccupancyDate": "2026-05-15",
      "avgCitizenStayDays": 3.2,
      "totalSheltered": 18500,
      "activeSheltersCount": 24,
      "totalDesignatedShelters": 45
    },
    "occupancyOverTime": [ ... ],
    "capacityVsActual": [ ... ],
    "shelterDirectory": [ ... ]
  }
}
```

---

### GET /api/analytics/resources
Supply chain and resource analytics.

**Auth:** `dmc_officer`  
**Query Params:** `period?`  
**Response 200:** Distribution operations count, ration items, district coverage, mean delivery time, distribution map data, category breakdown.

---

### GET /api/analytics/alert-timeline
Historical alert timeline.

**Auth:** `dmc_officer`  
**Query Params:** `filter?` (all|red|amber), `period?` (7d|30d)  
**Response 200:** List of warnings with per-channel delivery metrics.

---

### GET /api/analytics/dashboard-summary
Summary stats for officer dashboard top cards.

**Auth:** Any officer  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "activeWarnings": 3,
    "pendingReports": 12,
    "sheltersOpen": 45,
    "teamsDeployed": 18
  }
}
```

---

### GET /api/analytics/coordination-summary
Stats for coordination dashboard.

**Auth:** `district_officer`, `dmc_officer`  
**Query Params:** `district?`  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "rescueTeamsDeployed": 24,
    "rescueTeamsTotal": 30,
    "activeShelters": 18,
    "supplyHubsActive": 12
  }
}
```

---

## REPORT GENERATOR (`/api/report-generator`)

### POST /api/report-generator/generate
Generate a disaster report file.

**Auth:** `dmc_officer`  
**Body:**
```json
{
  "templateId": "incident_summary",
  "title": "Incident Summary - Kelani Flood Q3 2026",
  "districts": ["Colombo", "Gampaha", "Kalutara"],
  "format": "PDF",
  "period": "30d"
}
```
**Response 201:** See UC04_SPEC.md for full response.

---

### GET /api/report-generator/history
List generated reports.

**Auth:** `dmc_officer`  
**Query Params:** `page?`, `limit?`  
**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxxx",
      "reportTitle": "Incident_Summary_Ratnapura_Floods_2026-05-15.pdf",
      "exportFormat": "PDF",
      "generatedAt": "2026-05-15T11:20:00.000Z",
      "fileUrl": "https://res.cloudinary.com/dmc/raw/upload/reports/...",
      "sizeBytes": 4404019
    }
  ]
}
```

---

## USER ROUTES (`/api/users`)

### GET /api/users/me
Get authenticated user's profile.

**Auth:** Any authenticated user  
**Response 200:** User object (without passwordHash).

---

### PATCH /api/users/me
Update own profile.

**Auth:** Any authenticated user  
**Body:** `{ "name": "...", "phoneNumber": "..." }`  
**Response 200:** Updated user.

---

## SOCKET.IO EVENTS

### Namespace: `/officer`

| Event (emit from server) | Payload | Description |
|---|---|---|
| `new_report_submitted` | `{ reportCode, district, hazardType, severity }` | New citizen report arrived |
| `report_verified` | `{ reportId, reportCode }` | Report was verified |
| `warning_broadcast_update` | `{ warningId, channelStats }` | Broadcast delivery progress |
| `shelter_updated` | `{ shelterId, currentOccupancy, status }` | Shelter occupancy changed |
| `team_dispatched` | `{ teamId, teamCode, targetDistrict }` | Rescue team dispatched |
| `supply_delivered` | `{ dispatchCode, destination }` | Supply reached destination |

### Namespace: `/citizen`

| Event (emit from server) | Payload | Description |
|---|---|---|
| `new_warning` | `{ warningCode, hazardType, severity, districts, message }` | New warning issued for citizen's district |
| `warning_cancelled` | `{ warningCode }` | Active warning retracted |

### Client connection:
```typescript
// frontend/src/hooks/useSocket.ts
const socket = io(`${VITE_SOCKET_URL}/officer`, {
  auth: { token: accessToken },
});
```
Server-side: validate token in `io.use()` middleware on connection.
