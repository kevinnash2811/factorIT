/**
 * Genera solicitudes de prueba en volumen (por defecto 1500) para probar
 * cómo responde la Bandeja Contable de Retool con carga real de datos.
 *
 * Uso:
 *   node scripts/seed-solicitudes.js            -> 1500 registros
 *   node scripts/seed-solicitudes.js 2000        -> 2000 registros
 *
 * Qué hace:
 *   1. Inserta N filas en solicitudes_gasto (rutas/CECOs reales de schema.sql,
 *      montos/fechas/estados variados, número de factura único con prefijo
 *      "SEED-" para poder distinguirlas de datos reales).
 *   2. Inserta 2-5 filas de bitacora_auditoria por cada solicitud, coherentes
 *      con su estado final, para que el botón "Bitácora" de la UI no quede vacío.
 *   3. Para las solicitudes que no quedan en INTEGRADO_SAP, sobrescribe
 *      fecha_limite_sla con una fecha realista (pasada, por vencer o futura)
 *      -- el trigger de Postgres siempre la fija a "ahora + 2 días hábiles" al
 *      insertar, así que se corrige después para tener variedad de SLA.
 *   4. Guarda los IDs generados en scripts/.seed-manifest.json para poder
 *      deshacerlo limpio con unseed-solicitudes.js.
 *
 * No usa TypeORM (sería lentísimo insertar de a una fila); usa `pg` directo
 * con INSERTs multi-fila en lotes, ambos ya son dependencias del proyecto.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function cargarEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const contenido = fs.readFileSync(envPath, 'utf8');
  for (const linea of contenido.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const idx = limpia.indexOf('=');
    if (idx === -1) continue;
    const clave = limpia.slice(0, idx).trim();
    const valor = limpia.slice(idx + 1).trim();
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}

cargarEnv();

const TOTAL = parseInt(process.argv[2], 10) || 1500;
const TAMANO_LOTE = 250;

const RUTAS = [
  ['R01', '1000'], ['R02', '1000'], ['R03', '6000'], ['R04', '1000'], ['R05', '1000'],
  ['R06', '1000'], ['R07', '1000'], ['R08', '8000'], ['R09', '6000'], ['R10', '1000'],
  ['R11', '1000'], ['R12', '1000'], ['R13', '8000'], ['R14', '1000'], ['R15', '1000'],
  ['R16', '1000'], ['R17', '1000'], ['R18', '1000'], ['R19', '1000'], ['R20', '1000'],
  ['R21', '1000'], ['R22', '1000'], ['R23', '1000'],
];

const CECOS = ['CEBE0099', 'CEFI0012', 'CETE0045', 'CEPE0033', 'CEFI0009'];

const COLABORADORES = [
  'Carlos Blanco', 'Paola Campos', 'Miguel Fuentes', 'Angel Rojas', 'Kevin Torrez',
  'Francisca Gonzalez', 'Pedro Sanchez', 'Constanza Diaz', 'Javier Munoz', 'Camila Silva',
  'Rodrigo Jara', 'Patricia Soto', 'Andrea Lopez', 'Felipe Castro', 'Valentina Reyes',
  'Diego Morales', 'Sofia Vergara', 'Matias Pizarro', 'Fernanda Vidal', 'Ignacio Bravo',
  'Antonia Sepulveda', 'Cristobal Aguilera', 'Josefa Contreras', 'Sebastian Riquelme',
  'Trinidad Herrera', 'Nicolas Espinoza', 'Martina Tapia', 'Benjamin Carrasco',
];

const CARGOS = [
  ['Analista Contable', 'Subgerencia de Contabilidad'],
  ['Analista de Tesorería', 'Gerencia de Finanzas'],
  ['Jefe de Operaciones', 'Gerencia de Operaciones y Finanzas'],
  ['Analista de Beneficios', 'Gerencia de Beneficios Sociales'],
  ['Coordinador RRHH', 'Gerencia de Personas'],
];

// { estado, peso, requiereFactura }
const ESTADOS = [
  { estado: 'INTEGRADO_SAP', peso: 55 },
  { estado: 'PENDIENTE_APROBACION', peso: 15 },
  { estado: 'APROBADO_CONTABILIZAR', peso: 10 },
  { estado: 'EN_REPARO', peso: 8 },
  { estado: 'ERROR_SAP', peso: 6 },
  { estado: 'RECHAZADO_CERRADO', peso: 6 },
];
const POOL_ESTADOS = ESTADOS.flatMap((e) => Array(e.peso).fill(e.estado));

function elegir(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function entero(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fechaAleatoriaUltimosDias(dias) {
  const ahora = Date.now();
  const offsetMs = entero(0, dias * 24 * 60 * 60 * 1000);
  return new Date(ahora - offsetMs);
}

function generarBitacora(solicitudId, estado, solicitante, creadoEn) {
  const pasos = [
    { paso: 1, responsable: solicitante, accion: 'Creación de Ticket', estado: 'PENDIENTE_APROBACION', comentario: 'Solicitud ingresada vía Portal de Gestión Contable.' },
  ];
  let t = new Date(creadoEn.getTime() + 1000 * 60 * entero(15, 180));

  if (estado === 'RECHAZADO_CERRADO') {
    pasos.push({ paso: 2, responsable: 'Rodrigo Jara', accion: 'Revisión Documental', estado: 'RECHAZADO_CERRADO', comentario: 'Rechazado por documentación insuficiente.' });
  } else if (estado === 'EN_REPARO') {
    pasos.push({ paso: 2, responsable: 'Rodrigo Jara', accion: 'Revisión Documental', estado: 'EN_REPARO', comentario: 'Devuelto al solicitante para corregir datos bancarios.' });
  } else if (estado === 'PENDIENTE_APROBACION') {
    pasos.push({ paso: 2, responsable: 'Rodrigo Jara', accion: 'En cola de revisión', estado: 'PENDIENTE_APROBACION', comentario: null });
  } else {
    pasos.push({ paso: 2, responsable: 'Rodrigo Jara', accion: 'Aprobación Jefatura', estado: 'APROBADO_CONTABILIZAR', comentario: 'Aprobado, cumple política contable CLA.' });
    if (estado === 'APROBADO_CONTABILIZAR') {
      pasos.push({ paso: 3, responsable: 'Patricia Soto', accion: 'Contabilización pendiente', estado: 'APROBADO_CONTABILIZAR', comentario: null });
    } else if (estado === 'ERROR_SAP') {
      pasos.push({ paso: 3, responsable: 'Patricia Soto', accion: 'Intento de Integración SAP', estado: 'ERROR_SAP', comentario: 'SAP FB60 rechazó el voucher: cuenta contable bloqueada.' });
    } else if (estado === 'INTEGRADO_SAP') {
      pasos.push({ paso: 3, responsable: 'Patricia Soto', accion: 'Contabilización', estado: 'APROBADO_CONTABILIZAR', comentario: 'Asiento contable generado.' });
      pasos.push({ paso: 4, responsable: 'Sistema RPA', accion: 'Integración SAP FB60', estado: 'INTEGRADO_SAP', comentario: 'Voucher generado e integrado correctamente.' });
    }
  }

  return pasos.map((p) => {
    t = new Date(t.getTime() + 1000 * 60 * entero(30, 240));
    return { solicitudId, paso: p.paso, responsable: p.responsable, accion: p.accion, estado: p.estado, comentario: p.comentario, creadoEn: new Date(t) };
  });
}

function calcularFechaLimiteRealista(estado, creadoEn) {
  // El trigger de Postgres SIEMPRE fija fecha_limite_sla a "ahora + 2 días
  // hábiles" al insertar — relativo al momento del seed, no a la fecha del
  // ticket. Se sobrescribe después con un UPDATE (el trigger solo corre en
  // BEFORE INSERT, no en UPDATE).
  //
  // Para los tickets ya integrados el plazo se ancla a SU fecha de creación:
  // si se dejara el plazo del trigger (siempre futuro), todos los cierres
  // pasados quedarían "a tiempo" y el indicador de Cumplimiento SLA daría
  // 100% en todas las gerencias, que fue justamente el error de la primera
  // versión de este script.
  if (estado === 'INTEGRADO_SAP') {
    return new Date(creadoEn.getTime() + 2 * 24 * 60 * 60 * 1000);
  }

  const ahora = Date.now();
  const bucket = Math.random();
  if (bucket < 0.35) return new Date(ahora - entero(1, 5) * 24 * 60 * 60 * 1000); // vencido
  if (bucket < 0.55) return new Date(ahora + entero(1, 11) * 60 * 60 * 1000); // por vencer (<12h)
  return new Date(ahora + entero(13, 96) * 60 * 60 * 1000); // en tiempo
}

/**
 * Momento de cierre de un ticket integrado, usado como proxy de la fecha de
 * integración (no hay columna dedicada). ~70% cierra dentro de las 48h de
 * plazo y ~30% después, para que el indicador tenga variedad real.
 */
function calcularCierreRealista(creadoEn) {
  const horas = Math.random() < 0.7 ? entero(2, 46) : entero(50, 170);
  return new Date(creadoEn.getTime() + horas * 60 * 60 * 1000);
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  // Las funciones de trigger (fn_prevenir_gasto_duplicado, etc.) referencian
  // las tablas sin calificar el esquema, así que dependen del search_path de
  // la sesión — TypeORM lo resuelve solo para sus propias queries, pero una
  // conexión pg directa necesita fijarlo a mano.
  await client.query('SET search_path TO workflow_contabilidad, public');
  console.log(`Conectado a ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}. Generando ${TOTAL} solicitudes...`);

  const idsGenerados = [];
  let facturaSeq = Date.now() % 1000000; // arranque único por corrida, evita choques con corridas previas

  for (let inicio = 0; inicio < TOTAL; inicio += TAMANO_LOTE) {
    const filas = [];
    const filasBitacora = [];
    const cantidadLote = Math.min(TAMANO_LOTE, TOTAL - inicio);

    for (let i = 0; i < cantidadLote; i++) {
      const [rutaId, sociedad] = elegir(RUTAS);
      const cecoId = elegir(CECOS);
      const estado = elegir(POOL_ESTADOS);
      const solicitante = elegir(COLABORADORES);
      const [cargo, gerencia] = elegir(CARGOS);
      const monto = entero(1, 500) * 10000; // montos redondos entre 10.000 y 5.000.000
      const creadoEn = fechaAleatoriaUltimosDias(90);
      facturaSeq += 1;
      const numeroFactura = `SEED-${facturaSeq}`;
      const esIntegrado = estado === 'INTEGRADO_SAP';

      const fila = {
        solicitante,
        rutaId,
        cecoId,
        monto,
        numeroFactura,
        estado,
        voucherSapId: esIntegrado ? `5000${entero(100000, 999999)}` : null,
        nroDocumentoSap: esIntegrado ? `${entero(1900000000, 1999999999)}` : null,
        creadoEn,
        solicitanteCargo: cargo,
        solicitanteGerencia: gerencia,
      };
      filas.push(fila);
    }

    const cols = [
      'solicitante', 'ruta_id', 'ceco_id', 'monto_clp', 'numero_factura',
      'estado_solicitud', 'voucher_sap_id', 'nro_documento_sap', 'creado_en',
      'actualizado_en', 'solicitante_cargo', 'solicitante_gerencia',
    ];
    const placeholders = [];
    const valores = [];
    filas.forEach((f, i) => {
      const base = i * cols.length;
      placeholders.push(`(${cols.map((_, j) => `$${base + j + 1}`).join(', ')})`);
      valores.push(
        f.solicitante, f.rutaId, f.cecoId, f.monto, f.numeroFactura,
        f.estado, f.voucherSapId, f.nroDocumentoSap, f.creadoEn,
        f.creadoEn, f.solicitanteCargo, f.solicitanteGerencia,
      );
    });

    // INSERT ... VALUES (multi-fila) con RETURNING conserva el mismo orden
    // que la lista de VALUES, así que se puede mapear por posición con `filas`.
    const sql = `INSERT INTO workflow_contabilidad.solicitudes_gasto (${cols.join(', ')}) VALUES ${placeholders.join(', ')} RETURNING solicitud_id, estado_solicitud, creado_en`;
    const resultado = await client.query(sql, valores);

    const idsParaFechaLimite = [];
    const fechasLimite = [];
    const fechasCierre = [];
    for (let i = 0; i < resultado.rows.length; i++) {
      const fila = resultado.rows[i];
      const original = filas[i];
      idsGenerados.push(fila.solicitud_id);
      const pasos = generarBitacora(fila.solicitud_id, fila.estado_solicitud, original.solicitante, new Date(fila.creado_en));
      filasBitacora.push(...pasos);

      const creadoEn = new Date(fila.creado_en);
      const fechaLimite = calcularFechaLimiteRealista(fila.estado_solicitud, creadoEn);
      if (fechaLimite) {
        idsParaFechaLimite.push(fila.solicitud_id);
        fechasLimite.push(fechaLimite);
        // Para los integrados, además se reparte el momento de cierre.
        fechasCierre.push(
          fila.estado_solicitud === 'INTEGRADO_SAP' ? calcularCierreRealista(creadoEn) : creadoEn,
        );
      }
    }

    // Un solo UPDATE masivo por lote (en vez de una query por fila) usando
    // unnest() para emparejar id <-> fecha_limite_sla por posición.
    if (idsParaFechaLimite.length > 0) {
      await client.query(
        `UPDATE workflow_contabilidad.solicitudes_gasto AS s
         SET fecha_limite_sla = datos.fecha,
             actualizado_en   = datos.cierre
         FROM (SELECT unnest($1::varchar[]) AS id,
                      unnest($2::timestamptz[]) AS fecha,
                      unnest($3::timestamptz[]) AS cierre) AS datos
         WHERE s.solicitud_id = datos.id`,
        [idsParaFechaLimite, fechasLimite, fechasCierre],
      );
    }

    if (filasBitacora.length > 0) {
      const bCols = ['solicitud_id', 'paso_numero', 'responsable', 'accion_ejecutada', 'estado_resultado', 'comentario', 'creado_en'];
      const bPlaceholders = [];
      const bValores = [];
      filasBitacora.forEach((b, i) => {
        const base = i * bCols.length;
        bPlaceholders.push(`(${bCols.map((_, j) => `$${base + j + 1}`).join(', ')})`);
        bValores.push(b.solicitudId, b.paso, b.responsable, b.accion, b.estado, b.comentario, b.creadoEn);
      });
      const bSql = `INSERT INTO workflow_contabilidad.bitacora_auditoria (${bCols.join(', ')}) VALUES ${bPlaceholders.join(', ')}`;
      await client.query(bSql, bValores);
    }

    console.log(`  ${Math.min(inicio + cantidadLote, TOTAL)}/${TOTAL} solicitudes insertadas...`);
  }

  const manifestPath = path.join(__dirname, '.seed-manifest.json');
  const previo = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  fs.writeFileSync(manifestPath, JSON.stringify([...previo, ...idsGenerados], null, 2));

  await client.end();
  console.log(`\nListo. ${idsGenerados.length} solicitudes + bitácoras creadas.`);
  console.log(`IDs guardados en scripts/.seed-manifest.json (${previo.length + idsGenerados.length} en total acumulado).`);
  console.log('Para deshacerlo: node scripts/unseed-solicitudes.js');
}

main().catch((err) => {
  console.error('Error generando datos de prueba:', err);
  process.exit(1);
});
