import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { IndicadoresModule } from './indicadores/indicadores.module';
import { DocumentosModule } from './documentos/documentos.module';
import { RutasModule } from './rutas/rutas.module';
import { CuentasTractaModule } from './cuentas-tracta/cuentas-tracta.module';
import { PreferenciasModule } from './preferencias/preferencias.module';
import { UsuariosWorkflowModule } from './usuarios-workflow/usuarios-workflow.module';
import { PerfilesPermisoModule } from './perfiles-permiso/perfiles-permiso.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SolicitudesModule,
    CatalogosModule,
    IndicadoresModule,
    DocumentosModule,
    RutasModule,
    CuentasTractaModule,
    PreferenciasModule,
    UsuariosWorkflowModule,
    PerfilesPermisoModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
