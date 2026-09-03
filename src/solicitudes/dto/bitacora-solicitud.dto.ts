import { ApiProperty } from '@nestjs/swagger';

export class DocumentoSoporteDto {
  @ApiProperty({ example: 'Memo N°248-2026 Reintegro por Planillas 2do Proceso.xlsx' })
  nombre: string;

  @ApiProperty({ example: '/documentos/archivos/3f2a1c9e-memo.xlsx' })
  url: string;

  @ApiProperty({ example: '50.0' })
  pesoKb: string;
}

export class PasoBitacoraDto {
  @ApiProperty({ example: 1 })
  pasoNumero: number;

  @ApiProperty({ example: 'Carolina Tilleria S.' })
  responsable: string;

  @ApiProperty({ example: 'Creación de Ticket' })
  accionEjecutada: string;

  @ApiProperty({ example: 'PENDIENTE_APROBACION' })
  estadoResultado: string;

  @ApiProperty({ example: 'Planilla Excel de ajustes contables cargada de forma exitosa (18 líneas pre-validadas y cuadradas).', nullable: true })
  comentario: string | null;

  @ApiProperty({ example: '2026-07-02T15:52:00-04:00' })
  fecha: string;
}

export class BitacoraSolicitudDto {
  @ApiProperty({ example: 'FNZ-130309' })
  solicitudId: string;

  @ApiProperty({ example: 'Analista de Normalización (Gerencia de Operaciones y Finanzas)' })
  cargoSolicitante: string;

  @ApiProperty({ type: DocumentoSoporteDto, nullable: true })
  documento: DocumentoSoporteDto | null;

  @ApiProperty({ type: [PasoBitacoraDto] })
  pasos: PasoBitacoraDto[];
}
