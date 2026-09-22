import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { extname, join } from 'path';
import { DocumentosSubidosDto } from './dto/documento-subido.dto';

const EXTENSIONES_PERMITIDAS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.png',
  '.jpg',
  '.jpeg',
];
const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB por archivo
const MAX_ARCHIVOS = 5;

/**
 * El nombre en disco lo genera el servidor (UUID + extensión). Se valida
 * contra ese formato exacto porque llega por la URL: cualquier otra cosa
 * —barras, puntos suspensivos— sería un intento de salir de la carpeta.
 */
export function esNombreDeArchivoValido(nombre: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9]{1,5}$/.test(
    nombre,
  );
}

/**
 * Nombre con el que el archivo llega al computador de la persona. Se limpia
 * lo que rompería la cabecera o el sistema de archivos, y si no viene nada
 * utilizable se cae al nombre interno.
 */
export function nombreParaDescarga(
  propuesto: string | undefined,
  respaldo: string,
): string {
  const limpio = (propuesto ?? '')
    .replace(/[\r\n"\\/:*?<>|]+/g, '')
    // Sin puntos consecutivos: no son peligrosos en la cabecera, pero dejan
    // nombres raros cuando venían de una ruta con "../".
    .replace(/\.{2,}/g, '.')
    .trim()
    .slice(0, 120);
  return limpio.length > 0 ? limpio : respaldo;
}

/**
 * Almacenamiento PROVISIONAL en disco local del servidor, mientras se
 * resuelve el acceso a WCC (gestor documental corporativo). Ver la
 * decisión pendiente en ISSUE-02 / CONTEXTO_BASE_WORKFLOW_COMPLEMENTO.md.
 * No pensado para producción: sin replicación, sin backup, y el archivo
 * se pierde si se reconstruye el contenedor/VM sin persistir /uploads.
 */
@ApiTags('Documentos')
@Controller('documentos')
export class DocumentosController {
  @Post()
  @ApiOperation({
    summary:
      'Sube uno o varios respaldos (factura, boleta, Word, Excel) — hasta 5 por solicitud',
    description:
      'Almacenamiento provisional en disco del servidor. Reemplazar por WCC cuando haya acceso. ' +
      'Campo multipart esperado: "files" (puede repetirse varias veces en el mismo form-data).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: DocumentosSubidosDto })
  @UseInterceptors(
    FilesInterceptor('files', MAX_ARCHIVOS, {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, callback) => {
          const nombreUnico = `${randomUUID()}${extname(file.originalname)}`;
          callback(null, nombreUnico);
        },
      }),
      limits: { fileSize: TAMANO_MAXIMO_BYTES },
      fileFilter: (_req, file, callback) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
          callback(
            new BadRequestException(`Tipo de archivo no permitido: ${ext}`),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  subir(
    @UploadedFiles() archivos: Express.Multer.File[],
  ): DocumentosSubidosDto {
    if (!archivos || archivos.length === 0) {
      throw new BadRequestException(
        'No se recibió ningún archivo (campo esperado: "files").',
      );
    }
    return {
      items: archivos.map((archivo) => ({
        nombre: archivo.originalname,
        url: `/documentos/archivos/${archivo.filename}`,
        pesoKb: (archivo.size / 1024).toFixed(1),
      })),
    };
  }

  /**
   * Descarga el archivo en vez de mostrarlo. La ruta estática
   * `/documentos/archivos/<nombre>` sirve para la vista previa, pero el
   * navegador abre ahí las imágenes y los PDF en lugar de guardarlos; esta
   * variante manda la cabecera que fuerza la descarga, con el nombre
   * original del documento en lugar del UUID interno.
   */
  @Get('archivos/:nombre/descargar')
  @ApiOperation({
    summary: 'Descargar un respaldo con su nombre original',
    description:
      'Igual que la ruta estática del archivo, pero responde con Content-Disposition: attachment.',
  })
  @ApiParam({
    name: 'nombre',
    description: 'Nombre en disco (UUID con extensión).',
  })
  @ApiQuery({
    name: 'nombre',
    required: false,
    description:
      'Nombre con el que se guardará el archivo. Si no viene, se usa el interno.',
  })
  descargar(
    @Param('nombre') nombreEnDisco: string,
    @Query('nombre') nombreOriginal: string | undefined,
    @Res() res: Response,
  ): void {
    if (!esNombreDeArchivoValido(nombreEnDisco)) {
      throw new BadRequestException('Nombre de archivo inválido.');
    }
    const ruta = join(process.cwd(), 'uploads', nombreEnDisco);
    if (!existsSync(ruta)) {
      throw new NotFoundException(
        'El archivo ya no está disponible en el servidor.',
      );
    }
    res.download(ruta, nombreParaDescarga(nombreOriginal, nombreEnDisco));
  }
}
