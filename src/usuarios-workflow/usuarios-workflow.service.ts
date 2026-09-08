import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UsuarioWorkflowEntity } from '../database/entities/usuario-workflow.entity';
import { PerfilPermisoEntity } from '../database/entities/perfil-permiso.entity';
import {
  GuardarUsuarioWorkflowDto,
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
   * Resuelve qué puede ver y hacer una persona. Es la única fuente que el
   * front consulta para ocultar menús y deshabilitar botones.
   *
   * Regla deliberada: **sin ficha o sin perfil no hay restricciones**. El
   * sistema está en construcción y 44 de 46 usuarios todavía no tienen ficha;
   * si "sin configurar" significara "sin acceso", el portal quedaría
   * inutilizable de golpe. Las restricciones se activan cuando alguien
   * asigna un perfil, que es un acto explícito.
   *
   * `PENDIENTE`: antes de producción hay que invertir este criterio a
   * "denegar por defecto" y configurar a todos previamente.
   */
  async miAcceso(clave: string): Promise<MiAccesoDto> {
    const fila = await this.repo.findOne({
      where: [{ retoolUserId: clave }, { email: clave }],
    });

    const todo = (valor: boolean) => {
      const secciones: Record<string, boolean> = {};
      const permisos: Record<string, Record<string, string | boolean>> = {};
      for (const s of SECCIONES_PORTAL) {
        secciones[s.clave] = valor;
        permisos[s.clave] = {};
        for (const a of s.acciones) {
          permisos[s.clave][a.clave] = a.tipo === 'booleano' ? valor : 'TODAS';
        }
      }
      return { secciones, permisos };
    };

    const sinFicha = !fila;
    const esAdmin = fila?.tipoUsuario === 'ADMINISTRADOR';

    if (sinFicha || esAdmin || !fila.perfilId) {
      const acceso = todo(true);
      return {
        usuario: fila?.email ?? clave,
        tipoUsuario: fila?.tipoUsuario ?? 'SIN_FICHA',
        esAdministrador: esAdmin,
        perfilNombre: null,
        restringido: false,
        ...acceso,
        mensajeSinPermiso: '',
      };
    }

    const perfil = await this.perfilesRepo.findOneBy({ perfilId: fila.perfilId });
    if (!perfil) {
      const acceso = todo(true);
      return {
        usuario: fila.email,
        tipoUsuario: fila.tipoUsuario,
        esAdministrador: false,
        perfilNombre: null,
        restringido: false,
        ...acceso,
        mensajeSinPermiso: '',
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

    return {
      usuario: fila.email,
      tipoUsuario: fila.tipoUsuario,
      esAdministrador: false,
      perfilNombre: perfil.nombre,
      restringido: true,
      secciones,
      permisos,
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
