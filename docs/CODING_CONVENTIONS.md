# CODING CONVENTIONS
## Smart Disaster Early-Warning and Emergency Coordination System
### Group 060

> This document is the source of truth for all code style, naming, and pattern decisions.
> AI agents must follow these rules exactly. Do not deviate without explicit instruction.

---

## 1. Language & Syntax

- **TypeScript strict mode** is enabled in both frontend and backend (`"strict": true` in tsconfig).
- **Never use `any`**. Use `unknown` and narrow the type, or define a proper interface.
- **Never use `var`**. Use `const` by default, `let` only when reassignment is necessary.
- All async functions must use `async/await`. Do not use `.then().catch()` chains.
- All errors in async functions must be handled. Backend: use `asyncHandler` wrapper. Frontend: use React Query's `error` state.
- Use ES module syntax (`import`/`export`). Never use `require()`.
- Use optional chaining (`?.`) and nullish coalescing (`??`) instead of manual null checks where appropriate.

---

## 2. Naming Conventions

### General
| Thing | Convention | Example |
|---|---|---|
| Variables | camelCase | `currentOccupancy`, `isLoading` |
| Constants (module-level) | UPPER_SNAKE_CASE | `MAX_PHOTO_SIZE`, `DISTRICTS` |
| Types / Interfaces | PascalCase | `HazardReport`, `CreateWarningDto` |
| Enums | PascalCase (enum name), UPPER_SNAKE_CASE (values) | `HazardType.FLOOD` |
| Functions | camelCase, verb-first | `getWarnings`, `createShelter`, `broadcastWarning` |
| Boolean variables | `is`, `has`, `can` prefix | `isVerified`, `hasCapacity`, `canBroadcast` |

### Frontend
| Thing | Convention | Example |
|---|---|---|
| React components | PascalCase | `SeverityBadge`, `WarningForm` |
| Page components | PascalCase + `Page` suffix | `CreateWarningPage` |
| Custom hooks | `use` prefix, camelCase | `useAuth`, `useGeolocation` |
| Event handlers | `handle` prefix | `handleSubmit`, `handleBroadcast` |
| Zustand stores | camelCase + `Store` suffix | `authStore`, `notificationStore` |
| API functions | verb + noun | `fetchWarnings`, `createHazardReport` |

### Backend
| Thing | Convention | Example |
|---|---|---|
| Route files | camelCase + `.routes.ts` | `warning.routes.ts` |
| Controller files | camelCase + `.controller.ts` | `warning.controller.ts` |
| Service files | camelCase + `.service.ts` | `warning.service.ts` |
| Schema files | camelCase + `.schema.ts` | `warning.schema.ts` |
| Prisma models | PascalCase (matches schema) | `Warning`, `HazardReport` |
| Database table names | snake_case plural | `warnings`, `hazard_reports`, `rescue_teams` |
| Database column names | snake_case | `issued_time`, `target_district`, `current_occupancy` |

---

## 3. TypeScript Types

### Define all shared types in `frontend/src/types/index.ts`

```typescript
// User roles
export type UserRole = 'citizen' | 'dmc_officer' | 'dmc_duty_officer' | 'district_officer' | 'rescue_team';

// Hazard types
export type HazardType = 'flood' | 'landslide' | 'cyclone' | 'tsunami' | 'drought' | 'lightning' | 'fallen_tree' | 'road_block';

// Severity levels
export type SeverityLevel = 'watch' | 'advisory' | 'warning' | 'emergency';

// Warning status
export type WarningStatus = 'active' | 'expired' | 'cancelled';

// Report status
export type ReportStatus = 'pending_verification' | 'under_review' | 'verified' | 'rejected';

// Rescue team status
export type RescueTeamStatus = 'available' | 'dispatched' | 'en_route' | 'on_mission' | 'returning';

// Shelter status
export type ShelterStatus = 'open' | 'full' | 'closed';

// Supply transit status
export type TransitStatus = 'preparing' | 'in_transit' | 'delivered';

// Notification channel
export type NotificationChannel = 'sms_blast' | 'push_notification' | 'tv_radio' | 'coastal_siren';
```

### DTOs (Data Transfer Objects)

- All request body types are named with `Create`, `Update`, or `Dto` suffix.
- Example: `CreateWarningDto`, `UpdateShelterOccupancyDto`, `VerifyReportDto`.
- Defined as Zod schemas on the backend, inferred as TypeScript types.

```typescript
// backend/src/schemas/warning.schema.ts
import { z } from 'zod';

export const createWarningSchema = z.object({
  hazardType: z.enum(['flood', 'landslide', 'cyclone', 'tsunami', 'drought', 'lightning', 'fallen_tree', 'road_block']),
  severityLevel: z.enum(['watch', 'advisory', 'warning', 'emergency']),
  targetDistricts: z.array(z.string()).min(1),
  targetRiverBasin: z.string().optional(),
  message: z.string().min(10).max(300),
  broadcastChannels: z.array(z.enum(['sms_blast', 'push_notification', 'tv_radio', 'coastal_siren'])).min(1),
  expiryTime: z.string().datetime().optional(),
});

export type CreateWarningDto = z.infer<typeof createWarningSchema>;
```

---

## 4. API Response Format

**All API responses must follow this standard envelope:**

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Warning created successfully"
}
```

### Success Response (list with pagination)
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 247,
    "page": 1,
    "limit": 20,
    "totalPages": 13
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "SHELTER_CAPACITY_EXCEEDED",
    "message": "Cannot update occupancy. New count (520) exceeds shelter capacity (500).",
    "field": "newOccupancy"
  }
}
```

### HTTP Status Codes
| Scenario | Code |
|---|---|
| Success (fetch/update) | 200 |
| Created | 201 |
| Bad request / validation | 400 |
| Unauthorized (no token) | 401 |
| Forbidden (wrong role) | 403 |
| Not found | 404 |
| Conflict (duplicate) | 409 |
| Server error | 500 |

### Backend helper
```typescript
// backend/src/utils/apiResponse.ts
export const successResponse = (res: Response, data: unknown, message?: string, statusCode = 200) => {
  return res.status(statusCode).json({ success: true, data, message });
};

export const errorResponse = (res: Response, statusCode: number, code: string, message: string, field?: string) => {
  return res.status(statusCode).json({ success: false, error: { code, message, field } });
};
```

---

## 5. React Component Patterns

### Component structure (in order)
```typescript
// 1. Imports (external libs first, then internal)
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { fetchWarnings } from '@/api/warnings.api';
import type { Warning } from '@/types';

// 2. Props interface (always explicit)
interface WarningsTableProps {
  districtFilter?: string;
  onManage: (warningId: string) => void;
}

// 3. Component (function declaration, not arrow function for pages/major components)
export function WarningsTable({ districtFilter, onManage }: WarningsTableProps) {
  // 4. Hooks (in this order: state, refs, context, queries, effects)
  const { data, isLoading, error } = useQuery({
    queryKey: ['warnings', districtFilter],
    queryFn: () => fetchWarnings({ district: districtFilter }),
  });

  // 5. Derived values / handlers
  const handleManage = (id: string) => {
    onManage(id);
  };

  // 6. Early returns (loading, error states)
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load warnings" />;

  // 7. Render
  return (
    <table>
      {/* ... */}
    </table>
  );
}
```

### Rules
- **Never** export default from component files that have more than one export. Use named exports.
- **Always** type props with an explicit interface, never inline object types.
- **Always** handle loading and error states in components that fetch data.
- **Never** call API functions directly in components. Use `@/api/*.api.ts` functions wrapped in React Query.
- Use `@/` path alias for all internal imports (configured in `tsconfig.json` and `vite.config.ts`).

---

## 6. Backend Controller Pattern

```typescript
// backend/src/controllers/warning.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse, errorResponse } from '../utils/apiResponse';
import * as warningService from '../services/warning.service';
import type { AuthenticatedRequest } from '../types';

export const createWarning = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const dto = req.body; // Already validated by middleware
  const officerId = req.user!.id;

  const warning = await warningService.createAndBroadcast(dto, officerId);

  return successResponse(res, warning, 'Warning created and broadcast initiated', 201);
});

export const getWarnings = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', status, district } = req.query;

  const result = await warningService.listWarnings({
    page: parseInt(page as string),
    limit: parseInt(limit as string),
    status: status as string | undefined,
    district: district as string | undefined,
  });

  return res.status(200).json({ success: true, data: result.warnings, meta: result.meta });
});
```

### Rules
- Controllers are **thin** — they only extract request data, call a service, and return a response.
- All business logic lives in **services**.
- All database queries live in **services** (using Prisma client).
- All controllers must be wrapped in `asyncHandler` to catch unhandled promise rejections.

---

## 7. Prisma Usage

```typescript
// Good — explicit field selection
const warning = await prisma.warning.findUnique({
  where: { id: warningId },
  select: {
    id: true,
    warningLevel: true,
    message: true,
    issuedTime: true,
    targetDistricts: true,
    status: true,
    issuedBy: {
      select: { id: true, name: true },
    },
  },
});

// Bad — selecting everything (leaks sensitive data)
const warning = await prisma.warning.findUnique({ where: { id: warningId } });
```

- **Always** use `select` to explicitly choose fields returned. Never return entire rows that may contain sensitive data (e.g., password hashes).
- Use Prisma transactions (`prisma.$transaction`) for operations that must be atomic (e.g., update shelter occupancy + log the change).
- Always handle `null` returns from `findUnique` — check and return 404 if not found.

---

## 8. Error Codes Reference

Use these exact error codes in error responses:

| Code | Meaning |
|---|---|
| `INVALID_CREDENTIALS` | Wrong email/password |
| `TOKEN_EXPIRED` | JWT expired |
| `TOKEN_INVALID` | JWT malformed |
| `FORBIDDEN` | User lacks required role |
| `VALIDATION_ERROR` | Request body failed Zod validation |
| `NOT_FOUND` | Resource does not exist |
| `DUPLICATE_ENTRY` | Unique constraint violation |
| `SHELTER_CAPACITY_EXCEEDED` | Occupancy update would exceed capacity |
| `SHELTER_FULL` | Shelter has no available spaces |
| `TEAM_UNAVAILABLE` | Rescue team is not in `available` status |
| `REPORT_ALREADY_REVIEWED` | Report has already been verified or rejected |
| `WARNING_ALREADY_CANCELLED` | Cannot modify a cancelled warning |
| `BROADCAST_IN_PROGRESS` | Warning broadcast already running |
| `UPLOAD_FAILED` | Cloudinary upload error |
| `INTERNAL_ERROR` | Unhandled server error |

---

## 9. Tailwind CSS Rules

- Use the severity colour tokens defined in `tailwind.config.ts`:
  - `bg-severity-watch` / `text-severity-watch` → green
  - `bg-severity-advisory` / `text-severity-advisory` → blue
  - `bg-severity-warning` / `text-severity-warning` → amber
  - `bg-severity-emergency` / `text-severity-emergency` → red
- Never hard-code hex colour values. Always use Tailwind tokens.
- Keep className strings readable — break long ones across lines with template literals or `cn()`.
- Use the `cn()` helper (from `@/lib/utils.ts`) for conditional class merging:
  ```typescript
  import { cn } from '@/lib/utils';
  <div className={cn('base-classes', isActive && 'active-class', variant === 'danger' && 'danger-class')} />
  ```

---

## 10. Git Commit Message Format

```
type(scope): short description

Types: feat, fix, chore, docs, style, refactor, test
Scope: uc01, uc02, uc03, uc04, auth, db, infra

Examples:
feat(uc01): add broadcast channel selection UI
fix(uc02): prevent duplicate report submission on slow network
feat(uc03): implement shelter occupancy update API
chore(db): add shelter capacity constraint migration
docs: update API spec with analytics endpoints
```

---

## 11. Environment & Security Rules

- **Never** commit `.env` files. Only commit `.env.example`.
- **Never** log JWT secrets, passwords, or API keys.
- **Never** return password hashes in any API response.
- **Always** sanitize file upload inputs — check MIME type, not just extension.
- Rate limiting is enabled on all auth endpoints (max 10 requests/minute per IP).
- CORS is restricted to `ALLOWED_ORIGINS` env var only.

---

## 12. Constants File (`frontend/src/lib/constants.ts`)

```typescript
export const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara',
  'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota',
  'Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu',
  'Trincomalee', 'Batticaloa', 'Ampara',
  'Kurunegala', 'Puttalam',
  'Anuradhapura', 'Polonnaruwa',
  'Badulla', 'Monaragala',
  'Ratnapura', 'Kegalle',
] as const;

export const HAZARD_TYPES = [
  { value: 'flood', label: 'Flood', icon: '🌊' },
  { value: 'landslide', label: 'Landslide', icon: '⛰️' },
  { value: 'cyclone', label: 'Cyclone', icon: '🌀' },
  { value: 'tsunami', label: 'Tsunami', icon: '🌊' },
  { value: 'drought', label: 'Drought', icon: '☀️' },
  { value: 'lightning', label: 'Lightning', icon: '⚡' },
  { value: 'fallen_tree', label: 'Fallen Tree', icon: '🌲' },
  { value: 'road_block', label: 'Road Block', icon: '🚧' },
] as const;

export const SEVERITY_CONFIG = {
  watch:     { label: 'Watch',     colour: '#16a34a', bg: 'bg-severity-watch',     text: 'text-severity-watch' },
  advisory:  { label: 'Advisory',  colour: '#2563eb', bg: 'bg-severity-advisory',  text: 'text-severity-advisory' },
  warning:   { label: 'Warning',   colour: '#d97706', bg: 'bg-severity-warning',   text: 'text-severity-warning' },
  emergency: { label: 'Emergency', colour: '#dc2626', bg: 'bg-severity-emergency', text: 'text-severity-emergency' },
} as const;

export const RIVER_BASINS = [
  'Kelani River Basin',
  'Kalu River Basin',
  'Mahaweli River Basin',
  'Galle Basin',
  'Nilwala River Basin',
  'Gin River Basin',
  'Attanagalu Oya Basin',
] as const;

export const BROADCAST_CHANNELS = [
  { value: 'sms_blast',         label: 'Emergency SMS Blast',           description: '8.2M Subscribers' },
  { value: 'push_notification', label: 'Push Notifications (Disaster Portal)', description: '1.4M Registered Devices' },
  { value: 'tv_radio',          label: 'National TV/Radio Interruption', description: '6 Broadcasters Live Network' },
  { value: 'coastal_siren',     label: 'Coastal Siren Megaphones',      description: 'Active in selected western ports' },
] as const;
```
