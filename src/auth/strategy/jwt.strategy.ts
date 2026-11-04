import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, JwtPayload } from '../types';

/**
 * Estrategia de Passport llamada 'jwt'.
 * 1. Lee el token del header `Authorization: Bearer <token>`.
 * 2. Verifica la firma y la expiración con JWT_SECRET.
 * 3. Llama a validate() con el payload: lo que devuelve queda en `request.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser | null> {
    // Buscamos el usuario en la base: si lo borraron, el token deja de servir.
    // Devolver null hace que el guard responda 401.
    return this.prisma.user.findUnique({
      where: { id: payload.sub },
      omit: { hash: true },
    });
  }
}
