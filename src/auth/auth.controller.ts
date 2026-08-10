import { Body, Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { NotificationsService } from '../notifications/notifications.service';


@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService,
    private notificationsService: NotificationsService
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('fcm-token')
  async saveFcmToken(@Request() req, @Body('fcmToken') fcmToken: string) {
    await this.notificationsService.saveDeviceToken(req.user.userId, fcmToken);
    return { success: true };
  }
}