import { SetMetadata } from '@nestjs/common';

// Usage: @Roles('ADMIN') above a route — marks which roles can access it
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);