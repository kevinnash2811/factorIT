import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CuentasTractaService } from './cuentas-tracta.service';
import {
  CuentaTractaItemDto,
  CuentasTractaListadoDto,
  ListarCuentasTractaQueryDto,
} from './dto/cuenta-tracta.dto';
import { OpcionesCuentasTractaDto } from './dto/cuenta-tracta.dto';
import { CrearCuentaTractaDto } from './dto/crear-cuenta-tracta.dto';
import { ActualizarCuentaTractaDto } from './dto/actualizar-cuenta-tracta.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

@ApiTags('Cuentas TRACTA')
@ApiResponse({
  status: 503,
  description: 'Oracle no disponible',
  type: ErrorResponseDto,
})
@Controller('cuentas-tracta')
export class CuentasTractaController {
  constructor(private readonly service: CuentasTractaService) {}

  @Get()
  @ApiOperation({
    summary: 'Parametrización de Cuentas Contables (Oracle ERP_TRACTA)',
    description:
      'Motor de reglas auxiliares de finanzas — cómo se asientan, distribuyen montos y asocian ' +
      'cuentas de control en el ERP SAP. Se lee de Oracle ("OPS$ANDES"."ERP_TRACTA"), paginado ' +
      '(pagina, tamano), de la secuencia más reciente a la más antigua.',
  })
  @ApiOkResponse({ type: CuentasTractaListadoDto })
  listar(@Query() query: ListarCuentasTractaQueryDto) {
    return this.service.listar(query);
  }

  @Get('opciones')
  @ApiOperation({
    summary: 'Opciones para los selectores de Cuentas Contables',
    description:
      'Sociedades, sistemas y clases de documento presentes en Oracle ERP_TRACTA, y los tipos de cuenta que acepta el formulario.',
  })
  @ApiOkResponse({ type: OpcionesCuentasTractaDto })
  opciones() {
    return this.service.opciones();
  }

  @Get('conexion')
  @ApiOperation({
    summary: 'Estado de la conexión a Oracle',
    description:
      'Indica si las variables ORACLE_* están configuradas, si Oracle responde y en cuánto tiempo.',
  })
  @ApiOkResponse({
    description: '{ configurado, conectado, latenciaMs, error }',
  })
  estadoConexion() {
    return this.service.estadoConexion();
  }

  @Post()
  @ApiOperation({
    summary: 'Parametrizar nueva cuenta TRACTA',
    description:
      'Da de alta una regla en Oracle ERP_TRACTA con la secuencia ERP_TCT_SEC. Las columnas que el ' +
      'formulario no pide (Debe/Haber, agrupación, vigencia, etc.) se copian de la regla activa más ' +
      'reciente de la misma empresa y sistema.',
  })
  @ApiCreatedResponse({ type: CuentaTractaItemDto })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Ya existe una regla activa con la misma empresa, sistema y transacción',
    type: ErrorResponseDto,
  })
  crear(@Body() dto: CrearCuentaTractaDto) {
    return this.service.crear(dto);
  }

  @Patch(':sec')
  @ApiOperation({
    summary: 'Actualizar cuenta TRACTA',
    description:
      'Modifica los campos del formulario de una regla existente. La secuencia (SEC) y el resto de las columnas de la regla no cambian.',
  })
  @ApiParam({ name: 'sec', example: 15646 })
  @ApiOkResponse({ type: CuentaTractaItemDto })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Cuenta TRACTA no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe otra regla activa con la misma clave',
    type: ErrorResponseDto,
  })
  actualizar(
    @Param('sec', ParseIntPipe) sec: number,
    @Body() dto: ActualizarCuentaTractaDto,
  ) {
    return this.service.actualizar(sec, dto);
  }

  @Delete(':sec')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Dar de baja una cuenta TRACTA',
    description:
      'No borra la fila (rompería la trazabilidad de transacciones ya asentadas con esta regla) — la ' +
      'marca como inactiva (TCT_ESTADO = "0"). Sigue apareciendo en el listado (bloqueada), con opción ' +
      'de reactivar.',
  })
  @ApiParam({ name: 'sec', example: 15646 })
  @ApiNoContentResponse()
  @ApiResponse({
    status: 404,
    description: 'Cuenta TRACTA no encontrada',
    type: ErrorResponseDto,
  })
  eliminar(@Param('sec', ParseIntPipe) sec: number) {
    return this.service.eliminar(sec);
  }

  @Patch(':sec/reactivar')
  @ApiOperation({
    summary: 'Reactivar una cuenta TRACTA dada de baja',
    description: 'Vuelve a marcarla activa (TCT_ESTADO = "1").',
  })
  @ApiParam({ name: 'sec', example: 15646 })
  @ApiOkResponse({ type: CuentaTractaItemDto })
  @ApiResponse({
    status: 404,
    description: 'Cuenta TRACTA no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe otra regla activa con la misma clave',
    type: ErrorResponseDto,
  })
  reactivar(@Param('sec', ParseIntPipe) sec: number) {
    return this.service.reactivar(sec);
  }
}
