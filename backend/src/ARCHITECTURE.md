# Backend Architecture - SOLID Principles

This document explains how SOLID principles are applied throughout the backend codebase.

## Overview

The backend follows a layered architecture:
```
Routes → Controllers → Services → Database (Prisma)
```

Each layer has a single responsibility and communicates through well-defined interfaces.

---

## S - Single Responsibility Principle (SRP)

> "A class/module should have only one reason to change."

### Implementation:

| Layer | Responsibility | Example |
|-------|---------------|--------|
| **Routes** | HTTP routing & middleware chain | `warning.routes.ts` - only defines endpoints |
| **Controllers** | Request/response handling | `warning.controller.ts` - extracts params, calls service, formats response |
| **Services** | Business logic | `warning.service.ts` - warning lifecycle management |
| **Schemas** | Input validation | `warning.schema.ts` - Zod validation rules |
| **Middleware** | Cross-cutting concerns | `authenticateToken.ts` - only handles JWT verification |

### File Examples:
- `auth.service.ts` - Only handles authentication (login, register, token refresh)
- `notification.service.ts` - Only handles broadcast simulation and reach calculation
- `rescue.service.ts` - Only handles rescue team operations

---

## O - Open/Closed Principle (OCP)

> "Software entities should be open for extension but closed for modification."

### Implementation:

1. **Enum-based Hazard Types**: New hazard types can be added to the `HazardType` enum without modifying existing warning logic.

2. **Notification Channels**: The `SIMULATED_REACH` map in `notification.service.ts` allows adding new channels without changing the broadcast algorithm.

3. **Role-based Authorization**: New roles can be added to `UserRole` enum and authorized in routes without modifying middleware logic.

```typescript
// Adding a new channel only requires updating the config:
const SIMULATED_REACH: Record<string, number> = {
  SMS_BLAST: 8200000,
  PUSH_NOTIFICATION: 1400000,
  TV_RADIO: 12000000,
  COASTAL_SIREN: 500000,
  // NEW_CHANNEL: 1000000,  // Easy to extend!
};
```

---

## L - Liskov Substitution Principle (LSP)

> "Subtypes must be substitutable for their base types."

### Implementation:

1. **Consistent Error Handling**: All services throw errors with the same structure `{ code, message, status }`, allowing the error handler middleware to process them uniformly.

2. **Prisma Models**: All database models follow consistent patterns (id, createdAt, updatedAt), making them interchangeable in generic utility functions.

3. **API Response Format**: All endpoints return `{ success, data, message? }` structure via `successResponse()` utility.

```typescript
// All service errors follow the same contract:
throw { code: 'NOT_FOUND', message: 'Warning not found', status: 404 };
throw { code: 'TEAM_UNAVAILABLE', message: 'Team is busy', status: 409 };
```

---

## I - Interface Segregation Principle (ISP)

> "Clients should not be forced to depend on interfaces they don't use."

### Implementation:

1. **DTO Schemas**: Each operation has its own focused schema:
   - `createWarningSchema` - only fields needed for creation
   - `cancelWarningSchema` - only cancellation reason
   - `escalateWarningSchema` - only new severity level

2. **Route Separation**: Routes are split by domain:
   - `auth.routes.ts` - authentication only
   - `warning.routes.ts` - warning operations only
   - `coordination.routes.ts` - shelter/rescue/supply operations

3. **Selective Includes**: Prisma queries only include relations needed for each use case.

```typescript
// List query - minimal data:
prisma.warning.findMany({ include: { issuedBy: { select: { id: true, name: true } } } });

// Detail query - full data:
prisma.warning.findUnique({ include: { issuedBy: true, broadcastChannels: true, notificationLogs: true } });
```

---

## D - Dependency Inversion Principle (DIP)

> "High-level modules should not depend on low-level modules. Both should depend on abstractions."

### Implementation:

1. **Prisma Client Abstraction**: Services import `prisma` from a central config, not directly from `@prisma/client`. This allows swapping the database implementation.

2. **Service Layer Abstraction**: Controllers depend on service functions, not on Prisma directly. This allows testing controllers with mocked services.

3. **Middleware Injection**: Authentication and authorization are injected via middleware chain, not hardcoded in controllers.

```typescript
// Controllers depend on service abstraction:
import * as warningService from '../services/warning.service';

// Not on database implementation:
// import { prisma } from '../config/database';  // ❌ Wrong in controller
```

---

## Directory Structure

```
backend/src/
├── config/          # Configuration (database, env)
├── controllers/     # Request handlers (thin layer)
├── middleware/      # Cross-cutting concerns (auth, validation, errors)
├── routes/          # HTTP route definitions
├── schemas/         # Zod validation schemas (DTOs)
├── services/        # Business logic (core domain)
├── utils/           # Pure utility functions
└── types/           # TypeScript type definitions
```

---

## Testing Strategy

SOLID principles enable effective testing:

- **SRP**: Each service can be unit tested in isolation
- **OCP**: New features can be tested without modifying existing tests
- **LSP**: Mock objects can substitute real implementations
- **ISP**: Tests only need to mock the interfaces they use
- **DIP**: Services can be tested with mock Prisma client

See `backend/src/__tests__/` for unit test examples.
