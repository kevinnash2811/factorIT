import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DominioException } from '../common/dominio.exception';
import { In, Repository } from 'typeorm';
import { UsuarioWorkflowEntity } from '../database/entities/usuario-workflow.entity';
import { PerfilPermisoEntity } from '../database/entities/perfil-permiso.entity';
import {
  AsignarPerfilMasivoDto,
  GuardarUsuarioWorkflowDto,
  OmitidoAsignacionDto,
  ResultadoAsignacionMasivaDto,
  UsuarioWorkflowDto,
} from './dto/usuario-workflow.dto';
import { MiAccesoDto } from './dto/mi-acceso.dto';
import { SECCIONES_PORTAL } from '../perfiles-permiso/secciones';

/** Etiquetas legibles. Se resuelven aquí para que el front solo pinte. */
const ETIQUETAS_NIVEL: Record<string, string> = {
  ANALISTA: 'Analista',
  SUPERVISOR: 'Supervisor',
  SUBGERENCIA: 'Subgerencia',
  GERENCIA_NEGOCIO: 'Gerencia de Negocio',
  GERENCIA_GENERAL: 'Gerencia General',
};

const COLORES_TIPO: Record<string, string> = {
  ADMINISTRADOR: '#8b5cf6',
  COLABORADOR: '#0284c7',
};

@Injectable()
export class UsuariosWorkflowService {
  constructor(
    @InjectRepository(UsuarioWorkflowEntity)
    private readonly repo: Repository<UsuarioWorkflowEntity>,
    @InjectRepository(PerfilPermisoEntity)
    private readonly perfilesRepo: Repository<PerfilPermisoEntity>,
  ) {}

  /** Nombre de cada perfil, para resolverlo sin una consulta por fila. */
  private async nombresDePerfil(): Promise<Map<number, string>> {
    const perfiles = await this.perfilesRepo.find();
    return new Map(perfiles.map((p) => [p.perfilId, p.nombre]));
  }

  /**
   * Devuelve las fichas del Workflow. El front las cruza contra la lista de
   * Retool: aquí no sabemos quiénes existen allá, y preguntarlo obligaría a
   * este servicio a llevar el token de la Retool API.
   */
  async listar(): Promise<UsuarioWorkflowDto[]> {
    const [filas, nombres] = await Promise.all([
      this.repo.find({ order: { email: 'ASC' } }),
      this.nombresDePerfil(),
    ]);
    return filas.map((f) => this.aDto(f, nombres));
  }

  /**
   * Resuelve la ficha de una persona. Acepta el id de Retool o el correo,
   * porque el identificador que expone la app puede no venir en el mismo
   * formato que el id de la API.
   */
  async obtener(clave: string): Promise<UsuarioWorkflowDto | null> {
    const fila = await this.repo.findOne({
      where: [{ retoolUserId: clave }, { email: clave }],
    });
    return fila ? this.aDto(fila, await this.nombresDePerfil()) : null;
  }

  /**
   * Upsert por retoolUserId: guardar dos veces al mismo usuario actualiza su
   * ficha en vez de crear una segunda.
   */
  async guardar(dto: GuardarUsuarioWorkflowDto): Promise<UsuarioWorkflowDto> {
    const existente = await this.repo.findOneBy({
      retoolUserId: dto.retoolUserId,
    });
    const ahora = new Date();

    if (existente) {
      // Se distingue "no vino en el cuerpo" (undefined → se conserva) de
      // "vino vacío" (null → se borra). El formulario envía todos los campos,
      // así que vaciar el RUT en pantalla tiene que vaciarlo en la base; con
      // `??` el dato viejo quedaría pegado y el usuario no entendería por qué.
      const sinCambio = <T>(nuevo: T | null | undefined, actual: T | null) =>
        nuevo === undefined ? actual : nuevo;

      Object.assign(existente, {
        email: dto.email ?? existente.email,
        rut: sinCambio(dto.rut, existente.rut),
        nivelJerarquico: sinCambio(dto.nivelJerarquico, existente.nivelJerarquico),
        plazoSlaHoras: sinCambio(dto.plazoSlaHoras, existente.plazoSlaHoras),
        icono: sinCambio(dto.icono, existente.icono),
        observaciones: sinCambio(dto.observaciones, existente.observaciones),
        tipoUsuario: dto.tipoUsuario ?? existente.tipoUsuario,
        habilitado: dto.habilitado ?? existente.habilitado,
        perfilId: sinCambio(dto.perfilId, existente.perfilId),
        actualizadoEn: ahora,
      });
      return this.aDto(await this.repo.save(existente), await this.nombresDePerfil());
    }

    const nuevo = this.repo.create({
      retoolUserId: dto.retoolUserId,
      email: dto.email,
      rut: dto.rut ?? null,
      nivelJerarquico: dto.nivelJerarquico ?? null,
      plazoSlaHoras: dto.plazoSlaHoras ?? null,
      icono: dto.icono ?? null,
      observaciones: dto.observaciones ?? null,
      tipoUsuario: dto.tipoUsuario ?? 'COLABORADOR',
      habilitado: dto.habilitado ?? true,
      perfilId: dto.perfilId ?? null,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    return this.aDto(await this.repo.save(nuevo), await this.nombresDePerfil());
  }

  /**
   * Asigna el mismo perfil a varias personas de una vez.
   *
   * La elegibilidad se valida acá y no solo en la pantalla: un administrador no
   * necesita perfil y una ficha deshabilitada no debería recibir accesos. Cada
   * omisión vuelve con su motivo, para que quien la ejecutó vea qué quedó fuera
   * en vez de suponer que se aplicó a todos.
   *
   * "Activo en Retool" no se puede comprobar desde acá — este servicio no
   * conoce la Retool API —, así que ese filtro vive en el front.
   */
  async asignarPerfilAVarios(
    dto: AsignarPerfilMasivoDto,
  ): Promise<ResultadoAsignacionMasivaDto> {
    const perfilId = dto.perfilId ?? null;
    let perfilNombre: string | null = null;

    if (perfilId !== null) {
      const perfil = await this.perfilesRepo.findOneBy({ perfilId });
      if (!perfil) throw DominioException.perfilNoEncontrado(perfilId);
      perfilNombre = perfil.nombre;
    }

    const fichas = await this.repo.find({
      where: { retoolUserId: In(dto.usuarios.map((u) => u.retoolUserId)) },
    });
    const porId = new Map(fichas.map((f) => [f.retoolUserId, f]));

    const omitidos: OmitidoAsignacionDto[] = [];
    const porGuardar: UsuarioWorkflowEntity[] = [];
    const ahora = new Date();
    let asignados = 0;

    for (const u of dto.usuarios) {
      const ficha = porId.get(u.retoolUserId);
      if (!ficha) {
        omitidos.push({
          email: u.email,
          motivo:
            'No tiene ficha del Workflow: créala antes de asignarle un perfil.',
        });
        continue;
      }
      if (ficha.tipoUsuario === 'ADMINISTRADOR') {
        omitidos.push({
          email: u.email,
          motivo: 'Es administrador: ya accede a todo el sistema.',
        });
        continue;
      }
      if (!ficha.habilitado) {
        omitidos.push({
          email: u.email,
          motivo: 'Su ficha está deshabilitada: habilítala primero.',
        });
        continue;
      }
      // Quien ya tenía el perfil cuenta como asignado, pero no se vuelve a guardar.
      asignados++;
      if (ficha.perfilId === perfilId) continue;
      ficha.perfilId = perfilId;
      ficha.actualizadoEn = ahora;
      porGuardar.push(ficha);
    }

    if (porGuardar.length > 0) await this.repo.save(porGuardar);

    return { asignados, omitidos, perfilNombre };
  }

  /**
   * Resuelve qué puede ver y hacer una persona. Es la única fuente que el
   * front consulta para ocultar menús y deshabilitar botones.
   *
   * Regla: **se deniega por defecto**. Sin ficha en el Workflow no se entra al
   * portal, y un colaborador sin perfil no puede abrir ninguna sección. La
   * única excepción es el administrador: accede a todo y no necesita perfil.
   *
   * `menu` y `secciones` son distintos a propósito. Al colaborador sin perfil
   * se le muestran las entradas del menú bloqueadas, para que vea qué existe y
   * sepa qué pedir; un portal vacío parecería roto. `secciones` es lo que
   * realmente puede abrir.
   *
   * Ojo: esto decide lo que se ve, no lo que se puede hacer. Mientras los
   * endpoints no validen el permiso por su cuenta, sigue siendo una barrera de
   * interfaz.
   */
  async miAcceso(clave: string): Promise<MiAccesoDto> {
    const fila = await this.repo.findOne({
      where: [{ retoolUserId: clave }, { email: clave }],
    });

    const TITULO_SIN_FICHA = 'No tienes acceso al Portal de Gestión Contable';
    const MENSAJE_SIN_FICHA =
      'Tu cuenta no está autorizada para ingresar al sistema de Gestión Contable. ' +
      'Solicita la autorización al administrador del sistema para que te asignen ' +
      'un tipo de cuenta y un perfil de permisos.';
    const TITULO_DESHABILITADO = 'Tu acceso está dado de baja';
    const MENSAJE_DESHABILITADO =
      'Tu ficha del Workflow existe, pero está deshabilitada, así que no tienes ' +
      'acceso al sistema de Gestión Contable. Solicita al administrador del ' +
      'sistema que la vuelva a habilitar.';
    const TITULO_SIN_PERFIL = 'Todavía no tienes permisos asignados';
    const MENSAJE_SIN_PERFIL =
      'Tu cuenta está dada de alta, pero aún no tiene un perfil de permisos, así ' +
      'que no puedes abrir ninguna sección. En el menú puedes ver las secciones ' +
      'del sistema, bloqueadas: solicita al administrador del sistema de Gestión ' +
      'Contable el perfil que necesitas.';

    /** El mismo valor para todas las secciones del catálogo. */
    const mapa = (valor: boolean) => {
      const m: Record<string, boolean> = {};
      for (const s of SECCIONES_PORTAL) m[s.clave] = valor;
      return m;
    };

    const permisosDe = (valor: boolean) => {
      const permisos: Record<string, Record<string, string | boolean>> = {};
      for (const s of SECCIONES_PORTAL) {
        permisos[s.clave] = {};
        for (const a of s.acciones) {
          permisos[s.clave][a.clave] =
            a.tipo === 'booleano' ? valor : valor ? 'TODAS' : 'NINGUNA';
        }
      }
      return permisos;
    };

    // Sin ficha no hay nada que mostrar: ni secciones ni menú.
    if (!fila) {
      return {
        usuario: clave,
        tipoUsuario: 'SIN_FICHA',
        esAdministrador: false,
        perfilNombre: null,
        restringido: true,
        estadoAcceso: 'SIN_FICHA',
        puedeEntrar: false,
        menu: mapa(false),
        secciones: mapa(false),
        permisos: permisosDe(false),
        tituloBloqueo: TITULO_SIN_FICHA,
        mensajeBloqueo: MENSAJE_SIN_FICHA,
        mensajeSinPermiso: MENSAJE_SIN_FICHA,
      };
    }

    // Ficha dada de baja: el registro se conserva, pero no da acceso a nada.
    // Se comprueba antes que el tipo de cuenta, así la baja también corta el
    // acceso de un administrador.
    if (!fila.habilitado) {
      return {
        usuario: fila.email,
        tipoUsuario: fila.tipoUsuario,
        esAdministrador: false,
        perfilNombre: null,
        restringido: true,
        estadoAcceso: 'DESHABILITADO',
        puedeEntrar: false,
        menu: mapa(false),
        secciones: mapa(false),
        permisos: permisosDe(false),
        tituloBloqueo: TITULO_DESHABILITADO,
        mensajeBloqueo: MENSAJE_DESHABILITADO,
        mensajeSinPermiso: MENSAJE_DESHABILITADO,
      };
    }

    // El administrador accede a todo y no necesita perfil.
    if (fila.tipoUsuario === 'ADMINISTRADOR') {
      return {
        usuario: fila.email,
        tipoUsuario: fila.tipoUsuario,
        esAdministrador: true,
        perfilNombre: null,
        restringido: false,
        estadoAcceso: 'ADMINISTRADOR',
        puedeEntrar: true,
        menu: mapa(true),
        secciones: mapa(true),
        permisos: permisosDe(true),
        tituloBloqueo: '',
        mensajeBloqueo: '',
        mensajeSinPermiso: '',
      };
    }

    const perfil = fila.perfilId
      ? await this.perfilesRepo.findOneBy({ perfilId: fila.perfilId })
      : null;

    // Colaborador con ficha pero sin perfil, o con uno que ya no existe: ve el
    // menú completo y bloqueado, para saber qué acceso pedir.
    if (!perfil) {
      return {
        usuario: fila.email,
        tipoUsuario: fila.tipoUsuario,
        esAdministrador: false,
        perfilNombre: null,
        restringido: true,
        estadoAcceso: 'SIN_PERFIL',
        puedeEntrar: false,
        menu: mapa(true),
        secciones: mapa(false),
        permisos: permisosDe(false),
        tituloBloqueo: TITULO_SIN_PERFIL,
        mensajeBloqueo: MENSAJE_SIN_PERFIL,
        mensajeSinPermiso: MENSAJE_SIN_PERFIL,
      };
    }

    const guardados = perfil.permisos ?? {};
    const secciones: Record<string, boolean> = {};
    const permisos: Record<string, Record<string, string | boolean>> = {};

    for (const s of SECCIONES_PORTAL) {
      const valores = guardados[s.clave];
      // Una sección ausente del perfil está denegada: no aparece en el menú.
      secciones[s.clave] = !!valores;
      permisos[s.clave] = {};
      for (const a of s.acciones) {
        if (!valores) {
          permisos[s.clave][a.clave] = a.tipo === 'booleano' ? false : 'NINGUNA';
          continue;
        }
        const v = valores[a.clave];
        permisos[s.clave][a.clave] =
          (v as string | boolean) ?? (a.porDefecto as string | boolean);
      }
    }

    // Un perfil sin ninguna sección deja a la persona fuera igual que si no
    // tuviera perfil: se le avisa en vez de mostrarle un portal vacío.
    const algunaSeccion = Object.values(secciones).some(Boolean);

    return {
      usuario: fila.email,
      tipoUsuario: fila.tipoUsuario,
      esAdministrador: false,
      perfilNombre: perfil.nombre,
      restringido: true,
      estadoAcceso: 'CON_PERFIL',
      puedeEntrar: algunaSeccion,
      menu: { ...secciones },
      secciones,
      permisos,
      tituloBloqueo: algunaSeccion ? '' : TITULO_SIN_PERFIL,
      mensajeBloqueo: algunaSeccion
        ? ''
        : `Tu perfil "${perfil.nombre}" no tiene ninguna sección habilitada. ` +
          'Solicita al administrador del sistema de Gestión Contable el acceso que necesitas.',
      mensajeSinPermiso:
        `Tu perfil "${perfil.nombre}" no incluye esta acción. ` +
        'Solicítala al administrador del sistema.',
    };
  }

  /** Borra la ficha del Workflow. El usuario sigue existiendo en Retool. */
  async eliminar(retoolUserId: string): Promise<{ eliminado: boolean }> {
    const res = await this.repo.delete({ retoolUserId });
    return { eliminado: (res.affected ?? 0) > 0 };
  }

  private aDto(
    f: UsuarioWorkflowEntity,
    nombresPerfil: Map<number, string> = new Map(),
  ): UsuarioWorkflowDto {
    return {
      retoolUserId: f.retoolUserId,
      email: f.email,
      rut: f.rut,
      nivelJerarquico: f.nivelJerarquico,
      nivelJerarquicoEtiqueta: f.nivelJerarquico
        ? (ETIQUETAS_NIVEL[f.nivelJerarquico] ?? f.nivelJerarquico)
        : null,
      plazoSlaHoras: f.plazoSlaHoras,
      plazoSlaEtiqueta: f.plazoSlaHoras ? `${f.plazoSlaHoras} horas` : null,
      icono: f.icono,
      observaciones: f.observaciones,
      tipoUsuario: f.tipoUsuario,
      tipoUsuarioColor: COLORES_TIPO[f.tipoUsuario] ?? '#64748b',
      habilitado: f.habilitado,
      perfilId: f.perfilId,
      perfilNombre: f.perfilId ? (nombresPerfil.get(f.perfilId) ?? null) : null,
      configurado: true,
      actualizadoEn: f.actualizadoEn,
    };
  }
}
