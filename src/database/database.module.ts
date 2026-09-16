import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RutaPagoEntity } from './entities/ruta-pago.entity';
import { CentroCostoEntity } from './entities/centro-costo.entity';
import { SolicitudGastoEntity } from './entities/solicitud-gasto.entity';
import { BitacoraAuditoriaEntity } from './entities/bitacora-auditoria.entity';
import { LineaAjusteContableEntity } from './entities/linea-ajuste-contable.entity';
import { PreferenciaUsuarioEntity } from './entities/preferencia-usuario.entity';
import { UsuarioWorkflowEntity } from './entities/usuario-workflow.entity';
import { PerfilPermisoEntity } from './entities/perfil-permiso.entity';

// Cuentas Contables (ERP_TRACTA) no está acá: vive en Oracle y se accede por
// OracleService, no por TypeORM.
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        database: config.get<string>('DB_NAME'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        schema: 'workflow_contabilidad',
        entities: [
          RutaPagoEntity,
          CentroCostoEntity,
          SolicitudGastoEntity,
          BitacoraAuditoriaEntity,
          LineaAjusteContableEntity,
          PreferenciaUsuarioEntity,
          UsuarioWorkflowEntity,
          PerfilPermisoEntity,
        ],
        // Nunca en true: el esquema ya existe y lo gestiona schema.sql / migraciones.
        synchronize: false,
        logging: config.get<string>('DB_LOGGING') === 'true',
      }),
    }),
    TypeOrmModule.forFeature([
      RutaPagoEntity,
      CentroCostoEntity,
      SolicitudGastoEntity,
      BitacoraAuditoriaEntity,
      LineaAjusteContableEntity,
          PreferenciaUsuarioEntity,
          UsuarioWorkflowEntity,
          PerfilPermisoEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
