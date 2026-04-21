import { Controller, Post, Param, ParseIntPipe } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { ScrapingResult, ScrapingService } from './scraping.service';

@Controller('scraping')
export class ScrapingController {
  constructor(private readonly scrapingService: ScrapingService) {}

  @Post(':retailerUrlId')
  @Roles('admin')
  scrape(
    @Param('retailerUrlId', ParseIntPipe) retailerUrlId: number,
  ): Promise<ScrapingResult> {
    return this.scrapingService.scrape(retailerUrlId);
  }
}
