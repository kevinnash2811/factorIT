import * as ExcelJS from 'exceljs';
import {
  ETIQUETAS_NIVEL,
  NIVELES,
  PALABRA_BORRAR,
  PLAZOS_SLA_HORAS,
  TIPOS_CUENTA,
  codigoDeOpcion,
  etiquetasDe,
  normalizar,
} from './catalogos-ficha';
import { ENCABEZADOS, NOMBRE_HOJA } from './exportacion-usuarios.util';

/**
 * Lectura y evaluación de la planilla de fichas.
 *
 * Todo lo que hay aquí es puro: recibe el archivo y el estado actual, y
 * devuelve qué pasaría con cada fila. Escribir en la base es trabajo del
 * servicio. Esa separación es la que permite ofrecer el "previsualizar antes
 * de confirmar" sin duplicar las reglas: la vista previa y la aplicación
 * ejecutan exactamente el mismo código.
 */

export const TOPE_FILAS = 2000;

export type AccionFila =
  | 'CREAR'
  | 'ACTUALIZAR'
  | 'SIN_CAMBIOS'
  | 'IGNORADA'
  | 'ERROR';

export interface UsuarioRetool {
  retoolUserId: string;
  email: string;
  nombre: string;
}

export interface FichaActual {
  retoolUserId: string;
  email: string;
  rut: string | null;
  nivelJerarquico: string | null;
  plazoSlaHoras: number | null;
  tipoUsuario: string;
  perfilId: number | null;
  habilitado: boolean;
  icono: string | null;
  observaciones: string | null;
}

/** Lo que se escribiría en la ficha. `undefined` = no tocar ese campo. */
export interface ValoresFicha {
  rut?: string | null;
  nivelJerarquico?: string | null;
  plazoSlaHoras?: number | null;
  perfilId?: number | null;
  habilitado?: boolean;
  icono?: string | null;
  observaciones?: string | null;
}

export interface Cambio {
  campo: string;
  antes: string;
  despues: string;
}

export interface FilaEvaluada {
  fila: number;
  nombre: string;
  email: string;
  retoolUserId: string | null;
  accion: AccionFila;
  motivo: string | null;
  cambios: Cambio[];
  valores: ValoresFicha;
}

export interface FilaCruda {
  fila: number;
  celdas: Record<string, string>;
}

/** Texto plano de una celda, sea cual sea la forma en que Excel la guardó. */
function comoTexto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor);
  }
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    const objeto = valor as unknown as Record<string, unknown>;
    if ('text' in objeto && typeof objeto.text === 'string') {
      return objeto.text.trim();
    }
    if ('result' in objeto) return comoTexto(objeto.result as ExcelJS.CellValue);
    if ('richText' in objeto && Array.isArray(objeto.richText)) {
      return objeto.richText
        .map((t: { text?: string }) => t.text ?? '')
        .join('')
        .trim();
    }
  }
  return String(valor).trim();
}

/**
 * Lee la planilla. Las columnas se ubican por su encabezado, no por su
 * posición: así el usuario puede reordenarlas o intercalar columnas propias
 * sin romper la importación.
 */
export async function leerPlanilla(
  archivo: Buffer,
): Promise<{ filas: FilaCruda[]; error: string | null }> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(archivo as unknown as ArrayBuffer);
  } catch {
    return {
      filas: [],
      error:
        'No se pudo leer el archivo. Asegúrate de subir el mismo Excel que descargaste (.xlsx).',
    };
  }

  const hoja =
    libro.getWorksheet(NOMBRE_HOJA) ??
    libro.worksheets.find((h) => h.state !== 'hidden') ??
    libro.worksheets[0];
  if (!hoja) {
    return { filas: [], error: 'El archivo no tiene ninguna hoja con datos.' };
  }

  const encabezados = new Map<string, number>();
  hoja.getRow(1).eachCell((celda, columna) => {
    const texto = normalizar(comoTexto(celda.value));
    if (texto && !encabezados.has(texto)) encabezados.set(texto, columna);
  });

  const columnaDe = (encabezado: string): number | undefined =>
    encabezados.get(normalizar(encabezado));

  if (!columnaDe('ID Retool') && !columnaDe('Correo')) {
    return {
      filas: [],
      error:
        'El archivo no tiene las columnas de la plantilla. Descarga la planilla desde el botón Exportar y edita esa.',
    };
  }

  const filas: FilaCruda[] = [];
  for (let n = 2; n <= hoja.rowCount && filas.length < TOPE_FILAS; n++) {
    const fila = hoja.getRow(n);
    const celdas: Record<string, string> = {};
    let tieneAlgo = false;

    for (const encabezado of ENCABEZADOS) {
      const columna = columnaDe(encabezado);
      const texto = columna ? comoTexto(fila.getCell(columna).value) : '';
      celdas[encabezado] = texto;
      if (texto) tieneAlgo = true;
    }

    if (tieneAlgo) filas.push({ fila: n, celdas });
  }

  return { filas, error: null };
}

const vacio = (texto: string): boolean => texto.trim() === '';
const esBorrar = (texto: string): boolean =>
  normalizar(texto) === normalizar(PALABRA_BORRAR);

/** Sí/No en cualquiera de las formas en que la gente lo escribe. */
function comoBooleano(texto: string): boolean | null {
  const t = normalizar(texto);
  if (['si', 'sí', 'true', 'verdadero', '1', 'x'].includes(t)) return true;
  if (['no', 'false', 'falso', '0'].includes(t)) return false;
  return null;
}

export interface ContextoEvaluacion {
  /** Usuarios que existen en Retool, por id y por correo normalizado. */
  porId: Map<string, UsuarioRetool>;
  porEmail: Map<string, UsuarioRetool>;
  /** Fichas que ya existen, por id de Retool. */
  fichas: Map<string, FichaActual>;
  /** Perfiles de permiso: nombre normalizado -> id, e id -> nombre. */
  perfilPorNombre: Map<string, number>;
  nombrePorPerfil: Map<number, string>;
}

/**
 * Decide qué pasaría con una fila. No escribe nada: devuelve la acción, el
 * motivo cuando no se puede hacer, y el detalle de cada cambio para que el
 * usuario lo revise antes de confirmar.
 */
export function evaluarFila(
  cruda: FilaCruda,
  contexto: ContextoEvaluacion,
): FilaEvaluada {
  const celda = (encabezado: string): string =>
    (cruda.celdas[encabezado] ?? '').trim();

  const idExcel = celda('ID Retool');
  const emailExcel = celda('Correo');

  const base: FilaEvaluada = {
    fila: cruda.fila,
    nombre: celda('Nombre') || emailExcel || idExcel,
    email: emailExcel,
    retoolUserId: idExcel || null,
    accion: 'IGNORADA',
    motivo: null,
    cambios: [],
    valores: {},
  };

  const usuario =
    (idExcel ? contexto.porId.get(idExcel) : undefined) ??
    (emailExcel ? contexto.porEmail.get(normalizar(emailExcel)) : undefined);

  if (!usuario) {
    return {
      ...base,
      motivo:
        'No existe en la lista de usuarios de Retool. Primero hay que crearlo en Retool.',
    };
  }

  base.retoolUserId = usuario.retoolUserId;
  base.nombre = usuario.nombre || base.nombre;
  base.email = usuario.email;

  const ficha = contexto.fichas.get(usuario.retoolUserId);
  const valores: ValoresFicha = {};
  const cambios: Cambio[] = [];
  const errores: string[] = [];

  const anotar = (campo: string, antes: unknown, despues: unknown): void => {
    const texto = (v: unknown): string =>
      v === null || v === undefined || v === '' ? '—' : String(v);
    if (texto(antes) !== texto(despues)) {
      cambios.push({ campo, antes: texto(antes), despues: texto(despues) });
    }
  };

  // --- RUT ---
  const rut = celda('RUT');
  if (!vacio(rut)) {
    if (esBorrar(rut)) {
      valores.rut = null;
      anotar('RUT', ficha?.rut, null);
    } else if (!/^[0-9.\-kK]{6,20}$/.test(rut)) {
      errores.push(`RUT con formato inválido: "${rut}"`);
    } else {
      valores.rut = rut;
      anotar('RUT', ficha?.rut, rut);
    }
  }

  // --- Nivel jerárquico ---
  const nivel = celda('Nivel jerárquico');
  if (!vacio(nivel)) {
    if (esBorrar(nivel)) {
      valores.nivelJerarquico = null;
      anotar('Nivel jerárquico', etiquetaNivel(ficha?.nivelJerarquico), null);
    } else {
      const codigo = codigoDeOpcion(NIVELES, nivel);
      if (!codigo) {
        errores.push(
          `Nivel jerárquico "${nivel}" no existe. Valores válidos: ${etiquetasDe(NIVELES)}.`,
        );
      } else {
        valores.nivelJerarquico = codigo;
        anotar(
          'Nivel jerárquico',
          etiquetaNivel(ficha?.nivelJerarquico),
          etiquetaNivel(codigo),
        );
      }
    }
  }

  // --- Plazo SLA ---
  const sla = celda('Plazo SLA (horas)');
  if (!vacio(sla)) {
    if (esBorrar(sla)) {
      valores.plazoSlaHoras = null;
      anotar('Plazo SLA', ficha?.plazoSlaHoras, null);
    } else {
      const horas = Number(sla.replace(/[^\d]/g, ''));
      if (!PLAZOS_SLA_HORAS.includes(horas)) {
        errores.push(
          `Plazo SLA "${sla}" no es válido. Valores permitidos: ${PLAZOS_SLA_HORAS.join(', ')}.`,
        );
      } else {
        valores.plazoSlaHoras = horas;
        anotar('Plazo SLA', ficha?.plazoSlaHoras, horas);
      }
    }
  }

  // --- Tipo de cuenta ---
  //
  // La columna viene solo para dar contexto: el tipo de cuenta no se cambia
  // desde una planilla, ni hacia arriba ni hacia abajo. Ascender a alguien es
  // darle acceso a todo sin perfil, y degradar a un administrador puede dejar
  // el sistema sin quien lo administre; las dos cosas se hacen a conciencia,
  // persona por persona, desde la pantalla. Si el valor no coincide con el
  // actual se rechaza la fila, para que nadie crea que su cambio se aplicó.
  const tipo = celda('Tipo de cuenta');
  if (!vacio(tipo) && !esBorrar(tipo)) {
    const codigo = codigoDeOpcion(TIPOS_CUENTA, tipo);
    const actual = ficha?.tipoUsuario ?? 'COLABORADOR';
    if (!codigo) {
      errores.push(
        `Tipo de cuenta "${tipo}" no existe. Valores válidos: ${etiquetasDe(TIPOS_CUENTA)}.`,
      );
    } else if (codigo !== actual) {
      errores.push(
        `El tipo de cuenta no se cambia desde el Excel: esta persona es ${etiquetaTipo(actual)}. ` +
          'Cámbialo desde la pantalla, con el botón Editar de su fila.',
      );
    }
  }

  // --- Perfil de permisos ---
  const perfil = celda('Perfil de permisos');
  if (!vacio(perfil)) {
    const nombreActual = ficha?.perfilId
      ? (contexto.nombrePorPerfil.get(ficha.perfilId) ?? null)
      : null;
    if (esBorrar(perfil)) {
      valores.perfilId = null;
      anotar('Perfil de permisos', nombreActual, null);
    } else {
      const id = contexto.perfilPorNombre.get(normalizar(perfil));
      if (id === undefined) {
        const disponibles = [...contexto.nombrePorPerfil.values()];
        errores.push(
          `El perfil "${perfil}" no existe. Perfiles disponibles: ${
            disponibles.length ? disponibles.join(', ') : 'todavía no hay ninguno creado'
          }.`,
        );
      } else {
        valores.perfilId = id;
        anotar(
          'Perfil de permisos',
          nombreActual,
          contexto.nombrePorPerfil.get(id),
        );
      }
    }
  }

  // --- Habilitado ---
  const habilitado = celda('Habilitado en Workflow');
  if (!vacio(habilitado)) {
    const valor = comoBooleano(habilitado);
    if (valor === null) {
      errores.push(
        `"${habilitado}" no se entiende en Habilitado en Workflow. Escribe Sí o No.`,
      );
    } else {
      valores.habilitado = valor;
      anotar(
        'Habilitado en Workflow',
        ficha ? (ficha.habilitado ? 'Sí' : 'No') : null,
        valor ? 'Sí' : 'No',
      );
    }
  }

  // --- Icono ---
  const icono = celda('Icono');
  if (!vacio(icono)) {
    if (esBorrar(icono)) {
      valores.icono = null;
      anotar('Icono', ficha?.icono, null);
    } else if ([...icono].length > 4) {
      errores.push('El icono debe ser un solo símbolo o emoji.');
    } else {
      valores.icono = icono;
      anotar('Icono', ficha?.icono, icono);
    }
  }

  // --- Observaciones ---
  const observaciones = celda('Observaciones');
  if (!vacio(observaciones)) {
    if (esBorrar(observaciones)) {
      valores.observaciones = null;
      anotar('Observaciones', ficha?.observaciones, null);
    } else {
      valores.observaciones = observaciones;
      anotar('Observaciones', ficha?.observaciones, observaciones);
    }
  }

  if (errores.length) {
    return { ...base, accion: 'ERROR', motivo: errores.join(' '), cambios: [] };
  }

  if (!cambios.length) {
    return {
      ...base,
      accion: 'SIN_CAMBIOS',
      motivo: ficha
        ? null
        : 'La fila no trae ningún dato que completar, así que no se crea la ficha.',
    };
  }

  return {
    ...base,
    accion: ficha ? 'ACTUALIZAR' : 'CREAR',
    motivo: null,
    cambios,
    valores,
  };
}

function etiquetaNivel(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  return ETIQUETAS_NIVEL[codigo] ?? codigo;
}

function etiquetaTipo(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  const opcion = TIPOS_CUENTA.find((t) => t.codigo === codigo);
  return opcion ? opcion.etiqueta : codigo;
}

/**
 * Marca como error las filas repetidas. Dos filas para la misma persona
 * significan que alguien copió y pegó mal: aplicar las dos dejaría el
 * resultado a merced del orden, así que se aplica la primera y se avisa.
 */
export function marcarRepetidas(filas: FilaEvaluada[]): FilaEvaluada[] {
  const vistos = new Set<string>();
  return filas.map((f) => {
    if (!f.retoolUserId || f.accion === 'IGNORADA' || f.accion === 'ERROR') {
      return f;
    }
    if (vistos.has(f.retoolUserId)) {
      return {
        ...f,
        accion: 'ERROR',
        motivo: 'La persona aparece en más de una fila del archivo.',
        cambios: [],
      };
    }
    vistos.add(f.retoolUserId);
    return f;
  });
}

/**
 * Impide que una planilla deje al sistema sin ningún administrador habilitado.
 *
 * Un Excel puede degradar o deshabilitar a varias personas de una vez, y el
 * administrador es el único que entra sin perfil: si la planilla se lleva al
 * último, nadie puede volver a entrar a arreglarlo. Cuando eso pasaría, se
 * rechazan solo las filas responsables y el resto se aplica igual.
 */
export function protegerAdministradores(
  filas: FilaEvaluada[],
  fichas: Map<string, FichaActual>,
): FilaEvaluada[] {
  const habilitados = [...fichas.values()].filter(
    (f) => f.tipoUsuario === 'ADMINISTRADOR' && f.habilitado,
  );
  if (habilitados.length === 0) return filas;

  const quedarian = new Set(habilitados.map((a) => a.retoolUserId));
  const responsables = new Set<number>();

  for (const f of filas) {
    if (f.accion !== 'ACTUALIZAR' || !f.retoolUserId) continue;
    if (!quedarian.has(f.retoolUserId)) continue;

    // El tipo de cuenta no se toca desde el Excel, así que la única forma de
    // perder un administrador por planilla es deshabilitándolo.
    if (f.valores.habilitado === false) {
      quedarian.delete(f.retoolUserId);
      responsables.add(f.fila);
    }
  }

  if (quedarian.size > 0) return filas;

  return filas.map((f) =>
    responsables.has(f.fila)
      ? {
          ...f,
          accion: 'ERROR' as AccionFila,
          motivo:
            'Con este cambio el sistema se quedaría sin ningún administrador habilitado. Deja al menos uno.',
          cambios: [],
        }
      : f,
  );
}
