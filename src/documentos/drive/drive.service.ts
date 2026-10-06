import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { DominioException } from '../../common/dominio.exception';
import {
  ArchivoDrive,
  PlanDeDescarga,
  TAMANO_MAXIMO_BYTES,
  planDeDescarga,
  validarSeleccion,
} from './drive-archivos.util';

export interface DocumentoCopiado {
  nombre: string;
  url: string;
  pesoKb: string;
  origen: 'drive';
  convertido: boolean;
}

export interface ArchivoRechazado {
  nombre: string;
  motivo: string;
}

export interface ResultadoCopia {
  items: DocumentoCopiado[];
  rechazados: ArchivoRechazado[];
}

/**
 * Trae a este sistema los archivos que el usuario eligió en su Drive.
 *
 * La copia la hace el servidor y no el navegador, por tres razones: el token
 * del usuario no viaja al front, el archivo queda guardado igual que cualquier
 * otro respaldo —y por lo tanto sigue disponible aunque después lo borren de
 * Drive—, y el control de seguridad del navegador no interviene, que es lo que
 * hoy impide adjuntar desde el computador en algunos equipos.
 */
@Injectable()
export class DriveService {
  private readonly log = new Logger(DriveService.name);

  async copiar(
    archivos: ArchivoDrive[],
    token: string,
  ): Promise<ResultadoCopia> {
    const problema = validarSeleccion(archivos);
    if (problema) throw DominioException.driveSeleccionInvalida(problema);

    const items: DocumentoCopiado[] = [];
    const rechazados: ArchivoRechazado[] = [];

    for (const archivo of archivos) {
      const decision = planDeDescarga(archivo);
      if ('error' in decision) {
        rechazados.push({ nombre: archivo.nombre, motivo: decision.error });
        continue;
      }

      try {
        items.push(await this.traerUno(decision.plan, token));
      } catch (e) {
        const motivo =
          e instanceof DominioException
            ? (e.getResponse() as { detalle?: string }).detalle ||
              'No se pudo traer el archivo.'
            : 'No se pudo traer el archivo desde Drive.';
        this.log.warn(`Drive rechazó "${archivo.nombre}": ${motivo}`);
        rechazados.push({ nombre: archivo.nombre, motivo });
      }
    }

    if (!items.length) {
      throw DominioException.driveSinArchivos(
        rechazados.map((r) => `${r.nombre}: ${r.motivo}`).join(' · ') ||
          'Ningún archivo se pudo traer desde Drive.',
      );
    }

    return { items, rechazados };
  }

  private async traerUno(
    plan: PlanDeDescarga,
    token: string,
  ): Promise<DocumentoCopiado> {
    const respuesta = await fetch(plan.url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!respuesta.ok) {
      // 401/403 casi siempre significan que la autorización expiró o que el
      // usuario no eligió ese archivo en el selector; conviene decirlo así en
      // vez de mostrar el código.
      const detalle =
        respuesta.status === 401 || respuesta.status === 403
          ? 'Google no autorizó la descarga. Vuelve a elegir el archivo desde el botón de Drive.'
          : `Google respondió ${respuesta.status} al pedir el archivo.`;
      throw DominioException.driveDescargaFallida(detalle);
    }

    const contenido = Buffer.from(await respuesta.arrayBuffer());
    if (contenido.length > TAMANO_MAXIMO_BYTES) {
      throw DominioException.driveDescargaFallida(
        `El archivo pesa ${(contenido.length / 1048576).toFixed(1)} MB y el máximo es ${TAMANO_MAXIMO_BYTES / 1048576} MB.`,
      );
    }
    if (contenido.length === 0) {
      throw DominioException.driveDescargaFallida('El archivo llegó vacío.');
    }

    const nombreEnDisco = `${randomUUID()}${plan.extension}`;
    await writeFile(join(process.cwd(), 'uploads', nombreEnDisco), contenido);

    return {
      nombre: plan.nombre,
      url: `/documentos/archivos/${nombreEnDisco}`,
      pesoKb: (contenido.length / 1024).toFixed(1),
      origen: 'drive',
      convertido: plan.convertido,
    };
  }
}
