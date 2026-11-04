import {
  validateDto,
  validationErrors,
} from '../../../test/utils/validate-dto';
import { ChangePasswordDto } from './change-password.dto';
import { EditUserDto } from './edit-user.dto';
import { UpdateRoleDto } from './update-role.dto';

describe('DTOs de User', () => {
  it('EditUserDto acepta un body vacío (todo es opcional)', async () => {
    await expect(validateDto(EditUserDto, {})).resolves.toBeInstanceOf(
      EditUserDto,
    );
  });

  it('EditUserDto normaliza el email', async () => {
    const dto = await validateDto(EditUserDto, { email: ' Ana@Mail.com' });
    expect(dto.email).toBe('ana@mail.com');
  });

  it('EditUserDto no permite cambiar el rol ni el hash', async () => {
    const errors = await validationErrors(EditUserDto, {
      role: 'ADMIN',
      hash: 'x',
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'property role should not exist',
        'property hash should not exist',
      ]),
    );
  });

  it('ChangePasswordDto exige una nueva contraseña de 8+ caracteres', async () => {
    await expect(
      validationErrors(ChangePasswordDto, {
        currentPassword: 'actual',
        newPassword: 'corta',
      }),
    ).resolves.toContain('La contraseña debe tener al menos 8 caracteres');
  });

  it('UpdateRoleDto solo acepta USER o ADMIN', async () => {
    await expect(
      validateDto(UpdateRoleDto, { role: 'ADMIN' }),
    ).resolves.toBeInstanceOf(UpdateRoleDto);
    await expect(
      validationErrors(UpdateRoleDto, { role: 'SUPERADMIN' }),
    ).resolves.toContain('El rol debe ser uno de: USER, ADMIN');
  });
});
