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
      'Si es false, no hay restricciones aplicadas: la persona no tiene ficha o no tiene perfil.',
  })
  restringido: boolean;

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
