import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerfilesPermisoController } from './perfiles-permiso.controller';
import { PerfilesPermisoService } from './perfiles-permiso.service';
import { PerfilPermisoEntity } from '../database/entities/perfil-permiso.entity';
import { UsuarioWorkflowEntity } from '../database/entities/usuario-workflow.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PerfilPermisoEntity, UsuarioWorkflowEntity])],
  controllers: [PerfilesPermisoController],
  providers: [PerfilesPermisoService],
})
export class PerfilesPermisoModule {}
