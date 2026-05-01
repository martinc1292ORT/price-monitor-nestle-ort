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

/**
 * Endpoints de control del scheduler de scraping.
 * Base path: `/api/jobs` (el prefijo `/api` lo aplica `app.setGlobalPrefix`).
 */
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

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

  /** Actualiza la frecuencia del scheduler de monitoreo. */
  @Patch('config')
  @Roles('admin')
  updateConfig(@Body() dto: UpdateMonitoringConfigDto) {
    return this.jobsService.updateConfig(dto);
  }
}
