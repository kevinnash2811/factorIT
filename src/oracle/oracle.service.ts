import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import { DominioException } from '../common/dominio.exception';

/** Una consulta que tarde más que esto se corta: la pantalla no puede quedar colgada. */
const LIMITE_CONSULTA_MS = 30_000;

const VARIABLES = [
  'ORACLE_USER',
  'ORACLE_PASSWORD',
  'ORACLE_CONNECT_STRING',
] as const;

/**
 * Únicas tablas en las que el BFF puede escribir. Cualquier otra escritura
 * (otra tabla, DELETE, MERGE, DDL o PL/SQL) se rechaza antes de llegar a Oracle.
 */
const TABLAS_CON_ESCRITURA = ['"OPS$ANDES"."ERP_TRACTA"'];

/** Oracle rechazó los datos enviados: es un error de la petición, no del servidor. */
const DATOS_RECHAZADOS = [
  'ORA-00001', // clave única
  'ORA-01400', // NULL en columna obligatoria
  'ORA-01407', // NULL en columna obligatoria (UPDATE)
  'ORA-01438', // número con más dígitos que la columna
  'ORA-01722', // número inválido
  'ORA-02290', // check constraint
  'ORA-02291', // clave foránea
  'ORA-12899', // texto más largo que la columna
];

export interface EstadoOracle {
  configurado: boolean;
  conectado: boolean;
  latenciaMs?: number;
  error?: string;
}

/** Lo que se puede hacer dentro de una transacción. */
export interface TransaccionOracle {
  consultar<T>(sql: string, binds?: oracledb.BindParameters): Promise<T[]>;
  /** INSERT o UPDATE sobre una tabla habilitada. Devuelve las filas afectadas. */
  modificar(sql: string, binds?: oracledb.BindParameters): Promise<number>;
}

/**
 * Acceso a Oracle (Menú Andes).
 *
 * El arquetipo CLA pide que el BFF no acceda a bases de datos. Este BFF es la
 * base provisional de los futuros microservicios, así que por ahora habla
 * directo con Oracle para lo que vive ahí.
 *
 * Las lecturas solo aceptan SELECT. Las escrituras pasan por transaccion() y
 * solo sobre TABLAS_CON_ESCRITURA: ERP_TRACTA decide con qué cuenta SAP se
 * contabiliza cada ticket, y una escritura equivocada ahí no falla, contabiliza mal.
 *
 * El pool se crea en la primera consulta y no al arrancar.
 */
@Injectable()
export class OracleService implements OnModuleDestroy {
  private readonly logger = new Logger(OracleService.name);
  private pool?: Promise<oracledb.Pool>;

  constructor(private readonly config: ConfigService) {}

  configurado(): boolean {
    return VARIABLES.every((nombre) => !!this.config.get<string>(nombre));
  }

  /** Ejecuta un SELECT y devuelve las filas como objetos con las columnas en mayúsculas. */
  async consultar<T>(
    sql: string,
    binds: oracledb.BindParameters = {},
  ): Promise<T[]> {
    exigirLectura(sql);
    return this.conConexion((conexion) => leer<T>(conexion, sql, binds));
  }

  /**
   * Corre el trabajo en una transacción: si termina bien se confirma y si lanza
   * un error se deshace todo. Así una validación y la escritura que depende de
   * ella se confirman juntas o no se confirma nada.
   */
  async transaccion<T>(
    trabajo: (tx: TransaccionOracle) => Promise<T>,
  ): Promise<T> {
    return this.conConexion(async (conexion) => {
      const tx: TransaccionOracle = {
        consultar<F>(sql: string, binds: oracledb.BindParameters = {}) {
          exigirLectura(sql);
          return leer<F>(conexion, sql, binds);
        },
        async modificar(sql: string, binds: oracledb.BindParameters = {}) {
          if (!esEscrituraPermitida(sql)) {
            throw new Error(
              `Escritura no permitida en Oracle: solo INSERT o UPDATE sobre ${TABLAS_CON_ESCRITURA.join(', ')}.`,
            );
          }
          const resultado = await conexion.execute(sql, binds, {
            autoCommit: false,
          });
          return resultado.rowsAffected ?? 0;
        },
      };

      try {
        const valor = await trabajo(tx);
        await conexion.commit();
        return valor;
      } catch (error) {
        await conexion.rollback().catch(() => undefined);
        throw error;
      }
    });
  }

  /** Para diagnóstico: nunca lanza, informa el resultado. */
  async verificar(): Promise<EstadoOracle> {
    if (!this.configurado()) return { configurado: false, conectado: false };

    const inicio = Date.now();
    let conexion: oracledb.Connection | undefined;
    try {
      conexion = await (await this.obtenerPool()).getConnection();
      conexion.callTimeout = LIMITE_CONSULTA_MS;
      await leer(conexion, 'SELECT 1 AS OK FROM DUAL');
      return {
        configurado: true,
        conectado: true,
        latenciaMs: Date.now() - inicio,
      };
    } catch (error) {
      return {
        configurado: true,
        conectado: false,
        latenciaMs: Date.now() - inicio,
        error: mensajeDe(error),
      };
    } finally {
      await conexion?.close().catch(() => undefined);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.pool) return;
    const pool = await this.pool.catch(() => undefined);
    await pool?.close(5).catch(() => undefined);
  }

  private async conConexion<T>(
    trabajo: (conexion: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    let conexion: oracledb.Connection | undefined;
    try {
      conexion = await (await this.obtenerPool()).getConnection();
      conexion.callTimeout = LIMITE_CONSULTA_MS;
      return await trabajo(conexion);
    } catch (error) {
      throw this.traducir(error);
    } finally {
      await conexion?.close().catch(() => undefined);
    }
  }

  /** Convierte los errores de Oracle que tienen sentido para el usuario en errores de dominio. */
  private traducir(error: unknown): unknown {
    const codigo = codigoOracle(error);

    if (esErrorDeConexion(error)) {
      this.logger.error(`Oracle no disponible: ${mensajeDe(error)}`);
      return DominioException.oracleNoDisponible(codigo);
    }
    if (codigo === 'ORA-01031') {
      this.logger.error(`Oracle sin permiso: ${mensajeDe(error)}`);
      return DominioException.oracleSinPermiso();
    }
    if (codigo === 'ORA-00054' || codigo === 'ORA-30006') {
      return DominioException.registroOracleBloqueado();
    }
    if (DATOS_RECHAZADOS.includes(codigo)) {
      this.logger.warn(`Oracle rechazó los datos: ${mensajeDe(error)}`);
      return DominioException.oracleRechazoDatos(
        primeraLinea(mensajeDe(error)),
      );
    }
    return error;
  }

  private obtenerPool(): Promise<oracledb.Pool> {
    if (!this.configurado()) {
      return Promise.reject(
        new Error(
          'Faltan ORACLE_USER, ORACLE_PASSWORD u ORACLE_CONNECT_STRING en el entorno.',
        ),
      );
    }

    if (!this.pool) {
      this.pool = oracledb
        .createPool({
          user: this.config.get<string>('ORACLE_USER'),
          password: this.config.get<string>('ORACLE_PASSWORD'),
          connectString: this.config.get<string>('ORACLE_CONNECT_STRING'),
          poolMin: 0,
          poolMax: 4,
          poolIncrement: 1,
          // Abrir una conexión a Exadata tarda varios segundos: las abiertas
          // se conservan 5 minutos para no pagar ese costo en cada consulta.
          poolTimeout: 300,
        })
        .catch((error: unknown) => {
          // Un pool fallido se descarta para que la próxima consulta reintente.
          this.pool = undefined;
          throw error;
        });
    }
    return this.pool;
  }
}

/**
 * Una escritura se permite solo si es INSERT INTO o UPDATE sobre una tabla de
 * TABLAS_CON_ESCRITURA. Se normalizan espacios y mayúsculas antes de comparar.
 */
export function esEscrituraPermitida(sql: string): boolean {
  const normalizado = sql.trim().replace(/\s+/g, ' ').toUpperCase();
  return TABLAS_CON_ESCRITURA.some((tabla) => {
    const t = tabla.toUpperCase();
    return (
      normalizado.startsWith(`INSERT INTO ${t} `) ||
      normalizado.startsWith(`INSERT INTO ${t}(`) ||
      normalizado.startsWith(`UPDATE ${t} `)
    );
  });
}

function exigirLectura(sql: string): void {
  if (!/^\s*(select|with)\b/i.test(sql)) {
    throw new Error(
      'Lectura no permitida en Oracle: solo acepta consultas SELECT.',
    );
  }
}

async function leer<T>(
  conexion: oracledb.Connection,
  sql: string,
  binds: oracledb.BindParameters = {},
): Promise<T[]> {
  const resultado = await conexion.execute<T>(sql, binds, {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
  });
  return resultado.rows ?? [];
}

/** Red, credenciales o base caída: casos en que reintentar tiene sentido. */
function esErrorDeConexion(error: unknown): boolean {
  return /^(NJS-|DPI-|ORA-(12\d{3}|03113|03114|03135|01017|01033|01034|01089)\b)/.test(
    mensajeDe(error),
  );
}

function codigoOracle(error: unknown): string {
  return (
    /^((?:NJS|DPI|ORA)-\d+)/.exec(mensajeDe(error))?.[1] ?? 'error desconocido'
  );
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function primeraLinea(texto: string): string {
  return texto.split('\n')[0];
}
