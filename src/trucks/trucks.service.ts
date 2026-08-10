import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTruckDto } from './dto/create-truck.dto';
import { UpdateTruckDto } from './dto/update-truck.dto';

@Injectable()
export class TrucksService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTruckDto) {
    const existing = await this.prisma.truck.findUnique({
      where: { plateNumber: dto.plateNumber },
    });
    if (existing) {
      throw new ConflictException('A truck with this plate number already exists');
    }

    return this.prisma.truck.create({ data: dto });
  }

  async findAll() {
    return this.prisma.truck.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAvailable(minCapacityKg: number) {
    return this.prisma.truck.findMany({
      where: {
        status: 'AVAILABLE',
        capacityKg: { gte: minCapacityKg },
      },
      orderBy: { capacityKg: 'asc' },
    });
  }

  async findOne(id: string) {
    const truck = await this.prisma.truck.findUnique({ where: { id } });
    if (!truck) {
      throw new NotFoundException('Truck not found');
    }
    return truck;
  }

  async update(id: string, dto: UpdateTruckDto) {
    await this.findOne(id); // throws 404 if it doesn't exist

    if (dto.plateNumber) {
      const existing = await this.prisma.truck.findUnique({
        where: { plateNumber: dto.plateNumber },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('A truck with this plate number already exists');
      }
    }

    return this.prisma.truck.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id); // throws 404 if it doesn't exist
    return this.prisma.truck.delete({ where: { id } });
  }
}