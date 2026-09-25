import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import {
  ApiConsumes,
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
import {
  ExportarPlanillaDto,
  ImportarPlanillaDto,
  ResultadoPlanillaDto,
} from './dto/planilla-usuarios.dto';

/** Una planilla de fichas no pesa ni un megabyte; 5 deja margen de sobra. */
const TAMANO_MAXIMO_PLANILLA = 5 * 1024 * 1024;

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

  @Post('planilla')
  @ApiOperation({
    summary: 'Descargar la planilla de fichas en Excel',
    description:
      'Devuelve un .xlsx con una fila por persona y listas desplegables en las columnas editables. ' +
      'La lista de personas la manda la pantalla —lo filtrado o lo marcado—, porque este servicio ' +
      'no conoce la Retool API. El mismo archivo es el que se vuelve a subir para importar.',
  })
  async exportarPlanilla(
    @Body() dto: ExportarPlanillaDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.service.exportarPlanilla(dto.usuarios);

    const ahora = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const nombreArchivo =
      `Usuarios_Workflow_${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}` +
      `_${pad(ahora.getHours())}-${pad(ahora.getMinutes())}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    });
    return new StreamableFile(buffer);
  }

  @Post('planilla/importar')
  @ApiOperation({
    summary: 'Revisar o aplicar la planilla de fichas',
    description:
      'Con aplicar=false (por defecto) no escribe nada: devuelve fila por fila qué pasaría, para ' +
      'mostrarlo antes de confirmar. Con aplicar=true guarda los cambios en una sola transacción. ' +
      'Nunca crea usuarios: una fila con alguien que no está en la lista de Retool se informa y se ' +
      'ignora. Tampoco asciende a nadie a administrador ni deja al sistema sin administradores.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: ResultadoPlanillaDto })
  @ApiResponse({
    status: 400,
    description: 'El archivo no se pudo leer o no tiene las columnas esperadas',
    type: ErrorResponseDto,
  })
  @UseInterceptors(
    // Se acepta como lista de un elemento, no como archivo único: Retool
    // manda el campo binario dentro de un arreglo y `single()` lo rechazaría.
    FilesInterceptor('file', 1, {
      storage: memoryStorage(),
      limits: { fileSize: TAMANO_MAXIMO_PLANILLA },
      fileFilter: (_req, file, callback) => {
        if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
          callback(
            new BadRequestException(
              'Sube el archivo .xlsx que descargaste desde el botón Exportar.',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  importarPlanilla(
    @UploadedFiles() archivos: Express.Multer.File[] | undefined,
    @Body() dto: ImportarPlanillaDto,
  ) {
    const archivo = (archivos ?? [])[0];
    if (!archivo) {
      throw new BadRequestException(
        'No se recibió ningún archivo (campo esperado: "file").',
      );
    }
    return this.service.importarPlanilla(
      archivo.buffer,
      dto.usuarios,
      dto.aplicar === true,
    );
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
