import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'erp_tracta', schema: 'workflow_contabilidad' })
export class ErpTractaEntity {
  @PrimaryColumn({ name: 'tct_secuencia', type: 'int' })
  tctSecuencia: number;

  @Column({ name: 'erp_empresa', type: 'varchar', length: 10 })
  erpEmpresa: string;

  @Column({ name: 'sis_sistema', type: 'varchar', length: 20 })
  sisSistema: string;

  @Column({ name: 'tct_transaccion', type: 'varchar', length: 100 })
  tctTransaccion: string;

  @Column({ name: 'tct_glosa_trans', type: 'varchar', length: 150 })
  tctGlosaTrans: string;

  @Column({ name: 'tct_clase_cuenta', type: 'varchar', length: 5 })
  tctClaseCuenta: string;

  @Column({ name: 'tct_cuenta_sap', type: 'varchar', length: 50 })
  tctCuentaSap: string;

  @Column({ name: 'tct_cta_aux', type: 'varchar', length: 50, nullable: true })
  tctCtaAux: string | null;

  @Column({ name: 'tct_contra_cta', type: 'varchar', length: 50, nullable: true })
  tctContraCta: string | null;

  @Column({ name: 'par_tipodoc_caja', type: 'varchar', length: 5 })
  parTipodocCaja: string;

  @Column({ name: 'tct_centro_benef', type: 'varchar', length: 50, nullable: true })
  tctCentroBenef: string | null;

  @Column({ name: 'cen_numcen', type: 'varchar', length: 50, nullable: true })
  cenNumcen: string | null;

  @Column({ name: 'tct_val_uni', type: 'int', nullable: true })
  tctValUni: number | null;

  @Column({ name: 'tct_estado', type: 'varchar', length: 1 })
  tctEstado: string;
}
