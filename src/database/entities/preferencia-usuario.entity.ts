import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Preferencias de interfaz por usuario, persistidas en la base para que
 * sobrevivan al navegador: si el analista oculta columnas en su equipo y
 * después entra desde otro computador, ve la misma configuración.
 *
 * Se guarda una fila por (usuario, pantalla) — no un blob global — para que
 * cada pantalla pueda tener su propia configuración sin pisarse.
 *
 * TODO: `usuarioEmail` llega hoy desde `current_user.email` de Retool, sin
 * validar. Cuando exista el JWT de Keycloak (ver CONTEXTO_BASE_WORKFLOW.md),
 * la identidad debe salir del token y no del parámetro.
 */
@Entity({ name: 'preferencias_usuario', schema: 'workflow_contabilidad' })
@Unique('uq_preferencia_usuario_pantalla', ['usuarioEmail', 'pantalla'])
export class PreferenciaUsuarioEntity {
  @PrimaryGeneratedColumn({ name: 'preferencia_id', type: 'int' })
  preferenciaId: number;

  @Column({ name: 'usuario_email', type: 'varchar', length: 150 })
  usuarioEmail: string;

  @Column({ name: 'pantalla', type: 'varchar', length: 50 })
  pantalla: string;

  @Column({ name: 'columnas_ocultas', type: 'jsonb', default: () => "'[]'::jsonb" })
  columnasOcultas: string[];

  @Column({ name: 'actualizado_en', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  actualizadoEn: Date;
}
