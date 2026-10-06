import { Body, Controller, Get, Header, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DriveService } from './drive.service';
import { CopiarDesdeDriveDto, ResultadoDriveDto } from './copiar-drive.dto';
import { paginaSelector, paginaSinConfigurar } from './selector.pagina';

/**
 * Adjuntar respaldos que el usuario tiene en su Google Drive.
 *
 * Son tres piezas: una consulta para saber si la función está habilitada —así
 * la pantalla puede explicar por qué el botón no está disponible en vez de
 * fallar al apretarlo—, la página del selector, y el endpoint que copia los
 * archivos elegidos.
 */
@ApiTags('Documentos')
@Controller('documentos/drive')
export class DriveController {
  constructor(private readonly service: DriveService) {}

  private configuracion() {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      apiKey: process.env.GOOGLE_API_KEY ?? '',
      origenPermitido: process.env.RETOOL_ORIGEN ?? '',
    };
  }

  @Get('configuracion')
  @ApiOperation({
    summary: '¿Está habilitado adjuntar desde Google Drive?',
    description:
      'No devuelve credenciales: solo si están cargadas. La pantalla lo usa para ' +
      'habilitar el botón y, cuando no lo está, explicar el motivo en vez de fallar.',
  })
  estado(): { habilitado: boolean; motivo: string | null } {
    const { clientId, apiKey } = this.configuracion();
    const habilitado = Boolean(clientId && apiKey);
    return {
      habilitado,
      motivo: habilitado
        ? null
        : 'Falta cargar las credenciales de Google en el servidor (GOOGLE_CLIENT_ID y GOOGLE_API_KEY).',
    };
  }

  @Get('selector')
  @ApiOperation({
    summary: 'Página que abre el selector de archivos de Google Drive',
    description:
      'Se abre en una ventana aparte desde el formulario. El token de Google se queda ' +
      'en esta página: a la aplicación solo le vuelven los archivos ya copiados.',
  })
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  selector(): string {
    const config = this.configuracion();
    return config.clientId && config.apiKey
      ? paginaSelector(config)
      : paginaSinConfigurar();
  }

  @Post('copiar')
  @ApiOperation({
    summary: 'Copia a este sistema los archivos elegidos en Drive',
    description:
      'Descarga cada archivo con el token del usuario y lo guarda igual que un respaldo ' +
      'subido desde el computador. Los documentos nativos de Google se convierten: ' +
      'un Documento o una Presentación llegan como PDF y una Hoja de cálculo como Excel. ' +
      'Devuelve además los que no se pudieron traer, con el motivo.',
  })
  @ApiOkResponse({ type: ResultadoDriveDto })
  copiar(@Body() dto: CopiarDesdeDriveDto) {
    return this.service.copiar(dto.archivos, dto.token);
  }
}
