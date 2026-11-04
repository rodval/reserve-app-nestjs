import { validateDto as validate } from '../../../test/utils/validate-dto';
import { CreateReservationDto } from './create-reservation.dto';
import { AvailabilityQueryDto } from './query-reservation.dto';

const HOUR = 60 * 60 * 1000;
const iso = (hoursFromNow: number) =>
  new Date(Date.now() + hoursFromNow * HOUR).toISOString();

describe('DTOs de Reservation', () => {
  it('convierte los strings ISO en Date', async () => {
    const dto = await validate(CreateReservationDto, {
      resourceId: 1,
      startAt: iso(1),
      endAt: iso(2),
    });

    expect(dto.startAt).toBeInstanceOf(Date);
    expect(dto.endAt).toBeInstanceOf(Date);
  });

  it('rechaza endAt anterior o igual a startAt (@IsAfter)', async () => {
    const start = iso(2);
    await expect(
      validate(CreateReservationDto, {
        resourceId: 1,
        startAt: start,
        endAt: iso(1),
      }),
    ).rejects.toThrow();
    await expect(
      validate(CreateReservationDto, {
        resourceId: 1,
        startAt: start,
        endAt: start,
      }),
    ).rejects.toThrow();
  });

  it('rechaza un startAt en el pasado (@MinDate)', async () => {
    await expect(
      validate(CreateReservationDto, {
        resourceId: 1,
        startAt: iso(-1),
        endAt: iso(1),
      }),
    ).rejects.toThrow();
  });

  it('rechaza fechas que no son fechas', async () => {
    await expect(
      validate(CreateReservationDto, {
        resourceId: 1,
        startAt: 'mañana',
        endAt: iso(1),
      }),
    ).rejects.toThrow();
  });

  it('AvailabilityQueryDto convierte resourceId de string a number', async () => {
    const query = await validate(
      AvailabilityQueryDto,
      { resourceId: '5', from: iso(0), to: iso(24) },
      'query',
    );

    expect(query.resourceId).toBe(5);
  });
});
