import { ApiProperty } from '@nestjs/swagger';

/**
 * Forma acordada en el contrato BFF para que el front distinga el tipo de
 * error y reaccione distinto en cada caso (ver CONTRATO_BFF_SOLICITUDES).
 */
export type CodigoError =
  | 'VALIDACION'
  | 'REGLA_NEGOCIO'
  | 'NO_AUTORIZADO'
  | 'NO_ENCONTRADO'
  | 'CIRCUITO_ABIERTO'
  | 'ERROR_SAP'
  | 'ERROR_INTERNO';

export class ErrorResponseDto {
  @ApiProperty({
    enum: ['VALIDACION', 'REGLA_NEGOCIO', 'NO_AUTORIZADO', 'NO_ENCONTRADO', 'CIRCUITO_ABIERTO', 'ERROR_SAP', 'ERROR_INTERNO'],
    example: 'REGLA_NEGOCIO',
  })
  codigo: CodigoError;

  @ApiProperty({ example: 'Gasto duplicado detectado' })
  mensaje: string;

  @ApiProperty({ example: 'Ya existe un ticket con la factura FAC-10022 por el mismo monto.' })
  detalle: string;

  @ApiProperty({ example: false })
  reintentable: boolean;
}
