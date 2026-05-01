-- AddForeignKey
ALTER TABLE "JobLog" ADD CONSTRAINT "JobLog_retailerUrlId_fkey" FOREIGN KEY ("retailerUrlId") REFERENCES "RetailerUrl"("id") ON DELETE CASCADE ON UPDATE CASCADE;
