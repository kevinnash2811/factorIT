import { ApiProperty } from '@nestjs/swagger';

export class PresupuestoCecoItemDto {
  @ApiProperty({ example: 'CEFI0009' })
  id: string;

  @ApiProperty({ example: 'Gerencia de Operaciones y Finanzas' })
  nombre: string;

  @ApiProperty({ example: 80000000 })
  presupuestoTotal: number;

  @ApiProperty({ example: 12500000 })
  presupuestoGastado: number;

  @ApiProperty({ example: 67500000 })
  saldoDisponible: number;

  @ApiProperty({ example: 15.6, description: '% del presupuesto ya consumido' })
  consumoPct: number;

  @ApiProperty({ example: '#10b981', description: 'Verde <80%, ámbar 80-95%, rojo >95% — mismo semáforo que ya resuelve el resto del backend.' })
  color: string;
}

export class PresupuestoCecoDto {
  @ApiProperty({ type: [PresupuestoCecoItemDto] })
  items: PresupuestoCecoItemDto[];
}
