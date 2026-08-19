import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SolicitudesService } from './solicitudes.service';
import { ListarSolicitudesQueryDto } from './dto/listar-solicitudes-query.dto';
import { CrearSolicitudDto } from './dto/crear-solicitud.dto';
import { SolicitudesPaginadasDto } from './dto/solicitud-list-item.dto';
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
}
