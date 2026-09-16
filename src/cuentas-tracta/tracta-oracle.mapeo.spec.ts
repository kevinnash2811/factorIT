import {
  aDatosOracle,
  construirFiltro,
  escaparLike,
  estaActiva,
  FilaTractaOracle,
  mapearFilaOracle,
} from './tracta-oracle.mapeo';

const fila = (cambios: Partial<FilaTractaOracle> = {}): FilaTractaOracle => ({
  TCT_SECUENCIA: 15646,
  ERP_EMPRESA: '1000',
  SIS_SISTEMA: 'APC',
  TCT_TRANSACCION: 'PPC_COMISION',
  TCT_GLOSA_TRANS: 'APORTE PPC COMISION',
  TCT_USA_MAY_AUX: 'K',
  TCT_CLASE_CUENTA: 'ZH',
  TCT_CUENTA_SAP: '1108000175',
  TCT_CTA_AUX: null,
  TCT_CONTRA_CTA: null,
  TCT_CENTRO_BENEF: 'CEBE0099',
  CEN_NUMCEN: null,
  TCT_VAL_UNI: null,
  TCT_ESTADO: '1',
  ...cambios,
});

describe('estaActiva', () => {
  it.each(['1', 'A', null])('%p es activa', (estado) => {
    expect(estaActiva(estado)).toBe(true);
  });

  it('0 es inactiva', () => {
    expect(estaActiva('0')).toBe(false);
  });
});

describe('mapearFilaOracle', () => {
  it('toma el tipo de cuenta de TCT_USA_MAY_AUX y el tipo de documento de TCT_CLASE_CUENTA', () => {
    const item = mapearFilaOracle(fila());
    expect(item.tCta).toBe('K');
    expect(item.tDoc).toBe('ZH');
  });

  it('ofrece editar y dar de baja a las activas, y reactivar a las inactivas', () => {
    expect(mapearFilaOracle(fila()).acciones).toEqual(['editar', 'eliminar']);
    expect(mapearFilaOracle(fila({ TCT_ESTADO: null })).acciones).toEqual([
      'editar',
      'eliminar',
    ]);
    expect(mapearFilaOracle(fila({ TCT_ESTADO: '0' })).acciones).toEqual([
      'reactivar',
    ]);
  });

  it('marca inactiva la fila con estado 0 y activa la que no tiene estado', () => {
    expect(mapearFilaOracle(fila({ TCT_ESTADO: '0' })).estadoEtiqueta).toBe(
      'INACTIVO',
    );
    expect(mapearFilaOracle(fila({ TCT_ESTADO: null })).estadoEtiqueta).toBe(
      'ACTIVO',
    );
  });

  it('deja en texto vacío los campos obligatorios de la pantalla que vienen nulos', () => {
    const item = mapearFilaOracle(
      fila({
        TCT_GLOSA_TRANS: null,
        TCT_CUENTA_SAP: null,
        TCT_TRANSACCION: null,
      }),
    );
    expect([item.glosa, item.ctaMayorSap, item.transaccion]).toEqual([
      '',
      '',
      '',
    ]);
  });
});

describe('aDatosOracle', () => {
  const entrada = {
    erpEmpresa: '1000',
    sisSistema: 'CAJ',
    tctTransaccion: 'ING_CREDITO',
    tctGlosaTrans: 'INGRESO CREDITO',
    tctClaseCuenta: 'S',
    parTipodocCaja: 'ZA',
    tctCuentaSap: '1108000205',
    tctCtaAux: '',
    tctCentroBenef: 'CEBE0099',
  };

  it('lleva los dos campos de nombre cruzado a su columna real', () => {
    const datos = aDatosOracle(entrada, null);
    expect(datos.tipoCuenta).toBe('S');
    expect(datos.claseDocumento).toBe('ZA');
  });

  it('convierte en nulo los opcionales vacíos u omitidos', () => {
    const datos = aDatosOracle(entrada, null);
    expect(datos.ctaAux).toBeNull();
    expect(datos.contraCta).toBeNull();
    expect(datos.centroBeneficio).toBe('CEBE0099');
  });

  it('usa el valor unitario por defecto solo si no viene', () => {
    expect(aDatosOracle(entrada, 1).valorUnitario).toBe(1);
    expect(aDatosOracle({ ...entrada, tctValUni: 2.5 }, 1).valorUnitario).toBe(
      2.5,
    );
  });
});

describe('construirFiltro', () => {
  it('sin filtros no agrega WHERE', () => {
    expect(construirFiltro({})).toEqual({ where: '', binds: {} });
  });

  it('combina sociedad y sistema con AND', () => {
    const { where, binds } = construirFiltro({
      sociedad: '1000',
      sistema: 'CAJ',
    });
    expect(where).toBe(
      'WHERE ERP_EMPRESA = :sociedad AND SIS_SISTEMA = :sistema',
    );
    expect(binds).toEqual({ sociedad: '1000', sistema: 'CAJ' });
  });

  it('busca en mayúsculas y con los comodines escapados', () => {
    const { where, binds } = construirFiltro({ q: 'ppc_10%' });
    expect(binds.q).toBe('%PPC!_10!%%');
    expect(where).toContain("UPPER(TCT_GLOSA_TRANS) LIKE :q ESCAPE '!'");
  });
});

describe('escaparLike', () => {
  it('escapa porcentaje, guion bajo y el propio carácter de escape', () => {
    expect(escaparLike('100%_a!b')).toBe('100!%!_a!!b');
  });
});
