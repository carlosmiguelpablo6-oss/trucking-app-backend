import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TrucksService } from './trucks.service';
import { CreateTruckDto } from './dto/create-truck.dto';
import { UpdateTruckDto } from './dto/update-truck.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';


@Controller('trucks')
@UseGuards(JwtAuthGuard, RolesGuard) // every route here requires login + role check
export class TrucksController {
  constructor(private trucksService: TrucksService) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateTruckDto) {
    return this.trucksService.create(dto);
  }

  @Get()
  @Roles('ADMIN') // for now; we'll allow Customers to view available trucks later
  findAll() {
    return this.trucksService.findAll();
  }

  @Get('available')
  @Roles('ADMIN', 'CUSTOMER') // customers need this to book; admins can also check
  findAvailable(@Query('minCapacity') minCapacity: string) {
    const parsed = parseInt(minCapacity, 10) || 0;
    return this.trucksService.findAvailable(parsed);
  }

  @Get(':id')
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.trucksService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateTruckDto) {
    return this.trucksService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.trucksService.remove(id);
  }
}