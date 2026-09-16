import { Module } from '@nestjs/common';
import { OracleModule } from '../oracle/oracle.module';
import { CuentasTractaController } from './cuentas-tracta.controller';
import { CuentasTractaService } from './cuentas-tracta.service';
import { TractaOracleRepository } from './tracta-oracle.repository';

@Module({
  imports: [OracleModule],
  controllers: [CuentasTractaController],
  providers: [CuentasTractaService, TractaOracleRepository],
})
export class CuentasTractaModule {}
