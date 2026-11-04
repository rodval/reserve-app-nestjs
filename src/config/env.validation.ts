// Necesario para enableImplicitConversion (lee los tipos de las propiedades).
// En la app ya lo carga Nest, pero este archivo no debe depender de eso.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Describe las variables de entorno que la app necesita.
 * Se valida una sola vez al arrancar: si falta algo, la app no levanta
 * y el error dice exactamente qué variable está mal.
 */
class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @MinLength(16)
  JWT_SECRET: string;

  // Formato de la librería "ms": 15m, 1h, 7d...
  @IsOptional()
  @Matches(/^\d+[smhd]$/, {
    message: 'JWT_EXPIRES_IN debe tener formato como 15m, 1h o 7d',
  })
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT?: number;
}

export function validateEnv(config: Record<string, unknown>) {
  // enableImplicitConversion convierte "3000" (string del .env) en 3000.
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const detail = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Variables de entorno inválidas: ${detail}`);
  }

  return validated;
}
