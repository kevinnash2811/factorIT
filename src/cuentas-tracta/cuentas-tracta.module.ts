import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpTractaEntity } from '../database/entities/erp-tracta.entity';
import { CuentasTractaController } from './cuentas-tracta.controller';
import { CuentasTractaService } from './cuentas-tracta.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErpTractaEntity])],
  controllers: [CuentasTractaController],
  providers: [CuentasTractaService],
})
export class CuentasTractaModule {}
