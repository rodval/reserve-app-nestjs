import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReservationStatus, Role } from '@prisma/client';
import type { AuthUser } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceService } from '../resource/resource.service';
import { ReservationService } from './reservation.service';

const owner = { id: 1, role: Role.USER } as AuthUser;
const stranger = { id: 2, role: Role.USER } as AuthUser;
const admin = { id: 3, role: Role.ADMIN } as AuthUser;

const HOUR = 60 * 60 * 1000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR);

describe('ReservationService', () => {
  let service: ReservationService;

  // "tx" es el cliente que Prisma pasa dentro de $transaction.
  const tx = {
    $executeRaw: jest.fn(),
    resource: { findUnique: jest.fn() },
    reservation: { findFirst: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    reservation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const resourceService = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => unknown) => fn(tx),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationService,
        { provide: PrismaService, useValue: prisma },
        { provide: ResourceService, useValue: resourceService },
      ],
    }).compile();

    service = moduleRef.get(ReservationService);
  });

  describe('create', () => {
    const dto = { resourceId: 7, startAt: inHours(1), endAt: inHours(2) };

    it('toma el lock del recurso antes de chequear', async () => {
      tx.resource.findUnique.mockResolvedValue({ isActive: true });
      tx.reservation.findFirst.mockResolvedValue(null);

      await service.create(owner, dto);

      expect(tx.$executeRaw).toHaveBeenCalled();
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.reservation.findFirst.mock.invocationCallOrder[0],
      );
    });

    it('404 si el recurso no existe o está inactivo', async () => {
      tx.resource.findUnique.mockResolvedValue({ isActive: false });

      await expect(service.create(owner, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(tx.reservation.create).not.toHaveBeenCalled();
    });

    it('409 si se solapa con otra reserva', async () => {
      tx.resource.findUnique.mockResolvedValue({ isActive: true });
      tx.reservation.findFirst.mockResolvedValue({
        startAt: inHours(1),
        endAt: inHours(3),
      });

      await expect(service.create(owner, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tx.reservation.create).not.toHaveBeenCalled();
    });

    it('busca solapamientos con la regla start < fin y end > inicio', async () => {
      tx.resource.findUnique.mockResolvedValue({ isActive: true });
      tx.reservation.findFirst.mockResolvedValue(null);

      await service.create(owner, dto);

      expect(tx.reservation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            resourceId: 7,
            status: {
              in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
            },
            startAt: { lt: dto.endAt },
            endAt: { gt: dto.startAt },
          },
        }),
      );
      expect(tx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: owner.id }) as object,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('404 para un usuario que no es el dueño', async () => {
      prisma.reservation.findUnique.mockResolvedValue({ id: 1, userId: 1 });

      await expect(service.findOne(1, stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un ADMIN ve reservas ajenas', async () => {
      prisma.reservation.findUnique.mockResolvedValue({ id: 1, userId: 1 });

      await expect(service.findOne(1, admin)).resolves.toEqual({
        id: 1,
        userId: 1,
      });
    });
  });

  describe('confirm', () => {
    it('409 si no está pendiente', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        userId: 1,
        status: ReservationStatus.CANCELLED,
        startAt: inHours(1),
      });

      await expect(service.confirm(1, admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('400 si ya empezó', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        userId: 1,
        status: ReservationStatus.PENDING,
        startAt: inHours(-1),
      });

      await expect(service.confirm(1, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('409 si ya está cancelada', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        userId: 1,
        status: ReservationStatus.CANCELLED,
        startAt: inHours(1),
      });

      await expect(service.cancel(1, owner)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('el dueño no puede cancelar una reserva que ya empezó', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        userId: 1,
        status: ReservationStatus.CONFIRMED,
        startAt: inHours(-1),
      });

      await expect(service.cancel(1, owner)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('un ADMIN sí puede, y queda registrada la fecha', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        userId: 1,
        status: ReservationStatus.CONFIRMED,
        startAt: inHours(-1),
      });

      await service.cancel(1, admin);

      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: ReservationStatus.CANCELLED,
            cancelledAt: expect.any(Date) as Date,
          },
        }),
      );
    });
  });

  describe('findMine', () => {
    it('filtra por usuario, estado y rango (solapamiento)', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);
      const from = inHours(0);
      const to = inHours(24);

      await service.findMine(owner.id, {
        status: ReservationStatus.CONFIRMED,
        from,
        to,
      });

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: owner.id,
            status: ReservationStatus.CONFIRMED,
            startAt: { lt: to },
            endAt: { gt: from },
          },
          orderBy: { startAt: 'asc' },
        }),
      );
    });

    it('sin filtros solo restringe por usuario', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);

      await service.findMine(owner.id, {});

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: owner.id, status: undefined },
        }),
      );
    });
  });

  describe('findAll', () => {
    it('permite filtrar por recurso y usuario e incluye al usuario', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);

      await service.findAll({ resourceId: 7, userId: 2 });

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resourceId: 7,
            userId: 2,
          }) as object,
          include: expect.objectContaining({
            user: expect.anything() as unknown,
          }) as object,
        }),
      );
    });
  });

  describe('availability', () => {
    const query = { resourceId: 7, from: inHours(0), to: inHours(24) };

    it('valida el recurso con ResourceService (reutiliza sus reglas)', async () => {
      prisma.reservation.findMany.mockResolvedValue([]);

      await service.availability(owner, query);

      expect(resourceService.findOne).toHaveBeenCalledWith(7, owner);
    });

    it('propaga el 404 si el recurso no es visible', async () => {
      resourceService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.availability(owner, query)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.reservation.findMany).not.toHaveBeenCalled();
    });

    it('devuelve solo horarios bloqueantes y sin datos del usuario', async () => {
      const busy = [
        { startAt: inHours(1), endAt: inHours(2), status: 'PENDING' },
      ];
      prisma.reservation.findMany.mockResolvedValue(busy);

      const result = await service.availability(owner, query);

      expect(result).toEqual({ ...query, busy });
      const [args] = prisma.reservation.findMany.mock.calls[0] as [
        { where: { status: unknown }; select: Record<string, boolean> },
      ];
      expect(args.where.status).toEqual({
        in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
      });
      expect(args.select).toEqual({ startAt: true, endAt: true, status: true });
    });
  });
});
