import { User } from '@prisma/client';

/** Contenido que firmamos dentro del JWT. `sub` (subject) es el id del usuario. */
export interface JwtPayload {
  sub: number;
  email: string;
}

/** Usuario autenticado tal como queda en `request.user` (nunca incluye el hash). */
export type AuthUser = Omit<User, 'hash'>;

export interface AuthTokens {
  access_token: string;
}
