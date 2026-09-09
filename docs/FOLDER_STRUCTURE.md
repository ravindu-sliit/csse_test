# FOLDER STRUCTURE
## Smart Disaster Early-Warning and Emergency Coordination System
### Group 060

---

## Root Layout

```
csse_test/
├── backend/                    # Node.js + Express REST API
├── frontend/                   # React + TypeScript web app
├── docs/                       # All specification documents
├── references/                 # Original assignment diagrams, wireframes, PDF
├── docker-compose.yml          # PostgreSQL + pgAdmin local dev
├── .gitignore
└── README.md
```

---

## Backend Structure

```
backend/
├── prisma/
│   ├── schema.prisma           # Database schema (single source of truth)
│   ├── seed.ts                 # Seed script with sample data
│   └── migrations/             # Auto-generated Prisma migrations
│       └── YYYYMMDDHHMMSS_init/
│           └── migration.sql
│
├── src/
│   ├── index.ts                # Express app entry point
│   ├── app.ts                  # Express app setup (middleware, routes)
│   ├── socket.ts               # Socket.io server setup and event handlers
│   │
│   ├── config/
│   │   ├── database.ts         # Prisma client singleton
│   │   ├── cloudinary.ts       # Cloudinary SDK config
│   │   ├── firebase.ts         # Firebase Admin SDK init
│   │   └── env.ts              # Validated env vars (using Zod)
│   │
│   ├── middleware/
│   │   ├── authenticateToken.ts  # JWT verification middleware
│   │   ├── authorizeRoles.ts     # Role-based access control middleware
│   │   ├── validateRequest.ts    # Zod schema validation middleware
│   │   ├── uploadMiddleware.ts   # Multer config for photo uploads
│   │   └── errorHandler.ts       # Global error handler
│   │
│   ├── routes/
│   │   ├── index.ts            # Mounts all route modules under /api
│   │   ├── auth.routes.ts      # POST /api/auth/...
│   │   ├── hazard.routes.ts    # GET/POST /api/hazards/...
│   │   ├── warning.routes.ts   # GET/POST /api/warnings/...
│   │   ├── report.routes.ts    # GET/POST /api/reports/...
│   │   ├── shelter.routes.ts   # GET/POST/PUT /api/shelters/...
│   │   ├── rescue.routes.ts    # GET/POST/PUT /api/rescue-teams/...
│   │   ├── supply.routes.ts    # GET/POST/PUT /api/supplies/...
│   │   ├── dispatch.routes.ts  # POST /api/dispatches/...
│   │   ├── analytics.routes.ts # GET /api/analytics/...
│   │   ├── report-gen.routes.ts # GET /api/report-generator/...
│   │   └── user.routes.ts      # GET/PUT /api/users/...
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── hazard.controller.ts
│   │   ├── warning.controller.ts
│   │   ├── report.controller.ts
│   │   ├── shelter.controller.ts
│   │   ├── rescue.controller.ts
│   │   ├── supply.controller.ts
│   │   ├── dispatch.controller.ts
│   │   ├── analytics.controller.ts
│   │   ├── report-gen.controller.ts
│   │   └── user.controller.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts         # Login, register, token refresh
│   │   ├── warning.service.ts      # Warning creation + broadcast logic
│   │   ├── notification.service.ts # FCM push + SMS log dispatch
│   │   ├── report.service.ts       # Hazard report submit + verify
│   │   ├── shelter.service.ts      # Shelter CRUD + occupancy management
│   │   ├── rescue.service.ts       # Rescue team CRUD + dispatch
│   │   ├── supply.service.ts       # Relief supply CRUD + allocation
│   │   ├── analytics.service.ts    # Stats calculation queries
│   │   └── export.service.ts       # PDF/Excel/CSV generation
│   │
│   ├── schemas/                    # Zod validation schemas (shared types)
│   │   ├── auth.schema.ts
│   │   ├── warning.schema.ts
│   │   ├── report.schema.ts
│   │   ├── shelter.schema.ts
│   │   ├── rescue.schema.ts
│   │   ├── supply.schema.ts
│   │   └── analytics.schema.ts
│   │
│   ├── types/
│   │   ├── express.d.ts            # Augment Express Request with user property
│   │   └── index.ts                # Shared TypeScript types
│   │
│   └── utils/
│       ├── apiResponse.ts          # Standardised API response helpers
│       ├── asyncHandler.ts         # Wraps async route handlers to catch errors
│       ├── logger.ts               # Winston logger config
│       └── dateHelpers.ts          # Date formatting utilities
│
├── .env                            # Local environment variables (gitignored)
├── .env.example                    # Template for env vars
├── tsconfig.json
├── package.json
└── nodemon.json                    # Dev watch config
```

---

## Frontend Structure

```
frontend/
├── public/
│   ├── geojson/
│   │   └── sri-lanka-districts.geojson   # Sri Lanka district boundaries for maps
│   ├── firebase-messaging-sw.js          # FCM service worker
│   └── favicon.ico
│
├── src/
│   ├── main.tsx                    # App entry point
│   ├── App.tsx                     # Root component with router
│   ├── vite-env.d.ts
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui base components (copied in)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── card.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── toast.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── OfficerLayout.tsx   # Sidebar + topbar wrapper for officer portal
│   │   │   ├── CitizenLayout.tsx   # Bottom nav + header for citizen portal
│   │   │   ├── OfficerSidebar.tsx
│   │   │   ├── OfficerTopbar.tsx
│   │   │   └── CitizenBottomNav.tsx
│   │   │
│   │   ├── shared/
│   │   │   ├── SeverityBadge.tsx   # Coloured badge for Watch/Advisory/Warning/Emergency
│   │   │   ├── StatusBadge.tsx     # Generic status badge (Active/Expired/Cancelled etc)
│   │   │   ├── SriLankaMap.tsx     # Reusable Leaflet map with district boundaries
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ErrorMessage.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   └── StatCard.tsx        # Dashboard summary card (number + label + colour dot)
│   │   │
│   │   ├── warnings/
│   │   │   ├── WarningForm.tsx
│   │   │   ├── WarningPreview.tsx
│   │   │   ├── BroadcastChannelList.tsx
│   │   │   ├── BroadcastStatusPanel.tsx
│   │   │   └── WarningsTable.tsx
│   │   │
│   │   ├── reports/
│   │   │   ├── HazardReportForm.tsx        # Citizen report form (multi-step)
│   │   │   ├── HazardTypeSelector.tsx
│   │   │   ├── PhotoUploader.tsx
│   │   │   ├── GPSLocationPicker.tsx
│   │   │   ├── ReportSubmittedConfirmation.tsx
│   │   │   ├── VerificationQueue.tsx       # DMC duty officer queue
│   │   │   ├── VerificationDetail.tsx
│   │   │   └── ReportSpatialMap.tsx
│   │   │
│   │   ├── shelters/
│   │   │   ├── ShelterForm.tsx
│   │   │   ├── ShelterTable.tsx
│   │   │   ├── OccupancyBar.tsx
│   │   │   └── ShelterCard.tsx
│   │   │
│   │   ├── rescue/
│   │   │   ├── RescueTeamList.tsx
│   │   │   ├── DispatchForm.tsx
│   │   │   └── TeamStatusBadge.tsx
│   │   │
│   │   ├── supply/
│   │   │   ├── SupplyInventoryTable.tsx
│   │   │   ├── SupplyDispatchForm.tsx
│   │   │   └── SupplyLogTable.tsx
│   │   │
│   │   └── analytics/
│   │       ├── WarningsByHazardChart.tsx
│   │       ├── VerificationRateDonut.tsx
│   │       ├── CitizenReportsTrendChart.tsx
│   │       ├── IncidentDensityMap.tsx
│   │       ├── ShelterOccupancyChart.tsx
│   │       ├── ResourceDistributionMap.tsx
│   │       ├── AlertTimelineList.tsx
│   │       └── ReportBuilderForm.tsx
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   │
│   │   ├── officer/                # Officer portal pages
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── warnings/
│   │   │   │   ├── WarningsPage.tsx          # Active warnings registry
│   │   │   │   ├── CreateWarningPage.tsx
│   │   │   │   ├── WarningPreviewPage.tsx
│   │   │   │   └── BroadcastStatusPage.tsx
│   │   │   ├── reports/
│   │   │   │   ├── ReportsPage.tsx           # Verification queue
│   │   │   │   └── ReportDetailPage.tsx
│   │   │   ├── coordination/
│   │   │   │   ├── CoordinationDashboardPage.tsx
│   │   │   │   ├── SheltersPage.tsx
│   │   │   │   ├── RescueDispatchPage.tsx
│   │   │   │   ├── SupplyChainPage.tsx
│   │   │   │   └── LiveOperationsPage.tsx
│   │   │   └── analytics/
│   │   │       ├── AnalyticsDashboardPage.tsx
│   │   │       ├── ShelterAnalyticsPage.tsx
│   │   │       ├── ResourceAnalyticsPage.tsx
│   │   │       ├── AlertTimelinePage.tsx
│   │   │       └── ReportBuilderPage.tsx
│   │   │
│   │   └── citizen/                # Citizen portal pages
│   │       ├── CitizenHomePage.tsx
│   │       ├── AlertsPage.tsx
│   │       ├── SubmitReportPage.tsx
│   │       ├── MyReportsPage.tsx
│   │       ├── SheltersMapPage.tsx
│   │       └── ProfilePage.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts              # Auth state from Zustand
│   │   ├── useSocket.ts            # Socket.io connection hook
│   │   ├── useGeolocation.ts       # Browser GPS hook
│   │   ├── useOfflineReports.ts    # IndexedDB offline queue hook
│   │   └── useToast.ts
│   │
│   ├── stores/
│   │   ├── authStore.ts            # Zustand auth store
│   │   └── notificationStore.ts    # Zustand notification/toast store
│   │
│   ├── api/
│   │   ├── client.ts               # Axios instance with interceptors
│   │   ├── auth.api.ts
│   │   ├── warnings.api.ts
│   │   ├── reports.api.ts
│   │   ├── shelters.api.ts
│   │   ├── rescue.api.ts
│   │   ├── supplies.api.ts
│   │   └── analytics.api.ts
│   │
│   ├── types/
│   │   └── index.ts                # All TypeScript interfaces (User, Warning, Report, etc.)
│   │
│   ├── lib/
│   │   ├── utils.ts                # cn() helper (Tailwind class merge), formatDate, etc.
│   │   ├── constants.ts            # DISTRICTS, HAZARD_TYPES, SEVERITY_LEVELS, etc.
│   │   └── firebase.ts             # Firebase client SDK init
│   │
│   └── router/
│       ├── index.tsx               # createBrowserRouter definition
│       └── ProtectedRoute.tsx      # Role-based route guard
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env
├── .env.example
└── package.json
```

---

## Docs Structure

```
docs/
├── PROJECT_OVERVIEW.md         # System purpose, scope, users, rules
├── TECH_STACK.md               # All technology decisions with rationale
├── FOLDER_STRUCTURE.md         # This file
├── DATABASE_SCHEMA.md          # All tables, columns, types, relationships
├── API_SPEC.md                 # All REST endpoints
├── FRONTEND_SPEC.md            # Pages, components, routing, state
├── CODING_CONVENTIONS.md       # Naming, patterns, style rules
├── UC01_SPEC.md                # Issue & Broadcast Hazard Warning
├── UC02_SPEC.md                # Submit & Verify Hazard Report
├── UC03_SPEC.md                # Coordinate Emergency Resources & Shelters
└── UC04_SPEC.md                # Analyse Disaster Response & Generate Reports
```

---

## Naming Conventions for Files

| Type | Convention | Example |
|---|---|---|
| React components | PascalCase.tsx | `SeverityBadge.tsx` |
| React pages | PascalCase + Page suffix | `CreateWarningPage.tsx` |
| Hooks | camelCase with `use` prefix | `useGeolocation.ts` |
| API modules | camelCase + `.api.ts` | `warnings.api.ts` |
| Backend routes | camelCase + `.routes.ts` | `warning.routes.ts` |
| Backend controllers | camelCase + `.controller.ts` | `warning.controller.ts` |
| Backend services | camelCase + `.service.ts` | `warning.service.ts` |
| Zod schemas | camelCase + `.schema.ts` | `warning.schema.ts` |
| Constants | UPPER_SNAKE_CASE in `constants.ts` | `HAZARD_TYPES` |
| CSS classes | Tailwind utilities only, no custom class names unless using `@layer components` |
