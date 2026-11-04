import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, ResourceType, Role } from '@prisma/client';
import type { AuthUser } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceService } from './resource.service';

const asUser = { id: 1, role: Role.USER } as AuthUser;
const asAdmin = { id: 2, role: Role.ADMIN } as AuthUser;

describe('ResourceService', () => {
  let service: ResourceService;

  const prisma = {
    resource: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ResourceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(ResourceService);
  });

  const whereOfLastFindMany = () =>
    (
      prisma.resource.findMany.mock.calls[0] as [
        { where: Prisma.ResourceWhereInput },
      ]
    )[0].where;

  describe('findAll', () => {
    it('un USER solo ve activos aunque pida includeInactive', async () => {
      await service.findAll({ includeInactive: true }, asUser);

      expect(whereOfLastFindMany().isActive).toBe(true);
    });

    it('un ADMIN puede incluir inactivos', async () => {
      await service.findAll({ includeInactive: true }, asAdmin);

      expect(whereOfLastFindMany().isActive).toBeUndefined();
    });

    it('filtra por tipo y búsqueda', async () => {
      await service.findAll(
        { type: ResourceType.EQUIPMENT, search: 'taladro' },
        asUser,
      );

      const where = whereOfLastFindMany();
      expect(where.type).toBe(ResourceType.EQUIPMENT);
      expect(where.OR).toHaveLength(3);
    });
  });

  describe('findOne', () => {
    it('404 si no existe', async () => {
      prisma.resource.findUnique.mockResolvedValue(null);

      await expect(service.findOne(9, asAdmin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('404 para un USER si está inactivo', async () => {
      prisma.resource.findUnique.mockResolvedValue({ id: 1, isActive: false });

      await expect(service.findOne(1, asUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un ADMIN ve recursos inactivos', async () => {
      prisma.resource.findUnique.mockResolvedValue({ id: 1, isActive: false });

      await expect(service.findOne(1, asAdmin)).resolves.toEqual({
        id: 1,
        isActive: false,
      });
    });
  });

  describe('update y deactivate', () => {
    it('404 si el recurso no existe', async () => {
      prisma.resource.count.mockResolvedValue(0);

      await expect(service.update(9, { name: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.deactivate(9)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.resource.update).not.toHaveBeenCalled();
    });

    it('deactivate hace baja lógica', async () => {
      prisma.resource.count.mockResolvedValue(1);

      await service.deactivate(1);

      expect(prisma.resource.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
      });
    });
  });

  describe('create y update (attributes JSON)', () => {
    it('guarda attributes como JSON', async () => {
      await service.create({
        name: 'Torno',
        type: ResourceType.EQUIPMENT,
        attributes: { serialNumber: 'T-1' },
      });

      expect(prisma.resource.create).toHaveBeenCalledWith({
        data: {
          name: 'Torno',
          type: ResourceType.EQUIPMENT,
          attributes: { serialNumber: 'T-1' },
        },
      });
    });

    it('attributes: null en un PATCH borra el valor (DbNull)', async () => {
      prisma.resource.count.mockResolvedValue(1);

      await service.update(1, {
        attributes: null as unknown as Record<string, unknown>,
      });

      expect(prisma.resource.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { attributes: Prisma.DbNull },
      });
    });

    it('si no viene attributes no lo toca', async () => {
      prisma.resource.count.mockResolvedValue(1);

      await service.update(1, { name: 'Nuevo nombre' });

      expect(prisma.resource.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Nuevo nombre', attributes: undefined },
      });
    });
  });
});
