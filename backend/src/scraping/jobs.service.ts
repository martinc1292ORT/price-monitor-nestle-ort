import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ScrapeJobData } from './scraping.processor';

/**
 * Shape mínimo de un RetailerUrl para encolarlo.
 * (mock — en producción vendrá de Prisma: this.prisma.retailerUrl.findMany)
 */
interface RetailerUrlSummary {
  id: number;
  url: string;
  retailerName: string;
}

/** Resultado de disparar el batch de jobs. */
export interface TriggerResult {
  message: string;
  enqueued: number;
  jobIds: string[];
}

/**
 * Servicio que orquesta el encolado de jobs de scraping.
 *
 * Inyecta directamente la `Queue` de BullMQ vía `@InjectQueue` para producir
 * jobs. La política de reintentos y backoff se hereda de los `defaultJobOptions`
 * declarados en `scraping.module.ts`.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('scraping-queue')
    private readonly scrapingQueue: Queue<ScrapeJobData>,
  ) {}

  /**
   * Encola un job 'scrape-url' por cada RetailerUrl activa.
   * Por ahora la lista de URLs es un mock; cuando se conecte Prisma se
   * reemplaza por `this.prisma.retailerUrl.findMany({ where: { status: 'active' } })`.
   */
  async triggerAll(): Promise<TriggerResult> {
    const activeUrls = await this.findActiveRetailerUrls();

    this.logger.log(`Enqueuing ${activeUrls.length} scrape jobs`);

    const jobs = await Promise.all(
      activeUrls.map((url) =>
        this.scrapingQueue.add('scrape-url', { retailerUrlId: url.id }),
      ),
    );

    const jobIds = jobs.map((j) => String(j.id));

    return {
      message: `Successfully enqueued ${jobs.length} scraping job(s)`,
      enqueued: jobs.length,
      jobIds,
    };
  }

  /** Mock temporal — reemplazar por consulta real a Prisma. */
  private async findActiveRetailerUrls(): Promise<RetailerUrlSummary[]> {
    return [
      { id: 1, url: 'https://carrefour.com.ar/producto-1', retailerName: 'Carrefour' },
      { id: 2, url: 'https://disco.com.ar/producto-2', retailerName: 'Disco' },
      { id: 3, url: 'https://jumbo.com.ar/producto-3', retailerName: 'Jumbo' },
      { id: 4, url: 'https://coto.com.ar/producto-4', retailerName: 'Coto' },
    ];
  }
}
