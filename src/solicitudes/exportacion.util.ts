/**
 * Generación de CSV para la exportación de la Bandeja.
 *
 * El detalle importante es que el archivo se abre en Excel con configuración
 * regional chilena: ahí el separador de lista es el punto y coma, y sin BOM
 * el programa interpreta el archivo como ANSI y parte las tildes. Por eso la
 * variante pensada para Excel lleva ambas cosas, y se deja otra con coma para
 * quien lo procese con otra herramienta.
 */

export type FormatoExportacion = 'xlsx' | 'csv' | 'csv-coma';

export const FORMATOS_EXPORTACION: FormatoExportacion[] = ['xlsx', 'csv', 'csv-coma'];

export function esFormatoValido(valor: string | undefined): valor is FormatoExportacion {
  return FORMATOS_EXPORTACION.includes((valor ?? '') as FormatoExportacion);
}

/** Caracteres con los que Excel y LibreOffice interpretan la celda como fórmula. */
const INICIOS_DE_FORMULA = ['=', '+', '-', '@'];

/**
 * Escapa una celda para CSV.
 *
 * Además de las comillas y los saltos de línea, antepone un apóstrofo a lo que
 * empiece como fórmula: un valor que llegue desde la base como "=1+1" no debe
 * ejecutarse al abrir el archivo (inyección de fórmulas).
 */
export function escaparCelda(valor: unknown, separador: string): string {
  if (valor === null || valor === undefined) return '';

  let texto = typeof valor === 'string' ? valor : String(valor);
  if (texto.length > 0 && INICIOS_DE_FORMULA.includes(texto[0])) {
    texto = `'${texto}`;
  }

  const necesitaComillas =
    texto.includes(separador) ||
    texto.includes('"') ||
    texto.includes('\n') ||
    texto.includes('\r');

  return necesitaComillas ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export interface OpcionesCsv {
  separador: string;
  /** Excel solo reconoce UTF-8 si el archivo empieza con la marca de orden de bytes. */
  conBom: boolean;
}

/** Opciones de cada formato, para no repetir el criterio en cada llamada. */
export function opcionesDe(formato: FormatoExportacion): OpcionesCsv {
  return formato === 'csv-coma'
    ? { separador: ',', conBom: false }
    : { separador: ';', conBom: true };
}

export function aCsv(
  encabezados: string[],
  filas: unknown[][],
  opciones: OpcionesCsv,
): string {
  const linea = (celdas: unknown[]) =>
    celdas.map((c) => escaparCelda(c, opciones.separador)).join(opciones.separador);

  // Fin de línea CRLF: es lo que espera Excel en Windows.
  const cuerpo = [linea(encabezados), ...filas.map(linea)].join('\r\n');
  return opciones.conBom ? `﻿${cuerpo}` : cuerpo;
}

export function tipoDeContenido(formato: FormatoExportacion): string {
  if (formato === 'xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  return 'text/csv; charset=utf-8';
}

export function extensionDe(formato: FormatoExportacion): string {
  return formato === 'xlsx' ? 'xlsx' : 'csv';
}
