import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SolicitudGastoEntity } from '../database/entities/solicitud-gasto.entity';
import { CentroCostoEntity } from '../database/entities/centro-costo.entity';
import { IndicadoresBandejaDto } from './dto/indicadores-bandeja.dto';
import { AlertasSlaDto } from './dto/alerta-sla.dto';
import { EficienciaCierresDto } from './dto/eficiencia-cierres.dto';
import { PresupuestoCecoDto } from './dto/presupuesto-ceco.dto';
import { GastosPorMesDto, SolicitudesPorEstadoDto } from './dto/gastos-por-mes.dto';
import { resolverEstado } from '../common/estado-solicitud.util';
import { resolverSla } from '../common/sla.util';
import { enmascararSiConfidencial } from '../common/confidencialidad.util';

const ESTADOS_TERMINALES = ['INTEGRADO_SAP', 'RECHAZADO_CERRADO'];

@Injectable()
export class IndicadoresService {
  constructor(
    @InjectRepository(SolicitudGastoEntity)
    private readonly solicitudRepo: Repository<SolicitudGastoEntity>,
    @InjectRepository(CentroCostoEntity)
    private readonly cecoRepo: Repository<CentroCostoEntity>,
  ) {}

  /**
   * presupuesto_gastado ya se mantiene al día solo — el trigger
   * fn_actualizar_consumo_presupuesto lo suma cada vez que una solicitud
   * pasa a APROBADO_CONTABILIZAR o INTEGRADO_SAP. Acá solo se resuelve la
   * presentación (saldo, %, color) igual que el resto del backend.
   */
  async presupuestoPorCeco(): Promise<PresupuestoCecoDto> {
    const cecos = await this.cecoRepo.find({ order: { cecoId: 'ASC' } });

    return {
      items: cecos.map((c) => {
        const total = Number(c.presupuestoTotal);
        const gastado = Number(c.presupuestoGastado);
        const consumoPct = total > 0 ? Number(((gastado / total) * 100).toFixed(1)) : 0;
        const color = consumoPct > 95 ? '#ef4444' : consumoPct > 80 ? '#f59e0b' : '#10b981';

        return {
          id: c.cecoId,
          nombre: c.nombreGerencia,
          presupuestoTotal: total,
          presupuestoGastado: gastado,
          saldoDisponible: total - gastado,
          consumoPct,
          color,
        };
      }),
    };
  }

  /**
   * Los 6 estados de solicitudes_gasto se reparten en 4 grupos sin
   * superposición ni huecos — cada estado cuenta en un solo tile.
   * Antes había un quinto tile "Por asignar" en el mock original, pero no
   * hay ninguna columna de asignación en el esquema (ni analista_id ni
   * similar); se retiró en vez de mostrar un número sin sustento real.
   */
  async bandeja(): Promise<IndicadoresBandejaDto> {
    const rows = await this.solicitudRepo
      .createQueryBuilder('s')
      .select('s.estadoSolicitud', 'estado')
      .addSelect('COUNT(*)', 'total')
      .groupBy('s.estadoSolicitud')
      .getRawMany<{ estado: string; total: string }>();

    const porEstado = new Map(rows.map((r) => [r.estado, Number(r.total)]));
    const contar = (...estados: string[]) => estados.reduce((acc, e) => acc + (porEstado.get(e) ?? 0), 0);

    return {
      items: [
        { clave: 'pendientes', etiqueta: 'Pendientes', valor: contar('PENDIENTE_APROBACION'), color: '#64748b' },
        {
          clave: 'porRevisar',
          etiqueta: 'Por Revisar',
          valor: contar('APROBADO_CONTABILIZAR', 'ERROR_SAP'),
          color: '#ef4444',
        },
        { clave: 'enReparo', etiqueta: 'En Reparo', valor: contar('EN_REPARO'), color: '#f59e0b' },
        {
          clave: 'cerrados',
          etiqueta: 'Cerrados',
          valor: contar('INTEGRADO_SAP', 'RECHAZADO_CERRADO'),
          color: '#10b981',
        },
      ],
      actualizadoEn: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
  }

  /**
   * Universo COMPLETO de tickets activos con SLA vencido o por vencer — a
   * propósito no acepta filtros ni paginación. Este panel tiene que
   * reflejar siempre todos los casos urgentes, independiente de qué esté
   * mirando el analista en la Bandeja en ese momento (si se filtrara junto
   * con la tabla, cambiar el filtro de la bandeja escondería alertas
   * reales sin que nadie lo note).
   *
   * TODO: `puedeVerConfidenciales` debería salir de la sesión real
   * (Keycloak), igual que en SolicitudesService.listar. Por ahora, postura
   * restrictiva: false.
   */
  async alertasSla(puedeVerConfidenciales = false): Promise<AlertasSlaDto> {
    const rows = await this.solicitudRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.ruta', 'ruta')
      .where('s.estadoSolicitud NOT IN (:...terminales)', { terminales: ESTADOS_TERMINALES })
      .andWhere('s.fechaLimiteSla IS NOT NULL')
      .getMany();

    const items = rows
      .map((r) => {
        const sla = resolverSla(r.estadoSolicitud, r.fechaLimiteSla);
        if (sla.estado !== 'VENCIDO' && sla.estado !== 'POR_VENCER') return null;

        const confidencial = r.ruta.confidencial;
        const base = enmascararSiConfidencial(
          { solicitante: r.solicitante, monto: Number(r.montoClp) },
          confidencial,
          puedeVerConfidenciales,
        );

        return {
          id: r.solicitudId,
          solicitante: base.solicitante,
          monto: base.monto,
          severidad: sla.estado as 'VENCIDO' | 'POR_VENCER',
          etiqueta: sla.etiqueta,
          color: sla.color,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      // Vencidos primero, y entre ellos los más atrasados arriba.
      .sort((a, b) => (a.severidad === b.severidad ? 0 : a.severidad === 'VENCIDO' ? -1 : 1));

    return { items, actualizadoEn: new Date().toISOString().replace('T', ' ').slice(0, 19) };
  }

  /**
   * Reemplaza el gráfico "Eficiencia de Cierres" del mock, que traía datos
   * de ejemplo de Retool (East/West/South/Central) sin ninguna relación con
   * CLA. La métrica real: de los tickets ya cerrados (INTEGRADO_SAP), ¿se
   * cerraron dentro o fuera del plazo de 48h hábiles?, agrupado por
   * gerencia (vía el CECO) en vez de una geografía inventada.
   *
   * Aproximación conocida: se usa `actualizado_en` como proxy del momento
   * de cierre, porque no hay una columna dedicada "fecha_integracion_sap".
   * Es razonable porque una vez en INTEGRADO_SAP el ticket no vuelve a
   * actualizarse — pero si eso cambia, este cálculo dejaría de ser preciso.
   */
  async eficienciaCierres(): Promise<EficienciaCierresDto> {
    const rows = await this.solicitudRepo
      .createQueryBuilder('s')
      .innerJoin('s.ceco', 'ceco')
      .select('ceco.nombreGerencia', 'gerencia')
      .addSelect('COUNT(*) FILTER (WHERE s.actualizado_en <= s.fecha_limite_sla)', 'aTiempo')
      .addSelect('COUNT(*) FILTER (WHERE s.actualizado_en > s.fecha_limite_sla)', 'vencidos')
      .where('s.estadoSolicitud = :estado', { estado: 'INTEGRADO_SAP' })
      .groupBy('ceco.nombreGerencia')
      .orderBy('ceco.nombreGerencia', 'ASC')
      .getRawMany<{ gerencia: string; aTiempo: string; vencidos: string }>();

    const items = rows.map((r) => {
      const aTiempo = Number(r.aTiempo);
      const vencidos = Number(r.vencidos);
      const total = aTiempo + vencidos;
      const cumplimientoPct = total > 0 ? Math.round((aTiempo / total) * 100) : 0;

      return {
        gerencia: r.gerencia,
        // Todas las gerencias empiezan con "Gerencia de ...", así que el
        // prefijo no distingue nada y obliga al gráfico a rotar las etiquetas
        // hasta volverlas ilegibles. Se recorta para el eje; el nombre
        // completo sigue disponible en `gerencia` para tooltips.
        gerenciaCorta: r.gerencia.replace(/^Gerencia de\s+/i, ''),
        aTiempo,
        vencidos,
        cumplimientoPct,
        // Semáforo con el mismo criterio que el resto del portal.
        color: cumplimientoPct >= 80 ? '#10b981' : cumplimientoPct >= 60 ? '#f59e0b' : '#ef4444',
      };
    });

    const totalATiempo = items.reduce((acc, i) => acc + i.aTiempo, 0);
    const totalCerrados = items.reduce((acc, i) => acc + i.aTiempo + i.vencidos, 0);

    return {
      items,
      cumplimientoGlobalPct: totalCerrados > 0 ? Math.round((totalATiempo / totalCerrados) * 100) : 0,
      actualizadoEn: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
  }

  /**
   * Reporte simple "Gastos por Mes" — cantidad de solicitudes y monto total
   * ingresado por mes, últimos 12 meses. Es el primer reporte del módulo
   * "Reportes" (US4.1): mientras se resuelve la vía BigQuery/Looker Studio
   * con el equipo de Datos, este es un reporte liviano contra la misma base
   * transaccional, sin depender de esa integración.
   */
  async gastosPorMes(): Promise<GastosPorMesDto> {
    const MESES_ES = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
    ];

    const rows = await this.solicitudRepo
      .createQueryBuilder('s')
      .select("to_char(s.creado_en, 'YYYY-MM')", 'mes')
      .addSelect('COUNT(*)', 'cantidad')
      .addSelect('SUM(s.monto_clp)', 'montoTotal')
      .where("s.creado_en >= (CURRENT_DATE - INTERVAL '12 months')")
      .groupBy("to_char(s.creado_en, 'YYYY-MM')")
      .orderBy('mes', 'ASC')
      .getRawMany<{ mes: string; cantidad: string; montoTotal: string }>();

    const items = rows.map((r) => {
      const [anio, mesNum] = r.mes.split('-');
      return {
        mes: r.mes,
        mesEtiqueta: `${MESES_ES[Number(mesNum) - 1]} ${anio}`,
        cantidad: Number(r.cantidad),
        montoTotal: Number(r.montoTotal),
      };
    });

    return {
      items,
      montoAcumulado: items.reduce((acc, i) => acc + i.montoTotal, 0),
      cantidadAcumulada: items.reduce((acc, i) => acc + i.cantidad, 0),
    };
  }

  /**
   * Segundo reporte del módulo "Reportes": composición de la cartera actual
   * por estado (los 6 estados reales de solicitudes_gasto, no los 4 grupos
   * de la Bandeja). Reutiliza resolverEstado para que la etiqueta y el color
   * sean exactamente los mismos que ve el analista en la tabla de la Bandeja.
   */
  async solicitudesPorEstado(): Promise<SolicitudesPorEstadoDto> {
    const ORDEN_FLUJO = [
      'PENDIENTE_APROBACION',
      'APROBADO_CONTABILIZAR',
      'EN_REPARO',
      'INTEGRADO_SAP',
      'ERROR_SAP',
      'RECHAZADO_CERRADO',
    ];

    const rows = await this.solicitudRepo
      .createQueryBuilder('s')
      .select('s.estadoSolicitud', 'estado')
      .addSelect('COUNT(*)', 'total')
      .groupBy('s.estadoSolicitud')
      .getRawMany<{ estado: string; total: string }>();

    const porEstado = new Map(rows.map((r) => [r.estado, Number(r.total)]));

    const items = ORDEN_FLUJO.filter((estado) => (porEstado.get(estado) ?? 0) > 0).map((estado) => {
      const resuelto = resolverEstado(estado);
      return {
        estado,
        etiqueta: resuelto.etiqueta,
        color: resuelto.color,
        cantidad: porEstado.get(estado) ?? 0,
      };
    });

    return { items, total: items.reduce((acc, i) => acc + i.cantidad, 0) };
  }
}
