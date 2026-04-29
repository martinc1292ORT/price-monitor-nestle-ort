import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  AlertSeverity,
  AlertStatus,
} from '../alerts.constants';

export class QueryAlertsDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  retailerUrlId?: number;

  @IsOptional()
  @IsIn(ALERT_SEVERITIES)
  severity?: AlertSeverity;

  @IsOptional()
  @IsIn(ALERT_STATUSES)
  status?: AlertStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
