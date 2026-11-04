import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

/**
 * Configuración global de la app. Se usa en main.ts y en los tests e2e
 * para que ambos se comporten exactamente igual.
 */
export function setupApp(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // elimina del body las propiedades que no están en el DTO
      forbidNonWhitelisted: true, // ...y responde 400 si mandan alguna
      transform: true, // convierte el body en instancia del DTO y "1" -> 1 en params
    }),
  );

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaExceptionFilter(httpAdapter));

  // Llama a onModuleDestroy (desconecta Prisma) al recibir SIGTERM/SIGINT.
  app.enableShutdownHooks();
}
