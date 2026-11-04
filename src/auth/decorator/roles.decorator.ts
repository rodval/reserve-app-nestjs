import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Marca un handler (o un controller entero) con los roles que pueden usarlo.
 * No bloquea nada por sí solo: guarda metadata que después lee RolesGuard.
 *
 *   @Roles(Role.ADMIN)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
