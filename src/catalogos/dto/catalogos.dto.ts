import { ApiProperty } from '@nestjs/swagger';

class RutaCatalogoDto {
  @ApiProperty({ example: 'R10' })
  id: string;

  @ApiProperty({ example: 'Gasto Operacional (Todas las áreas)' })
  nombre: string;

  @ApiProperty({ example: '1000' })
  sociedad: string;

  @ApiProperty({ example: 'KA' })
  claseDoc: string;

  @ApiProperty({ example: false })
  confidencial: boolean;
}

class CecoCatalogoDto {
  @ApiProperty({ example: 'CEBE0099' })
  id: string;

  @ApiProperty({ example: 'Gerencia de Beneficios Sociales' })
  nombreGerencia: string;
}

export class CatalogosDto {
  @ApiProperty({ type: [RutaCatalogoDto] })
  rutas: RutaCatalogoDto[];

  @ApiProperty({ type: [CecoCatalogoDto] })
  cecos: CecoCatalogoDto[];

  @ApiProperty({ example: [{ codigo: 'TRANSFERENCIA', etiqueta: 'Transferencia' }, { codigo: 'CHEQUE', etiqueta: 'Cheque' }] })
  mediosPago: { codigo: string; etiqueta: string }[];
}
