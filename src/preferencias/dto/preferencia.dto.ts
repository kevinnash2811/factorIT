import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConsultarPreferenciaQueryDto {
  @ApiProperty({ example: 'kevin.torrez@cajalosandes.cl' })
  @IsEmail()
  usuario: string;

  @ApiProperty({ example: 'reportes', description: 'Identificador de la pantalla (reportes, bandeja, ...).' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  pantalla: string;
}

export class GuardarPreferenciaDto {
  @ApiProperty({ example: 'kevin.torrez@cajalosandes.cl' })
  @IsEmail()
  usuario: string;

  @ApiProperty({ example: 'reportes' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  pantalla: string;

  @ApiPropertyOptional({
    example: ['repColSociedad', 'repColMedioPago'],
    description: 'IDs de las columnas que el usuario decidió ocultar. Lista vacía = mostrar todas.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  columnasOcultas?: string[];
}

export class PreferenciaDto {
  @ApiProperty({ example: 'reportes' })
  pantalla: string;

  @ApiProperty({ example: ['repColSociedad'], isArray: true })
  columnasOcultas: string[];
}
