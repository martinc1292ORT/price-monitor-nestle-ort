import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ScrapingQueue } from './scraping.queue';
import { frequencyToCron } from './frequency.util';

const DEFAULT_FREQUENCY = '6h';

@Injectable()
export class MonitoringScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(MonitoringScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scrapingQueue: ScrapingQueue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reschedule();
  }

  async reschedule(): Promise<void> {
    const config = await this.prisma.monitoringConfig.findFirst();
    if (config && !config.isRunning) {
      this.logger.log('monitoring is disabled in config — not scheduling');
      return;
    }
    const frequency = config?.frequency ?? DEFAULT_FREQUENCY;
    const cron = frequencyToCron(frequency);
    await this.scrapingQueue.scheduleRepeatable(cron);
  }
}
