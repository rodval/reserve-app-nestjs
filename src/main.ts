import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { setupSwagger, SWAGGER_PATH } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  setupSwagger(app);

  const config = app.get(ConfigService);
  await app.listen(config.get<number>('PORT') ?? 3000);

  // getUrl() devuelve la dirección real en la que quedó escuchando.
  // Reemplazamos [::1] (localhost en IPv6) por "localhost" para que sea clickeable.
  const url = (await app.getUrl()).replace('[::1]', 'localhost');
  const logger = new Logger('Bootstrap');
  logger.log(`API escuchando en ${url}`);
  logger.log(`Documentación en ${url}/${SWAGGER_PATH}`);
}
void bootstrap();
