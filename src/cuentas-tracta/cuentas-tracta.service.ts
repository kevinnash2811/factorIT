import { Injectable, OnModuleInit } from '@nestjs/common';
import { DominioException } from '../common/dominio.exception';
import { CLASES_DOCUMENTO, SOCIEDADES } from '../common/rutas-catalogo.util';
import {
  EstadoOracle,
  OracleService,
  TransaccionOracle,
} from '../oracle/oracle.service';
import { ActualizarCuentaTractaDto } from './dto/actualizar-cuenta-tracta.dto';
import { CrearCuentaTractaDto } from './dto/crear-cuenta-tracta.dto';
import {
  CuentaTractaItemDto,
  CuentasTractaListadoDto,
  ListarCuentasTractaQueryDto,
  OpcionesCuentasTractaDto,
} from './dto/cuenta-tracta.dto';
import { TractaOracleRepository } from './tracta-oracle.repository';
import {
  aDatosOracle,
  ClaveTracta,
  ESTADO_ACTIVO,
  ESTADO_INACTIVO,
  estaActiva,
  FilaTractaOracle,
  mapearFilaOracle,
  TIPOS_CUENTA_TRACTA,
} from './tracta-oracle.mapeo';

/** Filas por página cuando no se indica: la tabla real tiene más de 9.000 reglas. */
const TAMANO_POR_DEFECTO = 50;

/** Al crear no hay regla propia que excluir de la búsqueda de duplicadas. */
const SIN_EXCLUSION = -1;

const ETIQUETAS_TIPO_CUENTA: Record<string, string> = {
  S: 'S - Cuenta de mayor',
  K: 'K - Acreedor',
  D: 'D - Deudor',
};

/**
 * Un Select de Retool sin selección manda literalmente el texto "undefined"
 * en la URL (no un parámetro ausente, no un string vacío) — mismo problema
 * que ya documentamos en ListarSolicitudesQueryDto. Acá se limpia a mano en
 * vez de con un DTO decorado porque estos filtros no tienen ninguna otra
 * validación (son valores dinámicos de la tabla, no un enum fijo).
 */
function valorFiltro(valor?: string): string | undefined {
  if (!valor) return undefined;
  const limpio = valor.trim();
  if (limpio === '' || limpio === 'undefined' || limpio === 'null') {
    return undefined;
  }
  return limpio;
}

/**
 * Parametrización de Cuentas Contables sobre Oracle ERP_TRACTA.
 *
 * Cada escritura corre en una transacción: la regla se bloquea, se valida y
 * se modifica, y todo se confirma junto o no se confirma nada.
 */
@Injectable()
export class CuentasTractaService implements OnModuleInit {
  constructor(
    private readonly oracle: OracleService,
    private readonly repo: TractaOracleRepository,
  ) {}

  /** Sin Oracle la pantalla no funciona: mejor fallar al arrancar que en la primera consulta. */
  onModuleInit(): void {
    if (!this.oracle.configurado()) {
      throw new Error(
        'Cuentas Contables usa Oracle (ERP_TRACTA): faltan ORACLE_USER, ORACLE_PASSWORD u ORACLE_CONNECT_STRING en el entorno.',
      );
    }
  }

  estadoConexion(): Promise<EstadoOracle> {
    return this.oracle.verificar();
  }

  async listar(
    query: ListarCuentasTractaQueryDto,
  ): Promise<CuentasTractaListadoDto> {
    const pagina = query.pagina ?? 1;
    const tamano = query.tamano ?? TAMANO_POR_DEFECTO;
    const resultado = await this.repo.listar(
      {
        sociedad: valorFiltro(query.sociedad),
        sistema: valorFiltro(query.sistema),
        q: valorFiltro(query.q),
      },
      pagina,
      tamano,
    );
    return {
      items: resultado.items,
      sociedadesDisponibles: resultado.sociedades,
      sistemasDisponibles: resultado.sistemas,
      total: resultado.total,
      pagina,
      tamano,
    };
  }

  /**
   * Opciones de los selectores. Salen de los datos de Oracle y no del catálogo
   * de la Matriz de Reglas, que no tiene, por ejemplo, la sociedad 2000 ni la
   * clase ZK. Del catálogo solo se toman los nombres cuando existen.
   */
  async opciones(): Promise<OpcionesCuentasTractaDto> {
    const valores = await this.repo.obtenerOpciones();
    return {
      sociedades: valores.sociedades.map((codigo) => ({
        codigo,
        etiqueta: SOCIEDADES[codigo]
          ? `${codigo} - ${SOCIEDADES[codigo].nombre}`
          : `Sociedad ${codigo}`,
      })),
      sistemas: valores.sistemas.map((codigo) => ({
        codigo,
        etiqueta: codigo,
      })),
      tiposCuenta: TIPOS_CUENTA_TRACTA.map((codigo) => ({
        codigo,
        etiqueta: ETIQUETAS_TIPO_CUENTA[codigo],
      })),
      clasesDocumento: valores.clasesDocumento.map((codigo) => ({
        codigo,
        etiqueta: CLASES_DOCUMENTO[codigo]
          ? `${codigo} - ${CLASES_DOCUMENTO[codigo]}`
          : codigo,
      })),
    };
  }

  crear(dto: CrearCuentaTractaDto): Promise<CuentaTractaItemDto> {
    // Valor unitario 1 si no viene, igual que la versión anterior de la pantalla.
    const datos = aDatosOracle(dto, 1);
    const estado = dto.tctEstado === 'I' ? ESTADO_INACTIVO : ESTADO_ACTIVO;

    return this.oracle.transaccion(async (tx) => {
      if (estado === ESTADO_ACTIVO) {
        await this.exigirSinDuplicada(tx, datos, SIN_EXCLUSION);
      }
      const sec = await this.repo.insertar(tx, datos, estado);
      return this.leer(tx, sec);
    });
  }

  actualizar(
    sec: number,
    dto: ActualizarCuentaTractaDto,
  ): Promise<CuentaTractaItemDto> {
    const datos = aDatosOracle(dto, null);

    return this.oracle.transaccion(async (tx) => {
      const actual = await this.exigirExistente(tx, sec);
      const cambiaClave =
        actual.ERP_EMPRESA !== datos.empresa ||
        actual.SIS_SISTEMA !== datos.sistema ||
        actual.TCT_TRANSACCION !== datos.transaccion;
      if (cambiaClave && estaActiva(actual.TCT_ESTADO)) {
        await this.exigirSinDuplicada(tx, datos, sec);
      }
      // Si el formulario no manda valor unitario, se conserva el que tenía.
      await this.repo.actualizarDatos(
        tx,
        sec,
        datos,
        dto.tctValUni !== undefined,
      );
      return this.leer(tx, sec);
    });
  }

  /**
   * No se borra la fila: ERP_TRACTA es el motor de reglas que ya se usó para
   * asentar transacciones, y perder la regla rompería la trazabilidad de lo
   * ya conciliado en SAP. Se marca inactiva (TCT_ESTADO = '0') y la
   * contabilización deja de usarla.
   */
  async eliminar(sec: number): Promise<void> {
    await this.oracle.transaccion(async (tx) => {
      await this.exigirExistente(tx, sec);
      await this.repo.cambiarEstado(tx, sec, ESTADO_INACTIVO);
    });
  }

  reactivar(sec: number): Promise<CuentaTractaItemDto> {
    return this.oracle.transaccion(async (tx) => {
      const actual = await this.exigirExistente(tx, sec);
      if (!estaActiva(actual.TCT_ESTADO)) {
        await this.exigirSinDuplicada(
          tx,
          {
            empresa: actual.ERP_EMPRESA,
            sistema: actual.SIS_SISTEMA,
            transaccion: actual.TCT_TRANSACCION ?? '',
          },
          sec,
        );
        await this.repo.cambiarEstado(tx, sec, ESTADO_ACTIVO);
      }
      return this.leer(tx, sec);
    });
  }

  /** Obtiene la regla bloqueándola hasta que termine la transacción. */
  private async exigirExistente(
    tx: TransaccionOracle,
    sec: number,
  ): Promise<FilaTractaOracle> {
    const fila = await this.repo.obtenerParaModificar(tx, sec);
    if (!fila) throw DominioException.cuentaTractaNoEncontrada(sec);
    return fila;
  }

  /**
   * La contabilización busca la regla activa por su clave: con dos activas
   * iguales elegiría cualquiera de las dos. Ya hay claves repetidas heredadas
   * (sobre todo en CAJ); esta validación evita que aparezcan nuevas.
   */
  private async exigirSinDuplicada(
    tx: TransaccionOracle,
    clave: ClaveTracta,
    excluirSec: number,
  ): Promise<void> {
    const otra = await this.repo.buscarActivaConClave(tx, clave, excluirSec);
    if (otra !== undefined) {
      throw DominioException.cuentaTractaDuplicada(clave, otra);
    }
  }

  private async leer(
    tx: TransaccionOracle,
    sec: number,
  ): Promise<CuentaTractaItemDto> {
    const fila = await this.repo.obtener(tx, sec);
    if (!fila) throw DominioException.cuentaTractaNoEncontrada(sec);
    return mapearFilaOracle(fila);
  }
}
