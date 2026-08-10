import { IsEnum, IsInt, IsString, Min } from 'class-validator';

export enum TruckStatusDto {
  AVAILABLE = 'AVAILABLE',
  ON_TRIP = 'ON_TRIP',
  MAINTENANCE = 'MAINTENANCE',
}

export class CreateTruckDto {
  @IsString()
  plateNumber: string;

  @IsString()
  model: string;

  @IsInt()
  @Min(1)
  capacityKg: number;
}