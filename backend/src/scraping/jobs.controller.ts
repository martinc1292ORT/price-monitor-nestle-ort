import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateMonitoringConfigDto } from './dto/update-monitoring-config.dto';
import { JobsService, TriggerResult } from './jobs.service';
import { ScrapingScheduler } from './scraping.scheduler';

/**
 * Endpoints de control del scheduler de scraping.
 * Base path: `/api/jobs` (el prefijo `/api` lo aplica `app.setGlobalPrefix`).
 */
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly scheduler: ScrapingScheduler,
  ) {}

  /**
   * Dispara manualmente el encolado de jobs para todas las URLs activas.
   * Solo accesible para usuarios con rol 'admin'.
   */
  @Post('trigger')
  @Roles('admin')
  @HttpCode(HttpStatus.ACCEPTED)
  trigger(): Promise<TriggerResult> {
    return this.jobsService.triggerAll();
  }

  /** Lee la configuración actual del scheduler de monitoreo. */
  @Get('config')
  @Roles('admin')
  getConfig() {
    return this.jobsService.getConfig();
  }

  /**
   * Actualiza la frecuencia del scheduler.
   *
   * Orquesta dos operaciones para aplicar el cambio en caliente:
   *   1. Persiste la nueva frecuencia en `MonitoringConfig` (DB).
   *   2. Le pide al `ScrapingScheduler` que detenga el cron en memoria
   *      y arranque uno nuevo con la frecuencia actualizada.
   *
   * Sin este reschedule, la nueva config solo tomaría efecto al
   * reiniciar el server.
   */
  @Patch('config')
  @Roles('admin')
  async updateConfig(@Body() dto: UpdateMonitoringConfigDto) {
    const updated = await this.jobsService.updateConfig(dto);
    this.scheduler.reschedule(updated.frequency);
    return updated;
  }
}
