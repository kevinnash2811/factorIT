/**
 * Sociedades SAP y clases de documento válidas para una ruta contable.
 * Igual que bancos/mediosPago en CatalogosService: opciones fijas de
 * configuración, no filas de una tabla que alguien mantenga.
 */
export const SOCIEDADES: Record<string, { etiqueta: string; nombre: string }> = {
  '1000': { etiqueta: 'Sociedad 1000', nombre: 'Caja Los Andes' },
  '6000': { etiqueta: 'Sociedad 6000', nombre: 'Tapp' },
  '8000': { etiqueta: 'Sociedad 8000', nombre: 'CLA Turismo' },
};

export const CLASES_DOCUMENTO: Record<string, string> = {
  KA: 'Acreedor Gasto',
  SA: 'Asiento Manual',
  KR: 'Factura Acreedor',
};

export const CODIGOS_SOCIEDAD = Object.keys(SOCIEDADES);
export const CODIGOS_CLASE_DOCUMENTO = Object.keys(CLASES_DOCUMENTO);
