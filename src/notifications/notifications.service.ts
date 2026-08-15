import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (getApps().length === 0) {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

      const credential = serviceAccountJson
        ? cert(JSON.parse(serviceAccountJson))
        : cert(path.join(process.cwd(), 'firebase-service-account.json'));

      initializeApp({ credential });
      this.logger.log('Firebase Admin initialized');
    }
  }

  async saveDeviceToken(userId: string, fcmToken: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });

    this.logger.log(`FCM token saved for user ${userId}`);
  }

  async sendToAllAdmins(title: string, body: string) {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', fcmToken: { not: null } },
      select: { id: true },
    });
    await Promise.all(admins.map((admin) => this.sendToUser(admin.id, title, body)));
  }

  async sendToUser(userId: string, title: string, body: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      this.logger.warn(`No FCM token found for user ${userId}.`);
      return;
    }

    try {
      await getMessaging().send({
        token: user.fcmToken,
        notification: {
          title,
          body,
        },
      });

      this.logger.log(`Notification sent to user ${userId}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send notification to user ${userId}: ${error.message}`,
        error.stack,
      );
    }
  }
}