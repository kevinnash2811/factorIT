/**
 * Catálogo de secciones y permisos del portal.
 *
 * Es la fuente de verdad de qué se puede permitir o negar. Vive en el backend
 * y no en Retool a propósito: si estuviera en el front, cada pantalla nueva
 * obligaría a tocar la app, y el servidor no tendría con qué validar lo que le
 * mandan.
 *
 * Los permisos de nivel 2 salen de lo que el sistema realmente hace hoy
 * (los endpoints del BFF), no de una lista inventada.
 */

/** Cómo se pinta y qué valores acepta cada permiso. */
export type TipoPermiso = 'booleano' | 'alcance';

export interface OpcionPermiso {
  valor: string;
  etiqueta: string;
}

export interface PermisoAccion {
  clave: string;
  etiqueta: string;
  descripcion: string;
  tipo: TipoPermiso;
  /** Solo para tipo 'alcance'. El primer valor es el más permisivo. */
  opciones?: OpcionPermiso[];
  /** Valor con el que nace un perfil nuevo: el más restrictivo. */
  porDefecto: string | boolean;
  /**
   * Marca los permisos que exponen datos reservados o dan poder de
   * administración. La interfaz los destaca y el resumen los cuenta aparte.
   */
  sensible?: boolean;
}

export interface SeccionPortal {
  clave: string;
  etiqueta: string;
  descripcion: string;
  icono: string;
  pantalla: string;
  grupo: string;
  acciones: PermisoAccion[];
}

/** Alcance estándar de lectura. Se reutiliza para no inventar variantes. */
const ALCANCE_LECTURA: OpcionPermiso[] = [
  { valor: 'TODAS', etiqueta: 'Todas' },
  { valor: 'PROPIAS', etiqueta: 'Solo las mías' },
  { valor: 'NINGUNA', etiqueta: 'Ninguna' },
];

export const SECCIONES_PORTAL: SeccionPortal[] = [
  {
    clave: 'bandeja',
    etiqueta: 'Bandeja Contable',
    descripcion: 'Ver y gestionar las solicitudes de gasto.',
    icono: '📋',
    pantalla: 'bandejaContablePage',
    grupo: 'OPERACIÓN',
    acciones: [
      {
        clave: 'ver',
        etiqueta: 'Ver solicitudes',
        descripcion: '«Solo las mías» limita la bandeja a las que registró la persona.',
        tipo: 'alcance',
        opciones: ALCANCE_LECTURA,
        porDefecto: 'PROPIAS',
      },
      {
        clave: 'aprobar',
        etiqueta: 'Aprobar solicitudes',
        descripcion: 'Dar el visto bueno para que pase a contabilización.',
        tipo: 'booleano',
        porDefecto: false,
      },
      {
        clave: 'contabilizar',
        etiqueta: 'Contabilizar en SAP',
        descripcion: 'Enviar el asiento contable al ERP. Es irreversible.',
        tipo: 'booleano',
        porDefecto: false,
        sensible: true,
      },
      {
        clave: 'confidenciales',
        etiqueta: 'Ver rutas confidenciales',
        descripcion: 'Solicitudes de rutas marcadas como reservadas.',
        tipo: 'booleano',
        porDefecto: false,
        sensible: true,
      },
      {
        clave: 'exportar',
        etiqueta: 'Exportar a Excel',
        descripcion: 'Descargar la bandeja filtrada.',
        tipo: 'booleano',
        porDefecto: false,
      },
      {
        clave: 'crear',
        etiqueta: 'Registrar solicitudes',
        descripcion: 'Dar de alta una nueva solicitud de gasto desde la bandeja.',
        tipo: 'booleano',
        porDefecto: true,
      },
      {
        clave: 'adjuntar',
        etiqueta: 'Adjuntar respaldo',
        descripcion: 'Subir boleta, factura o recibo del gasto.',
        tipo: 'booleano',
        porDefecto: true,
      },
    ],
  },
  {
    clave: 'reglas',
    etiqueta: 'Matriz de Reglas',
    descripcion: 'Rutas de pago y su configuración contable.',
    icono: '🧭',
    pantalla: 'matrizdeReglasPage',
    grupo: 'CONFIGURACIÓN',
    acciones: [
      {
        clave: 'ver',
        etiqueta: 'Ver rutas de pago',
        descripcion: 'Consultar la matriz de rutas y su configuración.',
        tipo: 'alcance',
        opciones: ALCANCE_LECTURA,
        porDefecto: 'TODAS',
      },
      {
        clave: 'editar',
        etiqueta: 'Crear y editar rutas',
        descripcion: 'Cambia cómo se contabiliza cada tipo de gasto.',
        tipo: 'booleano',
        porDefecto: false,
        sensible: true,
      },
      {
        clave: 'eliminar',
        etiqueta: 'Dar de baja rutas',
        descripcion: 'Desactivar una ruta sin borrar su historial.',
        tipo: 'booleano',
        porDefecto: false,
      },
    ],
  },
  {
    clave: 'presupuesto',
    etiqueta: 'Presupuesto CLA',
    descripcion: 'Consumo de presupuesto por centro de costo.',
    icono: '💰',
    pantalla: 'presupuestoCLAPage',
    grupo: 'CONFIGURACIÓN',
    acciones: [
      {
        clave: 'ver',
        etiqueta: 'Ver consumo',
        descripcion: '«Solo los míos» limita a los centros de costo de su gerencia.',
        tipo: 'alcance',
        opciones: [
          { valor: 'TODAS', etiqueta: 'Todos' },
          { valor: 'PROPIAS', etiqueta: 'Solo los míos' },
          { valor: 'NINGUNA', etiqueta: 'Ninguno' },
        ],
        porDefecto: 'PROPIAS',
      },
    ],
  },
  {
    clave: 'tracta',
    etiqueta: 'Cuentas Contables',
    descripcion: 'Maestro de cuentas contables del ERP.',
    icono: '📘',
    pantalla: 'cuentasTractaPage',
    grupo: 'CONFIGURACIÓN',
    acciones: [
      {
        clave: 'ver',
        etiqueta: 'Ver cuentas contables',
        descripcion: 'Consultar el maestro de cuentas.',
        tipo: 'alcance',
        opciones: ALCANCE_LECTURA,
        porDefecto: 'TODAS',
      },
      {
        clave: 'editar',
        etiqueta: 'Crear y editar cuentas',
        descripcion: 'Modifica el maestro que usa la contabilización.',
        tipo: 'booleano',
        porDefecto: false,
        sensible: true,
      },
    ],
  },
  {
    clave: 'reportes',
    etiqueta: 'Reportes',
    descripcion: 'Listados, indicadores y exportación a Excel.',
    icono: '📈',
    pantalla: 'reportesPage',
    grupo: 'ANÁLISIS',
    acciones: [
      {
        clave: 'ver',
        etiqueta: 'Ver reportes',
        descripcion: 'Listados e indicadores del área.',
        tipo: 'alcance',
        opciones: ALCANCE_LECTURA,
        porDefecto: 'PROPIAS',
      },
      {
        clave: 'confidenciales',
        etiqueta: 'Incluir rutas confidenciales',
        descripcion: 'Sin esto, los montos reservados salen enmascarados.',
        tipo: 'booleano',
        porDefecto: false,
        sensible: true,
      },
      {
        clave: 'exportar',
        etiqueta: 'Exportar a Excel',
        descripcion: 'Descargar el reporte con los filtros aplicados.',
        tipo: 'booleano',
        porDefecto: false,
      },
    ],
  },
  {
    clave: 'usuarios',
    etiqueta: 'Usuarios y Permisos',
    descripcion: 'Administrar quién entra y qué puede hacer.',
    icono: '👥',
    pantalla: 'usuariosSLAPage',
    grupo: 'ADMINISTRACIÓN',
    acciones: [
      {
        clave: 'ver',
        etiqueta: 'Ver usuarios',
        descripcion: 'Consultar el listado de personas y sus fichas.',
        tipo: 'booleano',
        porDefecto: false,
      },
      {
        clave: 'configurar',
        etiqueta: 'Configurar fichas de usuario',
        descripcion: 'RUT, nivel jerárquico, plazo de SLA y tipo de cuenta.',
        tipo: 'booleano',
        porDefecto: false,
        sensible: true,
      },
      {
        clave: 'perfiles',
        etiqueta: 'Administrar perfiles de permiso',
        descripcion: 'Quien tenga esto puede darse permisos a sí mismo.',
        tipo: 'booleano',
        porDefecto: false,
        sensible: true,
      },
    ],
  },
];

export const CLAVES_SECCION = SECCIONES_PORTAL.map((s) => s.clave);

/** Total de permisos de nivel 2 en todo el portal. */
export const TOTAL_ACCIONES = SECCIONES_PORTAL.reduce(
  (t, s) => t + s.acciones.length,
  0,
);

/** Permisos marcados como sensibles, para contarlos en el resumen. */
export const ACCIONES_SENSIBLES = SECCIONES_PORTAL.flatMap((s) =>
  s.acciones.filter((a) => a.sensible).map((a) => `${s.clave}.${a.clave}`),
);

/** Los valores con los que nace un perfil nuevo, todos en lo más restrictivo. */
export function permisosPorDefecto(): Record<string, Record<string, unknown>> {
  const base: Record<string, Record<string, unknown>> = {};
  for (const seccion of SECCIONES_PORTAL) {
    base[seccion.clave] = {};
    for (const accion of seccion.acciones) {
      base[seccion.clave][accion.clave] = accion.porDefecto;
    }
  }
  return base;
}
