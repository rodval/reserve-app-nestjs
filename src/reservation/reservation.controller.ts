import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { GetUser, Roles } from '../auth/decorator';
import { JwtGuard, RolesGuard } from '../auth/guard';
import type { AuthUser } from '../auth/types';
import {
  AvailabilityQueryDto,
  CreateReservationDto,
  QueryMyReservationsDto,
  QueryReservationsDto,
} from './dto';
import { ReservationService } from './reservation.service';

@UseGuards(JwtGuard, RolesGuard)
@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationController {
  constructor(private reservationService: ReservationService) {}

  // POST /reservations -> 201, queda PENDING
  @ApiOperation({ summary: 'Reservar un recurso (queda PENDING)' })
  @Post()
  create(@GetUser() user: AuthUser, @Body() dto: CreateReservationDto) {
    return this.reservationService.create(user, dto);
  }

  // Las rutas fijas ('me', 'availability') van ANTES de ':id';
  // si no, Nest intentaría interpretar "me" como un id.

  // GET /reservations/me?status=CONFIRMED&from=...&to=...
  @ApiOperation({ summary: 'Ver mis reservas' })
  @Get('me')
  findMine(
    @GetUser('id') userId: number,
    @Query() query: QueryMyReservationsDto,
  ) {
    return this.reservationService.findMine(userId, query);
  }

  // GET /reservations/availability?resourceId=1&from=...&to=...
  @ApiOperation({ summary: 'Ver horarios ocupados de un recurso' })
  @Get('availability')
  availability(
    @GetUser() user: AuthUser,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.reservationService.availability(user, query);
  }

  // GET /reservations — todas (ADMIN)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar todas las reservas (ADMIN)' })
  @Get()
  findAll(@Query() query: QueryReservationsDto) {
    return this.reservationService.findAll(query);
  }

  // GET /reservations/:id — dueño o ADMIN
  @ApiOperation({ summary: 'Ver una reserva (dueño o ADMIN)' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @GetUser() user: AuthUser) {
    return this.reservationService.findOne(id, user);
  }

  // PATCH /reservations/:id/confirm — ADMIN
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Confirmar una reserva pendiente (ADMIN)' })
  @Patch(':id/confirm')
  confirm(@Param('id', ParseIntPipe) id: number, @GetUser() user: AuthUser) {
    return this.reservationService.confirm(id, user);
  }

  // PATCH /reservations/:id/cancel — dueño o ADMIN
  @ApiOperation({ summary: 'Cancelar una reserva (dueño o ADMIN)' })
  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @GetUser() user: AuthUser) {
    return this.reservationService.cancel(id, user);
  }
}
