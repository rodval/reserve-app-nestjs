import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard: decide si la request puede llegar al handler.
 * Usa la estrategia 'jwt'; sin token válido responde 401 Unauthorized.
 *
 * Uso: @UseGuards(JwtGuard) en un controller o en un método.
 */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {}
