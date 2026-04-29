import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PlaywrightService } from './playwright.service';
import { PriceExtractor } from './price.extractor';
import { PromoExtractor } from './promo.extractor';
import { ScrapingController } from './scraping.controller';
import { ScrapingService } from './scraping.service';
import { ScrapingQueue } from './queue/scraping.queue';
import { ScrapingProcessor } from './queue/scraping.processor';
import { MonitoringScheduler } from './queue/monitoring.scheduler';

@Module({
  controllers: [ScrapingController],
  providers: [
    PrismaService,
    PlaywrightService,
    PriceExtractor,
    PromoExtractor,
    ScrapingService,
    ScrapingQueue,
    ScrapingProcessor,
    MonitoringScheduler,
  ],
  exports: [ScrapingService, ScrapingQueue, MonitoringScheduler],
})
export class ScrapingModule {}
