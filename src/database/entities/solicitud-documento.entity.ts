import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SolicitudGastoEntity } from './solicitud-gasto.entity';

/**
 * Un archivo de respaldo de una solicitud.
 *
 * Antes el adjunto vivía en tres columnas de solicitudes_gasto, lo que limitaba
 * a uno por ticket. Una factura suele venir con su boleta y su respaldo, así
 * que pasaron a una tabla propia.
 */
@Entity({ name: 'solicitud_documentos', schema: 'workflow_contabilidad' })
export class SolicitudDocumentoEntity {
  @PrimaryGeneratedColumn({ name: 'documento_id' })
  documentoId: number;

  @Column({ name: 'solicitud_id', type: 'varchar', length: 50 })
  solicitudId: string;

  @ManyToOne(() => SolicitudGastoEntity)
  @JoinColumn({ name: 'solicitud_id' })
  solicitud: SolicitudGastoEntity;

  /** Nombre original con el que la persona subió el archivo. */
  @Column({ name: 'nombre', type: 'varchar', length: 255 })
  nombre: string;

  /** Ruta con la que el portal lo sirve: /documentos/archivos/<uuid>.<ext> */
  @Column({ name: 'url', type: 'varchar', length: 512 })
  url: string;

  @Column({ name: 'peso_kb', type: 'varchar', length: 50, nullable: true })
  pesoKb: string | null;

  @Column({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;
}
