/**
 * Elimina exactamente las solicitudes generadas por seed-solicitudes.js,
 * usando el manifiesto de IDs que ese script va guardando en
 * scripts/.seed-manifest.json. bitacora_auditoria se borra sola por el
 * ON DELETE CASCADE de la FK a solicitudes_gasto.
 *
 * Uso: node scripts/unseed-solicitudes.js
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

async function main() {
  const manifestPath = path.join(__dirname, '.seed-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('No hay scripts/.seed-manifest.json — no hay nada que deshacer.');
    return;
  }
  const ids = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (ids.length === 0) {
    console.log('El manifiesto está vacío — no hay nada que deshacer.');
    return;
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  await client.query('SET search_path TO workflow_contabilidad, public');
  console.log(`Borrando ${ids.length} solicitudes de prueba (y su bitácora en cascada)...`);

  const resultado = await client.query(
    `DELETE FROM workflow_contabilidad.solicitudes_gasto WHERE solicitud_id = ANY($1::varchar[])`,
    [ids],
  );

  await client.end();
  fs.unlinkSync(manifestPath);
  console.log(`Listo. ${resultado.rowCount} solicitudes eliminadas. Manifiesto borrado.`);
}

main().catch((err) => {
  console.error('Error deshaciendo los datos de prueba:', err);
  process.exit(1);
});
