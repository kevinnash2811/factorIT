import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'lineas_ajuste_contable', schema: 'workflow_contabilidad' })
export class LineaAjusteContableEntity {
  @PrimaryGeneratedColumn({ name: 'linea_id', type: 'bigint' })
  lineaId: number;

  @Column({ name: 'solicitud_id', type: 'varchar', length: 50 })
  solicitudId: string;

  @Column({ name: 'linea_secuencia', type: 'int' })
  lineaSecuencia: number;

  @Column({ name: 'origen_monto_comp', type: 'numeric', precision: 15, scale: 2, nullable: true })
  origenMontoComp: number | null;

  @Column({ name: 'origen_cod', type: 'varchar', length: 20, nullable: true })
  origenCod: string | null;

  @Column({ name: 'origen_cuenta', type: 'varchar', length: 50 })
  origenCuenta: string;

  @Column({ name: 'origen_num_comp', type: 'varchar', length: 100, nullable: true })
  origenNumComp: string | null;

  @Column({ name: 'origen_rut', type: 'varchar', length: 20, nullable: true })
  origenRut: string | null;

  @Column({ name: 'origen_dv', type: 'varchar', length: 5, nullable: true })
  origenDv: string | null;

  @Column({ name: 'destino_monto_ajuste', type: 'numeric', precision: 15, scale: 2 })
  destinoMontoAjuste: number;

  @Column({ name: 'destino_cod', type: 'varchar', length: 20, nullable: true })
  destinoCod: string | null;

  @Column({ name: 'destino_cuenta', type: 'varchar', length: 50 })
  destinoCuenta: string;

  @Column({ name: 'destino_observacion', type: 'varchar', length: 255, nullable: true })
  destinoObservacion: string | null;
}
