import * as ExcelJS from 'exceljs';
import {
  ContextoEvaluacion,
  FichaActual,
  FilaCruda,
  FilaEvaluada,
  evaluarFila,
  leerPlanilla,
  marcarRepetidas,
  protegerAdministradores,
} from './importacion-usuarios.util';
import {
  ENCABEZADOS,
  FilaExportacion,
  NOMBRE_HOJA,
  construirLibro,
} from './exportacion-usuarios.util';
import { normalizar } from './catalogos-ficha';

const ficha = (cambios: Partial<FichaActual> = {}): FichaActual => ({
  retoolUserId: 'user_1',
  email: 'carlos.blanco@cajalosandes.cl',
  rut: null,
  nivelJerarquico: null,
  plazoSlaHoras: null,
  tipoUsuario: 'COLABORADOR',
  perfilId: null,
  habilitado: true,
  icono: null,
  observaciones: null,
  ...cambios,
});

const contexto = (cambios: Partial<ContextoEvaluacion> = {}): ContextoEvaluacion => {
  const usuario = {
    retoolUserId: 'user_1',
    email: 'carlos.blanco@cajalosandes.cl',
    nombre: 'Carlos Blanco',
  };
  return {
    porId: new Map([[usuario.retoolUserId, usuario]]),
    porEmail: new Map([[normalizar(usuario.email), usuario]]),
    fichas: new Map([['user_1', ficha()]]),
    perfilPorNombre: new Map([
      [normalizar('Rol Gerente'), 3],
      [normalizar('Analista Contable'), 4],
    ]),
    nombrePorPerfil: new Map([
      [3, 'Rol Gerente'],
      [4, 'Analista Contable'],
    ]),
    ...cambios,
  };
};

const fila = (celdas: Record<string, string>, numero = 2): FilaCruda => {
  const completas: Record<string, string> = {};
  for (const e of ENCABEZADOS) completas[e] = '';
  return { fila: numero, celdas: { ...completas, ...celdas } };
};

describe('evaluarFila', () => {
  it('ignora a quien no existe en la lista de Retool', () => {
    const r = evaluarFila(
      fila({ Correo: 'nadie@cajalosandes.cl', RUT: '11.111.111-1' }),
      contexto(),
    );

    expect(r.accion).toBe('IGNORADA');
    expect(r.motivo).toContain('No existe en la lista de usuarios de Retool');
  });

  it('encuentra a la persona por correo aunque el ID venga vacío', () => {
    const r = evaluarFila(
      fila({ Correo: 'CARLOS.BLANCO@cajalosandes.cl', RUT: '15.432.678-9' }),
      contexto(),
    );

    expect(r.accion).toBe('ACTUALIZAR');
    expect(r.retoolUserId).toBe('user_1');
  });

  it('deja intactos los campos cuya celda viene vacía', () => {
    const r = evaluarFila(
      fila({ 'ID Retool': 'user_1', RUT: '15.432.678-9' }),
      contexto({ fichas: new Map([['user_1', ficha({ observaciones: 'Cuidar' })]]) }),
    );

    expect(r.cambios.map((c) => c.campo)).toEqual(['RUT']);
    expect(r.valores.observaciones).toBeUndefined();
  });

  it('vacía un campo solo cuando dice BORRAR', () => {
    const r = evaluarFila(
      fila({ 'ID Retool': 'user_1', RUT: 'BORRAR' }),
      contexto({ fichas: new Map([['user_1', ficha({ rut: '15.432.678-9' })]]) }),
    );

    expect(r.valores.rut).toBeNull();
    expect(r.cambios[0]).toEqual({
      campo: 'RUT',
      antes: '15.432.678-9',
      despues: '—',
    });
  });

  it('acepta el nivel jerárquico por etiqueta y por código', () => {
    const porEtiqueta = evaluarFila(
      fila({ 'ID Retool': 'user_1', 'Nivel jerárquico': 'Gerencia de Negocio' }),
      contexto(),
    );
    const porCodigo = evaluarFila(
      fila({ 'ID Retool': 'user_1', 'Nivel jerárquico': 'GERENCIA_NEGOCIO' }),
      contexto(),
    );

    expect(porEtiqueta.valores.nivelJerarquico).toBe('GERENCIA_NEGOCIO');
    expect(porCodigo.valores.nivelJerarquico).toBe('GERENCIA_NEGOCIO');
  });

  it('rechaza la fila cuando un valor no está en el catálogo', () => {
    const r = evaluarFila(
      fila({ 'ID Retool': 'user_1', 'Nivel jerárquico': 'Jefe supremo' }),
      contexto(),
    );

    expect(r.accion).toBe('ERROR');
    expect(r.motivo).toContain('Valores válidos');
  });

  it('no deja ascender a administrador desde el Excel', () => {
    const r = evaluarFila(
      fila({ 'ID Retool': 'user_1', 'Tipo de cuenta': 'Administrador' }),
      contexto(),
    );

    expect(r.accion).toBe('ERROR');
    expect(r.motivo).toContain('no se cambia desde el Excel');
  });

  it('acepta que un administrador se mantenga como administrador', () => {
    const r = evaluarFila(
      fila({ 'ID Retool': 'user_1', 'Tipo de cuenta': 'Administrador', RUT: '9.999.999-9' }),
      contexto({
        fichas: new Map([['user_1', ficha({ tipoUsuario: 'ADMINISTRADOR' })]]),
      }),
    );

    expect(r.accion).toBe('ACTUALIZAR');
    expect(r.cambios.map((c) => c.campo)).toEqual(['RUT']);
  });

  it('tampoco deja bajar de administrador a colaborador', () => {
    const r = evaluarFila(
      fila({ 'ID Retool': 'user_1', 'Tipo de cuenta': 'Colaborador' }),
      contexto({
        fichas: new Map([['user_1', ficha({ tipoUsuario: 'ADMINISTRADOR' })]]),
      }),
    );

    expect(r.accion).toBe('ERROR');
    expect(r.motivo).toContain('esta persona es Administrador');
  });

  it('resuelve el perfil por su nombre, sin importar tildes ni mayúsculas', () => {
    const r = evaluarFila(
      fila({ 'ID Retool': 'user_1', 'Perfil de permisos': 'rol gerente' }),
      contexto(),
    );

    expect(r.valores.perfilId).toBe(3);
    expect(r.cambios[0].despues).toBe('Rol Gerente');
  });

  it('avisa qué perfiles existen cuando el nombre está mal escrito', () => {
    const r = evaluarFila(
      fila({ 'ID Retool': 'user_1', 'Perfil de permisos': 'Rol Gerenta' }),
      contexto(),
    );

    expect(r.accion).toBe('ERROR');
    expect(r.motivo).toContain('Rol Gerente');
    expect(r.motivo).toContain('Analista Contable');
  });

  it('entiende Sí y No en la columna Habilitado', () => {
    const apagado = evaluarFila(
      fila({ 'ID Retool': 'user_1', 'Habilitado en Workflow': 'No' }),
      contexto(),
    );

    expect(apagado.valores.habilitado).toBe(false);
  });

  it('crea la ficha de quien no la tenía', () => {
    const r = evaluarFila(
      fila({ 'ID Retool': 'user_1', RUT: '15.432.678-9' }),
      contexto({ fichas: new Map() }),
    );

    expect(r.accion).toBe('CREAR');
  });

  it('no crea fichas vacías al reimportar la planilla sin editarla', () => {
    const r = evaluarFila(fila({ 'ID Retool': 'user_1' }), contexto({ fichas: new Map() }));

    expect(r.accion).toBe('SIN_CAMBIOS');
    expect(r.motivo).toContain('no se crea la ficha');
  });

  it('no repite un cambio cuando el valor ya era ese', () => {
    const r = evaluarFila(
      fila({ 'ID Retool': 'user_1', 'Perfil de permisos': 'Rol Gerente' }),
      contexto({ fichas: new Map([['user_1', ficha({ perfilId: 3 })]]) }),
    );

    expect(r.accion).toBe('SIN_CAMBIOS');
    expect(r.cambios).toEqual([]);
  });
});

describe('marcarRepetidas', () => {
  it('aplica la primera fila de una persona y marca las demás', () => {
    const base: FilaEvaluada = {
      fila: 2,
      nombre: 'Carlos Blanco',
      email: 'carlos.blanco@cajalosandes.cl',
      retoolUserId: 'user_1',
      accion: 'ACTUALIZAR',
      motivo: null,
      cambios: [{ campo: 'RUT', antes: '—', despues: '1-9' }],
      valores: { rut: '1-9' },
    };

    const resultado = marcarRepetidas([base, { ...base, fila: 3 }]);

    expect(resultado[0].accion).toBe('ACTUALIZAR');
    expect(resultado[1].accion).toBe('ERROR');
    expect(resultado[1].motivo).toContain('más de una fila');
  });
});

describe('protegerAdministradores', () => {
  const fichas = new Map([
    ['user_1', ficha({ tipoUsuario: 'ADMINISTRADOR' })],
    ['user_2', ficha({ retoolUserId: 'user_2', email: 'otro@cajalosandes.cl' })],
  ]);

  const deshabilitaAlAdmin: FilaEvaluada = {
    fila: 2,
    nombre: 'Carlos Blanco',
    email: 'carlos.blanco@cajalosandes.cl',
    retoolUserId: 'user_1',
    accion: 'ACTUALIZAR',
    motivo: null,
    cambios: [{ campo: 'Habilitado en Workflow', antes: 'Sí', despues: 'No' }],
    valores: { habilitado: false },
  };

  it('rechaza la fila que dejaría al sistema sin administradores', () => {
    const [resultado] = protegerAdministradores([deshabilitaAlAdmin], fichas);

    expect(resultado.accion).toBe('ERROR');
    expect(resultado.motivo).toContain('sin ningún administrador');
  });

  it('deja pasar el cambio si queda otro administrador habilitado', () => {
    const conDos = new Map(fichas);
    conDos.set(
      'user_3',
      ficha({
        retoolUserId: 'user_3',
        email: 'jefa@cajalosandes.cl',
        tipoUsuario: 'ADMINISTRADOR',
      }),
    );

    const [resultado] = protegerAdministradores([deshabilitaAlAdmin], conDos);

    expect(resultado.accion).toBe('ACTUALIZAR');
  });
});

describe('la planilla exportada se vuelve a leer', () => {
  const personas: FilaExportacion[] = [
    {
      retoolUserId: 'user_1',
      nombre: 'Carlos Blanco',
      email: 'carlos.blanco@cajalosandes.cl',
      activoRetool: true,
      configurado: true,
      rut: '15.432.678-9',
      nivelEtiqueta: 'Analista',
      plazoSlaHoras: 48,
      tipoEtiqueta: 'Colaborador',
      perfilNombre: 'Rol Gerente',
      habilitado: true,
      icono: '🧮',
      observaciones: 'Contabilidad',
    },
    {
      retoolUserId: 'user_9',
      nombre: 'Sin Ficha',
      email: 'sin.ficha@cajalosandes.cl',
      activoRetool: false,
      configurado: false,
      rut: null,
      nivelEtiqueta: null,
      plazoSlaHoras: null,
      tipoEtiqueta: null,
      perfilNombre: null,
      habilitado: null,
      icono: null,
      observaciones: null,
    },
  ];

  const comoArchivo = async (): Promise<Buffer> => {
    const libro = construirLibro(personas, ['Rol Gerente', 'Analista Contable']);
    return Buffer.from(await libro.xlsx.writeBuffer());
  };

  it('devuelve una fila por persona con los datos donde corresponde', async () => {
    const { filas, error } = await leerPlanilla(await comoArchivo());

    expect(error).toBeNull();
    expect(filas).toHaveLength(2);
    expect(filas[0].celdas['ID Retool']).toBe('user_1');
    expect(filas[0].celdas['RUT']).toBe('15.432.678-9');
    expect(filas[0].celdas['Plazo SLA (horas)']).toBe('48');
    expect(filas[0].celdas['Habilitado en Workflow']).toBe('Sí');
    expect(filas[1].celdas['Ficha']).toBe('Sin configurar');
  });

  it('reimportada sin tocar nada, no propone ningún cambio', async () => {
    const { filas } = await leerPlanilla(await comoArchivo());
    const ctx = contexto({
      porId: new Map([
        ['user_1', { retoolUserId: 'user_1', email: personas[0].email, nombre: 'Carlos Blanco' }],
        ['user_9', { retoolUserId: 'user_9', email: personas[1].email, nombre: 'Sin Ficha' }],
      ]),
      porEmail: new Map(),
      fichas: new Map([
        [
          'user_1',
          ficha({
            rut: '15.432.678-9',
            nivelJerarquico: 'ANALISTA',
            plazoSlaHoras: 48,
            perfilId: 3,
            icono: '🧮',
            observaciones: 'Contabilidad',
          }),
        ],
      ]),
    });

    const evaluadas = filas.map((f) => evaluarFila(f, ctx));

    expect(evaluadas.map((e) => e.accion)).toEqual(['SIN_CAMBIOS', 'SIN_CAMBIOS']);
  });

  it('encuentra las columnas aunque se agreguen otras propias', async () => {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load((await comoArchivo()) as unknown as ArrayBuffer);
    const hoja = libro.getWorksheet(NOMBRE_HOJA)!;

    // El usuario agrega su propia columna al final y mueve datos a mano.
    hoja.getCell(1, 20).value = 'Quién lo revisó';
    hoja.getCell(2, 20).value = 'Paola';
    const conExtra = Buffer.from(await libro.xlsx.writeBuffer());

    const { filas, error } = await leerPlanilla(conExtra);

    expect(error).toBeNull();
    expect(filas[0].celdas['ID Retool']).toBe('user_1');
    expect(Object.keys(filas[0].celdas)).not.toContain('Quién lo revisó');
  });

  it('avisa con claridad cuando el archivo no es la plantilla', async () => {
    const otro = new ExcelJS.Workbook();
    const hoja = otro.addWorksheet('Datos');
    hoja.addRow(['Columna A', 'Columna B']);
    hoja.addRow(['1', '2']);

    const { error } = await leerPlanilla(
      Buffer.from(await otro.xlsx.writeBuffer()),
    );

    expect(error).toContain('no tiene las columnas de la plantilla');
  });
});
