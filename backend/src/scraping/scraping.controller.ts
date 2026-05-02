import { InjectQueue } from '@nestjs/bullmq';
import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { Roles } from '../common/decorators/roles.decorator';
import { ScrapingResult, ScrapingService } from './scraping.service';
import { ScrapeJobData } from './scraping.processor';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('scraping')
export class ScrapingController {
  constructor(
    private readonly scrapingService: ScrapingService,
    @InjectQueue('scraping-queue')
    private readonly scrapingQueue: Queue<ScrapeJobData>,
  ) {}

  @Public()
  @Post('test')
  async testScraping(
    @Body('retailerUrlId', ParseIntPipe) retailerUrlId: number,
  ): Promise<ScrapingResult> {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException(
        'This endpoint is only available in development',
      );
    }

    return this.scrapingService.scrape(retailerUrlId);
  }

  @Post(':retailerUrlId')
  @Roles('admin')
  scrape(
    @Param('retailerUrlId', ParseIntPipe) retailerUrlId: number,
  ): Promise<ScrapingResult> {
    return this.scrapingService.scrape(retailerUrlId);
  }

  @Post(':retailerUrlId/enqueue')
  @Roles('admin')
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueue(
    @Param('retailerUrlId', ParseIntPipe) retailerUrlId: number,
  ): Promise<{ jobId: string; retailerUrlId: number }> {
    const job = await this.scrapingQueue.add('scrape-url', { retailerUrlId });
    return { jobId: String(job.id), retailerUrlId };
  }
}
