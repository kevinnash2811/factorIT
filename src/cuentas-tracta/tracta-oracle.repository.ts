import { Injectable } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { OracleService, TransaccionOracle } from '../oracle/oracle.service';
import { CuentaTractaItemDto } from './dto/cuenta-tracta.dto';
import {
  ClaveTracta,
  COLUMNAS_TRACTA,
  construirFiltro,
  DatosCuentaTracta,
  FilaTractaOracle,
  FiltrosTracta,
  mapearFilaOracle,
  SECUENCIA_TRACTA,
  TABLA_TRACTA,
} from './tracta-oracle.mapeo';

export interface PaginaTractaOracle {
  items: CuentaTractaItemDto[];
  total: number;
  sociedades: string[];
  sistemas: string[];
}

/** Auditoría: el usuario de base de datos, recortado al largo de la columna (14). */
const AUDITORIA = 'SUBSTR(USER, 1, 14), SYSDATE';

/**
 * Alta de una regla.
 *
 * Las columnas que el formulario no pide son convenciones de cada sistema
 * (Debe/Haber, agrupación, vigencia…), así que se copian de la regla activa
 * más reciente de la misma empresa y sistema. Solo si la empresa y el sistema
 * no tienen reglas se usan los valores más frecuentes de la tabla (medidos en
 * ERP_TRACTA el 15-09-2026: agrupación SUC, sucursal CAR, PTN_TIPNEG 0) y la
 * regla queda vigente desde hoy. Los valores fijos del prototipo (NAC, VOU,
 * 99, SI) eran minoritarios en los datos reales.
 *
 * CTA_NUMCTA, CTA_DIGCTA, TCT_DIGITO_SAP, TCT_ORDEN_CONTROLLING y
 * TCT_CONTRA_CTA_ANU no se copian: son propios de cada regla.
 */
const SQL_INSERTAR = `INSERT INTO ${TABLA_TRACTA} (
    TCT_SECUENCIA, ERP_EMPRESA, SIS_SISTEMA, TCT_TRANSACCION, TCT_GLOSA_TRANS,
    TCT_USA_MAY_AUX, TCT_CLASE_CUENTA, TCT_CUENTA_SAP, TCT_CTA_AUX, TCT_CONTRA_CTA,
    TCT_CENTRO_BENEF, CEN_NUMCEN, TCT_VAL_UNI, TCT_ESTADO, TCT_USA_CCOSTO,
    TCT_DEBE_HABER, TCT_USA_LBANCO, TCT_AGRUPA, TCT_SUC_AGRUPA, TCT_ELEMTO_PEP,
    PTR_TIPRES, PTR_SUB_AREA, PTN_TIPNEG, TCT_CON_CME, TCT_IND_CME,
    PAR_TIPODOC_CAJA, TCT_TIPVOU, TCT_TIP_PROD, TCT_TIP_PAG, PAR_AREA,
    UNI_CODIGO, FOR_CODIGO, TCT_FECHA_INICIO, TCT_FECHA_TERMINO,
    TCT_USUGRA, TCT_FECGRA, TCT_USUACT, TCT_FECACT
  )
  SELECT
    :sec, :empresa, :sistema, :transaccion, :glosa,
    :tipoCuenta, :claseDocumento, :cuentaSap, :ctaAux, :contraCta,
    :centroBeneficio, :centroCosto, :valorUnitario, :estado,
    CASE WHEN :centroCosto IS NULL THEN 'N' ELSE 'S' END,
    p.TCT_DEBE_HABER, NVL(p.TCT_USA_LBANCO, 'N'), NVL(p.TCT_AGRUPA, 'SUC'),
    NVL(p.TCT_SUC_AGRUPA, 'CAR'), p.TCT_ELEMTO_PEP,
    NVL(p.PTR_TIPRES, 0), NVL(p.PTR_SUB_AREA, 0), NVL(p.PTN_TIPNEG, 0),
    NVL(p.TCT_CON_CME, 'N'), p.TCT_IND_CME,
    p.PAR_TIPODOC_CAJA, p.TCT_TIPVOU, p.TCT_TIP_PROD, p.TCT_TIP_PAG, p.PAR_AREA,
    p.UNI_CODIGO, p.FOR_CODIGO,
    NVL(p.TCT_FECHA_INICIO, TRUNC(SYSDATE)), NVL(p.TCT_FECHA_TERMINO, DATE '2999-12-31'),
    ${AUDITORIA}, ${AUDITORIA}
  FROM DUAL
  LEFT JOIN (
    SELECT * FROM ${TABLA_TRACTA}
    WHERE ERP_EMPRESA = :empresa AND SIS_SISTEMA = :sistema
    ORDER BY CASE WHEN TCT_ESTADO = '1' OR TCT_ESTADO IS NULL THEN 0 ELSE 1 END,
      TCT_SECUENCIA DESC
    FETCH FIRST 1 ROWS ONLY
  ) p ON 1 = 1`;

/**
 * Solo los campos del formulario y la auditoría. El resto de la regla
 * (incluidos valores heredados como PAR_TIPODOC_CAJA = '00') queda intacto.
 */
const SQL_ACTUALIZAR = `UPDATE ${TABLA_TRACTA} SET
    ERP_EMPRESA = :empresa,
    SIS_SISTEMA = :sistema,
    TCT_TRANSACCION = :transaccion,
    TCT_GLOSA_TRANS = :glosa,
    TCT_USA_MAY_AUX = :tipoCuenta,
    TCT_CLASE_CUENTA = :claseDocumento,
    TCT_CUENTA_SAP = :cuentaSap,
    TCT_CTA_AUX = :ctaAux,
    TCT_CONTRA_CTA = :contraCta,
    TCT_CENTRO_BENEF = :centroBeneficio,
    CEN_NUMCEN = :centroCosto,
    TCT_VAL_UNI = CASE WHEN :cambiarValor = 1 THEN :valorUnitario ELSE TCT_VAL_UNI END,
    TCT_USUACT = SUBSTR(USER, 1, 14),
    TCT_FECACT = SYSDATE
  WHERE TCT_SECUENCIA = :sec`;

const SQL_CAMBIAR_ESTADO = `UPDATE ${TABLA_TRACTA} SET
    TCT_ESTADO = :estado,
    TCT_USUACT = SUBSTR(USER, 1, 14),
    TCT_FECACT = SYSDATE
  WHERE TCT_SECUENCIA = :sec`;

/** Lectura y escritura de ERP_TRACTA en Oracle. */
@Injectable()
export class TractaOracleRepository {
  constructor(private readonly oracle: OracleService) {}

  async listar(
    filtros: FiltrosTracta,
    pagina: number,
    tamano: number,
  ): Promise<PaginaTractaOracle> {
    const { where, binds } = construirFiltro(filtros);

    // En serie y no con Promise.all: así las cuatro consultas reutilizan una
    // sola conexión del pool, en vez de abrir cuatro (cada una tarda segundos).
    const filas = await this.oracle.consultar<FilaTractaOracle>(
      `SELECT ${COLUMNAS_TRACTA} FROM ${TABLA_TRACTA} ${where}
       ORDER BY TCT_SECUENCIA DESC
       OFFSET :desde ROWS FETCH NEXT :tamano ROWS ONLY`,
      { ...binds, desde: (pagina - 1) * tamano, tamano },
    );
    const conteo = await this.oracle.consultar<{ TOTAL: number }>(
      `SELECT COUNT(*) AS TOTAL FROM ${TABLA_TRACTA} ${where}`,
      binds,
    );
    // Los selectores de la pantalla muestran todas las opciones, no solo las del filtro.
    const sociedades = await this.oracle.consultar<{ VALOR: string }>(
      `SELECT DISTINCT ERP_EMPRESA AS VALOR FROM ${TABLA_TRACTA} ORDER BY 1`,
    );
    const sistemas = await this.oracle.consultar<{ VALOR: string }>(
      `SELECT DISTINCT SIS_SISTEMA AS VALOR FROM ${TABLA_TRACTA} ORDER BY 1`,
    );

    return {
      items: filas.map(mapearFilaOracle),
      total: conteo[0]?.TOTAL ?? 0,
      sociedades: sociedades.map((s) => s.VALOR),
      sistemas: sistemas.map((s) => s.VALOR),
    };
  }

  /** Valores distintos de la tabla para llenar los selectores, en una sola consulta. */
  async obtenerOpciones(): Promise<{
    sociedades: string[];
    sistemas: string[];
    clasesDocumento: string[];
  }> {
    const filas = await this.oracle.consultar<{ TIPO: string; VALOR: string }>(
      `SELECT 'SOCIEDAD' AS TIPO, ERP_EMPRESA AS VALOR FROM ${TABLA_TRACTA} GROUP BY ERP_EMPRESA
       UNION ALL
       SELECT 'SISTEMA', SIS_SISTEMA FROM ${TABLA_TRACTA} GROUP BY SIS_SISTEMA
       UNION ALL
       SELECT 'CLASE_DOCUMENTO', TCT_CLASE_CUENTA FROM ${TABLA_TRACTA}
       WHERE TCT_CLASE_CUENTA IS NOT NULL GROUP BY TCT_CLASE_CUENTA
       ORDER BY 1, 2`,
    );
    const valoresDe = (tipo: string) =>
      filas.filter((f) => f.TIPO === tipo).map((f) => f.VALOR);
    return {
      sociedades: valoresDe('SOCIEDAD'),
      sistemas: valoresDe('SISTEMA'),
      clasesDocumento: valoresDe('CLASE_DOCUMENTO'),
    };
  }

  async obtener(
    tx: TransaccionOracle,
    sec: number,
  ): Promise<FilaTractaOracle | undefined> {
    const filas = await tx.consultar<FilaTractaOracle>(
      `SELECT ${COLUMNAS_TRACTA} FROM ${TABLA_TRACTA} WHERE TCT_SECUENCIA = :sec`,
      { sec },
    );
    return filas[0];
  }

  /**
   * Igual que obtener, pero bloquea la fila hasta que termine la transacción:
   * dos ediciones simultáneas de la misma regla no se pisan. Si otra
   * operación la tiene tomada, espera 5 segundos y desiste.
   */
  async obtenerParaModificar(
    tx: TransaccionOracle,
    sec: number,
  ): Promise<FilaTractaOracle | undefined> {
    const filas = await tx.consultar<FilaTractaOracle>(
      `SELECT ${COLUMNAS_TRACTA} FROM ${TABLA_TRACTA}
       WHERE TCT_SECUENCIA = :sec FOR UPDATE WAIT 5`,
      { sec },
    );
    return filas[0];
  }

  /** Secuencia de otra regla activa con la misma clave, si existe. */
  async buscarActivaConClave(
    tx: TransaccionOracle,
    clave: ClaveTracta,
    excluirSec: number,
  ): Promise<number | undefined> {
    const filas = await tx.consultar<{ SEC: number }>(
      `SELECT TCT_SECUENCIA AS SEC FROM ${TABLA_TRACTA}
       WHERE ERP_EMPRESA = :empresa AND SIS_SISTEMA = :sistema
         AND TCT_TRANSACCION = :transaccion
         AND (TCT_ESTADO = '1' OR TCT_ESTADO IS NULL)
         AND TCT_SECUENCIA <> :excluir
       FETCH FIRST 1 ROWS ONLY`,
      {
        empresa: clave.empresa,
        sistema: clave.sistema,
        transaccion: clave.transaccion,
        excluir: excluirSec,
      },
    );
    return filas[0]?.SEC;
  }

  /** Inserta la regla y devuelve la secuencia asignada. */
  async insertar(
    tx: TransaccionOracle,
    datos: DatosCuentaTracta,
    estado: string,
  ): Promise<number> {
    const [siguiente] = await tx.consultar<{ SEC: number }>(
      `SELECT ${SECUENCIA_TRACTA}.NEXTVAL AS SEC FROM DUAL`,
    );
    await tx.modificar(
      SQL_INSERTAR,
      bindsDe(datos, { sec: siguiente.SEC, estado }),
    );
    return siguiente.SEC;
  }

  async actualizarDatos(
    tx: TransaccionOracle,
    sec: number,
    datos: DatosCuentaTracta,
    cambiarValorUnitario: boolean,
  ): Promise<void> {
    await tx.modificar(
      SQL_ACTUALIZAR,
      bindsDe(datos, { sec, cambiarValor: cambiarValorUnitario ? 1 : 0 }),
    );
  }

  async cambiarEstado(
    tx: TransaccionOracle,
    sec: number,
    estado: string,
  ): Promise<void> {
    await tx.modificar(SQL_CAMBIAR_ESTADO, { sec, estado });
  }
}

function bindsDe(
  datos: DatosCuentaTracta,
  extra: Record<string, string | number>,
): oracledb.BindParameters {
  return {
    ...extra,
    empresa: datos.empresa,
    sistema: datos.sistema,
    transaccion: datos.transaccion,
    glosa: datos.glosa,
    tipoCuenta: datos.tipoCuenta,
    claseDocumento: datos.claseDocumento,
    cuentaSap: datos.cuentaSap,
    ctaAux: datos.ctaAux,
    contraCta: datos.contraCta,
    centroBeneficio: datos.centroBeneficio,
    centroCosto: datos.centroCosto,
    // Con tipo explícito: un NULL sin tipo se enlaza como texto y Oracle no lo
    // mezcla con la columna NUMBER dentro del CASE.
    valorUnitario: { val: datos.valorUnitario, type: oracledb.NUMBER },
  };
}
