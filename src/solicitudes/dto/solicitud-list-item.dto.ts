import { ApiProperty } from '@nestjs/swagger';

class SolicitanteDto {
  @ApiProperty({ example: 'Marcelo Silva' })
  nombre: string;

  @ApiProperty({ example: 'marcelo.silva@cajalosandes.cl' })
  email: string;

  @ApiProperty({ example: 'MS' })
  iniciales: string;
}

class MontoDto {
  @ApiProperty({ example: 125000, nullable: true, description: 'null si el ticket está enmascarado por confidencialidad' })
  valor: number | null;

  @ApiProperty({ example: 'CLP' })
  moneda: string;

  @ApiProperty({ example: '$125.000' })
  formateado: string;
}

class RutaDto {
  @ApiProperty({ example: 'R10' })
  id: string;

  @ApiProperty({ example: 'Gasto Operacional (Todas las áreas)' })
  nombre: string;
}

class EstadoDto {
  @ApiProperty({ example: 'PENDIENTE_APROBACION' })
  codigo: string;

  @ApiProperty({ example: 'Pendiente VB' })
  etiqueta: string;

  @ApiProperty({ example: '#f59e0b' })
  color: string;
}

class SlaDto {
  @ApiProperty({ example: 'VENCIDO', enum: ['CUMPLIDO', 'VENCIDO', 'POR_VENCER', 'EN_TIEMPO'] })
  estado: string;

  @ApiProperty({ example: 'Vencido hace 17d 4h' })
  etiqueta: string;

  @ApiProperty({ example: '#ef4444' })
  color: string;

  @ApiProperty({ example: '2026-07-26T10:30:00-04:00', nullable: true })
  venceEn: string | null;
}

class ContabilizacionDto {
  @ApiProperty({ example: null, nullable: true, enum: ['en_vuelo', 'posteado', 'fallido', null] })
  estado: string | null;

  @ApiProperty({ example: null, nullable: true })
  voucher: string | null;

  @ApiProperty({ example: null, nullable: true })
  documentoSap: string | null;
}

export class SolicitudListItemDto {
  @ApiProperty({ example: 'TKT-8291' })
  id: string;

  @ApiProperty({ type: SolicitanteDto })
  solicitante: SolicitanteDto;

  @ApiProperty({ type: MontoDto })
  monto: MontoDto;

  @ApiProperty({ type: RutaDto })
  ruta: RutaDto;

  @ApiProperty({ example: '1000' })
  sociedad: string;

  @ApiProperty({ type: EstadoDto })
  estado: EstadoDto;

  @ApiProperty({ type: SlaDto })
  sla: SlaDto;

  @ApiProperty({
    example: ['ver_detalle', 'ver_bitacora', 'aprobar'],
    description: 'Lista resuelta por el servidor. El front pinta un botón por cada valor presente, nunca decide por su cuenta según el estado.',
  })
  acciones: string[];

  @ApiProperty({ example: false })
  confidencial: boolean;

  @ApiProperty({ type: ContabilizacionDto })
  contabilizacion: ContabilizacionDto;
}

export class SolicitudesPaginadasDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  size: number;

  @ApiProperty({ example: 143 })
  total: number;

  @ApiProperty({ type: [SolicitudListItemDto] })
  items: SolicitudListItemDto[];
}
