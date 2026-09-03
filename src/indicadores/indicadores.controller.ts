import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IndicadoresService } from './indicadores.service';
import { IndicadoresBandejaDto } from './dto/indicadores-bandeja.dto';
import { AlertasSlaDto } from './dto/alerta-sla.dto';
import { EficienciaCierresDto } from './dto/eficiencia-cierres.dto';
import { PresupuestoCecoDto } from './dto/presupuesto-ceco.dto';
import { GastosPorMesDto, SolicitudesPorEstadoDto } from './dto/gastos-por-mes.dto';

@ApiTags('Indicadores')
@Controller('indicadores')
export class IndicadoresController {
  constructor(private readonly service: IndicadoresService) {}

  @Get('bandeja')
  @ApiOperation({
    summary: 'Los 4 KPIs de la cabecera de la Bandeja Contable',
    description:
      'Conteo en vivo por grupo de estado. No es un dato cacheado ni histórico — cada llamada recalcula contra la base actual.',
  })
  @ApiOkResponse({ type: IndicadoresBandejaDto })
  bandeja() {
    return this.service.bandeja();
  }

  @Get('alertas-sla')
  @ApiOperation({
    summary: 'Panel de Alertas Críticas SLA (sidebar derecho de la Bandeja)',
    description:
      'Todos los tickets activos con SLA vencido o por vencer, sin filtros ni paginación — a propósito independiente de lo que esté filtrado en la Bandeja.',
  })
  @ApiOkResponse({ type: AlertasSlaDto })
  alertasSla() {
    // TODO: reemplazar `false` por el permiso real del usuario autenticado (Keycloak)
    return this.service.alertasSla(false);
  }

  @Get('eficiencia-cierres')
  @ApiOperation({
    summary: 'Tickets cerrados a tiempo vs. vencidos, por gerencia',
    description:
      'Reemplaza el gráfico de ejemplo del mock (East/West/South/Central) por una métrica real: cumplimiento de SLA de los tickets ya integrados a SAP, agrupados por gerencia.',
  })
  @ApiOkResponse({ type: EficienciaCierresDto })
  eficienciaCierres() {
    return this.service.eficienciaCierres();
  }

  @Get('presupuesto-ceco')
  @ApiOperation({
    summary: 'Presupuesto CLA por Centro de Costo',
    description:
      'Presupuesto total, gastado, saldo y % de consumo por gerencia. El gasto acumulado se mantiene ' +
      'al día automáticamente por un trigger de Postgres cada vez que una solicitud se aprueba o se ' +
      'integra a SAP — este endpoint solo resuelve la presentación (saldo, %, color de semáforo).',
  })
  @ApiOkResponse({ type: PresupuestoCecoDto })
  presupuestoPorCeco() {
    return this.service.presupuestoPorCeco();
  }

  @Get('gastos-por-mes')
  @ApiOperation({
    summary: 'Reporte: Gastos por Mes',
    description:
      'Cantidad de solicitudes y monto total ingresado por mes, últimos 12 meses. Primer reporte del ' +
      'módulo "Reportes" — se usa la misma base transaccional mientras se define la vía BigQuery/Looker Studio.',
  })
  @ApiOkResponse({ type: GastosPorMesDto })
  gastosPorMes() {
    return this.service.gastosPorMes();
  }

  @Get('solicitudes-por-estado')
  @ApiOperation({
    summary: 'Reporte: Solicitudes por Estado',
    description:
      'Composición actual de la cartera por los 6 estados reales (no los 4 grupos de KPIs de la ' +
      'Bandeja). Misma etiqueta y color que ve el analista en la tabla.',
  })
  @ApiOkResponse({ type: SolicitudesPorEstadoDto })
  solicitudesPorEstado() {
    return this.service.solicitudesPorEstado();
  }
}
