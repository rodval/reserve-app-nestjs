import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';

/**
 * Pasa un objeto por el mismo ValidationPipe que usa la app (app.setup.ts)
 * para testear DTOs sin levantar Nest. Resuelve con la instancia
 * transformada o rechaza con BadRequestException.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

export function validateDto<T>(
  metatype: new () => T,
  value: unknown,
  type: ArgumentMetadata['type'] = 'body',
): Promise<T> {
  return pipe.transform(value, { type, metatype }) as Promise<T>;
}

/** Devuelve los mensajes de error de validación (o [] si es válido). */
export async function validationErrors(
  metatype: new () => unknown,
  value: unknown,
  type: ArgumentMetadata['type'] = 'body',
): Promise<string[]> {
  try {
    await pipe.transform(value, { type, metatype });
    return [];
  } catch (error) {
    const response = (
      error as { getResponse?: () => { message?: string[] } }
    ).getResponse?.();
    return response?.message ?? [];
  }
}
