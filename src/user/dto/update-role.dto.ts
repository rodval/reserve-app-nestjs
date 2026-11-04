import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role, {
    message: `El rol debe ser uno de: ${Object.values(Role).join(', ')}`,
  })
  role: Role;
}
