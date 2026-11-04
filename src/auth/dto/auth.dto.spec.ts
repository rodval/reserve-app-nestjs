import {
  validateDto,
  validationErrors,
} from '../../../test/utils/validate-dto';
import { SigninDto } from './signin.dto';
import { SignupDto } from './signup.dto';

describe('DTOs de Auth', () => {
  describe('SignupDto', () => {
    const valid = { email: 'ana@mail.com', password: 'super-secreta' };

    it('normaliza el email (trim + minúsculas)', async () => {
      const dto = await validateDto(SignupDto, {
        ...valid,
        email: '  Ana@Mail.COM ',
      });
      expect(dto.email).toBe('ana@mail.com');
    });

    it('acepta nombre y apellido opcionales', async () => {
      await expect(
        validateDto(SignupDto, { ...valid, firstName: 'Ana', lastName: 'G' }),
      ).resolves.toBeInstanceOf(SignupDto);
    });

    it.each([
      ['email inválido', { email: 'no-es-email' }, 'El email no es válido'],
      [
        'contraseña corta',
        { password: '1234567' },
        'La contraseña debe tener al menos 8 caracteres',
      ],
      [
        'contraseña demasiado larga',
        { password: 'x'.repeat(129) },
        'password must be shorter than or equal to 128 characters',
      ],
      ['firstName vacío', { firstName: '' }, 'firstName should not be empty'],
      ['campo extra', { role: 'ADMIN' }, 'property role should not exist'],
    ])('rechaza %s', async (_case, override, message) => {
      await expect(
        validationErrors(SignupDto, { ...valid, ...override }),
      ).resolves.toContain(message);
    });
  });

  describe('SigninDto', () => {
    it('normaliza el email', async () => {
      const dto = await validateDto(SigninDto, {
        email: 'ANA@mail.com',
        password: 'x',
      });
      expect(dto.email).toBe('ana@mail.com');
    });

    it('exige contraseña no vacía', async () => {
      await expect(
        validationErrors(SigninDto, { email: 'ana@mail.com', password: '' }),
      ).resolves.toContain('password should not be empty');
    });
  });
});
