import { ApiProperty } from '@nestjs/swagger';

/**
 * Lo que el front necesita para decidir qué mostrar, ya resuelto.
 *
 * Se devuelve todo masticado a propósito: si el front tuviera que combinar
 * tipo de cuenta + perfil + catálogo, esa lógica viviría en dos lugares y
 * tarde o temprano discreparían. Aquí se decide una vez.
 */
export class MiAccesoDto {
  @ApiProperty({ description: 'Correo con el que se resolvió el acceso.' })
  usuario: string;

  @ApiProperty({ description: 'Tipo de cuenta en el Workflow, no en Retool.' })
  tipoUsuario: string;

  @ApiProperty({ description: 'Un administrador del sistema accede a todo.' })
  esAdministrador: boolean;

  @ApiProperty({ nullable: true }) perfilNombre: string | null;

  @ApiProperty({
    description:
      'Si es false, la persona accede a todo: solo ocurre con un administrador.',
  })
  restringido: boolean;

  @ApiProperty({
    description:
      'ADMINISTRADOR: acceso total sin perfil. CON_PERFIL: acceso según su perfil. ' +
      'SIN_PERFIL: tiene ficha pero ningún perfil asignado. SIN_FICHA: no está dado de alta ' +
      'en el Workflow. DESHABILITADO: tiene ficha, pero dada de baja — no accede a nada, ' +
      'aunque sea administrador.',
    enum: [
      'ADMINISTRADOR',
      'CON_PERFIL',
      'SIN_PERFIL',
      'SIN_FICHA',
      'DESHABILITADO',
    ],
  })
  estadoAcceso: string;

  @ApiProperty({
    description: 'Si es false, el portal muestra la pantalla de bloqueo.',
  })
  puedeEntrar: boolean;

  @ApiProperty({
    description:
      'Por clave de sección: si la entrada aparece en el menú, aunque esté bloqueada. ' +
      'Un colaborador sin perfil las ve todas para saber qué acceso pedir; `secciones` dice cuáles puede abrir.',
    example: { bandeja: true, reportes: true },
  })
  menu: Record<string, boolean>;

  @ApiProperty({
    description: 'Título de la pantalla de bloqueo. Vacío si puede entrar.',
  })
  tituloBloqueo: string;

  @ApiProperty({
    description:
      'Qué debe hacer la persona para obtener acceso. Vacío si puede entrar.',
  })
  mensajeBloqueo: string;

  @ApiProperty({
    description: 'Por clave de sección: si la entrada del menú se muestra.',
    example: { bandeja: true, reportes: false },
  })
  secciones: Record<string, boolean>;

  @ApiProperty({
    description:
      'Por sección y acción: true/false para las booleanas, el alcance para las de alcance.',
    example: { bandeja: { ver: 'TODAS', aprobar: false } },
  })
  permisos: Record<string, Record<string, string | boolean>>;

  @ApiProperty({
    description: 'Texto para el tooltip de los controles deshabilitados.',
  })
  mensajeSinPermiso: string;
}
