import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
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

/**
 * Retool no puede mandar una lista anidada dentro de un campo del cuerpo sin
 * desordenar los demás campos —los valores terminan corridos una posición—, así
 * que viaja como texto JSON. Mismo criterio que los permisos de un perfil: se
 * parsea antes de validar, y si viene mal formado se deja pasar como está para
 * que el validador devuelva un error claro en vez de reventar.
 */
const textoComoLista = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const limpio = value.trim();
  if (limpio === '') return [];
  try {
    const datos: unknown = JSON.parse(limpio);
    return Array.isArray(datos) ? datos : value;
  } catch {
    return value;
  }
};

/** Un respaldo ya subido por /documentos. */
export class DocumentoAdjuntoDto {
  @ApiProperty({ example: 'Boleta_Combustible.pdf' })
  @IsString()
  @MaxLength(255)
  nombre: string;

  @ApiProperty({ example: '/documentos/archivos/3f2b7c1a-9d4e-4b8a-9c2f-1a2b3c4d5e6f.pdf' })
  @IsString()
  @MaxLength(512)
  url: string;

  @ApiPropertyOptional({ example: '180.2' })
  @IsOptional()
  @IsString()
  pesoKb?: string;
}

/**
 * Con @Transform presente, class-transformer ya no aplica @Type: los
 * elementos llegarían como objetos planos y el validador rechazaría cada
 * propiedad ("property nombre should not exist"). Por eso las instancias se
 * construyen aquí mismo.
 */
const textoComoAdjuntos = ({ value }: { value: unknown }) => {
  const datos = textoComoLista({ value });
  return Array.isArray(datos) ? plainToInstance(DocumentoAdjuntoDto, datos) : datos;
};

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

  @ApiPropertyOptional({
    type: [DocumentoAdjuntoDto],
    description:
      'Respaldos de la solicitud. Reemplaza a documentoNombre/documentoGcsUri/documentoPesoKb, ' +
      'que se conservan solo por compatibilidad con la versión anterior del portal.',
  })
  @Transform(textoComoAdjuntos)
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DocumentoAdjuntoDto)
  @ArrayMaxSize(5)
  documentos?: DocumentoAdjuntoDto[];

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
