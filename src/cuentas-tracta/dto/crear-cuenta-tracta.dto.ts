import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/** Oracle Forms guarda los textos en mayúsculas y sin espacios alrededor. */
function aMayusculas({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

/** Retool puede mandar el número como texto, o vacío si el campo no se llenó. */
function numeroOpcional({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'string' ? Number(value) : value;
}

/**
 * Regla de Oracle ERP_TRACTA.
 *
 * Los nombres de los campos se mantienen porque ya los usa Retool, pero dos no
 * coinciden con su columna: tctClaseCuenta se guarda en TCT_USA_MAY_AUX y
 * parTipodocCaja en TCT_CLASE_CUENTA. Los largos máximos son los de las
 * columnas reales, y los valores permitidos salen de los datos de Oracle, no
 * del catálogo de la Matriz de Reglas (que no incluye, por ejemplo, la
 * sociedad 2000 ni la clase ZK).
 */
export class CrearCuentaTractaDto {
  @ApiProperty({
    example: '1000',
    description:
      'Empresa (ERP_EMPRESA), 4 dígitos. En Oracle hay 1000, 2000, 3000, 6000, 7000 y 8000.',
  })
  @Transform(aMayusculas)
  @Matches(/^[0-9]{4}$/, { message: 'erpEmpresa debe tener 4 dígitos' })
  erpEmpresa: string;

  @ApiProperty({
    example: 'CAJ',
    description: 'Sistema origen (SIS_SISTEMA), hasta 3 caracteres.',
  })
  @Transform(aMayusculas)
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  sisSistema: string;

  @ApiProperty({
    example: 'ING_CREDITO',
    description:
      'Código de transacción (TCT_TRANSACCION), hasta 20 caracteres.',
  })
  @Transform(aMayusculas)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  tctTransaccion: string;

  @ApiProperty({
    example: 'INGRESO CREDITO',
    description: 'Glosa (TCT_GLOSA_TRANS), hasta 60 caracteres.',
  })
  @Transform(aMayusculas)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  tctGlosaTrans: string;

  @ApiProperty({
    enum: ['S', 'K', 'D'],
    example: 'S',
    description:
      'Tipo de cuenta SAP: S (mayor), K (acreedor) o D (deudor). Se guarda en TCT_USA_MAY_AUX.',
  })
  @Transform(aMayusculas)
  @IsIn(['S', 'K', 'D'])
  tctClaseCuenta: string;

  @ApiProperty({
    example: 'ZA',
    description:
      'Clase de documento SAP (KA, ZA, ZK, ZI…), 2 caracteres. Se guarda en TCT_CLASE_CUENTA.',
  })
  @Transform(aMayusculas)
  @Matches(/^[A-Z0-9]{2}$/, {
    message: 'parTipodocCaja debe tener 2 letras o números',
  })
  parTipodocCaja: string;

  @ApiProperty({
    example: '1108000205',
    description: 'Cuenta mayor SAP (TCT_CUENTA_SAP), hasta 10 caracteres.',
  })
  @Transform(aMayusculas)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  tctCuentaSap: string;

  @ApiPropertyOptional({
    example: '2000009551',
    description: 'Cuenta auxiliar (TCT_CTA_AUX), hasta 10 caracteres.',
  })
  @Transform(aMayusculas)
  @IsOptional()
  @IsString()
  @MaxLength(10)
  tctCtaAux?: string;

  @ApiPropertyOptional({
    example: '2104000002',
    description: 'Contra cuenta (TCT_CONTRA_CTA), hasta 10 caracteres.',
  })
  @Transform(aMayusculas)
  @IsOptional()
  @IsString()
  @MaxLength(10)
  tctContraCta?: string;

  @ApiPropertyOptional({
    example: 'CEBE0099',
    description: 'Centro de beneficio (TCT_CENTRO_BENEF), hasta 10 caracteres.',
  })
  @Transform(aMayusculas)
  @IsOptional()
  @IsString()
  @MaxLength(10)
  tctCentroBenef?: string;

  @ApiPropertyOptional({
    example: '1020901099',
    description: 'Centro de costo (CEN_NUMCEN), hasta 10 caracteres.',
  })
  @Transform(aMayusculas)
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cenNumcen?: string;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Valor unitario (TCT_VAL_UNI), hasta 6 decimales.',
  })
  @Transform(numeroOpcional)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  tctValUni?: number;

  @ApiPropertyOptional({
    enum: ['A', 'I'],
    example: 'A',
    default: 'A',
    description: 'A crea la regla activa (TCT_ESTADO = 1) e I inactiva (0).',
  })
  // Vacío se trata como ausente: el formulario de Retool no tiene este campo.
  @Transform(({ value }: { value: unknown }) => {
    const valor = aMayusculas({ value });
    return valor === '' ? undefined : valor;
  })
  @IsOptional()
  @IsIn(['A', 'I'])
  tctEstado?: string;
}
