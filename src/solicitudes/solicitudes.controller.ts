import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SolicitudesService } from './solicitudes.service';
import { ListarSolicitudesQueryDto } from './dto/listar-solicitudes-query.dto';
import {
  esFormatoValido,
  extensionDe,
  tipoDeContenido,
} from './exportacion.util';
import { CrearSolicitudDto } from './dto/crear-solicitud.dto';
import { SolicitudesPaginadasDto } from './dto/solicitud-list-item.dto';
import { BitacoraSolicitudDto } from './dto/bitacora-solicitud.dto';
import { SolicitudDetalleDto } from './dto/solicitud-detalle.dto';
import { AprobarSolicitudDto, AccionSolicitudResultadoDto } from './dto/aprobar-solicitud.dto';
import { ContabilizarSolicitudResultadoDto } from './dto/contabilizar-solicitud.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

@ApiTags('Solicitudes')
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly service: SolicitudesService) {}

  @Get()
  @ApiOperation({
    summary: 'Bandeja Contable',
    description:
      'Lista paginada de solicitudes con SLA, estado y acciones ya resueltos por el servidor. El front sólo pinta.',
  })
  @ApiOkResponse({ type: SolicitudesPaginadasDto })
  listar(@Query() query: ListarSolicitudesQueryDto) {
    // TODO: reemplazar `false` por el permiso real del usuario autenticado (Keycloak)
    return this.service.listar(query, false);
  }

  @Get('exportar')
  @ApiOperation({
    summary: 'Exportar solicitudes a Excel o CSV',
    description:
      'Genera el archivo con TODAS las solicitudes que cumplen los mismos filtros de la Bandeja ' +
      '(hasta un tope de 10.000 filas), no solo la página visible. Enmascara confidenciales igual ' +
      'que el listado — el archivo nunca expone más de lo que el usuario ve en pantalla. ' +
      'El formato "csv" sale con punto y coma y BOM para que Excel respete columnas y tildes; ' +
      '"csv-coma" usa coma, para procesarlo con otras herramientas.',
  })
  @ApiQuery({
    name: 'formato',
    required: false,
    enum: ['xlsx', 'csv', 'csv-coma'],
    description: 'Por defecto xlsx.',
  })
  async exportar(
    @Query() query: ListarSolicitudesQueryDto,
    @Query('formato') formato: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const elegido = esFormatoValido(formato) ? formato : 'xlsx';

    // TODO: reemplazar `false` por el permiso real del usuario autenticado (Keycloak)
    const buffer =
      elegido === 'xlsx'
        ? await this.service.exportar(query, false)
        : await this.service.exportarCsv(query, false, elegido);

    const ahora = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const nombreArchivo =
      `Solicitudes_${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}` +
      `_${pad(ahora.getHours())}-${pad(ahora.getMinutes())}.${extensionDe(elegido)}`;

    res.set({
      'Content-Type': tipoDeContenido(elegido),
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    });
    return new StreamableFile(buffer);
  }

  @Post()
  @ApiOperation({
    summary: 'Ingresar Solicitud',
    description:
      'Crea la cabecera, las líneas de ajuste (si aplica R23) y los dos primeros pasos de bitácora en una sola transacción.',
  })
  @ApiCreatedResponse({ description: 'Solicitud creada' })
  @ApiResponse({ status: 400, description: 'Ruta inválida, ajuste descuadrado, o error de validación', type: ErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Gasto duplicado (misma factura y monto)', type: ErrorResponseDto })
  crear(@Body() dto: CrearSolicitudDto) {
    return this.service.crear(dto);
  }

  @Patch(':id/aprobar')
  @ApiOperation({
    summary: 'Dar Visto Bueno (VB)',
    description: 'PENDIENTE_APROBACION -> APROBADO_CONTABILIZAR. Agrega el paso a la bitácora en la misma transacción.',
  })
  @ApiParam({ name: 'id', example: 'TKT-4122' })
  @ApiOkResponse({ type: AccionSolicitudResultadoDto })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada', type: ErrorResponseDto })
  @ApiResponse({ status: 409, description: 'La solicitud no está en estado PENDIENTE_APROBACION', type: ErrorResponseDto })
  aprobar(@Param('id') id: string, @Body() dto: AprobarSolicitudDto) {
    return this.service.aprobar(id, dto);
  }

  @Patch(':id/contabilizar')
  @ApiOperation({
    summary: 'Integrar a SAP HANA',
    description: 'APROBADO_CONTABILIZAR -> INTEGRADO_SAP. Genera un voucher contable y agrega el paso a la bitácora.',
  })
  @ApiParam({ name: 'id', example: 'TKT-4122' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Evita duplicar el voucher si Retool reintenta la llamada' })
  @ApiOkResponse({ type: ContabilizarSolicitudResultadoDto })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada', type: ErrorResponseDto })
  @ApiResponse({ status: 409, description: 'La solicitud no está en estado APROBADO_CONTABILIZAR', type: ErrorResponseDto })
  contabilizar(@Param('id') id: string, @Headers('idempotency-key') idempotencyKey: string) {
    return this.service.contabilizarSap(id, idempotencyKey ?? `KEY-${id}`);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle integral de la solicitud',
    description:
      'Colaborador, información financiera, destino de pago, descripción, documento e historial ' +
      'completo, para el modal "DETALLE INTEGRAL DE SOLICITUD".',
  })
  @ApiParam({ name: 'id', example: 'TKT-4122' })
  @ApiOkResponse({ type: SolicitudDetalleDto })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada', type: ErrorResponseDto })
  detalle(@Param('id') id: string) {
    // TODO: reemplazar `false` por el permiso real del usuario autenticado (Keycloak)
    return this.service.obtenerDetalle(id, false);
  }

  @Get(':id/bitacora')
  @ApiOperation({
    summary: 'Bitácora del caso',
    description:
      'Línea de tiempo del flujo (bitacora_auditoria) más el respaldo documental adjuntado al crear la solicitud.',
  })
  @ApiParam({ name: 'id', example: 'FNZ-130309' })
  @ApiOkResponse({ type: BitacoraSolicitudDto })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada', type: ErrorResponseDto })
  bitacora(@Param('id') id: string) {
    return this.service.obtenerBitacora(id);
  }
}
