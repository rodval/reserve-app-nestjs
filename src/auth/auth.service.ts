import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { SigninDto, SignupDto } from './dto';
import { AuthTokens, JwtPayload } from './types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthTokens> {
    // Nunca guardamos la contraseña, solo su hash.
    const hash = await argon.hash(dto.password);

    // Si el email ya existe, Prisma lanza P2002 y el PrismaExceptionFilter
    // lo convierte en 409 Conflict: no hace falta try/catch acá.
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        hash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
      select: { id: true, email: true },
    });

    return this.signToken(user.id, user.email);
  }

  async signin(dto: SigninDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Mismo mensaje para "no existe" y "contraseña incorrecta":
    // así no revelamos qué emails están registrados.
    const valid = user ? await argon.verify(user.hash, dto.password) : false;
    if (!user || !valid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    return this.signToken(user.id, user.email);
  }

  private async signToken(userId: number, email: string): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email };
    // El secreto y la expiración vienen de JwtModule.registerAsync (auth.module.ts).
    return { access_token: await this.jwt.signAsync(payload) };
  }
}
