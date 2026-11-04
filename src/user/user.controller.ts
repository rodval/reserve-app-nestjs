import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { GetUser, Roles } from '../auth/decorator';
import { JwtGuard, RolesGuard } from '../auth/guard';
import type { AuthUser } from '../auth/types';
import { ChangePasswordDto, EditUserDto, UpdateRoleDto } from './dto';
import { UserService } from './user.service';

// Guards a nivel de controller: aplican a todas las rutas de abajo.
// JwtGuard carga request.user; RolesGuard revisa @Roles() si existe.
@UseGuards(JwtGuard, RolesGuard)
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  // GET /users/me
  @ApiOperation({ summary: 'Ver mi perfil' })
  @Get('me')
  me(@GetUser() user: AuthUser) {
    return user;
  }

  // PATCH /users/me
  @ApiOperation({ summary: 'Editar mi perfil (email, nombre, apellido)' })
  @Patch('me')
  editMe(@GetUser('id') userId: number, @Body() dto: EditUserDto) {
    return this.userService.editMe(userId, dto);
  }

  // PATCH /users/me/password -> 204 No Content
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cambiar mi contraseña' })
  @Patch('me/password')
  changePassword(
    @GetUser('id') userId: number,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(userId, dto);
  }

  // GET /users — solo ADMIN
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar usuarios (ADMIN)' })
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  // PATCH /users/:id/role — solo ADMIN
  // ParseIntPipe convierte ":id" en number y responde 400 si no es un entero.
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cambiar el rol de otro usuario (ADMIN)' })
  @Patch(':id/role')
  updateRole(
    @GetUser('id') currentUserId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.userService.updateRole(currentUserId, id, dto.role);
  }
}
