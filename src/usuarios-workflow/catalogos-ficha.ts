/**
 * Valores válidos de una ficha del Workflow, con su etiqueta en español.
 *
 * Viven en un solo lugar porque los usan tres partes que tienen que coincidir
 * exactamente: la respuesta de la API, la plantilla de Excel (que los ofrece
 * como lista desplegable) y el importador (que traduce de vuelta a código lo
 * que el usuario dejó escrito en la celda). Si cada una llevara su propia
 * copia, bastaría agregar un nivel jerárquico en un sitio para que el Excel
 * aceptara un valor que la base rechaza.
 */

export interface OpcionFicha {
  codigo: string;
  etiqueta: string;
}

export const NIVELES: OpcionFicha[] = [
  { codigo: 'ANALISTA', etiqueta: 'Analista' },
  { codigo: 'SUPERVISOR', etiqueta: 'Supervisor' },
  { codigo: 'SUBGERENCIA', etiqueta: 'Subgerencia' },
  { codigo: 'GERENCIA_NEGOCIO', etiqueta: 'Gerencia de Negocio' },
  { codigo: 'GERENCIA_GENERAL', etiqueta: 'Gerencia General' },
];

export const TIPOS_CUENTA: OpcionFicha[] = [
  { codigo: 'COLABORADOR', etiqueta: 'Colaborador' },
  { codigo: 'ADMINISTRADOR', etiqueta: 'Administrador' },
];

export const PLAZOS_SLA_HORAS = [24, 48, 72, 120];

export const ETIQUETAS_NIVEL: Record<string, string> = Object.fromEntries(
  NIVELES.map((n) => [n.codigo, n.etiqueta]),
);

/**
 * Palabra que se escribe en una celda para dejar el campo vacío.
 *
 * Una celda en blanco significa "no me metas con este dato", que es lo que
 * espera quien exporta, edita una sola columna y vuelve a importar. Sin esta
 * distinción, ese ida y vuelta borraría todo lo que el usuario no llenó.
 */
export const PALABRA_BORRAR = 'BORRAR';

/** Minúsculas, sin acentos y sin espacios de sobra, para comparar textos. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Traduce lo que hay en la celda al código que guarda la base. Acepta tanto
 * la etiqueta ("Gerencia de Negocio") como el código ("GERENCIA_NEGOCIO"),
 * porque un Excel que pasó por varias manos termina con las dos formas.
 */
export function codigoDeOpcion(
  opciones: OpcionFicha[],
  texto: string,
): string | null {
  const buscado = normalizar(texto);
  const opcion = opciones.find(
    (o) => normalizar(o.etiqueta) === buscado || normalizar(o.codigo) === buscado,
  );
  return opcion ? opcion.codigo : null;
}

/** Etiquetas separadas por coma, para los mensajes de error del importador. */
export function etiquetasDe(opciones: OpcionFicha[]): string {
  return opciones.map((o) => o.etiqueta).join(', ');
}
