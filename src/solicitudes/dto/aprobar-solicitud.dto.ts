import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AprobarSolicitudDto {
  @ApiProperty({ example: 'Gerente Finanzas', description: 'Nombre del aprobador que otorga el visto bueno' })
  @IsString()
  @IsNotEmpty()
  aprobador: string;
}

export class AccionSolicitudResultadoDto {
  @ApiProperty({ example: 'TKT-4122' })
  id: string;

  @ApiProperty({ example: 'APROBADO_CONTABILIZAR' })
  estado: string;

  @ApiProperty({ example: 'Aprobado Cont.' })
  estadoEtiqueta: string;
}
