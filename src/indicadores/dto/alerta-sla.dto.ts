import { ApiProperty } from '@nestjs/swagger';

export class AlertaSlaDto {
  @ApiProperty({ example: 'FNZ-130309' })
  id: string;

  @ApiProperty({ example: 'CAROLINA TILLERIA S.', description: 'Enmascarado si la ruta es confidencial' })
  solicitante: string;

  @ApiProperty({ example: 1014961, nullable: true, description: 'null si el ticket está enmascarado' })
  monto: number | null;

  @ApiProperty({ example: 'VENCIDO', enum: ['VENCIDO', 'POR_VENCER'] })
  severidad: 'VENCIDO' | 'POR_VENCER';

  @ApiProperty({ example: 'Vencido hace 46d 19h' })
  etiqueta: string;

  @ApiProperty({ example: '#ef4444' })
  color: string;
}

export class AlertasSlaDto {
  @ApiProperty({ type: [AlertaSlaDto] })
  items: AlertaSlaDto[];

  @ApiProperty({ example: '2026-08-19 15:10:00' })
  actualizadoEn: string;
}
