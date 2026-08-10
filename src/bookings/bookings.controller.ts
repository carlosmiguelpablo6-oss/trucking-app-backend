import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { EndTripDto } from './dto/end-trip.dto';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RateBookingDto } from './dto/rate-booking.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  @Roles('CUSTOMER')
  create(@Request() req, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(req.user.userId, dto);
  }

  @Get('mine')
  @Roles('CUSTOMER')
  findMyBookings(@Request() req) {
    return this.bookingsService.findMyBookings(req.user.userId);
  }

  @Get()
  @Roles('ADMIN')
  findAllForAdmin() {
    return this.bookingsService.findAllForAdmin();
  }

  @Get('truck/:truckId/booked-dates')
  @Roles('ADMIN', 'CUSTOMER')
  getBookedDates(@Param('truckId') truckId: string) {
    return this.bookingsService.getBookedDates(truckId);
  }

  @Patch(':id/assign-driver')
     @Roles('ADMIN')
     assignDriver(@Param('id') id: string, @Body() dto: AssignDriverDto) {
       return this.bookingsService.assignDriver(id, dto.driverId, dto.estimatedCost);
     }

  @Get('my-trips')
  @Roles('DRIVER')
  findMyTrips(@Request() req) {
    return this.bookingsService.findMyTrips(req.user.userId);
  }

  @Patch(':id/start-trip')
  @Roles('DRIVER')
  startTrip(@Param('id') id: string, @Request() req) {
    return this.bookingsService.startTrip(id, req.user.userId);
  }

  @Patch(':id/end-trip')
  @Roles('DRIVER')
  @UseInterceptors(FileInterceptor('proofPhoto'))
  endTrip(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: EndTripDto,
    @UploadedFile() proofPhoto?: Express.Multer.File,
  ) {
    return this.bookingsService.endTrip(
      id,
      req.user.userId,
      dto.actualCost,
      proofPhoto ? { buffer: proofPhoto.buffer, mimeType: proofPhoto.mimetype } : undefined,
    );
  }

  @Get('admin/stats')
  @Roles('ADMIN')
  getAdminStats() {
    return this.bookingsService.getAdminStats();
  }

  @Patch(':id/rate')
  @Roles('CUSTOMER')
  rateBooking(@Param('id') id: string, @Request() req, @Body() dto: RateBookingDto) {
    return this.bookingsService.rateBooking(id, req.user.userId, dto.rating, dto.reviewComment);
  }

  @Get('admin/reports')
  @Roles('ADMIN')
  getReports(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.bookingsService.getReports(startDate, endDate);
  }
  
  @Get(':id')
  @Roles('ADMIN', 'CUSTOMER')
  findOne(@Param('id') id: string, @Request() req) {
    return this.bookingsService.findOne(id, req.user.userId, req.user.role);
  }
}