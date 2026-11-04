import { validateDto as validate } from '../../../test/utils/validate-dto';
import { CreateResourceDto } from './create-resource.dto';
import { QueryResourceDto } from './query-resource.dto';
import { UpdateResourceDto } from './update-resource.dto';

describe('DTOs de Resource', () => {
  it('CreateResourceDto exige name y type', async () => {
    await expect(validate(CreateResourceDto, {})).rejects.toThrow();
    await expect(
      validate(CreateResourceDto, { name: 'Sala', type: 'SPACE' }),
    ).resolves.toBeInstanceOf(CreateResourceDto);
  });

  it('CreateResourceDto rechaza capacity menor a 1', async () => {
    await expect(
      validate(CreateResourceDto, { name: 'Sala', type: 'SPACE', capacity: 0 }),
    ).rejects.toThrow();
  });

  it('UpdateResourceDto (PartialType) acepta un body parcial pero mantiene las reglas', async () => {
    await expect(
      validate(UpdateResourceDto, { capacity: 5 }),
    ).resolves.toBeInstanceOf(UpdateResourceDto);
    await expect(
      validate(UpdateResourceDto, { type: 'CASTILLO' }),
    ).rejects.toThrow();
  });

  it('QueryResourceDto convierte "true" en boolean', async () => {
    const query = await validate(
      QueryResourceDto,
      { includeInactive: 'true' },
      'query',
    );

    expect(query.includeInactive).toBe(true);
  });
});
