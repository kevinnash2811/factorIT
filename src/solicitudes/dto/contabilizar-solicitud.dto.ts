import { ApiProperty } from '@nestjs/swagger';

export class ContabilizarSolicitudResultadoDto {
  @ApiProperty({ example: 'TKT-4122' })
  id: string;

  @ApiProperty({ example: 'INTEGRADO_SAP' })
  estado: string;

  @ApiProperty({ example: 'Integrado SAP' })
  estadoEtiqueta: string;

  @ApiProperty({ example: '17233418', description: 'Voucher contable generado' })
  voucherId: string;

  @ApiProperty({ example: '1000' })
  sociedad: string;
}
