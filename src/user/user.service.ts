import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, EditUserDto } from './dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    // omit: nunca devolvemos el hash de la contraseña.
    return this.prisma.user.findMany({
      omit: { hash: true },
      orderBy: { id: 'asc' },
    });
  }

  async editMe(userId: number, dto: EditUserDto) {
    // Email repetido -> P2002 -> 409 (PrismaExceptionFilter).
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      omit: { hash: true },
    });
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const valid = await argon.verify(user.hash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { hash: await argon.hash(dto.newPassword) },
    });
  }

  async updateRole(currentUserId: number, targetId: number, role: Role) {
    // Evita que un admin se quite el rol a sí mismo y la app quede sin admins.
    if (currentUserId === targetId) {
      throw new BadRequestException('No podés cambiar tu propio rol');
    }

    // Si el id no existe -> P2025 -> 404 (PrismaExceptionFilter).
    return this.prisma.user.update({
      where: { id: targetId },
      data: { role },
      omit: { hash: true },
    });
  }
}
