import { ApiProperty } from '@nestjs/swagger';

export class SociedadRutaDto {
  @ApiProperty({ example: '1000' })
  codigo: string;

  @ApiProperty({ example: 'Sociedad 1000' })
  etiqueta: string;

  @ApiProperty({ example: 'Caja Los Andes' })
  nombre: string;
}

export class ClaseDocumentoDto {
  @ApiProperty({ example: 'KA' })
  codigo: string;

  @ApiProperty({ example: 'Acreedor Gasto' })
  descripcion: string;
}

export class ConfidencialidadDto {
  @ApiProperty({ example: false })
  valor: boolean;

  @ApiProperty({ example: 'Pública' })
  etiqueta: string;

  @ApiProperty({ example: '#10b981' })
  color: string;

  @ApiProperty({ example: '🔓' })
  icono: string;
}

export class RutaDetalleDto {
  @ApiProperty({ example: 'R01' })
  id: string;

  @ApiProperty({ example: 'Pagos con Transferencia Ahorro' })
  nombre: string;

  @ApiProperty({ type: SociedadRutaDto })
  sociedad: SociedadRutaDto;

  @ApiProperty({ type: ClaseDocumentoDto })
  claseDocumento: ClaseDocumentoDto;

  @ApiProperty({ type: ConfidencialidadDto })
  confidencial: ConfidencialidadDto;

  @ApiProperty({ example: true })
  requiereRespaldo: boolean;

  @ApiProperty({ example: true, description: 'false = dada de baja; sigue existiendo por el historial de solicitudes, pero ya no se ofrece para uso nuevo.' })
  activo: boolean;

  @ApiProperty({ example: ['editar', 'eliminar'], description: 'Cuando activo=false, solo trae ["reactivar"] — mismo principio que resolverAcciones() en Solicitudes: el backend decide qué se puede hacer.' })
  acciones: string[];
}
