import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { SolicitudGastoEntity } from '../database/entities/solicitud-gasto.entity';
import { RutaPagoEntity } from '../database/entities/ruta-pago.entity';
import { BitacoraAuditoriaEntity } from '../database/entities/bitacora-auditoria.entity';
import { LineaAjusteContableEntity } from '../database/entities/linea-ajuste-contable.entity';
import { ListarSolicitudesQueryDto } from './dto/listar-solicitudes-query.dto';
import { CrearSolicitudDto } from './dto/crear-solicitud.dto';
import { SolicitudesPaginadasDto } from './dto/solicitud-list-item.dto';
import { resolverSla } from '../common/sla.util';
import { resolverAcciones, resolverEstado } from '../common/estado-solicitud.util';
import { enmascararSiConfidencial, esRutaConfidencial } from '../common/confidencialidad.util';
import { DominioException } from '../common/dominio.exception';

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(SolicitudGastoEntity)
    private readonly solicitudRepo: Repository<SolicitudGastoEntity>,
    @InjectRepository(RutaPagoEntity)
    private readonly rutaRepo: Repository<RutaPagoEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Bandeja Contable. Filtra y pagina en el servidor (a diferencia del
   * prototipo, que traía todo y filtraba en el navegador).
   *
   * TODO: `puedeVerConfidenciales` debería venir de la sesión del usuario
   * (Keycloak) en vez de un parámetro fijo, apenas exista autenticación real.
   */
  async listar(query: ListarSolicitudesQueryDto, puedeVerConfidenciales = false): Promise<SolicitudesPaginadasDto> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const qb = this.solicitudRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.ruta', 'ruta')
      .orderBy('s.creadoEn', 'DESC');

    if (query.estado) qb.andWhere('s.estadoSolicitud = :estado', { estado: query.estado });
    if (query.ruta) qb.andWhere('s.rutaId = :ruta', { ruta: query.ruta });
    if (query.sociedad) qb.andWhere('ruta.sociedadSap = :sociedad', { sociedad: query.sociedad });
    if (query.q) {
      qb.andWhere(
        '(s.solicitudId ILIKE :q OR s.solicitante ILIKE :q OR s.numeroFactura ILIKE :q OR s.cecoId ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }

    const [rows, total] = await qb
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    const items = rows.map((r) => {
      const confidencial = esRutaConfidencial(r.rutaId);
      const iniciales = r.solicitante
        .split(' ')
        .map((p) => p[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

      const base = enmascararSiConfidencial(
        { solicitante: r.solicitante, monto: Number(r.montoClp) },
        confidencial,
        puedeVerConfidenciales,
      );

      const estado = resolverEstado(r.estadoSolicitud);

      return {
        id: r.solicitudId,
        solicitante: {
          nombre: base.solicitante,
          email: confidencial && !puedeVerConfidenciales
            ? 'restringido@cajalosandes.cl'
            : `${r.solicitante.toLowerCase().replace(/\s+/g, '.')}@cajalosandes.cl`,
          iniciales: confidencial && !puedeVerConfidenciales ? '--' : iniciales,
        },
        monto: {
          valor: base.monto,
          moneda: 'CLP',
          formateado: base.monto === null ? '########' : `$${base.monto.toLocaleString('es-CL')}`,
        },
        ruta: { id: r.rutaId, nombre: r.ruta.nombreRuta },
        sociedad: r.ruta.sociedadSap,
        estado,
        sla: resolverSla(r.estadoSolicitud, r.fechaLimiteSla),
        acciones: confidencial && !puedeVerConfidenciales ? [] : resolverAcciones(r.estadoSolicitud),
        confidencial,
        contabilizacion: {
          estado: r.voucherSapId ? (r.nroDocumentoSap ? 'posteado' : 'en_vuelo') : null,
          voucher: r.voucherSapId,
          documentoSap: r.nroDocumentoSap,
        },
      };
    });

    return { page, size, total, items };
  }

  /**
   * Crea la solicitud completa en una transacción: cabecera, líneas de
   * ajuste (si es R23) y los dos primeros pasos de bitácora. Equivale al
   * bloque try/except con commit/rollback de server_mock.py, pero
   * gestionado por TypeORM en vez de psycopg2 a mano.
   */
  async crear(dto: CrearSolicitudDto) {
    const ruta = await this.rutaRepo.findOneBy({ rutaId: dto.rutaId });
    if (!ruta) throw DominioException.rutaInvalida(dto.rutaId);

    if (dto.numeroFactura) {
      const duplicado = await this.solicitudRepo
        .createQueryBuilder('s')
        .where('s.numeroFactura = :factura', { factura: dto.numeroFactura })
        .andWhere('s.montoClp = :monto', { monto: dto.monto })
        .andWhere('s.estadoSolicitud <> :rechazado', { rechazado: 'RECHAZADO_CERRADO' })
        .getExists();
      if (duplicado) throw DominioException.gastoDuplicado(dto.numeroFactura, dto.monto);
    }

    if (dto.esAjusteContable && dto.lineasAjuste?.length) {
      const totalDebe = dto.lineasAjuste.reduce((acc, l) => acc + (l.origenMontoComp ?? 0), 0);
      const totalHaber = dto.lineasAjuste.reduce((acc, l) => acc + l.destinoMontoAjuste, 0);
      if (totalDebe !== totalHaber) throw DominioException.ajusteDescuadrado(totalDebe, totalHaber);
    }

    // Motor de reglas por monto (US2.1 / server_mock.py calcular_rol_aprobador)
    let requiereAprobacion = true;
    let rolAprobador = 'Supervisor Directo';
    if (dto.monto < 50_000) {
      requiereAprobacion = false;
      rolAprobador = 'Ninguno (Aprobado Automático)';
    } else if (dto.monto >= 5_000_000) {
      rolAprobador = 'Subgerente de Finanzas';
    }
    const estadoInicial = requiereAprobacion ? 'PENDIENTE_APROBACION' : 'APROBADO_CONTABILIZAR';

    const solicitudId = randomUUID().slice(0, 8).toUpperCase();

    await this.dataSource.transaction(async (manager) => {
      const solicitud = manager.create(SolicitudGastoEntity, {
        solicitudId,
        solicitante: dto.solicitante,
        rutaId: dto.rutaId,
        cecoId: dto.ceco,
        montoClp: dto.monto,
        numeroFactura: dto.numeroFactura ?? null,
        estadoSolicitud: estadoInicial,
        documentoNombre: dto.documentoNombre ?? null,
        documentoGcsUri: dto.documentoGcsUri ?? null,
        documentoPesoKb: dto.documentoPesoKb ?? null,
        solicitanteCargo: dto.cargoSolicitante ?? 'Colaborador',
        solicitanteGerencia: dto.gerenciaSolicitante ?? 'Contabilidad',
        bancoNombre: dto.bancoNombre ?? 'N/A',
        bancoTipoCuenta: dto.bancoTipoCuenta ?? 'N/A',
        bancoNroCuenta: dto.bancoNroCuenta ?? 'N/A',
        bancoRutTitular: dto.bancoRutTitular ?? 'N/A',
        medioPago: dto.medioPago ?? 'TRANSFERENCIA',
        beneficiarioCheque: dto.beneficiarioCheque ?? null,
        beneficiarioRut: dto.beneficiarioRut ?? null,
        // fechaLimiteSla la calcula el trigger fn_calcular_fecha_limite_sla en Postgres
      } as Partial<SolicitudGastoEntity>);

      await manager.insert(SolicitudGastoEntity, solicitud);

      if (dto.esAjusteContable && dto.lineasAjuste?.length) {
        const lineas = dto.lineasAjuste.map((l) =>
          manager.create(LineaAjusteContableEntity, {
            solicitudId,
            lineaSecuencia: l.lineaSecuencia,
            origenMontoComp: l.origenMontoComp ?? null,
            origenCod: l.origenCod ?? null,
            origenCuenta: l.origenCuenta,
            origenNumComp: l.origenNumComp ?? null,
            origenRut: l.origenRut ?? null,
            origenDv: l.origenDv ?? null,
            destinoMontoAjuste: l.destinoMontoAjuste,
            destinoCod: l.destinoCod ?? null,
            destinoCuenta: l.destinoCuenta,
            destinoObservacion: l.destinoObservacion ?? null,
          }),
        );
        await manager.insert(LineaAjusteContableEntity, lineas);
      }

      const bitacora: Partial<BitacoraAuditoriaEntity>[] = [
        {
          solicitudId,
          pasoNumero: 1,
          responsable: dto.solicitante,
          accionEjecutada: 'Creación de Ticket',
          estadoResultado: estadoInicial,
          comentario:
            dto.esAjusteContable && dto.lineasAjuste?.length
              ? `Planilla de ajustes contables cargada (${dto.lineasAjuste.length} líneas pre-validadas y cuadradas).`
              : 'Solicitud ingresada en formulario Retool.',
        },
        {
          solicitudId,
          pasoNumero: 2,
          responsable: 'Sistema de Reglas GCP',
          accionEjecutada: requiereAprobacion ? 'Asignación de Aprobador' : 'Auto-Aprobación',
          estadoResultado: estadoInicial,
          comentario: requiereAprobacion
            ? `Asignado a ${rolAprobador} por monto/matriz.`
            : 'Aprobación automática aplicada por bajo monto.',
        },
      ];
      await manager.insert(BitacoraAuditoriaEntity, bitacora);
    });

    return {
      id: solicitudId,
      estado: resolverEstado(estadoInicial),
      rolAprobador,
    };
  }
}
