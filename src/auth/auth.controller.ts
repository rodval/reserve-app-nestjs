import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SigninDto, SignupDto } from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /auth/signup -> 201 Created
  @ApiOperation({
    summary: 'Registrar un usuario nuevo (devuelve access_token)',
  })
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  // POST /auth/signin -> 200 OK (no crea nada, por eso no es 201)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión (devuelve access_token)' })
  @Post('signin')
  signin(@Body() dto: SigninDto) {
    return this.authService.signin(dto);
  }
}
