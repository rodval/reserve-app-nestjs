import { validateEnv } from './env.validation';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'un-secreto-de-al-menos-16',
};

describe('validateEnv', () => {
  it('acepta una configuración válida', () => {
    expect(() => validateEnv(valid)).not.toThrow();
  });

  it('convierte PORT de string a number', () => {
    expect(validateEnv({ ...valid, PORT: '4000' }).PORT).toBe(4000);
  });

  it.each([
    ['falta DATABASE_URL', { DATABASE_URL: undefined }, 'DATABASE_URL'],
    ['JWT_SECRET corto', { JWT_SECRET: 'corto' }, 'JWT_SECRET'],
    ['PORT no numérico', { PORT: 'abc' }, 'PORT'],
    ['PORT fuera de rango', { PORT: '70000' }, 'PORT'],
    [
      'JWT_EXPIRES_IN mal formado',
      { JWT_EXPIRES_IN: '1 hora' },
      'JWT_EXPIRES_IN',
    ],
  ])('rechaza: %s', (_case, override, variable) => {
    expect(() => validateEnv({ ...valid, ...override })).toThrow(variable);
  });

  it('acepta JWT_EXPIRES_IN con formato 15m, 1h, 7d', () => {
    for (const value of ['15m', '1h', '7d', '30s']) {
      expect(() =>
        validateEnv({ ...valid, JWT_EXPIRES_IN: value }),
      ).not.toThrow();
    }
  });
});
