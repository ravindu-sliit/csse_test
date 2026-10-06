# UC01 SPEC — Issue & Broadcast Hazard Warning
## Smart Disaster Early-Warning and Emergency Coordination System
### Group 060 | Member: Sooriyaarachchi E A R N (IT23829510)

---

## 1. Use Case Summary

| Field | Value |
|---|---|
| Use Case ID | UC01 |
| Name | Issue & Broadcast Hazard Warning |
| Primary Actor | DMC Officer (or DMC Duty Officer) |
| Secondary Actors | Push Notification Service (FCM), SMS Gateway (simulated), Citizen (receives notification) |
| Goal | Create an official hazard warning, configure its target geography and severity, and broadcast it to citizens through multiple notification channels |
| Preconditions | User is authenticated with role `dmc_officer` or `dmc_duty_officer`. An active hazard situation exists (may or may not be tied to a verified HazardReport). |
| Postconditions | A `Warning` record exists in the database with status `ACTIVE`. Broadcast channel records are created. Citizens in target districts receive notifications. Delivery stats are tracked. |
| Trigger | Officer identifies an imminent hazard requiring public notification |

---

## 2. Main Flow (Happy Path)

| Step | Actor | Action | System Response |
|---|---|---|---|
| 1 | DMC Officer | Opens the Officer Portal and navigates to Dashboard | System displays Emergency Command Dashboard with active warnings count, pending reports, shelters, and team stats. Sri Lanka district hazard map is shown. |
| 2 | DMC Officer | Clicks "Issue New Hazard Warning →" button | System navigates to Create Hazard Warning page |
| 3 | DMC Officer | Selects hazard classification (e.g., Flood) from the type selector | Selected type is highlighted. UI updates to show relevant severity options. |
| 4 | DMC Officer | Selects target districts (e.g., Colombo, Gampaha) and optionally a river basin | Districts are highlighted/checked. River basin dropdown updates based on district selection. |
| 5 | DMC Officer | Selects severity level (Watch / Advisory / Warning / Emergency) | Severity card highlights with colour (green/blue/amber/red) |
| 6 | DMC Officer | Types the broadcast notification message (max 300 characters) | Character counter updates in real-time. |
| 7 | DMC Officer | Clicks "Proceed to Warning Preview →" | System validates all fields. On success, navigates to Broadcast Preview & Verification page. |
| 8 | DMC Officer | Reviews citizen mobile simulation and selects broadcast channels | Citizen mobile preview shows the notification as it will appear. Estimated reach is calculated dynamically. |
| 9 | DMC Officer | Clicks "AUTHORIZE & BROADCAST NOW" | System creates Warning record in DB. Initiates broadcast to all selected channels. Returns warning ID. |
| 10 | System | Sends FCM push notifications to registered devices in target districts | Delivery receipts returned from FCM. |
| 11 | System | Creates SMS log records in `notification_logs` table | SMS delivery simulated; delivery count recorded. |
| 12 | System | Updates `warning_broadcasts` records with delivery progress | |
| 13 | System | Navigates officer to Early Warning Dispatch Status page | Officer sees real-time delivery progress per channel (% delivered), total reach count, confirmed deliveries, failed/no-acknowledgement count. |

---

## 3. Alternative Flows

### A1 — Modify Warning Before Broadcast
- At Step 8, officer clicks "← Back & Edit Warning"
- System returns to Create Hazard Warning page with all fields pre-filled
- Officer modifies any field and re-clicks "Proceed to Warning Preview →"

### A2 — Warning Already Exists for Same District
- At Step 9, if an `ACTIVE` warning of the same `hazardType` and overlapping `targetDistricts` exists
- System displays a confirmation dialog: "An active [Flood] warning already exists for Colombo. Do you want to issue an additional warning?"
- If confirmed, proceeds normally
- If cancelled, returns to form

### A3 — Cease & Retract Warning
- On the Dispatch Status page, officer clicks "CEASE & RETRACT WARNING"
- System sets warning `status` to `CANCELLED`
- System emits a Socket.io event to connected citizen clients to remove the warning banner
- System does NOT delete broadcast records — they remain as an audit trail

### A4 — Escalate to Military Mobilization
- On the Dispatch Status page, officer clicks "ESCALATE TO MILITARY MOBILIZATION"
- System creates a new warning with `severityLevel = EMERGENCY` (if not already)
- System adds a note to the activity log: "Escalated to military mobilization"
- In the current implementation, this is a flag/label — actual military dispatch is out of scope

---

## 4. Exception Flows

### E1 — Validation Error
- Trigger: Officer clicks "Proceed to Warning Preview →" without selecting hazard type, districts, severity, or message
- System highlights missing fields with red borders
- Error messages shown inline: "Please select at least one district", "Severity level is required", "Message is required"
- Navigation blocked until all required fields are valid

### E2 — Broadcast Channel Failure
- Trigger: FCM returns error for push notification dispatch
- System marks that broadcast channel as `FAILED` in `warning_broadcasts`
- Other channels continue
- Officer sees failed channel in Dispatch Status page with "FAILED" label
- Warning record itself remains `ACTIVE`

### E3 — Session Expired During Broadcast
- Trigger: JWT expires between form fill and broadcast initiation
- System returns 401 response
- Frontend interceptor catches 401, attempts refresh token
- If refresh fails, redirects officer to login page
- Warning form data is preserved in React state so officer can re-authenticate and retry

---

## 5. UI Pages & Components (UC01)

### Page 1: Emergency Command Dashboard (`/officer/dashboard`)
**Components:**
- `StatCard` × 4: Active Warnings, Pending Reports, Shelters Open, Teams Deployed
- `SriLankaMap` with district pins showing active hazards
- `LiveSeverityMonitor` panel (right side) — live list of active warnings with colour-coded severity
- `ActivityLog` — scrollable list of timestamped events
- `IssueWarningButton` — large red CTA button: "Issue New Hazard Warning →"

**Data Sources:**
- `GET /api/analytics/dashboard-summary` — stats cards
- `GET /api/warnings?status=active` — map pins and severity monitor
- `GET /api/activity-log` — activity log entries

### Page 2: Create Hazard Warning (`/officer/warnings/create`)
**Components:**
- `HazardTypeSelector` — grid of type cards (Flood, Landslide, Cyclone, Tsunami, Drought, Lightning, Fallen Tree, Road Block). Single select.
- `DistrictSelector` — multi-select chips for all 25 districts
- `RiverBasinSelect` — dropdown, optional
- `SeveritySelector` — 4 cards: Watch (green), Advisory (blue), Warning (amber), Emergency (red). Single select.
- `BroadcastMessageInput` — textarea, 300 char limit with live counter
- Form action buttons: "Cancel & Reset" (clears form), "Proceed to Warning Preview →"

**Validation (Zod schema `createWarningSchema`):**
```typescript
{
  hazardType: required enum
  severityLevel: required enum
  targetDistricts: required, min 1 district
  targetRiverBasin: optional string
  message: required, min 10 chars, max 300 chars
  broadcastChannels: min 1 channel (set on next page)
  expiryTime: optional ISO datetime
}
```

### Page 3: Broadcast Preview & Verification (`/officer/warnings/preview`)
- State passed via React Router state (no separate API call needed until confirmed)
- `CitizenMobileSimulation` — phone frame showing exactly how notification appears
- `BroadcastChannelList` — 4 channels with checkboxes and subscriber counts
- `EstimatedReachPanel` — computed reach total and coverage percentage
- Action buttons: "← Back & Edit Warning", "⚡ AUTHORIZE & BROADCAST NOW"

### Page 4: Early Warning Dispatch Status (`/officer/warnings/:id/status`)
**Components:**
- Warning header: warning code, title, "BROADCAST IN PROGRESS" badge
- `ChannelDeliveryProgress` — horizontal progress bars per channel (SMS %, App Push %, Broadcaster status)
- `DeliveryAggregates` — Total Target Citizens, Confirmed Deliveries, Failed/No Acknowledgement
- Action buttons: "CEASE & RETRACT WARNING", "ESCALATE TO MILITARY MOBILIZATION"

**Data Sources (polling every 5 seconds):**
- `GET /api/warnings/:id/broadcast-status`

### Page 5: Active Warnings Registry (`/officer/warnings`)
**Components:**
- Filter bar: Filter by Hazard (dropdown), Filter by Status (dropdown), Search input
- `WarningsTable` with columns: Warning ID, Hazard Classification, Severity (badge), Affected Districts, Issued Timestamp, Status, Actions (View Log | Manage)

---

## 6. API Endpoints (UC01)

| Method | Endpoint | Auth Role | Description |
|---|---|---|---|
| `POST` | `/api/warnings` | dmc_officer, dmc_duty_officer | Create warning and initiate broadcast |
| `GET` | `/api/warnings` | any officer | List all warnings (with filters) |
| `GET` | `/api/warnings/:id` | any officer | Get single warning details |
| `GET` | `/api/warnings/:id/broadcast-status` | dmc_officer, dmc_duty_officer | Real-time broadcast delivery stats |
| `PATCH` | `/api/warnings/:id/cancel` | dmc_officer, dmc_duty_officer | Cancel/retract a warning |
| `PATCH` | `/api/warnings/:id/escalate` | dmc_officer, dmc_duty_officer | Escalate severity |
| `GET` | `/api/analytics/dashboard-summary` | any officer | Stats for dashboard cards |

**POST /api/warnings — Request Body:**
```json
{
  "hazardType": "flood",
  "severityLevel": "emergency",
  "targetDistricts": ["Colombo", "Gampaha"],
  "targetRiverBasin": "Kelani River Basin",
  "message": "EMERGENCY RED ALERT: Kelani River water levels have exceeded danger threshold in Colombo & Gampaha districts. Residents in low-lying zones must evacuate immediately.",
  "broadcastChannels": ["sms_blast", "push_notification", "tv_radio"],
  "expiryTime": "2026-10-08T18:00:00.000Z"
}
```

**POST /api/warnings — Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "warningCode": "DMC-2026-F98",
    "hazardType": "flood",
    "severityLevel": "emergency",
    "status": "active",
    "issuedTime": "2026-10-07T10:24:00.000Z",
    "targetDistricts": ["Colombo", "Gampaha"],
    "estimatedReach": 9600000
  },
  "message": "Warning created and broadcast initiated"
}
```

---

## 7. Sequence Diagram (Text Description)

```
DMC Officer → Warning Dashboard UI : openDashboard()
Warning Dashboard UI → Warning Controller : GET /api/analytics/dashboard-summary
Warning Controller → Analytics Service : getDashboardSummary()
Analytics Service → Database : query warnings, reports, shelters, teams
Database → Analytics Service : counts
Analytics Service → Warning Controller : summaryData
Warning Controller → Warning Dashboard UI : 200 { activeWarnings, pendingReports, ... }
Warning Dashboard UI → DMC Officer : render dashboard

DMC Officer → Warning Form UI : clickIssueWarning()
Warning Form UI → DMC Officer : render CreateWarningPage

DMC Officer → Warning Form UI : selectHazardType("flood")
DMC Officer → Warning Form UI : selectDistricts(["Colombo", "Gampaha"])
DMC Officer → Warning Form UI : selectSeverity("emergency")
DMC Officer → Warning Form UI : typeMessage("EMERGENCY RED ALERT: ...")
DMC Officer → Warning Form UI : clickProceedToPreview()

Warning Form UI → Warning Form UI : validateForm() [Zod]
  alt [Valid]
    Warning Form UI → Broadcast Preview UI : navigateWithState(formData)
    Broadcast Preview UI → DMC Officer : render preview + channel selection
    
    DMC Officer → Broadcast Preview UI : selectChannels(["sms_blast", "push_notification", "tv_radio"])
    DMC Officer → Broadcast Preview UI : clickAuthorizeAndBroadcast()
    
    Broadcast Preview UI → Warning Controller : POST /api/warnings { dto }
    Warning Controller → Warning Service : createAndBroadcast(dto, officerId)
    Warning Service → Database : createWarning()
    Database → Warning Service : warning record
    Warning Service → Notification Service : broadcastWarning(warning, channels)
    Notification Service → Firebase FCM : sendMulticast(tokens, message)
    Firebase FCM → Notification Service : batchResponse { successCount, failureCount }
    Notification Service → Database : createNotificationLog()
    Notification Service → Database : updateWarningBroadcast(status, counts)
    Warning Service → Warning Controller : { warning, broadcastResults }
    Warning Controller → Broadcast Preview UI : 201 { warningId, ... }
    Broadcast Preview UI → DMC Officer : navigate to /warnings/:id/status
    
  else [Invalid]
    Warning Form UI → DMC Officer : showValidationErrors()
  end

loop [every 5 seconds while broadcast active]
  Dispatch Status UI → Warning Controller : GET /api/warnings/:id/broadcast-status
  Warning Controller → Warning Service : getBroadcastStatus(id)
  Warning Service → Database : query warning_broadcasts, notification_logs
  Database → Warning Service : channelStatuses
  Warning Service → Warning Controller : broadcastStatus
  Warning Controller → Dispatch Status UI : 200 { channels, confirmedReach, failedCount }
  Dispatch Status UI → DMC Officer : update progress bars
end
```

---

## 8. State Management (Frontend)

- Warning form state managed by **React Hook Form** — no Zustand needed.
- Form data passed to Preview page via **React Router state** (`useNavigate` with state).
- After broadcast, warning list is **invalidated** in React Query:
  ```typescript
  queryClient.invalidateQueries({ queryKey: ['warnings'] });
  ```
- Real-time delivery status uses **polling** via React Query's `refetchInterval: 5000` — NOT Socket.io (simpler for this specific case).

---

## 9. Business Logic Notes

- Warning code is auto-generated by the server: `DMC-{YEAR}-{TYPE_INITIAL}{SEQUENCE}` e.g. `DMC-2026-F98`.
- Estimated reach is calculated server-side: sum of registered citizens + registered devices in `targetDistricts`.
- The message is sent as-is to FCM and stored in `notification_logs`. No translation is performed.
- A warning cannot be re-broadcast once `status = CANCELLED`. The officer must create a new warning.
- `expiryTime` is optional. If not set, warning remains `ACTIVE` indefinitely until manually cancelled.
- Auto-expiry cron job (if implemented): runs every 15 minutes, sets warnings with `expiryTime < now()` to `EXPIRED`.
