import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { SolicitudGastoEntity } from '../database/entities/solicitud-gasto.entity';
import { RutaPagoEntity } from '../database/entities/ruta-pago.entity';
import { BitacoraAuditoriaEntity } from '../database/entities/bitacora-auditoria.entity';
import { LineaAjusteContableEntity } from '../database/entities/linea-ajuste-contable.entity';
import { ListarSolicitudesQueryDto } from './dto/listar-solicitudes-query.dto';
import { CrearSolicitudDto } from './dto/crear-solicitud.dto';
import { SolicitudesPaginadasDto } from './dto/solicitud-list-item.dto';
import { BitacoraSolicitudDto } from './dto/bitacora-solicitud.dto';
import { SolicitudDetalleDto } from './dto/solicitud-detalle.dto';
import { AprobarSolicitudDto } from './dto/aprobar-solicitud.dto';
import { ContabilizarSolicitudResultadoDto } from './dto/contabilizar-solicitud.dto';
import { resolverSla } from '../common/sla.util';
import { resolverAcciones, resolverEstado } from '../common/estado-solicitud.util';
import { enmascararSiConfidencial } from '../common/confidencialidad.util';
import { DominioException } from '../common/dominio.exception';

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(SolicitudGastoEntity)
    private readonly solicitudRepo: Repository<SolicitudGastoEntity>,
    @InjectRepository(RutaPagoEntity)
    private readonly rutaRepo: Repository<RutaPagoEntity>,
    @InjectRepository(BitacoraAuditoriaEntity)
    private readonly bitacoraRepo: Repository<BitacoraAuditoriaEntity>,
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
  /**
   * Filtros compartidos entre listar() y exportar() — un único lugar que
   * decide qué solicitudes cumplen el criterio, para que la lista en
   * pantalla y el Excel exportado nunca puedan divergir.
   */
  private aplicarFiltros(qb: SelectQueryBuilder<SolicitudGastoEntity>, query: ListarSolicitudesQueryDto): void {
    if (query.estado) qb.andWhere('s.estadoSolicitud = :estado', { estado: query.estado });
    if (query.ruta) qb.andWhere('s.rutaId = :ruta', { ruta: query.ruta });
    if (query.sociedad) qb.andWhere('ruta.sociedadSap = :sociedad', { sociedad: query.sociedad });
    if (query.q) {
      qb.andWhere(
        '(s.solicitudId ILIKE :q OR s.solicitante ILIKE :q OR s.numeroFactura ILIKE :q OR s.cecoId ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }
    if (query.fechaDesde) {
      qb.andWhere('s.creadoEn >= :fechaDesde', { fechaDesde: query.fechaDesde });
    }
    if (query.fechaHasta) {
      const finDia = new Date(query.fechaHasta);
      finDia.setHours(23, 59, 59, 999);
      qb.andWhere('s.creadoEn <= :fechaHasta', { fechaHasta: finDia });
    }
    if (query.montoMin !== undefined) qb.andWhere('s.montoClp >= :montoMin', { montoMin: query.montoMin });
    if (query.montoMax !== undefined) qb.andWhere('s.montoClp <= :montoMax', { montoMax: query.montoMax });

    // El SLA no es una columna — se deriva de fecha_limite_sla vs. el
    // momento actual (mismo criterio que resolverSla en el mapeo de abajo),
    // así que el filtro se aplica como condición SQL equivalente.
    if (query.slaEstado === 'NO_CUMPLE') {
      qb.andWhere("s.estadoSolicitud <> 'INTEGRADO_SAP'")
        .andWhere('s.fechaLimiteSla IS NOT NULL')
        .andWhere('s.fechaLimiteSla < NOW()');
    } else if (query.slaEstado === 'CUMPLE') {
      qb.andWhere(
        "(s.estadoSolicitud = 'INTEGRADO_SAP' OR s.fechaLimiteSla IS NULL OR s.fechaLimiteSla >= NOW())",
      );
    }
  }

  async listar(query: ListarSolicitudesQueryDto, puedeVerConfidenciales = false): Promise<SolicitudesPaginadasDto> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const qb = this.solicitudRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.ruta', 'ruta')
      .leftJoinAndSelect('s.ceco', 'ceco')
      .orderBy('s.creadoEn', 'DESC');
    this.aplicarFiltros(qb, query);

    const [rows, total] = await qb
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    const qbSuma = this.solicitudRepo.createQueryBuilder('s').innerJoin('s.ruta', 'ruta');
    this.aplicarFiltros(qbSuma, query);
    const filaSuma = await qbSuma
      .select('COALESCE(SUM(s.montoClp), 0)', 'suma')
      .getRawOne<{ suma: string }>();
    const suma = filaSuma?.suma ?? '0';

    const items = rows.map((r) => {
      const confidencial = r.ruta.confidencial;
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
          cargo: r.solicitanteCargo,
          gerencia: r.solicitanteGerencia,
        },
        ceco: {
          id: r.cecoId,
          gerencia: r.ceco?.nombreGerencia ?? r.cecoId,
        },
        numeroFactura: r.numeroFactura,
        medioPago: r.medioPago,
        monto: {
          valor: base.monto,
          moneda: 'CLP',
          formateado: base.monto === null ? '########' : `$${base.monto.toLocaleString('es-CL')}`,
        },
        fechaCreacion: r.creadoEn.toISOString().slice(0, 10),
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

    return { page, size, total, montoTotalFiltrado: Number(suma), items };
  }

  /**
   * Exporta a Excel TODAS las solicitudes que cumplen el filtro (no solo la
   * página que se ve en pantalla), con las mismas reglas de presentación que
   * `listar()` — mismo enmascaramiento de confidenciales, mismas etiquetas de
   * estado y SLA. Nunca expone HTML ni campos crudos de la base: cada celda
   * ya trae el texto o número final tal como lo vería el usuario en Retool.
   */
  async exportar(query: ListarSolicitudesQueryDto, puedeVerConfidenciales = false): Promise<Buffer> {
    const TOPE_FILAS = 10_000;

    const qb = this.solicitudRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.ruta', 'ruta')
      .orderBy('s.creadoEn', 'DESC')
      .take(TOPE_FILAS);
    this.aplicarFiltros(qb, query);

    const rows = await qb.getMany();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Portal de Gestión Contable — CLA';
    workbook.created = new Date();

    const hoja = workbook.addWorksheet('Solicitudes', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    hoja.columns = [
      { header: 'ID', key: 'id', width: 14 },
      { header: 'Colaborador', key: 'colaborador', width: 28 },
      { header: 'Fecha Creación', key: 'fecha', width: 18 },
      { header: 'Monto (CLP)', key: 'monto', width: 16 },
      { header: 'Sociedad', key: 'sociedad', width: 10 },
      { header: 'Ruta Contable', key: 'ruta', width: 34 },
      { header: 'Estado', key: 'estado', width: 18 },
      { header: 'Control SLA', key: 'sla', width: 24 },
      { header: 'N° Factura', key: 'factura', width: 16 },
    ];

    const filaEncabezado = hoja.getRow(1);
    filaEncabezado.font = { bold: true, color: { argb: 'FF0F172A' } };
    filaEncabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    filaEncabezado.alignment = { vertical: 'middle' };

    for (const r of rows) {
      const confidencial = r.ruta.confidencial;
      const base = enmascararSiConfidencial(
        { solicitante: r.solicitante, monto: Number(r.montoClp) },
        confidencial,
        puedeVerConfidenciales,
      );
      const estado = resolverEstado(r.estadoSolicitud);
      const sla = resolverSla(r.estadoSolicitud, r.fechaLimiteSla);

      const fila = hoja.addRow({
        id: r.solicitudId,
        colaborador: base.solicitante,
        fecha: r.creadoEn,
        monto: base.monto ?? '########',
        sociedad: `Soc. ${r.ruta.sociedadSap}`,
        ruta: r.ruta.nombreRuta,
        estado: estado.etiqueta,
        sla: sla.etiqueta,
        factura: r.numeroFactura ?? '',
      });
      fila.getCell('fecha').numFmt = 'dd/mm/yyyy hh:mm';
      if (typeof base.monto === 'number') fila.getCell('monto').numFmt = '#,##0';
    }

    hoja.autoFilter = { from: 'A1', to: 'I1' };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
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
        descripcionDetalle: dto.descripcionDetalle ?? null,
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

  /**
   * Dar Visto Bueno (VB): PENDIENTE_APROBACION -> APROBADO_CONTABILIZAR.
   * Agrega el paso correspondiente a la bitácora en la misma transacción.
   */
  async aprobar(solicitudId: string, dto: AprobarSolicitudDto) {
    const solicitud = await this.solicitudRepo.findOneBy({ solicitudId });
    if (!solicitud) throw DominioException.solicitudNoEncontrada(solicitudId);
    if (solicitud.estadoSolicitud !== 'PENDIENTE_APROBACION') {
      throw DominioException.transicionInvalida(solicitud.estadoSolicitud, 'aprobar');
    }

    const nuevoEstado = 'APROBADO_CONTABILIZAR';
    await this.dataSource.transaction(async (manager) => {
      await manager.update(SolicitudGastoEntity, { solicitudId }, { estadoSolicitud: nuevoEstado });
      await manager.insert(BitacoraAuditoriaEntity, {
        solicitudId,
        pasoNumero: await this.siguientePaso(manager, solicitudId),
        responsable: dto.aprobador,
        accionEjecutada: 'Aprobación de Caso',
        estadoResultado: nuevoEstado,
        comentario: `Aprobación otorgada por ${dto.aprobador} mediante Retool.`,
      });
    });

    const estado = resolverEstado(nuevoEstado);
    return { id: solicitudId, estado: estado.codigo, estadoEtiqueta: estado.etiqueta };
  }

  /**
   * Integrar a SAP HANA: APROBADO_CONTABILIZAR -> INTEGRADO_SAP.
   * Genera un voucher contable y lo persiste junto con el paso de bitácora.
   *
   * Idempotente por `idempotencyKey`: si la misma clave ya se usó y la
   * solicitud ya está integrada, devuelve el resultado existente en vez de
   * volver a generar un voucher (evita duplicar el asiento si Retool
   * reintenta la llamada por un timeout de red).
   *
   * TODO: la resolución de cuenta de egreso SAP vía Oracle TRACTA (ISSUE-05)
   * todavía no está implementada — el comentario de bitácora es honesto
   * respecto a eso, sin inventar números de cuenta como hacía el prototipo.
   */
  async contabilizarSap(solicitudId: string, idempotencyKey: string): Promise<ContabilizarSolicitudResultadoDto> {
    const solicitud = await this.solicitudRepo.findOneBy({ solicitudId });
    if (!solicitud) throw DominioException.solicitudNoEncontrada(solicitudId);

    if (solicitud.estadoSolicitud === 'INTEGRADO_SAP' && solicitud.idempotencyKey === idempotencyKey) {
      const estado = resolverEstado(solicitud.estadoSolicitud);
      return {
        id: solicitudId,
        estado: estado.codigo,
        estadoEtiqueta: estado.etiqueta,
        voucherId: solicitud.voucherSapId ?? '',
        sociedad: solicitud.ruta?.sociedadSap ?? '',
      };
    }
    if (solicitud.estadoSolicitud !== 'APROBADO_CONTABILIZAR') {
      throw DominioException.transicionInvalida(solicitud.estadoSolicitud, 'contabilizar');
    }

    const ruta = await this.rutaRepo.findOneBy({ rutaId: solicitud.rutaId });
    const esAjusteContable = solicitud.rutaId === 'R23';
    const prefijoVoucher = esAjusteContable ? '10' : '17';
    const voucherId = `${prefijoVoucher}${Math.floor(100_000 + Math.random() * 899_999)}`;
    const nuevoEstado = 'INTEGRADO_SAP';

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        SolicitudGastoEntity,
        { solicitudId },
        {
          estadoSolicitud: nuevoEstado,
          voucherSapId: voucherId,
          nroDocumentoSap: voucherId,
          idempotencyKey,
        },
      );
      await manager.insert(BitacoraAuditoriaEntity, {
        solicitudId,
        pasoNumero: await this.siguientePaso(manager, solicitudId),
        responsable: 'Retool SAP Gateway',
        accionEjecutada: 'Integrado en SAP HANA',
        estadoResultado: nuevoEstado,
        comentario: `Asiento contable integrado en SAP HANA. Voucher asignado: ${voucherId} (Clase Doc: ${ruta?.claseDocumentoSap ?? '—'}, Sociedad: ${ruta?.sociedadSap ?? '—'}).`,
      });
    });

    const estado = resolverEstado(nuevoEstado);
    return { id: solicitudId, estado: estado.codigo, estadoEtiqueta: estado.etiqueta, voucherId, sociedad: ruta?.sociedadSap ?? '' };
  }

  private async siguientePaso(manager: DataSource['manager'], solicitudId: string): Promise<number> {
    const ultimo = await manager
      .createQueryBuilder(BitacoraAuditoriaEntity, 'b')
      .where('b.solicitudId = :solicitudId', { solicitudId })
      .orderBy('b.pasoNumero', 'DESC')
      .getOne();
    return (ultimo?.pasoNumero ?? 0) + 1;
  }

  /**
   * Detalle integral de la solicitud (colaborador, información financiera,
   * destino de pago, descripción, documento e historial de auditoría) para
   * el modal "DETALLE INTEGRAL DE SOLICITUD" del prototipo. Incluye el
   * mismo historial que /bitacora para que el modal no necesite una
   * segunda llamada.
   *
   * TODO: `puedeVerConfidenciales` debería venir de la sesión del usuario
   * (Keycloak) en vez de un parámetro fijo, igual que en `listar()`.
   */
  async obtenerDetalle(solicitudId: string, puedeVerConfidenciales = false): Promise<SolicitudDetalleDto> {
    const solicitud = await this.solicitudRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.ruta', 'ruta')
      .where('s.solicitudId = :solicitudId', { solicitudId })
      .getOne();
    if (!solicitud) throw DominioException.solicitudNoEncontrada(solicitudId);

    const pasos = await this.bitacoraRepo.find({
      where: { solicitudId },
      order: { pasoNumero: 'ASC' },
    });

    const confidencial = solicitud.ruta.confidencial;
    const base = enmascararSiConfidencial(
      { solicitante: solicitud.solicitante, monto: Number(solicitud.montoClp) },
      confidencial,
      puedeVerConfidenciales,
    );
    const ocultar = confidencial && !puedeVerConfidenciales;

    return {
      id: solicitud.solicitudId,
      estado: resolverEstado(solicitud.estadoSolicitud),
      acciones: ocultar ? [] : resolverAcciones(solicitud.estadoSolicitud),
      colaborador: {
        nombre: ocultar ? null : base.solicitante,
        email: ocultar ? null : `${solicitud.solicitante.toLowerCase().replace(/\s+/g, '.')}@cajalosandes.cl`,
        cargo: solicitud.solicitanteCargo ?? 'Colaborador',
        gerencia: solicitud.solicitanteGerencia ?? 'Contabilidad',
        creacion: solicitud.creadoEn.toISOString(),
        vencimiento: solicitud.fechaLimiteSla?.toISOString() ?? null,
      },
      informacionFinanciera: {
        rutaId: solicitud.rutaId,
        rutaNombre: solicitud.ruta.nombreRuta,
        sociedad: solicitud.ruta.sociedadSap,
        claseDocSap: solicitud.ruta.claseDocumentoSap,
        numeroFactura: solicitud.numeroFactura,
        monto: base.monto,
      },
      destinoPago: {
        medioPago: solicitud.medioPago ?? 'TRANSFERENCIA',
        bancoNombre: solicitud.bancoNombre,
        bancoTipoCuenta: solicitud.bancoTipoCuenta,
        bancoNroCuenta: solicitud.bancoNroCuenta,
        bancoRutTitular: solicitud.bancoRutTitular,
        beneficiarioCheque: solicitud.beneficiarioCheque,
        beneficiarioRut: solicitud.beneficiarioRut,
        cecoId: solicitud.cecoId,
      },
      descripcion: solicitud.descripcionDetalle,
      documento: solicitud.documentoNombre
        ? {
            nombre: solicitud.documentoNombre,
            url: solicitud.documentoGcsUri ?? '',
            pesoKb: solicitud.documentoPesoKb ?? '',
          }
        : null,
      confidencial,
      historial: pasos.map((p) => ({
        pasoNumero: p.pasoNumero,
        responsable: p.responsable,
        accionEjecutada: p.accionEjecutada,
        estadoResultado: p.estadoResultado,
        comentario: p.comentario,
        fecha: p.creadoEn.toISOString(),
      })),
    };
  }

  /**
   * Bitácora del caso: línea de tiempo del flujo CLA + el respaldo
   * documental adjuntado al crear la solicitud. Equivale al panel
   * "BITÁCORA DEL CASO" del prototipo (retool_mock.html).
   */
  async obtenerBitacora(solicitudId: string): Promise<BitacoraSolicitudDto> {
    const solicitud = await this.solicitudRepo.findOneBy({ solicitudId });
    if (!solicitud) throw DominioException.solicitudNoEncontrada(solicitudId);

    const pasos = await this.bitacoraRepo.find({
      where: { solicitudId },
      order: { pasoNumero: 'ASC' },
    });

    return {
      solicitudId,
      cargoSolicitante: `${solicitud.solicitanteCargo} (${solicitud.solicitanteGerencia})`,
      documento: solicitud.documentoNombre
        ? {
            nombre: solicitud.documentoNombre,
            url: solicitud.documentoGcsUri ?? '',
            pesoKb: solicitud.documentoPesoKb ?? '',
          }
        : null,
      pasos: pasos.map((p) => ({
        pasoNumero: p.pasoNumero,
        responsable: p.responsable,
        accionEjecutada: p.accionEjecutada,
        estadoResultado: p.estadoResultado,
        comentario: p.comentario,
        fecha: p.creadoEn.toISOString(),
      })),
    };
  }
}
