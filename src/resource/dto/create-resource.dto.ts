import { ApiProperty } from '@nestjs/swagger';
import { ResourceType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: ResourceType, example: ResourceType.SPACE })
  @IsEnum(ResourceType, {
    message: `El tipo debe ser uno de: ${Object.values(ResourceType).join(', ')}`,
  })
  type: ResourceType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  // Campos libres según el tipo: { "serialNumber": "AB-12" } o { "m2": 40 }.
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}
