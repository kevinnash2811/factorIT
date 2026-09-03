import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RutaPagoEntity } from '../database/entities/ruta-pago.entity';
import { SOCIEDADES, CLASES_DOCUMENTO } from '../common/rutas-catalogo.util';
import { DominioException } from '../common/dominio.exception';
import { RutaDetalleDto } from './dto/ruta-detalle.dto';
import { CrearRutaDto } from './dto/crear-ruta.dto';
import { ActualizarRutaDto } from './dto/actualizar-ruta.dto';

@Injectable()
export class RutasService {
  constructor(
    @InjectRepository(RutaPagoEntity)
    private readonly rutaRepo: Repository<RutaPagoEntity>,
  ) {}

  async listar(): Promise<RutaDetalleDto[]> {
    // Trae activas E inactivas — la Matriz de Reglas necesita mostrar las
    // bloqueadas (con opción de reactivar), no esconderlas. Quien sí filtra
    // solo activas es CatalogosService, para el selector de Nueva Solicitud.
    // Más recientes primero; las 23 rutas semilla comparten el mismo creado_en
    // (se insertaron en un solo lote), así que entre ellas cae de respaldo a
    // orden alfabético por id — solo las rutas creadas de verdad, una por una,
    // quedan realmente ordenadas por fecha.
    const rutas = await this.rutaRepo.find({ order: { creadoEn: 'DESC', rutaId: 'ASC' } });
    return rutas.map((r) => this.mapear(r));
  }

  /**
   * No borra la fila: rutas_pago no tiene ON DELETE en su FK desde
   * solicitudes_gasto, así que un DELETE real fallaría (o peor, rompería el
   * historial) apenas la ruta hubiera sido usada alguna vez. "Eliminar" acá
   * es dar de baja — deja de ofrecerse para solicitudes nuevas, pero las
   * solicitudes históricas que ya la usaron la siguen resolviendo bien.
   */
  async eliminar(id: string): Promise<void> {
    const ruta = await this.rutaRepo.findOneBy({ rutaId: id });
    if (!ruta) throw DominioException.rutaNoEncontrada(id);

    ruta.activo = false;
    await this.rutaRepo.save(ruta);
  }

  async reactivar(id: string): Promise<RutaDetalleDto> {
    const ruta = await this.rutaRepo.findOneBy({ rutaId: id });
    if (!ruta) throw DominioException.rutaNoEncontrada(id);

    ruta.activo = true;
    await this.rutaRepo.save(ruta);
    return this.mapear(ruta);
  }

  async crear(dto: CrearRutaDto): Promise<RutaDetalleDto> {
    const existente = await this.rutaRepo.findOneBy({ rutaId: dto.id });
    if (existente) throw DominioException.rutaDuplicada(dto.id);

    const nueva = this.rutaRepo.create({
      rutaId: dto.id,
      nombreRuta: dto.nombre,
      sociedadSap: dto.sociedad,
      claseDocumentoSap: dto.claseDocumento,
      confidencial: dto.confidencial ?? false,
      requiereDocumentoRespaldo: true,
    });
    await this.rutaRepo.save(nueva);
    return this.mapear(nueva);
  }

  async actualizar(id: string, dto: ActualizarRutaDto): Promise<RutaDetalleDto> {
    const ruta = await this.rutaRepo.findOneBy({ rutaId: id });
    if (!ruta) throw DominioException.rutaNoEncontrada(id);

    ruta.nombreRuta = dto.nombre;
    ruta.sociedadSap = dto.sociedad;
    ruta.claseDocumentoSap = dto.claseDocumento;
    ruta.confidencial = dto.confidencial ?? false;
    await this.rutaRepo.save(ruta);
    return this.mapear(ruta);
  }

  private mapear(r: RutaPagoEntity): RutaDetalleDto {
    const sociedad = SOCIEDADES[r.sociedadSap];
    return {
      id: r.rutaId,
      nombre: r.nombreRuta,
      sociedad: {
        codigo: r.sociedadSap,
        etiqueta: sociedad?.etiqueta ?? `Sociedad ${r.sociedadSap}`,
        nombre: sociedad?.nombre ?? r.sociedadSap,
      },
      claseDocumento: {
        codigo: r.claseDocumentoSap,
        descripcion: CLASES_DOCUMENTO[r.claseDocumentoSap] ?? r.claseDocumentoSap,
      },
      confidencial: r.confidencial
        ? { valor: true, etiqueta: 'Confidencial', color: '#ef4444', icono: '🔒' }
        : { valor: false, etiqueta: 'Pública', color: '#10b981', icono: '🔓' },
      requiereRespaldo: r.requiereDocumentoRespaldo,
      activo: r.activo,
      acciones: r.activo ? ['editar', 'eliminar'] : ['reactivar'],
    };
  }
}
