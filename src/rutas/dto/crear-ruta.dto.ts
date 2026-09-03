import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { CODIGOS_CLASE_DOCUMENTO, CODIGOS_SOCIEDAD } from '../../common/rutas-catalogo.util';

export class CrearRutaDto {
  @ApiProperty({ example: 'R24', description: 'Debe empezar con "R" seguido de números, y no existir todavía.' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^R\d+$/, { message: 'El ID de la ruta debe tener el formato R seguido de números, ej: R24' })
  id: string;

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

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  confidencial?: boolean;
}
