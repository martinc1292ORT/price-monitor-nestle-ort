import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
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
 *
 * Observabilidad:
 * - Cada job exitoso persiste un `JobLog` con status='SUCCESS'.
 * - Cada fallo definitivo (tras agotar reintentos) persiste un
 *   `JobLog` con status='FAILED' y el `errorMessage` correspondiente.
 *   Los fallos intermedios (retries en curso) se ignoran a propósito
 *   para no inflar la tabla de logs con ruido transitorio.
 */
@Processor({ name: 'scraping-queue' }, { concurrency: 5 })
export class ScrapeProcessor extends WorkerHost {
  private readonly logger = new Logger(ScrapeProcessor.name);

  constructor(
    private readonly scrapingService: ScrapingService,
    private readonly prisma: PrismaService,
  ) {
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

  @OnWorkerEvent('completed')
  async onCompleted(job: Job<ScrapeJobData>): Promise<void> {
    try {
      await this.prisma.jobLog.create({
        data: {
          retailerUrlId: job.data.retailerUrlId,
          status: 'SUCCESS',
        },
      });
    } catch (err) {
      this.logger.error(`Failed to persist SUCCESS JobLog for job ${job.id}: ${err}`);
    }
  }

  /**
   * BullMQ emite 'failed' en cada intento que falla. Solo registramos
   * en JobLog cuando se agotan los reintentos (fallo definitivo).
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<ScrapeJobData> | undefined, err: Error): Promise<void> {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade >= maxAttempts;

    if (!isFinalAttempt) {
      this.logger.warn(
        `Job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}) — will retry: ${err.message}`,
      );
      return;
    }

    this.logger.error(
      `Job ${job.id} failed definitively after ${job.attemptsMade} attempts: ${err.message}`,
    );

    try {
      await this.prisma.jobLog.create({
        data: {
          retailerUrlId: job.data.retailerUrlId,
          status: 'FAILED',
          errorMessage: err.message,
        },
      });
    } catch (logErr) {
      this.logger.error(`Failed to persist FAILED JobLog for job ${job.id}: ${logErr}`);
    }
  }
}
