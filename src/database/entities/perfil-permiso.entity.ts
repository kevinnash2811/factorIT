import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Perfil de permisos: un conjunto de secciones del portal con nombre.
 *
 * Las secciones se guardan como arreglo de claves en JSONB y no como una
 * columna por sección, para que agregar una pantalla nueva al portal no
 * obligue a migrar la tabla.
 */
@Entity({ schema: 'workflow_contabilidad', name: 'perfiles_permiso' })
@Unique('uq_perfiles_permiso_nombre', ['nombre'])
export class PerfilPermisoEntity {
  @PrimaryGeneratedColumn({ name: 'perfil_id' })
  perfilId: number;

  @Column({ name: 'nombre', type: 'varchar', length: 80 })
  nombre: string;

  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion: string | null;

  /** Claves de las secciones habilitadas, ej: ["bandeja","reportes"]. */
  @Column({ name: 'secciones', type: 'jsonb', default: () => "'[]'::jsonb" })
  secciones: string[];

  /**
   * Acciones habilitadas dentro de cada sección, indexadas por clave de
   * sección. Ej: {"bandeja": {"ver": "TODAS", "aprobar": true}}.
   */
  @Column({ name: 'permisos', type: 'jsonb', default: () => "'{}'::jsonb" })
  permisos: Record<string, Record<string, unknown>>;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo: boolean;

  @Column({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
