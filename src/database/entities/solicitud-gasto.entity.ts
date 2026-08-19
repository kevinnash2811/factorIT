import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { RutaPagoEntity } from './ruta-pago.entity';
import { CentroCostoEntity } from './centro-costo.entity';

/**
 * Nota: además de las columnas declaradas en schema.sql, la tabla real en
 * bd_cla_prod tiene 4 columnas que el DDL no declara (agregadas en caliente
 * por el prototipo): medio_pago, beneficiario_cheque, beneficiario_rut y
 * nro_documento_sap. Quedan mapeadas acá porque existen en la base real.
 */
@Entity({ name: 'solicitudes_gasto', schema: 'workflow_contabilidad' })
export class SolicitudGastoEntity {
  @PrimaryColumn({ name: 'solicitud_id', type: 'varchar', length: 50 })
  solicitudId: string;

  @Column({ name: 'solicitante', type: 'varchar', length: 150 })
  solicitante: string;

  @Column({ name: 'ruta_id', type: 'varchar', length: 10 })
  rutaId: string;

  @ManyToOne(() => RutaPagoEntity)
  @JoinColumn({ name: 'ruta_id' })
  ruta: RutaPagoEntity;

  @Column({ name: 'ceco_id', type: 'varchar', length: 20 })
  cecoId: string;

  @ManyToOne(() => CentroCostoEntity)
  @JoinColumn({ name: 'ceco_id' })
  ceco: CentroCostoEntity;

  @Column({ name: 'monto_clp', type: 'numeric', precision: 15, scale: 2 })
  montoClp: number;

  @Column({ name: 'numero_factura', type: 'varchar', length: 100, nullable: true })
  numeroFactura: string | null;

  @Column({ name: 'estado_solicitud', type: 'varchar', length: 50 })
  estadoSolicitud: string;

  @Column({ name: 'voucher_sap_id', type: 'varchar', length: 50, nullable: true })
  voucherSapId: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, nullable: true })
  idempotencyKey: string | null;

  @Column({ name: 'fecha_limite_sla', type: 'timestamptz', nullable: true })
  fechaLimiteSla: Date | null;

  @Column({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;

  @Column({ name: 'documento_nombre', type: 'varchar', length: 255, nullable: true })
  documentoNombre: string | null;

  @Column({ name: 'documento_gcs_uri', type: 'varchar', length: 512, nullable: true })
  documentoGcsUri: string | null;

  @Column({ name: 'documento_peso_kb', type: 'varchar', length: 50, nullable: true })
  documentoPesoKb: string | null;

  @Column({ name: 'banco_nombre', type: 'varchar', length: 100, nullable: true })
  bancoNombre: string | null;

  @Column({ name: 'banco_tipo_cuenta', type: 'varchar', length: 50, nullable: true })
  bancoTipoCuenta: string | null;

  @Column({ name: 'banco_nro_cuenta', type: 'varchar', length: 50, nullable: true })
  bancoNroCuenta: string | null;

  @Column({ name: 'banco_rut_titular', type: 'varchar', length: 20, nullable: true })
  bancoRutTitular: string | null;

  @Column({ name: 'solicitante_cargo', type: 'varchar', length: 150, nullable: true })
  solicitanteCargo: string | null;

  @Column({ name: 'solicitante_gerencia', type: 'varchar', length: 150, nullable: true })
  solicitanteGerencia: string | null;

  // --- Columnas presentes en la BD real pero no en schema.sql ---
  @Column({ name: 'medio_pago', type: 'varchar', length: 50, nullable: true })
  medioPago: string | null;

  @Column({ name: 'beneficiario_cheque', type: 'varchar', length: 150, nullable: true })
  beneficiarioCheque: string | null;

  @Column({ name: 'beneficiario_rut', type: 'varchar', length: 20, nullable: true })
  beneficiarioRut: string | null;

  @Column({ name: 'nro_documento_sap', type: 'varchar', length: 50, nullable: true })
  nroDocumentoSap: string | null;
}
