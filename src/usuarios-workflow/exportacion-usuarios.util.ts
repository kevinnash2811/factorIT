import * as ExcelJS from 'exceljs';
import {
  NIVELES,
  PLAZOS_SLA_HORAS,
  PALABRA_BORRAR,
  TIPOS_CUENTA,
} from './catalogos-ficha';

/**
 * Plantilla de Excel para editar fichas del Workflow en bloque.
 *
 * El archivo que se descarga es también el que se vuelve a subir: por eso
 * lleva listas desplegables en cada columna editable y una hoja de
 * instrucciones. Cuanto más difícil sea escribir un valor inválido, menos
 * filas rechazadas hay que explicar después.
 */

export interface FilaExportacion {
  retoolUserId: string;
  nombre: string;
  email: string;
  activoRetool: boolean;
  configurado: boolean;
  rut: string | null;
  nivelEtiqueta: string | null;
  plazoSlaHoras: number | null;
  tipoEtiqueta: string | null;
  perfilNombre: string | null;
  habilitado: boolean | null;
  icono: string | null;
  observaciones: string | null;
}

/** Encabezados, en el orden en que se escriben y se leen. */
export const ENCABEZADOS = [
  'ID Retool',
  'Nombre',
  'Correo',
  'Activo en Retool',
  'Ficha',
  'RUT',
  'Nivel jerárquico',
  'Plazo SLA (horas)',
  'Tipo de cuenta',
  'Perfil de permisos',
  'Habilitado en Workflow',
  'Icono',
  'Observaciones',
];

/** Columnas que el importador ignora: están para dar contexto al que edita. */
export const COLUMNAS_INFORMATIVAS = [
  'Nombre',
  'Activo en Retool',
  'Ficha',
  'Tipo de cuenta',
];

export const NOMBRE_HOJA = 'Usuarios';
const HOJA_LISTAS = 'Listas';

const GRIS_ENCABEZADO = 'FFE5E7EB';
const GRIS_INFORMATIVO = 'FFF8FAFC';
const AZUL_TEXTO = 'FF0F172A';

const siNo = (valor: boolean | null): string =>
  valor === null ? '' : valor ? 'Sí' : 'No';

/**
 * Escribe una lista de valores en la hoja auxiliar y devuelve la referencia
 * absoluta para usarla como origen de una lista desplegable. Las listas van
 * en una hoja aparte porque escribirlas dentro de la validación tiene un
 * límite de 255 caracteres que los nombres de perfil superan enseguida.
 */
function columnaDeLista(
  hoja: ExcelJS.Worksheet,
  columna: number,
  titulo: string,
  valores: string[],
): string {
  hoja.getCell(1, columna).value = titulo;
  valores.forEach((v, i) => {
    hoja.getCell(i + 2, columna).value = v;
  });
  const letra = hoja.getColumn(columna).letter;
  return `=${HOJA_LISTAS}!$${letra}$2:$${letra}$${valores.length + 1}`;
}

export function construirLibro(
  filas: FilaExportacion[],
  nombresDePerfil: string[],
): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Portal de Gestión Contable — CLA';
  libro.created = new Date();

  const hoja = libro.addWorksheet(NOMBRE_HOJA, {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 3 }],
  });
  const listas = libro.addWorksheet(HOJA_LISTAS, { state: 'hidden' });

  const refNivel = columnaDeLista(
    listas,
    1,
    'Nivel jerárquico',
    NIVELES.map((n) => n.etiqueta),
  );
  const refSla = columnaDeLista(
    listas,
    2,
    'Plazo SLA',
    PLAZOS_SLA_HORAS.map(String),
  );
  // La lista de tipos queda en la hoja auxiliar solo como referencia: la
  // columna es informativa y el importador rechaza cualquier cambio en ella.
  columnaDeLista(
    listas,
    3,
    'Tipo de cuenta',
    TIPOS_CUENTA.map((t) => t.etiqueta),
  );
  const refPerfil = columnaDeLista(
    listas,
    4,
    'Perfil de permisos',
    nombresDePerfil.length ? nombresDePerfil : ['(no hay perfiles creados)'],
  );
  const refSiNo = columnaDeLista(listas, 5, 'Sí / No', ['Sí', 'No']);

  hoja.columns = [
    { header: ENCABEZADOS[0], key: 'retoolUserId', width: 40 },
    { header: ENCABEZADOS[1], key: 'nombre', width: 28 },
    { header: ENCABEZADOS[2], key: 'email', width: 34 },
    { header: ENCABEZADOS[3], key: 'activoRetool', width: 16 },
    { header: ENCABEZADOS[4], key: 'ficha', width: 16 },
    { header: ENCABEZADOS[5], key: 'rut', width: 16 },
    { header: ENCABEZADOS[6], key: 'nivel', width: 22 },
    { header: ENCABEZADOS[7], key: 'sla', width: 18 },
    { header: ENCABEZADOS[8], key: 'tipo', width: 18 },
    { header: ENCABEZADOS[9], key: 'perfil', width: 26 },
    { header: ENCABEZADOS[10], key: 'habilitado', width: 22 },
    { header: ENCABEZADOS[11], key: 'icono', width: 10 },
    { header: ENCABEZADOS[12], key: 'observaciones', width: 42 },
  ];

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: AZUL_TEXTO } };
  encabezado.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: GRIS_ENCABEZADO },
  };
  encabezado.alignment = { vertical: 'middle' };
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 13 } };

  for (const f of filas) {
    hoja.addRow({
      retoolUserId: f.retoolUserId,
      nombre: f.nombre,
      email: f.email,
      activoRetool: siNo(f.activoRetool),
      ficha: f.configurado ? 'Configurada' : 'Sin configurar',
      rut: f.rut ?? '',
      nivel: f.nivelEtiqueta ?? '',
      sla: f.plazoSlaHoras ?? '',
      tipo: f.tipoEtiqueta ?? '',
      perfil: f.perfilNombre ?? '',
      habilitado: siNo(f.habilitado),
      icono: f.icono ?? '',
      observaciones: f.observaciones ?? '',
    });
  }

  // Las columnas que el importador no lee van en gris, para que se note que
  // editarlas no sirve de nada.
  const informativas = [1, 2, 4, 5, 9];
  for (let fila = 2; fila <= filas.length + 1; fila++) {
    for (const columna of informativas) {
      hoja.getCell(fila, columna).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: GRIS_INFORMATIVO },
      };
    }

    const desplegables: Array<[number, string]> = [
      [7, refNivel],
      [8, refSla],
      [10, refPerfil],
      [11, refSiNo],
    ];
    for (const [columna, formula] of desplegables) {
      hoja.getCell(fila, columna).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: false,
      };
    }
  }

  agregarInstrucciones(libro, nombresDePerfil);
  return libro;
}

function agregarInstrucciones(
  libro: ExcelJS.Workbook,
  nombresDePerfil: string[],
): void {
  const hoja = libro.addWorksheet('Instrucciones');
  hoja.getColumn(1).width = 110;

  const lineas: Array<[string, boolean]> = [
    ['Cómo usar esta planilla', true],
    ['', false],
    [
      '1. Completa las columnas en blanco. Las columnas grises (Nombre, Activo en Retool, Ficha y Tipo de cuenta) son solo informativas: al importar no se leen.',
      false,
    ],
    [
      '2. Una celda vacía deja el dato como está. Para borrar un dato a propósito, escribe ' +
        PALABRA_BORRAR +
        ' en la celda.',
      false,
    ],
    [
      '3. No cambies las columnas ID Retool ni Correo: son las que identifican a cada persona.',
      false,
    ],
    [
      '4. Puedes agregar las columnas que necesites para tu propio trabajo. El sistema solo lee las columnas de esta plantilla e ignora el resto.',
      false,
    ],
    [
      '5. Si agregas una fila con alguien que no existe en Retool, esa fila se informa y se ignora: no se crea a nadie desde aquí.',
      false,
    ],
    [
      '6. La columna Tipo de cuenta es informativa: ni se asciende a Administrador ni se baja a Colaborador desde el Excel. Eso se hace persona por persona desde la pantalla, con el botón Editar.',
      false,
    ],
    ['', false],
    ['Valores aceptados', true],
    ['', false],
    ['Nivel jerárquico: ' + NIVELES.map((n) => n.etiqueta).join(', '), false],
    ['Plazo SLA (horas): ' + PLAZOS_SLA_HORAS.join(', '), false],
    ['Habilitado en Workflow: Sí, No', false],
    [
      'Perfil de permisos: ' +
        (nombresDePerfil.length
          ? nombresDePerfil.join(', ')
          : '(todavía no hay perfiles creados)'),
      false,
    ],
  ];

  for (const [texto, esTitulo] of lineas) {
    const fila = hoja.addRow([texto]);
    fila.getCell(1).alignment = { wrapText: true, vertical: 'top' };
    if (esTitulo) fila.getCell(1).font = { bold: true, size: 13 };
  }
}
