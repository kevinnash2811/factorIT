import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { CODIGOS_SOCIEDAD, CODIGOS_CLASE_DOCUMENTO } from '../../common/rutas-catalogo.util';

export class CrearCuentaTractaDto {
  @ApiProperty({ enum: CODIGOS_SOCIEDAD, example: '1000', description: 'Empresa (EMP) — misma sociedad SAP que usa la Matriz de Reglas.' })
  @IsIn(CODIGOS_SOCIEDAD)
  erpEmpresa: string;

  @ApiProperty({ example: 'ACT', description: 'Sistema origen (SIS) en Oracle.' })
  @IsString()
  @IsNotEmpty()
  sisSistema: string;

  @ApiProperty({ example: '46000012000 ID', description: 'Código de transacción auxiliar Oracle.' })
  @IsString()
  @IsNotEmpty()
  tctTransaccion: string;

  @ApiProperty({ example: 'ARRIENDO SUCURSAL TEMUCO' })
  @IsString()
  @IsNotEmpty()
  tctGlosaTrans: string;

  @ApiProperty({ enum: ['S'], example: 'S', description: 'Tipo de cuenta. Hoy solo se confirmó "S - Cuenta" en los datos reales; se amplía el catálogo si aparecen otros valores.' })
  @IsIn(['S'])
  tctClaseCuenta: string;

  @ApiProperty({ enum: CODIGOS_CLASE_DOCUMENTO, example: 'KA', description: 'Clase de documento SAP (T.C.) — mismo catálogo que Matriz de Reglas.' })
  @IsIn(CODIGOS_CLASE_DOCUMENTO)
  parTipodocCaja: string;

  @ApiProperty({ example: '4208200325' })
  @IsString()
  @IsNotEmpty()
  tctCuentaSap: string;

  @ApiPropertyOptional({ example: '2000009551' })
  @IsOptional()
  @IsString()
  tctCtaAux?: string;

  @ApiPropertyOptional({ example: '2104000002' })
  @IsOptional()
  @IsString()
  tctContraCta?: string;

  @ApiPropertyOptional({ example: 'CEBE0099' })
  @IsOptional()
  @IsString()
  tctCentroBenef?: string;

  @ApiPropertyOptional({ example: '1020901099' })
  @IsOptional()
  @IsString()
  cenNumcen?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  tctValUni?: number;

  @ApiPropertyOptional({ enum: ['A', 'I'], example: 'A', default: 'A' })
  @IsOptional()
  @IsIn(['A', 'I'])
  tctEstado?: string;
}
