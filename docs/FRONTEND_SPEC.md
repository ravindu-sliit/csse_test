# FRONTEND SPEC
## Smart Disaster Early-Warning and Emergency Coordination System
### Group 060

---

## 1. Application Structure

There is ONE React application (`/frontend`) that serves two distinct portals based on user role:
- **Officer Portal** — for `dmc_officer`, `dmc_duty_officer`, `district_officer`, `rescue_team`
- **Citizen Portal** — for `citizen`

After login, the router detects the user role and redirects to the appropriate portal. Both portals share the same Vite build, the same auth store, and the same API client.

---

## 2. Routing

### Route Tree

```
/                        → redirect to /login
/login                   → LoginPage
/register                → RegisterPage

/officer/                → OfficerLayout (requires: dmc_officer | dmc_duty_officer | district_officer | rescue_team)
  dashboard              → DashboardPage (UC01 entry point)
  warnings/              → WarningsPage (Active Warnings Registry)
  warnings/create        → CreateWarningPage
  warnings/preview       → WarningPreviewPage (state from create page)
  warnings/:id/status    → BroadcastStatusPage
  warnings/:id           → WarningDetailPage
  reports/               → ReportsPage (Verification Queue — dmc_duty_officer only)
  reports/:id            → ReportDetailPage
  coordination/          → CoordinationDashboardPage (district_officer)
  coordination/shelters  → SheltersPage
  coordination/rescue    → RescueDispatchPage
  coordination/supply    → SupplyChainPage
  coordination/live-ops  → LiveOperationsPage
  analytics/             → AnalyticsDashboardPage (dmc_officer only)
  analytics/shelters     → ShelterAnalyticsPage
  analytics/resources    → ResourceAnalyticsPage
  analytics/timeline     → AlertTimelinePage
  analytics/report-builder → ReportBuilderPage
  settings               → SettingsPage

/citizen/                → CitizenLayout (requires: citizen)
  home                   → CitizenHomePage
  alerts                 → AlertsPage
  report                 → SubmitReportPage
  report/submitted       → ReportSubmittedPage
  my-reports             → MyReportsPage
  map                    → SheltersMapPage
  profile                → ProfilePage
```

### ProtectedRoute Component
```typescript
// frontend/src/router/ProtectedRoute.tsx
interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  redirectTo?: string;
}

export function ProtectedRoute({ allowedRoles, redirectTo = '/login' }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!user) return <Navigate to={redirectTo} replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
}
```

### Role-based redirect after login
```typescript
// After successful login, redirect based on role:
const roleRedirectMap: Record<UserRole, string> = {
  citizen:           '/citizen/home',
  dmc_officer:       '/officer/dashboard',
  dmc_duty_officer:  '/officer/dashboard',
  district_officer:  '/officer/coordination',
  rescue_team:       '/officer/coordination',
};
navigate(roleRedirectMap[user.role], { replace: true });
```

---

## 3. Layouts

### OfficerLayout (`/src/components/layout/OfficerLayout.tsx`)
- Sidebar (220px wide, dark `#1a1f2e` background) + main content area
- Topbar: app logo (DMC Sri Lanka), active page title, user avatar + name/role (top right)
- Sidebar navigation items depend on role:

**dmc_officer / dmc_duty_officer sidebar:**
```
Dashboard         (grid icon)
Warnings      [3] (bell icon + badge)
Reports           (file icon)
Coordination      (users icon)
Shelters          (home icon)
Analytics         (bar chart icon)
Settings          (gear icon)
```

**district_officer sidebar:**
```
Dashboard         (grid icon)
Warnings          (bell icon)
Shelters          (home icon)
Rescue Dispatch   (team icon)
Supply Chain      (lightning icon)
Live Operations   (circle icon)
Settings          (gear icon)
```

**Active nav item:** White text on dark background with left border accent in primary colour.

### CitizenLayout (`/src/components/layout/CitizenLayout.tsx`)
- Header (DMC logo + notification bell icon)
- Main content area (scrollable, full height minus header + bottom nav)
- Bottom navigation tabs (5 icons): Home, Alerts, Report (+ FAB), Map, Profile

---

## 4. Shared Components

### SeverityBadge
```typescript
// /src/components/shared/SeverityBadge.tsx
interface SeverityBadgeProps {
  level: SeverityLevel;
  size?: 'sm' | 'md' | 'lg';
}
// Renders: coloured pill badge with label text
// watch → green, advisory → blue, warning → amber, emergency → red
```

### StatusBadge
```typescript
interface StatusBadgeProps {
  status: string;
  colorMap?: Record<string, string>; // custom colour mapping
}
// Default colour map covers: active, expired, cancelled, pending_verification,
// under_review, verified, rejected, open, full, closed, available, dispatched,
// en_route, on_mission, returning, in_transit, preparing, delivered
```

### SriLankaMap
```typescript
interface SriLankaMapProps {
  pins?: MapPin[];           // Array of positioned markers
  height?: string;           // CSS height, default "400px"
  onPinClick?: (pin: MapPin) => void;
  heatData?: DistrictHeatData[]; // For analytics heatmap
  showLegend?: boolean;
}
// Uses react-leaflet with OpenStreetMap tiles
// GeoJSON overlay for district boundaries from /public/geojson/sri-lanka-districts.geojson
// District boundaries rendered as thin white lines on blue fill
```

### StatCard
```typescript
interface StatCardProps {
  label: string;
  value: string | number;
  dot?: 'red' | 'orange' | 'green' | 'blue' | 'purple';
  subtext?: string;          // e.g. "+12 This Month" or "89% Verified"
}
// White card, stat value in large bold font, label in grey, dot indicator top-right
```

### PageHeader
```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode; // Button(s) on the right
}
```

---

## 5. Auth State (Zustand)

```typescript
// /src/stores/authStore.ts
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<string | null>;
  setUser: (user: User, token: string) => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      // ...implementations
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
);
```

The `useAuth` hook wraps this store:
```typescript
// /src/hooks/useAuth.ts
export function useAuth() {
  const { user, accessToken, isLoading, login, logout } = useAuthStore();
  const isAuthenticated = !!user && !!accessToken;
  return { user, accessToken, isLoading, isAuthenticated, login, logout };
}
```

---

## 6. API Client (Axios)

```typescript
// /src/api/client.ts
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle 401 → refresh token or logout
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newToken = await useAuthStore.getState().refreshAccessToken();
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(error.config);
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 7. React Query Setup

```typescript
// /src/main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,        // 2 minutes
      gcTime: 1000 * 60 * 10,          // 10 minutes
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});
```

### Query Key Conventions
```typescript
// Always use arrays for query keys to enable targeted invalidation
['warnings']                            // all warnings
['warnings', { status: 'active' }]     // filtered
['warnings', warningId]                 // single
['reports']                             // all reports
['reports', { status: 'pending_verification' }]
['reports', reportId]
['shelters', { district: 'Colombo' }]
['shelters', shelterId]
['rescue-teams']
['supplies']
['analytics', 'overview', '30d']
['analytics', 'shelters', '30d']
```

---

## 8. UC01 — Pages Specification

### DashboardPage (`/officer/dashboard`)
```typescript
// Queries:
const { data: summary } = useQuery({ queryKey: ['analytics', 'dashboard-summary'], queryFn: fetchDashboardSummary });
const { data: warnings } = useQuery({ queryKey: ['warnings', { status: 'active' }], queryFn: () => fetchWarnings({ status: 'active' }) });

// Socket.io: listen for 'new_report_submitted', 'shelter_updated' → invalidate queries

// Layout:
// Row 1: 4x StatCard
// Row 2: SriLankaMap (left 2/3) + LiveSeverityPanel + ActivityLog (right 1/3)
// Row 3: ActivityLog
// Floating button: "Issue New Hazard Warning →" (red, top-right of page)
```

### CreateWarningPage (`/officer/warnings/create`)
```typescript
// Controlled by React Hook Form + Zod
// State: hazardType, targetDistricts[], targetRiverBasin, severityLevel, message, expiryTime
// On submit: navigate('/officer/warnings/preview', { state: formData })
// No API call on this page — data flows to preview page via router state
```

### WarningPreviewPage (`/officer/warnings/preview`)
```typescript
// Receives formData from location.state
// If location.state is null, redirect back to create page
// Local state: selectedChannels[] (default all 4 checked)
// On "AUTHORIZE & BROADCAST NOW":
//   mutation = useMutation({ mutationFn: createWarning })
//   On success: navigate(`/officer/warnings/${data.id}/status`)
```

### BroadcastStatusPage (`/officer/warnings/:id/status`)
```typescript
// Polling query:
const { data: broadcastStatus } = useQuery({
  queryKey: ['warnings', id, 'broadcast-status'],
  queryFn: () => fetchBroadcastStatus(id),
  refetchInterval: 5000, // poll every 5 seconds
});
```

---

## 9. UC02 — Pages Specification

### CitizenHomePage (`/citizen/home`)
```typescript
// Queries: active warnings for user district, recent alerts
// Socket.io (/citizen namespace): listen for 'new_warning', show toast + update banner

// WarningBanner: shown only if there are active warnings in user.district
// Dismiss button removes it from LOCAL state only (does not call API)
```

### SubmitReportPage (`/citizen/report`)
```typescript
// Multi-step form — step tracked in local state (1, 2, 3)
// Step 1: hazard type selection
// Step 2: GPS + photos + description (main step shown in wireframe)
// Step 3: review before submit

// GPS:
const { location, error: gpsError, requestLocation } = useGeolocation();
// useGeolocation hook wraps navigator.geolocation.getCurrentPosition

// Photos: managed with useFieldArray from React Hook Form
// Max 3 files, validated client-side for size (< 5MB) and type (image/*)
// Uploaded to /api/reports/upload-photos BEFORE final submit

// Offline detection:
if (!navigator.onLine) {
  // save to IndexedDB via useOfflineReports hook
  showToast('Report saved offline. Will sync when connected.');
} else {
  // submit normally
}
```

### VerificationQueue (`/officer/reports`)
```typescript
// Left panel: SriLankaMap with report pins
// Right panel: filter bar + table

// Socket.io: on 'new_report_submitted' event → invalidate ['reports'] query
// Table uses React Query with manual pagination
```

### ReportDetailPage (`/officer/reports/:id`)
```typescript
// On page mount: PATCH to /api/reports/:id to set status = UNDER_REVIEW (debounced, only if PENDING)
// Right panel: DMC Command Actions controlled by React Hook Form
// "Approve" button → verify mutation → on success navigate to /officer/warnings/create with pre-filled state
// "Decline" button → opens ConfirmDialog → reject mutation
```

---

## 10. UC03 — Pages Specification

### SheltersPage (`/officer/coordination/shelters`)
```typescript
// 3 stat cards: computed from shelter list (sum capacity, sum occupancy, diff)
// Table: sortable by district, status, occupancy %
// OccupancyBar: conditional colours based on % thresholds
// "Register Shelter" button → opens modal with form
// Inline "Update Occupancy" → opens inline form row or modal
// Mutation error handling: show red banner if SHELTER_CAPACITY_EXCEEDED
```

### RescueDispatchPage (`/officer/coordination/rescue-dispatch`)
```typescript
// Left list: rescue teams, clickable rows
// Click a row → populates "SELECT RESCUE TEAM" in dispatch form
// Gear checklist: array of checkboxes, managed with React Hook Form useFieldArray
// On dispatch success: invalidate ['rescue-teams'] query
// Team status badges update via Socket.io 'team_dispatched' event
```

### SupplyChainPage (`/officer/coordination/supply-chain`)
```typescript
// 5 inventory stat cards (from GET /api/supplies?district=X)
// "Create Dispatch Bill" → opens modal form
// Dispatch log table with transit status badges
// PATCH on status update → invalidate ['supply-dispatches'] query
```

---

## 11. UC04 — Pages Specification

### AnalyticsDashboardPage (`/officer/analytics`)
```typescript
// Data: GET /api/analytics/overview?period=30d
// Period selector: 7d | 30d | 90d | 1y (updates queryKey)

// WarningsByHazardChart (Recharts HorizontalBarChart):
const data = warningsByType.map(w => ({ name: w.label, value: w.count }));
<BarChart layout="vertical" data={data}>
  <Bar dataKey="value" fill="#2563eb" />
</BarChart>

// VerificationRateDonut (Recharts PieChart):
<PieChart>
  <Pie data={[{ name: 'Approved', value: 72 }, ...]} innerRadius={60} outerRadius={80}>
    {data.map((entry, index) => <Cell key={index} fill={colours[index]} />)}
  </Pie>
</PieChart>

// CitizenReportsTrendChart (Recharts BarChart):
<BarChart data={trendData}>
  <Bar dataKey="count" fill="#93c5fd" />
  <Line type="monotone" dataKey="count" stroke="#2563eb" dot={false} />
</BarChart>

// IncidentDensityMap: SriLankaMap with heatData prop
// Colours districts: severe=red, high=orange, medium=yellow, low=green
```

### ReportBuilderPage (`/officer/analytics/report-builder`)
```typescript
// Template selection: local state, not API
// Generate mutation:
const generateMutation = useMutation({
  mutationFn: generateReport,
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['reports', 'history'] });
    showToast(`Report generated: ${data.reportTitle}`);
  },
});

// Download: window.open(report.fileUrl, '_blank') or <a href={fileUrl} download>
```

---

## 12. Form Validation Examples

### Warning Form
```typescript
// /src/components/warnings/WarningForm.tsx
const schema = z.object({
  hazardType: z.enum(['flood', 'landslide', 'cyclone', 'tsunami', 'drought', 'lightning', 'fallen_tree', 'road_block']),
  targetDistricts: z.array(z.string()).min(1, 'Select at least one district'),
  severityLevel: z.enum(['watch', 'advisory', 'warning', 'emergency']),
  message: z.string().min(10, 'Message too short').max(300, 'Max 300 characters'),
  targetRiverBasin: z.string().optional(),
  expiryTime: z.string().datetime().optional().or(z.literal('')),
});
```

### Shelter Registration Form
```typescript
const schema = z.object({
  name: z.string().min(3),
  address: z.string().min(5),
  district: z.string().min(1, 'District is required'),
  capacity: z.number().int().positive('Capacity must be positive'),
  contactNumber: z.string().regex(/^0[0-9]{9}$/, 'Invalid Sri Lankan phone number').optional(),
});
```

---

## 13. Tailwind Theme Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        severity: {
          watch:     { DEFAULT: '#16a34a', light: '#dcfce7', text: '#15803d' },
          advisory:  { DEFAULT: '#2563eb', light: '#dbeafe', text: '#1d4ed8' },
          warning:   { DEFAULT: '#d97706', light: '#fef3c7', text: '#b45309' },
          emergency: { DEFAULT: '#dc2626', light: '#fee2e2', text: '#b91c1c' },
        },
        dmc: {
          dark: '#1a1f2e',
          primary: '#f59e0b',  // DMC amber/orange brand colour
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

---

## 14. Key UX Rules

1. **Emergency-first UI**: Severity Emergency is always red and prominent. Never use red for non-critical UI elements.
2. **Action buttons on the right**: Forms have "Cancel" (left) and "Submit/Confirm" (right). Destructive actions have an extra confirmation dialog.
3. **Loading states**: Every query has a loading skeleton or spinner. Never show an empty state without first knowing data is actually empty.
4. **Offline indicator**: Citizen portal shows a visible offline banner when `!navigator.onLine`. It must never silently fail.
5. **No modal stacking**: Never open a modal from inside another modal. Use navigate to a new page instead.
6. **Mobile-first for citizen portal**: All citizen pages are designed for 375px width first. Officer portal is desktop-first (min 1024px) with responsive behaviour down to 768px.
7. **Keyboard accessible**: All buttons, inputs, and custom components must respond to keyboard navigation and have visible focus rings.
8. **Empty states**: All tables and lists must show a meaningful empty state illustration and message (e.g., "No active warnings. Issue a new warning to get started.").
9. **Toast notifications**: Use toast (bottom-right on desktop, top-center on mobile) for: success mutations, error responses, offline/online transitions. Duration: 4 seconds.
10. **Consistent breadcrumbs**: Officer pages deeper than level 1 show a breadcrumb trail under the page header.
