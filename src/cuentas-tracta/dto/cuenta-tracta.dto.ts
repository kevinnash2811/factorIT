import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CuentaTractaItemDto {
  @ApiProperty({ example: 1 })
  sec: number;

  @ApiProperty({ example: '1000' })
  emp: string;

  @ApiProperty({ example: 'ACT' })
  sis: string;

  @ApiProperty({ example: '4600008075 ID' })
  transaccion: string;

  @ApiProperty({ example: 'ARRIENDO LAS CONDES III' })
  glosa: string;

  @ApiProperty({ example: 'S' })
  tCta: string;

  @ApiProperty({ example: '4208200325' })
  ctaMayorSap: string;

  @ApiProperty({ example: '2000009551', nullable: true })
  ctaAuxiliarSap: string | null;

  @ApiProperty({ example: '2104000002', nullable: true })
  contraCtaSap: string | null;

  @ApiProperty({ example: 'KA' })
  tDoc: string;

  @ApiProperty({ example: 'CEBE0099', nullable: true })
  cebeSap: string | null;

  @ApiProperty({ example: '1020901099', nullable: true })
  cencosSap: string | null;

  @ApiProperty({ example: 2, nullable: true })
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

  @ApiProperty({ example: ['1000', '6000', '8000'], description: 'Todas las sociedades presentes en la tabla, sin importar el filtro aplicado — para llenar el selector.' })
  sociedadesDisponibles: string[];

  @ApiProperty({ example: ['ACT'], description: 'Todos los sistemas presentes en la tabla, sin importar el filtro aplicado — para llenar el selector.' })
  sistemasDisponibles: string[];
}

export class ListarCuentasTractaQueryDto {
  @ApiPropertyOptional({ example: '1000' })
  @IsOptional()
  @IsString()
  sociedad?: string;

  @ApiPropertyOptional({ example: 'ACT' })
  @IsOptional()
  @IsString()
  sistema?: string;

  @ApiPropertyOptional({ description: 'Busca en Glosa, Transacción, Cuenta Mayor, Auxiliar o Centro de Costo', example: 'ARRIENDO' })
  @IsOptional()
  @IsString()
  q?: string;
}
