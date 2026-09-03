import { ApiProperty } from '@nestjs/swagger';

export class DocumentoSubidoDto {
  @ApiProperty({ example: 'Boleta_Combustible.pdf', description: 'Nombre original del archivo' })
  nombre: string;

  @ApiProperty({
    example: '/documentos/archivos/3f2a1c9e-Boleta_Combustible.pdf',
    description:
      'Ruta relativa en este servidor. TODO: es un almacenamiento provisional — cuando exista acceso a WCC, esto debe migrar a la referencia real del gestor documental corporativo (ver CONTEXTO_BASE_WORKFLOW_COMPLEMENTO.md).',
  })
  url: string;

  @ApiProperty({ example: '180.2', description: 'Peso del archivo en KB' })
  pesoKb: string;
}

export class DocumentosSubidosDto {
  @ApiProperty({ type: [DocumentoSubidoDto] })
  items: DocumentoSubidoDto[];
}
