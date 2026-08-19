import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogosController } from './catalogos.controller';
import { CatalogosService } from './catalogos.service';
import { RutaPagoEntity } from '../database/entities/ruta-pago.entity';
import { CentroCostoEntity } from '../database/entities/centro-costo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RutaPagoEntity, CentroCostoEntity])],
  controllers: [CatalogosController],
  providers: [CatalogosService],
})
export class CatalogosModule {}
