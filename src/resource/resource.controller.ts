import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { CreateResourceDto, QueryResourceDto, UpdateResourceDto } from './dto';
import { ResourceService } from './resource.service';

// Leer: cualquier usuario autenticado. Escribir: solo ADMIN.
@UseGuards(JwtGuard, RolesGuard)
@ApiTags('resources')
@ApiBearerAuth()
@Controller('resources')
export class ResourceController {
  constructor(private resourceService: ResourceService) {}

  // GET /resources?type=EQUIPMENT&search=taladro
  @ApiOperation({
    summary: 'Listar recursos (filtros: type, search, includeInactive)',
  })
  @Get()
  findAll(@Query() query: QueryResourceDto, @GetUser() user: AuthUser) {
    return this.resourceService.findAll(query, user);
  }

  // GET /resources/:id
  @ApiOperation({ summary: 'Ver un recurso' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @GetUser() user: AuthUser) {
    return this.resourceService.findOne(id, user);
  }

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Crear un recurso (ADMIN)' })
  @Post()
  create(@Body() dto: CreateResourceDto) {
    return this.resourceService.create(dto);
  }

  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Editar un recurso; isActive: true lo reactiva (ADMIN)',
  })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.resourceService.update(id, dto);
  }

  // DELETE /resources/:id -> baja lógica, 204 No Content
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Dar de baja un recurso (baja lógica) (ADMIN)' })
  @Delete(':id')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.resourceService.deactivate(id);
  }
}
