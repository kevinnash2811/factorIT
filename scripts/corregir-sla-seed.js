/**
 * Corrige el SLA de las solicitudes sembradas por seed-solicitudes.js.
 *
 * El problema: el trigger fn_calcular_fecha_limite_sla de Postgres calcula
 * el plazo como "CURRENT_TIMESTAMP + 2 días hábiles", o sea relativo al
 * momento del INSERT — no a la fecha del ticket. Como el seed inserta
 * tickets con creado_en repartido en los últimos 90 días, todos quedaron
 * con un plazo límite en el futuro y por lo tanto "cerrados a tiempo":
 * el indicador de Cumplimiento SLA daba 100% en todas las gerencias.
 *
 * Este script, SOLO sobre las filas sembradas (numero_factura LIKE 'SEED-%'):
 *   1. Recalcula fecha_limite_sla = creado_en + 2 días.
 *   2. Reparte actualizado_en (proxy del cierre) para que ~70% de los
 *      tickets integrados cierren dentro del plazo y ~30% después.
 *
 * No toca las 23 solicitudes reales del esquema original.
 *
 * Uso: node scripts/corregir-sla-seed.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function cargarEnv() {
  const contenido = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  for (const linea of contenido.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const idx = limpia.indexOf('=');
    if (idx === -1) continue;
    const clave = limpia.slice(0, idx).trim();
    if (!(clave in process.env)) process.env[clave] = limpia.slice(idx + 1).trim();
  }
}

cargarEnv();

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  await client.query('SET search_path TO workflow_contabilidad, public');

  // 1. El plazo se ancla a la fecha del ticket, no a la fecha del seed.
  const plazo = await client.query(`
    UPDATE solicitudes_gasto
    SET fecha_limite_sla = creado_en + INTERVAL '2 days'
    WHERE numero_factura LIKE 'SEED-%'
  `);

  // 2. Los tickets ya integrados se cierran en momentos variados: la mayoría
  //    dentro del plazo, una minoría después (para que el indicador tenga
  //    algo real que mostrar).
  const cierre = await client.query(`
    UPDATE solicitudes_gasto
    SET actualizado_en = creado_en + (
      CASE
        WHEN random() < 0.7 THEN (random() * 44 + 2) * INTERVAL '1 hour'   -- dentro de 48h
        ELSE (random() * 120 + 50) * INTERVAL '1 hour'                     -- fuera de plazo
      END
    )
    WHERE numero_factura LIKE 'SEED-%' AND estado_solicitud = 'INTEGRADO_SAP'
  `);

  const { rows } = await client.query(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE actualizado_en <= fecha_limite_sla)::int AS a_tiempo
    FROM solicitudes_gasto WHERE estado_solicitud = 'INTEGRADO_SAP'
  `);
  const { total, a_tiempo } = rows[0];

  await client.end();

  console.log(`Plazos recalculados: ${plazo.rowCount} filas`);
  console.log(`Fechas de cierre repartidas: ${cierre.rowCount} filas`);
  console.log(`Cumplimiento resultante: ${a_tiempo}/${total} a tiempo (${Math.round((a_tiempo / total) * 100)}%)`);
}

main().catch((err) => {
  console.error('Error corrigiendo el SLA sembrado:', err);
  process.exit(1);
});
