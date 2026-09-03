import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { DocumentosSubidosDto } from './dto/documento-subido.dto';

const EXTENSIONES_PERMITIDAS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];
const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB por archivo
const MAX_ARCHIVOS = 5;

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
    summary: 'Sube uno o varios respaldos (factura, boleta, Word, Excel) — hasta 5 por solicitud',
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
          callback(new BadRequestException(`Tipo de archivo no permitido: ${ext}`), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  subir(@UploadedFiles() archivos: Express.Multer.File[]): DocumentosSubidosDto {
    if (!archivos || archivos.length === 0) {
      throw new BadRequestException('No se recibió ningún archivo (campo esperado: "files").');
    }
    return {
      items: archivos.map((archivo) => ({
        nombre: archivo.originalname,
        url: `/documentos/archivos/${archivo.filename}`,
        pesoKb: (archivo.size / 1024).toFixed(1),
      })),
    };
  }
}
