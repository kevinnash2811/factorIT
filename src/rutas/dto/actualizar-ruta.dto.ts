import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CODIGOS_CLASE_DOCUMENTO, CODIGOS_SOCIEDAD } from '../../common/rutas-catalogo.util';

export class ActualizarRutaDto {
  @ApiProperty({ example: 'Devolución de Excedentes de Salud' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ enum: CODIGOS_SOCIEDAD, example: '1000' })
  @IsIn(CODIGOS_SOCIEDAD)
  sociedad: string;

  @ApiProperty({ enum: CODIGOS_CLASE_DOCUMENTO, example: 'KA' })
  @IsIn(CODIGOS_CLASE_DOCUMENTO)
  claseDocumento: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  confidencial?: boolean;
}
