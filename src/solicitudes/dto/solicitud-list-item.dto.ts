import { ApiProperty } from '@nestjs/swagger';

class SolicitanteDto {
  @ApiProperty({ example: 'Marcelo Silva' })
  nombre: string;

  @ApiProperty({ example: 'marcelo.silva@cajalosandes.cl' })
  email: string;

  @ApiProperty({ example: 'MS' })
  iniciales: string;

  @ApiProperty({ example: 'Analista Contable', nullable: true })
  cargo: string | null;

  @ApiProperty({ example: 'Subgerencia de Contabilidad', nullable: true, description: 'Gerencia declarada por quien ingresa la solicitud.' })
  gerencia: string | null;
}

class CecoDto {
  @ApiProperty({ example: 'CEBE0099' })
  id: string;

  @ApiProperty({ example: 'Gerencia de Beneficios Sociales', description: 'Gerencia dueña del centro de costo — es la que carga el gasto en su presupuesto.' })
  gerencia: string;
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

  @ApiProperty({
    example: '2026-07-26T10:30:00-04:00',
    nullable: true,
    description: 'Fecha límite del SLA. Viene informada siempre que el ticket tenga plazo, también en los ya integrados; es null sólo cuando nunca se le calculó uno.',
  })
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

  @ApiProperty({ example: '2026-07-24', description: 'Fecha de creación, formato YYYY-MM-DD' })
  fechaCreacion: string;

  @ApiProperty({ type: RutaDto })
  ruta: RutaDto;

  @ApiProperty({ example: '1000' })
  sociedad: string;

  @ApiProperty({ type: CecoDto })
  ceco: CecoDto;

  @ApiProperty({ example: 'FAC-8874', nullable: true })
  numeroFactura: string | null;

  @ApiProperty({ example: 'TRANSFERENCIA', nullable: true })
  medioPago: string | null;

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

  @ApiProperty({ example: 284500000, description: 'Suma de monto_clp de TODOS los resultados que cumplen el filtro (no solo la página actual). Los montos enmascarados por confidencialidad no se excluyen del total.' })
  montoTotalFiltrado: number;

  @ApiProperty({ type: [SolicitudListItemDto] })
  items: SolicitudListItemDto[];
}
