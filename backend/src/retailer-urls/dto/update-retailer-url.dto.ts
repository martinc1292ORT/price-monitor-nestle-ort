import { IsString, IsNotEmpty, IsOptional, IsUrl, IsIn } from 'class-validator';

export class UpdateRetailerUrlDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  retailerName?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  internalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'error', 'not_found'])
  status?: string;
}
