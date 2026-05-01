import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScrapingService } from './scraping.service';

/** Payload esperado para cada job de tipo 'scrape-url'. */
export interface ScrapeJobData {
  retailerUrlId: number;
}

/**
 * Worker que consume jobs de la cola `scraping-queue`.
 *
 * - concurrency: 5 → procesa hasta 5 jobs en paralelo para maximizar
 *   el throughput sin saturar la red ni exponer una IP única.
 * - La política de reintentos (3 intentos, backoff exponencial de 5 s)
 *   está definida en los `defaultJobOptions` de `scraping.module.ts`.
 * - Al lanzar un Error, BullMQ reencola el job automáticamente hasta
 *   agotar los intentos configurados.
 */
@Processor({ name: 'scraping-queue' }, { concurrency: 5 })
export class ScrapeProcessor extends WorkerHost {
  private readonly logger = new Logger(ScrapeProcessor.name);

  constructor(private readonly scrapingService: ScrapingService) {
    super();
  }

  /** Punto de entrada de cada job. BullMQ llama a este método por cada tarea dequeued. */
  async process(job: Job<ScrapeJobData>): Promise<void> {
    const { retailerUrlId } = job.data;

    this.logger.log(
      `Processing job ${job.id} — retailerUrlId=${retailerUrlId} (attempt ${job.attemptsMade + 1})`,
    );

    const result = await this.scrapingService.scrape(retailerUrlId);

    // Si el servicio reporta fallo, lanzamos para activar el retry de BullMQ.
    if (!result.success) {
      throw new Error(result.error ?? 'Scraping failed');
    }
  }
}
