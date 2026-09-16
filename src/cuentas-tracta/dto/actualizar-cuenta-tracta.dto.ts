import { OmitType } from '@nestjs/swagger';
import { CrearCuentaTractaDto } from './crear-cuenta-tracta.dto';

/**
 * Mismos campos y validaciones que el alta, sin el estado: se cambia con dar
 * de baja o reactivar.
 */
export class ActualizarCuentaTractaDto extends OmitType(CrearCuentaTractaDto, [
  'tctEstado',
] as const) {}
