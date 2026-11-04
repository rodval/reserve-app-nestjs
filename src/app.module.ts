import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ReservationModule } from './reservation/reservation.module';
import { ResourceModule } from './resource/resource.module';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    // isGlobal: ConfigService se puede inyectar en cualquier módulo sin importarlo.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    UserModule,
    ResourceModule,
    ReservationModule,
  ],
})
export class AppModule {}
