-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'ASSIGNED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "driverId" TEXT;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
