import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsuariosWorkflowService } from './usuarios-workflow.service';
import {
  GuardarUsuarioWorkflowDto,
  UsuarioWorkflowDto,
} from './dto/usuario-workflow.dto';
import { MiAccesoDto } from './dto/mi-acceso.dto';

@ApiTags('Usuarios Workflow')
@Controller('usuarios-workflow')
export class UsuariosWorkflowController {
  constructor(private readonly service: UsuariosWorkflowService) {}

  @Get()
  @ApiOperation({
    summary: 'Fichas del Workflow de todos los usuarios configurados',
    description:
      'Devuelve solo lo que Retool no sabe (RUT, nivel jerárquico, plazo de SLA, tipo de cuenta). ' +
      'El nombre, el correo y si está activo se leen de la Retool API — aquí no se duplican. ' +
      'El front cruza ambas listas por retoolUserId.',
  })
  @ApiOkResponse({ type: [UsuarioWorkflowDto] })
  listar() {
    return this.service.listar();
  }

  @Get('mi-acceso')
  @ApiOperation({
    summary: 'Qué puede ver y hacer una persona (por parámetro de consulta)',
    description:
      'Misma respuesta que la variante con la clave en la ruta. Existe porque Retool arma ' +
      'las URL con parámetros de forma más predecible que con segmentos de ruta.',
  })
  @ApiOkResponse({ type: MiAccesoDto })
  miAccesoPorQuery(@Query('usuario') usuario: string) {
    return this.service.miAcceso(usuario);
  }

  @Get('mi-acceso/:clave')
  @ApiOperation({
    summary: 'Qué puede ver y hacer una persona',
    description:
      'Combina el tipo de cuenta con el perfil asignado y devuelve el resultado ya resuelto. ' +
      'Es lo que el front consulta para ocultar entradas del menú y deshabilitar botones. ' +
      'Un ADMINISTRADOR recibe acceso total; quien no tiene ficha o no tiene perfil no queda restringido.',
  })
  @ApiOkResponse({ type: MiAccesoDto })
  miAcceso(@Param('clave') clave: string) {
    return this.service.miAcceso(clave);
  }

  @Get(':clave')
  @ApiOperation({
    summary: 'Ficha de un usuario',
    description:
      'La clave puede ser el id de Retool o el correo: el identificador que expone la app ' +
      'no siempre viene en el mismo formato que el id de la API.',
  })
  @ApiOkResponse({ type: UsuarioWorkflowDto })
  obtener(@Param('clave') clave: string) {
    return this.service.obtener(clave);
  }

  @Put()
  @ApiOperation({
    summary: 'Crear o actualizar la ficha de un usuario',
    description:
      'Upsert por retoolUserId. Los campos que no vengan en el cuerpo se conservan, ' +
      'así el formulario puede enviar solo lo que cambió.',
  })
  @ApiOkResponse({ type: UsuarioWorkflowDto })
  guardar(@Body() dto: GuardarUsuarioWorkflowDto) {
    return this.service.guardar(dto);
  }

  @Delete(':retoolUserId')
  @ApiOperation({
    summary: 'Quitar la ficha del Workflow',
    description:
      'Solo borra los datos de este módulo. El usuario sigue existiendo en Retool.',
  })
  eliminar(@Param('retoolUserId') retoolUserId: string) {
    return this.service.eliminar(retoolUserId);
  }
}
