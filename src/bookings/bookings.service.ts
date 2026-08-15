import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService,
    private notifications: NotificationsService,
    private storage: StorageService,
  ) {}

  async create(customerId: string, dto: CreateBookingDto) {
    const truck = await this.prisma.truck.findUnique({
      where: { id: dto.truckId },
    });

    if (!truck) {
      throw new NotFoundException('Selected truck not found');
    }

    if (truck.status !== 'AVAILABLE') {
      throw new BadRequestException('Selected truck is not currently available');
    }

    if (truck.capacityKg < dto.cargoWeightKg) {
      throw new BadRequestException(
        `Truck capacity (${truck.capacityKg}kg) is too small for this cargo (${dto.cargoWeightKg}kg)`,
      );
    }



    // Prevent double-booking the same truck on the same date
   const requestedDate = new Date(dto.scheduledDate);
   const startOfDay = new Date(requestedDate.setHours(0, 0, 0, 0));
   const endOfDay = new Date(requestedDate.setHours(23, 59, 59, 999));

   const conflictingBooking = await this.prisma.booking.findFirst({
     where: {
       truckId: dto.truckId,
       status: { in: ['PENDING', 'IN_TRANSIT'] },
       scheduledDate: { gte: startOfDay, lte: endOfDay },
     },
   });
   if (conflictingBooking) {
     throw new ConflictException(
       'This truck is already booked on the selected date. Please choose a different date.',
     );
   }

    const booking = await this.prisma.booking.create({
          data: {
            customerId,
            truckId: dto.truckId,
            cargoDescription: dto.cargoDescription,
            cargoWeightKg: dto.cargoWeightKg,
            itemCount: dto.itemCount,
            pickupLocation: dto.pickupLocation,
            dropoffLocation: dto.dropoffLocation,
            scheduledDate: new Date(dto.scheduledDate),
          },
          include: { truck: true },
        });

        await this.notifications.sendToUser(
          customerId,
          'Booking Confirmed',
          `Your booking for ${dto.cargoDescription} has been submitted.`,
        );
        await this.notifications.sendToAllAdmins(
          'New Booking',
          `A new booking for ${dto.cargoDescription} needs a driver.`,
        );

        return booking;
  }

  async getAdminStats() {
    const [totalTrucks, availableTrucks, pendingBookings, activeTrips, totalCustomers, totalDrivers] =
      await this.prisma.$transaction([
        this.prisma.truck.count(),
        this.prisma.truck.count({ where: { status: 'AVAILABLE' } }),
        this.prisma.booking.count({ where: { status: 'PENDING' } }),
        this.prisma.booking.count({ where: { status: { in: ['ASSIGNED', 'IN_TRANSIT'] } } }),
        this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
        this.prisma.user.count({ where: { role: 'DRIVER' } }),
      ]);

    return {
      totalTrucks,
      availableTrucks,
      pendingBookings,
      activeTrips,
      totalCustomers,
      totalDrivers,
    };
  }

  async findMyTrips(driverId: string) {
    return this.prisma.booking.findMany({
      where: { driverId },
      include: {
        truck: true,
        customer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  async startTrip(bookingId: string, driverId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.driverId !== driverId) {
      throw new ForbiddenException('This booking is not assigned to you');
    }
    if (booking.status !== 'ASSIGNED') {
      throw new BadRequestException(
        `Cannot start a trip with status ${booking.status}`,
      );
    }

    // Update booking status and mark the truck as ON_TRIP together
    const [, updatedBooking] = await this.prisma.$transaction([
     this.prisma.truck.update({
       where: { id: booking.truckId },
       data: { status: 'ON_TRIP' },
     }),
     this.prisma.booking.update({
       where: { id: bookingId },
       data: { status: 'IN_TRANSIT' },
       include: { truck: true, customer: { select: { id: true, name: true, email: true } } },
     }),
   ]);

   await this.notifications.sendToUser(
    updatedBooking.customerId,
    'Trip Started',
    'Your Delivery is now on its way!'
   );
   await this.notifications,sendToAllAdmins (
    'Trip Started',
    'A driver has started a delivery trip',
   );

    return updatedBooking;
  }

  async endTrip(bookingId: string, driverId: string, actualCost?: number, proofPhoto?: { buffer: Buffer; mimeType: string },) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.driverId !== driverId) {
      throw new ForbiddenException('This booking is not assigned to you');
    }
    if (booking.status !== 'IN_TRANSIT') {
      throw new BadRequestException(
        `Cannot end a trip with status ${booking.status}`,
      );
    }

    // Upload the photo BEFORE the transaction — if the upload fails,
    // we don't want a half-completed trip with no proof.
    let proofOfDeliveryUrl: string | undefined;
    if (proofPhoto) {
      proofOfDeliveryUrl = await this.storage.uploadPhoto(
        proofPhoto.buffer,
        proofPhoto.mimeType,
      );
    }

    const [, updatedBooking] = await this.prisma.$transaction([
      this.prisma.truck.update({
        where: { id: booking.truckId },
        data: { status: 'AVAILABLE' },
      }),
      this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'COMPLETED',
          ...(actualCost !== undefined && { actualCost }),
          ...(proofOfDeliveryUrl && { proofOfDeliveryUrl }),
        },
        include: { truck: true, customer: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    await this.notifications.sendToUser(
      updatedBooking.customerId,
      'Delivery Completed',
      'Your delivery has arrived at its destination',
    );
    await this.notifications.sendToAllAdmins(
      'Delivery Completed',
      `A trip has been marked as completed.`,
    );

    return updatedBooking;
  }

  async getBookedDates(truckId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        truckId,
        status: { in: ['PENDING', 'IN_TRANSIT'] },
      },
      select: { scheduledDate: true },
    });

    // Return just the date strings (YYYY-MM-DD), for the calendar to check against
    return bookings.map((b) => b.scheduledDate.toISOString().split('T')[0]);
  }

  async findMyBookings(customerId: string) {
    return this.prisma.booking.findMany({
      where: { customerId },
      include: { truck: true },
      orderBy: { createdAt: 'desc' },
      omit: { estimatedCost: true, actualCost: true },
    });
  }
    

  async findAllForAdmin() {
     return this.prisma.booking.findMany({
       include: {
         truck: true,
         customer: { select: { id: true, name: true, email: true } },
         driver: { select: { id: true, name: true, email: true } },
       },
       orderBy: { createdAt: 'desc' },
     });
   }

   async assignDriver(bookingId: string, driverId: string, estimatedCost?: number ) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot assign a driver to a booking with status ${booking.status}`,
      );
    }

    const driver = await this.prisma.user.findUnique({ where: { id: driverId } });
    if (!driver || driver.role !== 'DRIVER') {
      throw new BadRequestException('Selected user is not a valid driver');
    }
    if (!driver.isActive) {
      throw new BadRequestException('Selected driver is not active');
    }

    const updated = await this.prisma.booking.update({
          where: { id: bookingId },
          data: {
            driverId,
            status: 'ASSIGNED',
            ...(estimatedCost !== undefined && { estimatedCost }),
          },
          include: {
            truck: true,
            customer: { select: { id: true, name: true, email: true } },
            driver: { select: { id: true, name: true, email: true } },
          },
        });

        await this.notifications.sendToUser(
          driverId,
          'New Trip Assigned',
          `You've been assigned a delivery: ${updated.cargoDescription}`,
        );
        await this.notifications.sendToUser(
          updated.customerId,
          'Driver Assigned',
          `${updated.driver?.name} has been assigned to your delivery.`,
        );

        return updated;
  }

  async findOne(id: string, requesterId: string, requesterRole: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        truck: true,
        customer: { select: { id: true, name: true, email: true } },
      },
      omit: requesterRole === 'CUSTOMER' ? { estimatedCost: true, actualCost: true } : undefined,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Customers can only view their own bookings; Admins can view any
    if (requesterRole === 'CUSTOMER' && booking.customerId !== requesterId) {
      throw new ForbiddenException('You do not have access to this booking');
    }

    return booking;
  }

  async rateBooking(bookingId: string, customerId: string, rating: number, reviewComment?: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('This booking does not belong to you');
    }
    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException('You can only rate a completed trip');
    }
    if (booking.rating !== null) {
      throw new BadRequestException('This trip has already been rated');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { rating, reviewComment },
      include: { truck: true },
    });
  }

  async getReports(startDate?: string, endDate?: string) {
    const dateFilter =
      startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {};

    const [
      totalBookings,
      pendingCount,
      assignedCount,
      inTransitCount,
      completedCount,
      cancelledCount,
      revenueResult,
    ] = await this.prisma.$transaction([
      this.prisma.booking.count({ where: dateFilter }),
      this.prisma.booking.count({ where: { ...dateFilter, status: 'PENDING' } }),
      this.prisma.booking.count({ where: { ...dateFilter, status: 'ASSIGNED' } }),
      this.prisma.booking.count({ where: { ...dateFilter, status: 'IN_TRANSIT' } }),
      this.prisma.booking.count({ where: { ...dateFilter, status: 'COMPLETED' } }),
      this.prisma.booking.count({ where: { ...dateFilter, status: 'CANCELLED' } }),
      this.prisma.booking.aggregate({
        where: { ...dateFilter, status: 'COMPLETED' },
        _sum: { actualCost: true, estimatedCost: true },
        _avg: { rating: true },
      }),
    ]);

    const totalEstimatedCost = revenueResult._sum.estimatedCost ?? 0;
    const totalActualCost = revenueResult._sum.actualCost ?? 0;

    return {
      totalBookings,
      byStatus: {
        pending: pendingCount,
        assigned: assignedCount,
        inTransit: inTransitCount,
        completed: completedCount,
        cancelled: cancelledCount,
      },
      totalEstimatedCost,
      totalActualCost,
      totalRevenue: totalEstimatedCost - totalActualCost,
      averageRating: revenueResult._avg.rating,
    };
  }
}