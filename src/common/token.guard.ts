import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Llave compartida para el BFF.
 *
 * Existe porque el servicio se publica por un túnel a internet: sin esto, la
 * URL basta para leer todas las solicitudes —nombres, RUT, montos y cuentas
 * bancarias— y las URL de túnel se filtran solas (quedan en logs, historiales
 * y hay bots que escanean esos dominios).
 *
 * NO reemplaza la autenticación real por usuario, que sigue pendiente del SSO:
 * esto solo distingue "llamada desde nuestro Retool" de "cualquiera en
 * internet". Es una medida de contención mientras el servicio esté expuesto.
 *
 * Si API_TOKEN no está definido, el guard no bloquea nada: así el entorno
 * local sigue funcionando sin configuración extra.
 */
@Injectable()
export class TokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const esperado = this.config.get<string>('API_TOKEN');
    if (!esperado) return true;

    const req = context.switchToHttp().getRequest<Request>();

    // /health queda abierto para que el monitoreo y el healthcheck de Docker
    // no necesiten credenciales.
    if (req.path === '/health') return true;

    const recibido =
      (req.headers['x-api-token'] as string | undefined) ??
      (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

    if (recibido && recibido === esperado) return true;

    throw new UnauthorizedException({
      codigo: 'NO_AUTORIZADO',
      mensaje: 'Falta el token de acceso al servicio',
      detalle: 'Envía la cabecera x-api-token con el valor acordado.',
      reintentable: false,
    });
  }
}
