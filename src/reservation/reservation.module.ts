import { Module } from '@nestjs/common';
import { ResourceModule } from '../resource/resource.module';
import { ReservationController } from './reservation.controller';
import { ReservationService } from './reservation.service';

@Module({
  // Importamos ResourceModule para poder inyectar ResourceService (que exporta).
  imports: [ResourceModule],
  controllers: [ReservationController],
  providers: [ReservationService],
})
export class ReservationModule {}
