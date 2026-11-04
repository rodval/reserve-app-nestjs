import { Module } from '@nestjs/common';
import { ResourceController } from './resource.controller';
import { ResourceService } from './resource.service';

@Module({
  controllers: [ResourceController],
  providers: [ResourceService],
  // Exportado: ReservationModule lo usa para validar recursos.
  exports: [ResourceService],
})
export class ResourceModule {}
