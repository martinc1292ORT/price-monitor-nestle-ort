import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { schedule, validate, type ScheduledTask } from 'node-cron';
import { JobsService } from './jobs.service';

/**
 * Mapea las frecuencias del dominio (ver `VALID_FREQUENCIES` en el DTO)
 * a expresiones cron estándar.
 */
function frequencyToCron(frequency: string): string {
  // Si ya es una expresión cron válida, la usamos directamente.
  if (validate(frequency)) return frequency;

  switch (frequency) {
    case '1h':
      return '0 * * * *';
    case '3h':
      return '0 */3 * * *';
    case '6h':
      return '0 */6 * * *';
    case '12h':
      return '0 */12 * * *';
    case '24h':
      return '0 8 * * *'; // todos los días a las 8:00 AM
    default:
      throw new Error(`Frecuencia desconocida: '${frequency}'`);
  }
}

/**
 * Scheduler dinámico del sistema de scraping (basado en `node-cron`).
 *
 * Responsabilidades:
 * - En `onModuleInit` lee `MonitoringConfig` de DB y arranca el cron.
 * - En cada tick, dispara la misma lógica que `POST /api/jobs/trigger`:
 *   delega en `JobsService.triggerAll()`.
 * - Expone `reschedule()` para que el PATCH del endpoint reconfigure el
 *   reloj en caliente sin reiniciar el server.
 *
 * Notas de diseño:
 * - La referencia a la `ScheduledTask` actual vive en memoria (`currentTask`).
 *   Si la app se reinicia, se reconstruye desde DB en `onModuleInit`.
 * - Una frecuencia inválida en DB no tira la app: se loguea el error
 *   y el scheduler queda inactivo hasta que un admin envíe un PATCH válido.
 */
@Injectable()
export class ScrapingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScrapingScheduler.name);
  private currentTask: ScheduledTask | null = null;
  private currentFrequency: string | null = null;

  constructor(private readonly jobsService: JobsService) {}

  async onModuleInit(): Promise<void> {
    try {
      const config = await this.jobsService.getConfig();
      this.startTask(config.frequency);
    } catch (err) {
      this.logger.error(
        `No se pudo iniciar el scheduler en arranque: ${String(err)}`,
      );
    }
  }

  /**
   * Detiene el cron actual (si existe) y arranca uno nuevo con la frecuencia
   * indicada. Se invoca desde `JobsController.updateConfig()` para reflejar
   * cambios de configuración en caliente.
   */
  reschedule(frequency: string): void {
    this.stopTask();
    this.startTask(frequency);
  }

  /** Cleanup al apagar el server — evita que el cron siga vivo en orphan. */
  onModuleDestroy(): void {
    this.stopTask();
  }

  private startTask(frequency: string): void {
    let expression: string;
    try {
      expression = frequencyToCron(frequency);
    } catch (err) {
      this.logger.error(
        `Frecuencia inválida ('${frequency}'). Scheduler NO arrancado: ${String(err)}`,
      );
      return;
    }

    if (!validate(expression)) {
      this.logger.error(`Expresión cron inválida: '${expression}'`);
      return;
    }

    const timezone =
      process.env.SCRAPING_TIMEZONE ?? 'America/Argentina/Buenos_Aires';

    this.currentTask = schedule(
      expression,
      () => { void this.handleTick(frequency); },
      { timezone },
    );
    this.currentFrequency = frequency;

    this.logger.log(
      `Scheduler arrancado — frequency='${frequency}', cron='${expression}', tz='${timezone}'`,
    );
  }

  private stopTask(): void {
    if (this.currentTask) {
      this.currentTask.stop();
      this.logger.log(
        `Scheduler detenido (frequency anterior='${this.currentFrequency}')`,
      );
      this.currentTask = null;
      this.currentFrequency = null;
    }
  }

  /** Tick del cron — encola jobs para todas las URLs activas. */
  private async handleTick(frequency: string): Promise<void> {
    this.logger.log(`Tick (${frequency}) — encolando jobs`);
    try {
      const result = await this.jobsService.triggerAll();
      this.logger.log(`Tick OK — ${result.enqueued} jobs encolados`);
    } catch (err) {
      this.logger.error(`Tick falló: ${String(err)}`);
    }
  }
}
