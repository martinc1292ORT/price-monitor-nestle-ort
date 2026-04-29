import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { ScrapingService } from '../scraping.service';
import {
  ScrapingQueue,
  JOB_SCRAPE_URL,
  JOB_MONITORING_TICK,
} from './scraping.queue';
import { createRedisConnection, QUEUE_NAME } from './redis.connection';

const DEFAULT_CONCURRENCY = 2;

@Injectable()
export class ScrapingProcessor
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ScrapingProcessor.name);
  private worker: Worker | null = null;
  private readonly connection = createRedisConnection();

  constructor(
    private readonly prisma: PrismaService,
    private readonly scrapingService: ScrapingService,
    private readonly scrapingQueue: ScrapingQueue,
  ) {}

  onApplicationBootstrap(): void {
    const concurrency = Number(
      process.env.SCRAPING_CONCURRENCY ?? DEFAULT_CONCURRENCY,
    );

    this.worker = new Worker(QUEUE_NAME, async (job) => this.handleJob(job), {
      connection: this.connection,
      concurrency,
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `job ${job?.id ?? 'unknown'} (${job?.name ?? 'unknown'}) failed: ${err.message}`,
      );
    });

    this.logger.log(`worker started with concurrency=${concurrency}`);
  }

  private async handleJob(job: Job): Promise<unknown> {
    if (job.name === JOB_MONITORING_TICK) {
      return this.handleTick(job);
    }
    if (job.name === JOB_SCRAPE_URL) {
      return this.handleScrapeUrl(job as Job<{ retailerUrlId: number }>);
    }
    this.logger.warn(`unknown job name: ${job.name}`);
    return null;
  }

  private async handleTick(job: Job): Promise<{ enqueued: number }> {
    const urls = await this.prisma.retailerUrl.findMany({
      where: { status: { in: ['active', 'error', 'not_found'] } },
      select: { id: true },
    });

    await Promise.all(urls.map((u) => this.scrapingQueue.enqueueScrape(u.id)));

    this.logger.log(
      `tick ${String(job.id)} enqueued ${urls.length} scrape jobs`,
    );
    return { enqueued: urls.length };
  }

  private async handleScrapeUrl(
    job: Job<{ retailerUrlId: number }>,
  ): Promise<unknown> {
    const { retailerUrlId } = job.data;
    const startedAt = Date.now();
    const jobIdStr = String(job.id);

    await this.prisma.jobLog.create({
      data: {
        jobId: jobIdStr,
        jobName: JOB_SCRAPE_URL,
        status: 'started',
        retailerUrlId,
      },
    });

    try {
      const result = await this.scrapingService.scrape(retailerUrlId);
      await this.prisma.jobLog.create({
        data: {
          jobId: jobIdStr,
          jobName: JOB_SCRAPE_URL,
          status: result.success ? 'completed' : 'failed',
          retailerUrlId,
          duration: Date.now() - startedAt,
          error: result.error ?? null,
        },
      });
      if (!result.success) {
        // throw so BullMQ records the attempt as failed and can retry
        throw new Error(result.error ?? 'scrape failed');
      }
      return result;
    } catch (err) {
      await this.prisma.jobLog
        .create({
          data: {
            jobId: jobIdStr,
            jobName: JOB_SCRAPE_URL,
            status: 'failed',
            retailerUrlId,
            duration: Date.now() - startedAt,
            error: String(err),
          },
        })
        .catch(() => {});
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) await this.worker.close().catch(() => {});
    this.connection.disconnect();
  }
}
