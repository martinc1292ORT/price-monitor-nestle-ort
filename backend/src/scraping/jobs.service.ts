import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { UpdateMonitoringConfigDto } from './dto/update-monitoring-config.dto';
import { ScrapeJobData } from './scraping.processor';

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
 * Servicio que orquesta el encolado de jobs de scraping y la
 * gestión de la configuración global de monitoreo.
 *
 * Inyecta la `Queue` de BullMQ vía `@InjectQueue` para producir jobs.
 * La política de reintentos y backoff se hereda de los `defaultJobOptions`
 * declarados en `scraping.module.ts`.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('scraping-queue')
    private readonly scrapingQueue: Queue<ScrapeJobData>,
    private readonly prisma: PrismaService,
  ) {}

  async triggerAll(): Promise<TriggerResult> {
    const activeUrls = await this.findActiveRetailerUrls();

    this.logger.log(`Enqueuing ${activeUrls.length} scrape jobs`);

    const jobs = await Promise.all(
      activeUrls.map((url) =>
        this.scrapingQueue.add('scrape-url', { retailerUrlId: url.id }),
      ),
    );

    return {
      message: `Successfully enqueued ${jobs.length} scraping job(s)`,
      enqueued: jobs.length,
      jobIds: jobs.map((j) => String(j.id)),
    };
  }

  /**
   * Devuelve la configuración actual. Si no existe ninguna fila aún,
   * crea una con los defaults definidos en el schema (singleton lógico).
   */
  async getConfig() {
    const existing = await this.prisma.monitoringConfig.findFirst({
      orderBy: { id: 'asc' },
    });

    if (existing) return existing;

    return this.prisma.monitoringConfig.create({ data: {} });
  }

  /** Actualiza la frecuencia del scheduler en la fila singleton. */
  async updateConfig(dto: UpdateMonitoringConfigDto) {
    const current = await this.getConfig();

    return this.prisma.monitoringConfig.update({
      where: { id: current.id },
      data: { frequency: dto.frequency },
    });
  }

  private async findActiveRetailerUrls(): Promise<RetailerUrlSummary[]> {
    return this.prisma.retailerUrl.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        url: true,
        retailerName: true,
      },
    });
  }
}
