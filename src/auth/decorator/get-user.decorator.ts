import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../types';

/**
 * Decorador de parámetro que devuelve el usuario autenticado (request.user).
 *
 *   me(@GetUser() user: AuthUser)          -> el usuario completo
 *   me(@GetUser('id') userId: number)      -> solo un campo
 *
 * Solo tiene sentido en rutas protegidas con JwtGuard.
 */
export const GetUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser;
    return field ? user?.[field] : user;
  },
);
