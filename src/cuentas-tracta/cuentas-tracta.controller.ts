import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CuentasTractaService } from './cuentas-tracta.service';
import { CuentaTractaItemDto, CuentasTractaListadoDto, ListarCuentasTractaQueryDto } from './dto/cuenta-tracta.dto';
import { CrearCuentaTractaDto } from './dto/crear-cuenta-tracta.dto';
import { ActualizarCuentaTractaDto } from './dto/actualizar-cuenta-tracta.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

@ApiTags('Cuentas TRACTA')
@Controller('cuentas-tracta')
export class CuentasTractaController {
  constructor(private readonly service: CuentasTractaService) {}

  @Get()
  @ApiOperation({
    summary: 'Parametrización de Cuentas Contables (Oracle ERP_TRACTA)',
    description:
      'Motor de reglas auxiliares de finanzas — cómo se asientan, distribuyen montos y asocian ' +
      'cuentas de control en el ERP SAP.',
  })
  @ApiOkResponse({ type: CuentasTractaListadoDto })
  listar(@Query() query: ListarCuentasTractaQueryDto) {
    return this.service.listar(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Parametrizar nueva cuenta TRACTA',
    description:
      'Da de alta una nueva regla de asiento auxiliar Oracle → cuenta de control SAP. El resto de ' +
      'metadatos Oracle (Debe/Haber, agrupación, sucursal de agrupación) los aplica la base de datos ' +
      'con sus valores por defecto — mismo criterio que "Metadatos Oracle Sincronizados" del mock.',
  })
  @ApiCreatedResponse({ type: CuentaTractaItemDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos', type: ErrorResponseDto })
  crear(@Body() dto: CrearCuentaTractaDto) {
    return this.service.crear(dto);
  }

  @Patch(':sec')
  @ApiOperation({
    summary: 'Actualizar cuenta TRACTA',
    description: 'Modifica los datos de una regla de asiento auxiliar existente. La secuencia (SEC) no se puede cambiar.',
  })
  @ApiParam({ name: 'sec', example: 1 })
  @ApiOkResponse({ type: CuentaTractaItemDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Cuenta TRACTA no encontrada', type: ErrorResponseDto })
  actualizar(@Param('sec', ParseIntPipe) sec: number, @Body() dto: ActualizarCuentaTractaDto) {
    return this.service.actualizar(sec, dto);
  }

  @Delete(':sec')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Dar de baja una cuenta TRACTA',
    description:
      'No borra la fila (rompería la trazabilidad de transacciones ya asentadas con esta regla) — la ' +
      'marca como inactiva (tct_estado = "I"). Sigue apareciendo en el listado (bloqueada), con opción ' +
      'de reactivar.',
  })
  @ApiParam({ name: 'sec', example: 1 })
  @ApiNoContentResponse()
  @ApiResponse({ status: 404, description: 'Cuenta TRACTA no encontrada', type: ErrorResponseDto })
  eliminar(@Param('sec', ParseIntPipe) sec: number) {
    return this.service.eliminar(sec);
  }

  @Patch(':sec/reactivar')
  @ApiOperation({
    summary: 'Reactivar una cuenta TRACTA dada de baja',
    description: 'Vuelve a marcarla activa (tct_estado = "A").',
  })
  @ApiParam({ name: 'sec', example: 1 })
  @ApiOkResponse({ type: CuentaTractaItemDto })
  @ApiResponse({ status: 404, description: 'Cuenta TRACTA no encontrada', type: ErrorResponseDto })
  reactivar(@Param('sec', ParseIntPipe) sec: number) {
    return this.service.reactivar(sec);
  }
}
