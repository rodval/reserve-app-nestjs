# reserve-app

API de reservas construida con [NestJS](https://nestjs.com/) y [Prisma](https://www.prisma.io/) sobre PostgreSQL.

Permite reservar **recursos genéricos**: espacios (salas, canchas, oficinas) o maquinaria/equipos, validando que no haya reservas superpuestas para el mismo recurso.

## Requisitos

- Node.js 20+
- Docker (para la base de datos)

## Puesta en marcha

```bash
npm install
cp .env.example .env
npm run db:dev:restart   # levanta Postgres en Docker y aplica migraciones
npm run db:seed          # crea el usuario ADMIN inicial
npm run start:dev
```

La API queda en `http://localhost:3000` y la documentación interactiva (Swagger) en **`http://localhost:3000/docs`**.

Para probar rutas protegidas en Swagger: ejecutá `POST /auth/signin`, copiá el `access_token`, tocá **Authorize** y pegalo.

## Scripts útiles

| Script | Qué hace |
| --- | --- |
| `npm run start:dev` | Arranca la API en modo watch |
| `npm run db:dev:restart` | Recrea la base de desarrollo (puerto 5434) y aplica migraciones |
| `npm run db:test:restart` | Recrea la base de tests (puerto 5435) y aplica migraciones |
| `npm run db:seed` | Crea o promueve el usuario ADMIN inicial |
| `npm run prisma:generate` | Regenera el cliente de Prisma |
| `npm run test` | Tests unitarios |
| `npm run test:e2e` | Tests end-to-end (usan `.env.test`) |

## Arquitectura

Cada funcionalidad vive en su carpeta dentro de `src/` con su `module`, `controller` y `service`:

```
src/
├── app.setup.ts  # ValidationPipe y filtros globales (compartido con e2e)
├── auth/         # Signup/signin con JWT: dto, strategy, guard, decorator
├── common/       # Piezas transversales (filtros, decoradores, guards)
├── config/       # Validación de variables de entorno
├── prisma/       # PrismaService global (acceso a la base)
├── reservation/  # Reservas: solapamiento, disponibilidad, confirmar y cancelar
├── resource/     # Recursos reservables (espacios y maquinaria)
└── user/         # Usuarios
```

## Endpoints

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| POST | `/auth/signup` | — | Registra un usuario y devuelve `access_token` |
| POST | `/auth/signin` | — | Login, devuelve `access_token` |
| GET | `/users/me` | Bearer | Usuario autenticado |
| PATCH | `/users/me` | Bearer | Edita email, nombre o apellido |
| PATCH | `/users/me/password` | Bearer | Cambia la contraseña (pide la actual) |
| GET | `/users` | ADMIN | Lista de usuarios (sin hash) |
| PATCH | `/users/:id/role` | ADMIN | Cambia el rol de otro usuario |
| GET | `/resources` | Bearer | Lista recursos activos. Filtros: `type`, `search`, `includeInactive` (solo ADMIN) |
| GET | `/resources/:id` | Bearer | Detalle de un recurso |
| POST | `/resources` | ADMIN | Crea un recurso (`SPACE` o `EQUIPMENT`) |
| PATCH | `/resources/:id` | ADMIN | Edita un recurso; `isActive: true` lo reactiva |
| DELETE | `/resources/:id` | ADMIN | Baja lógica (`isActive: false`) |
| POST | `/reservations` | Bearer | Reserva un recurso (`resourceId`, `startAt`, `endAt`, `notes?`). Queda `PENDING` |
| GET | `/reservations/me` | Bearer | Mis reservas. Filtros: `status`, `from`, `to` |
| GET | `/reservations/availability` | Bearer | Horarios ocupados de un recurso (`resourceId`, `from`, `to`) |
| GET | `/reservations` | ADMIN | Todas. Filtros: `resourceId`, `userId`, `status`, `from`, `to` |
| GET | `/reservations/:id` | Bearer | Detalle (dueño o ADMIN) |
| PATCH | `/reservations/:id/confirm` | ADMIN | `PENDING` → `CONFIRMED` |
| PATCH | `/reservations/:id/cancel` | Bearer | Cancela (dueño antes de que empiece, o ADMIN) |

### Reglas de reserva

- Las fechas van en ISO 8601 (`2026-11-10T14:00:00Z`). Los intervalos son `[startAt, endAt)`: una reserva de 10 a 12 no choca con otra de 12 a 14.
- Cada recurso se reserva de forma exclusiva. `PENDING` y `CONFIRMED` ocupan el horario; `CANCELLED` lo libera.
- El chequeo de solapamiento corre en una transacción con un advisory lock de Postgres por recurso, así dos pedidos simultáneos no pueden reservar el mismo horario.

Los roles son `USER` (por defecto) y `ADMIN`. El primer admin se crea con `npm run db:seed` usando `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` del `.env`.

`PrismaModule` es `@Global()`, así que cualquier service puede inyectar `PrismaService` sin importar el módulo.
