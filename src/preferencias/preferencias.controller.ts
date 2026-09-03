import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PreferenciasService } from './preferencias.service';
import { ConsultarPreferenciaQueryDto, GuardarPreferenciaDto, PreferenciaDto } from './dto/preferencia.dto';

@ApiTags('Preferencias')
@Controller('preferencias')
export class PreferenciasController {
  constructor(private readonly service: PreferenciasService) {}

  @Get()
  @ApiOperation({
    summary: 'Preferencias de interfaz del usuario para una pantalla',
    description:
      'Devuelve las columnas que el usuario decidió ocultar. Se guarda en la base (no en el navegador) ' +
      'para que la configuración lo siga aunque entre desde otro equipo. Si nunca guardó nada, devuelve ' +
      'una lista vacía — equivale a "mostrar todas las columnas".',
  })
  @ApiOkResponse({ type: PreferenciaDto })
  obtener(@Query() query: ConsultarPreferenciaQueryDto) {
    return this.service.obtener(query);
  }

  @Put()
  @ApiOperation({
    summary: 'Guardar las preferencias de interfaz del usuario',
    description: 'Reemplaza la configuración de esa pantalla para ese usuario (upsert).',
  })
  @ApiOkResponse({ type: PreferenciaDto })
  guardar(@Body() dto: GuardarPreferenciaDto) {
    return this.service.guardar(dto);
  }
}
