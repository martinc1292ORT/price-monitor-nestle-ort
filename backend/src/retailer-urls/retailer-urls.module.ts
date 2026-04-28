import { Module } from '@nestjs/common';
import { RetailerUrlsController } from './retailer-urls.controller';
import { RetailerUrlsService } from './retailer-urls.service';
import { PrismaService } from '../database/prisma.service';

@Module({
  controllers: [RetailerUrlsController],
  providers: [RetailerUrlsService, PrismaService],
  exports: [RetailerUrlsService],
})
export class RetailerUrlsModule {}
