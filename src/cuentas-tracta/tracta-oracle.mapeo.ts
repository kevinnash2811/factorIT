import { CuentaTractaItemDto } from './dto/cuenta-tracta.dto';

/** Tabla real en Menú Andes. */
export const TABLA_TRACTA = '"OPS$ANDES"."ERP_TRACTA"';

/** Secuencia con la que Oracle Forms numera las reglas nuevas. */
export const SECUENCIA_TRACTA = '"OPS$ANDES"."ERP_TCT_SEC"';

export const ESTADO_ACTIVO = '1';
export const ESTADO_INACTIVO = '0';

/** Tipos de cuenta SAP que usan las reglas: S mayor, K acreedor, D deudor. */
export const TIPOS_CUENTA_TRACTA = ['S', 'K', 'D'] as const;

/** Solo las columnas que muestra la pantalla: la tabla tiene 43. */
export const COLUMNAS_TRACTA = [
  'TCT_SECUENCIA',
  'ERP_EMPRESA',
  'SIS_SISTEMA',
  'TCT_TRANSACCION',
  'TCT_GLOSA_TRANS',
  'TCT_USA_MAY_AUX',
  'TCT_CLASE_CUENTA',
  'TCT_CUENTA_SAP',
  'TCT_CTA_AUX',
  'TCT_CONTRA_CTA',
  'TCT_CENTRO_BENEF',
  'CEN_NUMCEN',
  'TCT_VAL_UNI',
  'TCT_ESTADO',
].join(', ');

/** Campos en los que busca el filtro de texto de la pantalla. */
const CAMPOS_BUSQUEDA = [
  'TCT_GLOSA_TRANS',
  'TCT_TRANSACCION',
  'TCT_CUENTA_SAP',
  'TCT_CTA_AUX',
  'CEN_NUMCEN',
];

/**
 * Carácter de escape para LIKE. Es "!" y no la barra invertida para que el
 * SQL no dependa de cómo interpreta las barras cada capa por la que pasa.
 */
const ESCAPE_LIKE = '!';

export interface FilaTractaOracle {
  TCT_SECUENCIA: number;
  ERP_EMPRESA: string;
  SIS_SISTEMA: string;
  TCT_TRANSACCION: string | null;
  TCT_GLOSA_TRANS: string | null;
  TCT_USA_MAY_AUX: string | null;
  TCT_CLASE_CUENTA: string | null;
  TCT_CUENTA_SAP: string | null;
  TCT_CTA_AUX: string | null;
  TCT_CONTRA_CTA: string | null;
  TCT_CENTRO_BENEF: string | null;
  CEN_NUMCEN: string | null;
  TCT_VAL_UNI: number | null;
  TCT_ESTADO: string | null;
}

export interface FiltrosTracta {
  sociedad?: string;
  sistema?: string;
  q?: string;
}

/** Lo que identifica una regla: dos activas con la misma clave serían ambiguas. */
export interface ClaveTracta {
  empresa: string;
  sistema: string;
  transaccion: string;
}

/** Valores de una regla listos para escribir en Oracle. */
export interface DatosCuentaTracta extends ClaveTracta {
  glosa: string;
  tipoCuenta: string;
  claseDocumento: string;
  cuentaSap: string;
  ctaAux: string | null;
  contraCta: string | null;
  centroBeneficio: string | null;
  centroCosto: string | null;
  valorUnitario: number | null;
}

/** Campos que recibe la API, con los nombres que ya usa Retool. */
export interface EntradaCuentaTracta {
  erpEmpresa: string;
  sisSistema: string;
  tctTransaccion: string;
  tctGlosaTrans: string;
  tctClaseCuenta: string;
  parTipodocCaja: string;
  tctCuentaSap: string;
  tctCtaAux?: string;
  tctContraCta?: string;
  tctCentroBenef?: string;
  cenNumcen?: string;
  tctValUni?: number;
}

/**
 * Activa = '1'. La contabilización busca la regla con
 * TCT_ESTADO = '1' OR TCT_ESTADO IS NULL, así que NULL también es activa, y
 * hay una fila heredada con 'A'. Inactiva = '0'.
 */
export function estaActiva(estado: string | null): boolean {
  return estado === null || estado === ESTADO_ACTIVO || estado === 'A';
}

export function mapearFilaOracle(fila: FilaTractaOracle): CuentaTractaItemDto {
  const activa = estaActiva(fila.TCT_ESTADO);
  return {
    sec: fila.TCT_SECUENCIA,
    emp: fila.ERP_EMPRESA,
    sis: fila.SIS_SISTEMA,
    transaccion: fila.TCT_TRANSACCION ?? '',
    glosa: fila.TCT_GLOSA_TRANS ?? '',
    // En Oracle el tipo de cuenta (S/K) está en TCT_USA_MAY_AUX y el tipo de
    // documento (ZK, ZA, KA…) en TCT_CLASE_CUENTA, a pesar de los nombres.
    tCta: fila.TCT_USA_MAY_AUX ?? '',
    ctaMayorSap: fila.TCT_CUENTA_SAP ?? '',
    ctaAuxiliarSap: fila.TCT_CTA_AUX,
    contraCtaSap: fila.TCT_CONTRA_CTA,
    tDoc: fila.TCT_CLASE_CUENTA ?? '',
    cebeSap: fila.TCT_CENTRO_BENEF,
    cencosSap: fila.CEN_NUMCEN,
    valU: fila.TCT_VAL_UNI,
    estadoEtiqueta: activa ? 'ACTIVO' : 'INACTIVO',
    estadoColor: activa ? '#10b981' : '#64748b',
    // Retool muestra los botones según esta lista.
    acciones: activa ? ['editar', 'eliminar'] : ['reactivar'],
  };
}

/**
 * Traduce los campos de la API a las columnas reales. Los nombres vienen de la
 * tabla provisional de Postgres y dos quedaron cruzados respecto de Oracle:
 * tctClaseCuenta es el tipo de cuenta (TCT_USA_MAY_AUX) y parTipodocCaja la
 * clase de documento (TCT_CLASE_CUENTA).
 */
export function aDatosOracle(
  entrada: EntradaCuentaTracta,
  valorUnitarioPorDefecto: number | null,
): DatosCuentaTracta {
  return {
    empresa: entrada.erpEmpresa,
    sistema: entrada.sisSistema,
    transaccion: entrada.tctTransaccion,
    glosa: entrada.tctGlosaTrans,
    tipoCuenta: entrada.tctClaseCuenta,
    claseDocumento: entrada.parTipodocCaja,
    cuentaSap: entrada.tctCuentaSap,
    ctaAux: vacioANulo(entrada.tctCtaAux),
    contraCta: vacioANulo(entrada.tctContraCta),
    centroBeneficio: vacioANulo(entrada.tctCentroBenef),
    centroCosto: vacioANulo(entrada.cenNumcen),
    valorUnitario: entrada.tctValUni ?? valorUnitarioPorDefecto,
  };
}

/** Oracle guarda '' como NULL: se deja explícito para que el mapeo sea predecible. */
function vacioANulo(valor?: string): string | null {
  return valor === undefined || valor.trim() === '' ? null : valor;
}

/** Escapa los comodines de LIKE y el propio carácter de escape, para buscar literal. */
export function escaparLike(texto: string): string {
  return texto.replace(/[!%_]/g, (caracter) => ESCAPE_LIKE + caracter);
}

export function construirFiltro(filtros: FiltrosTracta): {
  where: string;
  binds: Record<string, string>;
} {
  const condiciones: string[] = [];
  const binds: Record<string, string> = {};

  if (filtros.sociedad) {
    condiciones.push('ERP_EMPRESA = :sociedad');
    binds.sociedad = filtros.sociedad;
  }
  if (filtros.sistema) {
    condiciones.push('SIS_SISTEMA = :sistema');
    binds.sistema = filtros.sistema;
  }
  if (filtros.q) {
    // Un solo bind reutilizado en cada campo.
    binds.q = `%${escaparLike(filtros.q.toUpperCase())}%`;
    const campos = CAMPOS_BUSQUEDA.map(
      (campo) => `UPPER(${campo}) LIKE :q ESCAPE '${ESCAPE_LIKE}'`,
    );
    condiciones.push(`(${campos.join(' OR ')})`);
  }

  return {
    where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '',
    binds,
  };
}
