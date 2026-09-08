import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * Datos del Workflow que complementan a un usuario de Retool.
 *
 * Deliberadamente NO guarda nombre ni si está activo: eso vive en Retool y se
 * lee de su API. Duplicarlo abriría la puerta a que las dos fuentes discrepen.
 * Aquí solo va lo que Retool no sabe.
 */
@Entity({ schema: 'workflow_contabilidad', name: 'usuarios_workflow' })
@Unique('uq_usuarios_workflow_retool', ['retoolUserId'])
export class UsuarioWorkflowEntity {
  @PrimaryGeneratedColumn({ name: 'usuario_id' })
  usuarioId: number;

  /** Id que devuelve GET /api/v2/users, con formato "user_<32 hex>". */
  @Column({ name: 'retool_user_id', type: 'varchar', length: 100 })
  retoolUserId: string;

  /**
   * Llave de respaldo. El identificador que expone la app
   * (`current_user.sid`) puede no venir en el mismo formato que el id de la
   * API; con el correo siempre se resuelve la fila.
   */
  @Index('idx_usuarios_workflow_email')
  @Column({ name: 'email', type: 'varchar', length: 150 })
  email: string;

  @Column({ name: 'rut', type: 'varchar', length: 20, nullable: true })
  rut: string | null;

  @Column({
    name: 'nivel_jerarquico',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  nivelJerarquico: string | null;

  @Column({ name: 'plazo_sla_horas', type: 'int', nullable: true })
  plazoSlaHoras: number | null;

  @Column({ name: 'icono', type: 'varchar', length: 20, nullable: true })
  icono: string | null;

  @Column({ name: 'observaciones', type: 'text', nullable: true })
  observaciones: string | null;

  /**
   * Tipo de cuenta DENTRO del Workflow. Independiente de `is_admin` de Retool:
   * allá significa administrar la plataforma, aquí administrar este módulo.
   */
  @Column({
    name: 'tipo_usuario',
    type: 'varchar',
    length: 20,
    default: 'COLABORADOR',
  })
  tipoUsuario: string;

  /**
   * Habilitado EN EL WORKFLOW. Distinto de `active` de Retool: alguien puede
   * entrar al portal y aun así no participar del flujo contable.
   */
  @Column({ name: 'habilitado', type: 'boolean', default: true })
  habilitado: boolean;

  /**
   * Perfil de permisos asignado. Null = sin perfil todavía. La FK usa
   * ON DELETE SET NULL: borrar un perfil deja a la persona sin perfil, no
   * borra su ficha.
   */
  @Column({ name: 'perfil_id', type: 'int', nullable: true })
  perfilId: number | null;

  @Column({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
