import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Traduce los errores conocidos de Prisma a respuestas HTTP con sentido,
 * para que los services no tengan que hacer try/catch en cada consulta.
 *
 * Códigos: https://www.prisma.io/docs/orm/reference/error-reference
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const mapped = this.map(exception);

    // Error de Prisma que no conocemos: lo maneja Nest como 500.
    if (!mapped) {
      return super.catch(exception, host);
    }

    const response = host.switchToHttp().getResponse<Response>();
    response.status(mapped.status).json({
      statusCode: mapped.status,
      message: mapped.message,
      error: HttpStatus[mapped.status],
    });
  }

  private map(
    exception: Prisma.PrismaClientKnownRequestError,
  ): { status: HttpStatus; message: string } | null {
    switch (exception.code) {
      case 'P2002': {
        // Unique constraint (ej: email repetido).
        const target = (exception.meta?.target as string[] | undefined)?.join(
          ', ',
        );
        return {
          status: HttpStatus.CONFLICT,
          message: target
            ? `Ya existe un registro con ese valor en: ${target}`
            : 'El registro ya existe',
        };
      }
      case 'P2003':
        // Foreign key inválida (ej: reservar un resourceId que no existe).
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Referencia a un registro relacionado que no existe',
        };
      case 'P2025':
        // update/delete sobre un registro que no existe.
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Registro no encontrado',
        };
      default:
        return null;
    }
  }
}
