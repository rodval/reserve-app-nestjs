import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinDate,
} from 'class-validator';
import { IsAfter } from '../../common/validators/is-after.validator';

export class CreateReservationDto {
  @IsInt()
  resourceId: number;

  // @Type convierte el string ISO del JSON ("2026-11-10T14:00:00Z") en Date.
  // MinDate con función: "ahora" se calcula en cada request, no al arrancar.
  @Type(() => Date)
  @IsDate({ message: 'startAt debe ser una fecha ISO válida' })
  @MinDate(() => new Date(), { message: 'startAt debe ser una fecha futura' })
  startAt: Date;

  @Type(() => Date)
  @IsDate({ message: 'endAt debe ser una fecha ISO válida' })
  @IsAfter('startAt')
  endAt: Date;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
