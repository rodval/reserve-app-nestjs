import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { GetUser } from './get-user.decorator';

type Factory = (data: unknown, ctx: ExecutionContext) => unknown;

/**
 * createParamDecorator no expone su función: Nest la guarda como metadata
 * del método. Aplicamos el decorador a una clase de prueba y la leemos.
 */
function getFactory(): Factory {
  class Probe {
    handler(@GetUser() user: unknown) {
      return user;
    }
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'handler') as
    | Record<string, { factory: Factory }>
    | undefined;
  return Object.values(args ?? {})[0].factory;
}

const contextWith = (user: unknown) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('@GetUser', () => {
  const factory = getFactory();
  const user = { id: 1, email: 'ana@mail.com', role: 'USER' };

  it('sin argumento devuelve el usuario completo', () => {
    expect(factory(undefined, contextWith(user))).toBe(user);
  });

  it('con un campo devuelve solo ese campo', () => {
    expect(factory('id', contextWith(user))).toBe(1);
    expect(factory('email', contextWith(user))).toBe('ana@mail.com');
  });

  it('sin usuario en la request devuelve undefined en vez de romper', () => {
    expect(factory('id', contextWith(undefined))).toBeUndefined();
  });
});
