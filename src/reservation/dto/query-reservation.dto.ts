import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional } from 'class-validator';
import { IsAfter } from '../../common/validators/is-after.validator';

/** Filtros de GET /reservations/me — from/to devuelven las que se solapan con el rango. */
export class QueryMyReservationsDto {
  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @IsAfter('from')
  to?: Date;
}

/** Filtros de GET /reservations (ADMIN): además permite filtrar por recurso y usuario. */
export class QueryReservationsDto extends QueryMyReservationsDto {
  // Query params llegan como string: @Type los convierte a number.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  resourceId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;
}

/** GET /reservations/availability?resourceId=1&from=...&to=... */
export class AvailabilityQueryDto {
  @Type(() => Number)
  @IsInt()
  resourceId: number;

  @Type(() => Date)
  @IsDate()
  from: Date;

  @Type(() => Date)
  @IsDate()
  @IsAfter('from')
  to: Date;
}
