import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('error', {
    code,
    clientVersion: 'test',
    meta,
  });
}

function mockHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

  it.each([
    ['P2002', HttpStatus.CONFLICT],
    ['P2003', HttpStatus.BAD_REQUEST],
    ['P2025', HttpStatus.NOT_FOUND],
  ])('traduce %s a %d', (code, expected) => {
    const { host, status, json } = mockHost();

    filter.catch(prismaError(code), host);

    expect(status).toHaveBeenCalledWith(expected);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: expected }),
    );
  });

  it('incluye el campo duplicado en P2002', () => {
    const { host, json } = mockHost();

    filter.catch(prismaError('P2002', { target: ['email'] }), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Ya existe un registro con ese valor en: email',
      }),
    );
  });

  it('P2002 sin campo informado usa un mensaje genérico', () => {
    const { host, json } = mockHost();

    filter.catch(prismaError('P2002'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'El registro ya existe' }),
    );
  });

  it('un código desconocido se delega a Nest (500)', () => {
    const { host, status } = mockHost();
    const parent = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);
    const error = prismaError('P9999');

    filter.catch(error, host);

    expect(parent).toHaveBeenCalledWith(error, host);
    expect(status).not.toHaveBeenCalled();
    parent.mockRestore();
  });
});
