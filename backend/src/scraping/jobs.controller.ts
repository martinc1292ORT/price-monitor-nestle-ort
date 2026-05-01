import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
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
}
