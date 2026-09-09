-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CITIZEN', 'DMC_OFFICER', 'DMC_DUTY_OFFICER', 'DISTRICT_OFFICER', 'RESCUE_TEAM');

-- CreateEnum
CREATE TYPE "HazardType" AS ENUM ('FLOOD', 'LANDSLIDE', 'CYCLONE', 'TSUNAMI', 'DROUGHT', 'LIGHTNING', 'FALLEN_TREE', 'ROAD_BLOCK');

-- CreateEnum
CREATE TYPE "SeverityLevel" AS ENUM ('WATCH', 'ADVISORY', 'WARNING', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "HazardStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'MONITORING');

-- CreateEnum
CREATE TYPE "WarningStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING_VERIFICATION', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RescueTeamStatus" AS ENUM ('AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'ON_MISSION', 'RETURNING');

-- CreateEnum
CREATE TYPE "ShelterStatus" AS ENUM ('OPEN', 'FULL', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS_BLAST', 'PUSH_NOTIFICATION', 'TV_RADIO', 'COASTAL_SIREN');

-- CreateEnum
CREATE TYPE "TransitStatus" AS ENUM ('PREPARING', 'IN_TRANSIT', 'DELIVERED');

-- CreateEnum
CREATE TYPE "MissionCriticality" AS ENUM ('HIGH', 'MEDIUM', 'ROUTINE');

-- CreateEnum
CREATE TYPE "ReportExportFormat" AS ENUM ('PDF', 'EXCEL', 'CSV');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "district" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citizens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nic" TEXT,
    "address" TEXT,
    "district" TEXT,

    CONSTRAINT "citizens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hazards" (
    "id" TEXT NOT NULL,
    "type" "HazardType" NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "SeverityLevel" NOT NULL,
    "location" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "riverBasin" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "status" "HazardStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hazards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warnings" (
    "id" TEXT NOT NULL,
    "warningCode" TEXT NOT NULL,
    "hazardType" "HazardType" NOT NULL,
    "severityLevel" "SeverityLevel" NOT NULL,
    "message" VARCHAR(300) NOT NULL,
    "issuedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryTime" TIMESTAMP(3),
    "targetDistricts" TEXT[],
    "targetRiverBasin" TEXT,
    "status" "WarningStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedById" TEXT NOT NULL,
    "hazardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warning_broadcasts" (
    "id" TEXT NOT NULL,
    "warningId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "estimatedReach" INTEGER,
    "confirmedReach" INTEGER,
    "failedCount" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warning_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "warningId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hazard_reports" (
    "id" TEXT NOT NULL,
    "reportCode" TEXT NOT NULL,
    "hazardType" "HazardType" NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrls" TEXT[],
    "gpsLatitude" DOUBLE PRECISION NOT NULL,
    "gpsLongitude" DOUBLE PRECISION NOT NULL,
    "district" TEXT NOT NULL,
    "locationLabel" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "severityEstimate" "SeverityLevel",
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "citizenId" TEXT NOT NULL,
    "verifiedById" TEXT,
    "hazardId" TEXT,

    CONSTRAINT "hazard_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "currentOccupancy" INTEGER NOT NULL DEFAULT 0,
    "contactNumber" TEXT,
    "status" "ShelterStatus" NOT NULL DEFAULT 'OPEN',
    "amenities" TEXT[],
    "registeredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shelters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelter_occupancy_logs" (
    "id" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "previousCount" INTEGER NOT NULL,
    "newCount" INTEGER NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shelter_occupancy_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rescue_teams" (
    "id" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "teamType" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "currentLocation" TEXT,
    "district" TEXT NOT NULL,
    "status" "RescueTeamStatus" NOT NULL DEFAULT 'AVAILABLE',
    "memberCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rescue_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rescue_dispatches" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "targetDistrict" TEXT NOT NULL,
    "missionDetails" TEXT,
    "criticality" "MissionCriticality" NOT NULL DEFAULT 'ROUTINE',
    "gearChecklist" TEXT[],
    "dispatchedById" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'dispatched',

    CONSTRAINT "rescue_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relief_supplies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relief_supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_dispatches" (
    "id" TEXT NOT NULL,
    "dispatchCode" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "shelterId" TEXT,
    "destinationLabel" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "transitStatus" "TransitStatus" NOT NULL DEFAULT 'PREPARING',
    "dispatchedById" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disaster_reports" (
    "id" TEXT NOT NULL,
    "reportTitle" TEXT NOT NULL,
    "disasterType" "HazardType" NOT NULL,
    "district" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,
    "citizensReached" INTEGER,
    "citizensEvacuated" INTEGER,
    "shelterOccupancyPeak" INTEGER,
    "resourceDistributed" DOUBLE PRECISION,
    "exportFormat" "ReportExportFormat",
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disaster_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "citizens_userId_key" ON "citizens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "citizens_nic_key" ON "citizens"("nic");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "warnings_warningCode_key" ON "warnings"("warningCode");

-- CreateIndex
CREATE UNIQUE INDEX "hazard_reports_reportCode_key" ON "hazard_reports"("reportCode");

-- CreateIndex
CREATE UNIQUE INDEX "rescue_teams_teamCode_key" ON "rescue_teams"("teamCode");

-- CreateIndex
CREATE UNIQUE INDEX "supply_dispatches_dispatchCode_key" ON "supply_dispatches"("dispatchCode");

-- AddForeignKey
ALTER TABLE "citizens" ADD CONSTRAINT "citizens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "hazards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warning_broadcasts" ADD CONSTRAINT "warning_broadcasts_warningId_fkey" FOREIGN KEY ("warningId") REFERENCES "warnings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_warningId_fkey" FOREIGN KEY ("warningId") REFERENCES "warnings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hazard_reports" ADD CONSTRAINT "hazard_reports_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "citizens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hazard_reports" ADD CONSTRAINT "hazard_reports_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hazard_reports" ADD CONSTRAINT "hazard_reports_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "hazards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelter_occupancy_logs" ADD CONSTRAINT "shelter_occupancy_logs_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rescue_dispatches" ADD CONSTRAINT "rescue_dispatches_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "rescue_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relief_supplies" ADD CONSTRAINT "relief_supplies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_dispatches" ADD CONSTRAINT "supply_dispatches_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "relief_supplies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_dispatches" ADD CONSTRAINT "supply_dispatches_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disaster_reports" ADD CONSTRAINT "disaster_reports_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
