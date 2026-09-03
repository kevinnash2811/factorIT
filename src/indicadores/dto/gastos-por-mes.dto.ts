import { ApiProperty } from '@nestjs/swagger';

export class GastoPorMesItemDto {
  @ApiProperty({ example: '2026-08', description: 'Año-mes, para ordenar cronológicamente.' })
  mes: string;

  @ApiProperty({ example: 'Ago 2026' })
  mesEtiqueta: string;

  @ApiProperty({ example: 42 })
  cantidad: number;

  @ApiProperty({ example: 18500000 })
  montoTotal: number;
}

export class GastosPorMesDto {
  @ApiProperty({ type: [GastoPorMesItemDto] })
  items: GastoPorMesItemDto[];

  @ApiProperty({ example: 235000000, description: 'Suma de montoTotal de todos los meses del reporte.' })
  montoAcumulado: number;

  @ApiProperty({ example: 1524, description: 'Suma de cantidad de todos los meses del reporte.' })
  cantidadAcumulada: number;
}

export class SolicitudPorEstadoItemDto {
  @ApiProperty({ example: 'INTEGRADO_SAP' })
  estado: string;

  @ApiProperty({ example: 'Integrado SAP' })
  etiqueta: string;

  @ApiProperty({ example: '#10b981' })
  color: string;

  @ApiProperty({ example: 857 })
  cantidad: number;
}

export class SolicitudesPorEstadoDto {
  @ApiProperty({ type: [SolicitudPorEstadoItemDto] })
  items: SolicitudPorEstadoItemDto[];

  @ApiProperty({ example: 1524 })
  total: number;
}
