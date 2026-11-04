import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { ROLES_KEY } from '../decorator/roles.decorator';
import { AuthUser } from '../types';

/**
 * Lee los roles pedidos con @Roles() y los compara con request.user.role.
 *
 * Debe ir DESPUÉS de JwtGuard, que es quien carga request.user:
 *   @UseGuards(JwtGuard, RolesGuard)
 *
 * - Sin @Roles() -> deja pasar a cualquier usuario autenticado.
 * - Con @Roles() y rol incorrecto -> 403 Forbidden.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // getAllAndOverride: si el método tiene @Roles usa ese; si no, el del controller.
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<Request>().user as
      | AuthUser
      | undefined;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('No tenés permisos para esta acción');
    }
    return true;
  }
}
