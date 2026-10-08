# Frontend Architecture - SOLID Principles

This document explains how SOLID principles are applied in the React frontend.

## Overview

The frontend follows a feature-based architecture:
```
pages/ → components/ → hooks/ → api/ → stores/
```

---

## S - Single Responsibility Principle (SRP)

> "A component/module should have only one reason to change."

### Implementation:

| Layer | Responsibility | Example |
|-------|---------------|--------|
| **Pages** | Route-level UI composition | `DashboardPage.tsx` - composes dashboard widgets |
| **Components** | Reusable UI elements | `SeverityBadge.tsx` - only renders severity indicator |
| **Hooks** | Shared stateful logic | `useAuth.ts` - only handles auth state |
| **API** | HTTP communication | `warnings.api.ts` - only warning API calls |
| **Stores** | Global state management | `authStore.ts` - only auth state |

### Examples:
- `LoadingSpinner.tsx` - Only shows loading indicator
- `PageHeader.tsx` - Only renders page title and actions
- `StatCard.tsx` - Only displays a single metric

---

## O - Open/Closed Principle (OCP)

> "Components should be open for extension but closed for modification."

### Implementation:

1. **Configurable Components**: Components accept props for customization:
   ```tsx
   <SeverityBadge level="warning" size="sm" />
   <StatCard label="Active" value={5} dot="red" />
   ```

2. **Constants Files**: New options added via configuration:
   ```typescript
   // constants.ts - Add new hazard type without changing components
   export const HAZARD_TYPES = [
     { value: 'flood', label: 'Flood' },
     // { value: 'earthquake', label: 'Earthquake' },  // Easy to add!
   ];
   ```

3. **Role-based Navigation**: New roles extend the system without modifying OfficerLayout:
   ```typescript
   { to: '/officer/reports', roles: ['DMC_OFFICER', 'NEW_ROLE'] }
   ```

---

## L - Liskov Substitution Principle (LSP)

> "Child components should be substitutable for parent components."

### Implementation:

1. **Consistent Props Interface**: All badge components accept `className` for styling:
   ```tsx
   <SeverityBadge className="mt-2" />
   <StatusBadge className="mt-2" />
   ```

2. **Layout Components**: Both `OfficerLayout` and `CitizenLayout` provide `<Outlet />` for nested routes.

3. **Form Components**: All form inputs follow controlled component pattern with `value` and `onChange`.

---

## I - Interface Segregation Principle (ISP)

> "Components should not be forced to depend on props they don't use."

### Implementation:

1. **Focused Component Props**:
   ```typescript
   // Good - minimal required props
   interface StatCardProps {
     label: string;
     value: string | number;
     dot?: 'red' | 'green' | 'blue' | 'orange';
   }
   ```

2. **Separate API Functions**: Each operation has its own function:
   ```typescript
   // warnings.api.ts
   export function fetchWarnings() { ... }     // Read
   export function createWarning() { ... }     // Create
   export function cancelWarning() { ... }     // Update
   ```

3. **Type Definitions**: Types are domain-specific, not generic:
   ```typescript
   interface Warning { ... }      // Warning-specific fields
   interface Shelter { ... }      // Shelter-specific fields
   ```

---

## D - Dependency Inversion Principle (DIP)

> "Components should depend on abstractions, not concrete implementations."

### Implementation:

1. **API Client Abstraction**: Pages use `apiClient`, not raw `fetch`/`axios`:
   ```typescript
   import { apiClient } from '@/api/client';
   // Not: import axios from 'axios';
   ```

2. **Store Abstraction**: Components use `useAuth()` hook, not direct store access:
   ```typescript
   const { user, logout } = useAuth();
   // Not: const user = useAuthStore.getState().user;
   ```

3. **Query Abstraction**: Data fetching via React Query, not direct API calls in components:
   ```typescript
   const { data } = useQuery({ queryKey: ['warnings'], queryFn: fetchWarnings });
   ```

---

## Directory Structure

```
frontend/src/
├── api/           # API client and endpoint functions
├── components/    # Reusable UI components
│   ├── layout/    # Layout wrappers (Officer, Citizen)
│   └── shared/    # Shared components (badges, cards, spinners)
├── hooks/         # Custom React hooks
├── lib/           # Utilities and constants
├── pages/         # Route-level page components
│   ├── citizen/   # Citizen portal pages
│   └── officer/   # Officer portal pages
├── stores/        # Zustand global stores
└── types/         # TypeScript type definitions
```

---

## Component Patterns

### Container/Presentational Pattern
- **Container** (Page): Handles data fetching, state, business logic
- **Presentational** (Component): Receives props, renders UI

### Composition Pattern
```tsx
<PageHeader
  title="Dashboard"
  subtitle="Overview"
  action={<Button>Create</Button>}  // Slot for custom action
/>
```

### Render Props / Children Pattern
```tsx
<QueryWrapper query={warningsQuery}>
  {(data) => <WarningsList warnings={data} />}
</QueryWrapper>
```
