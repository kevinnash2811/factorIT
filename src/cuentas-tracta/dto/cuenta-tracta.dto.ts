import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Retool manda "undefined" como texto cuando un componente no tiene valor
 * (ver valorFiltro en el servicio): se trata igual que un parámetro ausente.
 */
const SIN_VALOR: unknown[] = [undefined, null, '', 'undefined', 'null'];

function numeroOpcional({ value }: { value: unknown }): number | undefined {
  return SIN_VALOR.includes(value) ? undefined : Number(value);
}

export class CuentaTractaItemDto {
  @ApiProperty({ example: 15646 })
  sec: number;

  @ApiProperty({ example: '1000' })
  emp: string;

  @ApiProperty({ example: 'CAJ' })
  sis: string;

  @ApiProperty({ example: 'ING_CREDITO' })
  transaccion: string;

  @ApiProperty({ example: 'INGRESO CREDITO' })
  glosa: string;

  @ApiProperty({
    example: 'S',
    description: 'Tipo de cuenta (TCT_USA_MAY_AUX).',
  })
  tCta: string;

  @ApiProperty({ example: '1108000205' })
  ctaMayorSap: string;

  @ApiProperty({ example: '2000009551', nullable: true })
  ctaAuxiliarSap: string | null;

  @ApiProperty({ example: '2104000002', nullable: true })
  contraCtaSap: string | null;

  @ApiProperty({
    example: 'ZA',
    description: 'Clase de documento SAP (TCT_CLASE_CUENTA).',
  })
  tDoc: string;

  @ApiProperty({ example: 'CEBE0099', nullable: true })
  cebeSap: string | null;

  @ApiProperty({ example: '1020901099', nullable: true })
  cencosSap: string | null;

  @ApiProperty({ example: 1, nullable: true })
  valU: number | null;

  @ApiProperty({ example: 'ACTIVO' })
  estadoEtiqueta: string;

  @ApiProperty({ example: '#10b981' })
  estadoColor: string;

  @ApiProperty({ example: ['editar', 'eliminar'], enum: ['editar', 'eliminar', 'reactivar'], isArray: true })
  acciones: string[];
}

export class CuentasTractaListadoDto {
  @ApiProperty({ type: [CuentaTractaItemDto] })
  items: CuentaTractaItemDto[];

  @ApiProperty({
    example: ['1000', '2000', '3000', '6000', '7000', '8000'],
    description:
      'Todas las sociedades presentes en la tabla, sin importar el filtro aplicado — para llenar el selector.',
  })
  sociedadesDisponibles: string[];

  @ApiProperty({
    example: ['CAJ', 'CRE', 'FLX'],
    description:
      'Todos los sistemas presentes en la tabla, sin importar el filtro aplicado — para llenar el selector.',
  })
  sistemasDisponibles: string[];

  @ApiProperty({
    example: 9166,
    description: 'Filas que cumplen el filtro, sin paginar.',
  })
  total: number;

  @ApiProperty({ example: 1 })
  pagina: number;

  @ApiProperty({ example: 50, description: 'Filas por página.' })
  tamano: number;
}

export class ListarCuentasTractaQueryDto {
  @ApiPropertyOptional({ example: '1000' })
  @IsOptional()
  @IsString()
  sociedad?: string;

  @ApiPropertyOptional({ example: 'CAJ' })
  @IsOptional()
  @IsString()
  sistema?: string;

  @ApiPropertyOptional({
    description:
      'Busca en Glosa, Transacción, Cuenta Mayor, Auxiliar o Centro de Costo',
    example: 'CREDITO',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Página, desde 1. Por defecto 1.',
  })
  @IsOptional()
  @Transform(numeroOpcional)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Filas por página, entre 1 y 200. Por defecto 50.',
  })
  @IsOptional()
  @Transform(numeroOpcional)
  @IsInt()
  @Min(1)
  @Max(200)
  tamano?: number;
}

export class OpcionTractaDto {
  @ApiProperty({ example: '1000' })
  codigo: string;

  @ApiProperty({ example: '1000 - Caja Los Andes' })
  etiqueta: string;
}

export class OpcionesCuentasTractaDto {
  @ApiProperty({
    type: [OpcionTractaDto],
    description: 'Sociedades presentes en ERP_TRACTA.',
  })
  sociedades: OpcionTractaDto[];

  @ApiProperty({
    type: [OpcionTractaDto],
    description: 'Sistemas presentes en ERP_TRACTA.',
  })
  sistemas: OpcionTractaDto[];

  @ApiProperty({
    type: [OpcionTractaDto],
    description: 'Tipos de cuenta que acepta el formulario (S, K, D).',
  })
  tiposCuenta: OpcionTractaDto[];

  @ApiProperty({
    type: [OpcionTractaDto],
    description: 'Clases de documento presentes en ERP_TRACTA.',
  })
  clasesDocumento: OpcionTractaDto[];
}
