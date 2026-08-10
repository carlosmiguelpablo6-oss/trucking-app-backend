import { IsUUID, IsOptional, IsNumber, Min } from 'class-validator';

export class AssignDriverDto {
  @IsUUID()
  driverId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;
}