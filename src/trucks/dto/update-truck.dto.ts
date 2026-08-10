import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TruckStatusDto } from './create-truck.dto';

export class UpdateTruckDto {
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacityKg?: number;

  @IsOptional()
  @IsEnum(TruckStatusDto)
  status?: TruckStatusDto;
}