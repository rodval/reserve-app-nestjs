import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('secreto-de-tests-largo'),
  };
  const strategy = new JwtStrategy(
    config as unknown as ConfigService,
    prisma as unknown as PrismaService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('lee JWT_SECRET de la configuración', () => {
    const fresh = new JwtStrategy(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
    expect(fresh).toBeDefined();
    expect(config.getOrThrow).toHaveBeenCalledWith('JWT_SECRET');
  });

  it('busca el usuario del token (sub) sin el hash', async () => {
    const user = { id: 7, email: 'ana@mail.com', role: 'USER' };
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      strategy.validate({ sub: 7, email: 'ana@mail.com' }),
    ).resolves.toBe(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      omit: { hash: true },
    });
  });

  it('devuelve null si el usuario ya no existe (el guard responde 401)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 99, email: 'borrado@mail.com' }),
    ).resolves.toBeNull();
  });
});
