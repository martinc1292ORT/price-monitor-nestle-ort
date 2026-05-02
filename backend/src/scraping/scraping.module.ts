import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaService } from '../database/prisma.service';
import { PlaywrightService } from './playwright.service';
import { PriceExtractor } from './price.extractor';
import { PromoExtractor } from './promo.extractor';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ScrapeProcessor } from './scraping.processor';
import { ScrapingController } from './scraping.controller';
import { ScrapingScheduler } from './scraping.scheduler';
import { ScrapingService } from './scraping.service';

@Module({
  imports: [
    AlertsModule,
    NotificationsModule,
    BullModule.registerQueue({
      name: 'scraping-queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }),
  ],
  controllers: [ScrapingController, JobsController],
  providers: [
    PrismaService,
    PlaywrightService,
    PriceExtractor,
    PromoExtractor,
    ScrapingService,
    ScrapeProcessor,
    JobsService,
    ScrapingScheduler,
  ],
  exports: [ScrapingService, JobsService, ScrapingScheduler],
})
export class ScrapingModule {}
