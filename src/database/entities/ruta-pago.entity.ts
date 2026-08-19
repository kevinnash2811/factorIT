import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'rutas_pago', schema: 'workflow_contabilidad' })
export class RutaPagoEntity {
  @PrimaryColumn({ name: 'ruta_id', type: 'varchar', length: 10 })
  rutaId: string;

  @Column({ name: 'nombre_ruta', type: 'varchar', length: 150 })
  nombreRuta: string;

  @Column({ name: 'sociedad_sap', type: 'varchar', length: 10 })
  sociedadSap: string;

  @Column({ name: 'clase_documento_sap', type: 'varchar', length: 5 })
  claseDocumentoSap: string;

  @Column({ name: 'requiere_documento_respaldo', type: 'boolean', default: true })
  requiereDocumentoRespaldo: boolean;

  @Column({ name: 'creado_en', type: 'timestamptz', nullable: true })
  creadoEn: Date;
}
