import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsuariosWorkflowService } from './usuarios-workflow.service';
import {
  AsignarPerfilMasivoDto,
  GuardarUsuarioWorkflowDto,
  ResultadoAsignacionMasivaDto,
  UsuarioWorkflowDto,
} from './dto/usuario-workflow.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
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
      'Es lo que el front consulta para ocultar entradas del menú, bloquear secciones y ' +
      'deshabilitar botones. Se deniega por defecto: un ADMINISTRADOR accede a todo sin perfil; ' +
      'un colaborador sin perfil ve el menú bloqueado; quien no tiene ficha no entra al portal, ' +
      'y una ficha deshabilitada no da acceso a nada, aunque sea de un administrador.',
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

  @Put('perfil-masivo')
  @ApiOperation({
    summary: 'Asignar un perfil de permisos a varias personas',
    description:
      'Aplica el mismo perfil a una lista de usuarios en una sola llamada. Omite a quienes no ' +
      'corresponde —administradores, fichas deshabilitadas o gente sin ficha— y devuelve el motivo ' +
      'de cada omisión. Con perfilId nulo, quita el perfil: esas personas dejan de acceder a las ' +
      'secciones hasta que se les asigne otro. "Activo en Retool" no se valida aquí: este servicio ' +
      'no conoce la Retool API, ese filtro lo aplica la pantalla.',
  })
  @ApiOkResponse({ type: ResultadoAsignacionMasivaDto })
  @ApiResponse({
    status: 404,
    description: 'El perfil indicado no existe',
    type: ErrorResponseDto,
  })
  asignarPerfilAVarios(@Body() dto: AsignarPerfilMasivoDto) {
    return this.service.asignarPerfilAVarios(dto);
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
