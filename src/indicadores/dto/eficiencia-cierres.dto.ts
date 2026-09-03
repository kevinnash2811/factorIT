import { ApiProperty } from '@nestjs/swagger';

export class EficienciaGerenciaDto {
  @ApiProperty({ example: 'Gerencia de Beneficios Sociales' })
  gerencia: string;

  @ApiProperty({ example: 'Beneficios Sociales', description: 'Nombre sin el prefijo "Gerencia de" — para las etiquetas del gráfico, que de otro modo quedan ilegibles.' })
  gerenciaCorta: string;

  @ApiProperty({ example: 8, description: 'Tickets INTEGRADO_SAP cerrados antes de fecha_limite_sla' })
  aTiempo: number;

  @ApiProperty({ example: 3, description: 'Tickets INTEGRADO_SAP cerrados después de fecha_limite_sla' })
  vencidos: number;

  @ApiProperty({ example: 73, description: '% de cierres dentro de plazo sobre el total cerrado de esa gerencia.' })
  cumplimientoPct: number;

  @ApiProperty({ example: '#f59e0b', description: 'Semáforo: verde ≥80%, ámbar ≥60%, rojo bajo eso.' })
  color: string;
}

export class EficienciaCierresDto {
  @ApiProperty({ type: [EficienciaGerenciaDto] })
  items: EficienciaGerenciaDto[];

  @ApiProperty({ example: 78, description: '% global de cierres dentro de plazo — alimenta el badge "SLA Global" de la Bandeja.' })
  cumplimientoGlobalPct: number;

  @ApiProperty({ example: '2026-08-19 15:40:00' })
  actualizadoEn: string;
}
