/**
 * Reglas para traer a este sistema un archivo elegido en Google Drive.
 *
 * Todo lo de acá es puro: decide qué URL hay que pedirle a Google y con qué
 * nombre guardar el resultado, sin tocar la red ni el disco. Así las reglas
 * —que son las que se equivocan— se prueban solas.
 *
 * La distinción que manda es entre archivos **subidos** y archivos **nativos**
 * de Google. Un PDF que alguien guardó en su Drive se descarga tal cual. Un
 * Google Doc, en cambio, no es un archivo: es un documento que vive en los
 * servidores de Google y hay que pedirle a Drive que lo convierta. Bajarlo sin
 * convertir devuelve un error, no un archivo corrupto, así que conviene
 * decidirlo antes de llamar.
 */

export interface ArchivoDrive {
  id: string;
  nombre: string;
  mimeType: string;
}

export interface PlanDeDescarga {
  /** URL de la API de Drive a la que hay que pedir el contenido. */
  url: string;
  /** Nombre con el que se guarda, ya con la extensión correcta. */
  nombre: string;
  /** Extensión final, para validar contra las permitidas. */
  extension: string;
  /** true si Google tuvo que convertirlo desde su formato nativo. */
  convertido: boolean;
}

const API = 'https://www.googleapis.com/drive/v3/files';

/** Documentos nativos de Google y el formato al que se convierten. */
const CONVERSIONES: Record<string, { mime: string; extension: string }> = {
  'application/vnd.google-apps.document': {
    mime: 'application/pdf',
    extension: '.pdf',
  },
  'application/vnd.google-apps.presentation': {
    mime: 'application/pdf',
    extension: '.pdf',
  },
  'application/vnd.google-apps.spreadsheet': {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
};

/** Extensión que corresponde a cada tipo de archivo subido que aceptamos. */
const EXTENSION_POR_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

export const EXTENSIONES_PERMITIDAS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.png',
  '.jpg',
  '.jpeg',
];

export const MAXIMO_ARCHIVOS = 5;
export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024;

export function esNativoDeGoogle(mimeType: string): boolean {
  return (mimeType || '').startsWith('application/vnd.google-apps.');
}

/** Quita del nombre lo que no puede ir en un nombre de archivo. */
export function nombreSeguro(nombre: string): string {
  return (nombre || 'documento')
    .replace(/[\r\n"\\/:*?<>|]/g, '')
    .replace(/\.{2,}/g, '.')
    .trim()
    .slice(0, 120) || 'documento';
}

/** La extensión que ya trae el nombre, en minúsculas ('' si no trae). */
function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf('.');
  return punto > 0 ? nombre.slice(punto).toLowerCase() : '';
}

/**
 * Decide cómo traer un archivo. Devuelve el plan o el motivo por el que no se
 * puede, en palabras que el usuario entienda: este mensaje se le muestra tal
 * cual, no se traduce después.
 */
export function planDeDescarga(
  archivo: ArchivoDrive,
): { plan: PlanDeDescarga } | { error: string } {
  const nombre = nombreSeguro(archivo.nombre);

  if (!archivo.id) {
    return { error: `No se pudo identificar el archivo "${nombre}" en Drive.` };
  }

  if (esNativoDeGoogle(archivo.mimeType)) {
    const conversion = CONVERSIONES[archivo.mimeType];
    if (!conversion) {
      return {
        error:
          `"${nombre}" es un tipo de documento de Google que no se puede adjuntar ` +
          '(por ejemplo un formulario o un dibujo). Descárgalo como PDF y súbelo desde tu computador.',
      };
    }
    const base = nombre.replace(/\.[^.]+$/, '');
    return {
      plan: {
        url:
          `${API}/${encodeURIComponent(archivo.id)}/export` +
          `?mimeType=${encodeURIComponent(conversion.mime)}`,
        nombre: base + conversion.extension,
        extension: conversion.extension,
        convertido: true,
      },
    };
  }

  // Archivo subido: se respeta la extensión del nombre y, si no trae, se
  // deduce del tipo que informa Drive.
  const extension = extensionDe(nombre) || EXTENSION_POR_MIME[archivo.mimeType] || '';
  if (!EXTENSIONES_PERMITIDAS.includes(extension)) {
    return {
      error:
        `"${nombre}" no es un tipo de archivo permitido. ` +
        `Se aceptan: ${EXTENSIONES_PERMITIDAS.join(', ')}.`,
    };
  }

  return {
    plan: {
      url: `${API}/${encodeURIComponent(archivo.id)}?alt=media`,
      nombre: extensionDe(nombre) ? nombre : nombre + extension,
      extension,
      convertido: false,
    },
  };
}

/** Revisa la selección completa antes de pedirle nada a Google. */
export function validarSeleccion(archivos: ArchivoDrive[]): string | null {
  if (!archivos.length) return 'No se eligió ningún archivo en Drive.';
  if (archivos.length > MAXIMO_ARCHIVOS) {
    return `Puedes adjuntar hasta ${MAXIMO_ARCHIVOS} archivos por solicitud.`;
  }
  return null;
}

/**
 * Reconoce un enlace de Google Drive y extrae el identificador del archivo.
 *
 * Existe para la alternativa de pegar la URL a mano. Sirve además como
 * validación: si no se reconoce el id, el enlace no es de un archivo de Drive
 * y avisarlo antes es mejor que guardarlo y que falle al abrirlo.
 */
export function idDesdeEnlace(enlace: string): string | null {
  const texto = (enlace || '').trim();
  if (!/^https:\/\/(drive|docs)\.google\.com\//i.test(texto)) return null;

  const patrones = [
    /\/d\/([a-zA-Z0-9_-]{10,})/, //  /file/d/<id>/view  ·  /document/d/<id>/edit
    /[?&]id=([a-zA-Z0-9_-]{10,})/, //  /open?id=<id>
  ];
  for (const patron of patrones) {
    const encontrado = texto.match(patron);
    if (encontrado) return encontrado[1];
  }
  return null;
}
