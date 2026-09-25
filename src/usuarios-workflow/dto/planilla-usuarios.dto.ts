import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { textoComoBooleano, textoComoLista } from '../../common/texto-json.util';

/**
 * Un usuario tal como lo conoce Retool.
 *
 * Esta lista la manda el front y no se puede consultar desde aquí: el token
 * de la Retool API vive en Retool, no en este servicio. Es la misma razón por
 * la que `usuarios_workflow` no guarda el nombre ni si la persona está activa.
 */
export class UsuarioRetoolDto {
  @ApiProperty({ example: 'user_5f2a1c9e0b7d4e3a8c6f1b2d3e4f5a6b' })
  @IsString()
  @MaxLength(100)
  retoolUserId: string;

  @ApiProperty({ example: 'carlos.blanco@cajalosandes.cl' })
  @IsString()
  @MaxLength(150)
  email: string;

  @ApiPropertyOptional({ example: 'Carlos Blanco' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Solo se usa como dato informativo en la planilla.',
  })
  @IsOptional()
  @IsBoolean()
  activoRetool?: boolean;
}

const textoComoUsuariosRetool = ({ value }: { value: unknown }) => {
  const datos = textoComoLista({ value });
  return Array.isArray(datos) ? plainToInstance(UsuarioRetoolDto, datos) : datos;
};

export class ExportarPlanillaDto {
  @ApiProperty({
    type: [UsuarioRetoolDto],
    description:
      'Las personas que se quieren exportar, en el orden en que se ven en pantalla. ' +
      'Va como texto JSON porque Retool no envía listas en el cuerpo.',
  })
  @Transform(textoComoUsuariosRetool)
  @ValidateNested({ each: true })
  @Type(() => UsuarioRetoolDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  usuarios: UsuarioRetoolDto[];
}

export class ImportarPlanillaDto {
  @ApiProperty({
    type: [UsuarioRetoolDto],
    description:
      'Lista completa de usuarios de Retool. El importador solo toca a quien ' +
      'esté en esta lista: una fila con alguien que no existe en Retool se informa y se ignora.',
  })
  @Transform(textoComoUsuariosRetool)
  @ValidateNested({ each: true })
  @Type(() => UsuarioRetoolDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  usuarios: UsuarioRetoolDto[];

  @ApiPropertyOptional({
    example: false,
    description:
      'false (por defecto) solo simula y devuelve qué pasaría. true escribe los cambios.',
  })
  @IsOptional()
  @Transform(textoComoBooleano)
  @IsBoolean()
  aplicar?: boolean;
}

export class CambioPlanillaDto {
  @ApiProperty({ example: 'Nivel jerárquico' })
  campo: string;

  @ApiProperty({ example: 'Analista' })
  antes: string;

  @ApiProperty({ example: 'Supervisor' })
  despues: string;
}

export class FilaPlanillaDto {
  @ApiProperty({ example: 7, description: 'Número de fila en el Excel.' })
  fila: number;

  @ApiProperty({ example: 'Carlos Blanco' })
  nombre: string;

  @ApiProperty({ example: 'carlos.blanco@cajalosandes.cl' })
  email: string;

  @ApiProperty({
    example: 'ACTUALIZAR',
    enum: ['CREAR', 'ACTUALIZAR', 'SIN_CAMBIOS', 'IGNORADA', 'ERROR'],
  })
  accion: string;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'Por qué se ignoró o qué está mal escrito.',
  })
  motivo: string | null;

  @ApiProperty({ type: [CambioPlanillaDto] })
  cambios: CambioPlanillaDto[];
}

export class ResultadoPlanillaDto {
  @ApiProperty({
    example: false,
    description: 'false = vista previa, no se escribió nada.',
  })
  aplicado: boolean;

  @ApiProperty({ example: 50 })
  totalFilas: number;

  @ApiProperty({ example: 12, description: 'Fichas que se crearían o crearon.' })
  aCrear: number;

  @ApiProperty({ example: 31, description: 'Fichas que se actualizarían o actualizaron.' })
  aActualizar: number;

  @ApiProperty({ example: 4, description: 'Filas idénticas a lo que ya hay.' })
  sinCambios: number;

  @ApiProperty({ example: 2, description: 'Filas de gente que no existe en Retool.' })
  ignoradas: number;

  @ApiProperty({ example: 1, description: 'Filas con algún dato mal escrito.' })
  conError: number;

  @ApiProperty({ type: [FilaPlanillaDto] })
  filas: FilaPlanillaDto[];
}
