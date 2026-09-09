# DATABASE SCHEMA
## Smart Disaster Early-Warning and Emergency Coordination System
### Group 060

---

## Overview

- **Database**: PostgreSQL 15
- **ORM**: Prisma 5
- **Schema file**: `backend/prisma/schema.prisma`
- All IDs use `cuid()` (Prisma default) — collision-resistant unique IDs.
- All timestamps use `DateTime` with `@default(now())` for creation and manual set for updates.
- Soft deletes are NOT used — records are physically deleted or status-flagged.
- All enum values are defined in Prisma schema as `enum` types.

---

## Prisma Schema (`backend/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum UserRole {
  CITIZEN
  DMC_OFFICER
  DMC_DUTY_OFFICER
  DISTRICT_OFFICER
  RESCUE_TEAM
}

enum HazardType {
  FLOOD
  LANDSLIDE
  CYCLONE
  TSUNAMI
  DROUGHT
  LIGHTNING
  FALLEN_TREE
  ROAD_BLOCK
}

enum SeverityLevel {
  WATCH
  ADVISORY
  WARNING
  EMERGENCY
}

enum HazardStatus {
  ACTIVE
  RESOLVED
  MONITORING
}

enum WarningStatus {
  ACTIVE
  EXPIRED
  CANCELLED
}

enum ReportStatus {
  PENDING_VERIFICATION
  UNDER_REVIEW
  VERIFIED
  REJECTED
}

enum RescueTeamStatus {
  AVAILABLE
  DISPATCHED
  EN_ROUTE
  ON_MISSION
  RETURNING
}

enum ShelterStatus {
  OPEN
  FULL
  CLOSED
}

enum NotificationChannel {
  SMS_BLAST
  PUSH_NOTIFICATION
  TV_RADIO
  COASTAL_SIREN
}

enum TransitStatus {
  PREPARING
  IN_TRANSIT
  DELIVERED
}

enum MissionCriticality {
  HIGH
  MEDIUM
  ROUTINE
}

enum ReportExportFormat {
  PDF
  EXCEL
  CSV
}

// ─────────────────────────────────────────────
// MODELS
// ─────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  phoneNumber   String?   @unique
  passwordHash  String
  role          UserRole
  district      String?   // Set for DISTRICT_OFFICER, RESCUE_TEAM
  status        String    @default("active") // active | suspended
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  citizen          Citizen?
  issuedWarnings   Warning[]         @relation("IssuedBy")
  verifiedReports  HazardReport[]    @relation("VerifiedBy")
  generatedReports DisasterReport[]
  refreshTokens    RefreshToken[]

  @@map("users")
}

model Citizen {
  id        String  @id @default(cuid())
  userId    String  @unique
  nic       String? @unique
  address   String?
  district  String?

  user    User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  reports HazardReport[]

  @@map("citizens")
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("refresh_tokens")
}

model Hazard {
  id          String       @id @default(cuid())
  type        HazardType
  description String
  severity    SeverityLevel
  location    String
  district    String
  riverBasin  String?
  startTime   DateTime     @default(now())
  endTime     DateTime?
  status      HazardStatus @default(ACTIVE)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  // Relations
  warnings Warning[]
  reports  HazardReport[]

  @@map("hazards")
}

model Warning {
  id               String        @id @default(cuid())
  warningCode      String        @unique // e.g. DMC-2026-F98
  hazardType       HazardType
  severityLevel    SeverityLevel
  message          String        @db.VarChar(300)
  issuedTime       DateTime      @default(now())
  expiryTime       DateTime?
  targetDistricts  String[]      // Array of district names
  targetRiverBasin String?
  status           WarningStatus @default(ACTIVE)
  issuedById       String
  hazardId         String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  // Relations
  issuedBy             User                  @relation("IssuedBy", fields: [issuedById], references: [id])
  hazard               Hazard?               @relation(fields: [hazardId], references: [id])
  broadcastChannels    WarningBroadcast[]
  notificationLogs     NotificationLog[]

  @@map("warnings")
}

model WarningBroadcast {
  id              String              @id @default(cuid())
  warningId       String
  channel         NotificationChannel
  status          String              @default("pending") // pending | in_progress | completed | failed
  estimatedReach  Int?
  confirmedReach  Int?
  failedCount     Int?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime            @default(now())

  warning Warning @relation(fields: [warningId], references: [id], onDelete: Cascade)

  @@map("warning_broadcasts")
}

model NotificationLog {
  id             String              @id @default(cuid())
  warningId      String
  channel        NotificationChannel
  recipientCount Int
  deliveredCount Int                 @default(0)
  failedCount    Int                 @default(0)
  sentAt         DateTime            @default(now())

  warning Warning @relation(fields: [warningId], references: [id], onDelete: Cascade)

  @@map("notification_logs")
}

model HazardReport {
  id               String       @id @default(cuid())
  reportCode       String       @unique // e.g. RPT-2024-KLT-0847
  hazardType       HazardType
  description      String       @db.Text
  photoUrls        String[]     // Up to 3 Cloudinary URLs
  gpsLatitude      Float
  gpsLongitude     Float
  district         String
  locationLabel    String?      // Human-readable location
  status           ReportStatus @default(PENDING_VERIFICATION)
  severityEstimate SeverityLevel?
  rejectionReason  String?
  submittedAt      DateTime     @default(now())
  reviewedAt       DateTime?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  // Relations
  citizenId    String
  verifiedById String?
  hazardId     String?

  citizen    Citizen   @relation(fields: [citizenId], references: [id])
  verifiedBy User?     @relation("VerifiedBy", fields: [verifiedById], references: [id])
  hazard     Hazard?   @relation(fields: [hazardId], references: [id])

  @@map("hazard_reports")
}

model Shelter {
  id              String        @id @default(cuid())
  name            String
  address         String
  district        String
  capacity        Int
  currentOccupancy Int          @default(0)
  contactNumber   String?
  status          ShelterStatus @default(OPEN)
  amenities       String[]      // e.g. ['water', 'electricity', 'medical', 'food']
  registeredById  String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  occupancyLogs      ShelterOccupancyLog[]
  supplyDispatches   SupplyDispatch[]

  @@map("shelters")
}

model ShelterOccupancyLog {
  id              String   @id @default(cuid())
  shelterId       String
  previousCount   Int
  newCount        Int
  updatedById     String
  updatedAt       DateTime @default(now())

  shelter Shelter @relation(fields: [shelterId], references: [id], onDelete: Cascade)

  @@map("shelter_occupancy_logs")
}

model RescueTeam {
  id              String           @id @default(cuid())
  teamCode        String           @unique // e.g. TEAM-A
  teamName        String
  teamType        String           // Navy, Army, Civil Security, Red Cross, etc.
  contactNumber   String
  currentLocation String?
  district        String
  status          RescueTeamStatus @default(AVAILABLE)
  memberCount     Int
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  // Relations
  dispatches RescueDispatch[]

  @@map("rescue_teams")
}

model RescueDispatch {
  id              String             @id @default(cuid())
  teamId          String
  targetDistrict  String
  missionDetails  String?
  criticality     MissionCriticality @default(ROUTINE)
  gearChecklist   String[]           // e.g. ['inflatable_boats', 'paramedic_kit']
  dispatchedById  String
  dispatchedAt    DateTime           @default(now())
  returnedAt      DateTime?
  status          String             @default("dispatched") // dispatched | on_mission | returning | completed

  team RescueTeam @relation(fields: [teamId], references: [id])

  @@map("rescue_dispatches")
}

model Organization {
  id            String   @id @default(cuid())
  name          String
  type          String   // Government | NGO | Armed Forces | Donor
  contactNumber String
  address       String?
  createdAt     DateTime @default(now())

  // Relations
  supplies ReliefSupply[]

  @@map("organizations")
}

model ReliefSupply {
  id             String   @id @default(cuid())
  name           String
  category       String   // Food | Water | Medicine | Shelter Kit | Clothing | Other
  quantity       Float
  unit           String   // Units, Liters, Kg, Kits, etc.
  location       String   // Warehouse/hub location
  status         String   @default("available") // available | depleted | reserved
  organizationId String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // Relations
  organization Organization? @relation(fields: [organizationId], references: [id])
  dispatches   SupplyDispatch[]

  @@map("relief_supplies")
}

model SupplyDispatch {
  id                 String        @id @default(cuid())
  dispatchCode       String        @unique // e.g. TX-8902
  supplyId           String
  shelterId          String?
  destinationLabel   String        // Shelter name or district name
  quantity           Float
  unit               String
  transitStatus      TransitStatus @default(PREPARING)
  dispatchedById     String
  dispatchedAt       DateTime      @default(now())
  deliveredAt        DateTime?
  createdAt          DateTime      @default(now())

  supply  ReliefSupply @relation(fields: [supplyId], references: [id])
  shelter Shelter?     @relation(fields: [shelterId], references: [id])

  @@map("supply_dispatches")
}

model DisasterReport {
  id                   String   @id @default(cuid())
  reportTitle          String
  disasterType         HazardType
  district             String
  period               String   // e.g. "Q2 2026" or "May 15 Severe Floods"
  generatedAt          DateTime @default(now())
  generatedById        String
  citizensReached      Int?
  citizensEvacuated    Int?
  shelterOccupancyPeak Int?
  resourceDistributed  Float?
  exportFormat         ReportExportFormat?
  fileUrl              String?  // Cloudinary URL of generated report file
  createdAt            DateTime @default(now())

  // Relations
  generatedBy User @relation(fields: [generatedById], references: [id])

  @@map("disaster_reports")
}
```

---

## Table Reference

### `users`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK, cuid | Unique user ID |
| name | TEXT | NOT NULL | Full name |
| email | TEXT | UNIQUE, NOT NULL | Login email |
| phone_number | TEXT | UNIQUE | Mobile number |
| password_hash | TEXT | NOT NULL | bcrypt hash |
| role | ENUM | NOT NULL | UserRole enum |
| district | TEXT | | Set for district/rescue roles |
| status | TEXT | DEFAULT 'active' | active or suspended |
| created_at | TIMESTAMP | DEFAULT now() | |
| updated_at | TIMESTAMP | ON UPDATE | |

### `warnings`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK, cuid | |
| warning_code | TEXT | UNIQUE, NOT NULL | DMC-YYYY-XXX format |
| hazard_type | ENUM | NOT NULL | HazardType |
| severity_level | ENUM | NOT NULL | SeverityLevel |
| message | VARCHAR(300) | NOT NULL | Broadcast text |
| issued_time | TIMESTAMP | DEFAULT now() | |
| expiry_time | TIMESTAMP | | Optional expiry |
| target_districts | TEXT[] | NOT NULL | Array of districts |
| target_river_basin | TEXT | | Optional |
| status | ENUM | DEFAULT ACTIVE | WarningStatus |
| issued_by_id | TEXT | FK users | |
| hazard_id | TEXT | FK hazards | Optional link |

### `hazard_reports`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK, cuid | |
| report_code | TEXT | UNIQUE, NOT NULL | RPT-YYYY-DDD-NNNN |
| hazard_type | ENUM | NOT NULL | |
| description | TEXT | NOT NULL | Observation notes |
| photo_urls | TEXT[] | | Up to 3 URLs |
| gps_latitude | FLOAT | NOT NULL | |
| gps_longitude | FLOAT | NOT NULL | |
| district | TEXT | NOT NULL | |
| location_label | TEXT | | Human readable |
| status | ENUM | DEFAULT PENDING_VERIFICATION | |
| severity_estimate | ENUM | | Officer's assessment |
| rejection_reason | TEXT | | If rejected |
| submitted_at | TIMESTAMP | DEFAULT now() | |
| reviewed_at | TIMESTAMP | | Set when verified/rejected |
| citizen_id | TEXT | FK citizens | |
| verified_by_id | TEXT | FK users | |

### `shelters`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK, cuid | |
| name | TEXT | NOT NULL | Shelter name |
| address | TEXT | NOT NULL | |
| district | TEXT | NOT NULL | |
| capacity | INT | NOT NULL, > 0 | Max occupants |
| current_occupancy | INT | DEFAULT 0, >= 0 | |
| contact_number | TEXT | | |
| status | ENUM | DEFAULT OPEN | ShelterStatus |
| amenities | TEXT[] | | List of amenities |
| registered_by_id | TEXT | FK users | |

> **DB Constraint**: `current_occupancy` must not exceed `capacity`. Enforced at application level in the service layer and also via a Prisma middleware check.

### `rescue_teams`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK, cuid | |
| team_code | TEXT | UNIQUE | e.g. TEAM-A |
| team_name | TEXT | NOT NULL | |
| team_type | TEXT | NOT NULL | Navy/Army/Civil etc |
| contact_number | TEXT | NOT NULL | |
| current_location | TEXT | | |
| district | TEXT | NOT NULL | Home district |
| status | ENUM | DEFAULT AVAILABLE | RescueTeamStatus |
| member_count | INT | NOT NULL | |

### `relief_supplies`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK, cuid | |
| name | TEXT | NOT NULL | |
| category | TEXT | NOT NULL | Food/Water/Medicine etc |
| quantity | FLOAT | NOT NULL | |
| unit | TEXT | NOT NULL | |
| location | TEXT | NOT NULL | Warehouse/hub |
| status | TEXT | DEFAULT available | |
| organization_id | TEXT | FK organizations | Optional |

### `supply_dispatches`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PK, cuid | |
| dispatch_code | TEXT | UNIQUE | TX-XXXX |
| supply_id | TEXT | FK relief_supplies | |
| shelter_id | TEXT | FK shelters (opt) | |
| destination_label | TEXT | NOT NULL | |
| quantity | FLOAT | NOT NULL | |
| unit | TEXT | NOT NULL | |
| transit_status | ENUM | DEFAULT PREPARING | |
| dispatched_by_id | TEXT | FK users | |
| dispatched_at | TIMESTAMP | DEFAULT now() | |
| delivered_at | TIMESTAMP | | |

---

## Relationships Summary

```
User (1) ──────────── (0..*) Warning          [issued_by_id]
User (1) ──────────── (0..*) HazardReport     [verified_by_id]
User (1) ──────────── (0..*) DisasterReport   [generated_by_id]
User (1) ──────────── (0..1) Citizen          [one-to-one extension]

Citizen (1) ────────── (0..*) HazardReport    [citizen_id]

Hazard (1) ─────────── (0..*) Warning         [hazard_id]
Hazard (1) ─────────── (0..*) HazardReport    [hazard_id]

Warning (1) ────────── (0..*) WarningBroadcast [warning_id]
Warning (1) ────────── (0..*) NotificationLog  [warning_id]

Shelter (1) ────────── (0..*) ShelterOccupancyLog [shelter_id]
Shelter (1) ────────── (0..*) SupplyDispatch   [shelter_id]

RescueTeam (1) ──────── (0..*) RescueDispatch  [team_id]

ReliefSupply (1) ────── (0..*) SupplyDispatch  [supply_id]
Organization (1) ────── (0..*) ReliefSupply    [organization_id]
```

---

## Seed Data (`backend/prisma/seed.ts`)

### Users (seed accounts for testing)
| Name | Email | Password | Role |
|---|---|---|---|
| Capt. K. Perera | officer@dmc.lk | `Password123!` | DMC_DUTY_OFFICER |
| DMC National | national@dmc.lk | `Password123!` | DMC_OFFICER |
| Lt. Col. Jayasinghe | coord@dmc.lk | `Password123!` | DISTRICT_OFFICER (Colombo) |
| Asela Gunawardene | citizen@test.lk | `Password123!` | CITIZEN |
| TEAM-A Leader | teama@rescue.lk | `Password123!` | RESCUE_TEAM |

### Districts (seeded as a reference lookup — stored in a static JSON file, not a DB table)
All 25 Sri Lanka districts (see PROJECT_OVERVIEW.md).

### Sample Shelters (5 records across 3 districts)
| Name | District | Capacity | Occupancy |
|---|---|---|---|
| Ratnapura Central College | Ratnapura | 1200 | 1050 |
| Kalutara Town Hall | Kalutara | 800 | 800 |
| Galle Bodhi Temple Vihara | Galle | 1500 | 450 |
| Matara Rahula Auditorium | Matara | 1000 | 0 |
| Rathmalana Maha Vidyalaya | Colombo | 500 | 320 |

### Sample Rescue Teams (4 records)
| Code | Name | Type | Status | District |
|---|---|---|---|---|
| TEAM-A | Navy Swiftwater | Navy | AVAILABLE | Colombo |
| TEAM-B | Army Engineering | Army | EN_ROUTE | Ratnapura |
| TEAM-C | Civil Security Force | Civil | AVAILABLE | Colombo |
| TEAM-D | Red Cross First Aid | NGO | RETURNING | Galle |

### Sample Warnings (2 active)
| Code | Type | Severity | Districts | Status |
|---|---|---|---|---|
| DMC-2026-F98 | FLOOD | EMERGENCY | Colombo, Gampaha | ACTIVE |
| DMC-2026-L42 | LANDSLIDE | WARNING | Ratnapura, Kegalle | ACTIVE |

### Sample Relief Supplies
| Name | Category | Quantity | Unit | Location |
|---|---|---|---|---|
| Rice Packs | Food | 2400 | Units | Colombo Central Depot |
| Bottled Water | Water | 8000 | Liters | Colombo Central Depot |
| Emergency Medicine | Medicine | 340 | Kits | Ratnapura Regional Storage |
| Winter Blankets | Shelter Kit | 1200 | Units | Matara Safe Storage Hub |
| Tarpaulins & Tents | Shelter Kit | 560 | Rolls | Matara Safe Storage Hub |
