# PROGRESS.md
## Smart Disaster Early-Warning and Emergency Coordination System
### Group 060 - Implementation Progress Tracker

**Last Updated:** 2026-10-07
**Overall Status:** 10 / 10 Stages Complete - FULLY IMPLEMENTED

---

## Stage Summary

| # | Stage | Status | Notes |
|---|---|---|---|
| 1 | Project Scaffolding | DONE | Monorepo, Vite, Express, TypeScript, Docker Compose |
| 2 | Database & Prisma Schema | DONE | 16 models, 12 enums, migration, seed data |
| 3 | Auth | DONE | JWT backend, login/register frontend, Zustand, ProtectedRoute |
| 4 | UC01 - Issue & Broadcast Hazard Warning | DONE | Backend routes + frontend pages, simulated broadcast |
| 5 | UC02 - Submit & Verify Hazard Report | DONE | Citizen portal + officer verification + local photo upload |
| 6 | UC03 - Coordinate Emergency Resources & Shelters | DONE | Backend + frontend, capacity check, team status lifecycle |
| 7 | UC04 - Analyse Disaster Response & Generate Reports | DONE | Analytics + Recharts charts + CSV export |
| 8 | Mobile Responsiveness | DONE | Citizen portal at 375px with safe-area nav |
| 9 | Integration & Polish | DONE | Toast system, empty states, loading skeletons, citizen pages |
| 10 | PROGRESS.md Final Update | DONE | This file |

---

## How to Run

```bash
# 1. Start database
docker-compose up -d

# 2. Backend (port 3000)
cd backend
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev

# 3. Frontend (port 5173)
cd frontend
npm install
npm run dev
```

All test accounts use password: Password123!

| Role | Email | Portal |
|---|---|---|
| DMC Officer | national@dmc.lk | /officer/dashboard |
| DMC Duty Officer | officer@dmc.lk | /officer/dashboard |
| District Officer | coord@dmc.lk | /officer/coordination |
| Citizen | citizen@test.lk | /citizen/home |
| Rescue Team | teama@rescue.lk | /officer/dashboard |

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Photo storage | Local uploads/ folder | No Cloudinary account required |
| Push notifications | Simulated (DB log only) | No Firebase project required |
| SMS | Simulated (DB log only) | No Twilio account required |
| PDF export | CSV only (pdfkit not needed) | Simpler for uni project |
| Maps | React-Leaflet + OpenStreetMap | Free, no API key |
| Deployment | Local only | Uni submission on localhost |

---

## Stage 1 - Project Scaffolding [DONE]

### Key files
- docker-compose.yml (PostgreSQL 15 :5432, pgAdmin :5050)
- backend/ - Express + TypeScript, Multer local upload, Socket.io
- frontend/ - Vite + React 18 + Tailwind + React Query + Zustand
- @ alias configured, proxy to :3000 in vite.config.ts

### Decisions
- No Cloudinary: local uploads/ folder
- No Firebase FCM: simulated broadcasts
- Local deployment only

---

## Stage 2 - Database & Prisma Schema [DONE]

### Models (16)
User, Citizen, RefreshToken, Hazard, Warning, WarningBroadcast, NotificationLog,
HazardReport, Shelter, ShelterOccupancyLog, RescueTeam, RescueDispatch,
Organization, ReliefSupply, SupplyDispatch, DisasterReport

### Enums (12)
UserRole, HazardType, SeverityLevel, HazardStatus, WarningStatus, ReportStatus,
RescueTeamStatus, ShelterStatus, NotificationChannel, TransitStatus, MissionCriticality, ReportExportFormat

### Migration
- prisma/migrations/20261007060726_init/

### Seed data
- 5 users, 5 shelters, 4 rescue teams, 2 warnings, 5 supplies, 1 org, 1 sample report, 2 notification logs

---

## Stage 3 - Auth [DONE]

### Backend
- JWT access tokens (15m) + refresh tokens (7d)
- POST /api/auth/register, /login, /refresh, /logout, GET /me
- bcrypt password hashing (rounds: 12)
- authenticateToken + authorizeRoles middleware

### Frontend
- Zustand persist store (user, tokens in localStorage)
- Axios 401 interceptor with auto-refresh
- LoginPage with test account hints
- RegisterPage for citizens
- ProtectedRoute with role-based redirect
- OfficerLayout (dark sidebar, role-filtered nav)
- CitizenLayout (mobile header + bottom nav)

### Role redirect map
- CITIZEN -> /citizen/home
- DMC_OFFICER, DMC_DUTY_OFFICER -> /officer/dashboard
- DISTRICT_OFFICER, RESCUE_TEAM -> /officer/dashboard

---

## Stage 4 - UC01: Issue & Broadcast Hazard Warning [DONE]

### Backend
- warning.schema.ts (Zod: createWarning, cancel, escalate)
- warning.service.ts (createAndBroadcast, list, getById, getBroadcastStatus, cancel, getDashboardSummary)
- notification.service.ts (simulateBroadcast - writes to DB, no real FCM)
- warning.controller.ts + warning.routes.ts
- Routes: POST /api/warnings, GET /, GET /:id, GET /:id/broadcast-status, PATCH /:id/cancel, PATCH /:id/escalate

### Frontend
- warnings.api.ts
- SriLankaMap.tsx (React-Leaflet + OpenStreetMap, marker fix for Vite)
- DashboardPage (stat cards + map + live severity monitor)
- WarningsPage (table with filters, cancel action)
- CreateWarningPage (4-step: hazard type, districts, severity, message)
- WarningPreviewPage (channel selection, estimated reach, broadcast button)
- BroadcastStatusPage (5-second polling, channel progress bars)

### Simulated broadcast channels
- SMS_BLAST: 8.2M estimated, ~87-96% simulated delivery
- PUSH_NOTIFICATION: 1.4M estimated
- TV_RADIO: 12M estimated
- COASTAL_SIREN: 500K estimated

---

## Stage 5 - UC02: Submit & Verify Hazard Report [DONE]

### Backend
- report.schema.ts (submitReport, verifyReport, rejectReport)
- report.service.ts (submit, list, getById, verify, reject, getMyReports, markUnderReview)
- report.controller.ts + report.routes.ts
- Local photo upload via Multer (POST /api/reports/upload-photos, max 3 files, 5MB each)
- Auto-marks report UNDER_REVIEW when officer opens detail

### Frontend (Citizen)
- CitizenHomePage (active warning banner + emergency dispatch tools + recent alerts)
- SubmitReportPage (multi-step: hazard type, district, GPS, photos, description)
- ReportSubmittedPage (confirmation with reference ID)
- MyReportsPage (list with status badges)
- useGeolocation hook (browser GPS with timeout + error handling)

### Frontend (Officer)
- ReportsPage (verification queue, 15s auto-refresh, map + table)
- ReportDetailPage (full report view, severity selector, officer notes, approve/reject)

---

## Stage 6 - UC03: Coordinate Emergency Resources & Shelters [DONE]

### Backend
- shelter.schema.ts (createShelter, updateOccupancy, dispatchTeam, createSupplyDispatch)
- shelter.service.ts (capacity check: throws SHELTER_CAPACITY_EXCEEDED if exceeded)
- rescue.service.ts (status check: throws TEAM_UNAVAILABLE if not AVAILABLE)
- supply.service.ts (quantity check: throws INSUFFICIENT_SUPPLY)
- shelter.controller.ts (handles shelters, rescue teams, supplies in one file)
- coordination.routes.ts (mounts at /api/: /shelters, /rescue-teams, /dispatches, /supplies, /supply-dispatches)

### Business logic
- Shelter status auto-sets: FULL when occupancy >= capacity, OPEN when occupancy < capacity
- Rescue team status lifecycle: AVAILABLE -> DISPATCHED -> ON_MISSION -> RETURNING -> AVAILABLE
- Supply quantity decremented on dispatch creation
- All changes wrapped in Prisma transactions for atomicity

### Frontend
- CoordinationDashboardPage (map + operational command summary + quick action buttons)
- SheltersPage (register form modal, occupancy table with progress bars, inline update)
- RescueDispatchPage (team list + mission form with gear checklist)
- SupplyChainPage (inventory cards + dispatch log + create dispatch bill)
- LiveOperationsPage (telemetry bars)

---

## Stage 7 - UC04: Analyse Disaster Response & Generate Reports [DONE]

### Backend
- analytics.service.ts:
  - getOverviewData: warnings count, report verification stats, avg response time, shelter capacity, hazard type breakdown, trend (14 days), high-risk zones
  - getShelterAnalytics: per-shelter capacity rates, occupancy directory
  - getResourceAnalytics: dispatch counts, category breakdown, inventory
  - getAlertTimeline: per-warning channel delivery metrics
- export.service.ts: CSV generation (jsonToCsv), file written to local uploads/, returns file URL
- analytics.routes.ts: GET /api/analytics/overview, /shelters, /resources, /alert-timeline, POST /generate, GET /history

### Frontend
- AnalyticsDashboardPage: 5 KPI cards, horizontal bar chart (warnings by type), donut chart (verification rate), bar chart (30-day trend)
- ShelterAnalyticsPage: occupancy directory table with capacity bars
- ResourceAnalyticsPage: category tiles, inventory table
- AlertTimelinePage: chronological cards with per-channel delivery stats
- ReportBuilderPage: 4 templates, district scope selector, CSV format, recent export logs with download links

---

## Stage 8 - Mobile Responsiveness [DONE]

- CitizenLayout: fixed bottom nav with env(safe-area-inset-bottom), pb-20 main content, sticky header z-40
- Report CTA in bottom nav uses a raised amber circle (+) button
- All citizen pages: max-w-screen-sm mx-auto px-4 wrapper
- SubmitReportPage: mobile chip wrapping, py-4 submit button for easy tapping
- Bottom nav tap targets: 44px minimum

---

## Stage 9 - Integration & Polish [DONE]

### Toast system
- Toast.tsx: ToastItem (4s auto-dismiss) + ToastContainer (fixed bottom-right desktop, bottom-center mobile)
- notificationStore.ts: Zustand store (addToast, dismissToast)
- useToast.ts: convenience hook (success, error, info)
- Wired in App.tsx at root level

### Shared components
- EmptyState.tsx: icon + title + description + optional action button
- SkeletonRow.tsx: animated pulse rows for table loading, SkeletonCard for card loading

### Remaining citizen pages
- AlertsPage: active warnings list with severity badges, 30s auto-refresh
- SheltersMapPage: Leaflet map with shelter pins + list below
- ProfilePage: user info card + logout button

---

## Complete File List

### Backend (src/)
- app.ts, index.ts, socket.ts
- config/database.ts, config/upload.ts (local Multer)
- middleware/authenticateToken.ts, authorizeRoles.ts, validateRequest.ts, errorHandler.ts
- utils/asyncHandler.ts, apiResponse.ts, codeGenerator.ts
- types/index.ts
- schemas/auth.schema.ts, warning.schema.ts, report.schema.ts, shelter.schema.ts
- services/auth.service.ts, warning.service.ts, notification.service.ts, report.service.ts
- services/shelter.service.ts, rescue.service.ts, supply.service.ts
- services/analytics.service.ts, export.service.ts
- controllers/auth.controller.ts, warning.controller.ts, report.controller.ts
- controllers/shelter.controller.ts, analytics.controller.ts
- routes/index.ts, auth.routes.ts, warning.routes.ts, report.routes.ts
- routes/coordination.routes.ts, analytics.routes.ts
- prisma/schema.prisma, seed.ts

### Frontend (src/)
- App.tsx, main.tsx, index.css
- lib/utils.ts, lib/constants.ts
- types/index.ts
- api/client.ts, auth.api.ts, warnings.api.ts, reports.api.ts, shelters.api.ts, analytics.api.ts
- stores/authStore.ts, notificationStore.ts
- hooks/useAuth.ts, useGeolocation.ts, useToast.ts
- router/ProtectedRoute.tsx
- components/layout/OfficerLayout.tsx, CitizenLayout.tsx
- components/shared/SeverityBadge.tsx, StatusBadge.tsx, StatCard.tsx, LoadingSpinner.tsx
- components/shared/PageHeader.tsx, SriLankaMap.tsx, Toast.tsx, EmptyState.tsx, SkeletonRow.tsx
- pages/auth/LoginPage.tsx, RegisterPage.tsx
- pages/officer/DashboardPage.tsx
- pages/officer/warnings/WarningsPage.tsx, CreateWarningPage.tsx, WarningPreviewPage.tsx, BroadcastStatusPage.tsx
- pages/officer/reports/ReportsPage.tsx, ReportDetailPage.tsx
- pages/officer/coordination/CoordinationDashboardPage.tsx, SheltersPage.tsx, RescueDispatchPage.tsx, SupplyChainPage.tsx, LiveOperationsPage.tsx
- pages/officer/analytics/AnalyticsDashboardPage.tsx, ShelterAnalyticsPage.tsx, ResourceAnalyticsPage.tsx, AlertTimelinePage.tsx, ReportBuilderPage.tsx
- pages/citizen/CitizenHomePage.tsx, SubmitReportPage.tsx, ReportSubmittedPage.tsx, MyReportsPage.tsx, AlertsPage.tsx, SheltersMapPage.tsx, ProfilePage.tsx