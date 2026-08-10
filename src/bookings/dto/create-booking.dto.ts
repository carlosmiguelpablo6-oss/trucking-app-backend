import { IsDateString, IsInt, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  truckId: string;

  @IsString()
  @MinLength(2)
  cargoDescription: string;

  @IsInt()
  @Min(1)
  cargoWeightKg: number;

  @IsInt()
  @Min(1)
  itemCount: number;

  @IsString()
  @MinLength(2)
  pickupLocation: string;

  @IsString()
  @MinLength(2)
  dropoffLocation: string;

  @IsDateString()
  scheduledDate: string;
}