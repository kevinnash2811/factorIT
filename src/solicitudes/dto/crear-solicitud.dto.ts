import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class LineaAjusteDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  lineaSecuencia: number;

  @ApiPropertyOptional({ example: 30573, nullable: true })
  @IsOptional()
  @IsNumber()
  origenMontoComp?: number | null;

  @ApiPropertyOptional({ example: '7114' })
  @IsOptional()
  @IsString()
  origenCod?: string;

  @ApiProperty({ example: '1107000090' })
  @IsString()
  @IsNotEmpty()
  origenCuenta: string;

  @ApiPropertyOptional({ example: 'Reint. Planilla' })
  @IsOptional()
  @IsString()
  origenNumComp?: string;

  @ApiPropertyOptional({ example: '56071800' })
  @IsOptional()
  @IsString()
  origenRut?: string;

  @ApiPropertyOptional({ example: '4' })
  @IsOptional()
  @IsString()
  origenDv?: string;

  @ApiProperty({ example: 30573 })
  @IsNumber()
  @Min(0)
  destinoMontoAjuste: number;

  @ApiPropertyOptional({ example: '9102' })
  @IsOptional()
  @IsString()
  destinoCod?: string;

  @ApiProperty({ example: '2104000125' })
  @IsString()
  @IsNotEmpty()
  destinoCuenta: string;

  @ApiPropertyOptional({ example: 'Pago de más' })
  @IsOptional()
  @IsString()
  destinoObservacion?: string;
}

export class CrearSolicitudDto {
  @ApiProperty({ example: 'Marcelo Silva' })
  @IsString()
  @IsNotEmpty()
  solicitante: string;

  @ApiProperty({ example: 'R10' })
  @IsString()
  @IsNotEmpty()
  rutaId: string;

  @ApiProperty({ example: 125000 })
  @IsNumber()
  @IsPositive()
  monto: number;

  @ApiProperty({ example: 'CEBE0099' })
  @IsString()
  @IsNotEmpty()
  ceco: string;

  @ApiPropertyOptional({ example: 'FAC-10022' })
  @IsOptional()
  @IsString()
  numeroFactura?: string;

  @ApiPropertyOptional({ example: 'Analista de Operaciones' })
  @IsOptional()
  @IsString()
  cargoSolicitante?: string;

  @ApiPropertyOptional({ example: 'Gerencia de Beneficios Sociales' })
  @IsOptional()
  @IsString()
  gerenciaSolicitante?: string;

  @ApiPropertyOptional({ enum: ['TRANSFERENCIA', 'CHEQUE'], default: 'TRANSFERENCIA' })
  @IsOptional()
  @IsIn(['TRANSFERENCIA', 'CHEQUE'])
  medioPago?: string;

  @ApiPropertyOptional({ example: 'Banco Estado' })
  @ValidateIf((o) => o.medioPago !== 'CHEQUE')
  @IsString()
  @IsNotEmpty({ message: 'banco_nombre es obligatorio cuando el medio de pago es transferencia' })
  bancoNombre?: string;

  @ApiPropertyOptional({ example: 'Cuenta Corriente' })
  @ValidateIf((o) => o.medioPago !== 'CHEQUE')
  @IsString()
  @IsNotEmpty()
  bancoTipoCuenta?: string;

  @ApiPropertyOptional({ example: '0010928122' })
  @ValidateIf((o) => o.medioPago !== 'CHEQUE')
  @IsString()
  @IsNotEmpty()
  bancoNroCuenta?: string;

  @ApiPropertyOptional({ example: '15.432.110-3' })
  @ValidateIf((o) => o.medioPago !== 'CHEQUE')
  @IsString()
  @IsNotEmpty()
  bancoRutTitular?: string;

  @ApiPropertyOptional({ example: 'Marcelo Silva Contador' })
  @ValidateIf((o) => o.medioPago === 'CHEQUE')
  @IsString()
  @IsNotEmpty({ message: 'beneficiario_cheque es obligatorio cuando el medio de pago es cheque' })
  beneficiarioCheque?: string;

  @ApiPropertyOptional({ example: '12.980.123-4' })
  @ValidateIf((o) => o.medioPago === 'CHEQUE')
  @IsString()
  @IsNotEmpty()
  beneficiarioRut?: string;

  @ApiPropertyOptional({ example: 'Boleta_Combustible.pdf' })
  @IsOptional()
  @IsString()
  documentoNombre?: string;

  @ApiPropertyOptional({ example: 'gs://caja-los-andes-contabilidad/tickets/temp/Boleta.pdf', description: 'Referencia de WCC. Ver nota de arquitectura sobre adjuntos.' })
  @IsOptional()
  @IsString()
  documentoGcsUri?: string;

  @ApiPropertyOptional({ example: '180.2' })
  @IsOptional()
  @IsString()
  documentoPesoKb?: string;

  @ApiPropertyOptional({ example: 'Reembolso correspondiente a rendición de cuentas por concepto de servicios y provisiones de cierres contables mensuales.' })
  @IsOptional()
  @IsString()
  descripcionDetalle?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  esAjusteContable?: boolean;

  @ApiPropertyOptional({ type: [LineaAjusteDto], description: 'Obligatorio y validado (Debe = Haber) cuando rutaId es R23' })
  @ValidateIf((o) => o.esAjusteContable === true)
  @IsArray()
  @ArrayMinSize(1, { message: 'Una solicitud de ajuste contable (R23) requiere al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => LineaAjusteDto)
  lineasAjuste?: LineaAjusteDto[];
}
