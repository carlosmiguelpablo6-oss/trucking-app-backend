import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByRole(role?: 'CUSTOMER' | 'DRIVER' | 'ADMIN') {
    const users = await this.prisma.user.findMany({
      where: role ? { role } : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // For drivers specifically, attach whether they currently have an active trip
    if (role === 'DRIVER') {
      const activeBookings = await this.prisma.booking.findMany({
        where: { status: { in: ['ASSIGNED', 'IN_TRANSIT'] } },
        select: { driverId: true },
      });
      const busyDriverIds = new Set(activeBookings.map((b) => b.driverId));

      return users.map((u) => ({
        ...u,
        isCurrentlyBusy: busyDriverIds.has(u.id),
      }));
    }

    return users;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async setActiveStatus(id: string, isActive: boolean) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
  }

  async resetPassword(id: string, newPassword: string) {
    await this.findOne(id); // throws 404 if it doesn't exist

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return { success: true };
  }
}