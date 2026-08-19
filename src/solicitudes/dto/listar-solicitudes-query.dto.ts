import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListarSolicitudesQueryDto {
  @ApiPropertyOptional({
    enum: ['PENDIENTE_APROBACION', 'APROBADO_CONTABILIZAR', 'EN_REPARO', 'INTEGRADO_SAP', 'ERROR_SAP', 'RECHAZADO_CERRADO'],
  })
  @IsOptional()
  @IsIn(['PENDIENTE_APROBACION', 'APROBADO_CONTABILIZAR', 'EN_REPARO', 'INTEGRADO_SAP', 'ERROR_SAP', 'RECHAZADO_CERRADO'])
  estado?: string;

  @ApiPropertyOptional({ enum: ['1000', '6000', '8000'] })
  @IsOptional()
  @IsIn(['1000', '6000', '8000'])
  sociedad?: string;

  @ApiPropertyOptional({ example: 'R10' })
  @IsOptional()
  @IsString()
  ruta?: string;

  @ApiPropertyOptional({ description: 'Busca por ID, solicitante, factura o CECO', example: 'TKT-82' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 20;
}
