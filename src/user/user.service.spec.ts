import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as argon from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;

  const prisma = {
    user: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(UserService);
  });

  describe('changePassword', () => {
    beforeEach(async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 1,
        hash: await argon.hash('clave-actual'),
      });
    });

    it('rechaza si la contraseña actual es incorrecta', async () => {
      await expect(
        service.changePassword(1, {
          currentPassword: 'otra',
          newPassword: 'clave-nueva',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('guarda el hash de la nueva contraseña', async () => {
      await service.changePassword(1, {
        currentPassword: 'clave-actual',
        newPassword: 'clave-nueva',
      });

      const [{ data }] = prisma.user.update.mock.calls[0] as [
        { data: { hash: string } },
      ];
      expect(await argon.verify(data.hash, 'clave-nueva')).toBe(true);
    });
  });

  describe('updateRole', () => {
    it('no permite cambiar el rol propio', async () => {
      await expect(service.updateRole(1, 1, Role.USER)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('actualiza el rol de otro usuario', async () => {
      prisma.user.update.mockResolvedValue({ id: 2, role: Role.ADMIN });

      await service.updateRole(1, 2, Role.ADMIN);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2 },
          data: { role: Role.ADMIN },
        }),
      );
    });
  });

  describe('findAll y editMe', () => {
    it('findAll nunca incluye el hash', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ omit: { hash: true } }),
      );
    });

    it('editMe actualiza solo al usuario autenticado y sin hash', async () => {
      await service.editMe(5, { firstName: 'Ana' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { firstName: 'Ana' },
        omit: { hash: true },
      });
    });
  });
});
