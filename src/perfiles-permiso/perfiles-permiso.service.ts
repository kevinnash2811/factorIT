import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PerfilPermisoEntity } from '../database/entities/perfil-permiso.entity';
import { UsuarioWorkflowEntity } from '../database/entities/usuario-workflow.entity';
import {
  AccionResueltaDto,
  GuardarPerfilPermisoDto,
  PerfilPermisoDto,
  SeccionResueltaDto,
} from './dto/perfil-permiso.dto';
import {
  PermisoAccion,
  SECCIONES_PORTAL,
  SeccionPortal,
  permisosPorDefecto,
} from './secciones';

@Injectable()
export class PerfilesPermisoService {
  constructor(
    @InjectRepository(PerfilPermisoEntity)
    private readonly repo: Repository<PerfilPermisoEntity>,
    @InjectRepository(UsuarioWorkflowEntity)
    private readonly usuariosRepo: Repository<UsuarioWorkflowEntity>,
  ) {}

  /** Catálogo completo que el front usa para pintar la pantalla. */
  secciones(): SeccionPortal[] {
    return SECCIONES_PORTAL;
  }

  /** Los valores con los que nace un perfil nuevo, todos restrictivos. */
  plantillaVacia(): Record<string, Record<string, unknown>> {
    return permisosPorDefecto();
  }

  async listar(): Promise<PerfilPermisoDto[]> {
    const perfiles = await this.repo.find({ order: { nombre: 'ASC' } });

    // Se cuentan los colaboradores de todos los perfiles en una sola consulta,
    // en vez de una por perfil.
    const conteos = await this.usuariosRepo
      .createQueryBuilder('u')
      .select('u.perfil_id', 'perfilId')
      .addSelect('COUNT(*)', 'total')
      .where('u.perfil_id IS NOT NULL')
      .groupBy('u.perfil_id')
      .getRawMany<{ perfilId: number; total: string }>();

    const porPerfil = new Map(
      conteos.map((c) => [Number(c.perfilId), Number(c.total)]),
    );

    return perfiles.map((p) => this.aDto(p, porPerfil.get(p.perfilId) ?? 0));
  }

  async guardar(dto: GuardarPerfilPermisoDto): Promise<PerfilPermisoDto> {
    const permisos = this.normalizar(dto.permisos);
    // Las secciones se derivan de los permisos: una sección está activa si
    // aparece en el objeto. Así no hay dos fuentes que puedan discrepar.
    const secciones = Object.keys(permisos);

    if (secciones.length === 0) {
      throw new BadRequestException(
        'El perfil debe habilitar al menos una sección.',
      );
    }

    const ahora = new Date();

    if (dto.perfilId) {
      const existente = await this.repo.findOneBy({ perfilId: dto.perfilId });
      if (!existente) {
        throw new NotFoundException(`No existe el perfil ${dto.perfilId}`);
      }
      Object.assign(existente, {
        nombre: dto.nombre,
        descripcion:
          dto.descripcion === undefined ? existente.descripcion : dto.descripcion,
        secciones,
        permisos,
        activo: dto.activo ?? existente.activo,
        actualizadoEn: ahora,
      });
      const guardado = await this.repo.save(existente);
      return this.aDto(guardado, await this.contar(guardado.perfilId));
    }

    const nuevo = this.repo.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      secciones,
      permisos,
      activo: dto.activo ?? true,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
    return this.aDto(await this.repo.save(nuevo), 0);
  }

  /**
   * Borrar el perfil no borra las fichas: la columna perfil_id queda en NULL
   * por el ON DELETE SET NULL, así que esas personas simplemente se quedan sin
   * perfil en vez de desaparecer del módulo.
   */
  async eliminar(
    perfilId: number,
  ): Promise<{ eliminado: boolean; colaboradoresLiberados: number }> {
    const colaboradores = await this.contar(perfilId);
    const res = await this.repo.delete({ perfilId });
    return {
      eliminado: (res.affected ?? 0) > 0,
      colaboradoresLiberados: colaboradores,
    };
  }

  private contar(perfilId: number): Promise<number> {
    return this.usuariosRepo.countBy({ perfilId });
  }

  /**
   * Descarta secciones, acciones y valores que no existan en el catálogo.
   *
   * Es la única defensa real: el front puede mandar cualquier cosa, y guardar
   * una clave inventada dejaría un permiso que nadie sabe interpretar después.
   * Se rechaza en vez de ignorar en silencio para que el error se vea al
   * guardar y no meses más tarde.
   */
  private normalizar(
    entrada: Record<string, Record<string, unknown>>,
  ): Record<string, Record<string, unknown>> {
    const salida: Record<string, Record<string, unknown>> = {};

    for (const [claveSeccion, acciones] of Object.entries(entrada ?? {})) {
      const seccion = SECCIONES_PORTAL.find((s) => s.clave === claveSeccion);
      if (!seccion) {
        throw new BadRequestException(`La sección "${claveSeccion}" no existe.`);
      }

      salida[claveSeccion] = {};
      for (const accion of seccion.acciones) {
        const valor = (acciones ?? {})[accion.clave];
        salida[claveSeccion][accion.clave] = this.valorValido(
          seccion,
          accion,
          valor,
        );
      }
    }

    return salida;
  }

  private valorValido(
    seccion: SeccionPortal,
    accion: PermisoAccion,
    valor: unknown,
  ): string | boolean {
    if (accion.tipo === 'booleano') {
      if (valor === undefined || valor === null) return accion.porDefecto as boolean;
      return valor === true || valor === 'true';
    }

    const opciones = (accion.opciones ?? []).map((o) => o.valor);
    if (valor === undefined || valor === null) return accion.porDefecto as string;
    if (!opciones.includes(String(valor))) {
      throw new BadRequestException(
        `"${valor}" no es un valor válido para ${seccion.clave}.${accion.clave}. ` +
          `Valores aceptados: ${opciones.join(', ')}.`,
      );
    }
    return String(valor);
  }

  private aDto(p: PerfilPermisoEntity, colaboradores: number): PerfilPermisoDto {
    const claves = Array.isArray(p.secciones) ? p.secciones : [];
    const permisos = p.permisos ?? {};
    const detalleSecciones = SECCIONES_PORTAL.filter((s) =>
      claves.includes(s.clave),
    );

    let sensibles = 0;

    // Se devuelve el catálogo COMPLETO con los valores del perfil aplicados:
    // así el front pinta la pantalla sin cruzar dos fuentes ni decidir nada.
    const detalle: SeccionResueltaDto[] = SECCIONES_PORTAL.map((seccion) => {
      const activa = claves.includes(seccion.clave);
      const valores = permisos[seccion.clave] ?? {};

      const acciones: AccionResueltaDto[] = seccion.acciones.map((accion) => {
        const valor = (valores[accion.clave] ?? accion.porDefecto) as
          | string
          | boolean;
        const concedida =
          accion.tipo === 'booleano' ? valor === true : valor !== 'NINGUNA';

        if (activa && concedida && accion.sensible) sensibles++;

        return {
          clave: accion.clave,
          etiqueta: accion.etiqueta,
          valor,
          etiquetaValor:
            accion.tipo === 'booleano'
              ? valor === true
                ? 'Sí'
                : 'No'
              : (accion.opciones?.find((o) => o.valor === valor)?.etiqueta ??
                String(valor)),
          sensible: !!accion.sensible,
          activa: activa && concedida,
        };
      });

      return {
        clave: seccion.clave,
        etiqueta: seccion.etiqueta,
        icono: seccion.icono,
        activa,
        accionesActivas: acciones.filter((a) => a.activa).length,
        totalAcciones: seccion.acciones.length,
        acciones,
      };
    });

    return {
      perfilId: p.perfilId,
      nombre: p.nombre,
      descripcion: p.descripcion,
      secciones: claves,
      permisos,
      seccionesDetalle: detalleSecciones,
      detalle,
      resumenSecciones: `${claves.length} de ${SECCIONES_PORTAL.length} secciones`,
      permisosSensibles: sensibles,
      activo: p.activo,
      colaboradores,
      actualizadoEn: p.actualizadoEn,
    };
  }
}
