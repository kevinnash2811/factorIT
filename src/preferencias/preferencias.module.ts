import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreferenciasController } from './preferencias.controller';
import { PreferenciasService } from './preferencias.service';
import { PreferenciaUsuarioEntity } from '../database/entities/preferencia-usuario.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PreferenciaUsuarioEntity])],
  controllers: [PreferenciasController],
  providers: [PreferenciasService],
})
export class PreferenciasModule {}
