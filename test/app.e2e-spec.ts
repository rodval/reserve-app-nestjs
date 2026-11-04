import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Prisma } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { setupApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { ReservationService } from './../src/reservation/reservation.service';

type ResourceBody = {
  id: number;
  name: string;
  type: string;
  isActive: boolean;
  attributes: Record<string, unknown> | null;
};
type ReservationBody = {
  id: number;
  status: string;
  userId: number;
  cancelledAt: string | null;
};
type AvailabilityBody = { busy: { startAt: string; endAt: string }[] };
type TokenBody = { access_token: string };
type UserBody = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  hash?: string;
};

// Requiere la base de tests levantada (npm run db:test:restart lo hace
// automáticamente antes de `npm run test:e2e`).
describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  const credentials = { email: 'ana@mail.com', password: 'super-secreta' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    // Base limpia en cada corrida.
    const prisma = app.get(PrismaService);
    await prisma.reservation.deleteMany();
    await prisma.resource.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('Auth', () => {
    describe('POST /auth/signup', () => {
      it('400 si el email es inválido', () =>
        http()
          .post('/auth/signup')
          .send({ ...credentials, email: 'no-es-email' })
          .expect(400));

      it('400 si la contraseña es corta', () =>
        http()
          .post('/auth/signup')
          .send({ ...credentials, password: '123' })
          .expect(400));

      it('400 si mandan campos que no están en el DTO', () =>
        http()
          .post('/auth/signup')
          .send({ ...credentials, role: 'ADMIN' })
          .expect(400));

      it('201 y devuelve access_token', () =>
        http()
          .post('/auth/signup')
          .send({ ...credentials, firstName: 'Ana' })
          .expect(201)
          .expect((res) => {
            expect((res.body as TokenBody).access_token).toEqual(
              expect.any(String),
            );
          }));

      it('409 si el email ya existe (aunque cambien mayúsculas)', () =>
        http()
          .post('/auth/signup')
          .send({ ...credentials, email: 'ANA@mail.com' })
          .expect(409));
    });

    describe('POST /auth/signin', () => {
      it('401 con contraseña incorrecta', () =>
        http()
          .post('/auth/signin')
          .send({ ...credentials, password: 'incorrecta' })
          .expect(401));

      it('200 y devuelve access_token', () =>
        http()
          .post('/auth/signin')
          .send(credentials)
          .expect(200)
          .expect((res) => {
            token = (res.body as TokenBody).access_token;
            expect(token).toEqual(expect.any(String));
          }));
    });
  });

  describe('Users', () => {
    const auth = () => ({ Authorization: `Bearer ${token}` });
    let otherUserId: number;

    beforeAll(async () => {
      // Segundo usuario para probar cambios de rol.
      const other = await app.get(PrismaService).user.create({
        data: { email: 'otro@mail.com', hash: 'x' },
      });
      otherUserId = other.id;
    });

    it('GET /users/me 401 sin token', () =>
      http().get('/users/me').expect(401));

    it('GET /users/me devuelve el usuario sin hash', () =>
      http()
        .get('/users/me')
        .set(auth())
        .expect(200)
        .expect((res) => {
          const user = res.body as UserBody;
          expect(user.email).toBe(credentials.email);
          expect(user.firstName).toBe('Ana');
          expect(user.role).toBe('USER');
          expect(user.hash).toBeUndefined();
        }));

    it('PATCH /users/me edita el perfil', () =>
      http()
        .patch('/users/me')
        .set(auth())
        .send({ lastName: 'García' })
        .expect(200)
        .expect((res) => {
          expect((res.body as UserBody).lastName).toBe('García');
        }));

    it('PATCH /users/me 409 si el email ya está en uso', () =>
      http()
        .patch('/users/me')
        .set(auth())
        .send({ email: 'otro@mail.com' })
        .expect(409));

    it('PATCH /users/me/password 401 si la actual es incorrecta', () =>
      http()
        .patch('/users/me/password')
        .set(auth())
        .send({ currentPassword: 'mal', newPassword: 'clave-nueva-123' })
        .expect(401));

    it('PATCH /users/me/password 204 y permite loguear con la nueva', async () => {
      await http()
        .patch('/users/me/password')
        .set(auth())
        .send({
          currentPassword: credentials.password,
          newPassword: 'clave-nueva-123',
        })
        .expect(204);

      await http()
        .post('/auth/signin')
        .send({ ...credentials, password: 'clave-nueva-123' })
        .expect(200);
    });

    it('GET /users 403 para un USER', () =>
      http().get('/users').set(auth()).expect(403));

    describe('como ADMIN', () => {
      beforeAll(async () => {
        // El rol se lee de la base en cada request, así que el mismo token sirve.
        await app.get(PrismaService).user.update({
          where: { email: credentials.email },
          data: { role: 'ADMIN' },
        });
      });

      it('GET /users lista usuarios sin hash', () =>
        http()
          .get('/users')
          .set(auth())
          .expect(200)
          .expect((res) => {
            const users = res.body as UserBody[];
            expect(users.length).toBe(2);
            expect(users[0].hash).toBeUndefined();
          }));

      it('PATCH /users/:id/role cambia el rol de otro usuario', () =>
        http()
          .patch(`/users/${otherUserId}/role`)
          .set(auth())
          .send({ role: 'ADMIN' })
          .expect(200)
          .expect((res) => {
            expect((res.body as UserBody).role).toBe('ADMIN');
          }));

      it('PATCH /users/:id/role 400 con un rol inválido', () =>
        http()
          .patch(`/users/${otherUserId}/role`)
          .set(auth())
          .send({ role: 'SUPERADMIN' })
          .expect(400));

      it('PATCH /users/:id/role 400 si el id no es numérico', () =>
        http()
          .patch('/users/abc/role')
          .set(auth())
          .send({ role: 'USER' })
          .expect(400));

      it('PATCH /users/:id/role 404 si el usuario no existe', () =>
        http()
          .patch('/users/999999/role')
          .set(auth())
          .send({ role: 'USER' })
          .expect(404));
    });
  });

  // Corre después de 'Users': para entonces Ana ya es ADMIN.
  describe('Resources', () => {
    const auth = () => ({ Authorization: `Bearer ${token}` });
    let userToken: string;
    let resourceId: number;

    beforeAll(async () => {
      const res = await http()
        .post('/auth/signup')
        .send({ email: 'user@mail.com', password: 'clave-de-user' });
      userToken = (res.body as TokenBody).access_token;
    });

    const asUser = () => ({ Authorization: `Bearer ${userToken}` });

    it('POST /resources 403 para un USER', () =>
      http()
        .post('/resources')
        .set(asUser())
        .send({ name: 'Sala A', type: 'SPACE' })
        .expect(403));

    it('POST /resources 400 con tipo inválido', () =>
      http()
        .post('/resources')
        .set(auth())
        .send({ name: 'Sala A', type: 'CASTILLO' })
        .expect(400));

    it('POST /resources crea un espacio', () =>
      http()
        .post('/resources')
        .set(auth())
        .send({
          name: 'Sala de reuniones A',
          type: 'SPACE',
          location: 'Piso 2',
          capacity: 8,
          attributes: { m2: 40, proyector: true },
        })
        .expect(201)
        .expect((res) => {
          const body = res.body as ResourceBody;
          resourceId = body.id;
          expect(body.isActive).toBe(true);
          expect(body.attributes).toEqual({ m2: 40, proyector: true });
        }));

    it('POST /resources crea un equipo', () =>
      http()
        .post('/resources')
        .set(auth())
        .send({
          name: 'Taladro percutor',
          type: 'EQUIPMENT',
          attributes: { serialNumber: 'TP-001' },
        })
        .expect(201));

    it('GET /resources filtra por tipo', () =>
      http()
        .get('/resources?type=EQUIPMENT')
        .set(asUser())
        .expect(200)
        .expect((res) => {
          const list = res.body as ResourceBody[];
          expect(list).toHaveLength(1);
          expect(list[0].name).toBe('Taladro percutor');
        }));

    it('GET /resources busca por texto', () =>
      http()
        .get('/resources?search=piso 2')
        .set(asUser())
        .expect(200)
        .expect((res) => {
          expect((res.body as ResourceBody[])[0].id).toBe(resourceId);
        }));

    it('PATCH /resources/:id edita parcialmente', () =>
      http()
        .patch(`/resources/${resourceId}`)
        .set(auth())
        .send({ capacity: 10 })
        .expect(200)
        .expect((res) => {
          expect((res.body as ResourceBody).name).toBe('Sala de reuniones A');
        }));

    it('DELETE /resources/:id hace baja lógica', () =>
      http().delete(`/resources/${resourceId}`).set(auth()).expect(204));

    it('un USER ya no ve el recurso dado de baja', async () => {
      await http().get(`/resources/${resourceId}`).set(asUser()).expect(404);

      const res = await http()
        .get('/resources?includeInactive=true')
        .set(asUser())
        .expect(200);
      expect(res.body as ResourceBody[]).toHaveLength(1);
    });

    it('un ADMIN lo ve con includeInactive y puede reactivarlo', async () => {
      const res = await http()
        .get('/resources?includeInactive=true')
        .set(auth())
        .expect(200);
      expect(res.body as ResourceBody[]).toHaveLength(2);

      await http()
        .patch(`/resources/${resourceId}`)
        .set(auth())
        .send({ isActive: true })
        .expect(200);
    });

    it('GET /resources/:id 404 si no existe', () =>
      http().get('/resources/999999').set(auth()).expect(404));
  });

  // Corre al final: Ana es ADMIN, y hay un USER (user@mail.com).
  describe('Reservations', () => {
    const asAdmin = () => ({ Authorization: `Bearer ${token}` });
    let userToken: string;
    let otherToken: string;
    let resourceId: number;
    let reservationId: number;

    const HOUR = 60 * 60 * 1000;
    // Base fija mañana a las 10:00 UTC para que los horarios sean legibles.
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + 1);
    base.setUTCHours(10, 0, 0, 0);
    const at = (h: number) => new Date(base.getTime() + h * HOUR).toISOString();

    beforeAll(async () => {
      const signin = await http()
        .post('/auth/signin')
        .send({ email: 'user@mail.com', password: 'clave-de-user' });
      userToken = (signin.body as TokenBody).access_token;

      const signup = await http()
        .post('/auth/signup')
        .send({ email: 'tercero@mail.com', password: 'clave-de-tercero' });
      otherToken = (signup.body as TokenBody).access_token;

      const resource = await app.get(PrismaService).resource.create({
        data: { name: 'Cancha 1', type: 'SPACE' },
      });
      resourceId = resource.id;
    });

    const asUser = () => ({ Authorization: `Bearer ${userToken}` });
    const asOther = () => ({ Authorization: `Bearer ${otherToken}` });

    it('400 si endAt no es posterior a startAt', () =>
      http()
        .post('/reservations')
        .set(asUser())
        .send({ resourceId, startAt: at(2), endAt: at(1) })
        .expect(400));

    it('400 si startAt está en el pasado', () =>
      http()
        .post('/reservations')
        .set(asUser())
        .send({
          resourceId,
          startAt: new Date(Date.now() - HOUR).toISOString(),
          endAt: at(1),
        })
        .expect(400));

    it('404 si el recurso no existe', () =>
      http()
        .post('/reservations')
        .set(asUser())
        .send({ resourceId: 999999, startAt: at(0), endAt: at(1) })
        .expect(404));

    it('201 crea una reserva PENDING de 10 a 12', () =>
      http()
        .post('/reservations')
        .set(asUser())
        .send({ resourceId, startAt: at(0), endAt: at(2), notes: 'Partido' })
        .expect(201)
        .expect((res) => {
          const body = res.body as ReservationBody;
          reservationId = body.id;
          expect(body.status).toBe('PENDING');
        }));

    it('409 si se solapa (11 a 13)', () =>
      http()
        .post('/reservations')
        .set(asOther())
        .send({ resourceId, startAt: at(1), endAt: at(3) })
        .expect(409));

    it('201 si empieza justo cuando termina la otra (12 a 13)', () =>
      http()
        .post('/reservations')
        .set(asOther())
        .send({ resourceId, startAt: at(2), endAt: at(3) })
        .expect(201));

    it('solo una de 10 reservas simultáneas al mismo horario gana', async () => {
      // Con Postgres local cada transacción dura ~1 ms, así que 10 pedidos
      // "simultáneos" casi nunca se pisan y el test pasaría incluso sin lock.
      // Para forzar la carrera, interceptamos $transaction y agregamos una
      // barrera justo antes del chequeo de solapamiento: cada transacción
      // espera ahí (máx. 150 ms) a que lleguen las demás.
      //  - Sin lock: las 10 llegan a la barrera, ninguna ve reservas -> 10 creadas.
      //  - Con lock: las otras 9 quedan bloqueadas en Postgres ANTES de la
      //    barrera; la primera espera 150 ms, commitea, y recién ahí sigue otra.
      // Comprobado: comentando el pg_advisory_xact_lock este test falla.
      const ATTEMPTS = 10;
      const prisma = app.get(PrismaService);
      const service = app.get(ReservationService);

      let arrived = 0;
      const barrier = async () => {
        arrived++;
        const deadline = Date.now() + 150;
        while (arrived < ATTEMPTS && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      };

      // Proxy que deja todo igual salvo tx.reservation.findFirst.
      const withBarrier = (tx: Prisma.TransactionClient) =>
        new Proxy(tx, {
          get(target, prop) {
            if (prop === 'reservation') {
              const delegate = target.reservation;
              return new Proxy(delegate, {
                get(d, key) {
                  if (key === 'findFirst') {
                    return async (...args: Parameters<typeof d.findFirst>) => {
                      await barrier();
                      return d.findFirst(...args);
                    };
                  }
                  return Reflect.get(d, key, d) as unknown;
                },
              });
            }
            const value = Reflect.get(target, prop, target) as unknown;
            return typeof value === 'function'
              ? ((value as (...a: unknown[]) => unknown).bind(
                  target,
                ) as unknown)
              : value;
          },
        });

      const realTransaction = prisma.$transaction.bind(prisma) as (
        fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
      ) => Promise<unknown>;
      const spy = jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(((
          fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
        ) =>
          realTransaction((tx) =>
            fn(withBarrier(tx)),
          )) as unknown as typeof prisma.$transaction);

      try {
        const other = await prisma.user.findUniqueOrThrow({
          where: { email: 'tercero@mail.com' },
          omit: { hash: true },
        });
        const dto = {
          resourceId,
          startAt: new Date(at(5)),
          endAt: new Date(at(6)),
        };

        const results = await Promise.allSettled(
          Array.from({ length: ATTEMPTS }, () => service.create(other, dto)),
        );

        const rejected = results.filter(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        );
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(rejected).toHaveLength(ATTEMPTS - 1);
        rejected.forEach((r) =>
          expect(r.reason).toBeInstanceOf(ConflictException),
        );
      } finally {
        spy.mockRestore();
      }
    }, 10_000);

    it('GET /reservations/availability muestra los horarios ocupados', () =>
      http()
        .get('/reservations/availability')
        .query({ resourceId, from: at(0), to: at(4) })
        .set(asOther())
        .expect(200)
        .expect((res) => {
          const { busy } = res.body as AvailabilityBody;
          expect(busy).toHaveLength(2);
          expect(busy[0]).toEqual(
            expect.objectContaining({ startAt: at(0), endAt: at(2) }),
          );
          expect(busy[0]).not.toHaveProperty('userId');
        }));

    it('GET /reservations/me devuelve solo las propias', () =>
      http()
        .get('/reservations/me')
        .set(asUser())
        .expect(200)
        .expect((res) => {
          const list = res.body as ReservationBody[];
          expect(list).toHaveLength(1);
          expect(list[0].id).toBe(reservationId);
        }));

    it('GET /reservations/:id 404 para otro usuario', () =>
      http().get(`/reservations/${reservationId}`).set(asOther()).expect(404));

    it('GET /reservations 403 para USER y 200 para ADMIN', async () => {
      await http().get('/reservations').set(asUser()).expect(403);

      const res = await http()
        .get('/reservations')
        .query({ resourceId })
        .set(asAdmin())
        .expect(200);
      expect(res.body as ReservationBody[]).toHaveLength(3);
    });

    it('PATCH /reservations/:id/confirm 403 para USER', () =>
      http()
        .patch(`/reservations/${reservationId}/confirm`)
        .set(asUser())
        .expect(403));

    it('PATCH /reservations/:id/confirm la confirma (ADMIN)', () =>
      http()
        .patch(`/reservations/${reservationId}/confirm`)
        .set(asAdmin())
        .expect(200)
        .expect((res) => {
          expect((res.body as ReservationBody).status).toBe('CONFIRMED');
        }));

    it('409 al confirmar dos veces', () =>
      http()
        .patch(`/reservations/${reservationId}/confirm`)
        .set(asAdmin())
        .expect(409));

    it('otro usuario no puede cancelarla', () =>
      http()
        .patch(`/reservations/${reservationId}/cancel`)
        .set(asOther())
        .expect(404));

    it('el dueño la cancela y el horario se libera', async () => {
      const res = await http()
        .patch(`/reservations/${reservationId}/cancel`)
        .set(asUser())
        .expect(200);
      const body = res.body as ReservationBody;
      expect(body.status).toBe('CANCELLED');
      expect(body.cancelledAt).not.toBeNull();

      await http()
        .post('/reservations')
        .set(asOther())
        .send({ resourceId, startAt: at(0), endAt: at(2) })
        .expect(201);
    });

    it('409 al cancelar dos veces', () =>
      http()
        .patch(`/reservations/${reservationId}/cancel`)
        .set(asUser())
        .expect(409));
  });

  // Casos borde. Corre al final para no alterar los conteos de arriba.
  describe('Casos borde', () => {
    const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
    const signin = async (email: string, password: string) =>
      (
        (await http().post('/auth/signin').send({ email, password }))
          .body as TokenBody
      ).access_token;

    let adminToken: string;
    let userToken: string;
    let otherToken: string;
    let canchaId: number;

    beforeAll(async () => {
      adminToken = await signin(credentials.email, 'clave-nueva-123');
      userToken = await signin('user@mail.com', 'clave-de-user');
      otherToken = await signin('tercero@mail.com', 'clave-de-tercero');
      canchaId = (
        await app
          .get(PrismaService)
          .resource.findFirstOrThrow({ where: { name: 'Cancha 1' } })
      ).id;
    });

    describe('Tokens', () => {
      it('401 con un token mal firmado', () =>
        http()
          .get('/users/me')
          .set(bearer(`${userToken.slice(0, -4)}abcd`))
          .expect(401));

      it('401 si el header no es Bearer', () =>
        http()
          .get('/users/me')
          .set('Authorization', `Basic ${userToken}`)
          .expect(401));

      it('401 si el usuario del token fue borrado', async () => {
        const res = await http()
          .post('/auth/signup')
          .send({ email: 'borrado@mail.com', password: 'clave-temporal' });
        const orphanToken = (res.body as TokenBody).access_token;
        await app
          .get(PrismaService)
          .user.delete({ where: { email: 'borrado@mail.com' } });

        await http().get('/users/me').set(bearer(orphanToken)).expect(401);
      });
    });

    describe('Recursos', () => {
      it('400 si :id no es numérico', () =>
        http().get('/resources/abc').set(bearer(userToken)).expect(400));

      it('PATCH con attributes: null borra los atributos', async () => {
        const created = await http()
          .post('/resources')
          .set(bearer(adminToken))
          .send({
            name: 'Proyector',
            type: 'EQUIPMENT',
            attributes: { lm: 3000 },
          })
          .expect(201);
        const id = (created.body as ResourceBody).id;

        const res = await http()
          .patch(`/resources/${id}`)
          .set(bearer(adminToken))
          .send({ attributes: null })
          .expect(200);
        expect((res.body as ResourceBody).attributes).toBeNull();
      });
    });

    describe('Reservas sobre recursos inactivos', () => {
      let inactiveId: number;

      beforeAll(async () => {
        inactiveId = (
          await app.get(PrismaService).resource.create({
            data: { name: 'Sala en obra', type: 'SPACE', isActive: false },
          })
        ).id;
      });

      it('404 al reservar un recurso dado de baja', () =>
        http()
          .post('/reservations')
          .set(bearer(userToken))
          .send({
            resourceId: inactiveId,
            startAt: new Date(Date.now() + 3_600_000).toISOString(),
            endAt: new Date(Date.now() + 7_200_000).toISOString(),
          })
          .expect(404));

      it('404 al consultar su disponibilidad como USER', () =>
        http()
          .get('/reservations/availability')
          .query({
            resourceId: inactiveId,
            from: new Date().toISOString(),
            to: new Date(Date.now() + 86_400_000).toISOString(),
          })
          .set(bearer(userToken))
          .expect(404));
    });

    describe('Filtros y validaciones de consulta', () => {
      it('400 si availability no recibe from/to', () =>
        http()
          .get('/reservations/availability')
          .query({ resourceId: canchaId })
          .set(bearer(userToken))
          .expect(400));

      it('400 si to es anterior a from', () =>
        http()
          .get('/reservations/me')
          .query({
            from: new Date(Date.now() + 86_400_000).toISOString(),
            to: new Date().toISOString(),
          })
          .set(bearer(userToken))
          .expect(400));

      it('GET /reservations/me?status=CANCELLED devuelve solo canceladas', async () => {
        const res = await http()
          .get('/reservations/me')
          .query({ status: 'CANCELLED' })
          .set(bearer(userToken))
          .expect(200);
        const list = res.body as ReservationBody[];
        expect(list.length).toBeGreaterThan(0);
        expect(list.every((r) => r.status === 'CANCELLED')).toBe(true);
      });

      it('GET /reservations?userId= filtra por usuario (ADMIN)', async () => {
        const other = await app
          .get(PrismaService)
          .user.findUniqueOrThrow({ where: { email: 'tercero@mail.com' } });

        const res = await http()
          .get('/reservations')
          .query({ userId: other.id })
          .set(bearer(adminToken))
          .expect(200);
        const list = res.body as ReservationBody[];
        expect(list.length).toBeGreaterThan(0);
        expect(list.every((r) => r.userId === other.id)).toBe(true);
      });
    });

    describe('ADMIN sobre reservas ajenas', () => {
      let reservationId: number;

      beforeAll(async () => {
        const start = new Date();
        start.setUTCDate(start.getUTCDate() + 2);
        start.setUTCHours(18, 0, 0, 0);
        const res = await http()
          .post('/reservations')
          .set(bearer(otherToken))
          .send({
            resourceId: canchaId,
            startAt: start.toISOString(),
            endAt: new Date(start.getTime() + 3_600_000).toISOString(),
          })
          .expect(201);
        reservationId = (res.body as ReservationBody).id;
      });

      it('un ADMIN puede ver una reserva ajena', () =>
        http()
          .get(`/reservations/${reservationId}`)
          .set(bearer(adminToken))
          .expect(200));

      it('un ADMIN puede cancelar una reserva ajena', () =>
        http()
          .patch(`/reservations/${reservationId}/cancel`)
          .set(bearer(adminToken))
          .expect(200)
          .expect((res) => {
            expect((res.body as ReservationBody).status).toBe('CANCELLED');
          }));

      it('409 al confirmar una reserva cancelada', () =>
        http()
          .patch(`/reservations/${reservationId}/confirm`)
          .set(bearer(adminToken))
          .expect(409));
    });
  });
});
