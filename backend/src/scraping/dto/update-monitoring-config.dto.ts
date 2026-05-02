import { IsIn } from 'class-validator';

/** Frecuencias válidas para el scheduler de monitoreo. */
export const VALID_FREQUENCIES = ['1h', '3h', '6h', '12h', '24h'] as const;
export type MonitoringFrequency = (typeof VALID_FREQUENCIES)[number];

export class UpdateMonitoringConfigDto {
  @IsIn(VALID_FREQUENCIES, {
    message: `frequency debe ser uno de: ${VALID_FREQUENCIES.join(', ')}`,
  })
  frequency!: MonitoringFrequency;
}
