import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { CodigoError, ErrorResponseDto } from './dto/error-response.dto';

/**
 * Traduce cualquier excepción a la forma { codigo, mensaje, detalle,
 * reintentable } que espera el front, incluidas las que lanza el
 * ValidationPipe de Nest (errores de class-validator) y las que no se
 * anticiparon (500).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // Ya viene con la forma { codigo, mensaje, detalle, reintentable } (DominioException)
      if (typeof body === 'object' && body !== null && 'codigo' in body) {
        response.status(status).json(body);
        return;
      }

      // Errores del ValidationPipe / excepciones estándar de Nest
      const mensajes =
        typeof body === 'object' && body !== null && 'message' in body
          ? (body as { message: string | string[] }).message
          : exception.message;

      const payload: ErrorResponseDto = {
        codigo: status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN ? 'NO_AUTORIZADO' : 'VALIDACION',
        mensaje: 'La solicitud no pudo procesarse',
        detalle: Array.isArray(mensajes) ? mensajes.join(' · ') : String(mensajes),
        reintentable: false,
      };
      response.status(status).json(payload);
      return;
    }

    this.logger.error(exception);
    const payload: ErrorResponseDto = {
      codigo: 'ERROR_INTERNO' as CodigoError,
      mensaje: 'Ocurrió un error inesperado',
      detalle: 'Intenta nuevamente. Si persiste, contacta al equipo de plataforma.',
      reintentable: true,
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }
}
