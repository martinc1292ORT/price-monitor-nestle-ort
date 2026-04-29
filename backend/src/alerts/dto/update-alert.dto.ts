import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ALERT_STATUSES } from '../alerts.constants';
import type { AlertStatus } from '../alerts.constants';

export class UpdateAlertDto {
  @IsOptional()
  @IsIn(ALERT_STATUSES)
  status?: AlertStatus;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  resolutionComment?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedUserId?: number | null;
}
