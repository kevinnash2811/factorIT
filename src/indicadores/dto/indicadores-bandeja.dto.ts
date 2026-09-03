import { ApiProperty } from '@nestjs/swagger';

export class IndicadorTileDto {
  @ApiProperty({ example: 'pendientes', description: 'Clave estable, útil como key en el front' })
  clave: string;

  @ApiProperty({ example: 'Pendientes' })
  etiqueta: string;

  @ApiProperty({ example: 2 })
  valor: number;

  @ApiProperty({ example: '#64748b' })
  color: string;
}

export class IndicadoresBandejaDto {
  @ApiProperty({
    type: [IndicadorTileDto],
    description:
      'Arreglo, no un objeto de campos fijos — agregar un indicador nuevo en el backend no requiere ningún cambio en el front, que simplemente itera sobre lo que llegue.',
  })
  items: IndicadorTileDto[];

  @ApiProperty({ example: '2026-08-19 14:32:00', description: 'Momento del cálculo (consulta en vivo, no cacheada)' })
  actualizadoEn: string;
}
