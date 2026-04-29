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
import { Roles } from '../common/decorators/roles.decorator';
import { ScrapingResult, ScrapingService } from './scraping.service';
import { ScrapingQueue } from './queue/scraping.queue';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('scraping')
export class ScrapingController {
  constructor(
    private readonly scrapingService: ScrapingService,
    private readonly scrapingQueue: ScrapingQueue,
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
    const jobId = await this.scrapingQueue.enqueueScrape(retailerUrlId);
    return { jobId, retailerUrlId };
  }
}
