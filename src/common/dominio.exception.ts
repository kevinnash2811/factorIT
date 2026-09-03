import { HttpException, HttpStatus } from '@nestjs/common';
import { CodigoError } from './dto/error-response.dto';

/**
 * Excepción única para errores de negocio, con el código tipado que espera
 * el front. Lanzarla desde cualquier service; el filtro global la traduce
 * a la forma { codigo, mensaje, detalle, reintentable }.
 */
export class DominioException extends HttpException {
  constructor(
    codigo: CodigoError,
    mensaje: string,
    detalle: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    reintentable = false,
  ) {
    super({ codigo, mensaje, detalle, reintentable }, status);
  }

  static gastoDuplicado(numeroFactura: string, monto: number): DominioException {
    return new DominioException(
      'REGLA_NEGOCIO',
      'Gasto duplicado detectado',
      `Ya existe un ticket procesado con la factura ${numeroFactura} por un monto de CLP ${monto}.`,
      HttpStatus.CONFLICT,
    );
  }

  static rutaInvalida(rutaId: string): DominioException {
    return new DominioException(
      'VALIDACION',
      'Ruta contable inválida',
      `La ruta ${rutaId} no existe en la matriz de reglas de CLA.`,
      HttpStatus.BAD_REQUEST,
    );
  }

  static rutaNoEncontrada(rutaId: string): DominioException {
    return new DominioException(
      'NO_ENCONTRADO',
      'Ruta contable no encontrada',
      `No existe una ruta con id ${rutaId} en la matriz de reglas.`,
      HttpStatus.NOT_FOUND,
    );
  }

  static rutaDuplicada(rutaId: string): DominioException {
    return new DominioException(
      'REGLA_NEGOCIO',
      'Ruta contable duplicada',
      `Ya existe una ruta con el ID ${rutaId} en la matriz de reglas.`,
      HttpStatus.CONFLICT,
    );
  }

  static cuentaTractaNoEncontrada(sec: number): DominioException {
    return new DominioException(
      'NO_ENCONTRADO',
      'Cuenta TRACTA no encontrada',
      `No existe una cuenta TRACTA con secuencia ${sec}.`,
      HttpStatus.NOT_FOUND,
    );
  }

  static solicitudNoEncontrada(id: string): DominioException {
    return new DominioException(
      'NO_ENCONTRADO',
      'Solicitud no encontrada',
      `No existe una solicitud con id ${id}.`,
      HttpStatus.NOT_FOUND,
    );
  }

  static transicionInvalida(estadoActual: string, accion: string): DominioException {
    return new DominioException(
      'REGLA_NEGOCIO',
      'Transición de estado inválida',
      `No se puede ejecutar "${accion}" sobre una solicitud en estado ${estadoActual}.`,
      HttpStatus.CONFLICT,
    );
  }

  static ajusteDescuadrado(totalDebe: number, totalHaber: number): DominioException {
    return new DominioException(
      'REGLA_NEGOCIO',
      'Ajuste contable descuadrado',
      `La suma de Debe (${totalDebe}) no coincide con la suma de Haber (${totalHaber}). No se puede registrar.`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
