import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Valores que acepta el nivel jerárquico. El front los pinta como Select. */
export const NIVELES_JERARQUICOS = [
  'ANALISTA',
  'SUPERVISOR',
  'SUBGERENCIA',
  'GERENCIA_NEGOCIO',
  'GERENCIA_GENERAL',
] as const;

export const TIPOS_USUARIO = ['ADMINISTRADOR', 'COLABORADOR'] as const;

/**
 * Retool envía siempre todos los campos del formulario, y los que el usuario
 * dejó vacíos llegan como cadena vacía. Guardar '' dejaría en la base un valor
 * que no significa nada; null expresa "sin dato" y además permite vaciar un
 * campo que antes tenía valor.
 */
const vacioComoNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

/** Un tipo de cuenta vacío cae al valor por defecto en vez de fallar. */
const tipoPorDefecto = ({ value }: { value: unknown }) =>
  value === '' || value === null || value === undefined ? 'COLABORADOR' : value;

export class GuardarUsuarioWorkflowDto {
  @ApiProperty({
    example: 'user_76e843311993457ab70a351f4738cf2d',
    description: 'Id del usuario en Retool (GET /api/v2/users → data[].id).',
  })
  @IsString()
  @MaxLength(100)
  retoolUserId: string;

  @ApiProperty({
    example: 'ext_kevin.torrez@cajalosandes.cl',
    description: 'Correo del usuario en Retool. Se usa como llave de respaldo.',
  })
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiPropertyOptional({ example: '15.432.678-9' })
  @Transform(vacioComoNull)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(20)
  rut?: string | null;

  @ApiPropertyOptional({ enum: NIVELES_JERARQUICOS })
  @Transform(vacioComoNull)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(NIVELES_JERARQUICOS as unknown as string[])
  nivelJerarquico?: string | null;

  @ApiPropertyOptional({
    example: 24,
    description: 'Horas de SLA máximo para las tareas de este usuario.',
  })
  @Transform(vacioComoNull)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(720)
  plazoSlaHoras?: number | null;

  @ApiPropertyOptional({ example: '👤' })
  @Transform(vacioComoNull)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(20)
  icono?: string | null;

  @ApiPropertyOptional()
  @Transform(vacioComoNull)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  observaciones?: string | null;

  @ApiPropertyOptional({ enum: TIPOS_USUARIO, default: 'COLABORADOR' })
  @Transform(tipoPorDefecto)
  @IsOptional()
  @IsIn(TIPOS_USUARIO as unknown as string[])
  tipoUsuario?: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'Habilitado en el Workflow. Es independiente de si el usuario está activo en Retool.',
  })
  @IsOptional()
  @IsBoolean()
  habilitado?: boolean;

  @ApiPropertyOptional({
    description: 'Perfil de permisos a asignar. Vacío o null deja al usuario sin perfil.',
  })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined || value === 0
      ? null
      : Number(value),
  )
  @IsOptional()
  perfilId?: number | null;
}

/** Lo que el front necesita para pintar una fila, ya resuelto. */
export class UsuarioWorkflowDto {
  @ApiProperty() retoolUserId: string;
  @ApiProperty() email: string;

  @ApiProperty({ nullable: true }) rut: string | null;
  @ApiProperty({ nullable: true }) nivelJerarquico: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'Etiqueta legible del nivel — "Gerencia de Negocio", no "GERENCIA_NEGOCIO".',
  })
  nivelJerarquicoEtiqueta: string | null;

  @ApiProperty({ nullable: true }) plazoSlaHoras: number | null;
  @ApiProperty({ nullable: true, description: 'Ej: "24 horas".' })
  plazoSlaEtiqueta: string | null;

  @ApiProperty({ nullable: true }) icono: string | null;
  @ApiProperty({ nullable: true }) observaciones: string | null;

  @ApiProperty({ enum: TIPOS_USUARIO }) tipoUsuario: string;
  @ApiProperty({
    description: 'Color del badge de tipo, resuelto en el servidor.',
  })
  tipoUsuarioColor: string;

  @ApiProperty() habilitado: boolean;

  @ApiProperty({ nullable: true }) perfilId: number | null;
  @ApiProperty({ nullable: true, description: 'Nombre del perfil, resuelto en el servidor.' })
  perfilNombre: string | null;

  @ApiProperty({
    description:
      'false cuando el usuario existe en Retool pero todavía no tiene ficha en el Workflow.',
  })
  configurado: boolean;

  @ApiProperty({ nullable: true }) actualizadoEn: Date | null;
}

/**
 * Retool no puede mandar una lista anidada dentro de un campo del cuerpo sin
 * desordenar los demás campos —los valores terminan corridos una posición—, así
 * que viaja como texto JSON. Mismo criterio que los permisos de un perfil: se
 * parsea antes de validar, y si viene mal formado se deja pasar como está para
 * que el validador devuelva un error claro en vez de reventar.
 */
const textoComoLista = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const limpio = value.trim();
  if (limpio === '') return [];
  try {
    const datos: unknown = JSON.parse(limpio);
    return Array.isArray(datos) ? datos : value;
  } catch {
    return value;
  }
};

/** Cada persona a la que se le aplicará el perfil. */
export class UsuarioParaPerfilDto {
  @ApiProperty({ example: 'user_76e843311993457ab70a351f4738cf2d' })
  @IsString()
  @MaxLength(100)
  retoolUserId: string;

  @ApiProperty({ example: 'persona@cajalosandes.cl' })
  @IsEmail()
  @MaxLength(150)
  email: string;
}

/**
 * Con @Transform presente, class-transformer ya no aplica @Type: los
 * elementos llegarían como objetos planos y el validador rechazaría cada
 * propiedad ("property nombre should not exist"). Por eso las instancias se
 * construyen aquí mismo.
 */
const textoComoUsuarios = ({ value }: { value: unknown }) => {
  const datos = textoComoLista({ value });
  return Array.isArray(datos) ? plainToInstance(UsuarioParaPerfilDto, datos) : datos;
};

/**
 * Asignación masiva: el mismo perfil para varias personas.
 *
 * Existe para no disparar una llamada por usuario desde la pantalla: con 49
 * usuarios serían 49 viajes, y un error a medio camino dejaría la asignación
 * hecha a medias sin que nadie sepa dónde quedó.
 */
export class AsignarPerfilMasivoDto {
  @ApiProperty({ type: [UsuarioParaPerfilDto] })
  @Transform(textoComoUsuarios)
  @ValidateNested({ each: true })
  @Type(() => UsuarioParaPerfilDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  usuarios: UsuarioParaPerfilDto[];

  @ApiPropertyOptional({
    example: 3,
    nullable: true,
    description:
      'Perfil a aplicar. Vacío o null deja a las personas sin perfil.',
  })
  @Transform(vacioComoNull)
  @IsOptional()
  @IsInt()
  perfilId?: number | null;
}

/** Por qué una persona quedó fuera de la asignación. */
export class OmitidoAsignacionDto {
  @ApiProperty({ example: 'persona@cajalosandes.cl' })
  email: string;

  @ApiProperty({ example: 'Es administrador: ya accede a todo el sistema.' })
  motivo: string;
}

export class ResultadoAsignacionMasivaDto {
  @ApiProperty({
    example: 6,
    description: 'Cuántas personas quedaron con el perfil.',
  })
  asignados: number;

  @ApiProperty({
    type: [OmitidoAsignacionDto],
    description: 'Quiénes no lo recibieron y por qué.',
  })
  omitidos: OmitidoAsignacionDto[];

  @ApiProperty({ nullable: true, example: 'Aprobador' })
  perfilNombre: string | null;
}
