import { ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Filtros de GET /resources?type=SPACE&search=sala&includeInactive=true
 * Los query params siempre llegan como string; el ValidationPipe (transform)
 * y @Transform los convierten al tipo correcto.
 */
export class QueryResourceDto {
  @ApiPropertyOptional({ enum: ResourceType })
  @IsOptional()
  @IsEnum(ResourceType)
  type?: ResourceType;

  // Busca en nombre, descripción y ubicación.
  @IsOptional()
  @IsString()
  search?: string;

  // Solo tiene efecto para ADMIN.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeInactive?: boolean;
}
