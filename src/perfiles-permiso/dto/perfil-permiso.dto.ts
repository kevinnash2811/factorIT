import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { SeccionPortal } from '../secciones';

const vacioComoNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

/**
 * Retool no puede mandar un objeto anidado dentro de un campo del cuerpo sin
 * complicaciones, así que los permisos viajan como texto JSON. Aquí se parsea
 * antes de validar; si viene mal formado se deja pasar como está para que el
 * validador devuelva un error claro en vez de reventar.
 */
const textoComoObjeto = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const limpio = value.trim();
  if (limpio === '') return {};
  try {
    return JSON.parse(limpio);
  } catch {
    return value;
  }
};

export class GuardarPerfilPermisoDto {
  @ApiPropertyOptional({
    description: 'Solo al actualizar. Si viene vacío se crea un perfil nuevo.',
  })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : Number(value),
  )
  @IsOptional()
  perfilId?: number;

  @ApiProperty({ example: 'Analista Contable' })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  nombre: string;

  @ApiPropertyOptional({ example: 'Registra y repara solicitudes, sin aprobar' })
  @Transform(vacioComoNull)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  descripcion?: string | null;

  @ApiProperty({
    description:
      'Acciones por sección. Acepta objeto o texto JSON. Una sección presente ' +
      'significa que está activa; las claves y valores se validan contra el catálogo.',
    example: { bandeja: { ver: 'TODAS', aprobar: true } },
  })
  @Transform(textoComoObjeto)
  @IsObject({ message: 'permisos debe ser un objeto o un texto JSON válido' })
  permisos: Record<string, Record<string, unknown>>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/** Un permiso ya resuelto para pintarlo sin lógica en el front. */
export class AccionResueltaDto {
  @ApiProperty() clave: string;
  @ApiProperty() etiqueta: string;
  @ApiProperty() valor: string | boolean;
  @ApiProperty() etiquetaValor: string;
  @ApiProperty() sensible: boolean;
  @ApiProperty() activa: boolean;
}

export class SeccionResueltaDto {
  @ApiProperty() clave: string;
  @ApiProperty() etiqueta: string;
  @ApiProperty() icono: string;
  @ApiProperty() activa: boolean;
  @ApiProperty({ description: 'Cuántas acciones están habilitadas.' })
  accionesActivas: number;
  @ApiProperty() totalAcciones: number;
  @ApiProperty({ type: [AccionResueltaDto] }) acciones: AccionResueltaDto[];
}

export class PerfilPermisoDto {
  @ApiProperty() perfilId: number;
  @ApiProperty() nombre: string;
  @ApiProperty({ nullable: true }) descripcion: string | null;

  @ApiProperty({ isArray: true }) secciones: string[];
  @ApiProperty() permisos: Record<string, Record<string, unknown>>;

  @ApiProperty({
    isArray: true,
    description: 'Las secciones ya resueltas con su etiqueta e icono.',
  })
  seccionesDetalle: SeccionPortal[];

  @ApiProperty({
    type: [SeccionResueltaDto],
    description: 'Todo el catálogo con los valores de este perfil aplicados.',
  })
  detalle: SeccionResueltaDto[];

  @ApiProperty({ description: 'Ej: "4 de 7 secciones".' })
  resumenSecciones: string;

  @ApiProperty({ description: 'Cuántos permisos sensibles concede este perfil.' })
  permisosSensibles: number;

  @ApiProperty() activo: boolean;
  @ApiProperty({ description: 'Cuántos colaboradores tienen este perfil.' })
  colaboradores: number;
  @ApiProperty({ nullable: true }) actualizadoEn: Date | null;
}
