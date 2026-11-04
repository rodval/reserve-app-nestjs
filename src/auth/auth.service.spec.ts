import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  // Reemplazamos Prisma y JwtService por mocks: el test no toca la base.
  const prisma = {
    user: { create: jest.fn(), findUnique: jest.fn() },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('token-falso') };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('signup', () => {
    it('guarda el hash (no la contraseña) y devuelve un token', async () => {
      prisma.user.create.mockResolvedValue({ id: 1, email: 'ana@mail.com' });

      const result = await service.signup({
        email: 'ana@mail.com',
        password: 'super-secreta',
      });

      const [{ data }] = prisma.user.create.mock.calls[0] as [
        { data: { hash: string } },
      ];
      expect(data.hash).not.toBe('super-secreta');
      expect(await argon.verify(data.hash, 'super-secreta')).toBe(true);
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 1,
        email: 'ana@mail.com',
      });
      expect(result).toEqual({ access_token: 'token-falso' });
    });
  });

  describe('signin', () => {
    it('devuelve un token con credenciales correctas', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'ana@mail.com',
        hash: await argon.hash('super-secreta'),
      });

      await expect(
        service.signin({ email: 'ana@mail.com', password: 'super-secreta' }),
      ).resolves.toEqual({ access_token: 'token-falso' });
    });

    it('rechaza una contraseña incorrecta', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'ana@mail.com',
        hash: await argon.hash('super-secreta'),
      });

      await expect(
        service.signin({ email: 'ana@mail.com', password: 'otra-cosa' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rechaza un email que no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.signin({ email: 'nadie@mail.com', password: 'lo-que-sea' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
