-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "lastLatitude" DOUBLE PRECISION,
ADD COLUMN     "lastLocationUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "lastLongitude" DOUBLE PRECISION;
