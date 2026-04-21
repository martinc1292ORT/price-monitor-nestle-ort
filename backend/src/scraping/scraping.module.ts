import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PlaywrightService } from './playwright.service';
import { PriceExtractor } from './price.extractor';
import { PromoExtractor } from './promo.extractor';
import { ScrapingController } from './scraping.controller';
import { ScrapingService } from './scraping.service';

@Module({
  controllers: [ScrapingController],
  providers: [PrismaService, PlaywrightService, PriceExtractor, PromoExtractor, ScrapingService],
  exports: [ScrapingService],
})
export class ScrapingModule {}
