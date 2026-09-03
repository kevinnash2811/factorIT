import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RutasService } from './rutas.service';
import { RutaDetalleDto } from './dto/ruta-detalle.dto';
import { CrearRutaDto } from './dto/crear-ruta.dto';
import { ActualizarRutaDto } from './dto/actualizar-ruta.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

@ApiTags('Rutas')
@Controller('rutas')
export class RutasController {
  constructor(private readonly service: RutasService) {}

  @Get()
  @ApiOperation({
    summary: 'Matriz de Rutas de Pago',
    description:
      'Listado completo de rutas contables (sociedad, clase de documento, confidencialidad) para la ' +
      'pantalla de administración "Matriz de Reglas".',
  })
  @ApiOkResponse({ type: [RutaDetalleDto] })
  listar() {
    return this.service.listar();
  }

  @Post()
  @ApiOperation({
    summary: 'Crear ruta contable',
    description:
      'Da de alta una nueva ruta en la matriz de reglas. Editar/eliminar quedan pendientes de ' +
      'definir permisos por rol.',
  })
  @ApiCreatedResponse({ type: RutaDetalleDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos', type: ErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Ya existe una ruta con ese ID', type: ErrorResponseDto })
  crear(@Body() dto: CrearRutaDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar ruta contable',
    description: 'Modifica nombre, sociedad, clase de documento y confidencialidad de una ruta existente. El ID no se puede cambiar.',
  })
  @ApiParam({ name: 'id', example: 'R23' })
  @ApiOkResponse({ type: RutaDetalleDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada', type: ErrorResponseDto })
  actualizar(@Param('id') id: string, @Body() dto: ActualizarRutaDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Dar de baja una ruta contable',
    description:
      'No borra la fila (rompería el historial de solicitudes que ya la usaron) — la marca como ' +
      'inactiva. Sigue apareciendo en la Matriz de Reglas (bloqueada), pero deja de ofrecerse en el ' +
      'selector de "Nueva Solicitud".',
  })
  @ApiParam({ name: 'id', example: 'R23' })
  @ApiNoContentResponse()
  @ApiResponse({ status: 404, description: 'Ruta no encontrada', type: ErrorResponseDto })
  eliminar(@Param('id') id: string) {
    return this.service.eliminar(id);
  }

  @Patch(':id/reactivar')
  @ApiOperation({
    summary: 'Reactivar una ruta contable dada de baja',
    description: 'Vuelve a marcarla activa — vuelve a ofrecerse en el selector de "Nueva Solicitud".',
  })
  @ApiParam({ name: 'id', example: 'R23' })
  @ApiOkResponse({ type: RutaDetalleDto })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada', type: ErrorResponseDto })
  reactivar(@Param('id') id: string) {
    return this.service.reactivar(id);
  }
}
