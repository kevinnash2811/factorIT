import { DominioException } from '../common/dominio.exception';
import { OracleService, TransaccionOracle } from '../oracle/oracle.service';
import { CuentasTractaService } from './cuentas-tracta.service';
import { CrearCuentaTractaDto } from './dto/crear-cuenta-tracta.dto';
import { FilaTractaOracle } from './tracta-oracle.mapeo';
import { TractaOracleRepository } from './tracta-oracle.repository';

const TX = {} as TransaccionOracle;

const fila = (cambios: Partial<FilaTractaOracle> = {}): FilaTractaOracle => ({
  TCT_SECUENCIA: 15646,
  ERP_EMPRESA: '1000',
  SIS_SISTEMA: 'CAJ',
  TCT_TRANSACCION: 'ING_CREDITO',
  TCT_GLOSA_TRANS: 'INGRESO CREDITO',
  TCT_USA_MAY_AUX: 'S',
  TCT_CLASE_CUENTA: 'ZA',
  TCT_CUENTA_SAP: '1108000205',
  TCT_CTA_AUX: null,
  TCT_CONTRA_CTA: null,
  TCT_CENTRO_BENEF: 'CEBE0099',
  CEN_NUMCEN: null,
  TCT_VAL_UNI: 1,
  TCT_ESTADO: '1',
  ...cambios,
});

const entrada: CrearCuentaTractaDto = {
  erpEmpresa: '1000',
  sisSistema: 'CAJ',
  tctTransaccion: 'ING_CREDITO',
  tctGlosaTrans: 'INGRESO CREDITO',
  tctClaseCuenta: 'S',
  parTipodocCaja: 'ZA',
  tctCuentaSap: '1108000205',
};

function preparar(opciones: { configurado?: boolean } = {}) {
  const repo = {
    listar: jest.fn(),
    obtenerOpciones: jest.fn(),
    obtener: jest.fn().mockResolvedValue(fila()),
    obtenerParaModificar: jest.fn().mockResolvedValue(fila()),
    buscarActivaConClave: jest.fn().mockResolvedValue(undefined),
    insertar: jest.fn().mockResolvedValue(16000),
    actualizarDatos: jest.fn().mockResolvedValue(undefined),
    cambiarEstado: jest.fn().mockResolvedValue(undefined),
  };
  const oracle = {
    configurado: () => opciones.configurado ?? true,
    verificar: jest.fn(),
    // La transacción falsa solo ejecuta el trabajo con un tx vacío.
    transaccion: (trabajo: (tx: TransaccionOracle) => Promise<unknown>) =>
      trabajo(TX),
  };
  const servicio = new CuentasTractaService(
    oracle as unknown as OracleService,
    repo as unknown as TractaOracleRepository,
  );
  return { servicio, repo };
}

async function errorDe(promesa: Promise<unknown>): Promise<DominioException> {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(DominioException);
  return error as DominioException;
}

describe('CuentasTractaService', () => {
  it('no arranca sin la configuración de Oracle', () => {
    const { servicio } = preparar({ configurado: false });
    expect(() => servicio.onModuleInit()).toThrow('ORACLE_CONNECT_STRING');
  });

  it('arma las opciones con los datos de Oracle y los nombres conocidos del catálogo', async () => {
    const { servicio, repo } = preparar();
    repo.obtenerOpciones.mockResolvedValue({
      sociedades: ['1000', '2000'],
      sistemas: ['CAJ'],
      clasesDocumento: ['KA', 'ZK'],
    });
    const opciones = await servicio.opciones();
    expect(opciones.sociedades).toEqual([
      { codigo: '1000', etiqueta: '1000 - Caja Los Andes' },
      { codigo: '2000', etiqueta: 'Sociedad 2000' },
    ]);
    expect(opciones.sistemas).toEqual([{ codigo: 'CAJ', etiqueta: 'CAJ' }]);
    expect(opciones.tiposCuenta.map((t) => t.codigo)).toEqual(['S', 'K', 'D']);
    expect(opciones.clasesDocumento).toEqual([
      { codigo: 'KA', etiqueta: 'KA - Acreedor Gasto' },
      { codigo: 'ZK', etiqueta: 'ZK' },
    ]);
  });

  describe('crear', () => {
    it('inserta la regla activa con cada campo en su columna real', async () => {
      const { servicio, repo } = preparar();
      await servicio.crear(entrada);
      expect(repo.insertar).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({
          tipoCuenta: 'S',
          claseDocumento: 'ZA',
          valorUnitario: 1,
          ctaAux: null,
        }),
        '1',
      );
    });

    it('rechaza una regla activa duplicada sin insertar', async () => {
      const { servicio, repo } = preparar();
      repo.buscarActivaConClave.mockResolvedValue(15000);
      const error = await errorDe(servicio.crear(entrada));
      expect(error.getStatus()).toBe(409);
      expect(repo.insertar).not.toHaveBeenCalled();
    });

    it('una regla creada inactiva no se compara con las activas', async () => {
      const { servicio, repo } = preparar();
      await servicio.crear({ ...entrada, tctEstado: 'I' });
      expect(repo.buscarActivaConClave).not.toHaveBeenCalled();
      expect(repo.insertar).toHaveBeenCalledWith(TX, expect.anything(), '0');
    });
  });

  describe('actualizar', () => {
    it('responde 404 si la regla no existe', async () => {
      const { servicio, repo } = preparar();
      repo.obtenerParaModificar.mockResolvedValue(undefined);
      const error = await errorDe(servicio.actualizar(99, entrada));
      expect(error.getStatus()).toBe(404);
      expect(repo.actualizarDatos).not.toHaveBeenCalled();
    });

    it('sin cambiar la clave no busca duplicadas ni toca el valor unitario omitido', async () => {
      const { servicio, repo } = preparar();
      await servicio.actualizar(15646, {
        ...entrada,
        tctGlosaTrans: 'OTRA GLOSA',
      });
      expect(repo.buscarActivaConClave).not.toHaveBeenCalled();
      expect(repo.actualizarDatos).toHaveBeenCalledWith(
        TX,
        15646,
        expect.objectContaining({ glosa: 'OTRA GLOSA' }),
        false,
      );
    });

    it('al cambiar la transacción busca duplicadas excluyendo la propia regla', async () => {
      const { servicio, repo } = preparar();
      await servicio.actualizar(15646, {
        ...entrada,
        tctTransaccion: 'ING_NUEVO',
        tctValUni: 2,
      });
      expect(repo.buscarActivaConClave).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ transaccion: 'ING_NUEVO' }),
        15646,
      );
      expect(repo.actualizarDatos).toHaveBeenCalledWith(
        TX,
        15646,
        expect.objectContaining({ valorUnitario: 2 }),
        true,
      );
    });
  });

  it('dar de baja marca la regla con estado 0', async () => {
    const { servicio, repo } = preparar();
    await servicio.eliminar(15646);
    expect(repo.cambiarEstado).toHaveBeenCalledWith(TX, 15646, '0');
  });

  describe('reactivar', () => {
    it('reactiva una regla inactiva después de revisar duplicadas', async () => {
      const { servicio, repo } = preparar();
      repo.obtenerParaModificar.mockResolvedValue(fila({ TCT_ESTADO: '0' }));
      await servicio.reactivar(5630);
      expect(repo.buscarActivaConClave).toHaveBeenCalledWith(
        TX,
        { empresa: '1000', sistema: 'CAJ', transaccion: 'ING_CREDITO' },
        5630,
      );
      expect(repo.cambiarEstado).toHaveBeenCalledWith(TX, 5630, '1');
    });

    it('no modifica una regla que ya está activa', async () => {
      const { servicio, repo } = preparar();
      await servicio.reactivar(15646);
      expect(repo.cambiarEstado).not.toHaveBeenCalled();
    });
  });
});
