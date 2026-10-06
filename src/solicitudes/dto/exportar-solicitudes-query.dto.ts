import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

import { FORMATOS_EXPORTACION } from '../exportacion.util';
import { ListarSolicitudesQueryDto } from './listar-solicitudes-query.dto';

/**
 * Los mismos filtros de la Bandeja, más el formato del archivo.
 *
 * Existe por una razón concreta: el ValidationPipe corre con
 * `forbidNonWhitelisted`, así que valida TODA la query contra el DTO del
 * parámetro y rechaza cualquier campo que no esté declarado. Mientras
 * `/exportar` reusaba el DTO del listado, `?formato=xlsx` devolvía 400 con
 * "property formato should not exist" — aunque el controlador lo leyera aparte
 * con un @Query('formato') propio. El parámetro tiene que estar declarado en el
 * DTO que valida la query, no solo en la firma del método.
 */
export class ExportarSolicitudesQueryDto extends ListarSolicitudesQueryDto {
  @ApiPropertyOptional({
    enum: FORMATOS_EXPORTACION,
    default: 'xlsx',
    description:
      'xlsx abre directo en Excel. csv usa punto y coma y BOM para que Excel ' +
      'respete columnas y tildes; csv-coma usa coma, para otras herramientas.',
  })
  @IsOptional()
  // Un Select de Retool que nunca fue tocado interpola el texto "undefined"
  // en la URL en vez de omitir el parámetro.
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const limpio = value.trim();
    return limpio === '' || limpio === 'undefined' || limpio === 'null'
      ? undefined
      : limpio;
  })
  @IsIn(FORMATOS_EXPORTACION)
  formato?: string;
}
