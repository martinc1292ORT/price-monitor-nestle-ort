import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsUrl,
  IsIn,
  Min,
} from 'class-validator';

export class CreateRetailerUrlDto {
  @IsInt()
  @Min(1)
  productId: number;

  @IsString()
  @IsNotEmpty()
  retailerName: string;

  @IsUrl()
  url: string;

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
