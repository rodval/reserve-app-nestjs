import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationStatus, Role } from '@prisma/client';
import type { AuthUser } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceService } from '../resource/resource.service';
import {
  AvailabilityQueryDto,
  CreateReservationDto,
  QueryMyReservationsDto,
  QueryReservationsDto,
} from './dto';

/** Estados que ocupan el recurso. Una reserva cancelada libera el horario. */
const BLOCKING_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
];

/** Espacio de nombres del advisory lock (cualquier entero fijo y único en la app). */
const RESERVATION_LOCK_NAMESPACE = 1001;

const resourceSummary = { select: { id: true, name: true, type: true } };
const userSummary = {
  select: { id: true, email: true, firstName: true, lastName: true },
};

@Injectable()
export class ReservationService {
  constructor(
    private prisma: PrismaService,
    private resourceService: ResourceService,
  ) {}

  /**
   * Crea una reserva PENDING si el recurso está libre en ese horario.
   *
   * Problema clásico: dos requests simultáneas para el mismo horario podrían
   * pasar las dos el chequeo de solapamiento antes de que alguna inserte.
   * Solución: dentro de una transacción tomamos un advisory lock de Postgres
   * por recurso. La segunda request espera a que la primera termine y,
   * cuando chequea, ya ve la reserva creada. Reservas de recursos distintos
   * no se bloquean entre sí.
   */
  async create(user: AuthUser, dto: CreateReservationDto) {
    return this.prisma.$transaction(async (tx) => {
      // Se libera solo al terminar la transacción (commit o rollback).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RESERVATION_LOCK_NAMESPACE}::int, ${dto.resourceId}::int)`;

      const resource = await tx.resource.findUnique({
        where: { id: dto.resourceId },
        select: { isActive: true },
      });
      if (!resource || !resource.isActive) {
        throw new NotFoundException(`Recurso ${dto.resourceId} no encontrado`);
      }

      const overlap = await tx.reservation.findFirst({
        where: {
          resourceId: dto.resourceId,
          status: { in: BLOCKING_STATUSES },
          ...this.overlapsWith(dto.startAt, dto.endAt),
        },
        select: { startAt: true, endAt: true },
      });
      if (overlap) {
        throw new ConflictException(
          `El recurso ya está reservado entre ${overlap.startAt.toISOString()} y ${overlap.endAt.toISOString()}`,
        );
      }

      // Una excepción en cualquier punto hace rollback de toda la transacción.
      return tx.reservation.create({
        data: {
          resourceId: dto.resourceId,
          userId: user.id,
          startAt: dto.startAt,
          endAt: dto.endAt,
          notes: dto.notes,
        },
        include: { resource: resourceSummary },
      });
    });
  }

  findMine(userId: number, query: QueryMyReservationsDto) {
    return this.prisma.reservation.findMany({
      where: { userId, ...this.filters(query) },
      include: { resource: resourceSummary },
      orderBy: { startAt: 'asc' },
    });
  }

  findAll(query: QueryReservationsDto) {
    return this.prisma.reservation.findMany({
      where: {
        resourceId: query.resourceId,
        userId: query.userId,
        ...this.filters(query),
      },
      include: { resource: resourceSummary, user: userSummary },
      orderBy: { startAt: 'asc' },
    });
  }

  /**
   * Horarios ocupados de un recurso en un rango. No expone quién reservó:
   * cualquier usuario puede consultarlo para elegir un horario libre.
   */
  async availability(user: AuthUser, query: AvailabilityQueryDto) {
    // Reutiliza las reglas del módulo de recursos (404 si no existe o está inactivo).
    await this.resourceService.findOne(query.resourceId, user);

    const busy = await this.prisma.reservation.findMany({
      where: {
        resourceId: query.resourceId,
        status: { in: BLOCKING_STATUSES },
        ...this.overlapsWith(query.from, query.to),
      },
      select: { startAt: true, endAt: true, status: true },
      orderBy: { startAt: 'asc' },
    });

    return {
      resourceId: query.resourceId,
      from: query.from,
      to: query.to,
      busy,
    };
  }

  /** El dueño o un ADMIN. Para cualquier otro, 404 (no revelamos que existe). */
  async findOne(id: number, user: AuthUser) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { resource: resourceSummary, user: userSummary },
    });

    if (
      !reservation ||
      (reservation.userId !== user.id && user.role !== Role.ADMIN)
    ) {
      throw new NotFoundException(`Reserva ${id} no encontrada`);
    }
    return reservation;
  }

  async confirm(id: number, admin: AuthUser) {
    const reservation = await this.findOne(id, admin);

    if (reservation.status !== ReservationStatus.PENDING) {
      throw new ConflictException(
        `Solo se pueden confirmar reservas pendientes (estado actual: ${reservation.status})`,
      );
    }
    if (reservation.startAt <= new Date()) {
      throw new BadRequestException(
        'No se puede confirmar una reserva que ya empezó',
      );
    }

    return this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CONFIRMED },
      include: { resource: resourceSummary },
    });
  }

  async cancel(id: number, user: AuthUser) {
    const reservation = await this.findOne(id, user);

    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new ConflictException('La reserva ya está cancelada');
    }
    // Un ADMIN puede cancelar en cualquier momento; el dueño solo antes de que empiece.
    if (user.role !== Role.ADMIN && reservation.startAt <= new Date()) {
      throw new BadRequestException(
        'No se puede cancelar una reserva que ya empezó',
      );
    }

    return this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CANCELLED, cancelledAt: new Date() },
      include: { resource: resourceSummary },
    });
  }

  /**
   * Dos intervalos [a, b) y [c, d) se solapan si a < d y b > c.
   * Ej: 10-12 y 11-13 se solapan; 10-12 y 12-14 no.
   */
  private overlapsWith(from: Date, to: Date): Prisma.ReservationWhereInput {
    return { startAt: { lt: to }, endAt: { gt: from } };
  }

  private filters(query: QueryMyReservationsDto): Prisma.ReservationWhereInput {
    return {
      status: query.status,
      // Si viene solo uno de los dos extremos, filtramos de ese lado.
      ...(query.to && { startAt: { lt: query.to } }),
      ...(query.from && { endAt: { gt: query.from } }),
    };
  }
}
