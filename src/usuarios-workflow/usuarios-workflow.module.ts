import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosWorkflowController } from './usuarios-workflow.controller';
import { UsuariosWorkflowService } from './usuarios-workflow.service';
import { UsuarioWorkflowEntity } from '../database/entities/usuario-workflow.entity';
import { PerfilPermisoEntity } from '../database/entities/perfil-permiso.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioWorkflowEntity, PerfilPermisoEntity])],
  controllers: [UsuariosWorkflowController],
  providers: [UsuariosWorkflowService],
})
export class UsuariosWorkflowModule {}
