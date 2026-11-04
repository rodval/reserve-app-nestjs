import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/types';
import { CreateResourceDto, QueryResourceDto, UpdateResourceDto } from './dto';

@Injectable()
export class ResourceService {
  constructor(private prisma: PrismaService) {}

  findAll(query: QueryResourceDto, user: AuthUser) {
    const canSeeInactive = user.role === Role.ADMIN && query.includeInactive;

    const where: Prisma.ResourceWhereInput = {
      type: query.type,
      // undefined en Prisma significa "no filtrar por este campo".
      isActive: canSeeInactive ? undefined : true,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
            { location: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    return this.prisma.resource.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: number, user: AuthUser) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });

    // Para un USER, un recurso inactivo es como si no existiera.
    if (!resource || (!resource.isActive && user.role !== Role.ADMIN)) {
      throw new NotFoundException(`Recurso ${id} no encontrado`);
    }
    return resource;
  }

  create(dto: CreateResourceDto) {
    return this.prisma.resource.create({
      data: { ...dto, attributes: this.toJson(dto.attributes) },
    });
  }

  async update(id: number, dto: UpdateResourceDto) {
    await this.ensureExists(id);
    return this.prisma.resource.update({
      where: { id },
      data: { ...dto, attributes: this.toJson(dto.attributes) },
    });
  }

  /**
   * Baja lógica: no borramos la fila para no perder el historial de reservas
   * (fase 5). Se puede reactivar con PATCH { "isActive": true }.
   */
  async deactivate(id: number) {
    await this.ensureExists(id);
    await this.prisma.resource.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async ensureExists(id: number) {
    const count = await this.prisma.resource.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`Recurso ${id} no encontrado`);
    }
  }

  /** Adapta el objeto del DTO al tipo Json de Prisma (null borra el valor). */
  private toJson(value: Record<string, unknown> | null | undefined) {
    if (value === undefined) return undefined;
    if (value === null) return Prisma.DbNull;
    return value as Prisma.InputJsonObject;
  }
}
