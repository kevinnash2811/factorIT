import { Repository } from 'typeorm';
import { DominioException } from '../common/dominio.exception';
import { PerfilPermisoEntity } from '../database/entities/perfil-permiso.entity';
import { UsuarioWorkflowEntity } from '../database/entities/usuario-workflow.entity';
import { SECCIONES_PORTAL } from '../perfiles-permiso/secciones';
import { UsuariosWorkflowService } from './usuarios-workflow.service';

const CLAVES = SECCIONES_PORTAL.map((s) => s.clave);

const ficha = (
  cambios: Partial<UsuarioWorkflowEntity> = {},
): UsuarioWorkflowEntity =>
  ({
    usuarioId: 1,
    retoolUserId: 'user_1',
    email: 'persona@cajalosandes.cl',
    tipoUsuario: 'COLABORADOR',
    perfilId: null,
    habilitado: true,
    ...cambios,
  }) as UsuarioWorkflowEntity;

const perfilDe = (permisos: Record<string, unknown>): PerfilPermisoEntity =>
  ({ perfilId: 7, nombre: 'Aprobador', permisos }) as PerfilPermisoEntity;

function preparar(
  fila: UsuarioWorkflowEntity | null,
  perfil: PerfilPermisoEntity | null = null,
) {
  const repo = { findOne: jest.fn().mockResolvedValue(fila) };
  const perfilesRepo = { findOneBy: jest.fn().mockResolvedValue(perfil) };
  const servicio = new UsuariosWorkflowService(
    repo as unknown as Repository<UsuarioWorkflowEntity>,
    perfilesRepo as unknown as Repository<PerfilPermisoEntity>,
  );
  return { servicio, perfilesRepo };
}

/** Todas las secciones del catálogo con el mismo valor. */
const todas = (valor: boolean) =>
  Object.fromEntries(CLAVES.map((c) => [c, valor]));

describe('UsuariosWorkflowService.miAcceso', () => {
  describe('sin ficha en el Workflow', () => {
    it('no entra al portal ni ve el menú', async () => {
      const { servicio } = preparar(null);
      const acceso = await servicio.miAcceso('desconocido@cajalosandes.cl');
      expect(acceso.estadoAcceso).toBe('SIN_FICHA');
      expect(acceso.puedeEntrar).toBe(false);
      expect(acceso.menu).toEqual(todas(false));
      expect(acceso.secciones).toEqual(todas(false));
      expect(acceso.mensajeBloqueo).toContain('autoriz');
    });

    it('no consulta perfiles: no hay ficha que consultar', async () => {
      const { servicio, perfilesRepo } = preparar(null);
      await servicio.miAcceso('desconocido@cajalosandes.cl');
      expect(perfilesRepo.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('administrador', () => {
    it('accede a todo sin necesidad de perfil', async () => {
      const { servicio, perfilesRepo } = preparar(
        ficha({ tipoUsuario: 'ADMINISTRADOR' }),
      );
      const acceso = await servicio.miAcceso('user_1');
      expect(acceso.estadoAcceso).toBe('ADMINISTRADOR');
      expect(acceso.puedeEntrar).toBe(true);
      expect(acceso.esAdministrador).toBe(true);
      expect(acceso.menu).toEqual(todas(true));
      expect(acceso.secciones).toEqual(todas(true));
      expect(acceso.mensajeBloqueo).toBe('');
      expect(perfilesRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('recibe cada permiso en su valor más amplio', async () => {
      const { servicio } = preparar(ficha({ tipoUsuario: 'ADMINISTRADOR' }));
      const acceso = await servicio.miAcceso('user_1');
      expect(acceso.permisos.bandeja.ver).toBe('TODAS');
      expect(acceso.permisos.bandeja.aprobar).toBe(true);
    });
  });

  describe('ficha dada de baja', () => {
    it('no accede a nada, aunque sea administrador', async () => {
      const { servicio } = preparar(
        ficha({ tipoUsuario: 'ADMINISTRADOR', habilitado: false }),
      );
      const acceso = await servicio.miAcceso('user_1');
      expect(acceso.estadoAcceso).toBe('DESHABILITADO');
      expect(acceso.puedeEntrar).toBe(false);
      expect(acceso.esAdministrador).toBe(false);
      expect(acceso.menu).toEqual(todas(false));
      expect(acceso.secciones).toEqual(todas(false));
      expect(acceso.mensajeBloqueo).toContain('deshabilitada');
    });

    it('un colaborador con perfil dado de baja tampoco entra', async () => {
      const { servicio, perfilesRepo } = preparar(
        ficha({ perfilId: 7, habilitado: false }),
        perfilDe({ bandeja: { ver: 'TODAS' } }),
      );
      const acceso = await servicio.miAcceso('user_1');
      expect(acceso.estadoAcceso).toBe('DESHABILITADO');
      expect(acceso.secciones).toEqual(todas(false));
      // Ni siquiera se consulta el perfil: la baja manda.
      expect(perfilesRepo.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('colaborador sin perfil', () => {
    it('ve el menú completo pero no puede abrir ninguna sección', async () => {
      const { servicio } = preparar(ficha({ perfilId: null }));
      const acceso = await servicio.miAcceso('user_1');
      expect(acceso.estadoAcceso).toBe('SIN_PERFIL');
      expect(acceso.puedeEntrar).toBe(false);
      expect(acceso.menu).toEqual(todas(true));
      expect(acceso.secciones).toEqual(todas(false));
      expect(acceso.mensajeBloqueo).toContain('perfil');
    });

    it('un perfil que ya no existe se trata igual que no tenerlo', async () => {
      const { servicio } = preparar(ficha({ perfilId: 99 }), null);
      const acceso = await servicio.miAcceso('user_1');
      expect(acceso.estadoAcceso).toBe('SIN_PERFIL');
      expect(acceso.menu).toEqual(todas(true));
    });

    it('sin secciones, tampoco tiene acciones', async () => {
      const { servicio } = preparar(ficha({ perfilId: null }));
      const acceso = await servicio.miAcceso('user_1');
      expect(acceso.permisos.bandeja.ver).toBe('NINGUNA');
      expect(acceso.permisos.bandeja.aprobar).toBe(false);
    });
  });

  describe('colaborador con perfil', () => {
    it('solo ve en el menú las secciones que el perfil habilita', async () => {
      const { servicio } = preparar(
        ficha({ perfilId: 7 }),
        perfilDe({ bandeja: { ver: 'TODAS', aprobar: true } }),
      );
      const acceso = await servicio.miAcceso('user_1');
      expect(acceso.estadoAcceso).toBe('CON_PERFIL');
      expect(acceso.puedeEntrar).toBe(true);
      expect(acceso.secciones.bandeja).toBe(true);
      expect(acceso.secciones.usuarios).toBe(false);
      // El menú no ofrece lo que no puede abrir.
      expect(acceso.menu).toEqual(acceso.secciones);
      expect(acceso.perfilNombre).toBe('Aprobador');
      expect(acceso.mensajeBloqueo).toBe('');
    });

    it('respeta los valores guardados y niega lo ausente', async () => {
      const { servicio } = preparar(
        ficha({ perfilId: 7 }),
        perfilDe({ bandeja: { ver: 'PROPIAS' } }),
      );
      const acceso = await servicio.miAcceso('user_1');
      expect(acceso.permisos.bandeja.ver).toBe('PROPIAS');
      const denegados = Object.values(acceso.permisos.usuarios);
      expect(denegados.every((v) => v === false || v === 'NINGUNA')).toBe(true);
    });

    it('un perfil sin ninguna sección deja fuera a la persona, con aviso', async () => {
      const { servicio } = preparar(ficha({ perfilId: 7 }), perfilDe({}));
      const acceso = await servicio.miAcceso('user_1');
      expect(acceso.estadoAcceso).toBe('CON_PERFIL');
      expect(acceso.puedeEntrar).toBe(false);
      expect(acceso.mensajeBloqueo).toContain('Aprobador');
    });
  });
});

describe('UsuariosWorkflowService.asignarPerfilAVarios', () => {
  function prepararMasivo(
    fichas: UsuarioWorkflowEntity[],
    perfil: PerfilPermisoEntity | null = perfilDe({}),
  ) {
    const guardadas: UsuarioWorkflowEntity[][] = [];
    const repo = {
      find: jest.fn().mockResolvedValue(fichas),
      save: jest.fn((lote: UsuarioWorkflowEntity[]) => {
        guardadas.push(lote);
        return Promise.resolve(lote);
      }),
    };
    const perfilesRepo = { findOneBy: jest.fn().mockResolvedValue(perfil) };
    const servicio = new UsuariosWorkflowService(
      repo as unknown as Repository<UsuarioWorkflowEntity>,
      perfilesRepo as unknown as Repository<PerfilPermisoEntity>,
    );
    return { servicio, repo, perfilesRepo, guardadas };
  }

  const aLista = (...fichas: UsuarioWorkflowEntity[]) =>
    fichas.map((f) => ({ retoolUserId: f.retoolUserId, email: f.email }));

  it('asigna el perfil a los colaboradores habilitados', async () => {
    const a = ficha({ retoolUserId: 'u1', email: 'a@cajalosandes.cl' });
    const b = ficha({ retoolUserId: 'u2', email: 'b@cajalosandes.cl' });
    const { servicio, guardadas } = prepararMasivo([a, b]);
    const r = await servicio.asignarPerfilAVarios({
      usuarios: aLista(a, b),
      perfilId: 7,
    });
    expect(r.asignados).toBe(2);
    expect(r.omitidos).toEqual([]);
    expect(r.perfilNombre).toBe('Aprobador');
    expect(guardadas[0].map((f) => f.perfilId)).toEqual([7, 7]);
  });

  it('omite administradores, fichas deshabilitadas y gente sin ficha', async () => {
    const admin = ficha({
      retoolUserId: 'u1',
      email: 'admin@cajalosandes.cl',
      tipoUsuario: 'ADMINISTRADOR',
    });
    const baja = ficha({
      retoolUserId: 'u2',
      email: 'baja@cajalosandes.cl',
      habilitado: false,
    });
    const sinFicha = { retoolUserId: 'u3', email: 'nueva@cajalosandes.cl' };
    const { servicio, repo } = prepararMasivo([admin, baja]);
    const r = await servicio.asignarPerfilAVarios({
      usuarios: [...aLista(admin, baja), sinFicha],
      perfilId: 7,
    });
    expect(r.asignados).toBe(0);
    expect(r.omitidos.map((o) => o.email)).toEqual([
      'admin@cajalosandes.cl',
      'baja@cajalosandes.cl',
      'nueva@cajalosandes.cl',
    ]);
    expect(r.omitidos[0].motivo).toContain('administrador');
    expect(r.omitidos[1].motivo).toContain('deshabilitada');
    expect(r.omitidos[2].motivo).toContain('ficha');
    // Nada que guardar: ninguna ficha cambió.
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('a quien ya tenía el perfil lo cuenta, pero no lo vuelve a guardar', async () => {
    const yaLoTiene = ficha({ retoolUserId: 'u1', perfilId: 7 });
    const { servicio, repo } = prepararMasivo([yaLoTiene]);
    const r = await servicio.asignarPerfilAVarios({
      usuarios: aLista(yaLoTiene),
      perfilId: 7,
    });
    expect(r.asignados).toBe(1);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('con perfilId nulo quita el perfil sin consultar perfiles', async () => {
    const conPerfil = ficha({ retoolUserId: 'u1', perfilId: 7 });
    const { servicio, perfilesRepo, guardadas } = prepararMasivo([conPerfil]);
    const r = await servicio.asignarPerfilAVarios({
      usuarios: aLista(conPerfil),
      perfilId: null,
    });
    expect(perfilesRepo.findOneBy).not.toHaveBeenCalled();
    expect(r.perfilNombre).toBeNull();
    expect(guardadas[0][0].perfilId).toBeNull();
  });

  it('rechaza un perfil que no existe, sin tocar ninguna ficha', async () => {
    const a = ficha({ retoolUserId: 'u1' });
    const { servicio, repo } = prepararMasivo([a], null);
    const error: unknown = await servicio
      .asignarPerfilAVarios({ usuarios: aLista(a), perfilId: 99 })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DominioException);
    const fallo = error as DominioException;
    expect(fallo.getStatus()).toBe(404);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
