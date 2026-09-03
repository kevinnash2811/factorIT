import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndicadoresController } from './indicadores.controller';
import { IndicadoresService } from './indicadores.service';
import { SolicitudGastoEntity } from '../database/entities/solicitud-gasto.entity';
import { CentroCostoEntity } from '../database/entities/centro-costo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitudGastoEntity, CentroCostoEntity])],
  controllers: [IndicadoresController],
  providers: [IndicadoresService],
})
export class IndicadoresModule {}
