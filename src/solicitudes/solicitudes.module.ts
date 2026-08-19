import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudGastoEntity } from '../database/entities/solicitud-gasto.entity';
import { RutaPagoEntity } from '../database/entities/ruta-pago.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitudGastoEntity, RutaPagoEntity])],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
})
export class SolicitudesModule {}
