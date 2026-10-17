-- AlterTable
ALTER TABLE "disaster_reports" ADD COLUMN     "categories" TEXT[],
ADD COLUMN     "filePath" TEXT,
ADD COLUMN     "hazardId" TEXT;

-- AddForeignKey
ALTER TABLE "disaster_reports" ADD CONSTRAINT "disaster_reports_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "hazards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
