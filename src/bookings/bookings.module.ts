import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    NotificationsModule,
    StorageModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService]
})
export class BookingsModule {}
