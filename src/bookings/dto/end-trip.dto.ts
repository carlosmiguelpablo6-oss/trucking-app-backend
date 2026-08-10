import { IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EndTripDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualCost?: number;
}