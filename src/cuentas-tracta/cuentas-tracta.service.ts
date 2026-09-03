import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpTractaEntity } from '../database/entities/erp-tracta.entity';
import { CuentaTractaItemDto, CuentasTractaListadoDto, ListarCuentasTractaQueryDto } from './dto/cuenta-tracta.dto';
import { CrearCuentaTractaDto } from './dto/crear-cuenta-tracta.dto';
import { ActualizarCuentaTractaDto } from './dto/actualizar-cuenta-tracta.dto';
import { DominioException } from '../common/dominio.exception';

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
  if (limpio === '' || limpio === 'undefined' || limpio === 'null') return undefined;
  return limpio;
}

@Injectable()
export class CuentasTractaService {
  constructor(
    @InjectRepository(ErpTractaEntity)
    private readonly tractaRepo: Repository<ErpTractaEntity>,
  ) {}

  async listar(query: ListarCuentasTractaQueryDto): Promise<CuentasTractaListadoDto> {
    const sociedad = valorFiltro(query.sociedad);
    const sistema = valorFiltro(query.sistema);
    const q = valorFiltro(query.q);

    // Más reciente primero: tct_secuencia es SERIAL, así que el valor más
    // alto es siempre el último registro creado.
    const qb = this.tractaRepo.createQueryBuilder('t').orderBy('t.tctSecuencia', 'DESC');

    if (sociedad) qb.andWhere('t.erpEmpresa = :sociedad', { sociedad });
    if (sistema) qb.andWhere('t.sisSistema = :sistema', { sistema });
    if (q) {
      qb.andWhere(
        '(t.tctGlosaTrans ILIKE :q OR t.tctTransaccion ILIKE :q OR t.tctCuentaSap ILIKE :q OR t.tctCtaAux ILIKE :q OR t.cenNumcen ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    const [rows, sociedades, sistemas] = await Promise.all([
      qb.getMany(),
      this.tractaRepo
        .createQueryBuilder('t')
        .select('DISTINCT t.erpEmpresa', 'valor')
        .orderBy('valor', 'ASC')
        .getRawMany<{ valor: string }>(),
      this.tractaRepo
        .createQueryBuilder('t')
        .select('DISTINCT t.sisSistema', 'valor')
        .orderBy('valor', 'ASC')
        .getRawMany<{ valor: string }>(),
    ]);

    return {
      items: rows.map((r) => this.mapear(r)),
      sociedadesDisponibles: sociedades.map((s) => s.valor),
      sistemasDisponibles: sistemas.map((s) => s.valor),
    };
  }

  /**
   * Solo se piden los campos que muestra el formulario (ver imagen de
   * referencia de Workflow_Contabilidad) — el resto de columnas de
   * erp_tracta (tct_debe_haber, tct_agrupa, tct_suc_agrupa, tct_con_cme,
   * etc.) se dejan sin asignar a propósito para que Postgres aplique sus
   * propios DEFAULT del esquema, igual que hace el "Metadatos Oracle
   * Sincronizados" del mock (D / NAC / VOU). tct_secuencia tampoco se toca:
   * es SERIAL, la base la autogenera sola.
   */
  async crear(dto: CrearCuentaTractaDto): Promise<CuentaTractaItemDto> {
    const nueva = this.tractaRepo.create({
      erpEmpresa: dto.erpEmpresa,
      sisSistema: dto.sisSistema,
      tctTransaccion: dto.tctTransaccion,
      tctGlosaTrans: dto.tctGlosaTrans,
      tctClaseCuenta: dto.tctClaseCuenta,
      parTipodocCaja: dto.parTipodocCaja,
      tctCuentaSap: dto.tctCuentaSap,
      tctCtaAux: dto.tctCtaAux,
      tctContraCta: dto.tctContraCta,
      tctCentroBenef: dto.tctCentroBenef,
      cenNumcen: dto.cenNumcen,
      tctValUni: dto.tctValUni ?? 1,
      tctEstado: dto.tctEstado ?? 'A',
    });
    const guardada = await this.tractaRepo.save(nueva);
    return this.mapear(guardada);
  }

  async actualizar(sec: number, dto: ActualizarCuentaTractaDto): Promise<CuentaTractaItemDto> {
    const cuenta = await this.tractaRepo.findOneBy({ tctSecuencia: sec });
    if (!cuenta) throw DominioException.cuentaTractaNoEncontrada(sec);

    cuenta.erpEmpresa = dto.erpEmpresa;
    cuenta.sisSistema = dto.sisSistema;
    cuenta.tctTransaccion = dto.tctTransaccion;
    cuenta.tctGlosaTrans = dto.tctGlosaTrans;
    cuenta.tctClaseCuenta = dto.tctClaseCuenta;
    cuenta.parTipodocCaja = dto.parTipodocCaja;
    cuenta.tctCuentaSap = dto.tctCuentaSap;
    cuenta.tctCtaAux = dto.tctCtaAux ?? null;
    cuenta.tctContraCta = dto.tctContraCta ?? null;
    cuenta.tctCentroBenef = dto.tctCentroBenef ?? null;
    cuenta.cenNumcen = dto.cenNumcen ?? null;
    cuenta.tctValUni = dto.tctValUni ?? 1;
    await this.tractaRepo.save(cuenta);
    return this.mapear(cuenta);
  }

  /**
   * No se borra la fila: erp_tracta es el motor de reglas que ya se usó para
   * asentar transacciones — perder la regla rompería la trazabilidad de lo
   * ya conciliado en SAP. "Eliminar" reutiliza el propio campo tct_estado
   * (A/I) que ya existe en la tabla en vez de agregar una columna nueva:
   * marcarla "I" la bloquea (deja de listarse como opción activa) igual que
   * el patrón activo=false de rutas_pago.
   */
  async eliminar(sec: number): Promise<void> {
    const cuenta = await this.tractaRepo.findOneBy({ tctSecuencia: sec });
    if (!cuenta) throw DominioException.cuentaTractaNoEncontrada(sec);

    cuenta.tctEstado = 'I';
    await this.tractaRepo.save(cuenta);
  }

  async reactivar(sec: number): Promise<CuentaTractaItemDto> {
    const cuenta = await this.tractaRepo.findOneBy({ tctSecuencia: sec });
    if (!cuenta) throw DominioException.cuentaTractaNoEncontrada(sec);

    cuenta.tctEstado = 'A';
    await this.tractaRepo.save(cuenta);
    return this.mapear(cuenta);
  }

  private mapear(r: ErpTractaEntity): CuentaTractaItemDto {
    return {
      sec: r.tctSecuencia,
      emp: r.erpEmpresa,
      sis: r.sisSistema,
      transaccion: r.tctTransaccion,
      glosa: r.tctGlosaTrans,
      tCta: r.tctClaseCuenta,
      ctaMayorSap: r.tctCuentaSap,
      ctaAuxiliarSap: r.tctCtaAux,
      contraCtaSap: r.tctContraCta,
      tDoc: r.parTipodocCaja,
      cebeSap: r.tctCentroBenef,
      cencosSap: r.cenNumcen,
      valU: r.tctValUni,
      estadoEtiqueta: r.tctEstado === 'A' ? 'ACTIVO' : 'INACTIVO',
      estadoColor: r.tctEstado === 'A' ? '#10b981' : '#64748b',
      acciones: r.tctEstado === 'A' ? ['editar', 'eliminar'] : ['reactivar'],
    };
  }
}
