/*
  Warnings:

  - You are about to drop the column `duration` on the `JobLog` table. All the data in the column will be lost.
  - You are about to drop the column `error` on the `JobLog` table. All the data in the column will be lost.
  - You are about to drop the column `jobId` on the `JobLog` table. All the data in the column will be lost.
  - You are about to drop the column `jobName` on the `JobLog` table. All the data in the column will be lost.
  - You are about to drop the column `isRunning` on the `MonitoringConfig` table. All the data in the column will be lost.
  - Made the column `retailerUrlId` on table `JobLog` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "JobLog" DROP COLUMN "duration",
DROP COLUMN "error",
DROP COLUMN "jobId",
DROP COLUMN "jobName",
ADD COLUMN     "errorMessage" TEXT,
ALTER COLUMN "retailerUrlId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MonitoringConfig" DROP COLUMN "isRunning";
