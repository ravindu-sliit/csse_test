-- AlterTable
ALTER TABLE "warnings" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "locationLabel" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "sourceReportId" TEXT;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_sourceReportId_fkey" FOREIGN KEY ("sourceReportId") REFERENCES "hazard_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
