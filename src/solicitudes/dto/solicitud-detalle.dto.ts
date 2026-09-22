import { ApiProperty } from '@nestjs/swagger';
import { DocumentoSoporteDto, PasoBitacoraDto } from './bitacora-solicitud.dto';

class ColaboradorDetalleDto {
  @ApiProperty({ example: 'Camila Rojas', nullable: true, description: 'null si el ticket está enmascarado por confidencialidad' })
  nombre: string | null;

  @ApiProperty({ example: 'camila.rojas@cajalosandes.cl', nullable: true })
  email: string | null;

  @ApiProperty({ example: 'Jefe de Personal' })
  cargo: string;

  @ApiProperty({ example: 'Gerencia de Personas' })
  gerencia: string;

  @ApiProperty({ example: '2026-07-20T14:00:00-04:00' })
  creacion: string;

  @ApiProperty({ example: '2026-07-22T14:00:00-04:00', nullable: true })
  vencimiento: string | null;
}

class InformacionFinancieraDto {
  @ApiProperty({ example: 'R12' })
  rutaId: string;

  @ApiProperty({ example: 'Pago Derecho Municipal' })
  rutaNombre: string;

  @ApiProperty({ example: '1000' })
  sociedad: string;

  @ApiProperty({ example: 'KA' })
  claseDocSap: string;

  @ApiProperty({ example: 'FAC-8874', nullable: true })
  numeroFactura: string | null;

  @ApiProperty({ example: 845000, nullable: true, description: 'null si el ticket está enmascarado por confidencialidad' })
  monto: number | null;
}

class DestinoPagoDto {
  @ApiProperty({ example: 'TRANSFERENCIA', enum: ['TRANSFERENCIA', 'CHEQUE'] })
  medioPago: string;

  @ApiProperty({ example: 'Banco de Chile', nullable: true })
  bancoNombre: string | null;

  @ApiProperty({ example: 'Corriente', nullable: true })
  bancoTipoCuenta: string | null;

  @ApiProperty({ example: '0010928122', nullable: true })
  bancoNroCuenta: string | null;

  @ApiProperty({ example: '15.432.110-3', nullable: true })
  bancoRutTitular: string | null;

  @ApiProperty({ example: null, nullable: true })
  beneficiarioCheque: string | null;

  @ApiProperty({ example: null, nullable: true })
  beneficiarioRut: string | null;

  @ApiProperty({ example: 'CEPE0033' })
  cecoId: string;
}

class EstadoDetalleDto {
  @ApiProperty({ example: 'APROBADO_CONTABILIZAR' })
  codigo: string;

  @ApiProperty({ example: 'Aprobado Cont.' })
  etiqueta: string;

  @ApiProperty({ example: '#10b981' })
  color: string;
}

export class SolicitudDetalleDto {
  @ApiProperty({ example: 'TKT-4122' })
  id: string;

  @ApiProperty({ type: EstadoDetalleDto })
  estado: EstadoDetalleDto;

  @ApiProperty({
    example: ['ver_detalle', 'ver_bitacora', 'contabilizar'],
    description: 'Resuelto por el servidor — el botón principal del modal (ej. "Integrar a SAP HANA") se pinta según esta lista, nunca por estado adivinado en el front.',
  })
  acciones: string[];

  @ApiProperty({ type: ColaboradorDetalleDto })
  colaborador: ColaboradorDetalleDto;

  @ApiProperty({ type: InformacionFinancieraDto })
  informacionFinanciera: InformacionFinancieraDto;

  @ApiProperty({ type: DestinoPagoDto })
  destinoPago: DestinoPagoDto;

  @ApiProperty({ example: 'Reembolso correspondiente a rendición de cuentas...', nullable: true })
  descripcion: string | null;

  @ApiProperty({ type: DocumentoSoporteDto, nullable: true })
  documento: DocumentoSoporteDto | null;

  @ApiProperty({
    type: [DocumentoSoporteDto],
    description: "Todos los respaldos de la solicitud. `documento` es el primero, por compatibilidad.",
  })
  documentos: DocumentoSoporteDto[];

  @ApiProperty({ example: false })
  confidencial: boolean;

  @ApiProperty({
    type: [PasoBitacoraDto],
    description: 'Mismo historial que devuelve /bitacora — se incluye acá para que el modal de detalle no necesite una segunda llamada.',
  })
  historial: PasoBitacoraDto[];
}
