-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'VOLUNTEER';

-- AlterTable
ALTER TABLE "disaster_reports" ADD COLUMN     "rescueTeamId" TEXT,
ADD COLUMN     "shelterId" TEXT,
ADD COLUMN     "warningId" TEXT;

-- AddForeignKey
ALTER TABLE "disaster_reports" ADD CONSTRAINT "disaster_reports_warningId_fkey" FOREIGN KEY ("warningId") REFERENCES "warnings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disaster_reports" ADD CONSTRAINT "disaster_reports_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disaster_reports" ADD CONSTRAINT "disaster_reports_rescueTeamId_fkey" FOREIGN KEY ("rescueTeamId") REFERENCES "rescue_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
