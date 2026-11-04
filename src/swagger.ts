import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

/**
 * Documentación interactiva en /docs (JSON crudo en /docs-json).
 *
 * Las propiedades de los DTOs las detecta el plugin de @nestjs/swagger
 * configurado en nest-cli.json, leyendo los tipos de TypeScript y los
 * decoradores de class-validator: no hace falta @ApiProperty en cada campo.
 */
export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Reserve App API')
    .setDescription(
      'API para reservar espacios y maquinaria.\n\n' +
        '**Cómo probarla:** hacé login en `POST /auth/signin`, copiá el ' +
        '`access_token`, tocá **Authorize** (arriba a la derecha) y pegalo.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    // Recuerda el token aunque recargues la página.
    swaggerOptions: { persistAuthorization: true },
  });
}
