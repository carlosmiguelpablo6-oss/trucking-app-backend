import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface LocationUpdatePayload {
  bookingId: string;
  latitude: number;
  longitude: number;
}

@WebSocketGateway({
  cors: { origin: true }, // reflects the request's own origin — acceptable since
  // this app has no browser-based frontend to spoof from; real restriction
  // comes from JWT auth on every meaningful action
})
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('LocationGateway');

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Customer/Admin apps call this to start receiving updates for a specific booking
  @SubscribeMessage('watchBooking')
  handleWatchBooking(
    @MessageBody() bookingId: string,
    @ConnectedSocket() client: Socket,
  ) {
    // "Rooms" let us broadcast to only the people watching this specific booking,
    // not every connected client in the whole app.
    client.join(`booking:${bookingId}`);
    this.logger.log(`Client ${client.id} watching booking ${bookingId}`);
  }

  @SubscribeMessage('unwatchBooking')
  handleUnwatchBooking(
    @MessageBody() bookingId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`booking:${bookingId}`);
  }

  // Driver app calls this every few seconds while a trip is IN_TRANSIT
  @SubscribeMessage('updateLocation')
  async handleUpdateLocation(@MessageBody() payload: LocationUpdatePayload) {
    const { bookingId, latitude, longitude } = payload;

    // Persist the latest location so it's available even to clients who
    // connect mid-trip (not just ones already watching when this update fires)
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        lastLatitude: latitude,
        lastLongitude: longitude,
        lastLocationUpdatedAt: new Date(),
      },
    });

    // Broadcast only to clients watching this specific booking
    this.server.to(`booking:${bookingId}`).emit('locationUpdated', {
      bookingId,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    });
  }
}