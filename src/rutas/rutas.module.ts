import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RutaPagoEntity } from '../database/entities/ruta-pago.entity';
import { RutasController } from './rutas.controller';
import { RutasService } from './rutas.service';

@Module({
  imports: [TypeOrmModule.forFeature([RutaPagoEntity])],
  controllers: [RutasController],
  providers: [RutasService],
})
export class RutasModule {}
