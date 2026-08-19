import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'centros_costo', schema: 'workflow_contabilidad' })
export class CentroCostoEntity {
  @PrimaryColumn({ name: 'ceco_id', type: 'varchar', length: 20 })
  cecoId: string;

  @Column({ name: 'nombre_gerencia', type: 'varchar', length: 150 })
  nombreGerencia: string;

  @Column({ name: 'presupuesto_total', type: 'numeric', precision: 15, scale: 2 })
  presupuestoTotal: number;

  @Column({ name: 'presupuesto_gastado', type: 'numeric', precision: 15, scale: 2 })
  presupuestoGastado: number;
}
