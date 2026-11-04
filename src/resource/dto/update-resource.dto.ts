import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateResourceDto } from './create-resource.dto';

/**
 * PartialType copia todos los campos de CreateResourceDto (con sus
 * validaciones) pero los vuelve opcionales: ideal para PATCH.
 */
export class UpdateResourceDto extends PartialType(CreateResourceDto) {
  // Permite reactivar un recurso dado de baja.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
