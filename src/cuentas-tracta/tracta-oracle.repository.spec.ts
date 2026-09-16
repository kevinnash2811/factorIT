import * as oracledb from 'oracledb';
import {
  esEscrituraPermitida,
  OracleService,
  TransaccionOracle,
} from '../oracle/oracle.service';
import { DatosCuentaTracta } from './tracta-oracle.mapeo';
import { TractaOracleRepository } from './tracta-oracle.repository';

interface Llamada {
  sql: string;
  binds: Record<string, unknown>;
}

/** Transacción falsa que registra el SQL recibido en vez de ejecutarlo. */
function txFalsa(filas: unknown[] = [{ SEC: 16001 }]) {
  const lecturas: Llamada[] = [];
  const escrituras: Llamada[] = [];
  const tx = {
    consultar: (sql: string, binds: Record<string, unknown> = {}) => {
      lecturas.push({ sql, binds });
      return Promise.resolve(filas);
    },
    modificar: (sql: string, binds: Record<string, unknown> = {}) => {
      escrituras.push({ sql, binds });
      return Promise.resolve(1);
    },
  } as unknown as TransaccionOracle;
  return { tx, lecturas, escrituras };
}

const datos: DatosCuentaTracta = {
  empresa: '1000',
  sistema: 'CAJ',
  transaccion: 'ING_CREDITO',
  glosa: 'INGRESO CREDITO',
  tipoCuenta: 'S',
  claseDocumento: 'ZA',
  cuentaSap: '1108000205',
  ctaAux: null,
  contraCta: null,
  centroBeneficio: 'CEBE0099',
  centroCosto: null,
  valorUnitario: 1,
};

const repo = new TractaOracleRepository({} as OracleService);

describe('TractaOracleRepository.insertar', () => {
  it('toma el número de la secuencia ERP_TCT_SEC y lo usa en el INSERT', async () => {
    const { tx, lecturas, escrituras } = txFalsa();
    const sec = await repo.insertar(tx, datos, '1');
    expect(sec).toBe(16001);
    expect(lecturas[0].sql).toContain('"OPS$ANDES"."ERP_TCT_SEC".NEXTVAL');
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0].binds).toMatchObject({
      sec: 16001,
      estado: '1',
      tipoCuenta: 'S',
      claseDocumento: 'ZA',
    });
  });

  it('es una escritura permitida y copia las columnas no pedidas de una regla del mismo sistema', async () => {
    const { tx, escrituras } = txFalsa();
    await repo.insertar(tx, datos, '1');
    const sql = escrituras[0].sql;
    expect(esEscrituraPermitida(sql)).toBe(true);
    expect(sql).toContain('LEFT JOIN');
    expect(sql).toContain(
      'WHERE ERP_EMPRESA = :empresa AND SIS_SISTEMA = :sistema',
    );
    expect(sql).toContain('SUBSTR(USER, 1, 14), SYSDATE');
  });

  it('enlaza el valor unitario como NUMBER aunque sea nulo', async () => {
    const { tx, escrituras } = txFalsa();
    await repo.insertar(tx, { ...datos, valorUnitario: null }, '1');
    expect(escrituras[0].binds.valorUnitario).toEqual({
      val: null,
      type: oracledb.NUMBER,
    });
  });
});

describe('TractaOracleRepository.actualizarDatos', () => {
  it('solo cambia los campos del formulario y la auditoría', async () => {
    const { tx, escrituras } = txFalsa();
    await repo.actualizarDatos(tx, 15646, datos, false);
    const sql = escrituras[0].sql;
    expect(esEscrituraPermitida(sql)).toBe(true);
    for (const columna of [
      'TCT_ESTADO',
      'TCT_AGRUPA',
      'PAR_TIPODOC_CAJA',
      'TCT_FECHA_INICIO',
      'TCT_USUGRA',
    ]) {
      expect(sql).not.toContain(columna);
    }
    expect(escrituras[0].binds).toMatchObject({ sec: 15646, cambiarValor: 0 });
  });
});

describe('TractaOracleRepository.cambiarEstado', () => {
  it('actualiza solo el estado y la auditoría', async () => {
    const { tx, escrituras } = txFalsa();
    await repo.cambiarEstado(tx, 5630, '0');
    expect(esEscrituraPermitida(escrituras[0].sql)).toBe(true);
    expect(escrituras[0].sql).toContain('TCT_ESTADO = :estado');
    expect(escrituras[0].binds).toEqual({ sec: 5630, estado: '0' });
  });
});

describe('TractaOracleRepository.obtenerOpciones', () => {
  it('trae sociedades, sistemas y clases en una sola consulta de lectura', async () => {
    const consultar = jest.fn().mockResolvedValue([
      { TIPO: 'CLASE_DOCUMENTO', VALOR: 'ZA' },
      { TIPO: 'SISTEMA', VALOR: 'CAJ' },
      { TIPO: 'SOCIEDAD', VALOR: '1000' },
    ]);
    const conOracle = new TractaOracleRepository({
      consultar,
    } as unknown as OracleService);
    await expect(conOracle.obtenerOpciones()).resolves.toEqual({
      sociedades: ['1000'],
      sistemas: ['CAJ'],
      clasesDocumento: ['ZA'],
    });
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(consultar).toHaveBeenCalledWith(expect.stringMatching(/^\s*SELECT/));
  });
});

describe('TractaOracleRepository.obtenerParaModificar', () => {
  it('bloquea la fila hasta el fin de la transacción', async () => {
    const { tx, lecturas } = txFalsa([]);
    await expect(repo.obtenerParaModificar(tx, 1)).resolves.toBeUndefined();
    expect(lecturas[0].sql).toContain('FOR UPDATE WAIT 5');
  });
});
