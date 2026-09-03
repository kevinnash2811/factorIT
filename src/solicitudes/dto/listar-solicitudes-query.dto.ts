import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * El Select de "Todos los Estados" / "Todas las Sociedades" en Retool manda
 * un valor vacío cuando el usuario quiere quitar el filtro, no ausencia del
 * parámetro. @IsOptional() de class-validator sólo omite la validación si el
 * valor es undefined — "" (o " ", que es lo que guarda el editor de opciones
 * de Retool cuando no permite un Value realmente vacío) la sigue disparando
 * y @IsIn la rechaza con 400.
 *
 * Peor todavía: un Select que nunca fue tocado interpola su `.value` en la URL
 * como el texto literal "undefined" (4 caracteres), no como parámetro ausente.
 * Este transform trata los tres casos —vacío, "undefined" y "null"— como si no
 * se hubiera mandado nada.
 */
const vacioComoIndefinido = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const limpio = value.trim();
  return limpio === '' || limpio === 'undefined' || limpio === 'null' ? undefined : value;
};

/**
 * Los NumberInput de Retool mandan 0 cuando el usuario los deja vacíos. Un
 * tope máximo de $0 no es un filtro que alguien quiera de verdad (dejaría la
 * lista sin resultados), así que 0 se trata como "sin filtro" igual que un
 * valor ausente.
 */
const montoVacioComoIndefinido = ({ value }: { value: unknown }) => {
  const limpio = vacioComoIndefinido({ value });
  if (limpio === undefined || limpio === null) return undefined;
  const numero = Number(limpio);
  return Number.isNaN(numero) || numero === 0 ? undefined : numero;
};

export class ListarSolicitudesQueryDto {
  @ApiPropertyOptional({
    enum: ['PENDIENTE_APROBACION', 'APROBADO_CONTABILIZAR', 'EN_REPARO', 'INTEGRADO_SAP', 'ERROR_SAP', 'RECHAZADO_CERRADO'],
  })
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsIn(['PENDIENTE_APROBACION', 'APROBADO_CONTABILIZAR', 'EN_REPARO', 'INTEGRADO_SAP', 'ERROR_SAP', 'RECHAZADO_CERRADO'])
  estado?: string;

  @ApiPropertyOptional({ enum: ['1000', '6000', '8000'] })
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsIn(['1000', '6000', '8000'])
  sociedad?: string;

  @ApiPropertyOptional({ example: 'R10' })
  @IsOptional()
  @IsString()
  ruta?: string;

  @ApiPropertyOptional({ description: 'Busca por ID, solicitante, factura o CECO', example: 'TKT-82' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: '2026-08-01', description: 'Filtra creadoEn >= esta fecha (inclusive).' })
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @ApiPropertyOptional({ example: '2026-08-31', description: 'Filtra creadoEn <= el final de este día (inclusive).' })
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @ApiPropertyOptional({ example: 50000 })
  @Transform(montoVacioComoIndefinido)
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoMin?: number;

  @ApiPropertyOptional({ example: 5000000 })
  @Transform(montoVacioComoIndefinido)
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoMax?: number;

  @ApiPropertyOptional({
    enum: ['CUMPLE', 'NO_CUMPLE'],
    description: 'CUMPLE: integrado a SAP, o activo dentro de plazo. NO_CUMPLE: activo y con el plazo de 2 días hábiles ya vencido.',
  })
  @Transform(vacioComoIndefinido)
  @IsOptional()
  @IsIn(['CUMPLE', 'NO_CUMPLE'])
  slaEstado?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 20;
}
