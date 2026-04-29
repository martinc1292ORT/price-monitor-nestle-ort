import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { createRedisConnection, QUEUE_NAME } from './redis.connection';

export const JOB_SCRAPE_URL = 'scrape-url';
export const JOB_MONITORING_TICK = 'monitoring-tick';
const REPEATABLE_KEY = 'monitoring-tick-repeatable';

@Injectable()
export class ScrapingQueue implements OnModuleDestroy {
  private readonly logger = new Logger(ScrapingQueue.name);
  private readonly queue: Queue;
  private readonly connection = createRedisConnection();

  constructor() {
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
  }

  async enqueueScrape(retailerUrlId: number): Promise<string> {
    const job = await this.queue.add(
      JOB_SCRAPE_URL,
      { retailerUrlId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    );
    return String(job.id);
  }

  async scheduleRepeatable(cron: string): Promise<void> {
    // Remove any existing repeatable jobs to avoid stacking schedules
    const existing = await this.queue.getRepeatableJobs();
    await Promise.all(
      existing
        .filter((j) => j.name === JOB_MONITORING_TICK)
        .map((j) => this.queue.removeRepeatableByKey(j.key)),
    );

    await this.queue.add(
      JOB_MONITORING_TICK,
      {},
      {
        repeat: { pattern: cron },
        jobId: REPEATABLE_KEY,
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
    this.logger.log(`monitoring tick scheduled with cron ${cron}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close().catch(() => {});
    this.connection.disconnect();
  }
}
