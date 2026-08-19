import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'bitacora_auditoria', schema: 'workflow_contabilidad' })
export class BitacoraAuditoriaEntity {
  @PrimaryGeneratedColumn({ name: 'bitacora_id', type: 'bigint' })
  bitacoraId: number;

  @Column({ name: 'solicitud_id', type: 'varchar', length: 50 })
  solicitudId: string;

  @Column({ name: 'paso_numero', type: 'int' })
  pasoNumero: number;

  @Column({ name: 'responsable', type: 'varchar', length: 150 })
  responsable: string;

  @Column({ name: 'accion_ejecutada', type: 'varchar', length: 150 })
  accionEjecutada: string;

  @Column({ name: 'estado_resultado', type: 'varchar', length: 50 })
  estadoResultado: string;

  @Column({ name: 'comentario', type: 'text', nullable: true })
  comentario: string | null;

  @Column({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
