import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextWithUser(user?: { role: Role }) {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  afterEach(() => jest.restoreAllMocks());

  it('deja pasar si la ruta no tiene @Roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(contextWithUser({ role: Role.USER }))).toBe(true);
  });

  it('deja pasar si el usuario tiene el rol pedido', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    expect(guard.canActivate(contextWithUser({ role: Role.ADMIN }))).toBe(true);
  });

  it('responde 403 si el usuario no tiene el rol', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    expect(() =>
      guard.canActivate(contextWithUser({ role: Role.USER })),
    ).toThrow(ForbiddenException);
  });

  it('responde 403 si no hay usuario en la request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

    expect(() => guard.canActivate(contextWithUser())).toThrow(
      ForbiddenException,
    );
  });
});
